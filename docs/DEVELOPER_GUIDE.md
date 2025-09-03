# Developer Guide - Visual Agent Management Platform

## 🎯 **Overview**

This comprehensive guide provides everything developers need to understand, contribute to, and extend the Visual Agent Management Platform. The platform enables visual management of parallel Claude Code CLI agents with real-time workflow orchestration and comprehensive monitoring.

**Platform Vision:** A Windows-based visual interface for managing multiple Claude Code CLI agents, allowing users to create Manager and Worker agents, watch them communicate in real-time, manage task handoffs, and control development workflows through an intuitive UI.

---

## 🚀 **Quick Start for Developers**

### **Prerequisites**
- **Windows 10/11** (primary target platform)
- **Python 3.8+** with pip
- **Node.js 18+** with pnpm
- **Claude CLI** installed and authenticated (`npm install -g @anthropic-ai/claude-code`)
- **Git** for version control
- **PostgreSQL 13+** (production) or SQLite (development)
- **VS Code** or similar IDE with TypeScript/Python support

### **Development Environment Setup**

#### **1. Clone and Initial Setup**
```bash
# Clone repository
git clone https://github.com/yossiashkenazi/automatic-claude-code
cd automatic-claude-code

# Install dependencies
pnpm install
pnpm run build

# Enable global 'acc' command
npm link

# Verify Claude CLI installation
claude --version
claude auth status
```

#### **2. Backend Development Environment**
```bash
# Navigate to Python SDK
cd python-sdk

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Install Python dependencies
pip install -r requirements.txt
pip install -e .  # Install in development mode

# Verify installation
python -c "from claude_cli_wrapper import ClaudeCLIWrapper; print('SDK OK')"
```

#### **3. Frontend Development Environment**
```bash
# Navigate to React dashboard
cd dual-agent-monitor

# Install dependencies
pnpm install

# Start development server
pnpm run dev  # Runs on http://localhost:6011
```

#### **4. Database Setup (Development)**
```bash
# For SQLite (development)
cd python-sdk
python -c "from database.connection import create_tables; create_tables()"

# For PostgreSQL (production)
# 1. Install PostgreSQL 13+
# 2. Create database: createdb visual_agent_platform
# 3. Run migrations: python database/migrations/run_migrations.py
```

#### **5. Full System Integration Test**
```bash
# Terminal 1: Start backend API
cd python-sdk
python api/main.py

# Terminal 2: Start frontend
cd dual-agent-monitor
pnpm run dev

# Terminal 3: Test integration
curl http://localhost:4005/api/health
# Should return: {"status": "healthy", ...}

# Open browser: http://localhost:6011
# Should show Visual Agent Management Dashboard
```

---

## 🏗️ **Architecture Deep Dive**

### **System Architecture Overview**

The platform uses a multi-layered architecture designed for scalability, maintainability, and real-time performance:

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER INTERFACE LAYER                       │
│                   (React 18 + TypeScript)                      │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Agent Dashboard │  │ Workflow Canvas │  │ Task Management │  │
│  │ - Creation UI   │  │ - Real-time vis │  │ - Drag & Drop   │  │
│  │ - Status Monitor│  │ - Agent Comms   │  │ - Progress Track│  │
│  │ - Controls      │  │ - Flow Animation│  │ - Results View  │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────┬───────────────────────────────────────────┘
                      │ WebSocket (Real-time) + HTTP (CRUD)
┌─────────────────────▼───────────────────────────────────────────┐
│                  ORCHESTRATION LAYER                           │
│                 (FastAPI + AsyncIO)                            │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Agent Manager   │  │ Task Processor  │  │ Communication   │  │
│  │ - Lifecycle     │  │ - Distribution  │  │ - Hub           │  │
│  │ - Health Monitor│  │ - Coordination  │  │ - WebSocket     │  │
│  │ - Recovery      │  │ - Dependencies  │  │ - Broadcasting  │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────┬───────────────────────────────────────────┘
                      │ Process Management + CLI Integration
┌─────────────────────▼───────────────────────────────────────────┐
│                   CLI WRAPPER LAYER                            │
│                 (Enhanced Python)                              │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Multi-Agent     │  │ Process Pool    │  │ Communication   │  │
│  │ CLI Wrapper     │  │ Manager         │  │ Protocol        │  │
│  │ - Agent Spawn   │  │ - Epic 3 Mgmt   │  │ - Message Parse │  │
│  │ - Isolation     │  │ - Resource Ctrl │  │ - Error Handle  │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────┬───────────────────────────────────────────┘
                      │ Direct CLI Execution
┌─────────────────────▼───────────────────────────────────────────┐
│                  CLAUDE CODE CLI AGENTS                        │
│                 (Multiple Instances)                           │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Manager Agent   │  │ Worker Agent 1  │  │ Worker Agent N  │  │
│  │ - Task Breakdown│  │ - Specialized   │  │ - Specialized   │  │
│  │ - Coordination  │  │ - Implementation│  │ - Implementation│  │
│  │ - Quality Gates │  │ - Execution     │  │ - Execution     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### **Data Flow Architecture**

```
User Action → React Component → Redux Store → WebSocket/HTTP → FastAPI → Agent Manager → CLI Wrapper → Claude CLI → Response → WebSocket Broadcast → Real-time UI Update
```

### **Key Architectural Principles**

1. **Real-time First**: Everything updates in real-time via WebSocket
2. **Process Isolation**: Each agent runs in isolated CLI process  
3. **Fault Tolerance**: Epic 3 system ensures clean process management
4. **Scalable Design**: Support 2-10 concurrent agents efficiently
5. **Visual Focus**: All operations have corresponding UI representations
6. **Recovery Oriented**: Automatic error detection and recovery procedures

---

## 📁 **Codebase Structure**

