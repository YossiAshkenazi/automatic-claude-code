import { ReplayStateManager, ReplayTimelineEvent } from './ReplayState';

export interface PlaybackOptions {
  speed: number;
  autoAdvance: boolean;
  loopMode: boolean;
  skipErrors: boolean;
  pauseOnBookmarks: boolean;
  pauseOnAnnotations: boolean;
}

export interface StepOptions {
  skipToNextAgent?: boolean;
  skipToNextTool?: boolean;
  skipToNextError?: boolean;
  stepSize?: number; // For bulk stepping
}

export interface JumpTarget {
  type: 'index' | 'timestamp' | 'message' | 'bookmark' | 'percentage';
  value: number | Date | string;
}

export class ReplayControls {
  private stateManager: ReplayStateManager;
  private playbackTimer?: NodeJS.Timeout;
  private playbackOptions: PlaybackOptions;
  private lastPlaybackUpdate: Date;

  constructor(stateManager: ReplayStateManager) {
    this.stateManager = stateManager;
    this.lastPlaybackUpdate = new Date();
    
    this.playbackOptions = {
      speed: 1.0,
      autoAdvance: true,
      loopMode: false,
      skipErrors: false,
      pauseOnBookmarks: false,
      pauseOnAnnotations: false
    };
  }

  // Basic playback controls
  play(options?: Partial<PlaybackOptions>): void {
    if (options) {
      this.playbackOptions = { ...this.playbackOptions, ...options };
    }

    this.stateManager.setIsPlaying(true);
    this.stateManager.setPlaybackSpeed(this.playbackOptions.speed);
    
    this.startPlaybackTimer();
  }

  pause(): void {
    this.stateManager.setIsPlaying(false);
    this.stopPlaybackTimer();
  }

  stop(): void {
    this.stateManager.setIsPlaying(false);
    this.stateManager.setCurrentIndex(0);
    this.stopPlaybackTimer();
  }

  toggle(): void {
    const state = this.stateManager.getState();
    if (state.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  // Speed control
  setSpeed(speed: number): void {
    this.playbackOptions.speed = Math.max(0.25, Math.min(4.0, speed));
    this.stateManager.setPlaybackSpeed(this.playbackOptions.speed);
    
    // Restart timer if playing to apply new speed
    if (this.stateManager.getState().isPlaying) {
      this.stopPlaybackTimer();
      this.startPlaybackTimer();
    }
  }

  increaseSpeed(): void {
    const speeds = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0];
    const currentIndex = speeds.findIndex(s => s >= this.playbackOptions.speed);
    const nextIndex = Math.min(currentIndex + 1, speeds.length - 1);
    this.setSpeed(speeds[nextIndex]);
  }

  decreaseSpeed(): void {
    const speeds = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0];
    const currentIndex = speeds.findIndex(s => s >= this.playbackOptions.speed);
    const prevIndex = Math.max(currentIndex - 1, 0);
    this.setSpeed(speeds[prevIndex]);
  }

  // Step controls
  stepForward(options?: StepOptions): void {
    const state = this.stateManager.getState();
    
    if (options?.stepSize && options.stepSize > 1) {
      const newIndex = Math.min(state.currentIndex + options.stepSize, state.totalEvents - 1);
      this.stateManager.setCurrentIndex(newIndex);
      return;
    }

    if (options?.skipToNextAgent) {
      this.skipToNextAgent();
      return;
    }

    if (options?.skipToNextTool) {
      this.skipToNextTool();
      return;
    }

    if (options?.skipToNextError) {
      this.skipToNextError();
      return;
    }

    // Default single step
    this.stateManager.stepForward();
  }

  stepBackward(options?: StepOptions): void {
    const state = this.stateManager.getState();
    
    if (options?.stepSize && options.stepSize > 1) {
      const newIndex = Math.max(state.currentIndex - options.stepSize, 0);
      this.stateManager.setCurrentIndex(newIndex);
      return;
    }

    if (options?.skipToNextAgent) {
      this.skipToPrevAgent();
      return;
    }

    if (options?.skipToNextTool) {
      this.skipToPrevTool();
      return;
    }

    if (options?.skipToNextError) {
      this.skipToPrevError();
      return;
    }

    // Default single step
    this.stateManager.stepBackward();
  }

  // Jump controls
  jumpTo(target: JumpTarget): void {
    const state = this.stateManager.getState();
    
    switch (target.type) {
      case 'index':
        this.stateManager.setCurrentIndex(target.value as number);
        break;
        
      case 'timestamp':
        this.stateManager.jumpToTimestamp(target.value as Date);
        break;
        
      case 'message':
        this.stateManager.jumpToMessage(target.value as string);
        break;
        
      case 'bookmark':
        this.stateManager.jumpToBookmark(target.value as string);
        break;
        
      case 'percentage':
        const percentage = Math.max(0, Math.min(1, target.value as number));
        const targetIndex = Math.floor(percentage * (state.totalEvents - 1));
        this.stateManager.setCurrentIndex(targetIndex);
        break;
    }
  }

