import { AgentMessage, DualAgentSession, AgentCommunication, SystemEvent, PerformanceMetrics } from '../types';

export interface ReplayBookmark {
  id: string;
  sessionId: string;
  timestamp: Date;
  messageIndex: number;
  title: string;
  description?: string;
  tags: string[];
  createdAt: Date;
  createdBy: string;
}

export interface ReplayAnnotation {
  id: string;
  sessionId: string;
  timestamp: Date;
  messageIndex: number;
  content: string;
  author: string;
  createdAt: Date;
  parentAnnotationId?: string; // For threaded annotations
}

export interface ReplayTimelineEvent {
  id: string;
  timestamp: Date;
  type: 'message' | 'communication' | 'system_event' | 'performance_metric' | 'bookmark' | 'annotation';
  data: AgentMessage | AgentCommunication | SystemEvent | PerformanceMetrics | ReplayBookmark | ReplayAnnotation;
  index: number; // Position in timeline
}

export interface ReplaySegment {
  id: string;
  sessionId: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  startIndex: number;
  endIndex: number;
  tags: string[];
  highlightColor?: string;
  createdAt: Date;
  createdBy: string;
}

export interface ReplayState {
  sessionId: string;
  currentIndex: number;
  totalEvents: number;
  isPlaying: boolean;
  playbackSpeed: number; // 0.25x to 4.0x
  timeline: ReplayTimelineEvent[];
  bookmarks: ReplayBookmark[];
  annotations: ReplayAnnotation[];
  segments: ReplaySegment[];
  
  // View configuration
  viewMode: 'timeline' | 'step' | 'comparison';
  showMessageTypes: Array<'prompt' | 'response' | 'tool_call' | 'error' | 'system'>;
  showAgentTypes: Array<'manager' | 'worker'>;
  showEvents: boolean;
  showMetrics: boolean;
  
  // Playback state
  lastUpdateTime: Date;
  autoAdvance: boolean;
  loopMode: boolean;
  
  // Analysis state
  focusedMessageId?: string;
  selectedTimeRange?: { start: Date; end: Date };
  comparisonSessionIds?: string[];
}

export interface ReplayMetadata {
  sessionId: string;
  title: string;
  description?: string;
  duration: number;
  totalEvents: number;
  startTime: Date;
  endTime: Date;
  keyMoments: Array<{
    timestamp: Date;
    description: string;
    importance: 'low' | 'medium' | 'high';
  }>;
  tags: string[];
  createdAt: Date;
  lastModified: Date;
}

export class ReplayStateManager {
  private state: ReplayState;
  private listeners: Set<(state: ReplayState) => void> = new Set();

  constructor(sessionId: string) {
    this.state = {
      sessionId,
      currentIndex: 0,
      totalEvents: 0,
      isPlaying: false,
      playbackSpeed: 1.0,
      timeline: [],
      bookmarks: [],
      annotations: [],
      segments: [],
      viewMode: 'timeline',
      showMessageTypes: ['prompt', 'response', 'tool_call', 'error', 'system'],
      showAgentTypes: ['manager', 'worker'],
      showEvents: true,
      showMetrics: false,
      lastUpdateTime: new Date(),
      autoAdvance: true,
      loopMode: false
    };
  }

  // State getters
  getState(): ReplayState {
    return { ...this.state };
  }

  getCurrentEvent(): ReplayTimelineEvent | null {
    return this.state.timeline[this.state.currentIndex] || null;
  }

  getCurrentMessage(): AgentMessage | null {
    const event = this.getCurrentEvent();
    return event && event.type === 'message' ? event.data as AgentMessage : null;
  }

  getEventsInRange(start: number, end: number): ReplayTimelineEvent[] {
    return this.state.timeline.slice(start, end + 1);
  }

  getBookmarksInRange(startTime: Date, endTime: Date): ReplayBookmark[] {
    return this.state.bookmarks.filter(
      bookmark => bookmark.timestamp >= startTime && bookmark.timestamp <= endTime
    );
  }

  // State setters
  setTimeline(timeline: ReplayTimelineEvent[]): void {
    this.state.timeline = timeline;
    this.state.totalEvents = timeline.length;
    this.notifyListeners();
  }

  setCurrentIndex(index: number): void {
    const clampedIndex = Math.max(0, Math.min(index, this.state.totalEvents - 1));
    if (clampedIndex !== this.state.currentIndex) {
      this.state.currentIndex = clampedIndex;
      this.state.lastUpdateTime = new Date();
      this.notifyListeners();
    }
  }

  setPlaybackSpeed(speed: number): void {
    const clampedSpeed = Math.max(0.25, Math.min(4.0, speed));
    this.state.playbackSpeed = clampedSpeed;
    this.notifyListeners();
  }

  setIsPlaying(playing: boolean): void {
    this.state.isPlaying = playing;
    this.state.lastUpdateTime = new Date();
    this.notifyListeners();
  }

  setViewMode(mode: ReplayState['viewMode']): void {
    this.state.viewMode = mode;
    this.notifyListeners();
  }

  setShowMessageTypes(types: ReplayState['showMessageTypes']): void {
    this.state.showMessageTypes = types;
    this.notifyListeners();
  }

  setShowAgentTypes(types: ReplayState['showAgentTypes']): void {
    this.state.showAgentTypes = types;
    this.notifyListeners();
  }

  setFocusedMessage(messageId?: string): void {
    this.state.focusedMessageId = messageId;
    this.notifyListeners();
  }

  setSelectedTimeRange(range?: { start: Date; end: Date }): void {
    this.state.selectedTimeRange = range;
    this.notifyListeners();
  }

