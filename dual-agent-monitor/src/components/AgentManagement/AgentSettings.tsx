import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  X, 
  RotateCw, 
  AlertTriangle, 
  Info, 
  Trash2,
  Eye,
  EyeOff,
  Copy,
  CheckCircle
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Separator } from '../ui/Separator';
import { cn } from '../../lib/utils';
import type { Agent, UpdateAgentRequest, AgentConfiguration } from '../../types/agent';

interface AgentSettingsProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (request: UpdateAgentRequest) => Promise<void>;
  onDelete?: (agentId: string) => Promise<void>;
  className?: string;
}

interface ConfigurationForm extends AgentConfiguration {
  name: string;
  specialization?: string;
}

export function AgentSettings({
  agent,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  className
}: AgentSettingsProps) {
  const [formData, setFormData] = useState<ConfigurationForm>({
    name: '',
    model: 'claude-3-sonnet-20240229',
    maxTokens: 4000,
    temperature: 0.1,
    maxIterations: 10,
    timeoutSeconds: 300,
    capabilities: [],
    resourceLimits: {
      maxMemoryMB: 512,
      maxCpuPercent: 50
    }
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Initialize form data when agent changes
  useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name,
        specialization: agent.configuration.specialization,
        ...agent.configuration
      });
      setHasChanges(false);
      setError(null);
    }
  }, [agent]);

  // Track changes
  useEffect(() => {
    if (agent) {
      const hasNameChange = formData.name !== agent.name;
      const hasSpecializationChange = formData.specialization !== agent.configuration.specialization;
      const hasConfigChange = JSON.stringify({
        model: formData.model,
        maxTokens: formData.maxTokens,
        temperature: formData.temperature,
        maxIterations: formData.maxIterations,
        timeoutSeconds: formData.timeoutSeconds,
        workingDirectory: formData.workingDirectory,
        resourceLimits: formData.resourceLimits
      }) !== JSON.stringify({
        model: agent.configuration.model,
        maxTokens: agent.configuration.maxTokens,
        temperature: agent.configuration.temperature,
        maxIterations: agent.configuration.maxIterations,
        timeoutSeconds: agent.configuration.timeoutSeconds,
        workingDirectory: agent.configuration.workingDirectory,
        resourceLimits: agent.configuration.resourceLimits
      });
      
      setHasChanges(hasNameChange || hasSpecializationChange || hasConfigChange);
    }
  }, [formData, agent]);

  if (!isOpen || !agent) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Agent name is required');
      return;
    }

    setIsUpdating(true);
    
    try {
      const { name, specialization, ...configuration } = formData;
      
      const request: UpdateAgentRequest = {
        id: agent.id,
        name: name.trim() !== agent.name ? name.trim() : undefined,
        specialization: specialization?.trim() !== agent.configuration.specialization 
          ? (specialization?.trim() || undefined) 
          : undefined,
        configuration
      };

      // Remove undefined values to only update changed fields
      Object.keys(request).forEach(key => {
        if (request[key as keyof UpdateAgentRequest] === undefined) {
          delete request[key as keyof UpdateAgentRequest];
        }
      });

      await onUpdate(request);
      setHasChanges(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update agent');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    
    try {
      await onDelete(agent.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete agent');
      setShowDeleteConfirm(false);
    }
  };

  const resetForm = () => {
    if (agent) {
      setFormData({
        name: agent.name,
        specialization: agent.configuration.specialization,
        ...agent.configuration
      });
      setHasChanges(false);
      setError(null);
    }
  };

  const copyAgentId = async () => {
    try {
      await navigator.clipboard.writeText(agent.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch (err) {
      // Fallback for browsers without clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = agent.id;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'working': return 'text-blue-600 bg-blue-100';
      case 'idle': return 'text-gray-600 bg-gray-100';
      case 'error': return 'text-red-600 bg-red-100';
      case 'offline': return 'text-gray-400 bg-gray-50';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTypeColor = (type: Agent['type']) => {
    switch (type) {
      case 'manager': return 'text-purple-600 bg-purple-100';
      case 'worker': return 'text-blue-600 bg-blue-100';
      case 'specialist': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className={cn(
        'w-full max-w-4xl max-h-[90vh] overflow-hidden bg-white rounded-xl shadow-xl',
        className
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Settings className="w-6 h-6" />
              Agent Settings
            </h2>
            <p className="text-gray-600 mt-1">
              Configure {agent.name}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex flex-col lg:flex-row h-[calc(90vh-120px)]">
          {/* Agent Info Sidebar */}
          <div className="lg:w-1/3 border-b lg:border-b-0 lg:border-r border-gray-200 p-6 bg-gray-50">
            <div className="space-y-6">
              {/* Agent Identity */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Agent Info</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">ID:</span>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-white px-2 py-1 rounded border">
                        {agent.id.slice(0, 8)}...
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={copyAgentId}
                        className="h-6 w-6 p-0"
                      >
                        {copiedId ? (
                          <CheckCircle className="w-3 h-3 text-green-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Status:</span>
                    <Badge className={getStatusColor(agent.status)}>
                      {agent.status}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Type:</span>
                    <Badge className={getTypeColor(agent.type)}>
                      {agent.type}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Model:</span>
                    <span className="text-sm text-gray-900">
                      {agent.role.replace('claude-', '')}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Created:</span>
                    <span className="text-sm text-gray-900">
                      {new Date(agent.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Current Metrics */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Metrics</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Health Score:</span>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-2 bg-gray-200 rounded-full">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            agent.metrics.healthScore >= 80 ? 'bg-green-500' :
                            agent.metrics.healthScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          )}
                          style={{ width: `${agent.metrics.healthScore}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-900">
                        {agent.metrics.healthScore}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Tasks:</span>
                    <span className="text-sm text-gray-900">
                      {agent.metrics.completedTasks}/{agent.metrics.totalTasks}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Avg Response:</span>
                    <span className="text-sm text-gray-900">
                      {agent.metrics.averageResponseTime.toFixed(0)}ms
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Cost:</span>
                    <span className="text-sm text-gray-900">
                      ${agent.metrics.totalCost.toFixed(3)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Capabilities */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Capabilities</h3>
                <div className="flex flex-wrap gap-2">
                  {agent.configuration.capabilities.map((capability) => (
                    <Badge key={capability} variant="secondary" className="text-xs">
                      {capability.replace('-', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Configuration Form */}
          <div className="flex-1 overflow-auto p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Settings */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Agent Name
                    </label>
                    <Input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Specialization
                    </label>
                    <Input
                      type="text"
                      value={formData.specialization || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, specialization: e.target.value }))}
                      placeholder="e.g., Frontend Development, Data Analysis"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Working Directory
                    </label>
                    <Input
                      type="text"
                      value={formData.workingDirectory || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, workingDirectory: e.target.value || undefined }))}
                      placeholder="e.g., /workspace/project"
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Performance Settings */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Tokens
                    </label>
                    <Input
                      type="number"
                      min="1000"
                      max="8000"
                      value={formData.maxTokens}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Temperature
                    </label>
                    <Input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={formData.temperature}
                      onChange={(e) => setFormData(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Iterations
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="50"
                      value={formData.maxIterations}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxIterations: parseInt(e.target.value) }))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Timeout (sec)
                    </label>
                    <Input
                      type="number"
                      min="30"
                      max="3600"
                      value={formData.timeoutSeconds}
                      onChange={(e) => setFormData(prev => ({ ...prev, timeoutSeconds: parseInt(e.target.value) }))}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Resource Limits */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Resource Limits</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Memory (MB)
                    </label>
                    <Input
                      type="number"
                      min="128"
                      max="2048"
                      value={formData.resourceLimits.maxMemoryMB}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        resourceLimits: {
                          ...prev.resourceLimits,
                          maxMemoryMB: parseInt(e.target.value)
                        }
                      }))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max CPU (%)
                    </label>
                    <Input
                      type="number"
                      min="10"
                      max="100"
                      value={formData.resourceLimits.maxCpuPercent}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        resourceLimits: {
                          ...prev.resourceLimits,
                          maxCpuPercent: parseInt(e.target.value)
                        }
                      }))}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Advanced Settings Toggle */}
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2"
                >
                  {showAdvanced ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
                </Button>
              </div>

              {/* Advanced Settings */}
              {showAdvanced && (
                <div className="border-t border-gray-200 pt-6">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <div>
                        <div className="font-medium text-yellow-900">Advanced Configuration</div>
                        <div className="text-yellow-700 text-sm mt-1">
                          These settings can affect agent performance and stability. Modify with caution.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Model Override
                      </label>
                      <Input
                        type="text"
                        value={formData.model}
                        onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                        className="w-full font-mono text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Direct model identifier (advanced users only)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <div className="font-medium text-red-900">Configuration Error</div>
                      <div className="text-red-700 text-sm mt-1">{error}</div>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            {hasChanges && (
              <div className="flex items-center gap-2 text-amber-600">
                <Info className="w-4 h-4" />
                <span className="text-sm">You have unsaved changes</span>
              </div>
            )}
            
            {onDelete && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Agent
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
              disabled={!hasChanges || isUpdating}
            >
              <RotateCw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            
            <Button
              type="submit"
              onClick={handleSubmit}
              disabled={!hasChanges || isUpdating}
              className="min-w-[100px]"
            >
              {isUpdating ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-50">
            <Card className="w-full max-w-md p-6">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Delete Agent</h3>
                  <p className="text-gray-600 mt-1">
                    Are you sure you want to delete "{agent.name}"? This action cannot be undone.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                >
                  Delete Agent
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}