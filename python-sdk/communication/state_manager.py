#!/usr/bin/env python3
"""
State Manager for Agent Communication Protocol
============================================

This module provides state management capabilities for agent coordination,
including session state, task state, and workflow state tracking.

Key Features:
- Centralized state management for distributed agents
- Persistent state storage with recovery capabilities
- State synchronization between agents
- Conflict resolution for concurrent state updates
- State change notifications and event streaming
- Automatic state cleanup and garbage collection
"""

import asyncio
import json
import time
import sqlite3
import threading
from typing import Dict, List, Optional, Any, Set, Callable
from dataclasses import dataclass, field, asdict
from enum import Enum
from contextlib import asynccontextmanager
from pathlib import Path
import logging

from .protocol import (
    ProtocolMessage, MessageType, AgentRole, TaskStatus,
    CoordinationPhase, TaskDefinition, TaskProgress
)

logger = logging.getLogger(__name__)

# ============================================================================
# State Types and Enums
# ============================================================================

class StateType(Enum):
    """Types of managed state"""
    SESSION = "session"
    TASK = "task"
    AGENT = "agent"
    WORKFLOW = "workflow"
    COORDINATION = "coordination"

class StateOperation(Enum):
    """State operation types"""
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    SYNC = "sync"

@dataclass
class StateChange:
    """State change event information"""
    id: str
    state_type: StateType
    operation: StateOperation
    key: str
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    timestamp: float = field(default_factory=time.time)
    agent_id: Optional[str] = None
    session_id: Optional[str] = None

@dataclass
class SessionState:
    """Session state information"""
    session_id: str
    status: str = "active"  # active, paused, completed, failed
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    manager_agent_id: Optional[str] = None
    worker_agent_ids: Set[str] = field(default_factory=set)
    human_operators: Set[str] = field(default_factory=set)
    initial_task: str = ""
    work_dir: str = ""
    current_phase: CoordinationPhase = CoordinationPhase.PLANNING
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    # Task management
    total_tasks: int = 0
    completed_tasks: int = 0
    failed_tasks: int = 0
    active_tasks: Set[str] = field(default_factory=set)
    
    # Performance metrics
    messages_exchanged: int = 0
    total_duration: float = 0.0
    coordination_events: int = 0

@dataclass
class TaskState:
    """Individual task state information"""
    task_id: str
    session_id: str
    definition: TaskDefinition
    progress: TaskProgress
    assigned_agent: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    
    # Dependencies and relationships
    dependent_tasks: Set[str] = field(default_factory=set)
    blocking_tasks: Set[str] = field(default_factory=set)
    
    # Quality and validation
    quality_checks: List[str] = field(default_factory=list)  # Quality gate IDs
    validation_results: Dict[str, Any] = field(default_factory=dict)
    
    # Human intervention
    requires_human_input: bool = False
    human_intervention_requested: bool = False
    human_feedback: Optional[str] = None

@dataclass
class AgentState:
    """Agent state information"""
    agent_id: str
    role: AgentRole
    status: str = "active"  # active, busy, idle, offline, error
    last_seen: float = field(default_factory=time.time)
    current_session: Optional[str] = None
    assigned_tasks: Set[str] = field(default_factory=set)
    capabilities: Set[str] = field(default_factory=set)
    
    # Performance metrics
    messages_sent: int = 0
    messages_received: int = 0
    tasks_completed: int = 0
    tasks_failed: int = 0
    average_response_time: float = 0.0
    
    # Resource usage
    cpu_usage: float = 0.0
    memory_usage: float = 0.0
    current_load: int = 0

@dataclass
class WorkflowState:
    """Workflow coordination state"""
    session_id: str
    current_phase: CoordinationPhase = CoordinationPhase.PLANNING
    phase_started_at: float = field(default_factory=time.time)
    phase_history: List[Dict[str, Any]] = field(default_factory=list)
    
    # Coordination events
    handoffs_initiated: int = 0
    handoffs_completed: int = 0
    quality_checks_performed: int = 0
    human_interventions: int = 0
    
    # Workflow metrics
    total_coordination_time: float = 0.0
    phase_durations: Dict[str, float] = field(default_factory=dict)
    coordination_efficiency: float = 0.0

# ============================================================================
# State Manager Implementation
# ============================================================================

