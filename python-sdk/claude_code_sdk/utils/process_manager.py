"""
Process Management Utilities for Claude Code SDK
"""

import asyncio
import signal
import sys
import weakref
from typing import Dict, Optional, Set
import logging

logger = logging.getLogger(__name__)

class ProcessManager:
    """Manages Claude CLI processes with proper cleanup"""
    
    def __init__(self):
        self._processes: Dict[str, asyncio.subprocess.Process] = {}
        self._process_refs: Set[weakref.ref] = set()
    
    def add_process(self, process: asyncio.subprocess.Process, session_id: Optional[str] = None) -> None:
        """Add a process to be managed"""
        process_id = session_id or f"process_{id(process)}"
        self._processes[process_id] = process
        
        # Add weak reference for automatic cleanup
        ref = weakref.ref(process, self._on_process_deleted)
        self._process_refs.add(ref)
        
        logger.debug(f"Added process {process_id} (PID: {process.pid})")
    
    def remove_process(self, process: asyncio.subprocess.Process) -> None:
        """Remove a process from management"""
        process_id = None
        for pid, proc in list(self._processes.items()):
            if proc is process:
                process_id = pid
                break
        
        if process_id:
            del self._processes[process_id]
            logger.debug(f"Removed process {process_id}")
    
    def _on_process_deleted(self, ref: weakref.ref) -> None:
        """Callback when a process is garbage collected"""
        self._process_refs.discard(ref)
    
    async def kill_process(self, session_id: str) -> bool:
        """Kill a specific process by session ID"""
        if session_id not in self._processes:
            logger.warning(f"Process {session_id} not found")
            return False
        
        process = self._processes[session_id]
        await self._terminate_process(process, session_id)
        del self._processes[session_id]
        return True
    
    async def kill_all_processes(self) -> None:
        """Kill all managed processes"""
        if not self._processes:
            return
        
        logger.info(f"Terminating {len(self._processes)} Claude processes...")
        
        # Terminate all processes concurrently
        tasks = []
        for session_id, process in list(self._processes.items()):
            task = asyncio.create_task(self._terminate_process(process, session_id))
            tasks.append(task)
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        
        self._processes.clear()
        logger.info("All Claude processes terminated")
    
    async def _terminate_process(self, process: asyncio.subprocess.Process, process_id: str) -> None:
        """Safely terminate a single process"""
        if process.returncode is not None:
            logger.debug(f"Process {process_id} already terminated")
            return
        
        try:
            logger.debug(f"Terminating process {process_id} (PID: {process.pid})")
            
            # Try graceful termination first
            if sys.platform == "win32":
                process.terminate()
            else:
                process.send_signal(signal.SIGTERM)
            
            # Wait briefly for graceful shutdown
            try:
                await asyncio.wait_for(process.wait(), timeout=3.0)
                logger.debug(f"Process {process_id} terminated gracefully")
                return
            except asyncio.TimeoutError:
                logger.debug(f"Process {process_id} did not terminate gracefully, force killing")
            
            # Force kill if graceful termination failed
            try:
                process.kill()
                await asyncio.wait_for(process.wait(), timeout=2.0)
                logger.debug(f"Process {process_id} force killed")
            except asyncio.TimeoutError:
                logger.warning(f"Failed to kill process {process_id}")
            
        except ProcessLookupError:
            # Process already dead
            logger.debug(f"Process {process_id} was already dead")
        except Exception as e:
            logger.error(f"Error terminating process {process_id}: {e}")
    
    async def close_all(self) -> None:
        """Close the process manager and kill all processes"""
        await self.kill_all_processes()
        self._process_refs.clear()
    
    def get_active_processes(self) -> Dict[str, Dict[str, any]]:
        """Get information about active processes"""
        active = {}
        for session_id, process in self._processes.items():
            active[session_id] = {
                'pid': process.pid,
                'returncode': process.returncode,
                'is_alive': process.returncode is None
            }
        return active
    
    def get_process_count(self) -> int:
        """Get the number of active processes"""
        return len(self._processes)
    
    async def health_check(self) -> Dict[str, any]:
        """Perform health check on all managed processes"""
        health_info = {
            'total_processes': len(self._processes),
            'healthy_processes': 0,
            'dead_processes': 0,
            'process_details': {}
        }
        
        for session_id, process in self._processes.items():
            is_alive = process.returncode is None
            
            health_info['process_details'][session_id] = {
                'pid': process.pid,
                'is_alive': is_alive,
                'returncode': process.returncode
            }
            
            if is_alive:
                health_info['healthy_processes'] += 1
            else:
                health_info['dead_processes'] += 1
        
        return health_info