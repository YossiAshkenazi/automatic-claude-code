import React, { useState } from 'react';
import { 
  Brain, 
  Settings, 
  Zap, 
  Clock, 
  MemoryStick, 
  Cpu, 
  X, 
  Plus,
  Info,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';
import type { CreateAgentRequest, AgentConfiguration, Agent } from '../../types/agent';
import { useRealAgentManager } from '../../hooks/useRealAgentManager';

interface AgentCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (request: CreateAgentRequest) => Promise<Agent>;
  existingAgents?: Agent[];
  maxAgents?: number;
  className?: string;
}

interface FormData {
  name: string;
  type: Agent['type'];
  role: Agent['role'];
  specialization: string;
  configuration: Partial<AgentConfiguration>;
}

const defaultConfiguration: AgentConfiguration = {
  model: 'claude-3-sonnet-20240229',
  maxTokens: 4000,
  temperature: 0.1,
  maxIterations: 10,
  timeoutSeconds: 300,
  capabilities: ['general', 'coding', 'analysis'],
  resourceLimits: {
    maxMemoryMB: 512,
    maxCpuPercent: 50
  }
};

const modelPresets = {
  'claude-opus': {
    model: 'claude-3-opus-20240229',
    maxTokens: 4000,
    description: 'Most capable model for complex reasoning and analysis',
    costMultiplier: 15,
    capabilities: ['complex-reasoning', 'research', 'analysis', 'coding', 'creative-writing']
  },
  'claude-sonnet': {
    model: 'claude-3-sonnet-20240229',
    maxTokens: 4000,
    description: 'Balanced model for most tasks with good performance',
    costMultiplier: 3,
    capabilities: ['general', 'coding', 'analysis', 'task-execution']
  },
  'claude-haiku': {
    model: 'claude-3-haiku-20240307',
    maxTokens: 4000,
    description: 'Fast and efficient model for simple tasks',
    costMultiplier: 1,
    capabilities: ['general', 'simple-tasks', 'fast-responses']
  }
};

const typeDescriptions = {
  manager: 'Coordinates workflows and delegates tasks to other agents',
  worker: 'Executes specific tasks and reports back to managers',
  specialist: 'Focused on specific domain expertise and specialized tasks'
};

