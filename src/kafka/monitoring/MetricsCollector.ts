export interface MetricValue {
  value: number;
  timestamp: Date;
  labels?: Record<string, string>;
}

export interface CounterMetric {
  count: number;
  rate: number; // per second
  labels?: Record<string, string>;
}

export interface HistogramMetric {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
  buckets: Record<string, number>;
  labels?: Record<string, string>;
}

export interface GaugeMetric {
  value: number;
  timestamp: Date;
  labels?: Record<string, string>;
}

export interface MetricsSnapshot {
  counters: Record<string, CounterMetric>;
  histograms: Record<string, HistogramMetric>;
  gauges: Record<string, GaugeMetric>;
  timestamp: Date;
}

export class MetricsCollector {
  private counters = new Map<string, { count: number; startTime: Date; labels?: Record<string, string> }>();
  private histograms = new Map<string, { values: number[]; labels?: Record<string, string> }>();
  private gauges = new Map<string, { value: number; timestamp: Date; labels?: Record<string, string> }>();
  private startTime = new Date();

  constructor(private namespace: string = 'kafka') {}

  // Counter operations
  incrementCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    const existing = this.counters.get(key);
    
    if (existing) {
      existing.count += value;
    } else {
      this.counters.set(key, {
        count: value,
        startTime: new Date(),
        labels,
      });
    }
  }

  decrementCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    this.incrementCounter(name, -value, labels);
  }

  getCounter(name: string, labels?: Record<string, string>): CounterMetric {
    const key = this.getMetricKey(name, labels);
    const counter = this.counters.get(key);
    
    if (!counter) {
      return { count: 0, rate: 0, labels };
    }

    const duration = (Date.now() - counter.startTime.getTime()) / 1000; // seconds
    const rate = duration > 0 ? counter.count / duration : 0;

    return {
      count: counter.count,
      rate,
      labels: counter.labels,
    };
  }

  // Histogram operations (for timing and size measurements)
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    const existing = this.histograms.get(key);
    
    if (existing) {
      existing.values.push(value);
      // Keep only last 10000 values to prevent memory issues
      if (existing.values.length > 10000) {
        existing.values = existing.values.slice(-5000);
      }
    } else {
      this.histograms.set(key, {
        values: [value],
        labels,
      });
    }
  }

  getHistogram(name: string, labels?: Record<string, string>): HistogramMetric {
    const key = this.getMetricKey(name, labels);
    const histogram = this.histograms.get(key);
    
    if (!histogram || histogram.values.length === 0) {
      return {
        count: 0,
        sum: 0,
        avg: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        buckets: {},
        labels,
      };
    }

    const values = histogram.values.sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((acc, val) => acc + val, 0);
    const avg = sum / count;
    const min = values[0];
    const max = values[count - 1];

    // Calculate percentiles
    const p50 = this.percentile(values, 0.5);
    const p95 = this.percentile(values, 0.95);
    const p99 = this.percentile(values, 0.99);

    // Create histogram buckets
    const buckets = this.createBuckets(values);

    return {
      count,
      sum,
      avg,
      min,
      max,
      p50,
      p95,
      p99,
      buckets,
      labels: histogram.labels,
    };
  }

  // Gauge operations (for current values like memory usage, queue size)
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    this.gauges.set(key, {
      value,
      timestamp: new Date(),
      labels,
    });
  }

  incrementGauge(name: string, value: number = 1, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    const existing = this.gauges.get(key);
    
    if (existing) {
      existing.value += value;
      existing.timestamp = new Date();
    } else {
      this.setGauge(name, value, labels);
    }
  }

  decrementGauge(name: string, value: number = 1, labels?: Record<string, string>): void {
    this.incrementGauge(name, -value, labels);
  }

  getGauge(name: string, labels?: Record<string, string>): GaugeMetric {
    const key = this.getMetricKey(name, labels);
    const gauge = this.gauges.get(key);
    
    return gauge || { value: 0, timestamp: new Date(), labels };
  }

  // Utility methods
  private getMetricKey(name: string, labels?: Record<string, string>): string {
    const fullName = `${this.namespace}_${name}`;
    if (!labels || Object.keys(labels).length === 0) {
      return fullName;
    }
    
    const labelString = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
    
    return `${fullName}{${labelString}}`;
  }

  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    
    const index = p * (sortedValues.length - 1);
    if (index % 1 === 0) {
      return sortedValues[index];
    } else {
      const lower = sortedValues[Math.floor(index)];
      const upper = sortedValues[Math.ceil(index)];
      return lower + (upper - lower) * (index % 1);
    }
  }

  private createBuckets(values: number[]): Record<string, number> {
    const buckets: Record<string, number> = {};
    const bucketBoundaries = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
    
    for (const boundary of bucketBoundaries) {
      buckets[`le_${boundary}`] = values.filter(v => v <= boundary).length;
    }
    
    buckets['+Inf'] = values.length;
    return buckets;
  }

  // Timer utility
  startTimer(name: string, labels?: Record<string, string>): () => void {
    const startTime = Date.now();
    
    return () => {
      const duration = Date.now() - startTime;
      this.recordHistogram(name, duration, labels);
    };
  }

  // Batch operations
  recordBatch(operations: Array<{
    type: 'counter' | 'histogram' | 'gauge';
    name: string;
    value: number;
    labels?: Record<string, string>;
  }>): void {
    for (const op of operations) {
      switch (op.type) {
        case 'counter':
          this.incrementCounter(op.name, op.value, op.labels);
          break;
        case 'histogram':
          this.recordHistogram(op.name, op.value, op.labels);
          break;
        case 'gauge':
          this.setGauge(op.name, op.value, op.labels);
          break;
      }
    }
  }

  // Get all metrics
  getMetrics(): MetricsSnapshot {
    const counters: Record<string, CounterMetric> = {};
    const histograms: Record<string, HistogramMetric> = {};
    const gauges: Record<string, GaugeMetric> = {};

    // Collect all counters
    for (const [key] of this.counters) {
      const [name, labels] = this.parseMetricKey(key);
      counters[key] = this.getCounter(name, labels);
    }

    // Collect all histograms
    for (const [key] of this.histograms) {
      const [name, labels] = this.parseMetricKey(key);
      histograms[key] = this.getHistogram(name, labels);
    }

    // Collect all gauges
    for (const [key, gauge] of this.gauges) {
      gauges[key] = { ...gauge };
    }

    return {
      counters,
      histograms,
      gauges,
      timestamp: new Date(),
    };
  }

  private parseMetricKey(key: string): [string, Record<string, string> | undefined] {
    const parts = key.split('{');
    const name = parts[0].replace(`${this.namespace}_`, '');
    
    if (parts.length === 1) {
      return [name, undefined];
    }
    
    const labelString = parts[1].slice(0, -1); // Remove closing }
    const labels: Record<string, string> = {};
    
    if (labelString) {
      const labelPairs = labelString.split(',');
      for (const pair of labelPairs) {
        const [key, value] = pair.split('=');
        labels[key] = value.slice(1, -1); // Remove quotes
      }
    }
    
    return [name, labels];
  }

  // Export metrics in Prometheus format
  exportPrometheus(): string {
    const lines: string[] = [];
    const metrics = this.getMetrics();

    // Export counters
    for (const [key, counter] of Object.entries(metrics.counters)) {
      const [name] = this.parseMetricKey(key);
      lines.push(`# HELP ${this.namespace}_${name}_total Total count`);
      lines.push(`# TYPE ${this.namespace}_${name}_total counter`);
      
      const labelsStr = counter.labels ? this.formatPrometheusLabels(counter.labels) : '';
      lines.push(`${this.namespace}_${name}_total${labelsStr} ${counter.count}`);
    }

    // Export histograms
    for (const [key, histogram] of Object.entries(metrics.histograms)) {
      const [name] = this.parseMetricKey(key);
      lines.push(`# HELP ${this.namespace}_${name} Histogram`);
      lines.push(`# TYPE ${this.namespace}_${name} histogram`);
      
      const labelsStr = histogram.labels ? this.formatPrometheusLabels(histogram.labels) : '';
      
      // Export buckets
      for (const [bucket, count] of Object.entries(histogram.buckets)) {
        const le = bucket === '+Inf' ? '+Inf' : bucket.replace('le_', '');
        lines.push(`${this.namespace}_${name}_bucket{le="${le}"${labelsStr ? ',' + labelsStr.slice(1, -1) : ''}} ${count}`);
      }
      
      lines.push(`${this.namespace}_${name}_sum${labelsStr} ${histogram.sum}`);
      lines.push(`${this.namespace}_${name}_count${labelsStr} ${histogram.count}`);
    }

    // Export gauges
    for (const [key, gauge] of Object.entries(metrics.gauges)) {
      const [name] = this.parseMetricKey(key);
      lines.push(`# HELP ${this.namespace}_${name} Current value`);
      lines.push(`# TYPE ${this.namespace}_${name} gauge`);
      
      const labelsStr = gauge.labels ? this.formatPrometheusLabels(gauge.labels) : '';
      lines.push(`${this.namespace}_${name}${labelsStr} ${gauge.value}`);
    }

    return lines.join('\n') + '\n';
  }

  private formatPrometheusLabels(labels: Record<string, string>): string {
    const pairs = Object.entries(labels)
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
    return `{${pairs}}`;
  }

  // Reset all metrics
  reset(): void {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
    this.startTime = new Date();
  }

  // Get uptime
  getUptimeSeconds(): number {
    return (Date.now() - this.startTime.getTime()) / 1000;
  }
}

export default MetricsCollector;