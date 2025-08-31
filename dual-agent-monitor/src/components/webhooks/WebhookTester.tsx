import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { 
  X, 
  Send, 
  Copy, 
  CheckCircle, 
  AlertTriangle, 
  Code,
  Play,
  RotateCcw
} from 'lucide-react';

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
}

interface TestResult {
  success: boolean;
  statusCode: number;
  response?: any;
  error?: string;
  duration: number;
  deliveredAt: string;
}

interface WebhookTesterProps {
  isOpen: boolean;
  webhook: WebhookEndpoint;
  onClose: () => void;
}

const TEST_PAYLOADS = {
  'session.started': {
    id: 'test-webhook-delivery',
    event: 'session.started',
    timestamp: new Date().toISOString(),
    data: {
      sessionId: 'sess_123456',
      session: {
        id: 'sess_123456',
        initialTask: 'Create a React component for user authentication',
        startTime: new Date().toISOString(),
        status: 'running',
        workDir: '/workspace/project'
      }
    },
    version: '1.0'
  },
  'session.completed': {
    id: 'test-webhook-delivery',
    event: 'session.completed',
    timestamp: new Date().toISOString(),
    data: {
      sessionId: 'sess_123456',
      session: {
        id: 'sess_123456',
        initialTask: 'Create a React component for user authentication',
        startTime: new Date(Date.now() - 300000).toISOString(),
        endTime: new Date().toISOString(),
        status: 'completed',
        workDir: '/workspace/project',
        summary: {
          totalMessages: 15,
          managerMessages: 7,
          workerMessages: 8,
          totalDuration: 300000,
          filesModified: ['src/components/Auth.tsx', 'src/utils/auth.ts'],
          commandsExecuted: ['npm install', 'npm test'],
          successRate: 0.95
        }
      }
    },
    version: '1.0'
  },
  'session.failed': {
    id: 'test-webhook-delivery',
    event: 'session.failed',
    timestamp: new Date().toISOString(),
    data: {
      sessionId: 'sess_123456',
      session: {
        id: 'sess_123456',
        initialTask: 'Create a React component for user authentication',
        startTime: new Date(Date.now() - 180000).toISOString(),
        endTime: new Date().toISOString(),
        status: 'failed',
        workDir: '/workspace/project'
      },
      alert: {
        type: 'session_failure',
        severity: 'high',
        message: 'Session failed: Build process encountered errors',
        details: {
          error: 'TypeScript compilation failed with 3 errors'
        }
      }
    },
    version: '1.0'
  },
  'agent.message': {
    id: 'test-webhook-delivery',
    event: 'agent.message',
    timestamp: new Date().toISOString(),
    data: {
      sessionId: 'sess_123456',
      agentType: 'manager',
      message: {
        id: 'msg_789',
        sessionId: 'sess_123456',
        agentType: 'manager',
        messageType: 'response',
        content: 'I\'ve analyzed the authentication requirements and created a task plan for the worker agent.',
        timestamp: new Date().toISOString(),
        metadata: {
          tools: ['Read', 'Write'],
          files: ['package.json', 'src/types/auth.ts'],
          duration: 2500
        }
      }
    },
    version: '1.0'
  },
  'performance.alert': {
    id: 'test-webhook-delivery',
    event: 'performance.alert',
    timestamp: new Date().toISOString(),
    data: {
      sessionId: 'sess_123456',
      alert: {
        type: 'high_response_time',
        severity: 'medium',
        message: 'Agent response time exceeded threshold',
        details: {
          threshold: 10000,
          actual: 15000,
          agentType: 'worker'
        }
      },
      metrics: {
        sessionId: 'sess_123456',
        agentType: 'worker',
        responseTime: 15000,
        tokensUsed: 2500,
        errorRate: 0.1,
        timestamp: new Date().toISOString()
      }
    },
    version: '1.0'
  },
  'anomaly.detected': {
    id: 'test-webhook-delivery',
    event: 'anomaly.detected',
    timestamp: new Date().toISOString(),
    data: {
      sessionId: 'sess_123456',
      anomaly: {
        type: 'unusual_error_pattern',
        confidence: 0.85,
        description: 'Detected unusual spike in compilation errors across multiple sessions',
        data: {
          errorCount: 15,
          timeWindow: '1h',
          affectedSessions: ['sess_123456', 'sess_789012'],
          errorTypes: ['TypeScript', 'ESLint', 'Build']
        }
      }
    },
    version: '1.0'
  },
  'cost.threshold': {
    id: 'test-webhook-delivery',
    event: 'cost.threshold',
    timestamp: new Date().toISOString(),
    data: {
      cost: {
        current: 125.50,
        threshold: 100.00,
        period: 'monthly'
      },
      alert: {
        type: 'cost_threshold',
        severity: 'medium',
        message: 'Monthly cost threshold exceeded: $125.50 > $100.00',
        details: {
          currentUsage: 125.50,
          budgetLimit: 100.00,
          overageAmount: 25.50,
          period: 'monthly'
        }
      }
    },
    version: '1.0'
  },
  'user.login': {
    id: 'test-webhook-delivery',
    event: 'user.login',
    timestamp: new Date().toISOString(),
    data: {
      user: {
        id: 'user_123',
        email: 'developer@example.com',
        timestamp: new Date().toISOString()
      }
    },
    version: '1.0'
  },
  'webhook.test': {
    id: 'test-webhook-delivery',
    event: 'webhook.test',
    timestamp: new Date().toISOString(),
    data: {
      message: 'This is a test webhook delivery from Dual-Agent Monitor',
      test: true,
      webhook: {
        name: 'Test Webhook',
        timestamp: new Date().toISOString()
      }
    },
    version: '1.0'
  }
};