### **Repository Overview**
```
automatic-claude-code/
├── docs/                              # Documentation
│   ├── VISUAL_AGENT_MANAGEMENT_PRD.md # Product requirements
│   ├── EPIC_STRUCTURE.md             # Development roadmap
│   ├── TECHNICAL_ARCHITECTURE.md     # System architecture
│   ├── INTEGRATION_GUIDE.md          # Integration instructions
│   ├── API_SPECIFICATION.md          # API documentation
│   └── DEVELOPER_GUIDE.md            # This file
│
├── python-sdk/                       # Backend Python components
│   ├── claude_cli_wrapper.py         # Production CLI wrapper (v1.1.1)
│   ├── agent_orchestrator/           # Agent management system
│   ├── multi_agent_wrapper/          # Multi-agent CLI support
│   ├── api/                          # FastAPI application
│   ├── database/                     # Database models and connections
│   ├── websocket/                    # WebSocket communication
│   └── tests/                        # Python test suite
│
├── dual-agent-monitor/               # Frontend React application
│   ├── src/                          # Source code
│   │   ├── components/               # React components
│   │   │   ├── AgentManagement/      # Agent creation and control
│   │   │   ├── WorkflowCanvas/       # Visual workflow display
│   │   │   ├── TaskManagement/       # Task assignment interface
│   │   │   ├── Communication/        # Agent chat visualization
│   │   │   └── Dashboard/            # Overview and metrics
│   │   ├── hooks/                    # Custom React hooks
│   │   ├── services/                 # API and WebSocket clients
│   │   ├── store/                    # Redux state management
│   │   └── types/                    # TypeScript type definitions
│   ├── public/                       # Static assets
│   └── tests/                        # Frontend test suite
│
├── src/                              # CLI tool source (TypeScript)
│   ├── commands/                     # Command implementations
│   ├── utils/                        # Utility functions
│   └── index.ts                      # Entry point
│
├── tests/                            # Integration tests
├── .claude/                          # Claude CLI configuration
│   ├── hooks/                        # Event monitoring hooks
│   └── settings.local.json           # Local configuration
│
└── Configuration files
    ├── package.json                  # Node.js dependencies
    ├── tsconfig.json                 # TypeScript configuration
    ├── docker-compose.yml            # Docker deployment
    └── README.md                     # Project overview
```

### **Frontend Component Architecture**

```
dual-agent-monitor/src/components/
├── AgentManagement/
│   ├── AgentCreator.tsx              # Agent creation form
│   ├── AgentCard.tsx                 # Individual agent display
│   ├── AgentList.tsx                 # List all agents
│   ├── AgentSettings.tsx             # Configuration panel
│   ├── StatusIndicator.tsx           # Real-time status display
│   └── ResourceMonitor.tsx           # Resource usage charts
│
├── WorkflowCanvas/
│   ├── FlowCanvas.tsx                # Interactive canvas component
│   ├── AgentNode.tsx                 # Visual agent representation
│   ├── TaskFlow.tsx                  # Task flow visualization
│   ├── ConnectionLine.tsx            # Communication lines
│   ├── HandoffAnimation.tsx          # Task handoff effects
│   └── CanvasControls.tsx            # Zoom/pan/reset controls
│
├── TaskManagement/
│   ├── TaskCreator.tsx               # Task creation interface
│   ├── TaskQueue.tsx                 # Active task display
│   ├── TaskCard.tsx                  # Individual task component
│   ├── TaskAssignment.tsx            # Drag-drop assignment
│   ├── TaskOutput.tsx                # Results preview
│   └── TaskDependencies.tsx          # Dependency visualization
│
├── Communication/
│   ├── ChatView.tsx                  # Agent conversation display
│   ├── MessageBubble.tsx             # Message styling
│   ├── MessageFilter.tsx             # Filter controls
│   ├── DecisionHighlight.tsx         # Important decisions
│   ├── InterventionPanel.tsx         # Human intervention UI
│   └── ConversationExport.tsx        # Export functionality
│
└── Dashboard/
    ├── OverviewPanel.tsx             # System overview
    ├── MetricsDisplay.tsx            # Performance metrics
    ├── HealthIndicators.tsx          # System health
    ├── AlertPanel.tsx                # System alerts
    └── QuickActions.tsx              # Common actions
```

### **Backend Module Architecture**

```
python-sdk/
├── agent_orchestrator/               # Core agent management
│   ├── agent_manager.py              # Agent lifecycle management
│   ├── task_processor.py             # Task distribution logic
│   ├── communication_hub.py          # Inter-agent communication
│   ├── workflow_engine.py            # Workflow execution
│   ├── resource_monitor.py           # System resource tracking
│   └── recovery_manager.py           # Error recovery procedures
│
├── multi_agent_wrapper/              # CLI integration layer
│   ├── cli_wrapper.py                # Enhanced CLI wrapper
│   ├── process_manager.py            # Process pool management
│   ├── agent_process.py              # Individual agent handling
│   ├── communication_protocol.py     # Agent communication
│   └── output_parser.py              # CLI response parsing
│
├── api/                              # FastAPI REST API
│   ├── main.py                       # Application entry point
│   ├── routes/                       # API endpoints
│   │   ├── agents.py                 # Agent management
│   │   ├── tasks.py                  # Task management
│   │   ├── workflow.py               # Workflow control
│   │   └── system.py                 # System status
│   └── models/                       # Pydantic data models
│
├── websocket/                        # Real-time communication
│   ├── connection_manager.py         # WebSocket connections
│   ├── message_router.py             # Message routing
│   ├── event_broadcaster.py          # Event broadcasting
│   └── handlers.py                   # Message handlers
│
└── database/                         # Data persistence
    ├── models.py                     # SQLAlchemy models
    ├── connection.py                 # Database connections
    ├── repositories/                 # Data access layer
    └── migrations/                   # Schema migrations
```

---

## 🛠️ **Development Workflow**

### **Git Workflow & Branch Strategy**

#### **Branch Structure**
```
main                    # Production-ready code
├── develop            # Integration branch for features
├── feature/agent-ui   # Feature development
├── feature/websocket  # Feature development
├── bugfix/memory-leak # Bug fixes
└── hotfix/critical    # Critical production fixes
```

#### **Development Process**
```bash
# 1. Start new feature
git checkout develop
git pull origin develop
git checkout -b feature/new-agent-management

# 2. Make changes and commit frequently
git add .
git commit -m "feat: add agent creation UI component"

# 3. Push and create pull request
git push origin feature/new-agent-management
# Create PR: feature/new-agent-management → develop

# 4. After PR approval, merge to develop
# 5. Periodic merges: develop → main for releases
```

