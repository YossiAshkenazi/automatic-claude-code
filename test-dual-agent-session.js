#!/usr/bin/env node

/**
 * Comprehensive Test Script for Dual-Agent Session Monitoring
 * 
 * This script simulates a complete dual-agent workflow with realistic
 * coordination data to test the end-to-end monitoring dashboard functionality.
 * 
 * Features:
 * - Simulates Manager planning and Worker execution phases
 * - Tests all event types: MANAGER_TASK_ASSIGNMENT, WORKER_PROGRESS_UPDATE, etc.
 * - Includes error scenarios and recovery
 * - Verifies data appears in monitoring dashboard
 * - Tests WebSocket real-time updates
 * 
 * Usage:
 *   node test-dual-agent-session.js
 *   node test-dual-agent-session.js --fast    # Reduced delays for quick testing
 *   node test-dual-agent-session.js --debug   # Verbose logging
 */

const http = require('http');
const { WebSocket } = require('ws');

// Configuration
const MONITORING_API_URL = 'http://localhost:4001/api/monitoring';
const WEBSOCKET_URL = 'ws://localhost:4001';
const DASHBOARD_URL = 'http://localhost:6011';

// Parse command line arguments
const args = process.argv.slice(2);
const FAST_MODE = args.includes('--fast');
const DEBUG_MODE = args.includes('--debug');

// Timing configuration
const DELAYS = {
  between_events: FAST_MODE ? 100 : 800,
  between_phases: FAST_MODE ? 200 : 2000,
  error_recovery: FAST_MODE ? 300 : 1500
};

// Session configuration
const SESSION_ID = `test-session-${Date.now()}`;
const TASK_DESCRIPTION = 'Implement a complete e-commerce product catalog with search, filtering, and inventory management';
const WORK_DIR = 'C:\\Users\\Dev\\ecommerce-catalog';

