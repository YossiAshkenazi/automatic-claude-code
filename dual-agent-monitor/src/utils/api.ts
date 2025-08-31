import { DualAgentSession, AgentMessage } from '../types';

// Connect directly to observability server for cross-project event streaming
const API_BASE = 'http://localhost:8080/api';

interface ApiError {
  message: string;
  status: number;
  code?: string;
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

  async getSessions(): Promise<DualAgentSession[]> {
    try {
      return await this.request<DualAgentSession[]>('/sessions');
    } catch (error) {
      console.error('Failed to get sessions:', error);
      throw error;
    }
  }

  async getActiveSessions(): Promise<DualAgentSession[]> {
    return this.request<DualAgentSession[]>('/sessions/active');
  }

  async getSession(id: string): Promise<DualAgentSession> {
    return this.request<DualAgentSession>(`/sessions/${id}`);
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
    messageType: 'prompt' | 'response' | 'tool_call' | 'error' | 'system';
    content: string;
    metadata?: AgentMessage['metadata'];
  }): Promise<AgentMessage> {
    return this.request<AgentMessage>(`/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify(message),
    });
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
}

export const apiClient = new ApiClient();