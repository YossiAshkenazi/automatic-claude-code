export interface AgentMessage {
  id: string;
  sessionId: string;
  agentType: 'manager' | 'worker';
  messageType: 'prompt' | 'response' | 'tool_call' | 'error' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    tools?: string[];
    files?: string[];
    commands?: string[];
    cost?: number;
    duration?: number;
    exitCode?: number;
  };
}

export interface DualAgentSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'paused';
  initialTask: string;
  workDir: string;
  messages: AgentMessage[];
  summary?: SessionSummary;
}

export interface SessionSummary {
  totalMessages: number;
  managerMessages: number;
  workerMessages: number;
  totalDuration: number;
  totalCost?: number;
  filesModified: string[];
  commandsExecuted: string[];
  toolsUsed: string[];
  successRate: number;
}

export interface AgentCommunication {
  id: string;
  sessionId: string;
  fromAgent: 'manager' | 'worker';
  toAgent: 'manager' | 'worker';
  messageType: 'instruction' | 'feedback' | 'result' | 'question';
  content: string;
  timestamp: Date;
  relatedMessageId?: string;
}

export interface SystemEvent {
  id: string;
  sessionId: string;
  eventType: 'session_start' | 'session_end' | 'agent_switch' | 'error' | 'pause' | 'resume';
  details: string;
  timestamp: Date;
}

export interface PerformanceMetrics {
  sessionId: string;
  agentType: 'manager' | 'worker';
  responseTime: number;
  tokensUsed?: number;
  cost?: number;
  errorRate: number;
  timestamp: Date;
}

export interface WebSocketMessage {
  type: 'new_message' | 'session_update' | 'system_event' | 'performance_update' | 'session_list';
  data: AgentMessage | DualAgentSession | SystemEvent | PerformanceMetrics | DualAgentSession[];
}

// Webhook Types
export type WebhookEvent = 
  | 'session.started'
  | 'session.completed'
  | 'session.failed'
  | 'agent.message'
  | 'performance.alert'
  | 'anomaly.detected'
  | 'user.login'
  | 'cost.threshold'
  | 'webhook.test';

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  secret?: string;
  events: WebhookEvent[];
  active: boolean;
  headers?: Record<string, string>;
  payloadFields?: string[];
  filters?: Record<string, any>;
  integration?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEventPayload {
  sessionId?: string;
  agentType?: 'manager' | 'worker';
  message?: AgentMessage;
  session?: DualAgentSession;
  metrics?: PerformanceMetrics;
  alert?: {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    details?: any;
  };
  user?: {
    id: string;
    email: string;
    timestamp: Date;
  };
  cost?: {
    current: number;
    threshold: number;
    period: string;
  };
  anomaly?: {
    type: string;
    confidence: number;
    description: string;
    data: any;
  };
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode: number;
  response?: any;
  error?: string;
  deliveredAt: Date;
  duration: number;
}

export interface WebhookDeliveryLog {
  id: string;
  endpointId: string;
  event: WebhookEvent;
  payload: any;
  result: WebhookDeliveryResult;
  timestamp: Date;
}

export interface WebhookConfig {
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
  enableSignatureVerification: boolean;
  enableRateLimiting: boolean;
  enableDeadLetterQueue: boolean;
}

export interface WebhookTemplate {
  id: string;
  name: string;
  description: string;
  integration: string;
  defaultEvents: WebhookEvent[];
  defaultHeaders: Record<string, string>;
  defaultPayloadFields: string[];
  defaultFilters: Record<string, any>;
  configSchema: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'select';
    required: boolean;
    description: string;
    options?: string[];
  }>;
}

export interface WebhookIntegration {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  category: 'communication' | 'project-management' | 'monitoring' | 'development' | 'other';
  setupInstructions: string[];
  configFields: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'select';
    required: boolean;
    description: string;
    options?: string[];
  }>;
}

// ===============================================
// SESSION RECORDING TYPES
// ===============================================

export interface SessionRecording {
  id: string;
  sessionId: string;
  recordingName?: string;
  description?: string;
  recordedBy?: string;
  recordingStartedAt: Date;
  recordingCompletedAt?: Date;
  status: 'recording' | 'completed' | 'failed' | 'processing';
  
  // Recording metadata
  totalInteractions: number;
  totalSizeBytes: number;
  compressionType?: string;
  recordingQuality: 'low' | 'medium' | 'high' | 'lossless';
  
  // Playback metadata
  playbackDurationMs?: number;
  keyMoments?: KeyMoment[];
  annotations?: RecordingAnnotation[];
  bookmarks?: RecordingBookmark[];
  
