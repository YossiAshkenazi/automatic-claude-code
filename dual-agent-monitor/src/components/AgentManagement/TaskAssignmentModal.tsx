import React, { useState } from 'react';
import { X, Send, Loader2, User, FileText, Tag } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';
import type { Agent, AgentTask } from '../../types/agent';

interface TaskAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: Agent[];
  onAssignTask: (agentId: string, task: Omit<AgentTask, 'id' | 'assignedTo' | 'createdAt' | 'status'>) => Promise<AgentTask | null>;
  className?: string;
}

interface TaskFormData {
  title: string;
  description: string;
  selectedAgentId: string;
  priority: 'low' | 'medium' | 'high';
  tags: string[];
}

const priorityColors = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700'
};

const tagInput = React.createRef<HTMLInputElement>();

export function TaskAssignmentModal({
  isOpen,
  onClose,
  agents,
  onAssignTask,
  className
}: TaskAssignmentModalProps) {
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    selectedAgentId: '',
    priority: 'medium',
    tags: []
  });
  const [newTag, setNewTag] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const availableAgents = agents.filter(a => a.status !== 'error' && a.status !== 'stopped');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.title.trim()) {
      setError('Task title is required');
      return;
    }

    if (!formData.selectedAgentId) {
      setError('Please select an agent for this task');
      return;
    }

    if (!formData.description.trim()) {
      setError('Task description is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const task = await onAssignTask(formData.selectedAgentId, {
        title: formData.title.trim(),
        description: formData.description.trim(),
        metadata: {
          priority: formData.priority,
          tags: formData.tags,
          created_via: 'dashboard'
        }
      });

      if (task) {
        // Reset form
        setFormData({
          title: '',
          description: '',
          selectedAgentId: '',
          priority: 'medium',
          tags: []
        });
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addTag = () => {
    const tag = newTag.trim();
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const selectedAgent = agents.find(a => a.id === formData.selectedAgentId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className={cn(
        'w-full max-w-2xl max-h-[90vh] overflow-hidden bg-white rounded-xl shadow-xl',
        className
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Assign New Task</h2>
            <p className="text-gray-600 mt-1">
              Create and assign a task to one of your active agents
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[calc(90vh-120px)]">
          <div className="flex-1 overflow-auto p-6 space-y-6">
            {/* Task Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Task Title *
              </label>
              <Input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Implement user authentication, Fix bug in payment flow"
                className="w-full"
                disabled={isSubmitting}
              />
            </div>

            {/* Task Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Task Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Provide detailed instructions for the agent..."
                className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 resize-none"
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500 mt-1">
                Be specific about what you want the agent to accomplish
              </p>
            </div>

            {/* Agent Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Assign to Agent *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableAgents.map((agent) => (
                  <Card
                    key={agent.id}
                    className={cn(
                      'p-4 cursor-pointer border-2 transition-all',
                      formData.selectedAgentId === agent.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300',
                      isSubmitting && 'opacity-50 cursor-not-allowed'
                    )}
                    onClick={() => !isSubmitting && setFormData(prev => ({ ...prev, selectedAgentId: agent.id }))}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="font-medium text-sm">{agent.name}</span>
                      </div>
                      <Badge variant={agent.status === 'idle' ? 'success' : 'secondary'}>
                        {agent.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-600">
                      {agent.type} • {agent.role}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {agent.metrics?.tasksCompleted || 0} tasks completed
                    </div>
                  </Card>
                ))}
              </div>
              
              {availableAgents.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No available agents. Create an agent first to assign tasks.
                </p>
              )}
            </div>

            {/* Priority Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Priority
              </label>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as const).map((priority) => (
                  <button
                    key={priority}
                    type="button"
                    onClick={() => !isSubmitting && setFormData(prev => ({ ...prev, priority }))}
                    disabled={isSubmitting}
                    className={cn(
                      'px-3 py-1 rounded-full text-sm font-medium transition-all capitalize',
                      formData.priority === priority
                        ? priorityColors[priority]
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    {priority}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags (Optional)
              </label>
              <div className="flex items-center gap-2 mb-2">
                <Input
                  ref={tagInput}
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={handleTagKeyPress}
                  placeholder="Add tag..."
                  className="flex-1"
                  disabled={isSubmitting}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTag}
                  disabled={!newTag.trim() || isSubmitting}
                >
                  <Tag className="w-4 h-4" />
                </Button>
              </div>
              
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        disabled={isSubmitting}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Agent Summary */}
            {selectedAgent && (
              <Card className="p-4 bg-blue-50 border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">Task will be assigned to:</h4>
                <div className="text-blue-800 text-sm">
                  <div className="font-medium">{selectedAgent.name}</div>
                  <div>{selectedAgent.type} agent using {selectedAgent.role}</div>
                  <div className="text-xs mt-1 text-blue-600">
                    Current status: {selectedAgent.status}
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-6 py-3 border-t border-gray-200">
              <div className="flex items-center gap-2 text-red-600">
                <FileText className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              Task will be executed immediately after assignment
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              
              <Button
                type="submit"
                disabled={!formData.title.trim() || !formData.selectedAgentId || !formData.description.trim() || isSubmitting}
                className="min-w-[120px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Assign Task
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}