class StateManager:
    """
    Central state manager for agent coordination.
    
    Features:
    - Thread-safe state operations
    - Persistent storage with SQLite backend
    - State change event notifications
    - Automatic state synchronization
    - Conflict resolution for concurrent updates
    - State cleanup and garbage collection
    """
    
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or ":memory:"
        self.db_lock = threading.RLock()
        
        # In-memory state caches
        self.sessions: Dict[str, SessionState] = {}
        self.tasks: Dict[str, TaskState] = {}
        self.agents: Dict[str, AgentState] = {}
        self.workflows: Dict[str, WorkflowState] = {}
        
        # Event subscribers
        self.state_change_subscribers: Dict[StateType, List[Callable]] = {
            state_type: [] for state_type in StateType
        }
        
        # Background tasks
        self.running = False
        self._cleanup_task: Optional[asyncio.Task] = None
        self._sync_task: Optional[asyncio.Task] = None
        
        # State operation locks
        self.operation_locks: Dict[str, asyncio.Lock] = {}
        
        self._initialize_database()
        logger.info(f"State manager initialized with database: {self.db_path}")
    
    def _initialize_database(self):
        """Initialize SQLite database schema"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS session_states (
                    session_id TEXT PRIMARY KEY,
                    state_data TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                )
            ''')
            
            conn.execute('''
                CREATE TABLE IF NOT EXISTS task_states (
                    task_id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    state_data TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL,
                    FOREIGN KEY (session_id) REFERENCES session_states (session_id)
                )
            ''')
            
            conn.execute('''
                CREATE TABLE IF NOT EXISTS agent_states (
                    agent_id TEXT PRIMARY KEY,
                    state_data TEXT NOT NULL,
                    last_seen REAL NOT NULL,
                    updated_at REAL NOT NULL
                )
            ''')
            
            conn.execute('''
                CREATE TABLE IF NOT EXISTS workflow_states (
                    session_id TEXT PRIMARY KEY,
                    state_data TEXT NOT NULL,
                    updated_at REAL NOT NULL,
                    FOREIGN KEY (session_id) REFERENCES session_states (session_id)
                )
            ''')
            
            conn.execute('''
                CREATE TABLE IF NOT EXISTS state_changes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    state_type TEXT NOT NULL,
                    operation TEXT NOT NULL,
                    key TEXT NOT NULL,
                    old_value TEXT,
                    new_value TEXT,
                    timestamp REAL NOT NULL,
                    agent_id TEXT,
                    session_id TEXT
                )
            ''')
            
            # Create indexes for better performance
            conn.execute('CREATE INDEX IF NOT EXISTS idx_task_session ON task_states (session_id)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_state_changes_timestamp ON state_changes (timestamp)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_state_changes_session ON state_changes (session_id)')
            
            conn.commit()
    
    async def start(self):
        """Start the state manager"""
        self.running = True
        
        # Load existing state from database
        await self._load_state_from_db()
        
        # Start background tasks
        self._cleanup_task = asyncio.create_task(self._cleanup_expired_state())
        self._sync_task = asyncio.create_task(self._periodic_sync())
        
        logger.info("State manager started")
    
    async def stop(self):
        """Stop the state manager"""
        self.running = False
        
        # Cancel background tasks
        if self._cleanup_task:
            self._cleanup_task.cancel()
        if self._sync_task:
            self._sync_task.cancel()
        
        # Save final state to database
        await self._save_state_to_db()
        
        logger.info("State manager stopped")
    
    # ========================================================================
    # Session State Management
    # ========================================================================
    
    async def create_session(self, session_id: str, initial_task: str, work_dir: str = "") -> SessionState:
        """Create new session state"""
        async with self._get_operation_lock(f"session:{session_id}"):
            if session_id in self.sessions:
                raise ValueError(f"Session {session_id} already exists")
            
            session = SessionState(
                session_id=session_id,
                initial_task=initial_task,
                work_dir=work_dir
            )
            
            self.sessions[session_id] = session
            await self._save_session_to_db(session)
            
            # Create corresponding workflow state
            workflow = WorkflowState(session_id=session_id)
            self.workflows[session_id] = workflow
            await self._save_workflow_to_db(workflow)
            
            await self._emit_state_change(
                StateType.SESSION,
                StateOperation.CREATE,
                session_id,
                None,
                asdict(session)
            )
            
            logger.info(f"Created session {session_id}")
            return session
    
    async def get_session(self, session_id: str) -> Optional[SessionState]:
        """Get session state"""
        return self.sessions.get(session_id)
    
    async def update_session(self, session_id: str, updates: Dict[str, Any]) -> bool:
        """Update session state"""
        async with self._get_operation_lock(f"session:{session_id}"):
            if session_id not in self.sessions:
                logger.error(f"Session {session_id} not found")
                return False
            
            session = self.sessions[session_id]
            old_state = asdict(session)
            
            # Apply updates
            for key, value in updates.items():
                if hasattr(session, key):
                    setattr(session, key, value)
            
            session.updated_at = time.time()
            await self._save_session_to_db(session)
            
            await self._emit_state_change(
                StateType.SESSION,
                StateOperation.UPDATE,
                session_id,
                old_state,
                asdict(session)
            )
            
            return True
    
    async def list_sessions(self, status_filter: Optional[str] = None) -> List[SessionState]:
        """List all sessions, optionally filtered by status"""
        sessions = list(self.sessions.values())
        if status_filter:
            sessions = [s for s in sessions if s.status == status_filter]
        return sessions
    
    # ========================================================================
    # Task State Management  
    # ========================================================================
    
    async def create_task(self, task_id: str, session_id: str, definition: TaskDefinition) -> TaskState:
        """Create new task state"""
        async with self._get_operation_lock(f"task:{task_id}"):
            if task_id in self.tasks:
                raise ValueError(f"Task {task_id} already exists")
            
            progress = TaskProgress(
                task_id=task_id,
                status=TaskStatus.PENDING
            )
            
            task_state = TaskState(
                task_id=task_id,
                session_id=session_id,
                definition=definition,
                progress=progress
            )
            
            self.tasks[task_id] = task_state
            await self._save_task_to_db(task_state)
            
            # Update session task count
            if session_id in self.sessions:
                session = self.sessions[session_id]
                session.total_tasks += 1
                session.active_tasks.add(task_id)
                await self._save_session_to_db(session)
            
            await self._emit_state_change(
                StateType.TASK,
                StateOperation.CREATE,
                task_id,
                None,
                asdict(task_state)
            )
            
            logger.info(f"Created task {task_id} in session {session_id}")
            return task_state
    
    async def get_task(self, task_id: str) -> Optional[TaskState]:
        """Get task state"""
        return self.tasks.get(task_id)
    
    async def update_task(self, task_id: str, updates: Dict[str, Any]) -> bool:
        """Update task state"""
        async with self._get_operation_lock(f"task:{task_id}"):
            if task_id not in self.tasks:
                logger.error(f"Task {task_id} not found")
                return False
            
            task_state = self.tasks[task_id]
            old_state = asdict(task_state)
            
            # Apply updates
            for key, value in updates.items():
                if key == "progress" and isinstance(value, dict):
                    # Update progress fields
                    for progress_key, progress_value in value.items():
                        if hasattr(task_state.progress, progress_key):
                            setattr(task_state.progress, progress_key, progress_value)
                elif hasattr(task_state, key):
                    setattr(task_state, key, value)
            
            task_state.updated_at = time.time()
            
            # Update completion timestamp
            if task_state.progress.status in [TaskStatus.COMPLETED, TaskStatus.FAILED]:
                if not task_state.completed_at:
                    task_state.completed_at = time.time()
                    
                    # Update session counters
                    session = self.sessions.get(task_state.session_id)
                    if session:
                        session.active_tasks.discard(task_id)
                        if task_state.progress.status == TaskStatus.COMPLETED:
                            session.completed_tasks += 1
                        else:
                            session.failed_tasks += 1
                        await self._save_session_to_db(session)
            
            await self._save_task_to_db(task_state)
            
            await self._emit_state_change(
                StateType.TASK,
                StateOperation.UPDATE,
                task_id,
                old_state,
                asdict(task_state)
            )
            
            return True
    
    async def list_tasks(self, session_id: Optional[str] = None, status_filter: Optional[TaskStatus] = None) -> List[TaskState]:
        """List tasks, optionally filtered by session and status"""
        tasks = list(self.tasks.values())
        
        if session_id:
            tasks = [t for t in tasks if t.session_id == session_id]
        
        if status_filter:
            tasks = [t for t in tasks if t.progress.status == status_filter]
        
        return tasks
    
    # ========================================================================
    # Agent State Management
    # ========================================================================
    
    async def register_agent(self, agent_id: str, role: AgentRole, capabilities: Optional[Set[str]] = None) -> AgentState:
        """Register new agent"""
        async with self._get_operation_lock(f"agent:{agent_id}"):
            agent_state = AgentState(
                agent_id=agent_id,
                role=role,
                capabilities=capabilities or set()
            )
            
            self.agents[agent_id] = agent_state
            await self._save_agent_to_db(agent_state)
            
            await self._emit_state_change(
                StateType.AGENT,
                StateOperation.CREATE,
                agent_id,
                None,
                asdict(agent_state)
            )
            
            logger.info(f"Registered agent {agent_id} with role {role.value}")
            return agent_state
    
    async def update_agent_heartbeat(self, agent_id: str):
        """Update agent heartbeat timestamp"""
        if agent_id in self.agents:
            agent = self.agents[agent_id]
            agent.last_seen = time.time()
            agent.status = "active"
            await self._save_agent_to_db(agent)
    
    async def update_agent_status(self, agent_id: str, status: str, metadata: Optional[Dict[str, Any]] = None):
        """Update agent status and optional metadata"""
        async with self._get_operation_lock(f"agent:{agent_id}"):
            if agent_id not in self.agents:
                logger.error(f"Agent {agent_id} not found")
                return False
            
            agent = self.agents[agent_id]
            old_status = agent.status
            agent.status = status
            agent.last_seen = time.time()
            
            # Update metadata if provided
            if metadata:
                for key, value in metadata.items():
                    if hasattr(agent, key):
                        setattr(agent, key, value)
            
            await self._save_agent_to_db(agent)
            
            if old_status != status:
                logger.info(f"Agent {agent_id} status changed: {old_status} -> {status}")
            
            return True
    
    async def get_available_agents(self, role: Optional[AgentRole] = None) -> List[AgentState]:
        """Get available agents, optionally filtered by role"""
        current_time = time.time()
        agents = []
        
        for agent in self.agents.values():
            # Consider agent available if seen within last 60 seconds
            if current_time - agent.last_seen <= 60 and agent.status in ["active", "idle"]:
                if role is None or agent.role == role:
                    agents.append(agent)
        
        return agents
    
    # ========================================================================
    # Workflow State Management
    # ========================================================================
    
    async def transition_workflow_phase(self, session_id: str, new_phase: CoordinationPhase, metadata: Optional[Dict[str, Any]] = None) -> bool:
        """Transition workflow to new phase"""
        async with self._get_operation_lock(f"workflow:{session_id}"):
            if session_id not in self.workflows:
                logger.error(f"Workflow for session {session_id} not found")
                return False
            
            workflow = self.workflows[session_id]
            old_phase = workflow.current_phase
            current_time = time.time()
            
            # Record phase duration
            phase_duration = current_time - workflow.phase_started_at
            workflow.phase_durations[old_phase.value] = phase_duration
            workflow.total_coordination_time += phase_duration
            
            # Add to phase history
            workflow.phase_history.append({
                'phase': old_phase.value,
                'duration': phase_duration,
                'ended_at': current_time,
                'metadata': metadata or {}
            })
            
            # Transition to new phase
            workflow.current_phase = new_phase
            workflow.phase_started_at = current_time
            
            await self._save_workflow_to_db(workflow)
            
            # Update session phase
            if session_id in self.sessions:
                self.sessions[session_id].current_phase = new_phase
                await self._save_session_to_db(self.sessions[session_id])
            
            logger.info(f"Workflow {session_id} transitioned: {old_phase.value} -> {new_phase.value}")
            return True
    
    async def record_coordination_event(self, session_id: str, event_type: str, metadata: Optional[Dict[str, Any]] = None):
        """Record coordination event in workflow state"""
        if session_id not in self.workflows:
            return
        
        workflow = self.workflows[session_id]
        
        # Update counters based on event type
        if event_type == "handoff_initiated":
            workflow.handoffs_initiated += 1
        elif event_type == "handoff_completed":
            workflow.handoffs_completed += 1
        elif event_type == "quality_check":
            workflow.quality_checks_performed += 1
        elif event_type == "human_intervention":
            workflow.human_interventions += 1
        
        await self._save_workflow_to_db(workflow)
    
    # ========================================================================
    # State Synchronization and Persistence
    # ========================================================================
    
    async def _load_state_from_db(self):
        """Load state from database on startup"""
        with sqlite3.connect(self.db_path) as conn:
            # Load sessions
            cursor = conn.execute('SELECT session_id, state_data FROM session_states')
            for session_id, state_data in cursor.fetchall():
                try:
                    data = json.loads(state_data)
                    session = SessionState(**data)
                    self.sessions[session_id] = session
                except Exception as e:
                    logger.error(f"Error loading session {session_id}: {e}")
            
            # Load tasks
            cursor = conn.execute('SELECT task_id, state_data FROM task_states')
            for task_id, state_data in cursor.fetchall():
                try:
                    data = json.loads(state_data)
                    # Reconstruct nested objects
                    definition_data = data.pop('definition')
                    progress_data = data.pop('progress')
                    
                    task_state = TaskState(
                        definition=TaskDefinition(**definition_data),
                        progress=TaskProgress(**progress_data),
                        **data
                    )
                    self.tasks[task_id] = task_state
                except Exception as e:
                    logger.error(f"Error loading task {task_id}: {e}")
            
            # Load agents
            cursor = conn.execute('SELECT agent_id, state_data FROM agent_states')
            for agent_id, state_data in cursor.fetchall():
                try:
                    data = json.loads(state_data)
                    data['role'] = AgentRole(data['role'])
                    agent = AgentState(**data)
                    self.agents[agent_id] = agent
                except Exception as e:
                    logger.error(f"Error loading agent {agent_id}: {e}")
            
            # Load workflows
            cursor = conn.execute('SELECT session_id, state_data FROM workflow_states')
            for session_id, state_data in cursor.fetchall():
                try:
                    data = json.loads(state_data)
                    data['current_phase'] = CoordinationPhase(data['current_phase'])
                    workflow = WorkflowState(**data)
                    self.workflows[session_id] = workflow
                except Exception as e:
                    logger.error(f"Error loading workflow {session_id}: {e}")
        
        logger.info(f"Loaded state: {len(self.sessions)} sessions, {len(self.tasks)} tasks, {len(self.agents)} agents")
    
    async def _save_state_to_db(self):
        """Save current state to database"""
        with sqlite3.connect(self.db_path) as conn:
            # Save sessions
            for session in self.sessions.values():
                await self._save_session_to_db(session, conn)
            
            # Save tasks
            for task in self.tasks.values():
                await self._save_task_to_db(task, conn)
            
            # Save agents
            for agent in self.agents.values():
                await self._save_agent_to_db(agent, conn)
            
            # Save workflows
            for workflow in self.workflows.values():
                await self._save_workflow_to_db(workflow, conn)
            
            conn.commit()
    
    async def _save_session_to_db(self, session: SessionState, conn: Optional[sqlite3.Connection] = None):
        """Save session to database"""
        should_close = conn is None
        if conn is None:
            conn = sqlite3.connect(self.db_path)
        
        try:
            # Convert sets to lists for JSON serialization
            data = asdict(session)
            data['worker_agent_ids'] = list(data['worker_agent_ids'])
            data['human_operators'] = list(data['human_operators'])
            data['active_tasks'] = list(data['active_tasks'])
            data['current_phase'] = data['current_phase'].value
            
            conn.execute(
                'REPLACE INTO session_states (session_id, state_data, created_at, updated_at) VALUES (?, ?, ?, ?)',
                (session.session_id, json.dumps(data), session.created_at, session.updated_at)
            )
            
            if should_close:
                conn.commit()
        finally:
            if should_close:
                conn.close()
    
    async def _save_task_to_db(self, task: TaskState, conn: Optional[sqlite3.Connection] = None):
        """Save task to database"""
        should_close = conn is None
        if conn is None:
            conn = sqlite3.connect(self.db_path)
        
        try:
            # Convert complex objects to dictionaries
            data = asdict(task)
            data['dependent_tasks'] = list(data['dependent_tasks'])
            data['blocking_tasks'] = list(data['blocking_tasks'])
            
            conn.execute(
                'REPLACE INTO task_states (task_id, session_id, state_data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
                (task.task_id, task.session_id, json.dumps(data), task.created_at, task.updated_at)
            )
            
            if should_close:
                conn.commit()
        finally:
            if should_close:
                conn.close()
    
    async def _save_agent_to_db(self, agent: AgentState, conn: Optional[sqlite3.Connection] = None):
        """Save agent to database"""
        should_close = conn is None
        if conn is None:
            conn = sqlite3.connect(self.db_path)
        
        try:
            data = asdict(agent)
            data['role'] = data['role'].value
            data['assigned_tasks'] = list(data['assigned_tasks'])
            data['capabilities'] = list(data['capabilities'])
            
            conn.execute(
                'REPLACE INTO agent_states (agent_id, state_data, last_seen, updated_at) VALUES (?, ?, ?, ?)',
                (agent.agent_id, json.dumps(data), agent.last_seen, time.time())
            )
            
            if should_close:
                conn.commit()
        finally:
            if should_close:
                conn.close()
    
    async def _save_workflow_to_db(self, workflow: WorkflowState, conn: Optional[sqlite3.Connection] = None):
        """Save workflow to database"""
        should_close = conn is None
        if conn is None:
            conn = sqlite3.connect(self.db_path)
        
        try:
            data = asdict(workflow)
            data['current_phase'] = data['current_phase'].value
            
            conn.execute(
                'REPLACE INTO workflow_states (session_id, state_data, updated_at) VALUES (?, ?, ?)',
                (workflow.session_id, json.dumps(data), time.time())
            )
            
            if should_close:
                conn.commit()
        finally:
            if should_close:
                conn.close()
    
    # ========================================================================
    # Event Management
    # ========================================================================
    
    def subscribe_to_state_changes(self, state_type: StateType, callback: Callable[[StateChange], None]):
        """Subscribe to state change events"""
        self.state_change_subscribers[state_type].append(callback)
    
    def unsubscribe_from_state_changes(self, state_type: StateType, callback: Callable[[StateChange], None]):
        """Unsubscribe from state change events"""
        if callback in self.state_change_subscribers[state_type]:
            self.state_change_subscribers[state_type].remove(callback)
    
    async def _emit_state_change(self, state_type: StateType, operation: StateOperation, key: str, old_value: Any, new_value: Any):
        """Emit state change event to subscribers"""
        change = StateChange(
            id=f"{state_type.value}_{operation.value}_{key}_{int(time.time() * 1000)}",
            state_type=state_type,
            operation=operation,
            key=key,
            old_value=old_value,
            new_value=new_value
        )
        
        # Save to database
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                'INSERT INTO state_changes (state_type, operation, key, old_value, new_value, timestamp, agent_id, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                (
                    change.state_type.value,
                    change.operation.value,
                    change.key,
                    json.dumps(change.old_value) if change.old_value else None,
                    json.dumps(change.new_value) if change.new_value else None,
                    change.timestamp,
                    change.agent_id,
                    change.session_id
                )
            )
            conn.commit()
        
        # Notify subscribers
        for callback in self.state_change_subscribers[state_type]:
            try:
                if asyncio.iscoroutinefunction(callback):
                    asyncio.create_task(callback(change))
                else:
                    callback(change)
            except Exception as e:
                logger.error(f"Error in state change callback: {e}")
    
    # ========================================================================
    # Background Tasks
    # ========================================================================
    
    async def _cleanup_expired_state(self):
        """Clean up expired state periodically"""
        while self.running:
            try:
                current_time = time.time()
                cleanup_threshold = 24 * 60 * 60  # 24 hours
                
                # Clean up old completed sessions
                expired_sessions = []
                for session_id, session in self.sessions.items():
                    if (session.status in ["completed", "failed"] and
                        current_time - session.updated_at > cleanup_threshold):
                        expired_sessions.append(session_id)
                
                for session_id in expired_sessions:
                    logger.info(f"Cleaning up expired session {session_id}")
                    
                    # Remove associated tasks and workflows
                    session_tasks = [t for t in self.tasks.keys() if self.tasks[t].session_id == session_id]
                    for task_id in session_tasks:
                        del self.tasks[task_id]
                    
                    if session_id in self.workflows:
                        del self.workflows[session_id]
                    
                    del self.sessions[session_id]
                
                # Clean up offline agents
                offline_agents = []
                for agent_id, agent in self.agents.items():
                    if current_time - agent.last_seen > cleanup_threshold:
                        offline_agents.append(agent_id)
                
                for agent_id in offline_agents:
                    logger.info(f"Cleaning up offline agent {agent_id}")
                    del self.agents[agent_id]
                
                # Clean up old state change records
                with sqlite3.connect(self.db_path) as conn:
                    cutoff_time = current_time - (7 * 24 * 60 * 60)  # 7 days
                    conn.execute('DELETE FROM state_changes WHERE timestamp < ?', (cutoff_time,))
                    conn.commit()
                
                await asyncio.sleep(60 * 60)  # Run every hour
                
            except Exception as e:
                logger.error(f"Error in state cleanup: {e}")
                await asyncio.sleep(60)  # Retry after 1 minute
    
    async def _periodic_sync(self):
        """Periodically sync state to database"""
        while self.running:
            try:
                await self._save_state_to_db()
                await asyncio.sleep(300)  # Sync every 5 minutes
            except Exception as e:
                logger.error(f"Error in periodic sync: {e}")
                await asyncio.sleep(60)  # Retry after 1 minute
    
    # ========================================================================
    # Utilities
    # ========================================================================
    
    @asynccontextmanager
    async def _get_operation_lock(self, key: str):
        """Get operation lock for concurrent access control"""
        if key not in self.operation_locks:
            self.operation_locks[key] = asyncio.Lock()
        
        async with self.operation_locks[key]:
            yield
    
    def get_state_statistics(self) -> Dict[str, Any]:
        """Get state management statistics"""
        current_time = time.time()
        
        return {
            'sessions': {
                'total': len(self.sessions),
                'active': len([s for s in self.sessions.values() if s.status == 'active']),
                'completed': len([s for s in self.sessions.values() if s.status == 'completed']),
                'failed': len([s for s in self.sessions.values() if s.status == 'failed'])
            },
            'tasks': {
                'total': len(self.tasks),
                'pending': len([t for t in self.tasks.values() if t.progress.status == TaskStatus.PENDING]),
                'in_progress': len([t for t in self.tasks.values() if t.progress.status == TaskStatus.IN_PROGRESS]),
                'completed': len([t for t in self.tasks.values() if t.progress.status == TaskStatus.COMPLETED]),
                'failed': len([t for t in self.tasks.values() if t.progress.status == TaskStatus.FAILED])
            },
            'agents': {
                'total': len(self.agents),
                'active': len([a for a in self.agents.values() if current_time - a.last_seen <= 60]),
                'managers': len([a for a in self.agents.values() if a.role == AgentRole.MANAGER]),
                'workers': len([a for a in self.agents.values() if a.role == AgentRole.WORKER]),
                'humans': len([a for a in self.agents.values() if a.role == AgentRole.HUMAN])
            },
            'workflows': {
                'total': len(self.workflows),
                'phases': {phase.value: len([w for w in self.workflows.values() if w.current_phase == phase]) 
                          for phase in CoordinationPhase}
            }
        }

# Example usage
async def example_state_manager():
    """Example of state manager usage"""
    logger.info("=== State Manager Example ===")
    
    # Create state manager
    state_manager = StateManager(":memory:")
    await state_manager.start()
    
    # Create session
    session = await state_manager.create_session("test-session", "Implement feature X")
    
    # Register agents
    manager_agent = await state_manager.register_agent("manager-001", AgentRole.MANAGER)
    worker_agent = await state_manager.register_agent("worker-001", AgentRole.WORKER)
    
    # Create task
    from .protocol import TaskDefinition, MessagePriority
    task_def = TaskDefinition(
        title="Implement authentication",
        description="Add user authentication",
        priority=MessagePriority.HIGH
    )
    task = await state_manager.create_task("task-001", session.session_id, task_def)
    
    # Update task progress
    await state_manager.update_task("task-001", {
        "progress": {"status": TaskStatus.IN_PROGRESS.value, "progress_percent": 50}
    })
    
    # Transition workflow phase
    await state_manager.transition_workflow_phase(session.session_id, CoordinationPhase.EXECUTION)
    
    # Get statistics
    stats = state_manager.get_state_statistics()
    logger.info(f"State statistics: {stats}")
    
    await state_manager.stop()

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(example_state_manager())