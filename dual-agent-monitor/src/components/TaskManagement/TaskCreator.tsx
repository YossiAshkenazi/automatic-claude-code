import React, { useState, useCallback } from 'react';
import { Plus, X, Tag, Clock, AlertTriangle, CheckCircle, FileText, Settings } from 'lucide-react';
import { Task, TaskRequirement, TaskTemplate } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { toast } from 'sonner';

interface TaskCreatorProps {
  onCreateTask: (taskData: Partial<Task>) => Promise<Task | null>;
  templates?: TaskTemplate[];
  onClose?: () => void;
  initialData?: Partial<Task>;
  isOpen: boolean;
}

interface TaskFormData {
  title: string;
  description: string;
  priority: Task['priority'];
  estimatedDuration: number | '';
  tags: string[];
  requirements: TaskRequirement[];
  assignedAgent: Task['assignedAgent'];
  dependencies: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  toolsRequired: string[];
}

const priorityOptions = [
  { value: 'low', label: 'Low', color: 'bg-green-100 text-green-700' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-700' }
] as const;

const complexityOptions = [
  { value: 'simple', label: 'Simple', description: 'Single-step task, < 15min' },
  { value: 'moderate', label: 'Moderate', description: 'Multi-step task, 15-60min' },
  { value: 'complex', label: 'Complex', description: 'Complex workflow, > 60min' }
] as const;

const commonTags = [
  'frontend', 'backend', 'testing', 'documentation', 'bug-fix', 
  'feature', 'refactor', 'optimization', 'security', 'deployment'
];

const commonTools = [
  'Read', 'Write', 'MultiEdit', 'Bash', 'Grep', 'Glob'
];

export function TaskCreator({ 
  onCreateTask, 
  templates = [], 
  onClose, 
  initialData,
  isOpen 
}: TaskCreatorProps) {
  const [step, setStep] = useState<'basic' | 'requirements' | 'advanced' | 'template'>('basic');
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [formData, setFormData] = useState<TaskFormData>({
    title: initialData?.title || '',
    description: initialData?.description || '',
    priority: initialData?.priority || 'medium',
    estimatedDuration: initialData?.estimatedDuration || '',
    tags: initialData?.tags || [],
    requirements: initialData?.requirements || [],
    assignedAgent: initialData?.assignedAgent || null,
    dependencies: initialData?.dependencies || [],
    complexity: initialData?.metadata?.complexity || 'moderate',
    toolsRequired: initialData?.metadata?.toolsRequired || []
  });

  const [newTag, setNewTag] = useState('');
  const [newTool, setNewTool] = useState('');
  const [newRequirement, setNewRequirement] = useState<Partial<TaskRequirement>>({
    type: 'capability',
    description: '',
    required: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFieldChange = useCallback(<K extends keyof TaskFormData>(
    field: K,
    value: TaskFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleAddTag = useCallback(() => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  }, [newTag, formData.tags]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  }, []);

  const handleAddTool = useCallback(() => {
    if (newTool.trim() && !formData.toolsRequired.includes(newTool.trim())) {
      setFormData(prev => ({
        ...prev,
        toolsRequired: [...prev.toolsRequired, newTool.trim()]
      }));
      setNewTool('');
    }
  }, [newTool, formData.toolsRequired]);

  const handleRemoveTool = useCallback((toolToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      toolsRequired: prev.toolsRequired.filter(tool => tool !== toolToRemove)
    }));
  }, []);

  const handleAddRequirement = useCallback(() => {
    if (newRequirement.description?.trim()) {
      const requirement: TaskRequirement = {
        id: Date.now().toString(),
        type: newRequirement.type || 'capability',
        description: newRequirement.description,
        required: newRequirement.required || true,
        fulfilled: false
      };
      
      setFormData(prev => ({
        ...prev,
        requirements: [...prev.requirements, requirement]
      }));
      
      setNewRequirement({
        type: 'capability',
        description: '',
        required: true
      });
    }
  }, [newRequirement]);

  const handleRemoveRequirement = useCallback((requirementId: string) => {
    setFormData(prev => ({
      ...prev,
      requirements: prev.requirements.filter(req => req.id !== requirementId)
    }));
  }, []);

  const handleTemplateSelect = useCallback((template: TaskTemplate) => {
    setSelectedTemplate(template);
    const templateData = template.template;
    
    setFormData(prev => ({
      ...prev,
      title: templateData.title || prev.title,
      description: templateData.description || prev.description,
      priority: templateData.priority || prev.priority,
      estimatedDuration: templateData.estimatedDuration || prev.estimatedDuration,
      tags: templateData.tags || prev.tags,
      requirements: templateData.requirements || prev.requirements,
      complexity: templateData.metadata?.complexity || prev.complexity,
      toolsRequired: templateData.metadata?.toolsRequired || prev.toolsRequired
    }));
    
    setStep('basic');
    toast.success(`Template "${template.name}" applied`);
  }, []);

  const validateForm = useCallback((): string | null => {
    if (!formData.title.trim()) return 'Title is required';
    if (!formData.description.trim()) return 'Description is required';
    if (formData.estimatedDuration && formData.estimatedDuration <= 0) {
      return 'Estimated duration must be positive';
    }
    return null;
  }, [formData]);

  const handleSubmit = useCallback(async () => {
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const taskData: Partial<Task> = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        priority: formData.priority,
        estimatedDuration: typeof formData.estimatedDuration === 'number' 
          ? formData.estimatedDuration 
          : undefined,
        tags: formData.tags,
        requirements: formData.requirements,
        assignedAgent: formData.assignedAgent,
        dependencies: formData.dependencies,
        status: 'pending',
        progress: 0,
        metadata: {
          complexity: formData.complexity,
          toolsRequired: formData.toolsRequired.length > 0 ? formData.toolsRequired : undefined
        }
      };

      const createdTask = await onCreateTask(taskData);
      
      if (createdTask) {
        toast.success(`Task "${createdTask.title}" created successfully`);
        onClose?.();
        
        // Reset form
        setFormData({
          title: '',
          description: '',
          priority: 'medium',
          estimatedDuration: '',
          tags: [],
          requirements: [],
          assignedAgent: null,
          dependencies: [],
          complexity: 'moderate',
          toolsRequired: []
        });
        setStep('basic');
      }
    } catch (error: any) {
      toast.error(`Failed to create task: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, onCreateTask, onClose]);

  if (!isOpen) return null;

  const stepTitles = {
    template: 'Choose Template',
    basic: 'Basic Information',
    requirements: 'Requirements & Dependencies',
    advanced: 'Advanced Settings'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Create New Task</h2>
            <p className="text-sm text-gray-600 mt-1">
              {stepTitles[step]} {selectedTemplate && `(${selectedTemplate.name})`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Step Navigation */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            {templates.length > 0 && (
              <button
                onClick={() => setStep('template')}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  step === 'template'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Templates
              </button>
            )}
            <button
              onClick={() => setStep('basic')}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                step === 'basic'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Basic
            </button>
            <button
              onClick={() => setStep('requirements')}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                step === 'requirements'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Requirements
            </button>
            <button
              onClick={() => setStep('advanced')}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                step === 'advanced'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Advanced
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Template Selection */}
          {step === 'template' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((template) => (
                  <Card
                    key={template.id}
                    className="p-4 cursor-pointer hover:bg-blue-50 border-2 hover:border-blue-200 transition-colors"
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{template.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary">{template.category}</Badge>
                          <span className="text-xs text-gray-500">
                            Used {template.usageCount} times
                          </span>
                        </div>
                      </div>
                      <FileText size={20} className="text-gray-400" />
                    </div>
                  </Card>
                ))}
              </div>
              {templates.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No templates available</p>
                  <p className="text-sm">Create your first task to generate templates</p>
                </div>
              )}
            </div>
          )}

          {/* Basic Information */}
          {step === 'basic' && (
            <div className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <Input
                  value={formData.title}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  placeholder="Enter task title..."
                  className="w-full"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  placeholder="Describe the task in detail..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
                />
              </div>

              {/* Priority & Duration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {priorityOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleFieldChange('priority', option.value)}
                        className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                          formData.priority === option.value
                            ? `${option.color} border-current`
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated Duration (minutes)
                  </label>
                  <Input
                    type="number"
                    value={formData.estimatedDuration}
                    onChange={(e) => handleFieldChange('estimatedDuration', 
                      e.target.value ? parseInt(e.target.value) : ''
                    )}
                    placeholder="30"
                    min="1"
                  />
                </div>
              </div>

              {/* Agent Assignment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign to Agent
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleFieldChange('assignedAgent', null)}
                    className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                      formData.assignedAgent === null
                        ? 'bg-gray-100 text-gray-700 border-gray-400'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Unassigned
                  </button>
                  <button
                    onClick={() => handleFieldChange('assignedAgent', 'manager')}
                    className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                      formData.assignedAgent === 'manager'
                        ? 'bg-blue-100 text-blue-700 border-blue-400'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Manager
                  </button>
                  <button
                    onClick={() => handleFieldChange('assignedAgent', 'worker')}
                    className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                      formData.assignedAgent === 'worker'
                        ? 'bg-green-100 text-green-700 border-green-400'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Worker
                  </button>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="flex items-center gap-1 pr-1"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:bg-gray-300 rounded-full p-0.5"
                      >
                        <X size={12} />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add tag..."
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                    className="flex-1"
                  />
                  <Button onClick={handleAddTag} variant="outline">
                    <Tag size={16} />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {commonTags.map((tag) => (
                    !formData.tags.includes(tag) && (
                      <button
                        key={tag}
                        onClick={() => {
                          setNewTag(tag);
                          setTimeout(handleAddTag, 0);
                        }}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                      >
                        {tag}
                      </button>
                    )
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Requirements & Dependencies */}
          {step === 'requirements' && (
            <div className="space-y-6">
              {/* Requirements */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Requirements
                </label>
                
                {/* Existing Requirements */}
                <div className="space-y-2 mb-4">
                  {formData.requirements.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={req.required ? 'default' : 'secondary'}>
                            {req.type}
                          </Badge>
                          <span className="text-sm text-gray-900">{req.description}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveRequirement(req.id)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add New Requirement */}
                <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <select
                      value={newRequirement.type}
                      onChange={(e) => setNewRequirement(prev => ({
                        ...prev,
                        type: e.target.value as TaskRequirement['type']
                      }))}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="capability">Capability</option>
                      <option value="tool">Tool</option>
                      <option value="file">File</option>
                      <option value="dependency">Dependency</option>
                    </select>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newRequirement.required}
                        onChange={(e) => setNewRequirement(prev => ({
                          ...prev,
                          required: e.target.checked
                        }))}
                      />
                      <span className="text-sm text-gray-700">Required</span>
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newRequirement.description}
                      onChange={(e) => setNewRequirement(prev => ({
                        ...prev,
                        description: e.target.value
                      }))}
                      placeholder="Describe the requirement..."
                      className="flex-1"
                    />
                    <Button onClick={handleAddRequirement} variant="outline">
                      <Plus size={16} />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Tools Required */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tools Required
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.toolsRequired.map((tool) => (
                    <Badge
                      key={tool}
                      variant="outline"
                      className="flex items-center gap-1 pr-1"
                    >
                      {tool}
                      <button
                        onClick={() => handleRemoveTool(tool)}
                        className="hover:bg-gray-200 rounded-full p-0.5"
                      >
                        <X size={12} />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newTool}
                    onChange={(e) => setNewTool(e.target.value)}
                    placeholder="Add tool..."
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTool()}
                    className="flex-1"
                  />
                  <Button onClick={handleAddTool} variant="outline">
                    <Settings size={16} />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {commonTools.map((tool) => (
                    !formData.toolsRequired.includes(tool) && (
                      <button
                        key={tool}
                        onClick={() => {
                          setNewTool(tool);
                          setTimeout(handleAddTool, 0);
                        }}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                      >
                        {tool}
                      </button>
                    )
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Advanced Settings */}
          {step === 'advanced' && (
            <div className="space-y-6">
              {/* Complexity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Complexity
                </label>
                <div className="space-y-2">
                  {complexityOptions.map((option) => (
                    <label key={option.value} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="complexity"
                        value={option.value}
                        checked={formData.complexity === option.value}
                        onChange={(e) => handleFieldChange('complexity', e.target.value as any)}
                        className="mt-1"
                      />
                      <div>
                        <span className="font-medium text-gray-900">{option.label}</span>
                        <p className="text-sm text-gray-600">{option.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <div className="flex items-center gap-2">
            {step !== 'basic' && step !== 'template' && (
              <Button
                variant="outline"
                onClick={() => {
                  if (step === 'requirements') setStep('basic');
                  else if (step === 'advanced') setStep('requirements');
                }}
              >
                Previous
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            
            {step === 'basic' && (
              <Button
                onClick={() => setStep('requirements')}
                disabled={!formData.title.trim() || !formData.description.trim()}
              >
                Next: Requirements
              </Button>
            )}
            
            {step === 'requirements' && (
              <Button onClick={() => setStep('advanced')}>
                Next: Advanced
              </Button>
            )}
            
            {step === 'advanced' && (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="min-w-[120px]"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </div>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    Create Task
                  </>
                )}
              </Button>
            )}
            
            {(step === 'basic' || step === 'template') && formData.title.trim() && formData.description.trim() && (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                variant="outline"
                className="min-w-[120px]"
              >
                {isSubmitting ? 'Creating...' : 'Quick Create'}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}