  // Bookmark management
  addBookmark(bookmark: ReplayBookmark): void {
    this.state.bookmarks.push(bookmark);
    this.state.bookmarks.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    this.notifyListeners();
  }

  removeBookmark(bookmarkId: string): void {
    this.state.bookmarks = this.state.bookmarks.filter(b => b.id !== bookmarkId);
    this.notifyListeners();
  }

  updateBookmark(bookmarkId: string, updates: Partial<ReplayBookmark>): void {
    const index = this.state.bookmarks.findIndex(b => b.id === bookmarkId);
    if (index !== -1) {
      this.state.bookmarks[index] = { ...this.state.bookmarks[index], ...updates };
      this.notifyListeners();
    }
  }

  // Annotation management
  addAnnotation(annotation: ReplayAnnotation): void {
    this.state.annotations.push(annotation);
    this.state.annotations.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    this.notifyListeners();
  }

  removeAnnotation(annotationId: string): void {
    this.state.annotations = this.state.annotations.filter(a => a.id !== annotationId);
    this.notifyListeners();
  }

  updateAnnotation(annotationId: string, updates: Partial<ReplayAnnotation>): void {
    const index = this.state.annotations.findIndex(a => a.id === annotationId);
    if (index !== -1) {
      this.state.annotations[index] = { ...this.state.annotations[index], ...updates };
      this.notifyListeners();
    }
  }

  // Segment management
  addSegment(segment: ReplaySegment): void {
    this.state.segments.push(segment);
    this.state.segments.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    this.notifyListeners();
  }

  removeSegment(segmentId: string): void {
    this.state.segments = this.state.segments.filter(s => s.id !== segmentId);
    this.notifyListeners();
  }

  updateSegment(segmentId: string, updates: Partial<ReplaySegment>): void {
    const index = this.state.segments.findIndex(s => s.id === segmentId);
    if (index !== -1) {
      this.state.segments[index] = { ...this.state.segments[index], ...updates };
      this.notifyListeners();
    }
  }

  // Navigation helpers
  jumpToBookmark(bookmarkId: string): void {
    const bookmark = this.state.bookmarks.find(b => b.id === bookmarkId);
    if (bookmark) {
      this.setCurrentIndex(bookmark.messageIndex);
    }
  }

  jumpToTimestamp(timestamp: Date): void {
    const event = this.state.timeline.find(e => e.timestamp >= timestamp);
    if (event) {
      this.setCurrentIndex(event.index);
    }
  }

  jumpToMessage(messageId: string): void {
    const eventIndex = this.state.timeline.findIndex(
      e => e.type === 'message' && (e.data as AgentMessage).id === messageId
    );
    if (eventIndex !== -1) {
      this.setCurrentIndex(eventIndex);
    }
  }

  // Playback controls
  play(): void {
    this.setIsPlaying(true);
  }

  pause(): void {
    this.setIsPlaying(false);
  }

  stop(): void {
    this.setIsPlaying(false);
    this.setCurrentIndex(0);
  }

  stepForward(): void {
    if (this.state.currentIndex < this.state.totalEvents - 1) {
      this.setCurrentIndex(this.state.currentIndex + 1);
    }
  }

  stepBackward(): void {
    if (this.state.currentIndex > 0) {
      this.setCurrentIndex(this.state.currentIndex - 1);
    }
  }

  jumpToStart(): void {
    this.setCurrentIndex(0);
  }

  jumpToEnd(): void {
    this.setCurrentIndex(this.state.totalEvents - 1);
  }

  // Filter helpers
  getFilteredTimeline(): ReplayTimelineEvent[] {
    return this.state.timeline.filter(event => {
      if (event.type === 'message') {
        const message = event.data as AgentMessage;
        return this.state.showMessageTypes.includes(message.messageType) &&
               this.state.showAgentTypes.includes(message.agentType);
      }
      
      if (event.type === 'system_event' && !this.state.showEvents) {
        return false;
      }
      
      if (event.type === 'performance_metric' && !this.state.showMetrics) {
        return false;
      }
      
      return true;
    });
  }

  // Event listeners
  subscribe(listener: (state: ReplayState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state));
  }

  // Export/Import state
  exportState(): object {
    return {
      ...this.state,
      bookmarks: this.state.bookmarks,
      annotations: this.state.annotations,
      segments: this.state.segments
    };
  }

  importState(data: any): void {
    if (data.sessionId !== this.state.sessionId) {
      throw new Error('Cannot import state from different session');
    }
    
    this.state = {
      ...this.state,
      ...data,
      lastUpdateTime: new Date()
    };
    
    this.notifyListeners();
  }

  // Utility methods
  getProgress(): number {
    return this.state.totalEvents > 0 ? this.state.currentIndex / (this.state.totalEvents - 1) : 0;
  }

  getDuration(): number {
    if (this.state.timeline.length === 0) return 0;
    
    const first = this.state.timeline[0];
    const last = this.state.timeline[this.state.timeline.length - 1];
    
    return last.timestamp.getTime() - first.timestamp.getTime();
  }

  getCurrentTime(): number {
    const currentEvent = this.getCurrentEvent();
    if (!currentEvent || this.state.timeline.length === 0) return 0;
    
    const first = this.state.timeline[0];
    return currentEvent.timestamp.getTime() - first.timestamp.getTime();
  }

  getTimeAtIndex(index: number): number {
    const event = this.state.timeline[index];
    if (!event || this.state.timeline.length === 0) return 0;
    
    const first = this.state.timeline[0];
    return event.timestamp.getTime() - first.timestamp.getTime();
  }
}