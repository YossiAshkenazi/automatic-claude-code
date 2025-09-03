import { EventEmitter } from 'events';
import { SessionRecordingService } from './SessionRecordingService';
import { DatabaseInterface } from '../database/DatabaseInterface';
import {
  SessionRecording,
  PlaybackSession,
  AgentMessage,
  SystemEvent,
  AgentCommunication,
  PerformanceMetrics,
  RecordingWebSocketMessage
} from '../types';

/**
 * Recording Manager - Orchestrates all recording operations
 * Handles automatic recording triggers, session lifecycle, and real-time updates
 */
export class RecordingManager extends EventEmitter {
  private sessionRecordings = new Map<string, string>(); // sessionId -> recordingId
  private autoRecordingSessions = new Set<string>();
  private recordingPolicies = new Map<string, RecordingPolicy>();

  constructor(
    private database: DatabaseInterface,
    private recordingService: SessionRecordingService,
    private config: RecordingManagerConfig = {}
  ) {
    super();
    this.setupDefaultPolicies();
  }

  // ===============================================
  // AUTOMATIC RECORDING MANAGEMENT
  // ===============================================

  /**
   * Start automatic recording for a session based on policies
   */
  async startSessionRecording(
    sessionId: string,
    options: {
      recordingName?: string;
      description?: string;
      recordedBy?: string;
      recordingQuality?: 'low' | 'medium' | 'high' | 'lossless';
      autoRecord?: boolean;
      policies?: string[];
    } = {}
  ): Promise<string> {
    // Check if already recording
    if (this.sessionRecordings.has(sessionId)) {
      throw new Error(`Session ${sessionId} is already being recorded`);
    }

    // Apply recording policies
    const shouldRecord = options.autoRecord !== false && this.shouldRecordSession(sessionId, options.policies);
    if (!shouldRecord) {
      throw new Error(`Recording not permitted for session ${sessionId} based on policies`);
    }

    const recordingId = await this.recordingService.startRecording(sessionId, {
      recordingName: options.recordingName,
      description: options.description,
      recordedBy: options.recordedBy,
      recordingQuality: options.recordingQuality
    });

    this.sessionRecordings.set(sessionId, recordingId);
    
    if (options.autoRecord !== false) {
      this.autoRecordingSessions.add(sessionId);
    }

    // Emit recording started event
    this.emit('recordingStarted', {
      sessionId,
      recordingId,
      timestamp: new Date()
    });

    // Send WebSocket notification
    this.emitWebSocketMessage({
      type: 'recording_started',
      data: await this.database.getSessionRecording(recordingId)
    });

    console.log(`Started recording for session ${sessionId} -> ${recordingId}`);
    return recordingId;
  }

  /**
   * Stop recording for a session
   */
  async stopSessionRecording(sessionId: string): Promise<void> {
    const recordingId = this.sessionRecordings.get(sessionId);
    if (!recordingId) {
      throw new Error(`No active recording found for session ${sessionId}`);
    }

    await this.recordingService.stopRecording(recordingId);
    
    this.sessionRecordings.delete(sessionId);
    this.autoRecordingSessions.delete(sessionId);

    // Emit recording stopped event
    this.emit('recordingStopped', {
      sessionId,
      recordingId,
      timestamp: new Date()
    });

    // Send WebSocket notification
    this.emitWebSocketMessage({
      type: 'recording_stopped',
      data: await this.database.getSessionRecording(recordingId)
    });

    console.log(`Stopped recording for session ${sessionId}`);
  }

  /**
   * Check if a session is currently being recorded
   */
  isSessionRecorded(sessionId: string): boolean {
    return this.sessionRecordings.has(sessionId);
  }

  /**
   * Get active recording ID for a session
   */
  getSessionRecordingId(sessionId: string): string | undefined {
    return this.sessionRecordings.get(sessionId);
  }

  // ===============================================
  // EVENT HANDLERS - AUTOMATIC RECORDING
  // ===============================================

