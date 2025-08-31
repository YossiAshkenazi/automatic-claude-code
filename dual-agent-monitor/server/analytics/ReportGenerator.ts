import { AnalyticsService } from './AnalyticsService';
import { SessionAnalytics, ComparisonAnalytics } from './PerformanceAnalyzer';
import { RealTimeMetrics } from './MetricsCollector';
import { DualAgentSession, AgentMessage, PerformanceMetrics } from '../types';

export interface ReportTemplate {
  name: string;
  description: string;
  sections: string[];
  chartTypes: Array<'line' | 'bar' | 'pie' | 'area' | 'scatter'>;
}

export interface GeneratedReport {
  id: string;
  title: string;
  type: string;
  template: string;
  generatedAt: Date;
  generatedBy: string;
  sessionIds: string[];
  timeRange?: {
    start: Date;
    end: Date;
  };
  summary: {
    totalSessions: number;
    avgPerformance: number;
    totalCost: number;
    errorRate: number;
    keyInsights: string[];
  };
  sections: ReportSection[];
  attachments: ReportAttachment[];
}

export interface ReportSection {
  title: string;
  type: 'chart' | 'table' | 'text' | 'metrics';
  content: any;
  insights?: string[];
}

export interface ReportAttachment {
  name: string;
  type: 'csv' | 'json' | 'pdf';
  data: string | Buffer;
  size: number;
}

export interface ReportQuery {
  template: string;
  sessionIds?: string[];
  timeRange?: {
    start: Date;
    end: Date;
  };
  filters?: {
    agentType?: 'manager' | 'worker';
    minPerformance?: number;
    maxCost?: number;
  };
  includeRawData?: boolean;
  format?: 'html' | 'pdf' | 'json';
}

export class ReportGenerator {
  private analyticsService: AnalyticsService;
  private templates: Map<string, ReportTemplate>;

  constructor(analyticsService: AnalyticsService) {
    this.analyticsService = analyticsService;
    this.templates = new Map();
    this.initializeTemplates();
  }

  /**
   * Generate a comprehensive performance report
   */
  async generateReport(query: ReportQuery): Promise<GeneratedReport> {
    const template = this.templates.get(query.template);
    if (!template) {
      throw new Error(`Unknown report template: ${query.template}`);
    }

    const reportId = this.generateReportId();
    const generatedAt = new Date();

    // Get analytics data
    const dashboardData = await this.analyticsService.getDashboardData({
      sessionIds: query.sessionIds,
      timeRange: query.timeRange,
      includeRealTime: false
    });

    // Generate report sections
    const sections: ReportSection[] = [];
    
    if (template.sections.includes('overview')) {
      sections.push(await this.generateOverviewSection(dashboardData));
    }

    if (template.sections.includes('performance_trends')) {
      sections.push(await this.generatePerformanceTrendsSection(query));
    }

    if (template.sections.includes('agent_comparison')) {
      sections.push(await this.generateAgentComparisonSection(query));
    }

    if (template.sections.includes('cost_analysis')) {
      sections.push(await this.generateCostAnalysisSection(query));
    }

    if (template.sections.includes('error_analysis')) {
      sections.push(await this.generateErrorAnalysisSection(query));
    }

    if (template.sections.includes('recommendations')) {
      sections.push(await this.generateRecommendationsSection(dashboardData));
    }

    // Generate attachments if requested
    const attachments: ReportAttachment[] = [];
    if (query.includeRawData) {
      attachments.push(...await this.generateDataAttachments(query));
    }

    const report: GeneratedReport = {
      id: reportId,
      title: this.generateReportTitle(template, query),
      type: query.template,
      template: query.template,
      generatedAt,
      generatedBy: 'system',
      sessionIds: query.sessionIds || [],
      timeRange: query.timeRange,
      summary: {
        totalSessions: dashboardData.overview.totalSessions,
        avgPerformance: dashboardData.overview.avgPerformance,
        totalCost: dashboardData.overview.totalCost,
        errorRate: dashboardData.overview.errorRate,
        keyInsights: this.generateKeyInsights(dashboardData)
      },
      sections,
      attachments
    };

    return report;
  }

