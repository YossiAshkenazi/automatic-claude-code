import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { AnalyticsService } from '../../analytics/AnalyticsService';
import { DatabaseService } from '../../database/DatabaseService';
import { MetricsCollector } from '../../analytics/MetricsCollector';

// Mock dependencies
vi.mock('../../database/DatabaseService');
vi.mock('../../analytics/MetricsCollector');

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  let mockDatabaseService: Mock;
  let mockMetricsCollector: Mock;

  beforeEach(() => {
    mockDatabaseService = vi.mocked(DatabaseService);
    mockMetricsCollector = vi.mocked(MetricsCollector);
    
    mockDatabaseService.prototype.query = vi.fn();
    mockMetricsCollector.prototype.collect = vi.fn();
    
    analyticsService = new AnalyticsService();
  });

  describe('getPerformanceMetrics', () => {
    it('should return performance metrics for a session', async () => {
      const sessionId = 'test-session-id';
      const mockMetrics = {
        averageResponseTime: 1500,
        totalMessages: 25,
        successRate: 0.95,
        agentEfficiency: {
          manager: 0.92,
          worker: 0.97
        }
      };

      mockDatabaseService.prototype.query.mockResolvedValue([
        { avg_response_time: 1500, total_messages: 25, success_rate: 0.95 }
      ]);

      const result = await analyticsService.getPerformanceMetrics(sessionId);

      expect(result).toHaveProperty('averageResponseTime');
      expect(result).toHaveProperty('totalMessages');
      expect(result).toHaveProperty('successRate');
      expect(mockDatabaseService.prototype.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [sessionId]
      );
    });

    it('should handle database errors gracefully', async () => {
      const sessionId = 'test-session-id';
      mockDatabaseService.prototype.query.mockRejectedValue(new Error('Database error'));

      await expect(analyticsService.getPerformanceMetrics(sessionId)).rejects.toThrow('Database error');
    });
  });

  describe('getAgentComparison', () => {
    it('should return comparison metrics between agents', async () => {
      const sessionId = 'test-session-id';
      
      mockDatabaseService.prototype.query.mockResolvedValue([
        { agent: 'manager', avg_response_time: 2000, success_rate: 0.92, total_tasks: 15 },
        { agent: 'worker', avg_response_time: 1200, success_rate: 0.97, total_tasks: 20 }
      ]);

      const result = await analyticsService.getAgentComparison(sessionId);

      expect(result).toHaveProperty('manager');
      expect(result).toHaveProperty('worker');
      expect(result.manager).toHaveProperty('averageResponseTime', 2000);
      expect(result.worker).toHaveProperty('averageResponseTime', 1200);
    });

    it('should return empty comparison when no data found', async () => {
      const sessionId = 'nonexistent-session';
      mockDatabaseService.prototype.query.mockResolvedValue([]);

      const result = await analyticsService.getAgentComparison(sessionId);

      expect(result).toEqual({});
    });
  });

  describe('recordAgentPerformance', () => {
    it('should record performance data for an agent', async () => {
      const performanceData = {
        sessionId: 'test-session',
        agent: 'manager',
        responseTime: 1500,
        success: true,
        timestamp: new Date()
      };

      mockDatabaseService.prototype.query.mockResolvedValue({ insertId: 1 });

      const result = await analyticsService.recordAgentPerformance(performanceData);

      expect(result).toBe(true);
      expect(mockDatabaseService.prototype.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agent_performance'),
        expect.arrayContaining([
          performanceData.sessionId,
          performanceData.agent,
          performanceData.responseTime,
          performanceData.success
        ])
      );
    });

    it('should handle recording errors', async () => {
      const performanceData = {
        sessionId: 'test-session',
        agent: 'manager',
        responseTime: 1500,
        success: true,
        timestamp: new Date()
      };

      mockDatabaseService.prototype.query.mockRejectedValue(new Error('Insert failed'));

      const result = await analyticsService.recordAgentPerformance(performanceData);

      expect(result).toBe(false);
    });
  });

  describe('getTrendData', () => {
    it('should return trend data over time', async () => {
      const sessionId = 'test-session';
      const timeframe = '7d';

      mockDatabaseService.prototype.query.mockResolvedValue([
        { date: '2024-01-01', avg_response_time: 1200, success_rate: 0.95 },
        { date: '2024-01-02', avg_response_time: 1300, success_rate: 0.93 },
        { date: '2024-01-03', avg_response_time: 1500, success_rate: 0.97 }
      ]);

      const result = await analyticsService.getTrendData(sessionId, timeframe);

      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('averageResponseTime');
      expect(result[0]).toHaveProperty('successRate');
    });
  });
});