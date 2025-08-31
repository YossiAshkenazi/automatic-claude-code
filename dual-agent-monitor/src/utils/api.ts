import { DualAgentSession, AgentMessage } from '../types';

const API_BASE = '/api';

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getSessions(): Promise<DualAgentSession[]> {
    return this.request<DualAgentSession[]>('/sessions');
  }

  async getActiveSessions(): Promise<DualAgentSession[]> {
    return this.request<DualAgentSession[]>('/sessions/active');
  }

  async getSession(id: string): Promise<DualAgentSession> {
    return this.request<DualAgentSession>(`/sessions/${id}`);
  }

  async createSession(initialTask: string, workDir?: string): Promise<DualAgentSession> {
    return this.request<DualAgentSession>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ initialTask, workDir }),
    });
  }

  async updateSessionStatus(id: string, status: DualAgentSession['status']): Promise<void> {
    await this.request(`/sessions/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async deleteSession(id: string): Promise<void> {
    await this.request(`/sessions/${id}`, {
      method: 'DELETE',
    });
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
}

export const apiClient = new ApiClient();