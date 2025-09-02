import { Application } from 'express';
import { WebSocketServer } from 'ws';
import { DatabaseInterface } from '../database/DatabaseInterface';
import { SessionRecordingService } from '../services/SessionRecordingService';
import { RecordingManager } from '../services/RecordingManager';
import { createRecordingRoutes } from '../routes/recordingRoutes';
import { 
  AgentMessage, 
  SystemEvent, 
  AgentCommunication, 
  PerformanceMetrics,
  RecordingWebSocketMessage 
} from '../types';

/**
 * Integration module to add session recording functionality
 * to the existing dual-agent monitor server
 */
export class RecordingIntegration {
  private recordingService: SessionRecordingService;
  private recordingManager: RecordingManager;
  private isInitialized = false;

  constructor(
    private database: DatabaseInterface,
    private app: Application,
    private wss?: WebSocketServer
  ) {
    this.recordingService = new SessionRecordingService(
      database,
      './recordings' // Storage path for exports
    );
    
    this.recordingManager = new RecordingManager(
      database,
      this.recordingService,
      {
        stopOnError: false,
        maxRecordingSizeBytes: 100 * 1024 * 1024, // 100MB
        cleanupIntervalMs: 60 * 60 * 1000, // 1 hour
        maxExportRetentionDays: 7
      }
    );
  }

  /**
   * Initialize recording integration
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('Recording integration already initialized');
      return;
    }

    try {
      // Set up API routes
      this.setupRoutes();
      
      // Set up WebSocket message forwarding
      this.setupWebSocketIntegration();
      
      // Set up event listeners for automatic recording
      this.setupEventListeners();
      
      // Start cleanup scheduler
      this.startCleanupScheduler();
      
      this.isInitialized = true;
      console.log('✅ Session recording integration initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize recording integration:', error);
      throw error;
    }
  }

  /**
   * Set up recording API routes
   */
  private setupRoutes(): void {
    const recordingRoutes = createRecordingRoutes(
      this.database,
      this.recordingService,
      this.recordingManager
    );
    
    this.app.use('/api/recordings', recordingRoutes);
    console.log('📝 Recording API routes registered');
  }

  /**
   * Set up WebSocket integration for real-time updates
   */
  private setupWebSocketIntegration(): void {
    if (!this.wss) {
      console.warn('WebSocket server not provided, skipping WebSocket integration');
      return;
    }

    // Listen for recording events and broadcast to WebSocket clients
    this.recordingManager.on('recordingStarted', (event) => {
      this.broadcastToWebSocket({
        type: 'recording_started',
        data: event
      });
    });

    this.recordingManager.on('recordingStopped', (event) => {
      this.broadcastToWebSocket({
        type: 'recording_stopped',
        data: event
      });
    });

    this.recordingManager.on('recordingError', (event) => {
      this.broadcastToWebSocket({
        type: 'recording_updated',
        data: { ...event, status: 'failed' }
      });
    });

    this.recordingManager.on('websocket_message', (message: RecordingWebSocketMessage) => {
      this.broadcastToWebSocket(message);
    });

    console.log('🔌 WebSocket recording integration set up');
  }

  /**
   * Set up event listeners for automatic recording
   */
  private setupEventListeners(): void {
    // In a real implementation, you'd hook into the existing message flow
    // For now, we'll provide methods that can be called from the main server
    console.log('👂 Recording event listeners set up');
  }

  /**
   * Start cleanup scheduler
   */
  private startCleanupScheduler(): void {
    // Run cleanup every hour
    setInterval(async () => {
      try {
        await this.recordingManager.cleanupExpiredData();
        console.log('🧹 Recording cleanup completed');
      } catch (error) {
        console.error('❌ Recording cleanup failed:', error);
      }
    }, 60 * 60 * 1000); // 1 hour

    console.log('⏰ Recording cleanup scheduler started');
  }

