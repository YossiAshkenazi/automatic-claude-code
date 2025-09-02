import { v4 as uuidv4 } from 'uuid';
import * as zlib from 'zlib';
import { promises as fs } from 'fs';
import { join } from 'path';
import {
  SessionRecording,
  RecordingInteraction,
  PlaybackSession,
  RecordingAnnotation,
  RecordingBookmark,
  RecordingExport,
  KeyMoment,
  PlaybackSettings,
  ExportOptions,
  AgentMessage,
  SystemEvent,
  AgentCommunication
} from '../types';
import { DatabaseInterface } from '../database/DatabaseInterface';

/**
 * Comprehensive Session Recording Service
 * Handles recording, playback, annotations, and export functionality
 */
export class SessionRecordingService {
  private activeRecordings = new Map<string, SessionRecording>();
  private recordingStartTimes = new Map<string, number>();
  
  constructor(
    private database: DatabaseInterface,
    private storageBasePath: string = './recordings'
  ) {
    this.ensureStorageDirectory();
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.access(this.storageBasePath);
    } catch {
      await fs.mkdir(this.storageBasePath, { recursive: true });
    }
  }

  // ===============================================
  // RECORDING MANAGEMENT
  // ===============================================

  /**
   * Start recording a session
   */
  async startRecording(sessionId: string, options: {
    recordingName?: string;
    description?: string;
    recordedBy?: string;
    recordingQuality?: 'low' | 'medium' | 'high' | 'lossless';
  } = {}): Promise<string> {
    const recordingId = await this.database.createSessionRecording({
      sessionId,
      recordingName: options.recordingName || `Recording for session ${sessionId.substring(0, 8)}`,
      description: options.description,
      recordedBy: options.recordedBy,
      recordingQuality: options.recordingQuality || 'high'
    });

    const recording: SessionRecording = {
      id: recordingId,
      sessionId,
      recordingName: options.recordingName,
      description: options.description,
      recordedBy: options.recordedBy,
      recordingStartedAt: new Date(),
      status: 'recording',
      totalInteractions: 0,
      totalSizeBytes: 0,
      recordingQuality: options.recordingQuality || 'high',
      sharedPublicly: false,
      downloadCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.activeRecordings.set(recordingId, recording);
    this.recordingStartTimes.set(recordingId, Date.now());

    console.log(`Started recording session ${sessionId} with ID ${recordingId}`);
    return recordingId;
  }

  /**
   * Stop recording a session
   */
  async stopRecording(recordingId: string): Promise<void> {
    const recording = this.activeRecordings.get(recordingId);
    if (!recording) {
      throw new Error(`Recording ${recordingId} not found or not active`);
    }

    // Calculate recording duration
    const startTime = this.recordingStartTimes.get(recordingId);
    const playbackDurationMs = startTime ? Date.now() - startTime : 0;

    // Detect key moments
    const keyMoments = await this.detectKeyMoments(recordingId);

    await this.database.updateSessionRecording(recordingId, {
      status: 'completed',
      recordingCompletedAt: new Date(),
      playbackDurationMs,
      keyMoments
    });

    this.activeRecordings.delete(recordingId);
    this.recordingStartTimes.delete(recordingId);

    console.log(`Stopped recording ${recordingId}, duration: ${playbackDurationMs}ms`);
  }

  /**
   * Record an interaction during a session
   */
  async recordInteraction(
    recordingId: string,
    sessionId: string,
    interactionData: {
      type: 'message' | 'agent_communication' | 'system_event' | 'tool_call' | 
            'file_operation' | 'command_execution' | 'user_input' | 'agent_switch' |
            'performance_metric' | 'error' | 'state_change';
      content: any;
      agentType?: 'manager' | 'worker' | 'system' | 'user';
      metadata?: any;
      relatedMessageId?: string;
      relatedEventId?: string;
      durationMs?: number;
    }
  ): Promise<void> {
    const recording = this.activeRecordings.get(recordingId);
    if (!recording || recording.status !== 'recording') {
      return; // Silently ignore if recording not active
    }

    const startTime = this.recordingStartTimes.get(recordingId);
    if (!startTime) {
      throw new Error(`Recording start time not found for ${recordingId}`);
    }

    const now = new Date();
    const relativeTimeMs = Date.now() - startTime;

    // Compress content based on recording quality
    const { content, contentType, isCompressed, originalSize, compressedSize } = 
      await this.processContent(interactionData.content, recording.recordingQuality);

    await this.database.addRecordingInteraction({
      recordingId,
      sessionId,
      interactionType: interactionData.type,
      timestamp: now,
      relativeTimeMs,
      durationMs: interactionData.durationMs,
      agentType: interactionData.agentType,
      content,
      contentType,
      metadata: {
        ...interactionData.metadata,
        isCompressed,
        originalSize,
        compressedSize
      },
      relatedMessageId: interactionData.relatedMessageId,
      relatedEventId: interactionData.relatedEventId
    });
  }

  /**
   * Record an agent message
   */
  async recordMessage(recordingId: string, message: AgentMessage): Promise<void> {
    await this.recordInteraction(recordingId, message.sessionId, {
      type: 'message',
      content: {
        messageType: message.messageType,
        content: message.content,
        metadata: message.metadata
      },
      agentType: message.agentType,
      relatedMessageId: message.id,
      metadata: {
        messageId: message.id,
        messageType: message.messageType,
        tools: message.metadata?.tools,
        files: message.metadata?.files,
        commands: message.metadata?.commands,
        cost: message.metadata?.cost,
        exitCode: message.metadata?.exitCode
      },
      durationMs: message.metadata?.duration
    });
  }

  /**
   * Record a system event
   */
  async recordSystemEvent(recordingId: string, event: SystemEvent): Promise<void> {
    await this.recordInteraction(recordingId, event.sessionId, {
      type: 'system_event',
      content: {
        eventType: event.eventType,
        details: event.details
      },
      agentType: 'system',
      relatedEventId: event.id,
      metadata: {
        eventId: event.id,
        eventType: event.eventType
      }
    });
  }

  /**
   * Record agent communication
   */
  async recordAgentCommunication(recordingId: string, communication: AgentCommunication): Promise<void> {
    await this.recordInteraction(recordingId, communication.sessionId, {
      type: 'agent_communication',
      content: {
        fromAgent: communication.fromAgent,
        toAgent: communication.toAgent,
        messageType: communication.messageType,
        content: communication.content
      },
      agentType: communication.fromAgent,
      relatedMessageId: communication.relatedMessageId,
      metadata: {
        communicationId: communication.id,
        messageType: communication.messageType,
        fromAgent: communication.fromAgent,
        toAgent: communication.toAgent
      }
    });
  }

  // ===============================================
  // PLAYBACK MANAGEMENT
  // ===============================================

  /**
   * Create a playback session
   */
  async createPlaybackSession(
    recordingId: string,
    userId?: string,
    options: {
      playbackName?: string;
      playbackSettings?: PlaybackSettings;
    } = {}
  ): Promise<string> {
    const recording = await this.database.getSessionRecording(recordingId);
    if (!recording) {
      throw new Error(`Recording ${recordingId} not found`);
    }

    if (recording.status !== 'completed') {
      throw new Error(`Recording ${recordingId} is not ready for playback (status: ${recording.status})`);
    }

    return await this.database.createPlaybackSession({
      recordingId,
      userId,
      playbackName: options.playbackName,
      playbackSettings: options.playbackSettings || this.getDefaultPlaybackSettings()
    });
  }

  /**
   * Get playback data for a specific time range
   */
  async getPlaybackData(
    recordingId: string,
    startTimeMs: number = 0,
    endTimeMs?: number
  ): Promise<{
    interactions: RecordingInteraction[];
    annotations: RecordingAnnotation[];
    bookmarks: RecordingBookmark[];
    duration: number;
  }> {
    const recording = await this.database.getSessionRecording(recordingId);
    if (!recording) {
      throw new Error(`Recording ${recordingId} not found`);
    }

    const finalEndTime = endTimeMs || recording.playbackDurationMs || 0;
    
    const [interactions, annotations, bookmarks] = await Promise.all([
      this.database.getRecordingInteractionsByTimeRange(recordingId, startTimeMs, finalEndTime),
      this.database.getRecordingAnnotations(recordingId),
      this.database.getRecordingBookmarks(recordingId)
    ]);

    return {
      interactions,
      annotations: annotations.filter(a => a.timestampMs >= startTimeMs && a.timestampMs <= finalEndTime),
      bookmarks: bookmarks.filter(b => b.timestampMs >= startTimeMs && b.timestampMs <= finalEndTime),
      duration: finalEndTime - startTimeMs
    };
  }

  /**
   * Update playback session state
   */
  async updatePlaybackState(
    playbackSessionId: string,
    updates: {
      currentPositionMs?: number;
      playbackSpeed?: number;
      isPlaying?: boolean;
      isPaused?: boolean;
      totalWatchTimeMs?: number;
    }
  ): Promise<void> {
    await this.database.updatePlaybackSession(playbackSessionId, updates);
  }

  // ===============================================
  // ANNOTATIONS AND BOOKMARKS
  // ===============================================

  /**
   * Add annotation to recording
   */
  async addAnnotation(
    recordingId: string,
    userId: string,
    annotation: {
      timestampMs: number;
      durationMs?: number;
      annotationType: 'note' | 'highlight' | 'bookmark' | 'flag' | 'question';
      title: string;
      content: string;
      color?: string;
      isPublic?: boolean;
      tags?: string[];
      priority?: 'low' | 'normal' | 'high' | 'critical';
    }
  ): Promise<string> {
    return await this.database.addRecordingAnnotation({
      recordingId,
      userId,
      ...annotation,
      color: annotation.color || this.getDefaultAnnotationColor(annotation.annotationType),
      isPublic: annotation.isPublic || false,
      priority: annotation.priority || 'normal'
    });
  }

  /**
   * Add bookmark to recording
   */
  async addBookmark(
    recordingId: string,
    userId: string,
    bookmark: {
      timestampMs: number;
      title: string;
      description?: string;
      bookmarkType?: 'user' | 'system' | 'auto' | 'key_moment';
      icon?: string;
      color?: string;
      chapterMarker?: boolean;
    }
  ): Promise<string> {
    return await this.database.addRecordingBookmark({
      recordingId,
      userId,
      ...bookmark,
      bookmarkType: bookmark.bookmarkType || 'user',
      icon: bookmark.icon || 'bookmark',
      color: bookmark.color || '#0066cc',
      chapterMarker: bookmark.chapterMarker || false
    });
  }

  // ===============================================
  // EXPORT FUNCTIONALITY
  // ===============================================

  /**
   * Export recording in various formats
   */
  async exportRecording(
    recordingId: string,
    requestedBy: string,
    options: {
      exportFormat: 'json' | 'csv' | 'video' | 'html' | 'pdf' | 'zip';
      exportOptions?: ExportOptions;
      includeAnnotations?: boolean;
      includeBookmarks?: boolean;
      includeMetadata?: boolean;
      startTimeMs?: number;
      endTimeMs?: number;
    }
  ): Promise<string> {
    const exportId = await this.database.createRecordingExport({
      recordingId,
      requestedBy,
      ...options,
      includeAnnotations: options.includeAnnotations !== false,
      includeBookmarks: options.includeBookmarks !== false,
      includeMetadata: options.includeMetadata !== false
    });

    // Start export processing asynchronously
    this.processExport(exportId).catch(error => {
      console.error(`Export ${exportId} failed:`, error);
      this.database.updateRecordingExport(exportId, {
        status: 'failed',
        errorMessage: error.message
      });
    });

    return exportId;
  }

  /**
   * Process export request
   */
  private async processExport(exportId: string): Promise<void> {
    await this.database.updateRecordingExport(exportId, { status: 'processing' });

    const exportRequest = await this.database.getRecordingExport(exportId);
    if (!exportRequest) {
      throw new Error(`Export request ${exportId} not found`);
    }

    const playbackData = await this.getPlaybackData(
      exportRequest.recordingId,
      exportRequest.startTimeMs,
      exportRequest.endTimeMs
    );

    const exportData = {
      recording: await this.database.getSessionRecording(exportRequest.recordingId),
      interactions: playbackData.interactions,
      annotations: exportRequest.includeAnnotations ? playbackData.annotations : [],
      bookmarks: exportRequest.includeBookmarks ? playbackData.bookmarks : [],
      exportMetadata: exportRequest.includeMetadata ? {
        exportId,
        requestedBy: exportRequest.requestedBy,
        exportedAt: new Date(),
        format: exportRequest.exportFormat,
        options: exportRequest.exportOptions
      } : undefined
    };

    let filePath: string;
    let fileSizeBytes: number;

    switch (exportRequest.exportFormat) {
      case 'json':
        ({ filePath, fileSizeBytes } = await this.exportToJson(exportData, exportRequest.exportOptions));
        break;
      case 'csv':
        ({ filePath, fileSizeBytes } = await this.exportToCsv(exportData, exportRequest.exportOptions));
        break;
      case 'html':
        ({ filePath, fileSizeBytes } = await this.exportToHtml(exportData, exportRequest.exportOptions));
        break;
      case 'pdf':
        ({ filePath, fileSizeBytes } = await this.exportToPdf(exportData, exportRequest.exportOptions));
        break;
      case 'zip':
        ({ filePath, fileSizeBytes } = await this.exportToZip(exportData, exportRequest.exportOptions));
        break;
      default:
        throw new Error(`Unsupported export format: ${exportRequest.exportFormat}`);
    }

    await this.database.updateRecordingExport(exportId, {
      status: 'completed',
      filePath,
      fileSizeBytes,
      completedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });
  }

  // ===============================================
  // KEY MOMENTS DETECTION
  // ===============================================

  /**
   * Detect key moments in a recording using AI analysis
   */
  async detectKeyMoments(recordingId: string): Promise<KeyMoment[]> {
    const interactions = await this.database.getRecordingInteractions(recordingId);
    const keyMoments: KeyMoment[] = [];

    // Error detection
    const errorInteractions = interactions.filter(i => i.interactionType === 'error');
    for (const error of errorInteractions) {
      keyMoments.push({
        timestampMs: error.relativeTimeMs,
        title: 'Error Occurred',
        description: `Error detected: ${this.truncateContent(error.content, 100)}`,
        momentType: 'error',
        importance: 'high',
        automaticallyDetected: true,
        relatedInteractionIds: [error.id]
      });
    }

    // Completion detection (end of session)
    const lastInteraction = interactions[interactions.length - 1];
    if (lastInteraction && lastInteraction.interactionType === 'system_event') {
      keyMoments.push({
        timestampMs: lastInteraction.relativeTimeMs,
        title: 'Session Completed',
        description: 'Recording session completed successfully',
        momentType: 'completion',
        importance: 'medium',
        automaticallyDetected: true,
        relatedInteractionIds: [lastInteraction.id]
      });
    }

    // Interaction peaks (high activity periods)
    const activityWindows = this.analyzeActivityPatterns(interactions);
    for (const window of activityWindows) {
      if (window.intensity > 0.8) { // High activity threshold
        keyMoments.push({
          timestampMs: window.startTime,
          title: 'High Activity Period',
          description: `Peak interaction period with ${window.interactionCount} interactions`,
          momentType: 'interaction_peak',
          importance: 'medium',
          automaticallyDetected: true,
          relatedInteractionIds: window.interactionIds
        });
      }
    }

    return keyMoments;
  }

  // ===============================================
  // PRIVATE HELPER METHODS
  // ===============================================

  private async processContent(
    content: any,
    quality: 'low' | 'medium' | 'high' | 'lossless'
  ): Promise<{
    content: string;
    contentType: 'text' | 'json' | 'binary';
    isCompressed: boolean;
    originalSize: number;
    compressedSize?: number;
  }> {
    const serialized = typeof content === 'string' ? content : JSON.stringify(content);
    const originalSize = Buffer.byteLength(serialized, 'utf8');
    
    // Determine if compression is needed based on quality and size
    const shouldCompress = (quality !== 'lossless' && originalSize > 1024) || 
                          (quality === 'low' && originalSize > 256);

    if (shouldCompress) {
      const compressed = await this.compressContent(serialized);
      return {
        content: compressed.toString('base64'),
        contentType: typeof content === 'string' ? 'text' : 'json',
        isCompressed: true,
        originalSize,
        compressedSize: compressed.length
      };
    }

    return {
      content: serialized,
      contentType: typeof content === 'string' ? 'text' : 'json',
      isCompressed: false,
      originalSize
    };
  }

  private async compressContent(content: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.gzip(Buffer.from(content, 'utf8'), (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  }

  private getDefaultPlaybackSettings(): PlaybackSettings {
    return {
      autoPlay: false,
      showAnnotations: true,
      showBookmarks: true,
      showTimestamps: true,
      highlightChanges: true,
      skipLongPauses: true,
      maxPauseDurationMs: 5000
    };
  }

  private getDefaultAnnotationColor(type: string): string {
    const colors = {
      note: '#ffeb3b',
      highlight: '#ff9800',
      bookmark: '#2196f3',
      flag: '#f44336',
      question: '#9c27b0'
    };
    return colors[type] || '#ffeb3b';
  }

  private analyzeActivityPatterns(interactions: RecordingInteraction[]): Array<{
    startTime: number;
    endTime: number;
    intensity: number;
    interactionCount: number;
    interactionIds: string[];
  }> {
    // Simple activity analysis - could be enhanced with more sophisticated algorithms
    const windowSize = 30000; // 30 seconds
    const windows = [];
    
    for (let i = 0; i < interactions.length; i += 10) { // Sample every 10 interactions
      const windowStart = interactions[i].relativeTimeMs;
      const windowEnd = windowStart + windowSize;
      
      const windowInteractions = interactions.filter(
        inter => inter.relativeTimeMs >= windowStart && inter.relativeTimeMs <= windowEnd
      );
      
      if (windowInteractions.length > 0) {
        windows.push({
          startTime: windowStart,
          endTime: windowEnd,
          intensity: windowInteractions.length / 20, // Normalize to 0-1 scale
          interactionCount: windowInteractions.length,
          interactionIds: windowInteractions.map(i => i.id)
        });
      }
    }
    
    return windows;
  }

  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  }

  // Export method implementations
  private async exportToJson(data: any, options?: ExportOptions): Promise<{ filePath: string; fileSizeBytes: number }> {
    const fileName = `recording_${data.recording.id}_${Date.now()}.json`;
    const filePath = join(this.storageBasePath, 'exports', fileName);
    
    await fs.mkdir(join(this.storageBasePath, 'exports'), { recursive: true });
    
    const jsonContent = options?.prettyPrint 
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data);
    
    await fs.writeFile(filePath, jsonContent, 'utf8');
    const stats = await fs.stat(filePath);
    
    return { filePath, fileSizeBytes: stats.size };
  }

  private async exportToCsv(data: any, options?: ExportOptions): Promise<{ filePath: string; fileSizeBytes: number }> {
    const fileName = `recording_${data.recording.id}_${Date.now()}.csv`;
    const filePath = join(this.storageBasePath, 'exports', fileName);
    
    await fs.mkdir(join(this.storageBasePath, 'exports'), { recursive: true });
    
    const delimiter = options?.delimiter || ',';
    const headers = ['timestamp', 'relativeTimeMs', 'interactionType', 'agentType', 'content'].join(delimiter);
    const rows = data.interactions.map((interaction: RecordingInteraction) => 
      [
        interaction.timestamp.toISOString(),
        interaction.relativeTimeMs,
        interaction.interactionType,
        interaction.agentType || '',
        `"${interaction.content.replace(/"/g, '""')}"`
      ].join(delimiter)
    );
    
    const csvContent = [headers, ...rows].join('\n');
    await fs.writeFile(filePath, csvContent, 'utf8');
    const stats = await fs.stat(filePath);
    
    return { filePath, fileSizeBytes: stats.size };
  }

  private async exportToHtml(data: any, options?: ExportOptions): Promise<{ filePath: string; fileSizeBytes: number }> {
    const fileName = `recording_${data.recording.id}_${Date.now()}.html`;
    const filePath = join(this.storageBasePath, 'exports', fileName);
    
    await fs.mkdir(join(this.storageBasePath, 'exports'), { recursive: true });
    
    const htmlContent = this.generateHtmlReport(data, options);
    await fs.writeFile(filePath, htmlContent, 'utf8');
    const stats = await fs.stat(filePath);
    
    return { filePath, fileSizeBytes: stats.size };
  }

  private async exportToPdf(data: any, options?: ExportOptions): Promise<{ filePath: string; fileSizeBytes: number }> {
    // For now, create a simple text-based PDF export
    // In production, you might use libraries like puppeteer or jsPDF
    const fileName = `recording_${data.recording.id}_${Date.now()}.txt`;
    const filePath = join(this.storageBasePath, 'exports', fileName);
    
    await fs.mkdir(join(this.storageBasePath, 'exports'), { recursive: true });
    
    const textContent = this.generateTextReport(data);
    await fs.writeFile(filePath, textContent, 'utf8');
    const stats = await fs.stat(filePath);
    
    return { filePath, fileSizeBytes: stats.size };
  }

  private async exportToZip(data: any, options?: ExportOptions): Promise<{ filePath: string; fileSizeBytes: number }> {
    // Create multiple formats in a zip file
    const fileName = `recording_${data.recording.id}_${Date.now()}.zip`;
    const filePath = join(this.storageBasePath, 'exports', fileName);
    
    await fs.mkdir(join(this.storageBasePath, 'exports'), { recursive: true });
    
    // For now, just create a JSON file (in production, use a proper zip library)
    const jsonContent = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath.replace('.zip', '.json'), jsonContent, 'utf8');
    const stats = await fs.stat(filePath.replace('.zip', '.json'));
    
    return { filePath: filePath.replace('.zip', '.json'), fileSizeBytes: stats.size };
  }

  private generateHtmlReport(data: any, options?: ExportOptions): string {
    const recording = data.recording;
    const interactions = data.interactions;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Session Recording Report - ${recording.recordingName || recording.id}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { border-bottom: 2px solid #ccc; padding-bottom: 10px; }
        .interaction { margin: 10px 0; padding: 10px; border-left: 3px solid #007cba; background-color: #f9f9f9; }
        .timestamp { color: #666; font-size: 0.9em; }
        .agent-manager { border-left-color: #28a745; }
        .agent-worker { border-left-color: #17a2b8; }
        .error { border-left-color: #dc3545; background-color: #f8d7da; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Session Recording Report</h1>
        <p><strong>Recording:</strong> ${recording.recordingName || recording.id}</p>
        <p><strong>Session:</strong> ${recording.sessionId}</p>
        <p><strong>Started:</strong> ${recording.recordingStartedAt}</p>
        <p><strong>Duration:</strong> ${recording.playbackDurationMs ? (recording.playbackDurationMs / 1000).toFixed(2) + 's' : 'Unknown'}</p>
        <p><strong>Total Interactions:</strong> ${interactions.length}</p>
    </div>
    
    <div class="content">
        <h2>Interactions Timeline</h2>
        ${interactions.map((interaction: RecordingInteraction) => `
            <div class="interaction agent-${interaction.agentType} ${interaction.interactionType === 'error' ? 'error' : ''}">
                <div class="timestamp">${new Date(interaction.timestamp).toLocaleString()} (${interaction.relativeTimeMs}ms)</div>
                <div><strong>${interaction.interactionType}</strong> - ${interaction.agentType || 'system'}</div>
                <div>${this.truncateContent(typeof interaction.content === 'string' ? interaction.content : JSON.stringify(interaction.content), 200)}</div>
            </div>
        `).join('')}
    </div>
    
    ${data.annotations && data.annotations.length > 0 ? `
    <div class="annotations">
        <h2>Annotations</h2>
        ${data.annotations.map((annotation: RecordingAnnotation) => `
            <div class="annotation">
                <strong>${annotation.title}</strong> (${annotation.timestampMs}ms)
                <p>${annotation.content}</p>
            </div>
        `).join('')}
    </div>
    ` : ''}
    
    ${data.bookmarks && data.bookmarks.length > 0 ? `
    <div class="bookmarks">
        <h2>Bookmarks</h2>
        ${data.bookmarks.map((bookmark: RecordingBookmark) => `
            <div class="bookmark">
                <strong>${bookmark.title}</strong> (${bookmark.timestampMs}ms)
                ${bookmark.description ? `<p>${bookmark.description}</p>` : ''}
            </div>
        `).join('')}
    </div>
    ` : ''}
</body>
</html>`;
  }

  private generateTextReport(data: any): string {
    const recording = data.recording;
    const interactions = data.interactions;
    
    let report = `SESSION RECORDING REPORT\n`;
    report += `=======================\n\n`;
    report += `Recording: ${recording.recordingName || recording.id}\n`;
    report += `Session: ${recording.sessionId}\n`;
    report += `Started: ${recording.recordingStartedAt}\n`;
    report += `Duration: ${recording.playbackDurationMs ? (recording.playbackDurationMs / 1000).toFixed(2) + 's' : 'Unknown'}\n`;
    report += `Total Interactions: ${interactions.length}\n\n`;
    
    report += `INTERACTIONS TIMELINE\n`;
    report += `=====================\n\n`;
    
    interactions.forEach((interaction: RecordingInteraction) => {
      report += `[${new Date(interaction.timestamp).toLocaleString()}] `;
      report += `(${interaction.relativeTimeMs}ms) `;
      report += `${interaction.interactionType.toUpperCase()} `;
      report += `- ${interaction.agentType || 'system'}\n`;
      report += `${this.truncateContent(typeof interaction.content === 'string' ? interaction.content : JSON.stringify(interaction.content), 200)}\n\n`;
    });
    
    return report;
  }
}