export function AgentCreator({
  isOpen,
  onClose,
  onCreate,
  existingAgents = [],
  maxAgents = 5,
  className
}: AgentCreatorProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    type: 'worker',
    role: 'claude-sonnet',
    specialization: '',
    configuration: { ...defaultConfiguration }
  });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { title: 'Basic Info', description: 'Agent name, type, and model' },
    { title: 'Configuration', description: 'Performance and resource settings' },
    { title: 'Review', description: 'Confirm your agent configuration' }
  ];

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name.trim()) {
      setError('Agent name is required');
      return;
    }

    if (existingAgents.some(agent => agent.name === formData.name.trim())) {
      setError('An agent with this name already exists');
      return;
    }

    if (existingAgents.length >= maxAgents) {
      setError(`Maximum number of agents (${maxAgents}) reached`);
      return;
    }

    setIsCreating(true);
    
    try {
      const preset = modelPresets[formData.role];
      const request: CreateAgentRequest = {
        name: formData.name.trim(),
        type: formData.type,
        role: formData.role,
        specialization: formData.specialization.trim() || undefined,
        configuration: {
          ...formData.configuration,
          model: preset.model,
          capabilities: preset.capabilities
        }
      };

      await onCreate(request);
      
      // Reset form
      setFormData({
        name: '',
        type: 'worker',
        role: 'claude-sonnet',
        specialization: '',
        configuration: { ...defaultConfiguration }
      });
      setCurrentStep(0);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent');
    } finally {
      setIsCreating(false);
    }
  };

  const updateConfiguration = <K extends keyof AgentConfiguration>(
    key: K,
    value: AgentConfiguration[K]
  ) => {
    setFormData(prev => ({
      ...prev,
      configuration: {
        ...prev.configuration,
        [key]: value
      }
    }));
  };

  const nextStep = () => {
    setError(null);
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    setError(null);
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return formData.name.trim().length > 0;
      case 1:
        return true; // Configuration step is always valid with defaults
      case 2:
        return true; // Review step
      default:
        return false;
    }
  };

  const preset = modelPresets[formData.role];
  const estimatedMonthlyCost = 
    (formData.configuration.maxTokens || 0) * 
    preset.costMultiplier * 
    0.001 * // rough tokens to cost conversion
    30; // 30 tasks per day estimate

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className={cn(
        'w-full max-w-2xl max-h-[90vh] overflow-hidden bg-white rounded-xl shadow-xl',
        className
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Create New Agent</h2>
            <p className="text-gray-600 mt-1">
              Configure a new Claude agent for your workflow
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-center',
                  index < steps.length - 1 && 'flex-1'
                )}
              >
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium',
                    index <= currentStep
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  )}
                >
                  {index < currentStep ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    index + 1
                  )}
                </div>
                <div className="ml-3">
                  <div className={cn(
                    'text-sm font-medium',
                    index <= currentStep ? 'text-gray-900' : 'text-gray-500'
                  )}>
                    {step.title}
                  </div>
                  <div className="text-xs text-gray-500">{step.description}</div>
                </div>
                {index < steps.length - 1 && (
                  <div className={cn(
                    'flex-1 h-px mx-4',
                    index < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex flex-col h-[calc(90vh-200px)]">
          <div className="flex-1 overflow-auto p-6">
            {/* Step 0: Basic Info */}
            {currentStep === 0 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Agent Name *
                  </label>
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Frontend Specialist, Task Manager"
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Choose a descriptive name that reflects the agent's purpose
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Agent Type *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {Object.entries(typeDescriptions).map(([type, description]) => (
                      <Card
                        key={type}
                        className={cn(
                          'p-4 cursor-pointer border-2 transition-all',
                          formData.type === type
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                        onClick={() => setFormData(prev => ({ ...prev, type: type as Agent['type'] }))}
                      >
                        <div className="font-medium capitalize mb-2">{type}</div>
                        <div className="text-xs text-gray-600">{description}</div>
                      </Card>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Claude Model *
                  </label>
                  <div className="space-y-3">
                    {Object.entries(modelPresets).map(([role, info]) => (
                      <Card
                        key={role}
                        className={cn(
                          'p-4 cursor-pointer border-2 transition-all',
                          formData.role === role
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                        onClick={() => setFormData(prev => ({ 
                          ...prev, 
                          role: role as Agent['role'],
                          configuration: {
                            ...prev.configuration,
                            model: info.model
                          }
                        }))}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium capitalize">
                              Claude {role}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              {info.description}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              {info.capabilities.slice(0, 3).map(cap => (
                                <Badge key={cap} variant="secondary" className="text-xs">
                                  {cap}
                                </Badge>
                              ))}
                              {info.capabilities.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{info.capabilities.length - 3} more
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">
                              {info.costMultiplier}x cost
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Specialization (Optional)
                  </label>
                  <Input
                    type="text"
                    value={formData.specialization}
                    onChange={(e) => setFormData(prev => ({ ...prev, specialization: e.target.value }))}
                    placeholder="e.g., React Development, Data Analysis, API Testing"
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Specify the agent's area of expertise
                  </p>
                </div>
              </div>
            )}

            {/* Step 1: Configuration */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Tokens
                    </label>
                    <Input
                      type="number"
                      min="1000"
                      max="8000"
                      value={formData.configuration.maxTokens}
                      onChange={(e) => updateConfiguration('maxTokens', parseInt(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Maximum tokens per response (1000-8000)
                    </p>
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
                      value={formData.configuration.temperature}
                      onChange={(e) => updateConfiguration('temperature', parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Response creativity (0.0 = focused, 1.0 = creative)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Iterations
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="50"
                      value={formData.configuration.maxIterations}
                      onChange={(e) => updateConfiguration('maxIterations', parseInt(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Maximum task execution cycles
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Timeout (seconds)
                    </label>
                    <Input
                      type="number"
                      min="30"
                      max="3600"
                      value={formData.configuration.timeoutSeconds}
                      onChange={(e) => updateConfiguration('timeoutSeconds', parseInt(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Task execution timeout
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Resource Limits
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Memory (MB)
                      </label>
                      <Input
                        type="number"
                        min="128"
                        max="2048"
                        value={formData.configuration.resourceLimits?.maxMemoryMB}
                        onChange={(e) => updateConfiguration('resourceLimits', {
                          ...formData.configuration.resourceLimits!,
                          maxMemoryMB: parseInt(e.target.value)
                        })}
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
                        value={formData.configuration.resourceLimits?.maxCpuPercent}
                        onChange={(e) => updateConfiguration('resourceLimits', {
                          ...formData.configuration.resourceLimits!,
                          maxCpuPercent: parseInt(e.target.value)
                        })}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Working Directory (Optional)
                  </label>
                  <Input
                    type="text"
                    value={formData.configuration.workingDirectory || ''}
                    onChange={(e) => updateConfiguration('workingDirectory', e.target.value || undefined)}
                    placeholder="e.g., /workspace/project"
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Default directory for file operations
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Review */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-5 h-5 text-blue-600" />
                    <h3 className="font-medium text-blue-900">Agent Summary</h3>
                  </div>
                  <div className="text-blue-700">
                    Your new {formData.type} agent "{formData.name}" will use {getModelDisplay(formData.role)} 
                    {formData.specialization && ` with specialization in ${formData.specialization}`}.
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="p-4">
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <Brain className="w-5 h-5" />
                      Basic Configuration
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Name:</span>
                        <span className="font-medium">{formData.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Type:</span>
                        <Badge className="capitalize">{formData.type}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Model:</span>
                        <span className="font-medium">{getModelDisplay(formData.role)}</span>
                      </div>
                      {formData.specialization && (
                        <div className="flex justify-between">
                          <span>Specialization:</span>
                          <span className="font-medium">{formData.specialization}</span>
                        </div>
                      )}
                    </div>
                  </Card>

                  <Card className="p-4">
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      Performance Settings
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Max Tokens:</span>
                        <span className="font-medium">{formData.configuration.maxTokens}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Temperature:</span>
                        <span className="font-medium">{formData.configuration.temperature}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Max Iterations:</span>
                        <span className="font-medium">{formData.configuration.maxIterations}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Timeout:</span>
                        <span className="font-medium">{formData.configuration.timeoutSeconds}s</span>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <Cpu className="w-5 h-5" />
                      Resource Limits
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Memory:</span>
                        <span className="font-medium">{formData.configuration.resourceLimits?.maxMemoryMB}MB</span>
                      </div>
                      <div className="flex justify-between">
                        <span>CPU:</span>
                        <span className="font-medium">{formData.configuration.resourceLimits?.maxCpuPercent}%</span>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <Zap className="w-5 h-5" />
                      Estimated Cost
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Cost Multiplier:</span>
                        <span className="font-medium">{preset.costMultiplier}x</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Est. Monthly:</span>
                        <span className="font-medium">${estimatedMonthlyCost.toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Estimate based on 30 tasks/day
                      </p>
                    </div>
                  </Card>
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-6 py-3 border-t border-gray-200">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              Step {currentStep + 1} of {steps.length}
            </div>
            
            <div className="flex items-center gap-3">
              {currentStep > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  disabled={isCreating}
                >
                  Previous
                </Button>
              )}
              
              {currentStep < steps.length - 1 ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={!canProceed() || isCreating}
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={!canProceed() || isCreating}
                  className="min-w-[120px]"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Agent
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function getModelDisplay(role: Agent['role']) {
  switch (role) {
    case 'claude-opus': return 'Claude Opus';
    case 'claude-sonnet': return 'Claude Sonnet';
    case 'claude-haiku': return 'Claude Haiku';
    default: return role;
  }
}