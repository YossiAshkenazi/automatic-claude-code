import { 
  AgentMessage, 
  DualAgentSession, 
  AgentCommunication, 
  SystemEvent, 
  PerformanceMetrics 
} from '../types';
import { 
  ReplayTimelineEvent, 
  ReplayBookmark, 
  ReplayAnnotation, 
  ReplaySegment, 
  ReplayMetadata 
} from './ReplayState';
import { v4 as uuidv4 } from 'uuid';

export interface ProcessingOptions {
  includeMetrics?: boolean;
  includeCommunications?: boolean;
  includeSystemEvents?: boolean;
  filterMessageTypes?: Array<'prompt' | 'response' | 'tool_call' | 'error' | 'system'>;
  filterAgentTypes?: Array<'manager' | 'worker'>;
  minimumEventSpacing?: number; // Minimum milliseconds between events
  maxEvents?: number;
}

export interface SessionAnalysis {
  totalEvents: number;
  messageBreakdown: {
    manager: { prompts: number; responses: number; tools: number; errors: number; };
    worker: { prompts: number; responses: number; tools: number; errors: number; };
  };
  communicationPatterns: Array<{
    fromAgent: 'manager' | 'worker';
    toAgent: 'manager' | 'worker';
    count: number;
    avgResponseTime: number;
  }>;
  performanceMetrics: {
    avgResponseTime: number;
    totalCost: number;
    errorRate: number;
    peakActivity: { timestamp: Date; eventsPerMinute: number; };
  };
  keyMoments: Array<{
    timestamp: Date;
    description: string;
    importance: 'low' | 'medium' | 'high';
    eventIndex: number;
  }>;
  workflowPhases: Array<{
    name: string;
    startTime: Date;
    endTime: Date;
    startIndex: number;
    endIndex: number;
    dominantAgent: 'manager' | 'worker';
  }>;
}

export class TimelineProcessor {
  private session: DualAgentSession;
  private messages: AgentMessage[];
  private communications: AgentCommunication[];
  private events: SystemEvent[];
  private metrics: PerformanceMetrics[];

  constructor(
    session: DualAgentSession,
    communications: AgentCommunication[] = [],
    events: SystemEvent[] = [],
    metrics: PerformanceMetrics[] = []
  ) {
    this.session = session;
    this.messages = session.messages || [];
    this.communications = communications;
    this.events = events;
    this.metrics = metrics;
  }

  // Core processing method
  processTimeline(options: ProcessingOptions = {}): ReplayTimelineEvent[] {
    const events: ReplayTimelineEvent[] = [];
    let eventIndex = 0;

    // Process messages
    const filteredMessages = this.filterMessages(options);
    filteredMessages.forEach((message) => {
      events.push({
        id: message.id,
        timestamp: message.timestamp,
        type: 'message',
        data: message,
        index: eventIndex++
      });
    });

    // Process communications
    if (options.includeCommunications !== false) {
      this.communications.forEach((communication) => {
        events.push({
          id: communication.id,
          timestamp: communication.timestamp,
          type: 'communication',
          data: communication,
          index: eventIndex++
        });
      });
    }

    // Process system events
    if (options.includeSystemEvents !== false) {
      this.events.forEach((event) => {
        events.push({
          id: event.id,
          timestamp: event.timestamp,
          type: 'system_event',
          data: event,
          index: eventIndex++
        });
      });
    }

    // Process performance metrics
    if (options.includeMetrics) {
      this.metrics.forEach((metric) => {
        events.push({
          id: uuidv4(),
          timestamp: metric.timestamp,
          type: 'performance_metric',
          data: metric,
          index: eventIndex++
        });
      });
    }

    // Sort by timestamp
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Re-index after sorting
    events.forEach((event, index) => {
      event.index = index;
    });

    // Apply event spacing filter if specified
    if (options.minimumEventSpacing && options.minimumEventSpacing > 0) {
      return this.applyEventSpacing(events, options.minimumEventSpacing);
    }

    // Apply maximum events limit if specified
    if (options.maxEvents && events.length > options.maxEvents) {
      return this.applyEventLimit(events, options.maxEvents);
    }

    return events;
  }