  /**
   * Broadcast message to WebSocket clients
   */
  private broadcastToWebSocket(message: RecordingWebSocketMessage): void {
    if (!this.wss) return;

    const messageStr = JSON.stringify(message);
    
    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(messageStr);
      }
    });
  }

  // ===============================================
  // PUBLIC METHODS FOR INTEGRATION
  // ===============================================

  /**
   * Handle new agent message (call this from existing message handler)
   */
  public async handleAgentMessage(message: AgentMessage): Promise<void> {
    try {
      await this.recordingManager.handleAgentMessage(message);
    } catch (error) {
      console.error('Error handling agent message in recording:', error);
    }
  }

  /**
   * Handle system event (call this from existing event handler)
   */
  public async handleSystemEvent(event: SystemEvent): Promise<void> {
    try {
      await this.recordingManager.handleSystemEvent(event);
    } catch (error) {
      console.error('Error handling system event in recording:', error);
    }
  }

  /**
   * Handle agent communication (call this from existing communication handler)
   */
  public async handleAgentCommunication(communication: AgentCommunication): Promise<void> {
    try {
      await this.recordingManager.handleAgentCommunication(communication);
    } catch (error) {
      console.error('Error handling agent communication in recording:', error);
    }
  }

  /**
   * Handle performance metric (call this from existing metrics handler)
   */
  public async handlePerformanceMetric(metric: PerformanceMetrics): Promise<void> {
    try {
      await this.recordingManager.handlePerformanceMetric(metric);
    } catch (error) {
      console.error('Error handling performance metric in recording:', error);
    }
  }

  /**
   * Start auto-recording for a session
   */
  public async startAutoRecording(
    sessionId: string, 
    options: {
      recordingName?: string;
      description?: string;
      recordingQuality?: 'low' | 'medium' | 'high' | 'lossless';
    } = {}
  ): Promise<string> {
    return await this.recordingManager.startSessionRecording(sessionId, {
      ...options,
      autoRecord: true
    });
  }

  /**
   * Stop auto-recording for a session
   */
  public async stopAutoRecording(sessionId: string): Promise<void> {
    await this.recordingManager.stopSessionRecording(sessionId);
  }

  /**
   * Check if a session is being recorded
   */
  public isSessionRecorded(sessionId: string): boolean {
    return this.recordingManager.isSessionRecorded(sessionId);
  }

  /**
   * Get recording statistics
   */
  public async getRecordingStats() {
    return await this.recordingManager.getRecordingStats();
  }

  /**
   * Get recording service (for advanced operations)
   */
  public getRecordingService(): SessionRecordingService {
    return this.recordingService;
  }

  /**
   * Get recording manager (for advanced operations)
   */
  public getRecordingManager(): RecordingManager {
    return this.recordingManager;
  }

  /**
   * Health check for recording system
   */
  public async getHealthStatus(): Promise<{
    healthy: boolean;
    stats: any;
    activeRecordings: number;
    errors: string[];
  }> {
    try {
      const stats = await this.recordingManager.getRecordingStats();
      
      return {
        healthy: this.isInitialized,
        stats,
        activeRecordings: stats.activeRecordings,
        errors: []
      };
    } catch (error) {
      return {
        healthy: false,
        stats: null,
        activeRecordings: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Shutdown recording system
   */
  public async shutdown(): Promise<void> {
    try {
      // Stop all active recordings
      const stats = await this.recordingManager.getRecordingStats();
      console.log(`Shutting down recording system with ${stats.activeRecordings} active recordings`);
      
      // Clean up any remaining data
      await this.recordingManager.cleanupExpiredData();
      
      this.isInitialized = false;
      console.log('✅ Recording system shut down successfully');
    } catch (error) {
      console.error('❌ Error during recording system shutdown:', error);
      throw error;
    }
  }
}

/**
 * Helper function to create and initialize recording integration
 */
export async function createRecordingIntegration(
  database: DatabaseInterface,
  app: Application,
  wss?: WebSocketServer
): Promise<RecordingIntegration> {
  const integration = new RecordingIntegration(database, app, wss);
  await integration.initialize();
  return integration;
}