  // Export and sharing
  exportFormats?: string[];
  sharedPublicly: boolean;
  downloadCount: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface RecordingInteraction {
  id: string;
  recordingId: string;
  sessionId: string;
  
  // Interaction metadata
  sequenceNumber: number;
  interactionType: 'message' | 'agent_communication' | 'system_event' | 'tool_call' |
                  'file_operation' | 'command_execution' | 'user_input' | 'agent_switch' |
                  'performance_metric' | 'error' | 'state_change';
  
  // Timing information
  timestamp: Date;
  relativeTimeMs: number;
  durationMs?: number;
  
  // Agent context
  agentType?: 'manager' | 'worker' | 'system' | 'user';
  agentContext?: any;
  
  // Interaction content
  content: string;
  contentType: 'text' | 'json' | 'binary' | 'image' | 'file';
  contentHash?: string;
  
  // Related data
  relatedMessageId?: string;
  relatedEventId?: string;
  parentInteractionId?: string;
  
  // Metadata and context
  metadata?: any;
  screenshotPath?: string;
  filesTouched?: string[];
  commandsExecuted?: string[];
  toolsUsed?: string[];
  
  // Compression and storage
  isCompressed: boolean;
  compressedSize?: number;
  originalSize?: number;
}

export interface PlaybackSession {
  id: string;
  recordingId: string;
  userId?: string;
  playbackName?: string;
  
  // Playback state
  currentPositionMs: number;
  playbackSpeed: number;
  isPlaying: boolean;
  isPaused: boolean;
  
  // Playback metadata
  startedAt: Date;
  lastAccessedAt: Date;
  completedAt?: Date;
  totalWatchTimeMs: number;
  
  // User interactions during playback
  annotationsAdded: number;
  bookmarksAdded: number;
  notes?: string;
  
  // Settings and preferences
  playbackSettings?: PlaybackSettings;
  filtersApplied?: string[];
  
  createdAt: Date;
  updatedAt: Date;
}

export interface PlaybackSettings {
  autoPlay: boolean;
  showAnnotations: boolean;
  showBookmarks: boolean;
  showTimestamps: boolean;
  highlightChanges: boolean;
  filterInteractionTypes?: string[];
  showOnlyAgentType?: 'manager' | 'worker' | null;
  skipLongPauses: boolean;
  maxPauseDurationMs: number;
}

export interface RecordingAnnotation {
  id: string;
  recordingId: string;
  playbackSessionId?: string;
  userId?: string;
  
  // Annotation positioning
  timestampMs: number;
  durationMs?: number;
  
  // Annotation content
  annotationType: 'note' | 'highlight' | 'bookmark' | 'flag' | 'question';
  title: string;
  content: string;
  color: string;
  
  // Metadata
  isPublic: boolean;
  tags?: string[];
  priority: 'low' | 'normal' | 'high' | 'critical';
  
  createdAt: Date;
  updatedAt: Date;
}

export interface RecordingBookmark {
  id: string;
  recordingId: string;
  userId?: string;
  
  // Bookmark positioning and metadata
  timestampMs: number;
  title: string;
  description?: string;
  bookmarkType: 'user' | 'system' | 'auto' | 'key_moment';
  
  // Visual and navigation
  icon: string;
  color: string;
  chapterMarker: boolean;
  
  // Usage tracking
  accessCount: number;
  lastAccessedAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface RecordingExport {
  id: string;
  recordingId: string;
  requestedBy?: string;
  
  // Export configuration
  exportFormat: 'json' | 'csv' | 'video' | 'html' | 'pdf' | 'zip';
  exportOptions?: ExportOptions;
  includeAnnotations: boolean;
  includeBookmarks: boolean;
  includeMetadata: boolean;
  
  // Time range filtering
  startTimeMs?: number;
  endTimeMs?: number;
  
  // Export status and results
  status: 'pending' | 'processing' | 'completed' | 'failed';
  filePath?: string;
  fileSizeBytes?: number;
  downloadCount: number;
  
  // Timestamps
  requestedAt: Date;
  completedAt?: Date;
  expiresAt?: Date;
  
  errorMessage?: string;
}

export interface ExportOptions {
  // JSON export options
  prettyPrint?: boolean;
  includeRawContent?: boolean;
  
  // CSV export options
  delimiter?: string;
  includeHeaders?: boolean;
  
  // Video export options
  frameRate?: number;
  resolution?: string;
  includeAudio?: boolean;
  
  // HTML export options
  template?: string;
  includeStyles?: boolean;
  interactive?: boolean;
  
  // PDF export options
  pageSize?: string;
  margin?: number;
  includeToc?: boolean;
}

export interface KeyMoment {
  timestampMs: number;
  title: string;
  description: string;
  momentType: 'error' | 'completion' | 'decision_point' | 'interaction_peak' | 'user_defined';
  importance: 'low' | 'medium' | 'high';
  automaticallyDetected: boolean;
  relatedInteractionIds?: string[];
}

// Recording-related WebSocket message types
export interface RecordingWebSocketMessage {
  type: 'recording_started' | 'recording_stopped' | 'recording_updated' | 
        'playback_state_changed' | 'annotation_added' | 'bookmark_added' |
        'export_completed' | 'export_failed';
  data: SessionRecording | PlaybackSession | RecordingAnnotation | 
        RecordingBookmark | RecordingExport | any;
}

// Combined WebSocket message type
export type ExtendedWebSocketMessage = WebSocketMessage | RecordingWebSocketMessage;