#### **Commit Message Convention**
```bash
# Format: type(scope): description
feat(agent): add multi-agent CLI wrapper support
fix(websocket): resolve connection timeout issues  
docs(api): update endpoint specifications
test(integration): add agent lifecycle tests
refactor(ui): improve component organization
perf(database): optimize agent status queries
chore(deps): update TypeScript to 5.2.0
```

### **Testing Strategy**

#### **Frontend Testing (React + TypeScript)**
```bash
cd dual-agent-monitor

# Unit tests (Jest + React Testing Library)
pnpm test

# Component tests
pnpm test:components

# Integration tests
pnpm test:integration

# E2E tests (Playwright)
pnpm test:e2e

# Coverage report
pnpm test:coverage
```

**Example Component Test:**
```typescript
// src/__tests__/components/AgentCreator.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { AgentCreator } from '../components/AgentManagement/AgentCreator';
import { store } from '../store/store';

describe('AgentCreator', () => {
  test('should create manager agent with valid configuration', async () => {
    render(
      <Provider store={store}>
        <AgentCreator />
      </Provider>
    );
    
    // Fill form
    fireEvent.change(screen.getByLabelText(/agent name/i), {
      target: { value: 'Test Manager' }
    });
    
    fireEvent.change(screen.getByLabelText(/role/i), {
      target: { value: 'manager' }
    });
    
    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /create agent/i }));
    
    // Verify API call
    await waitFor(() => {
      expect(screen.getByText(/agent created successfully/i)).toBeInTheDocument();
    });
  });
});
```

#### **Backend Testing (Python)**
```bash
cd python-sdk

# Unit tests
pytest tests/unit/

# Integration tests  
pytest tests/integration/

# CLI wrapper tests
pytest tests/test_claude_cli_wrapper.py

# API tests
pytest tests/api/

# Coverage report
pytest --cov=. tests/
```

**Example Backend Test:**
```python
# tests/test_agent_manager.py
import pytest
from unittest.mock import AsyncMock, MagicMock
from agent_orchestrator.agent_manager import AgentManager

@pytest.mark.asyncio
class TestAgentManager:
    async def test_create_agent_success(self):
        # Setup
        agent_manager = AgentManager()
        agent_manager.cli_wrapper = AsyncMock()
        agent_manager.cli_wrapper.create_agent.return_value = MagicMock(
            agent_id="test-agent-123",
            process_id=12345
        )
        
        # Execute
        agent = await agent_manager.create_agent({
            "role": "manager",
            "model": "sonnet",
            "name": "Test Manager"
        })
        
        # Verify
        assert agent.id == "test-agent-123"
        assert agent.role == "manager"
        assert agent.process_id == 12345
        agent_manager.cli_wrapper.create_agent.assert_called_once()
    
    async def test_create_agent_failure_max_agents(self):
        # Test maximum agents limit
        agent_manager = AgentManager()
        agent_manager.agents = {f"agent-{i}": MagicMock() for i in range(10)}
        
        with pytest.raises(RuntimeError, match="Maximum agents.*reached"):
            await agent_manager.create_agent({"role": "worker"})
```

#### **Integration Testing**
```bash
# Full system integration test
cd tests/integration
python test_full_system.py

# Agent coordination test
python test_manager_worker_coordination.py

# WebSocket communication test
python test_websocket_integration.py

# Performance test
python test_performance_load.py
```

### **Code Quality Standards**

#### **Python Code Standards (PEP 8 + Extensions)**
```python
# pyproject.toml
[tool.black]
line-length = 100
target-version = ['py38']

[tool.isort]
profile = "black"
line_length = 100

[tool.flake8]
max-line-length = 100
extend-ignore = ["E203", "W503"]

[tool.mypy]
python_version = "3.8"
strict = true
warn_return_any = true
warn_unused_configs = true
```

**Quality Check Commands:**
```bash
cd python-sdk

# Format code
black .
isort .

# Lint code
flake8 .
pylint src/

# Type checking
mypy .

# Security check
bandit -r .
```

#### **TypeScript Code Standards**
```json
// .eslintrc.json
{
  "extends": [
    "eslint:recommended",
    "@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

**Quality Check Commands:**
```bash
cd dual-agent-monitor

# Lint TypeScript
pnpm lint
pnpm lint:fix

# Type checking
pnpm type-check

# Format code
pnpm format
```

### **Performance Monitoring**

#### **Frontend Performance**
```typescript
// src/utils/performance.ts
export class PerformanceMonitor {
  static measureComponentRender(componentName: string) {
    return (target: any) => {
      const originalRender = target.prototype.render;
      target.prototype.render = function(...args: any[]) {
        const start = performance.now();
        const result = originalRender.apply(this, args);
        const end = performance.now();
        
        console.log(`${componentName} render time: ${end - start}ms`);
        return result;
      };
    };
  }
  
  static measureWebSocketLatency() {
    const startTime = Date.now();
    
    return {
      end: () => {
        const latency = Date.now() - startTime;
        if (latency > 100) {
          console.warn(`High WebSocket latency: ${latency}ms`);
        }
        return latency;
      }
    };
  }
}

// Usage
@PerformanceMonitor.measureComponentRender('AgentList')
export class AgentList extends React.Component {
  // Component implementation
}
```

#### **Backend Performance**
```python
# python-sdk/utils/performance.py
import time
import functools
import logging
from typing import Callable, Any

logger = logging.getLogger(__name__)

def measure_performance(func: Callable) -> Callable:
    """Decorator to measure function execution time"""
    @functools.wraps(func)
    async def async_wrapper(*args, **kwargs) -> Any:
        start_time = time.time()
        try:
            result = await func(*args, **kwargs)
            return result
        finally:
            execution_time = (time.time() - start_time) * 1000
            logger.info(f"{func.__name__} executed in {execution_time:.2f}ms")
            
            # Alert on slow operations
            if execution_time > 1000:  # 1 second
                logger.warning(f"Slow operation detected: {func.__name__} took {execution_time:.2f}ms")
    
    @functools.wraps(func)
    def sync_wrapper(*args, **kwargs) -> Any:
        start_time = time.time()
        try:
            result = func(*args, **kwargs)
            return result
        finally:
            execution_time = (time.time() - start_time) * 1000
            logger.info(f"{func.__name__} executed in {execution_time:.2f}ms")
    
    return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper

