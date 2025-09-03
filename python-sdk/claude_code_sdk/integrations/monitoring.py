"""
Monitoring Integration for Claude Code SDK
Integrates with automatic-claude-code monitoring system
"""

import asyncio
import json
import aiohttp
from typing import Dict, Any, Optional
import logging
from datetime import datetime

from ..core.messages import Message

logger = logging.getLogger(__name__)

class MonitoringIntegration:
    """Integration with automatic-claude-code monitoring system"""
    
    def __init__(self, monitoring_port: int = 6011, api_port: int = 4005):
        self.monitoring_port = monitoring_port
        self.api_port = api_port
        self.base_url = f"http://localhost:{api_port}"
        self._session: Optional[aiohttp.ClientSession] = None
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create HTTP session"""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=5.0),
                connector=aiohttp.TCPConnector(limit=10)
            )
        return self._session
    
    async def send_event(self, event_type: str, data: Dict[str, Any]) -> bool:
        """Send an event to the monitoring system"""
        try:
            session = await self._get_session()
            
            payload = {
                'event_type': event_type,
                'timestamp': datetime.now().isoformat(),
                'data': data
            }
            
            async with session.post(f"{self.base_url}/events", json=payload) as response:
                if response.status == 200:
                    logger.debug(f"Sent monitoring event: {event_type}")
                    return True
                else:
                    logger.warning(f"Failed to send monitoring event: {response.status}")
                    return False
                    
        except Exception as e:
            logger.debug(f"Monitoring event failed: {e}")
            return False
    
    async def send_execution_start_event(self, prompt: str, session_id: str, agent_role: str = "worker") -> bool:
        """Send execution start event"""
        return await self.send_event("execution_start", {
            'session_id': session_id,
            'agent_role': agent_role,
            'prompt_preview': prompt[:200] + "..." if len(prompt) > 200 else prompt,
            'prompt_length': len(prompt)
        })
    
    async def send_execution_complete_event(self, 
                                          success: bool, 
                                          execution_time: float,
                                          session_id: str,
                                          error: Optional[str] = None) -> bool:
        """Send execution complete event"""
        return await self.send_event("execution_complete", {
            'session_id': session_id,
            'success': success,
            'execution_time': execution_time,
            'error': error
        })
    
    async def send_message_event(self, message: Message, session_id: str) -> bool:
        """Send message event"""
        return await self.send_event("message_received", {
            'session_id': session_id,
            'message_type': message.type,
            'message_data': message.to_dict()
        })
    
    async def send_dual_agent_event(self, 
                                   agent_type: str,
                                   task_id: str,
                                   message_type: str,
                                   data: Dict[str, Any]) -> bool:
        """Send dual-agent coordination event"""
        return await self.send_event("agent_communication", {
            'agent_type': agent_type,
            'task_id': task_id,
            'message_type': message_type,
            'data': data
        })
    
    async def send_quality_gate_event(self,
                                    task_id: str,
                                    quality_score: float,
                                    gate_type: str,
                                    result: str,
                                    feedback: list) -> bool:
        """Send quality gate result event"""
        return await self.send_event("quality_gate_result", {
            'task_id': task_id,
            'quality_score': quality_score,
            'gate_type': gate_type,
            'result': result,
            'feedback': feedback
        })
    
    async def get_monitoring_status(self) -> Dict[str, Any]:
        """Get monitoring system status"""
        try:
            session = await self._get_session()
            
            async with session.get(f"{self.base_url}/health") as response:
                if response.status == 200:
                    data = await response.json()
                    return {
                        'status': 'healthy',
                        'monitoring_port': self.monitoring_port,
                        'api_port': self.api_port,
                        'server_info': data
                    }
                else:
                    return {
                        'status': 'unhealthy',
                        'error': f'HTTP {response.status}'
                    }
                    
        except Exception as e:
            return {
                'status': 'unavailable',
                'error': str(e)
            }
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform comprehensive health check"""
        status = await self.get_monitoring_status()
        
        return {
            'monitoring_integration': 'enabled',
            'connection_status': status['status'],
            'monitoring_port': self.monitoring_port,
            'api_port': self.api_port,
            'last_check': datetime.now().isoformat(),
            'details': status
        }
    
    async def close(self) -> None:
        """Close the monitoring integration"""
        if self._session and not self._session.closed:
            await self._session.close()
            logger.debug("Monitoring integration session closed")