  // Session analysis
  analyzeSession(): SessionAnalysis {
    const messageBreakdown = this.analyzeMessageBreakdown();
    const communicationPatterns = this.analyzeCommunicationPatterns();
    const performanceMetrics = this.analyzePerformanceMetrics();
    const keyMoments = this.identifyKeyMoments();
    const workflowPhases = this.identifyWorkflowPhases();

    return {
      totalEvents: this.messages.length + this.communications.length + this.events.length,
      messageBreakdown,
      communicationPatterns,
      performanceMetrics,
      keyMoments,
      workflowPhases
    };
  }

  // Generate suggested bookmarks based on analysis
  generateBookmarks(): ReplayBookmark[] {
    const bookmarks: ReplayBookmark[] = [];
    const timeline = this.processTimeline();
    const analysis = this.analyzeSession();

    // Add workflow phase bookmarks
    analysis.workflowPhases.forEach((phase, index) => {
      bookmarks.push({
        id: uuidv4(),
        sessionId: this.session.id,
        timestamp: phase.startTime,
        messageIndex: phase.startIndex,
        title: `Phase ${index + 1}: ${phase.name}`,
        description: `${phase.dominantAgent} agent dominant phase`,
        tags: ['workflow', 'phase', phase.dominantAgent],
        createdAt: new Date(),
        createdBy: 'system'
      });
    });

    // Add key moment bookmarks
    analysis.keyMoments
      .filter(moment => moment.importance === 'high')
      .forEach((moment) => {
        bookmarks.push({
          id: uuidv4(),
          sessionId: this.session.id,
          timestamp: moment.timestamp,
          messageIndex: moment.eventIndex,
          title: moment.description,
          description: `Automatically identified key moment`,
          tags: ['key-moment', 'high-importance'],
          createdAt: new Date(),
          createdBy: 'system'
        });
      });

    // Add error bookmarks
    timeline
      .filter(event => {
        return event.type === 'message' && 
               (event.data as AgentMessage).messageType === 'error';
      })
      .forEach((errorEvent) => {
        const message = errorEvent.data as AgentMessage;
        bookmarks.push({
          id: uuidv4(),
          sessionId: this.session.id,
          timestamp: errorEvent.timestamp,
          messageIndex: errorEvent.index,
          title: `Error: ${message.agentType} agent`,
          description: message.content.substring(0, 100) + '...',
          tags: ['error', message.agentType],
          createdAt: new Date(),
          createdBy: 'system'
        });
      });

    // Add performance spike bookmarks
    const performanceSpikes = this.identifyPerformanceSpikes();
    performanceSpikes.forEach((spike) => {
      bookmarks.push({
        id: uuidv4(),
        sessionId: this.session.id,
        timestamp: spike.timestamp,
        messageIndex: spike.eventIndex,
        title: `Performance Spike`,
        description: `High activity: ${spike.eventsPerMinute} events/min`,
        tags: ['performance', 'spike'],
        createdAt: new Date(),
        createdBy: 'system'
      });
    });

    return bookmarks.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  // Generate suggested segments
  generateSegments(): ReplaySegment[] {
    const segments: ReplaySegment[] = [];
    const analysis = this.analyzeSession();
    const timeline = this.processTimeline();

    // Create segments based on workflow phases
    analysis.workflowPhases.forEach((phase, index) => {
      segments.push({
        id: uuidv4(),
        sessionId: this.session.id,
        title: `Phase ${index + 1}: ${phase.name}`,
        description: `${phase.dominantAgent} agent dominant workflow phase`,
        startTime: phase.startTime,
        endTime: phase.endTime,
        startIndex: phase.startIndex,
        endIndex: phase.endIndex,
        tags: ['workflow', phase.dominantAgent],
        highlightColor: phase.dominantAgent === 'manager' ? '#8B5CF6' : '#3B82F6',
        createdAt: new Date(),
        createdBy: 'system'
      });
    });

    // Create segments for error recovery periods
    const errorEvents = timeline.filter(event => 
      event.type === 'message' && 
      (event.data as AgentMessage).messageType === 'error'
    );

    errorEvents.forEach((errorEvent) => {
      const recoveryEndIndex = this.findErrorRecoveryEnd(timeline, errorEvent.index);
      if (recoveryEndIndex > errorEvent.index) {
        segments.push({
          id: uuidv4(),
          sessionId: this.session.id,
          title: 'Error Recovery',
          description: 'System recovering from error condition',
          startTime: errorEvent.timestamp,
          endTime: timeline[recoveryEndIndex].timestamp,
          startIndex: errorEvent.index,
          endIndex: recoveryEndIndex,
          tags: ['error', 'recovery'],
          highlightColor: '#EF4444',
          createdAt: new Date(),
          createdBy: 'system'
        });
      }
    });

    return segments.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  // Generate replay metadata
  generateMetadata(): ReplayMetadata {
    const timeline = this.processTimeline();
    const analysis = this.analyzeSession();
    
    return {
      sessionId: this.session.id,
      title: `Session: ${this.session.initialTask}`,
      description: `Dual-agent session with ${analysis.totalEvents} events`,
      duration: this.session.endTime 
        ? this.session.endTime.getTime() - this.session.startTime.getTime()
        : Date.now() - this.session.startTime.getTime(),
      totalEvents: timeline.length,
      startTime: this.session.startTime,
      endTime: this.session.endTime || new Date(),
      keyMoments: analysis.keyMoments,
      tags: [
        'dual-agent',
        this.session.status,
        ...this.extractTopicTags()
      ],
      createdAt: new Date(),
      lastModified: new Date()
    };
  }

  // Export session data for replay
  exportForReplay(): {
    session: DualAgentSession;
    timeline: ReplayTimelineEvent[];
    bookmarks: ReplayBookmark[];
    segments: ReplaySegment[];
    metadata: ReplayMetadata;
    analysis: SessionAnalysis;
  } {
    return {
      session: this.session,
      timeline: this.processTimeline(),
      bookmarks: this.generateBookmarks(),
      segments: this.generateSegments(),
      metadata: this.generateMetadata(),
      analysis: this.analyzeSession()
    };
  }

  // Private helper methods
  private filterMessages(options: ProcessingOptions): AgentMessage[] {
    let filtered = [...this.messages];

    if (options.filterMessageTypes) {
      filtered = filtered.filter(msg => 
        options.filterMessageTypes!.includes(msg.messageType)
      );
    }

    if (options.filterAgentTypes) {
      filtered = filtered.filter(msg => 
        options.filterAgentTypes!.includes(msg.agentType)
      );
    }

    return filtered;
  }

  private applyEventSpacing(events: ReplayTimelineEvent[], spacing: number): ReplayTimelineEvent[] {
    if (events.length === 0) return events;

    const spaced: ReplayTimelineEvent[] = [events[0]];
    let lastTimestamp = events[0].timestamp.getTime();

    for (let i = 1; i < events.length; i++) {
      const event = events[i];
      if (event.timestamp.getTime() - lastTimestamp >= spacing) {
        spaced.push(event);
        lastTimestamp = event.timestamp.getTime();
      }
    }

    return spaced;
  }

  private applyEventLimit(events: ReplayTimelineEvent[], limit: number): ReplayTimelineEvent[] {
    if (events.length <= limit) return events;

    // Distribute events evenly across the timeline
    const step = events.length / limit;
    const limited: ReplayTimelineEvent[] = [];

    for (let i = 0; i < limit; i++) {
      const index = Math.round(i * step);
      limited.push(events[Math.min(index, events.length - 1)]);
    }

    return limited;
  }

  private analyzeMessageBreakdown() {
    const breakdown = {
      manager: { prompts: 0, responses: 0, tools: 0, errors: 0 },
      worker: { prompts: 0, responses: 0, tools: 0, errors: 0 }
    };

    this.messages.forEach(message => {
      const agent = breakdown[message.agentType];
      switch (message.messageType) {
        case 'prompt':
          agent.prompts++;
          break;
        case 'response':
          agent.responses++;
          break;
        case 'tool_call':
          agent.tools++;
          break;
        case 'error':
          agent.errors++;
          break;
      }
    });

    return breakdown;
  }

  private analyzeCommunicationPatterns() {
    const patterns = new Map<string, {
      count: number;
      totalResponseTime: number;
      responses: number;
    }>();

    this.communications.forEach(comm => {
      const key = `${comm.fromAgent}->${comm.toAgent}`;
      const pattern = patterns.get(key) || { count: 0, totalResponseTime: 0, responses: 0 };
      
      pattern.count++;
      patterns.set(key, pattern);

      // Calculate response time if this is a response to a previous communication
      const relatedComm = this.communications.find(c => 
        c.id === comm.relatedMessageId && 
        c.fromAgent === comm.toAgent && 
        c.toAgent === comm.fromAgent
      );

      if (relatedComm) {
        const responseTime = comm.timestamp.getTime() - relatedComm.timestamp.getTime();
        pattern.totalResponseTime += responseTime;
        pattern.responses++;
      }
    });

    return Array.from(patterns.entries()).map(([key, data]) => {
      const [from, to] = key.split('->') as ['manager' | 'worker', 'manager' | 'worker'];
      return {
        fromAgent: from,
        toAgent: to,
        count: data.count,
        avgResponseTime: data.responses > 0 ? data.totalResponseTime / data.responses : 0
      };
    });
  }

  private analyzePerformanceMetrics() {
    const totalResponseTime = this.metrics.reduce((sum, m) => sum + m.responseTime, 0);
    const totalCost = this.metrics.reduce((sum, m) => sum + (m.cost || 0), 0);
    const totalErrors = this.messages.filter(m => m.messageType === 'error').length;

    // Find peak activity period
    const peakActivity = this.findPeakActivityPeriod();

    return {
      avgResponseTime: this.metrics.length > 0 ? totalResponseTime / this.metrics.length : 0,
      totalCost,
      errorRate: this.messages.length > 0 ? totalErrors / this.messages.length : 0,
      peakActivity
    };
  }

  private identifyKeyMoments() {
    const moments: Array<{
      timestamp: Date;
      description: string;
      importance: 'low' | 'medium' | 'high';
      eventIndex: number;
    }> = [];

    // Find first message
    if (this.messages.length > 0) {
      moments.push({
        timestamp: this.messages[0].timestamp,
        description: 'Session started',
        importance: 'high',
        eventIndex: 0
      });
    }

    // Find agent switches
    for (let i = 1; i < this.messages.length; i++) {
      if (this.messages[i].agentType !== this.messages[i - 1].agentType) {
        moments.push({
          timestamp: this.messages[i].timestamp,
          description: `Agent switch: ${this.messages[i - 1].agentType} → ${this.messages[i].agentType}`,
          importance: 'medium',
          eventIndex: i
        });
      }
    }

    // Find first errors
    const firstError = this.messages.find(m => m.messageType === 'error');
    if (firstError) {
      const index = this.messages.indexOf(firstError);
      moments.push({
        timestamp: firstError.timestamp,
        description: `First error encountered`,
        importance: 'high',
        eventIndex: index
      });
    }

    // Find completion
    if (this.session.endTime) {
      moments.push({
        timestamp: this.session.endTime,
        description: 'Session completed',
        importance: 'high',
        eventIndex: this.messages.length - 1
      });
    }

    return moments.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private identifyWorkflowPhases() {
    const phases: Array<{
      name: string;
      startTime: Date;
      endTime: Date;
      startIndex: number;
      endIndex: number;
      dominantAgent: 'manager' | 'worker';
    }> = [];

    if (this.messages.length === 0) return phases;

    let currentPhase = {
      agent: this.messages[0].agentType,
      startTime: this.messages[0].timestamp,
      startIndex: 0,
      messageCount: 1
    };

    for (let i = 1; i < this.messages.length; i++) {
      const message = this.messages[i];
      
      if (message.agentType === currentPhase.agent) {
        currentPhase.messageCount++;
      } else {
        // End current phase
        phases.push({
          name: `${currentPhase.agent} phase`,
          startTime: currentPhase.startTime,
          endTime: this.messages[i - 1].timestamp,
          startIndex: currentPhase.startIndex,
          endIndex: i - 1,
          dominantAgent: currentPhase.agent
        });

        // Start new phase
        currentPhase = {
          agent: message.agentType,
          startTime: message.timestamp,
          startIndex: i,
          messageCount: 1
        };
      }
    }

    // Add final phase
    phases.push({
      name: `${currentPhase.agent} phase`,
      startTime: currentPhase.startTime,
      endTime: this.messages[this.messages.length - 1].timestamp,
      startIndex: currentPhase.startIndex,
      endIndex: this.messages.length - 1,
      dominantAgent: currentPhase.agent
    });

    return phases;
  }

  private findPeakActivityPeriod() {
    if (this.messages.length === 0) {
      return { timestamp: new Date(), eventsPerMinute: 0 };
    }

    const windowSize = 60000; // 1 minute window
    let maxActivity = 0;
    let peakTimestamp = this.messages[0].timestamp;

    for (let i = 0; i < this.messages.length; i++) {
      const windowStart = this.messages[i].timestamp.getTime();
      const windowEnd = windowStart + windowSize;
      
      let activityCount = 0;
      for (let j = i; j < this.messages.length; j++) {
        if (this.messages[j].timestamp.getTime() <= windowEnd) {
          activityCount++;
        } else {
          break;
        }
      }

      if (activityCount > maxActivity) {
        maxActivity = activityCount;
        peakTimestamp = this.messages[i].timestamp;
      }
    }

    return {
      timestamp: peakTimestamp,
      eventsPerMinute: maxActivity
    };
  }

  private identifyPerformanceSpikes() {
    const spikes: Array<{
      timestamp: Date;
      eventsPerMinute: number;
      eventIndex: number;
    }> = [];

    const timeline = this.processTimeline();
    const windowSize = 60000; // 1 minute
    const spikeThreshold = 10; // events per minute

    for (let i = 0; i < timeline.length; i++) {
      const windowStart = timeline[i].timestamp.getTime();
      const windowEnd = windowStart + windowSize;
      
      let eventsInWindow = 0;
      for (let j = i; j < timeline.length; j++) {
        if (timeline[j].timestamp.getTime() <= windowEnd) {
          eventsInWindow++;
        } else {
          break;
        }
      }

      if (eventsInWindow >= spikeThreshold) {
        spikes.push({
          timestamp: timeline[i].timestamp,
          eventsPerMinute: eventsInWindow,
          eventIndex: i
        });
        
        // Skip ahead to avoid duplicate spikes
        i += Math.floor(eventsInWindow / 2);
      }
    }

    return spikes;
  }

  private findErrorRecoveryEnd(timeline: ReplayTimelineEvent[], errorIndex: number): number {
    // Look for successful operations after the error
    for (let i = errorIndex + 1; i < timeline.length; i++) {
      const event = timeline[i];
      if (event.type === 'message') {
        const message = event.data as AgentMessage;
        if (message.messageType === 'response' && !message.content.toLowerCase().includes('error')) {
          return i;
        }
      }
    }
    
    return Math.min(errorIndex + 5, timeline.length - 1); // Default to 5 events later
  }

  private extractTopicTags(): string[] {
    const content = this.messages.map(m => m.content.toLowerCase()).join(' ');
    const commonTerms = [
      'authentication', 'database', 'api', 'frontend', 'backend',
      'testing', 'deployment', 'configuration', 'debugging', 'optimization'
    ];
    
    return commonTerms.filter(term => content.includes(term));
  }
}