  jumpToStart(): void {
    this.stateManager.jumpToStart();
  }

  jumpToEnd(): void {
    this.stateManager.jumpToEnd();
  }

  // Advanced navigation
  skipToNextAgent(): void {
    const state = this.stateManager.getState();
    const currentEvent = this.stateManager.getCurrentEvent();
    
    if (!currentEvent || currentEvent.type !== 'message') return;
    
    const currentAgent = (currentEvent.data as any).agentType;
    const timeline = state.timeline;
    
    for (let i = state.currentIndex + 1; i < timeline.length; i++) {
      const event = timeline[i];
      if (event.type === 'message') {
        const messageAgent = (event.data as any).agentType;
        if (messageAgent !== currentAgent) {
          this.stateManager.setCurrentIndex(i);
          return;
        }
      }
    }
  }

  skipToPrevAgent(): void {
    const state = this.stateManager.getState();
    const currentEvent = this.stateManager.getCurrentEvent();
    
    if (!currentEvent || currentEvent.type !== 'message') return;
    
    const currentAgent = (currentEvent.data as any).agentType;
    const timeline = state.timeline;
    
    for (let i = state.currentIndex - 1; i >= 0; i--) {
      const event = timeline[i];
      if (event.type === 'message') {
        const messageAgent = (event.data as any).agentType;
        if (messageAgent !== currentAgent) {
          this.stateManager.setCurrentIndex(i);
          return;
        }
      }
    }
  }

  skipToNextTool(): void {
    const state = this.stateManager.getState();
    const timeline = state.timeline;
    
    for (let i = state.currentIndex + 1; i < timeline.length; i++) {
      const event = timeline[i];
      if (event.type === 'message') {
        const message = event.data as any;
        if (message.messageType === 'tool_call') {
          this.stateManager.setCurrentIndex(i);
          return;
        }
      }
    }
  }

  skipToPrevTool(): void {
    const state = this.stateManager.getState();
    const timeline = state.timeline;
    
    for (let i = state.currentIndex - 1; i >= 0; i--) {
      const event = timeline[i];
      if (event.type === 'message') {
        const message = event.data as any;
        if (message.messageType === 'tool_call') {
          this.stateManager.setCurrentIndex(i);
          return;
        }
      }
    }
  }

  skipToNextError(): void {
    const state = this.stateManager.getState();
    const timeline = state.timeline;
    
    for (let i = state.currentIndex + 1; i < timeline.length; i++) {
      const event = timeline[i];
      if (event.type === 'message') {
        const message = event.data as any;
        if (message.messageType === 'error') {
          this.stateManager.setCurrentIndex(i);
          return;
        }
      }
    }
  }

  skipToPrevError(): void {
    const state = this.stateManager.getState();
    const timeline = state.timeline;
    
    for (let i = state.currentIndex - 1; i >= 0; i--) {
      const event = timeline[i];
      if (event.type === 'message') {
        const message = event.data as any;
        if (message.messageType === 'error') {
          this.stateManager.setCurrentIndex(i);
          return;
        }
      }
    }
  }

  // Bookmark navigation
  jumpToNextBookmark(): void {
    const state = this.stateManager.getState();
    const currentTime = this.stateManager.getCurrentTime();
    
    const nextBookmark = state.bookmarks.find(
      bookmark => this.stateManager.getTimeAtIndex(bookmark.messageIndex) > currentTime
    );
    
    if (nextBookmark) {
      this.stateManager.jumpToBookmark(nextBookmark.id);
    }
  }

  jumpToPrevBookmark(): void {
    const state = this.stateManager.getState();
    const currentTime = this.stateManager.getCurrentTime();
    
    const prevBookmarksReversed = [...state.bookmarks]
      .reverse()
      .find(bookmark => this.stateManager.getTimeAtIndex(bookmark.messageIndex) < currentTime);
    
    if (prevBookmarksReversed) {
      this.stateManager.jumpToBookmark(prevBookmarksReversed.id);
    }
  }

  // Segment navigation
  jumpToSegmentStart(segmentId: string): void {
    const state = this.stateManager.getState();
    const segment = state.segments.find(s => s.id === segmentId);
    
    if (segment) {
      this.stateManager.setCurrentIndex(segment.startIndex);
    }
  }

  jumpToSegmentEnd(segmentId: string): void {
    const state = this.stateManager.getState();
    const segment = state.segments.find(s => s.id === segmentId);
    
    if (segment) {
      this.stateManager.setCurrentIndex(segment.endIndex);
    }
  }

  // Playback options
  setPlaybackOptions(options: Partial<PlaybackOptions>): void {
    this.playbackOptions = { ...this.playbackOptions, ...options };
  }

