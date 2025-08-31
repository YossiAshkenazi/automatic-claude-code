import { DualAgentSession, AgentMessage } from '../types';

// Connect directly to observability server for cross-project event streaming
const API_BASE = 'http://localhost:4001/api';

interface ApiError {
  message: string;
  status: number;
  code?: string;
}

interface SessionExportOptions {
  format: 'json' | 'csv' | 'html';
  includeMetadata?: boolean;
  dateRange?: { start: Date; end: Date };
  agentFilter?: 'manager' | 'worker' | 'both';
}

interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: 'startTime' | 'lastActivity' | 'messageCount';
  sortOrder?: 'asc' | 'desc';
}

interface SessionFilters {
  status?: string[];
  dateRange?: { start: Date; end: Date };
  searchTerm?: string;
  hasMessages?: boolean;
}

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
        ...options,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `API error: ${response.status} ${response.statusText}`;
        
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // Use default error message if JSON parsing fails
        }
        
        const apiError: ApiError = {
          message: errorMessage,
          status: response.status,
          code: response.status.toString()
        };
        
        throw apiError;
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error - please check your connection');
      }
      
      throw error;
    }
  }

  async getSessions(params?: PaginationParams & { filters?: SessionFilters }): Promise<{
    sessions: DualAgentSession[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params?.page) queryParams.set('page', params.page.toString());
      if (params?.limit) queryParams.set('limit', params.limit.toString());
      if (params?.sortBy) queryParams.set('sortBy', params.sortBy);
      if (params?.sortOrder) queryParams.set('sortOrder', params.sortOrder);
      
      // Handle filters
      if (params?.filters) {
        if (params.filters.status?.length) {
          queryParams.set('status', params.filters.status.join(','));
        }
        if (params.filters.searchTerm) {
          queryParams.set('search', params.filters.searchTerm);
        }
        if (params.filters.hasMessages !== undefined) {
          queryParams.set('hasMessages', params.filters.hasMessages.toString());
        }
        if (params.filters.dateRange) {
          queryParams.set('startDate', params.filters.dateRange.start.toISOString());
          queryParams.set('endDate', params.filters.dateRange.end.toISOString());
        }
      }
      
      const endpoint = queryParams.toString() ? `/sessions?${queryParams}` : '/sessions';
      const result = await this.request<{
        sessions: DualAgentSession[];
        total: number;
        page: number;
        limit: number;
      }>(endpoint);
      
      return {
        ...result,
        hasMore: (result.page * result.limit) < result.total
      };
    } catch (error) {
      console.error('Failed to get sessions:', error);
      throw error;
    }
  }

  async getActiveSessions(): Promise<DualAgentSession[]> {
    return this.request<DualAgentSession[]>('/sessions/active');
  }

  async getSession(id: string, includeMessages: boolean = true): Promise<DualAgentSession> {
    if (!id?.trim()) {
      throw new Error('Session ID is required');
    }
    
    const endpoint = includeMessages ? `/sessions/${id}` : `/sessions/${id}?includeMessages=false`;
    
    try {
      return await this.request<DualAgentSession>(endpoint);
    } catch (error) {
      console.error(`Failed to get session ${id}:`, error);
      throw error;
    }
  }

  async createSession(initialTask: string, workDir?: string): Promise<DualAgentSession> {
    if (!initialTask?.trim()) {
      throw new Error('Initial task is required');
    }
    
    try {
      return await this.request<DualAgentSession>('/sessions', {
        method: 'POST',
        body: JSON.stringify({ initialTask, workDir }),
      });
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  }

  async updateSessionStatus(id: string, status: DualAgentSession['status']): Promise<void> {
    if (!id?.trim()) {
      throw new Error('Session ID is required');
    }
    
    const validStatuses = ['running', 'paused', 'completed', 'error'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }
    
    try {
      await this.request(`/sessions/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    } catch (error) {
      console.error(`Failed to update session ${id} status:`, error);
      throw error;
    }
  }

  async deleteSession(id: string): Promise<void> {
    if (!id?.trim()) {
      throw new Error('Session ID is required');
    }
    
    try {
      await this.request(`/sessions/${id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error(`Failed to delete session ${id}:`, error);
      throw error;
    }
  }

  async addMessage(sessionId: string, message: {
    agentType: 'manager' | 'worker';
    messageType: 'prompt' | 'response' | 'tool_call' | 'tool_use' | 'tool_result' | 'error' | 'system';
    content: string;
    metadata?: AgentMessage['metadata'];
  }): Promise<AgentMessage> {
    if (!sessionId?.trim()) {
      throw new Error('Session ID is required');
    }
    
    if (!message.content?.trim()) {
      throw new Error('Message content is required');
    }
    
    try {
      return await this.request<AgentMessage>(`/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: JSON.stringify(message),
      });
    } catch (error) {
      console.error(`Failed to add message to session ${sessionId}:`, error);
      throw error;
    }
  }

  // Cross-project event streaming methods
  async getAllEvents(limit?: number): Promise<any[]> {
    const endpoint = limit ? `/events?limit=${limit}` : '/events';
    return this.request<any[]>(endpoint);
  }

  async getEventsByProject(sourceApp: string, limit?: number): Promise<any[]> {
    const endpoint = limit ? 
      `/events?source_app=${sourceApp}&limit=${limit}` : 
      `/events?source_app=${sourceApp}`;
    return this.request<any[]>(endpoint);
  }

  async getRecentEvents(minutes: number = 60): Promise<any[]> {
    return this.request<any[]>(`/events/recent?minutes=${minutes}`);
  }

  async getActiveProjects(): Promise<string[]> {
    return this.request<string[]>('/projects');
  }

  // Session export with enhanced options
  async exportSession(sessionId: string, options: SessionExportOptions = { format: 'json' }): Promise<void> {
    if (!sessionId?.trim()) {
      throw new Error('Session ID is required');
    }
    
    try {
      const session = await this.getSession(sessionId);
      
      let filteredMessages = session.messages || [];
      
      // Apply date range filter
      if (options.dateRange) {
        filteredMessages = filteredMessages.filter(msg => {
          const msgDate = new Date(msg.timestamp);
          return msgDate >= options.dateRange!.start && msgDate <= options.dateRange!.end;
        });
      }
      
      // Apply agent filter
      if (options.agentFilter && options.agentFilter !== 'both') {
        filteredMessages = filteredMessages.filter(msg => msg.agentType === options.agentFilter);
      }
      
      const exportData = {
        ...session,
        messages: filteredMessages,
        exportMetadata: options.includeMetadata ? {
          exportedAt: new Date().toISOString(),
          totalOriginalMessages: session.messages.length,
          filteredMessages: filteredMessages.length,
          filters: options
        } : undefined
      };
      
      await this.downloadFile(exportData, sessionId, options.format);
    } catch (error) {
      console.error(`Failed to export session ${sessionId}:`, error);
      throw error;
    }
  }
  
  private async downloadFile(data: any, sessionId: string, format: 'json' | 'csv' | 'html'): Promise<void> {
    const timestamp = new Date().toISOString().split('T')[0];
    
    switch (format) {
      case 'json': {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        this.triggerDownload(blob, `session-${sessionId}-${timestamp}.json`);
        break;
      }
      
      case 'csv': {
        const messages = data.messages || [];
        const csvData = messages.map((msg: AgentMessage) => ({
          timestamp: msg.timestamp,
          agentType: msg.agentType,
          messageType: msg.messageType,
          content: typeof msg.content === 'string' ? msg.content.replace(/["\n\r]/g, ' ') : JSON.stringify(msg.content),
          tools: msg.metadata?.tools?.join(';') || '',
          duration: msg.metadata?.duration || '',
          cost: msg.metadata?.cost || ''
        }));
        
        if (csvData.length === 0) {
          throw new Error('No messages to export');
        }
        
        const headers = Object.keys(csvData[0]);
        const csvContent = [
          headers.join(','),
          ...csvData.map(row => headers.map(header => `"${row[header as keyof typeof row] || ''}"`).join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        this.triggerDownload(blob, `session-${sessionId}-messages-${timestamp}.csv`);
        break;
      }
      
      case 'html': {
        const html = this.generateHtmlReport(data);
        const blob = new Blob([html], { type: 'text/html' });
        this.triggerDownload(blob, `session-${sessionId}-report-${timestamp}.html`);
        break;
      }
    }
  }
  
  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  
  private generateHtmlReport(session: DualAgentSession): string {
    const messages = session.messages || [];
    const managerMessages = messages.filter(m => m.agentType === 'manager');
    const workerMessages = messages.filter(m => m.agentType === 'worker');
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Session Report - ${session.id}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { border-bottom: 2px solid #ccc; padding-bottom: 20px; margin-bottom: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .message { margin-bottom: 15px; padding: 10px; border-left: 4px solid #ddd; }
        .manager { border-left-color: #007bff; }
        .worker { border-left-color: #28a745; }
        .timestamp { color: #666; font-size: 0.9em; }
        .metadata { font-size: 0.8em; color: #888; margin-top: 5px; }
        .content { margin: 8px 0; white-space: pre-wrap; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Dual-Agent Session Report</h1>
        <p><strong>Session ID:</strong> ${session.id}</p>
        <p><strong>Task:</strong> ${session.initialTask}</p>
        <p><strong>Status:</strong> ${session.status}</p>
        <p><strong>Started:</strong> ${new Date(session.startTime).toLocaleString()}</p>
        <p><strong>Work Directory:</strong> ${session.workDir}</p>
    </div>
    
    <div class="summary">
        <h3>Summary</h3>
        <p><strong>Total Messages:</strong> ${messages.length}</p>
        <p><strong>Manager Messages:</strong> ${managerMessages.length}</p>
        <p><strong>Worker Messages:</strong> ${workerMessages.length}</p>
    </div>
    
    <div class="messages">
        <h3>Messages</h3>
        ${messages.map(msg => `
            <div class="message ${msg.agentType}">
                <div class="timestamp">${new Date(msg.timestamp).toLocaleString()} - ${msg.agentType.toUpperCase()} (${msg.messageType})</div>
                <div class="content">${this.escapeHtml(msg.content)}</div>
                ${msg.metadata ? `<div class="metadata">Tools: ${msg.metadata.tools?.join(', ') || 'none'} | Duration: ${msg.metadata.duration || 'N/A'}ms</div>` : ''}
            </div>
        `).join('')}
    </div>
</body>
</html>`;
  }
  
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Replay API methods
  async prepareSessionForReplay(sessionId: string, options: any = {}): Promise<{
    replayId: string;
    state: any;
    metadata: any;
  }> {
    return this.request(`/replay/sessions/${sessionId}/prepare`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async closeReplay(replayId: string): Promise<void> {
    await this.request(`/replay/${replayId}`, {
      method: 'DELETE',
    });
  }

  async playReplay(replayId: string, options: any = {}): Promise<void> {
    await this.request(`/replay/${replayId}/play`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async pauseReplay(replayId: string): Promise<void> {
    await this.request(`/replay/${replayId}/pause`, {
      method: 'POST',
    });
  }

  async stopReplay(replayId: string): Promise<void> {
    await this.request(`/replay/${replayId}/stop`, {
      method: 'POST',
    });
  }

  async stepReplay(replayId: string, direction: 'forward' | 'backward', options: any = {}): Promise<void> {
    await this.request(`/replay/${replayId}/step`, {
      method: 'POST',
      body: JSON.stringify({ direction, options }),
    });
  }

  async seekReplay(replayId: string, position: number): Promise<void> {
    await this.request(`/replay/${replayId}/seek`, {
      method: 'POST',
      body: JSON.stringify({ position }),
    });
  }

  async setReplaySpeed(replayId: string, speed: number): Promise<void> {
    await this.request(`/replay/${replayId}/speed`, {
      method: 'POST',
      body: JSON.stringify({ speed }),
    });
  }

  async jumpToReplay(replayId: string, type: string, value: any): Promise<void> {
    await this.request(`/replay/${replayId}/jump`, {
      method: 'POST',
      body: JSON.stringify({ type, value }),
    });
  }

  async addReplayBookmark(replayId: string, bookmark: {
    timestamp: Date;
    messageIndex: number;
    title: string;
    description?: string;
    tags: string[];
    createdBy: string;
  }): Promise<any> {
    return this.request(`/replay/${replayId}/bookmarks`, {
      method: 'POST',
      body: JSON.stringify(bookmark),
    });
  }

  async updateReplayBookmark(replayId: string, bookmarkId: string, updates: any): Promise<void> {
    await this.request(`/replay/${replayId}/bookmarks/${bookmarkId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async removeReplayBookmark(replayId: string, bookmarkId: string): Promise<void> {
    await this.request(`/replay/${replayId}/bookmarks/${bookmarkId}`, {
      method: 'DELETE',
    });
  }

  async addReplayAnnotation(replayId: string, annotation: {
    timestamp: Date;
    messageIndex: number;
    content: string;
    author: string;
  }): Promise<any> {
    return this.request(`/replay/${replayId}/annotations`, {
      method: 'POST',
      body: JSON.stringify(annotation),
    });
  }

  async updateReplayAnnotation(replayId: string, annotationId: string, updates: any): Promise<void> {
    await this.request(`/replay/${replayId}/annotations/${annotationId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async removeReplayAnnotation(replayId: string, annotationId: string): Promise<void> {
    await this.request(`/replay/${replayId}/annotations/${annotationId}`, {
      method: 'DELETE',
    });
  }

  async addReplaySegment(replayId: string, segment: {
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    startIndex: number;
    endIndex: number;
    tags: string[];
    highlightColor?: string;
    createdBy: string;
  }): Promise<any> {
    return this.request(`/replay/${replayId}/segments`, {
      method: 'POST',
      body: JSON.stringify(segment),
    });
  }

  async exportReplayData(replayId: string, options: {
    format: 'json' | 'csv' | 'markdown';
    includeBookmarks: boolean;
    includeAnnotations: boolean;
    includeSegments: boolean;
    timeRange?: { start: Date; end: Date };
    eventTypes?: string[];
  }): Promise<any> {
    return this.request(`/replay/${replayId}/export`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async exportReplaySegment(replayId: string, segmentId: string, format: 'json' | 'csv' | 'markdown' = 'json'): Promise<any> {
    return this.request(`/replay/${replayId}/segments/${segmentId}/export`, {
      method: 'POST',
      body: JSON.stringify({ format }),
    });
  }

  async compareReplaySessions(sessionIds: string[]): Promise<any> {
    return this.request('/replay/compare', {
      method: 'POST',
      body: JSON.stringify({ sessionIds }),
    });
  }

  async getReplayCollaborators(replayId: string): Promise<{
    collaborators: string[];
    isCollaborative: boolean;
  }> {
    return this.request(`/replay/${replayId}/collaborators`);
  }

  async enableReplayCollaboration(replayId: string, collaborators: string[]): Promise<void> {
    await this.request(`/replay/${replayId}/collaborators`, {
      method: 'POST',
      body: JSON.stringify({ collaborators }),
    });
  }

  async addReplayCollaborator(replayId: string, collaboratorId: string): Promise<void> {
    await this.request(`/replay/${replayId}/collaborators/${collaboratorId}`, {
      method: 'POST',
    });
  }

  async getReplayStatus(): Promise<{
    activeSessionsCount: number;
    activeSessionIds: string[];
  }> {
    return this.request('/replay/status');
  }
}

export const apiClient = new ApiClient();