  /**
   * Handle new agent messages
   */
  async handleAgentMessage(message: AgentMessage): Promise<void> {
    const recordingId = this.sessionRecordings.get(message.sessionId);
    if (recordingId && this.autoRecordingSessions.has(message.sessionId)) {
      try {
        await this.recordingService.recordMessage(recordingId, message);
        
        // Check for auto-stopping conditions
        if (this.shouldAutoStopRecording(message)) {
          await this.stopSessionRecording(message.sessionId);
        }
      } catch (error) {
        console.error(`Failed to record message for session ${message.sessionId}:`, error);
        this.emit('recordingError', {
          sessionId: message.sessionId,
          recordingId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Handle system events
   */
  async handleSystemEvent(event: SystemEvent): Promise<void> {
    const recordingId = this.sessionRecordings.get(event.sessionId);
    if (recordingId && this.autoRecordingSessions.has(event.sessionId)) {
      try {
        await this.recordingService.recordSystemEvent(recordingId, event);
        
        // Auto-stop on session end
        if (event.eventType === 'session_end') {
          await this.stopSessionRecording(event.sessionId);
        }
      } catch (error) {
        console.error(`Failed to record system event for session ${event.sessionId}:`, error);
      }
    }
  }

  /**
   * Handle agent communications
   */
  async handleAgentCommunication(communication: AgentCommunication): Promise<void> {
    const recordingId = this.sessionRecordings.get(communication.sessionId);
    if (recordingId && this.autoRecordingSessions.has(communication.sessionId)) {
      try {
        await this.recordingService.recordAgentCommunication(recordingId, communication);
      } catch (error) {
        console.error(`Failed to record agent communication for session ${communication.sessionId}:`, error);
      }
    }
  }

  /**
   * Handle performance metrics
   */
  async handlePerformanceMetric(metric: PerformanceMetrics): Promise<void> {
    const recordingId = this.sessionRecordings.get(metric.sessionId);
    if (recordingId && this.autoRecordingSessions.has(metric.sessionId)) {
      try {
        await this.recordingService.recordInteraction(recordingId, metric.sessionId, {
          type: 'performance_metric',
          content: {
            agentType: metric.agentType,
            responseTime: metric.responseTime,
            tokensUsed: metric.tokensUsed,
            cost: metric.cost,
            errorRate: metric.errorRate
          },
          agentType: metric.agentType,
          metadata: {
            metricType: 'performance',
            responseTime: metric.responseTime,
            tokensUsed: metric.tokensUsed,
            cost: metric.cost,
            errorRate: metric.errorRate
          }
        });
      } catch (error) {
        console.error(`Failed to record performance metric for session ${metric.sessionId}:`, error);
      }
    }
  }

  // ===============================================
  // RECORDING POLICIES
  // ===============================================

  /**
   * Add a recording policy
   */
  addRecordingPolicy(name: string, policy: RecordingPolicy): void {
    this.recordingPolicies.set(name, policy);
  }

  /**
   * Remove a recording policy
   */
  removeRecordingPolicy(name: string): void {
    this.recordingPolicies.delete(name);
  }

  /**
   * Check if session should be recorded based on policies
   */
  private shouldRecordSession(sessionId: string, policyNames?: string[]): boolean {
    const policiesToCheck = policyNames || Array.from(this.recordingPolicies.keys());
    
    for (const policyName of policiesToCheck) {
      const policy = this.recordingPolicies.get(policyName);
      if (policy && !policy.shouldRecord(sessionId)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Check if recording should auto-stop based on message content
   */
  private shouldAutoStopRecording(message: AgentMessage): boolean {
    // Stop on certain error types
    if (message.messageType === 'error' && this.config.stopOnError) {
      return true;
    }
    
    // Stop on session completion indicators
    if (message.content.toLowerCase().includes('session completed') ||
        message.content.toLowerCase().includes('task finished')) {
      return true;
    }
    
    return false;
  }

  /**
   * Setup default recording policies
   */
  private setupDefaultPolicies(): void {
    // Default policy: Record all sessions unless explicitly disabled
    this.addRecordingPolicy('default', {
      shouldRecord: (sessionId: string) => {
        return !this.config.disabledSessions?.includes(sessionId);
      }
    });

    // High-value sessions policy
    this.addRecordingPolicy('high_value', {
      shouldRecord: (sessionId: string) => {
        // This could be enhanced to check session metadata, user permissions, etc.
        return this.config.alwaysRecordSessions?.includes(sessionId) || false;
      }
    });

    // Size limit policy
    this.addRecordingPolicy('size_limit', {
      shouldRecord: async (sessionId: string) => {
        if (!this.config.maxRecordingSizeBytes) return true;
        
        const recordingId = this.sessionRecordings.get(sessionId);
        if (!recordingId) return true;
        
        const recording = await this.database.getSessionRecording(recordingId);
        return !recording || recording.totalSizeBytes < this.config.maxRecordingSizeBytes;
      }
    });
  }

  // ===============================================
  // PLAYBACK MANAGEMENT
  // ===============================================

  /**
   * Create playback session with enhanced features
   */
  async createEnhancedPlaybackSession(
    recordingId: string,
    userId?: string,
    options: {
      playbackName?: string;
      startPosition?: number;
      autoGenerateChapters?: boolean;
      enableAnnotations?: boolean;
      playbackSpeed?: number;
    } = {}
  ): Promise<string> {
    const playbackId = await this.recordingService.createPlaybackSession(recordingId, userId, {
      playbackName: options.playbackName,
      playbackSettings: {
        autoPlay: false,
        showAnnotations: options.enableAnnotations !== false,
        showBookmarks: true,
        showTimestamps: true,
        highlightChanges: true,
        skipLongPauses: true,
        maxPauseDurationMs: 5000
      }
    });

    // Set initial playback position
    if (options.startPosition) {
      await this.recordingService.updatePlaybackState(playbackId, {
        currentPositionMs: options.startPosition
      });
    }

    // Auto-generate chapters if requested
    if (options.autoGenerateChapters) {
      await this.generateAutomaticChapters(recordingId, userId);
    }

    // Send WebSocket notification
    this.emitWebSocketMessage({
      type: 'playback_state_changed',
      data: await this.database.getPlaybackSession(playbackId)
    });

    return playbackId;
  }

  /**
   * Generate automatic chapter bookmarks
   */
  private async generateAutomaticChapters(recordingId: string, userId?: string): Promise<void> {
    const recording = await this.database.getSessionRecording(recordingId);
    if (!recording) return;

    const interactions = await this.database.getRecordingInteractions(recordingId);
    const chapterPoints: Array<{ timestampMs: number; title: string; description: string }> = [];

    // Create chapters based on interaction patterns
    let currentChapterStart = 0;
    let currentInteractionType = '';
    
    for (const interaction of interactions) {
      // New chapter on interaction type changes or significant time gaps
      const timeSinceLastChapter = interaction.relativeTimeMs - currentChapterStart;
      const typeChanged = interaction.interactionType !== currentInteractionType;
      
      if ((typeChanged && timeSinceLastChapter > 30000) || timeSinceLastChapter > 300000) { // 30s or 5m
        if (currentChapterStart > 0) {
          chapterPoints.push({
            timestampMs: currentChapterStart,
            title: `Chapter: ${this.formatInteractionType(currentInteractionType)}`,
            description: `Started at ${this.formatTime(currentChapterStart)}`
          });
        }
        
        currentChapterStart = interaction.relativeTimeMs;
        currentInteractionType = interaction.interactionType;
      }
    }

    // Add final chapter
    if (currentChapterStart > 0) {
      chapterPoints.push({
        timestampMs: currentChapterStart,
        title: `Chapter: ${this.formatInteractionType(currentInteractionType)}`,
        description: `Started at ${this.formatTime(currentChapterStart)}`
      });
    }

    // Create bookmarks for chapters
    for (const chapter of chapterPoints) {
      await this.recordingService.addBookmark(recordingId, userId || 'system', {
        timestampMs: chapter.timestampMs,
        title: chapter.title,
        description: chapter.description,
        bookmarkType: 'auto',
        chapterMarker: true,
        icon: 'chapter',
        color: '#9c27b0'
      });
    }
  }

  // ===============================================
  // UTILITY METHODS
  // ===============================================

  /**
   * Get recording statistics
   */
  async getRecordingStats(): Promise<RecordingStats> {
    const activeRecordings = this.sessionRecordings.size;
    const totalRecordings = (await this.database.getAllSessionRecordings()).length;
    
    return {
      activeRecordings,
      totalRecordings,
      autoRecordingSessions: this.autoRecordingSessions.size,
      recordingPoliciesCount: this.recordingPolicies.size
    };
  }

  /**
   * Cleanup expired recordings and exports
   */
  async cleanupExpiredData(): Promise<void> {
    try {
      // Cleanup expired exports
      const exports = await this.database.getRecordingExports(''); // Get all exports
      const now = new Date();
      
      for (const exportItem of exports) {
        if (exportItem.expiresAt && exportItem.expiresAt < now) {
          await this.database.deleteRecordingExport(exportItem.id);
          console.log(`Cleaned up expired export: ${exportItem.id}`);
        }
      }
      
      // Could add more cleanup logic for old recordings, etc.
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  private formatInteractionType(type: string): string {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  private formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / 60000) % 60;
    const hours = Math.floor(ms / 3600000);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  private emitWebSocketMessage(message: RecordingWebSocketMessage): void {
    this.emit('websocket_message', message);
  }
}

// ===============================================
// INTERFACES AND TYPES
// ===============================================

export interface RecordingPolicy {
  shouldRecord: (sessionId: string) => boolean | Promise<boolean>;
}

export interface RecordingManagerConfig {
  // Auto-recording settings
  stopOnError?: boolean;
  maxRecordingSizeBytes?: number;
  
  // Session control
  disabledSessions?: string[];
  alwaysRecordSessions?: string[];
  
  // Storage settings
  cleanupIntervalMs?: number;
  maxExportRetentionDays?: number;
}

export interface RecordingStats {
  activeRecordings: number;
  totalRecordings: number;
  autoRecordingSessions: number;
  recordingPoliciesCount: number;
}

/**
 * Recording Event Types for external listeners
 */
export interface RecordingEvents {
  recordingStarted: {
    sessionId: string;
    recordingId: string;
    timestamp: Date;
  };
  
  recordingStopped: {
    sessionId: string;
    recordingId: string;
    timestamp: Date;
  };
  
  recordingError: {
    sessionId: string;
    recordingId: string;
    error: string;
  };
  
  websocket_message: RecordingWebSocketMessage;
}