class DualAgentSessionTester {
  constructor() {
    this.eventCount = 0;
    this.errors = [];
    this.websocket = null;
    this.websocketMessages = [];
    this.startTime = Date.now();
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString().substr(11, 8);
    const prefix = level === 'error' ? '❌' : level === 'success' ? '✅' : level === 'debug' ? '🔍' : 'ℹ️';
    
    if (level !== 'debug' || DEBUG_MODE) {
      console.log(`[${timestamp}] ${prefix} ${message}`);
    }
  }

  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      try {
        this.websocket = new WebSocket(WEBSOCKET_URL);
        
        this.websocket.on('open', () => {
          this.log('WebSocket connected successfully', 'success');
          resolve();
        });
        
        this.websocket.on('message', (data) => {
          try {
            const message = JSON.parse(data);
            this.websocketMessages.push({
              timestamp: Date.now(),
              message: message
            });
            this.log(`WebSocket message received: ${message.type}`, 'debug');
          } catch (e) {
            this.log(`WebSocket message parse error: ${e.message}`, 'error');
          }
        });
        
        this.websocket.on('error', (error) => {
          this.log(`WebSocket error: ${error.message}`, 'error');
          reject(error);
        });
        
        this.websocket.on('close', () => {
          this.log('WebSocket connection closed', 'debug');
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async sendMonitoringEvent(event) {
    const eventWithDefaults = {
      ...event,
      sessionInfo: {
        task: TASK_DESCRIPTION,
        workDir: WORK_DIR,
        sessionId: SESSION_ID,
        ...event.sessionInfo
      }
    };

    this.log(`Sending event [${++this.eventCount}]: ${event.message}`, 'debug');

    try {
      const response = await this.makeHttpRequest('POST', MONITORING_API_URL, eventWithDefaults);
      
      if (response.success) {
        this.log(`✓ Event sent successfully`, 'debug');
        return true;
      } else {
        this.log(`Event failed: ${response.error || 'Unknown error'}`, 'error');
        this.errors.push(`Event ${this.eventCount}: ${response.error}`);
        return false;
      }
    } catch (error) {
      this.log(`Event send error: ${error.message}`, 'error');
      this.errors.push(`Event ${this.eventCount}: ${error.message}`);
      return false;
    }
  }

  async makeHttpRequest(method, url, data) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const postData = data ? JSON.stringify(data) : null;
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': postData ? Buffer.byteLength(postData) : 0
        }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed);
          } catch (e) {
            resolve({ success: false, error: `Parse error: ${e.message}`, body });
          }
        });
      });

      req.on('error', reject);
      
      if (postData) {
        req.write(postData);
      }
      
      req.end();
    });
  }

  async checkDashboardAvailability() {
    try {
      this.log('Checking monitoring dashboard availability...', 'debug');
      const response = await this.makeHttpRequest('GET', DASHBOARD_URL, null);
      this.log('Dashboard is accessible', 'success');
      return true;
    } catch (error) {
      this.log(`Dashboard check failed: ${error.message}`, 'error');
      return false;
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runCompleteSession() {
    this.log('🚀 Starting comprehensive dual-agent session test', 'info');
    this.log(`Session ID: ${SESSION_ID}`, 'info');
    this.log(`Task: ${TASK_DESCRIPTION}`, 'info');
    this.log('', 'info');

    // Check prerequisites
    this.log('📋 Phase 1: Prerequisites Check', 'info');
    
    try {
      await this.connectWebSocket();
    } catch (error) {
      this.log(`WebSocket connection failed: ${error.message}`, 'error');
      this.log('Continuing without WebSocket...', 'info');
    }

    const dashboardAvailable = await this.checkDashboardAvailability();
    if (!dashboardAvailable) {
      this.log('Warning: Dashboard may not be available', 'error');
    }

    await this.delay(DELAYS.between_phases);

    // Phase 2: Manager Planning
    this.log('🧠 Phase 2: Manager Planning & Analysis', 'info');
    await this.runManagerPlanningPhase();

    await this.delay(DELAYS.between_phases);

    // Phase 3: Coordination & Handoffs
    this.log('🤝 Phase 3: Manager-Worker Coordination', 'info');
    await this.runCoordinationPhase();

    await this.delay(DELAYS.between_phases);

    // Phase 4: Worker Execution
    this.log('⚡ Phase 4: Worker Execution', 'info');
    await this.runWorkerExecutionPhase();

    await this.delay(DELAYS.between_phases);

    // Phase 5: Error Handling & Recovery
    this.log('⚠️  Phase 5: Error Handling & Recovery', 'info');
    await this.runErrorRecoveryPhase();

    await this.delay(DELAYS.between_phases);

    // Phase 6: Quality Gates & Validation
    this.log('🔍 Phase 6: Quality Gates & Validation', 'info');
    await this.runQualityValidationPhase();

    await this.delay(DELAYS.between_phases);

    // Phase 7: Completion & Summary
    this.log('🎉 Phase 7: Completion & Summary', 'info');
    await this.runCompletionPhase();

    // Results summary
    this.log('', 'info');
    this.log('📊 Test Session Results', 'info');
    await this.generateTestResults();
  }

  async runManagerPlanningPhase() {
    const planningEvents = [
      {
        agentType: 'manager',
        messageType: 'coordination_event',
        message: 'Initializing dual-agent session for e-commerce catalog implementation',
        metadata: {
          eventType: 'AGENT_COORDINATION',
          eventData: {
            phase: 'initialization',
            agentRole: 'strategic-planning',
            taskComplexity: 'high'
          },
          timestamp: new Date().toISOString(),
          workflowPhase: 'planning',
          overallProgress: 0.05
        }
      },
      {
        agentType: 'manager',
        messageType: 'prompt',
        message: 'Analyzing task requirements and architectural considerations',
        metadata: {
          eventType: 'AGENT_COORDINATION',
          eventData: {
            analysis: {
              requirements: ['Product catalog', 'Search functionality', 'Filtering system', 'Inventory management'],
              technologies: ['React', 'Node.js', 'Express', 'MongoDB', 'Elasticsearch'],
              estimatedComplexity: 'high',
              estimatedTimeHours: 12
            }
          },
          timestamp: new Date().toISOString(),
          workflowPhase: 'planning',
          overallProgress: 0.1
        }
      },
      {
        agentType: 'manager',
        messageType: 'coordination_event',
        message: 'Task decomposition completed - 6 work items identified',
        metadata: {
          eventType: 'MANAGER_TASK_ASSIGNMENT',
          eventData: {
            workItems: [
              {
                id: 'wi-1',
                title: 'Setup project structure and dependencies',
                priority: 'high',
                estimatedHours: 1,
                dependencies: []
              },
              {
                id: 'wi-2',
                title: 'Implement product data models and database schema',
                priority: 'high',
                estimatedHours: 2,
                dependencies: ['wi-1']
              },
              {
                id: 'wi-3',
                title: 'Build REST API endpoints for product CRUD operations',
                priority: 'high',
                estimatedHours: 3,
                dependencies: ['wi-2']
              },
              {
                id: 'wi-4',
                title: 'Implement search functionality with Elasticsearch integration',
                priority: 'medium',
                estimatedHours: 3,
                dependencies: ['wi-3']
              },
              {
                id: 'wi-5',
                title: 'Create advanced filtering system with faceted search',
                priority: 'medium',
                estimatedHours: 2,
                dependencies: ['wi-4']
              },
              {
                id: 'wi-6',
                title: 'Implement inventory management with real-time updates',
                priority: 'low',
                estimatedHours: 1,
                dependencies: ['wi-3']
              }
            ],
            totalEstimatedHours: 12,
            criticalPath: ['wi-1', 'wi-2', 'wi-3', 'wi-4']
          },
          timestamp: new Date().toISOString(),
          workflowPhase: 'planning',
          overallProgress: 0.15
        }
      },
      {
        agentType: 'manager',
        messageType: 'coordination_event',
        message: 'Quality gates established with success criteria defined',
        metadata: {
          eventType: 'AGENT_COORDINATION',
          eventData: {
            qualityGates: [
              {
                gate: 'code_quality',
                criteria: ['TypeScript compliance', 'ESLint passing', 'Unit test coverage > 80%']
              },
              {
                gate: 'functionality',
                criteria: ['All API endpoints working', 'Search returning relevant results', 'Filtering accurate']
              },
              {
                gate: 'performance',
                criteria: ['API response time < 200ms', 'Search results < 500ms', 'Page load time < 2s']
              }
            ]
          },
          timestamp: new Date().toISOString(),
          workflowPhase: 'planning',
          overallProgress: 0.2
        }
      }
    ];

    for (const event of planningEvents) {
      await this.sendMonitoringEvent(event);
      await this.delay(DELAYS.between_events);
    }
  }

  async runCoordinationPhase() {
    const coordinationEvents = [
      {
        agentType: 'manager',
        messageType: 'coordination_event',
        message: 'Initiating handoff to Worker Agent for first work item',
        metadata: {
          eventType: 'MANAGER_WORKER_HANDOFF',
          eventData: {
            workItem: {
              id: 'wi-1',
              title: 'Setup project structure and dependencies',
              context: 'Initialize Node.js project with TypeScript, Express, and MongoDB',
              priority: 'high'
            },
            handoffReason: 'ready_for_implementation',
            expectedDeliverable: 'Fully configured project with package.json and initial file structure',
            handoffCount: 1
          },
          timestamp: new Date().toISOString(),
          workflowPhase: 'coordination',
          overallProgress: 0.25
        }
      },
      {
        agentType: 'manager',
        messageType: 'coordination_event',
        message: 'Providing detailed implementation context to Worker',
        metadata: {
          eventType: 'AGENT_COORDINATION',
          eventData: {
            contextProvided: {
              techStack: ['Node.js 18+', 'TypeScript 5.x', 'Express 4.x', 'MongoDB 7.x', 'Mongoose ODM'],
              projectStructure: ['src/', 'tests/', 'config/', 'types/', 'middleware/'],
              dependencies: ['express', 'mongoose', 'typescript', 'jest', 'eslint'],
              devDependencies: ['@types/node', '@types/express', 'ts-node', 'nodemon']
            },
            successCriteria: ['Project builds without errors', 'All dependencies installed', 'TypeScript configuration valid']
          },
          timestamp: new Date().toISOString(),
          workflowPhase: 'coordination',
          overallProgress: 0.27
        }
      }
    ];

    for (const event of coordinationEvents) {
      await this.sendMonitoringEvent(event);
      await this.delay(DELAYS.between_events);
    }
  }

  async runWorkerExecutionPhase() {
    const executionEvents = [
      {
        agentType: 'worker',
        messageType: 'response',
        message: 'Acknowledging work item assignment and starting implementation',
        metadata: {
          eventType: 'WORKER_PROGRESS_UPDATE',
          eventData: {
            workItemId: 'wi-1',
            status: 'started',
            acknowledgedContext: true,
            plannedApproach: [
              'Initialize npm project with TypeScript configuration',
              'Install and configure essential dependencies',
              'Set up project directory structure',
              'Configure build and development scripts'
            ],
            estimatedTimeRemaining: 60 // minutes
          },
          timestamp: new Date().toISOString(),
          workflowPhase: 'execution',
          overallProgress: 0.3
        }
      },
      {
        agentType: 'worker',
        messageType: 'response',
        message: 'Project structure created, configuring TypeScript and dependencies',
        metadata: {
          eventType: 'WORKER_PROGRESS_UPDATE',
          eventData: {
            workItemId: 'wi-1',
            status: 'in_progress',
            completedSteps: [
              'Created package.json with project metadata',
              'Configured TypeScript with tsconfig.json',
              'Set up ESLint and Prettier configurations'
            ],
            currentStep: 'Installing dependencies and configuring build scripts',
            nextSteps: ['Configure Jest for testing', 'Set up development server'],
            progress: 0.6,
            estimatedTimeRemaining: 25
          },
          timestamp: new Date().toISOString(),
          workflowPhase: 'execution',
          overallProgress: 0.38
        }
      },
      {
        agentType: 'worker',
        messageType: 'response',
        message: 'Work item completed successfully - project setup finalized',
        metadata: {
          eventType: 'WORKER_PROGRESS_UPDATE',
          eventData: {
            workItemId: 'wi-1',
            status: 'completed',
            completedSteps: [
              'Package.json configured with all dependencies',
              'TypeScript configuration optimized for Node.js',
              'Project structure created (/src, /tests, /config, /types)',
              'Build scripts configured (build, dev, test, lint)',
              'Development environment ready with nodemon',
              'Jest testing framework configured',
              'Initial file structure with index.ts and basic Express setup'
            ],
            deliverables: [
              'package.json with 15 dependencies configured',
              'tsconfig.json with strict type checking',
              'Project directory structure with 7 folders',
              'Working development server on port 3000'
            ],
            qualityChecks: [
              'TypeScript compilation successful',
              'ESLint passes with zero warnings',
              'Development server starts without errors',
              'Jest test runner configured and working'
            ],
            nextWorkItemReady: 'wi-2',
            estimatedTimeRemaining: 0
          },
          timestamp: new Date().toISOString(),
          workflowPhase: 'execution',
          overallProgress: 0.45
        }
      },
      {
        agentType: 'worker',
        messageType: 'response',
        message: 'Starting work on data models and database schema',
        metadata: {
          eventType: 'WORKER_PROGRESS_UPDATE',
          eventData: {
            workItemId: 'wi-2',
            status: 'started',
            approach: [
              'Design Product schema with all required fields',
              'Create Category and Brand supporting models',
              'Implement Mongoose models with validation',
              'Set up database connection and configuration',
              'Create initial data seeding scripts'
            ],
            estimatedTimeRemaining: 120
          },
          timestamp: new Date().toISOString(),
          workflowPhase: 'execution',
          overallProgress: 0.5
        }
      },
      {
        agentType: 'worker',
        messageType: 'response',
        message: 'Database models completed with comprehensive validation',
        metadata: {
          eventType: 'WORKER_PROGRESS_UPDATE',
          eventData: {
            workItemId: 'wi-2',
            status: 'completed',
            completedSteps: [
              'Product model created with 12 fields (name, description, price, etc.)',
              'Category model with hierarchical structure support',
              'Brand model with metadata and logo support',
              'Inventory model for stock tracking',
              'User model for authentication (bonus)',
              'Database connection configured with retry logic',
              'Mongoose validation rules implemented',
              'Initial seed data created (50 sample products)',
              'Database indexes configured for performance'
            ],
            metricsAchieved: {
              modelsCreated: 5,
              validationRules: 23,
              databaseIndexes: 8,
              seedDataRecords: 50
            },
            performanceOptimizations: [
              'Compound indexes for search queries',
              'TTL indexes for session data',
              'Text indexes for full-text search'
            ],
            estimatedTimeRemaining: 0
          },
          timestamp: new Date().toISOString(),
          workflowPhase: 'execution',
          overallProgress: 0.65
        }
      }
    ];

    for (const event of executionEvents) {
      await this.sendMonitoringEvent(event);
      await this.delay(DELAYS.between_events);
    }
  }

  async runErrorRecoveryPhase() {
    const errorEvents = [
      {
        agentType: 'worker',
        messageType: 'error',
        message: 'Encountered dependency conflict during Elasticsearch integration',
        metadata: {
          eventType: 'WORKER_PROGRESS_UPDATE',
          eventData: {
            workItemId: 'wi-4',
            status: 'blocked',
            error: {
              type: 'dependency_conflict',
              message: 'Elasticsearch client version conflict with existing dependencies',
              stack: '@elastic/elasticsearch@8.x conflicts with @types/node@18.x',
              context: 'Installing search functionality dependencies'
            },
            attemptedSolutions: [
              'Tried downgrading Elasticsearch client to 7.x',
              'Attempted to update Node.js types',
              'Checked peer dependency requirements'
            ],
            requiresManagerIntervention: true,
            blockedSince: new Date().toISOString()
          },
          timestamp: new Date().toISOString(),
          workflowPhase: 'execution',
          overallProgress: 0.68
        }
      },
      {
        agentType: 'manager',
        messageType: 'coordination_event',
        message: 'Analyzing Worker error and providing resolution strategy',
        metadata: {
          eventType: 'MANAGER_QUALITY_CHECK',
          eventData: {
            errorAnalysis: {
              rootCause: 'Version compatibility issue between Elasticsearch client and TypeScript definitions',
              severity: 'medium',
              impact: 'Search functionality implementation delayed',
              estimatedResolutionTime: 30 // minutes
            },
            resolutionStrategy: [
              'Use Elasticsearch 7.17.x for better Node 18 compatibility',
              'Add explicit type overrides for conflicting definitions',
              'Update project TypeScript configuration for compatibility',
              'Consider alternative search library if issues persist'
            ],
            alternativeApproaches: [
              'Implement basic text search with MongoDB text indexes',
              'Use Algolia search service for external search capability',
              'Implement custom search with PostgreSQL full-text search'
            ]
          },
          timestamp: new Date().toISOString(),
          workflowPhase: 'error_recovery',
          overallProgress: 0.68
        }
      },
      {
        agentType: 'manager',
        messageType: 'coordination_event',
        message: 'Providing updated implementation guidance to Worker',
        metadata: {
          eventType: 'MANAGER_WORKER_HANDOFF',
          eventData: {
            workItem: {
              id: 'wi-4',
              title: 'Implement search functionality with Elasticsearch integration',
              updatedContext: 'Use Elasticsearch 7.17.x with compatibility overrides'
            },
            resolutionInstructions: [
              'Install @elastic/elasticsearch@7.17.24',
              'Add type declaration overrides in types/elasticsearch.d.ts',
              'Update search implementation to use v7 API patterns',
              'Test search functionality with sample product data'
            ],
            fallbackPlan: 'MongoDB text search if Elasticsearch integration fails',
            handoffCount: 2,
            isErrorRecovery: true
          },
          timestamp: new Date().toISOString(),
          workflowPhase: 'error_recovery',
          overallProgress: 0.7
        }
      },
      {
        agentType: 'worker',
        messageType: 'response',
        message: 'Error resolved - Elasticsearch integration successful with v7.17.x',
        metadata: {
          eventType: 'WORKER_PROGRESS_UPDATE',
          eventData: {
            workItemId: 'wi-4',
            status: 'completed',
            errorResolution: {
              resolved: true,
              resolutionApproach: 'Downgraded to Elasticsearch 7.17.24',
              resolutionTime: 25, // minutes
              lessonsLearned: [
                'Always check dependency compatibility matrices',
                'Consider LTS versions for better stability',
                'Test integration in isolated environment first'
              ]
            },
            completedSteps: [
              'Successfully installed Elasticsearch 7.17.24',
              'Created search service with connection pooling',
              'Implemented product indexing functionality',
              'Built search API endpoints with relevance scoring',
              'Added search query optimization and caching',
              'Tested with 1000+ product search queries'
            ],
            performanceMetrics: {
              averageSearchTime: '145ms',
              indexingTime: '2.3s for 1000 products',
              searchAccuracy: '94%',
              cacheHitRate: '78%'
            }
          },
          timestamp: new Date().toISOString(),
          workflowPhase: 'execution',
          overallProgress: 0.82
        }
      }
    ];

    for (const event of errorEvents) {
      await this.sendMonitoringEvent(event);
      await this.delay(DELAYS.error_recovery);
    }
  }

  async runQualityValidationPhase() {
    const validationEvents = [
      {
        agentType: 'manager',
        messageType: 'coordination_event',
        message: 'Initiating comprehensive quality validation of completed work',
        metadata: {
          eventType: 'MANAGER_QUALITY_CHECK',
          eventData: {
            validationType: 'comprehensive_review',
            workItemsToValidate: ['wi-1', 'wi-2', 'wi-3', 'wi-4'],
            validationCriteria: [
              'Code quality and TypeScript compliance',
              'API functionality and error handling',
              'Database schema integrity and performance',
              'Search functionality accuracy and speed',
              'Test coverage and documentation'
            ],
            estimatedValidationTime: 45 // minutes
          },
          timestamp: new Date().toISOString(),
          workflowPhase: 'validation',
          overallProgress: 0.85
        }
      },
      {
        agentType: 'manager',
        messageType: 'coordination_event',
        message: 'Quality validation completed - All work items meet success criteria',
        metadata: {
          eventType: 'MANAGER_QUALITY_CHECK',
          eventData: {
            validationResults: [
              {
                workItemId: 'wi-1',
                passed: true,
                qualityScore: 0.92,
                feedback: [
                  'Excellent project structure and configuration',
                  'TypeScript setup follows best practices',
                  'Good dependency management and scripts'
                ],
                metrics: {
                  codeQuality: 0.95,
                  testCoverage: 0.88,
                  documentation: 0.91
                }
              },
              {
                workItemId: 'wi-2',
                passed: true,
                qualityScore: 0.89,
                feedback: [
                  'Well-designed database schema with proper validation',
                  'Good use of Mongoose features and indexes',
                  'Comprehensive data models'
                ],
                metrics: {
                  schemaDesign: 0.93,
                  validationRules: 0.87,
                  performance: 0.88
                }
              },
              {
                workItemId: 'wi-3',
                passed: true,
                qualityScore: 0.91,
                feedback: [
                  'Robust API endpoints with proper error handling',
                  'Good HTTP status code usage',
                  'Comprehensive request validation'
                ],
                metrics: {
                  apiDesign: 0.92,
                  errorHandling: 0.89,
                  security: 0.91
                }
              },
              {
                workItemId: 'wi-4',
                passed: true,
                qualityScore: 0.87,
                feedback: [
                  'Search functionality works well with good performance',
                  'Recovery from dependency issue handled excellently',
                  'Could improve search result ranking algorithm'
                ],
                metrics: {
                  searchAccuracy: 0.89,
                  performance: 0.86,
                  integration: 0.85
                }
              }
            ],
            overallQualityScore: 0.90,
            criticalIssuesFound: 0,
            recommendationsCount: 3,
            validationPassed: true
          },
          timestamp: new Date().toISOString(),
          workflowPhase: 'validation',
          overallProgress: 0.95
        }
      }
    ];

    for (const event of validationEvents) {
      await this.sendMonitoringEvent(event);
      await this.delay(DELAYS.between_events);
    }
  }

  async runCompletionPhase() {
    const completionEvents = [
      {
        agentType: 'manager',
        messageType: 'coordination_event',
        message: 'Session completion initiated - Generating final summary',
        metadata: {
          eventType: 'WORKFLOW_TRANSITION',
          eventData: {
            fromPhase: 'validation',
            toPhase: 'completion',
            completedWorkItems: 4,
            totalWorkItems: 6,
            skippedWorkItems: [
              { id: 'wi-5', reason: 'Deprioritized for MVP', title: 'Advanced filtering system' },
              { id: 'wi-6', reason: 'Moved to phase 2', title: 'Inventory management' }
            ],
            sessionDuration: Math.round((Date.now() - this.startTime) / 1000 / 60), // minutes
            totalEvents: this.eventCount
          },
          timestamp: new Date().toISOString(),
          workflowPhase: 'completion',
          overallProgress: 0.98
        }
      },
      {
        agentType: 'manager',
        messageType: 'coordination_event',
        message: 'Dual-agent session completed successfully with high-quality deliverables',
        metadata: {
          eventType: 'AGENT_COORDINATION',
          eventData: {
            sessionSummary: {
              taskCompleted: 'E-commerce product catalog with search functionality',
              deliverables: [
                'Fully configured Node.js/TypeScript project structure',
                'Complete database schema with 5 models and validation',
                'RESTful API with CRUD operations and error handling',
                'Elasticsearch integration with optimized search performance',
                'Comprehensive test suite with 88% coverage',
                'Development environment with hot-reload and debugging'
              ],
              metrics: {
                totalWorkItems: 4,
                completionRate: '100% (4/4 core items)',
                overallQualityScore: 0.90,
                sessionDuration: Math.round((Date.now() - this.startTime) / 1000 / 60),
                errorEncounters: 1,
                errorResolutions: 1,
                managerWorkerHandoffs: 3,
                qualityGatesPassed: 4
              },
              performanceHighlights: [
                'API response time: < 200ms average',
                'Search performance: 145ms average',
                'Database query optimization: 40% faster than baseline',
                'Error recovery time: 25 minutes'
              ],
              collaborationEffectiveness: {
                coordinationSmoothnotes: 0.88,
                handoffEfficiency: 0.92,
                errorRecoverySuccess: 1.0,
                qualityGateSuccess: 1.0
              }
            },
            nextSteps: [
              'Deploy to staging environment for testing',
              'Implement remaining work items (filtering, inventory)',
              'Conduct user acceptance testing',
              'Prepare for production deployment'
            ],
            sessionRating: 'excellent'
          },
          timestamp: new Date().toISOString(),
          workflowPhase: 'completion',
          overallProgress: 1.0
        }
      }
    ];

    for (const event of completionEvents) {
      await this.sendMonitoringEvent(event);
      await this.delay(DELAYS.between_events);
    }
  }

  async generateTestResults() {
    const endTime = Date.now();
    const durationMs = endTime - this.startTime;
    const durationMin = Math.round(durationMs / 1000 / 60 * 100) / 100;
    
    this.log(`Total events sent: ${this.eventCount}`, 'success');
    this.log(`Test duration: ${durationMin} minutes`, 'success');
    this.log(`Errors encountered: ${this.errors.length}`, this.errors.length > 0 ? 'error' : 'success');
    this.log(`WebSocket messages received: ${this.websocketMessages.length}`, 'success');
    
    if (this.errors.length > 0) {
      this.log('Errors encountered:', 'error');
      this.errors.forEach((error, index) => {
        this.log(`  ${index + 1}. ${error}`, 'error');
      });
    }
    
    this.log('', 'info');
    this.log('🎯 Verification Steps:', 'info');
    this.log(`1. Open dashboard at ${DASHBOARD_URL}`, 'info');
    this.log(`2. Look for session: ${SESSION_ID}`, 'info');
    this.log('3. Verify all phases appear: planning → coordination → execution → validation → completion', 'info');
    this.log('4. Check that error recovery phase shows resolved status', 'info');
    this.log('5. Confirm quality scores and metrics are displayed', 'info');
    this.log('6. Test session replay functionality', 'info');
    
    this.log('', 'info');
    this.log('📈 Expected Dashboard Features to Verify:', 'info');
    this.log('- Real-time agent activity visualization', 'info');
    this.log('- Manager-Worker communication timeline', 'info');
    this.log('- Progress tracking with overall completion percentage', 'info');
    this.log('- Error tracking and resolution status', 'info');
    this.log('- Performance metrics and quality scores', 'info');
    this.log('- Session replay controls', 'info');

    // Close WebSocket connection
    if (this.websocket) {
      this.websocket.close();
    }
  }
}

// Main execution
async function main() {
  const tester = new DualAgentSessionTester();
  
  try {
    await tester.runCompleteSession();
  } catch (error) {
    console.error('❌ Test session failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Test terminated');
  process.exit(0);
});

// Run the test
main().catch(console.error);