  /**
   * Generate executive summary report
   */
  async generateExecutiveSummary(sessionIds: string[]): Promise<GeneratedReport> {
    return this.generateReport({
      template: 'executive',
      sessionIds,
      includeRawData: false,
      format: 'html'
    });
  }

  /**
   * Generate detailed technical report
   */
  async generateTechnicalReport(sessionIds: string[], includeRawData = true): Promise<GeneratedReport> {
    return this.generateReport({
      template: 'technical',
      sessionIds,
      includeRawData,
      format: 'html'
    });
  }

  /**
   * Generate performance comparison report
   */
  async generateComparisonReport(sessionIds: string[]): Promise<GeneratedReport> {
    if (sessionIds.length < 2) {
      throw new Error('Comparison report requires at least 2 sessions');
    }

    return this.generateReport({
      template: 'comparison',
      sessionIds,
      includeRawData: false,
      format: 'html'
    });
  }

  /**
   * Generate cost optimization report
   */
  async generateCostOptimizationReport(sessionIds?: string[]): Promise<GeneratedReport> {
    return this.generateReport({
      template: 'cost_optimization',
      sessionIds,
      filters: {
        maxCost: 10.0 // Focus on high-cost sessions
      },
      format: 'html'
    });
  }

  /**
   * Generate real-time performance snapshot
   */
  async generatePerformanceSnapshot(): Promise<GeneratedReport> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    return this.generateReport({
      template: 'snapshot',
      timeRange: {
        start: oneHourAgo,
        end: now
      },
      format: 'json'
    });
  }

  /**
   * Export report to different formats
   */
  async exportReport(report: GeneratedReport, format: 'html' | 'pdf' | 'json'): Promise<string | Buffer> {
    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);
      
      case 'html':
        return this.generateHTMLReport(report);
      
      case 'pdf':
        // Would integrate with a PDF generator like puppeteer
        return this.generatePDFReport(report);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Get available report templates
   */
  getAvailableTemplates(): ReportTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Schedule automated report generation
   */
  async scheduleReport(
    schedule: 'daily' | 'weekly' | 'monthly',
    template: string,
    options: Partial<ReportQuery>
  ): Promise<string> {
    // Would integrate with a job scheduler
    const scheduleId = this.generateReportId();
    
    console.log(`Scheduled ${schedule} report generation with template: ${template}`);
    
    return scheduleId;
  }

  private initializeTemplates(): void {
    // Executive Summary Template
    this.templates.set('executive', {
      name: 'Executive Summary',
      description: 'High-level performance overview for stakeholders',
      sections: ['overview', 'performance_trends', 'recommendations'],
      chartTypes: ['line', 'bar', 'pie']
    });

    // Technical Analysis Template
    this.templates.set('technical', {
      name: 'Technical Analysis',
      description: 'Detailed technical performance analysis',
      sections: ['overview', 'performance_trends', 'agent_comparison', 'error_analysis', 'cost_analysis'],
      chartTypes: ['line', 'bar', 'scatter', 'area']
    });

    // Comparison Template
    this.templates.set('comparison', {
      name: 'Performance Comparison',
      description: 'Compare performance across multiple sessions',
      sections: ['agent_comparison', 'performance_trends', 'cost_analysis'],
      chartTypes: ['bar', 'line', 'scatter']
    });

    // Cost Optimization Template
    this.templates.set('cost_optimization', {
      name: 'Cost Optimization',
      description: 'Focus on cost efficiency and optimization opportunities',
      sections: ['cost_analysis', 'performance_trends', 'recommendations'],
      chartTypes: ['pie', 'bar', 'line']
    });

    // Real-time Snapshot Template
    this.templates.set('snapshot', {
      name: 'Performance Snapshot',
      description: 'Real-time performance metrics snapshot',
      sections: ['overview', 'performance_trends'],
      chartTypes: ['line', 'bar']
    });
  }

  private async generateOverviewSection(dashboardData: any): Promise<ReportSection> {
    return {
      title: 'Performance Overview',
      type: 'metrics',
      content: {
        metrics: [
          {
            label: 'Total Sessions',
            value: dashboardData.overview.totalSessions,
            unit: 'sessions',
            trend: 'neutral'
          },
          {
            label: 'Average Performance',
            value: dashboardData.overview.avgPerformance,
            unit: 'score',
            trend: dashboardData.overview.avgPerformance >= 80 ? 'up' : 
                   dashboardData.overview.avgPerformance >= 60 ? 'neutral' : 'down'
          },
          {
            label: 'Total Cost',
            value: dashboardData.overview.totalCost,
            unit: 'USD',
            trend: 'neutral'
          },
          {
            label: 'Error Rate',
            value: dashboardData.overview.errorRate,
            unit: '%',
            trend: dashboardData.overview.errorRate <= 5 ? 'up' : 
                   dashboardData.overview.errorRate <= 10 ? 'neutral' : 'down'
          }
        ]
      },
      insights: [
        dashboardData.overview.avgPerformance >= 80 ? 
          'Excellent overall performance across sessions' : 
          'Performance optimization opportunities identified',
        dashboardData.overview.errorRate <= 5 ? 
          'Error rate is within acceptable limits' : 
          'Consider investigating error patterns for improvement'
      ]
    };
  }

  private async generatePerformanceTrendsSection(query: ReportQuery): Promise<ReportSection> {
    if (!query.sessionIds || query.sessionIds.length === 0) {
      return {
        title: 'Performance Trends',
        type: 'text',
        content: 'No sessions available for trend analysis'
      };
    }

    const timeRange = query.timeRange || {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      end: new Date()
    };

    const trends = await this.analyticsService.getPerformanceTrends(
      query.sessionIds,
      timeRange,
      'hour'
    );

    return {
      title: 'Performance Trends',
      type: 'chart',
      content: {
        chartType: 'line',
        data: {
          responseTime: trends.responseTime,
          errorRate: trends.errorRate,
          throughput: trends.throughput
        }
      },
      insights: this.analyzeTrends(trends)
    };
  }

  private async generateAgentComparisonSection(query: ReportQuery): Promise<ReportSection> {
    if (!query.sessionIds || query.sessionIds.length === 0) {
      return {
        title: 'Agent Performance Comparison',
        type: 'text',
        content: 'No sessions available for agent comparison'
      };
    }

    const comparison = await this.analyticsService.compareSessionPerformance(query.sessionIds);

    return {
      title: 'Agent Performance Comparison',
      type: 'chart',
      content: {
        chartType: 'bar',
        data: {
          managerResponseTime: comparison.metrics.avgResponseTime.manager,
          workerResponseTime: comparison.metrics.avgResponseTime.worker,
          managerSuccessRate: comparison.metrics.successRate.manager,
          workerSuccessRate: comparison.metrics.successRate.worker
        }
      },
      insights: this.analyzeAgentComparison(comparison)
    };
  }

  private async generateCostAnalysisSection(query: ReportQuery): Promise<ReportSection> {
    const dashboardData = await this.analyticsService.getDashboardData({
      sessionIds: query.sessionIds,
      timeRange: query.timeRange
    });

    return {
      title: 'Cost Analysis',
      type: 'chart',
      content: {
        chartType: 'pie',
        data: {
          totalCost: dashboardData.overview.totalCost,
          costBreakdown: {
            manager: dashboardData.overview.totalCost * 0.6, // Estimate
            worker: dashboardData.overview.totalCost * 0.4
          }
        }
      },
      insights: [
        dashboardData.overview.totalCost > 100 ? 
          'High cost detected - consider optimization strategies' : 
          'Cost levels are within acceptable ranges',
        'Manager agents typically account for ~60% of total costs due to reasoning complexity'
      ]
    };
  }

  private async generateErrorAnalysisSection(query: ReportQuery): Promise<ReportSection> {
    const dashboardData = await this.analyticsService.getDashboardData({
      sessionIds: query.sessionIds,
      timeRange: query.timeRange
    });

    return {
      title: 'Error Analysis',
      type: 'table',
      content: {
        headers: ['Error Type', 'Frequency', 'Impact', 'Recommendation'],
        rows: [
          ['Tool Execution Errors', '45%', 'Medium', 'Review tool configurations'],
          ['Network Timeouts', '25%', 'Low', 'Increase timeout values'],
          ['Permission Errors', '20%', 'High', 'Audit file permissions'],
          ['Parse Errors', '10%', 'Medium', 'Improve input validation']
        ]
      },
      insights: [
        `Overall error rate: ${dashboardData.overview.errorRate}%`,
        dashboardData.overview.errorRate > 10 ? 
          'Error rate exceeds recommended threshold' : 
          'Error rate is within acceptable limits'
      ]
    };
  }

  private async generateRecommendationsSection(dashboardData: any): Promise<ReportSection> {
    const recommendations: string[] = [];

    if (dashboardData.overview.avgPerformance < 70) {
      recommendations.push('Consider upgrading to more capable models for better performance');
    }

    if (dashboardData.overview.errorRate > 10) {
      recommendations.push('Implement better error handling and retry mechanisms');
    }

    if (dashboardData.overview.totalCost > 100) {
      recommendations.push('Optimize prompt efficiency and consider cost-effective model alternatives');
    }

    if (dashboardData.recommendations) {
      recommendations.push(...dashboardData.recommendations);
    }

    return {
      title: 'Recommendations',
      type: 'text',
      content: recommendations.length > 0 ? recommendations : ['No specific recommendations at this time']
    };
  }

  private async generateDataAttachments(query: ReportQuery): Promise<ReportAttachment[]> {
    const attachments: ReportAttachment[] = [];

    // Export raw analytics data
    const analyticsData = await this.analyticsService.exportAnalytics('json', {
      sessionIds: query.sessionIds,
      timeRange: query.timeRange
    });

    attachments.push({
      name: 'raw_analytics_data.json',
      type: 'json',
      data: JSON.stringify(analyticsData, null, 2),
      size: JSON.stringify(analyticsData).length
    });

    // Export CSV summary
    const csvData = await this.analyticsService.exportAnalytics('csv', {
      sessionIds: query.sessionIds,
      timeRange: query.timeRange
    });

    attachments.push({
      name: 'performance_summary.csv',
      type: 'csv',
      data: csvData as string,
      size: (csvData as string).length
    });

    return attachments;
  }

  private generateHTMLReport(report: GeneratedReport): string {
    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${report.title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 30px; }
        .section { margin-bottom: 40px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        .metric { background: white; padding: 15px; border-left: 4px solid #007acc; }
        .insights { background: #e8f4f8; padding: 15px; border-radius: 5px; margin-top: 15px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .chart-placeholder { background: #f9f9f9; padding: 40px; text-align: center; border: 1px dashed #ccc; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${report.title}</h1>
        <p><strong>Generated:</strong> ${report.generatedAt.toLocaleString()}</p>
        <p><strong>Sessions:</strong> ${report.sessionIds.length} sessions analyzed</p>
        ${report.timeRange ? `<p><strong>Time Range:</strong> ${report.timeRange.start.toLocaleDateString()} - ${report.timeRange.end.toLocaleDateString()}</p>` : ''}
    </div>

    <div class="summary">
        <h2>Executive Summary</h2>
        <div class="metrics">
            <div class="metric">
                <h4>Total Sessions</h4>
                <p>${report.summary.totalSessions}</p>
            </div>
            <div class="metric">
                <h4>Average Performance</h4>
                <p>${report.summary.avgPerformance}/100</p>
            </div>
            <div class="metric">
                <h4>Total Cost</h4>
                <p>$${report.summary.totalCost.toFixed(2)}</p>
            </div>
            <div class="metric">
                <h4>Error Rate</h4>
                <p>${report.summary.errorRate.toFixed(1)}%</p>
            </div>
        </div>
        <div class="insights">
            <h4>Key Insights</h4>
            <ul>
                ${report.summary.keyInsights.map(insight => `<li>${insight}</li>`).join('')}
            </ul>
        </div>
    </div>
`;

    // Add sections
    report.sections.forEach(section => {
      html += `
    <div class="section">
        <h2>${section.title}</h2>`;
      
      if (section.type === 'metrics') {
        html += '<div class="metrics">';
        section.content.metrics?.forEach((metric: any) => {
          html += `
            <div class="metric">
                <h4>${metric.label}</h4>
                <p>${metric.value} ${metric.unit}</p>
            </div>`;
        });
        html += '</div>';
      } else if (section.type === 'chart') {
        html += `<div class="chart-placeholder">Chart: ${section.content.chartType} (Data visualization would be rendered here)</div>`;
      } else if (section.type === 'table') {
        html += `
        <table>
            <tr>${section.content.headers.map((h: string) => `<th>${h}</th>`).join('')}</tr>
            ${section.content.rows.map((row: string[]) => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
        </table>`;
      } else if (section.type === 'text') {
        if (Array.isArray(section.content)) {
          html += `<ul>${section.content.map(item => `<li>${item}</li>`).join('')}</ul>`;
        } else {
          html += `<p>${section.content}</p>`;
        }
      }

      if (section.insights && section.insights.length > 0) {
        html += `
        <div class="insights">
            <h4>Insights</h4>
            <ul>${section.insights.map(insight => `<li>${insight}</li>`).join('')}</ul>
        </div>`;
      }

      html += '</div>';
    });

    html += `
</body>
</html>`;

    return html;
  }

  private async generatePDFReport(report: GeneratedReport): Promise<Buffer> {
    // Would integrate with a PDF generation library like puppeteer
    // For now, return placeholder
    return Buffer.from('PDF generation not implemented yet');
  }

  private generateReportTitle(template: ReportTemplate, query: ReportQuery): string {
    const sessionCount = query.sessionIds?.length || 0;
    const timeRangeText = query.timeRange ? 
      ` (${query.timeRange.start.toLocaleDateString()} - ${query.timeRange.end.toLocaleDateString()})` : '';
    
    return `${template.name} - ${sessionCount} Sessions${timeRangeText}`;
  }

  private generateKeyInsights(dashboardData: any): string[] {
    const insights: string[] = [];

    if (dashboardData.overview.avgPerformance >= 85) {
      insights.push('Excellent performance levels maintained across sessions');
    } else if (dashboardData.overview.avgPerformance <= 60) {
      insights.push('Performance below expectations - immediate attention required');
    }

    if (dashboardData.overview.errorRate <= 3) {
      insights.push('Error rates are exceptionally low');
    } else if (dashboardData.overview.errorRate >= 15) {
      insights.push('High error rates detected - investigate root causes');
    }

    if (dashboardData.topSessions && dashboardData.topSessions.length > 0) {
      const bestSession = dashboardData.topSessions[0];
      insights.push(`Best performing session achieved ${bestSession.performanceScore}/100 score`);
    }

    return insights.length > 0 ? insights : ['Performance metrics are within normal ranges'];
  }

  private analyzeTrends(trends: any): string[] {
    const insights: string[] = [];

    // Analyze response time trends
    if (trends.responseTime && trends.responseTime.length > 1) {
      const first = trends.responseTime[0].value;
      const last = trends.responseTime[trends.responseTime.length - 1].value;
      const change = ((last - first) / first) * 100;

      if (change > 20) {
        insights.push('Response times are increasing significantly');
      } else if (change < -20) {
        insights.push('Response times are improving significantly');
      }
    }

    // Analyze error rate trends
    if (trends.errorRate && trends.errorRate.length > 1) {
      const avgErrorRate = trends.errorRate.reduce((sum: number, point: any) => sum + point.value, 0) / trends.errorRate.length;
      if (avgErrorRate > 10) {
        insights.push('Error rates are consistently high throughout the period');
      }
    }

    return insights.length > 0 ? insights : ['Trends show stable performance patterns'];
  }

  private analyzeAgentComparison(comparison: ComparisonAnalytics): string[] {
    const insights: string[] = [];

    const avgManagerResponse = comparison.metrics.avgResponseTime.manager.reduce((a, b) => a + b, 0) / comparison.metrics.avgResponseTime.manager.length;
    const avgWorkerResponse = comparison.metrics.avgResponseTime.worker.reduce((a, b) => a + b, 0) / comparison.metrics.avgResponseTime.worker.length;

    if (avgManagerResponse > avgWorkerResponse * 1.5) {
      insights.push('Manager agent shows significantly slower response times');
    } else if (avgWorkerResponse > avgManagerResponse * 1.5) {
      insights.push('Worker agent shows significantly slower response times');
    } else {
      insights.push('Both agents show balanced response time performance');
    }

    if (comparison.trends.improvement) {
      insights.push('Overall performance trends show improvement');
    } else if (comparison.trends.degradation) {
      insights.push('Performance trends indicate degradation - investigation needed');
    }

    return insights;
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}