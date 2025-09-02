export class MetricsCollector {
  private counters = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private gauges = new Map<string, number>();

  constructor(private namespace: string = 'kafka') {}

  incrementCounter(name: string, value: number = 1): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  recordHistogram(name: string, value: number): void {
    const values = this.histograms.get(name) || [];
    values.push(value);
    // Keep only last 1000 values
    if (values.length > 1000) {
      values.splice(0, values.length - 1000);
    }
    this.histograms.set(name, values);
  }

  setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  getMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};
    
    // Add counters
    for (const [name, value] of this.counters) {
      metrics[name] = value;
    }
    
    // Add histogram averages
    for (const [name, values] of this.histograms) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      metrics[`${name}_avg`] = avg;
      metrics[`${name}_count`] = values.length;
    }
    
    // Add gauges
    for (const [name, value] of this.gauges) {
      metrics[name] = value;
    }
    
    return metrics;
  }

  startTimer(name: string): () => void {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      this.recordHistogram(name, duration);
    };
  }
}

export default MetricsCollector;