export const WebhookTester: React.FC<WebhookTesterProps> = ({
  isOpen,
  webhook,
  onClose,
}) => {
  const [selectedEvent, setSelectedEvent] = useState<string>('webhook.test');
  const [customPayload, setCustomPayload] = useState<string>('');
  const [useCustomPayload, setUseCustomPayload] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentPayload = () => {
    if (useCustomPayload) {
      try {
        return JSON.parse(customPayload || '{}');
      } catch {
        return {};
      }
    }
    return TEST_PAYLOADS[selectedEvent as keyof typeof TEST_PAYLOADS] || TEST_PAYLOADS['webhook.test'];
  };

  const sendTestWebhook = async () => {
    setLoading(true);
    setError(null);
    setTestResult(null);

    try {
      const payload = getCurrentPayload();
      
      const response = await fetch(`/api/webhooks/${webhook.id}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ payload }),
      });

      const result = await response.json();
      
      if (result.success) {
        setTestResult(result.data.deliveryResult);
      } else {
        setError(result.error || 'Test failed');
        if (result.data?.deliveryResult) {
          setTestResult(result.data.deliveryResult);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send test webhook');
    } finally {
      setLoading(false);
    }
  };

  const copyPayload = async () => {
    const payload = JSON.stringify(getCurrentPayload(), null, 2);
    try {
      await navigator.clipboard.writeText(payload);
    } catch (err) {
      console.error('Failed to copy payload:', err);
    }
  };

  const resetToDefaults = () => {
    setSelectedEvent('webhook.test');
    setUseCustomPayload(false);
    setCustomPayload('');
    setTestResult(null);
    setError(null);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold">Test Webhook</h2>
              <p className="text-gray-600">{webhook.name} • {webhook.url}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={resetToDefaults}>
                <RotateCcw size={16} />
                Reset
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                <X size={16} />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Panel - Configuration */}
            <div className="space-y-4">
              <Card className="p-4">
                <h3 className="font-medium mb-3">Test Configuration</h3>
                
                {/* Payload Type Selection */}
                <div className="space-y-3">
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={!useCustomPayload}
                        onChange={() => setUseCustomPayload(false)}
                      />
                      <span>Use predefined event payload</span>
                    </label>
                  </div>
                  
                  {!useCustomPayload && (
                    <div className="ml-6">
                      <select
                        value={selectedEvent}
                        onChange={(e) => setSelectedEvent(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      >
                        {Object.keys(TEST_PAYLOADS).map((event) => (
                          <option key={event} value={event}>
                            {event}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={useCustomPayload}
                        onChange={() => setUseCustomPayload(true)}
                      />
                      <span>Use custom payload</span>
                    </label>
                  </div>
                </div>

                {/* Custom Payload Editor */}
                {useCustomPayload && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom JSON Payload
                    </label>
                    <textarea
                      value={customPayload}
                      onChange={(e) => setCustomPayload(e.target.value)}
                      placeholder="Enter your custom JSON payload..."
                      className="w-full h-48 p-3 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 mt-4 pt-4 border-t">
                  <Button
                    onClick={sendTestWebhook}
                    disabled={loading}
                    className="flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <LoadingSpinner />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        Send Test
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={copyPayload}
                    className="flex items-center gap-2"
                  >
                    <Copy size={16} />
                    Copy Payload
                  </Button>
                </div>
              </Card>

              {/* Payload Preview */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">Payload Preview</h3>
                  <Code size={16} className="text-gray-400" />
                </div>
                <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-100 p-3 rounded border overflow-x-auto max-h-64">
                  {JSON.stringify(getCurrentPayload(), null, 2)}
                </pre>
              </Card>
            </div>

            {/* Right Panel - Results */}
            <div className="space-y-4">
              {/* Error Display */}
              {error && (
                <Card className="p-4 border-red-200 bg-red-50">
                  <div className="flex items-center gap-3 text-red-700">
                    <AlertTriangle size={20} />
                    <div>
                      <h3 className="font-medium">Test Failed</h3>
                      <p className="text-sm">{error}</p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Test Result */}
              {testResult && (
                <Card className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    {testResult.success ? (
                      <>
                        <CheckCircle className="text-green-500" size={20} />
                        <h3 className="font-medium text-green-700">Test Successful</h3>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="text-red-500" size={20} />
                        <h3 className="font-medium text-red-700">Test Failed</h3>
                      </>
                    )}
                  </div>

                  <div className="space-y-3">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Status Code:</span>
                        <span className="ml-2 font-medium">{testResult.statusCode}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Duration:</span>
                        <span className="ml-2 font-medium">{formatDuration(testResult.duration)}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-600">Delivered At:</span>
                        <span className="ml-2 font-medium">
                          {new Date(testResult.deliveredAt).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Error Details */}
                    {testResult.error && (
                      <div>
                        <h4 className="font-medium text-red-600 mb-2">Error Details</h4>
                        <pre className="text-sm text-red-700 whitespace-pre-wrap bg-red-50 p-3 rounded border">
                          {testResult.error}
                        </pre>
                      </div>
                    )}

                    {/* Response */}
                    {testResult.response && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Response</h4>
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-100 p-3 rounded border overflow-x-auto max-h-48">
                          {typeof testResult.response === 'string' 
                            ? testResult.response 
                            : JSON.stringify(testResult.response, null, 2)
                          }
                        </pre>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Instructions */}
              <Card className="p-4 bg-blue-50 border-blue-200">
                <h3 className="font-medium text-blue-700 mb-2">How to Test</h3>
                <ol className="text-sm text-blue-600 space-y-1 list-decimal list-inside">
                  <li>Choose a predefined event type or create custom payload</li>
                  <li>Review the payload in the preview panel</li>
                  <li>Click "Send Test" to deliver the webhook</li>
                  <li>Check the response and timing information</li>
                  <li>Verify your endpoint received the payload correctly</li>
                </ol>
              </Card>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};