  getPlaybackOptions(): PlaybackOptions {
    return { ...this.playbackOptions };
  }

  // Time-based seeking
  seekToPercentage(percentage: number): void {
    this.jumpTo({ type: 'percentage', value: percentage });
  }

  seekByTime(milliseconds: number): void {
    const state = this.stateManager.getState();
    const currentTime = this.stateManager.getCurrentTime();
    const targetTime = currentTime + milliseconds;
    
    // Find the event closest to the target time
    let closestIndex = state.currentIndex;
    let closestTimeDiff = Math.abs(targetTime - currentTime);
    
    for (let i = 0; i < state.timeline.length; i++) {
      const eventTime = this.stateManager.getTimeAtIndex(i);
      const timeDiff = Math.abs(targetTime - eventTime);
      
      if (timeDiff < closestTimeDiff) {
        closestTimeDiff = timeDiff;
        closestIndex = i;
      }
    }
    
    this.stateManager.setCurrentIndex(closestIndex);
  }

  seekToTime(timestamp: Date): void {
    this.stateManager.jumpToTimestamp(timestamp);
  }

  // Private methods
  private startPlaybackTimer(): void {
    this.stopPlaybackTimer();
    
    // Calculate interval based on speed
    // At 1x speed, advance every 100ms for smooth playback
    const baseInterval = 100;
    const interval = baseInterval / this.playbackOptions.speed;
    
    this.playbackTimer = setInterval(() => {
      this.advancePlayback();
    }, interval);
  }

  private stopPlaybackTimer(): void {
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
      this.playbackTimer = undefined;
    }
  }

  private advancePlayback(): void {
    const state = this.stateManager.getState();
    
    if (!state.isPlaying) {
      this.stopPlaybackTimer();
      return;
    }

    // Check if we've reached the end
    if (state.currentIndex >= state.totalEvents - 1) {
      if (this.playbackOptions.loopMode) {
        this.stateManager.setCurrentIndex(0);
      } else {
        this.pause();
      }
      return;
    }

    const currentEvent = this.stateManager.getCurrentEvent();
    const nextEvent = state.timeline[state.currentIndex + 1];
    
    if (!currentEvent || !nextEvent) {
      this.pause();
      return;
    }

    // Check if we should pause on bookmarks
    if (this.playbackOptions.pauseOnBookmarks) {
      const hasBookmark = state.bookmarks.some(
        bookmark => bookmark.messageIndex === state.currentIndex + 1
      );
      if (hasBookmark) {
        this.pause();
        return;
      }
    }

    // Check if we should pause on annotations
    if (this.playbackOptions.pauseOnAnnotations) {
      const hasAnnotation = state.annotations.some(
        annotation => annotation.messageIndex === state.currentIndex + 1
      );
      if (hasAnnotation) {
        this.pause();
        return;
      }
    }

    // Skip errors if configured
    if (this.playbackOptions.skipErrors && nextEvent.type === 'message') {
      const nextMessage = nextEvent.data as any;
      if (nextMessage.messageType === 'error') {
        this.stateManager.setCurrentIndex(state.currentIndex + 1);
        this.advancePlayback(); // Recursively skip to next non-error
        return;
      }
    }

    // Calculate time-based advancement
    if (this.playbackOptions.autoAdvance) {
      const timeDiff = nextEvent.timestamp.getTime() - currentEvent.timestamp.getTime();
      const scaledTimeDiff = timeDiff / this.playbackOptions.speed;
      const elapsed = Date.now() - this.lastPlaybackUpdate.getTime();
      
      if (elapsed >= scaledTimeDiff) {
        this.stateManager.stepForward();
        this.lastPlaybackUpdate = new Date();
      }
    } else {
      // Manual advancement (fixed interval)
      this.stateManager.stepForward();
    }
  }

  // Cleanup
  dispose(): void {
    this.stopPlaybackTimer();
  }

  // Utility methods
  getTimeRemaining(): number {
    const state = this.stateManager.getState();
    if (state.timeline.length === 0) return 0;
    
    const duration = this.stateManager.getDuration();
    const currentTime = this.stateManager.getCurrentTime();
    
    return Math.max(0, duration - currentTime);
  }

  getEstimatedTimeToEnd(): number {
    const timeRemaining = this.getTimeRemaining();
    return timeRemaining / this.playbackOptions.speed;
  }

  canStepForward(): boolean {
    const state = this.stateManager.getState();
    return state.currentIndex < state.totalEvents - 1;
  }

  canStepBackward(): boolean {
    const state = this.stateManager.getState();
    return state.currentIndex > 0;
  }

  isAtStart(): boolean {
    const state = this.stateManager.getState();
    return state.currentIndex === 0;
  }

  isAtEnd(): boolean {
    const state = this.stateManager.getState();
    return state.currentIndex === state.totalEvents - 1;
  }
}