# Usage
@measure_performance
async def create_agent(self, config: dict) -> Agent:
    # Implementation
    pass
```

---

## 🔌 **Extension & Customization**

### **Creating Custom Agent Types**

#### **1. Define Agent Role**
```python
# python-sdk/agent_orchestrator/custom_agents.py
from enum import Enum
from dataclasses import dataclass
from typing import Dict, List, Any

class AgentRole(Enum):
    MANAGER = "manager"
    WORKER = "worker"
    SPECIALIST = "specialist"    # New custom role
    REVIEWER = "reviewer"        # New custom role

@dataclass
class SpecialistAgentConfig:
    specialization: str  # e.g., "frontend", "database", "testing"
    expertise_level: int  # 1-10 scale
    preferred_languages: List[str]
    tools: List[str]
    
class SpecialistAgent:
    def __init__(self, config: SpecialistAgentConfig):
        self.config = config
        self.role = AgentRole.SPECIALIST
    
    async def can_handle_task(self, task: Dict[str, Any]) -> bool:
        """Determine if this specialist can handle the task"""
        task_requirements = task.get("requirements", {})
        
        # Check language compatibility
        required_languages = task_requirements.get("languages", [])
        if required_languages and not any(lang in self.config.preferred_languages for lang in required_languages):
            return False
        
        # Check specialization match
        task_domain = task_requirements.get("domain")
        if task_domain and task_domain != self.config.specialization:
            return False
        
        return True
    
    async def process_task(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Process task with specialist knowledge"""
        # Implementation specific to specialist type
        pass
```

#### **2. Register Custom Agent in Frontend**
```typescript
// dual-agent-monitor/src/types/agent.ts
export enum AgentRole {
  MANAGER = 'manager',
  WORKER = 'worker', 
  SPECIALIST = 'specialist',
  REVIEWER = 'reviewer'
}

export interface SpecialistAgentConfig extends BaseAgentConfig {
  role: AgentRole.SPECIALIST;
  specialization: string;
  expertise_level: number;
  preferred_languages: string[];
  tools: string[];
}

// dual-agent-monitor/src/components/AgentManagement/AgentCreator.tsx
export const AgentCreator: React.FC = () => {
  const [agentType, setAgentType] = useState<AgentRole>(AgentRole.MANAGER);
  
  const renderSpecialistConfig = () => (
    <div className="specialist-config">
      <Select
        label="Specialization"
        value={config.specialization}
        onChange={(value) => setConfig({...config, specialization: value})}
        options={[
          { value: 'frontend', label: 'Frontend Development' },
          { value: 'backend', label: 'Backend Development' },
          { value: 'database', label: 'Database Design' },
          { value: 'testing', label: 'Quality Assurance' },
          { value: 'devops', label: 'DevOps & Deployment' }
        ]}
      />
      
      <MultiSelect
        label="Programming Languages"
        value={config.preferred_languages}
        onChange={(languages) => setConfig({...config, preferred_languages: languages})}
        options={[
          'Python', 'TypeScript', 'JavaScript', 'Go', 'Rust', 'Java', 'C#'
        ]}
      />
      
      <Slider
        label="Expertise Level"
        min={1}
        max={10}
        value={config.expertise_level}
        onChange={(level) => setConfig({...config, expertise_level: level})}
      />
    </div>
  );
  
  return (
    <form onSubmit={handleSubmit}>
      <Select
        label="Agent Type"
        value={agentType}
        onChange={setAgentType}
        options={[
          { value: AgentRole.MANAGER, label: 'Manager Agent' },
          { value: AgentRole.WORKER, label: 'Worker Agent' },
          { value: AgentRole.SPECIALIST, label: 'Specialist Agent' },
          { value: AgentRole.REVIEWER, label: 'Reviewer Agent' }
        ]}
      />
      
      {agentType === AgentRole.SPECIALIST && renderSpecialistConfig()}
      
      {/* Other configuration fields */}
    </form>
  );
};
```

### **Adding Custom Task Types**

#### **1. Define Custom Task**
```python
# python-sdk/agent_orchestrator/custom_tasks.py
from enum import Enum
from dataclasses import dataclass
from typing import Dict, List, Any, Optional

class TaskType(Enum):
    STANDARD = "standard"
    CODE_REVIEW = "code_review"      # Custom task type
    DEPLOYMENT = "deployment"        # Custom task type
    TESTING = "testing"             # Custom task type

@dataclass
class CodeReviewTask:
    task_type: TaskType = TaskType.CODE_REVIEW
    repository_url: str
    pull_request_id: str
    review_criteria: List[str]
    auto_approve_threshold: float = 0.8
    
    def to_agent_prompt(self) -> str:
        return f"""
        Please review the code in pull request #{self.pull_request_id} from {self.repository_url}.
        
        Focus on these criteria:
        {chr(10).join(f'- {criteria}' for criteria in self.review_criteria)}
        
        Provide:
        1. Overall quality score (0.0-1.0)
        2. List of issues found with severity levels
        3. Suggestions for improvement
        4. Approval recommendation
        """

class CustomTaskProcessor:
    @staticmethod
    async def process_code_review(task: CodeReviewTask, agent_id: str) -> Dict[str, Any]:
        """Process code review task with specialized logic"""
        
        # Send to appropriate agent (preferably a reviewer specialist)
        prompt = task.to_agent_prompt()
        
        # Execute via CLI wrapper
        result = await cli_wrapper.send_task(agent_id, {
            "type": "code_review",
            "prompt": prompt,
            "context": {
                "repository_url": task.repository_url,
                "pull_request_id": task.pull_request_id
            }
        })
        
        # Parse and enhance result
        parsed_result = parse_code_review_result(result)
        
        # Auto-approve if quality score meets threshold
        if parsed_result["quality_score"] >= task.auto_approve_threshold:
            parsed_result["recommendation"] = "APPROVE"
            # Trigger automatic approval workflow
        
        return parsed_result
```

#### **2. Frontend Support for Custom Tasks**
```typescript
// dual-agent-monitor/src/types/task.ts
export enum TaskType {
  STANDARD = 'standard',
  CODE_REVIEW = 'code_review',
  DEPLOYMENT = 'deployment',
  TESTING = 'testing'
}

export interface CodeReviewTask extends BaseTask {
  type: TaskType.CODE_REVIEW;
  repository_url: string;
  pull_request_id: string;
  review_criteria: string[];
  auto_approve_threshold: number;
}

// dual-agent-monitor/src/components/TaskManagement/CustomTaskCreator.tsx
export const CustomTaskCreator: React.FC = () => {
  const [taskType, setTaskType] = useState<TaskType>(TaskType.STANDARD);
  
  const renderCodeReviewConfig = () => (
    <div className="code-review-config">
      <Input
        label="Repository URL"
        value={config.repository_url}
        onChange={(value) => setConfig({...config, repository_url: value})}
        placeholder="https://github.com/user/repo"
      />
      
      <Input
        label="Pull Request ID"
        value={config.pull_request_id}
        onChange={(value) => setConfig({...config, pull_request_id: value})}
        placeholder="123"
      />
      
      <TagInput
        label="Review Criteria"
        value={config.review_criteria}
        onChange={(criteria) => setConfig({...config, review_criteria: criteria})}
        suggestions={[
          'Code Quality',
          'Performance',
          'Security',
          'Test Coverage',
          'Documentation'
        ]}
      />
      
      <Slider
        label="Auto-Approve Threshold"
        min={0}
        max={1}
        step={0.1}
        value={config.auto_approve_threshold}
        onChange={(threshold) => setConfig({...config, auto_approve_threshold: threshold})}
      />
    </div>
  );
  
  return (
    <div className="custom-task-creator">
      <Select
        label="Task Type"
        value={taskType}
        onChange={setTaskType}
        options={[
          { value: TaskType.STANDARD, label: 'Standard Task' },
          { value: TaskType.CODE_REVIEW, label: 'Code Review' },
          { value: TaskType.DEPLOYMENT, label: 'Deployment' },
          { value: TaskType.TESTING, label: 'Testing' }
        ]}
      />
      
      {taskType === TaskType.CODE_REVIEW && renderCodeReviewConfig()}
      
      <Button onClick={handleCreateTask}>
        Create {taskType.replace('_', ' ').toUpperCase()} Task
      </Button>
    </div>
  );
};
```

### **Creating Custom Visualizations**

#### **1. Custom Workflow Visualization Component**
```typescript
// dual-agent-monitor/src/components/CustomVisualization/CodeReviewFlow.tsx
import React from 'react';
import { useSelector } from 'react-redux';
import { Flow, Node, Edge } from 'reactflow';

export const CodeReviewFlow: React.FC = () => {
  const codeReviewTasks = useSelector(state => 
    state.tasks.items.filter(task => task.type === 'code_review')
  );
  
  const createFlowNodes = (): Node[] => {
    return codeReviewTasks.map(task => ({
      id: task.id,
      type: 'codeReviewNode',
      position: calculatePosition(task),
      data: {
        task,
        status: task.status,
        qualityScore: task.result?.quality_score || 0,
        approvalStatus: task.result?.recommendation || 'PENDING'
      }
    }));
  };
  
  const createFlowEdges = (): Edge[] => {
    // Create edges showing review flow
    return codeReviewTasks
      .filter(task => task.dependencies?.length > 0)
      .flatMap(task => 
        task.dependencies.map(dep => ({
          id: `${dep}-${task.id}`,
          source: dep,
          target: task.id,
          type: 'reviewEdge',
          animated: task.status === 'in_progress'
        }))
      );
  };
  
  const CustomCodeReviewNode = ({ data }: { data: any }) => (
    <div className={`code-review-node ${data.status}`}>
      <div className="node-header">
        <span className="task-title">{data.task.title}</span>
        <span className="pr-id">PR #{data.task.pull_request_id}</span>
      </div>
      
      <div className="quality-score">
        <CircularProgress 
          value={data.qualityScore * 100}
          color={data.qualityScore > 0.8 ? 'green' : data.qualityScore > 0.6 ? 'yellow' : 'red'}
        />
        <span>Quality: {(data.qualityScore * 100).toFixed(0)}%</span>
      </div>
      
      <div className={`approval-status ${data.approvalStatus?.toLowerCase()}`}>
        {data.approvalStatus}
      </div>
    </div>
  );
  
  const nodeTypes = {
    codeReviewNode: CustomCodeReviewNode
  };
  
  return (
    <div className="code-review-flow">
      <Flow
        nodes={createFlowNodes()}
        edges={createFlowEdges()}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Controls />
        <MiniMap />
      </Flow>
    </div>
  );
};
```

---

## 🚨 **Troubleshooting & Common Issues**

### **Development Environment Issues**

#### **Python Environment Problems**
```bash
# Issue: Claude CLI wrapper import fails
# Solution: Verify Python path and virtual environment

# Check Python installation
python --version  # Should be 3.8+
which python     # Verify correct Python binary

# Verify virtual environment
echo $VIRTUAL_ENV  # Should show venv path
pip list | grep claude  # Check if SDK installed

# Reinstall if needed
pip uninstall claude-cli-wrapper
pip install -e .

# Test installation
python -c "from claude_cli_wrapper import ClaudeCLIWrapper; print('OK')"
```

#### **Node.js/TypeScript Issues**
```bash
# Issue: TypeScript compilation errors
# Solution: Clear cache and reinstall

# Clear Node modules and cache
rm -rf node_modules package-lock.json
rm -rf dual-agent-monitor/node_modules dual-agent-monitor/package-lock.json
pnpm store prune

# Reinstall dependencies
pnpm install
cd dual-agent-monitor && pnpm install

# Verify TypeScript
pnpm tsc --version  # Should be 5.2+
pnpm run type-check  # Should pass without errors
```

#### **Claude CLI Authentication Issues**
```bash
# Issue: Claude CLI not authenticated
# Solution: Verify and re-authenticate

# Check current auth status
claude auth status

# If not authenticated, login
claude auth login

# Verify API access
claude --version
claude "Hello world" --model sonnet

# If still failing, check environment
echo $CLAUDE_API_KEY  # Should be empty (CLI uses its own auth)
echo $ANTHROPIC_API_KEY  # Should be empty

# Reset authentication if needed
claude auth logout
claude auth login
```

### **Runtime Issues**

#### **Agent Process Management**
```python
# Issue: Agents not starting or hanging
# Solution: Debug process management

import psutil
import subprocess

def debug_agent_processes():
    """Debug agent process issues"""
    
    # Check for existing Claude processes
    claude_processes = []
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            if 'claude' in proc.info['name'].lower():
                claude_processes.append(proc.info)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    
    print(f"Found {len(claude_processes)} Claude processes:")
    for proc in claude_processes:
        print(f"  PID: {proc['pid']}, CMD: {' '.join(proc['cmdline'][:3])}")
    
    # Test basic Claude CLI functionality
    try:
        result = subprocess.run(
            ['claude', '--version'], 
            capture_output=True, 
            text=True, 
            timeout=10
        )
        print(f"Claude CLI test: {result.returncode}")
        print(f"Output: {result.stdout}")
        if result.stderr:
            print(f"Errors: {result.stderr}")
    except subprocess.TimeoutExpired:
        print("Claude CLI test timed out - check installation")
    except FileNotFoundError:
        print("Claude CLI not found in PATH")

# Run debug
debug_agent_processes()
```

#### **WebSocket Connection Issues**
```typescript
// Issue: WebSocket connections failing or dropping
// Solution: Debug connection management

class WebSocketDebugger {
  static debugConnection(url: string = 'ws://localhost:4005/ws') {
    const socket = new WebSocket(url);
    
    socket.onopen = (event) => {
      console.log('✅ WebSocket connected:', event);
      
      // Test authentication
      socket.send(JSON.stringify({
        type: 'ping',
        timestamp: new Date().toISOString()
      }));
    };
    
    socket.onmessage = (event) => {
      console.log('📨 WebSocket message:', JSON.parse(event.data));
    };
    
    socket.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      
      // Check if backend is running
      fetch('http://localhost:4005/api/health')
        .then(response => {
          if (response.ok) {
            console.log('✅ Backend API is responding');
          } else {
            console.error('❌ Backend API error:', response.status);
          }
        })
        .catch(error => {
          console.error('❌ Backend API not reachable:', error);
        });
    };
    
    socket.onclose = (event) => {
      console.warn('🔌 WebSocket closed:', event.code, event.reason);
      
      // Attempt reconnection after delay
      setTimeout(() => {
        console.log('🔄 Attempting to reconnect...');
        WebSocketDebugger.debugConnection(url);
      }, 5000);
    };
    
    return socket;
  }
}

// Use debugger
const debugSocket = WebSocketDebugger.debugConnection();
```

#### **Performance Issues**
```python
# Issue: High memory usage or slow responses
# Solution: Performance profiling

import psutil
import time
import asyncio
from typing import Dict, Any

class PerformanceProfiler:
    def __init__(self):
        self.start_time = time.time()
        self.memory_snapshots = []
        self.operation_times = {}
    
    async def profile_agent_operation(self, operation_name: str, operation_func):
        """Profile specific agent operations"""
        
        # Take memory snapshot before
        process = psutil.Process()
        memory_before = process.memory_info().rss / 1024 / 1024  # MB
        
        # Time the operation
        start = time.time()
        try:
            result = await operation_func()
            success = True
        except Exception as e:
            result = None
            success = False
            print(f"Operation {operation_name} failed: {e}")
        
        end = time.time()
        
        # Take memory snapshot after
        memory_after = process.memory_info().rss / 1024 / 1024  # MB
        
        # Record metrics
        self.operation_times[operation_name] = {
            'duration_ms': (end - start) * 1000,
            'memory_before_mb': memory_before,
            'memory_after_mb': memory_after,
            'memory_delta_mb': memory_after - memory_before,
            'success': success
        }
        
        print(f"Operation: {operation_name}")
        print(f"  Duration: {(end - start) * 1000:.2f}ms")
        print(f"  Memory: {memory_before:.1f}MB → {memory_after:.1f}MB (Δ{memory_after - memory_before:+.1f}MB)")
        print(f"  Success: {success}")
        
        return result
    
    def get_system_resources(self) -> Dict[str, Any]:
        """Get current system resource usage"""
        return {
            'cpu_percent': psutil.cpu_percent(interval=1),
            'memory_percent': psutil.virtual_memory().percent,
            'memory_available_gb': psutil.virtual_memory().available / 1024 / 1024 / 1024,
            'disk_usage_percent': psutil.disk_usage('/').percent,
            'active_processes': len(psutil.pids())
        }

# Usage
profiler = PerformanceProfiler()

async def debug_performance():
    # Profile agent creation
    await profiler.profile_agent_operation(
        'create_agent',
        lambda: agent_manager.create_agent({'role': 'worker'})
    )
    
    # Profile task assignment
    await profiler.profile_agent_operation(
        'assign_task',
        lambda: agent_manager.assign_task('agent-123', {'title': 'test'})
    )
    
    # Check system resources
    resources = profiler.get_system_resources()
    print("System Resources:", resources)
```

### **Common Error Messages & Solutions**

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `AGENT_CREATION_FAILED: Maximum agents reached` | Too many agents running | Terminate unused agents or increase limit |
| `CLI_TIMEOUT: Agent not responding` | Agent process hung | Restart agent or check system resources |
| `WEBSOCKET_CONNECTION_LOST` | Backend server down | Restart backend server, check firewall |
| `DATABASE_CONNECTION_FAILED` | Database not accessible | Check DB connection string and service |
| `TASK_ASSIGNMENT_FAILED: Agent in error state` | Agent crashed | Check agent logs, restart if needed |
| `PERMISSION_DENIED: Insufficient privileges` | Authentication issue | Check JWT token and permissions |

---

## 📚 **Best Practices & Guidelines**

### **Code Organization**

#### **Frontend Best Practices**
1. **Component Structure**: Use functional components with hooks
2. **State Management**: Use Redux for global state, local state for component-specific data
3. **Type Safety**: Define comprehensive TypeScript interfaces
4. **Error Boundaries**: Implement error boundaries for robust error handling
5. **Performance**: Use React.memo, useMemo, useCallback for optimization

#### **Backend Best Practices**
1. **Async/Await**: Use async patterns consistently for I/O operations
2. **Error Handling**: Implement comprehensive exception handling
3. **Logging**: Use structured logging with appropriate levels
4. **Resource Management**: Proper cleanup of processes and connections
5. **Testing**: High test coverage with unit, integration, and e2e tests

### **Security Considerations**

#### **Input Validation**
```python
# Always validate and sanitize inputs
from pydantic import BaseModel, validator
from typing import List

class AgentConfigModel(BaseModel):
    role: str
    name: str
    model: str
    resource_limits: dict
    
    @validator('role')
    def validate_role(cls, v):
        allowed_roles = ['manager', 'worker', 'specialist', 'reviewer']
        if v not in allowed_roles:
            raise ValueError(f'Role must be one of {allowed_roles}')
        return v
    
    @validator('name')
    def validate_name(cls, v):
        if len(v) < 1 or len(v) > 100:
            raise ValueError('Name must be 1-100 characters')
        # Sanitize name to prevent injection attacks
        import re
        if not re.match(r'^[a-zA-Z0-9\s\-_]+$', v):
            raise ValueError('Name contains invalid characters')
        return v
```

#### **Process Security**
```python
# Secure process execution
import subprocess
import shlex
import os

def secure_subprocess_execution(command: List[str], env_vars: dict = None):
    """Securely execute subprocess with proper validation"""
    
    # Validate command components
    for component in command:
        if not isinstance(component, str):
            raise ValueError("All command components must be strings")
        
        # Check for shell injection attempts
        dangerous_chars = ['|', '&', ';', '(', ')', '>', '<', '`', '$']
        if any(char in component for char in dangerous_chars):
            raise ValueError(f"Dangerous characters detected in command: {component}")
    
    # Prepare secure environment
    secure_env = os.environ.copy()
    if env_vars:
        secure_env.update(env_vars)
    
    # Remove potentially dangerous environment variables
    for var in ['LD_PRELOAD', 'LD_LIBRARY_PATH', 'DYLD_INSERT_LIBRARIES']:
        secure_env.pop(var, None)
    
    # Execute with timeout and proper cleanup
    try:
        process = subprocess.Popen(
            command,
            env=secure_env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        return process
    except Exception as e:
        logger.error(f"Secure subprocess execution failed: {e}")
        raise
```

### **Performance Optimization**

#### **Frontend Optimization**
```typescript
// Optimize component rendering
import React, { memo, useMemo, useCallback } from 'react';

export const OptimizedAgentList = memo(({ agents, onAgentSelect }: Props) => {
  // Memoize expensive calculations
  const sortedAgents = useMemo(() => {
    return [...agents].sort((a, b) => a.name.localeCompare(b.name));
  }, [agents]);
  
  // Memoize callback functions
  const handleAgentClick = useCallback((agentId: string) => {
    onAgentSelect(agentId);
  }, [onAgentSelect]);
  
  // Use virtual scrolling for large lists
  const renderItem = useCallback(({ index, style }) => (
    <div style={style} key={sortedAgents[index].id}>
      <AgentCard 
        agent={sortedAgents[index]} 
        onClick={handleAgentClick}
      />
    </div>
  ), [sortedAgents, handleAgentClick]);
  
  return (
    <VirtualList
      height={400}
      itemCount={sortedAgents.length}
      itemSize={100}
      itemData={sortedAgents}
    >
      {renderItem}
    </VirtualList>
  );
});
```

#### **Backend Optimization**
```python
# Optimize database queries and async operations
import asyncio
from contextlib import asynccontextmanager

class OptimizedAgentManager:
    def __init__(self):
        self.agent_cache = {}
        self.background_tasks = set()
    
    async def get_agents_batch(self, agent_ids: List[str]) -> List[Agent]:
        """Batch fetch agents to reduce database queries"""
        
        # Check cache first
        cached_agents = []
        uncached_ids = []
        
        for agent_id in agent_ids:
            if agent_id in self.agent_cache:
                cached_agents.append(self.agent_cache[agent_id])
            else:
                uncached_ids.append(agent_id)
        
        # Fetch uncached agents in single query
        if uncached_ids:
            db_agents = await self.repository.get_agents_by_ids(uncached_ids)
            
            # Update cache
            for agent in db_agents:
                self.agent_cache[agent.id] = agent
            
            cached_agents.extend(db_agents)
        
        return cached_agents
    
    async def create_agent_async(self, config: dict) -> Agent:
        """Create agent with async optimization"""
        
        # Create agent record and process in parallel
        async with asyncio.TaskGroup() as tg:
            db_task = tg.create_task(
                self.repository.create_agent(config)
            )
            process_task = tg.create_task(
                self.cli_wrapper.create_agent_process(config)
            )
        
        agent = db_task.result()
        process_info = process_task.result()
        
        # Update with process information
        agent.process_id = process_info.pid
        await self.repository.update_agent(agent)
        
        return agent
    
    @asynccontextmanager
    async def performance_monitor(self, operation_name: str):
        """Context manager for operation performance monitoring"""
        start_time = time.time()
        try:
            yield
        finally:
            duration = (time.time() - start_time) * 1000
            logger.info(f"{operation_name} completed in {duration:.2f}ms")
            
            # Alert on slow operations
            if duration > 1000:
                await self.alert_manager.send_alert(
                    f"Slow operation: {operation_name} took {duration:.2f}ms"
                )
```

### **Monitoring & Observability**

#### **Application Metrics**
```python
# Comprehensive application monitoring
from prometheus_client import Counter, Histogram, Gauge
import time

# Define metrics
agent_creation_counter = Counter('agents_created_total', 'Total agents created')
agent_creation_duration = Histogram('agent_creation_duration_seconds', 'Agent creation time')
active_agents_gauge = Gauge('active_agents', 'Number of active agents')
task_completion_counter = Counter('tasks_completed_total', 'Total tasks completed', ['status'])

class MetricsCollector:
    @staticmethod
    def record_agent_creation(duration_seconds: float):
        agent_creation_counter.inc()
        agent_creation_duration.observe(duration_seconds)
    
    @staticmethod
    def update_active_agents(count: int):
        active_agents_gauge.set(count)
    
    @staticmethod
    def record_task_completion(status: str):
        task_completion_counter.labels(status=status).inc()

# Usage in agent manager
class MonitoredAgentManager:
    async def create_agent(self, config: dict) -> Agent:
        start_time = time.time()
        try:
            agent = await super().create_agent(config)
            MetricsCollector.record_agent_creation(time.time() - start_time)
            MetricsCollector.update_active_agents(len(self.agents))
            return agent
        except Exception as e:
            logger.error(f"Agent creation failed: {e}")
            raise
```

---

## 🎓 **Learning Resources**

### **Required Knowledge Areas**

#### **Frontend Development**
- **React 18**: Hooks, Context, Concurrent Features
- **TypeScript**: Advanced types, generics, utility types
- **Redux Toolkit**: State management, RTK Query
- **WebSockets**: Real-time communication patterns
- **React Flow**: Graph visualization library
- **TailwindCSS**: Utility-first styling

#### **Backend Development**
- **Python 3.8+**: Async/await, type hints, dataclasses
- **FastAPI**: Async web framework, dependency injection
- **SQLAlchemy**: ORM, async patterns
- **WebSockets**: Server-side implementation
- **Process Management**: Subprocess, multiprocessing, Epic 3

#### **DevOps & Infrastructure**
- **Docker**: Containerization, compose
- **PostgreSQL**: Database design, optimization
- **Redis**: Caching, message queuing
- **Nginx**: Reverse proxy, load balancing
- **Git**: Advanced workflows, branching strategies

### **Recommended Reading**

#### **Books**
1. **"Learning React" by Alex Banks & Eve Porcello** - React fundamentals
2. **"Effective TypeScript" by Dan Vanderkam** - TypeScript best practices
3. **"FastAPI Modern Python Web Development" by Bill Lubanovic** - Backend development
4. **"Clean Architecture" by Robert Martin** - Software design principles

#### **Documentation**
1. **React Documentation**: https://react.dev/
2. **FastAPI Documentation**: https://fastapi.tiangolo.com/
3. **TypeScript Handbook**: https://www.typescriptlang.org/docs/
4. **SQLAlchemy Documentation**: https://docs.sqlalchemy.org/

#### **Online Courses**
1. **React + TypeScript Course** on Frontend Masters
2. **Python Async Programming** on Real Python
3. **WebSocket Programming** on MDN Web Docs
4. **System Design Fundamentals** on Educative

### **Development Tools**

#### **Recommended IDE Setup (VS Code)**
```json
// .vscode/settings.json
{
  "python.defaultInterpreterPath": "./python-sdk/venv/bin/python",
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports": true,
    "source.fixAll.eslint": true
  },
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": true,
  "python.formatting.provider": "black"
}

// .vscode/extensions.json
{
  "recommendations": [
    "ms-python.python",
    "ms-python.black-formatter",
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "ms-vscode-remote.remote-containers"
  ]
}
```

#### **Debugging Configuration**
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python: FastAPI",
      "type": "python",
      "request": "launch",
      "program": "${workspaceFolder}/python-sdk/api/main.py",
      "console": "integratedTerminal",
      "env": {
        "PYTHONPATH": "${workspaceFolder}/python-sdk"
      }
    },
    {
      "name": "React: Debug",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}/dual-agent-monitor",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["run", "dev"]
    }
  ]
}
```

---

## 🤝 **Contributing Guidelines**

### **Getting Started as a Contributor**

#### **1. Fork and Clone**
```bash
# Fork the repository on GitHub
# Then clone your fork
git clone https://github.com/YOUR_USERNAME/automatic-claude-code
cd automatic-claude-code

# Add upstream remote
git remote add upstream https://github.com/yossiashkenazi/automatic-claude-code
```

#### **2. Set Up Development Environment**
```bash
# Follow development setup instructions above
pnpm install
cd python-sdk && pip install -r requirements.txt
cd ../dual-agent-monitor && pnpm install
```

#### **3. Create Feature Branch**
```bash
git checkout -b feature/your-feature-name
```

### **Contribution Types**

#### **Bug Fixes**
1. Create issue describing the bug
2. Reference issue in PR title: `fix: resolve agent creation timeout (#123)`
3. Include test cases that reproduce the bug
4. Ensure fix doesn't break existing functionality

#### **New Features**
1. Discuss feature in GitHub issues first
2. Follow Epic Structure for major features
3. Include comprehensive tests
4. Update documentation
5. Add examples and usage instructions

#### **Documentation**
1. Keep documentation current with code changes
2. Include examples and use cases
3. Follow established documentation style
4. Test all code examples

### **Pull Request Process**

#### **PR Checklist**
- [ ] **Tests**: All tests pass (`pnpm test`, `pytest`)
- [ ] **Linting**: Code passes linting (`pnpm lint`, `black`, `flake8`)
- [ ] **Type Checking**: TypeScript and Python type checking passes
- [ ] **Documentation**: Updated relevant documentation
- [ ] **Changelog**: Added entry to CHANGELOG.md
- [ ] **Breaking Changes**: Documented in PR description

#### **PR Template**
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that causes existing functionality to change)
- [ ] Documentation update

## Testing
- [ ] Added/updated unit tests
- [ ] Added/updated integration tests
- [ ] Manual testing performed
- [ ] All tests pass

## Screenshots (if applicable)
Include screenshots of UI changes

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings introduced
```

### **Code Review Guidelines**

#### **For Contributors**
1. Keep PRs focused and reasonably sized
2. Write clear commit messages
3. Respond to feedback constructively
4. Test changes thoroughly

#### **For Reviewers**
1. Review for functionality, performance, and security
2. Check test coverage and quality
3. Verify documentation updates
4. Be constructive and helpful in feedback
5. Approve when satisfied with quality

---

**This comprehensive Developer Guide provides everything needed to understand, contribute to, and extend the Visual Agent Management Platform. Use it as your reference for development workflows, architecture understanding, and contribution processes.**