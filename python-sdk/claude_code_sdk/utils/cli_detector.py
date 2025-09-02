"""
Claude CLI Detection and Validation Utilities
"""

import asyncio
import shutil
import os
from pathlib import Path
from typing import Optional, List, Dict, Any
import logging

logger = logging.getLogger(__name__)

class CLIDetector:
    """Detects and validates Claude CLI installation"""
    
    def __init__(self):
        self._cache: Dict[str, Any] = {}
    
    async def detect_claude_cli(self, preferred_path: Optional[str] = None) -> Optional[str]:
        """
        Detect Claude CLI installation
        
        Args:
            preferred_path: Preferred CLI path to check first
            
        Returns:
            Path to Claude CLI executable or None if not found
        """
        # Check cache first
        cache_key = f"cli_path_{preferred_path or 'default'}"
        if cache_key in self._cache:
            return self._cache[cache_key]
        
        search_paths = self._get_search_paths(preferred_path)
        
        for path in search_paths:
            logger.debug(f"Checking Claude CLI at: {path}")
            
            if await self._test_cli_path(path):
                logger.info(f"Found working Claude CLI at: {path}")
                self._cache[cache_key] = path
                return path
        
        logger.warning("Claude CLI not found in any search location")
        self._cache[cache_key] = None
        return None
    
    def _get_search_paths(self, preferred_path: Optional[str] = None) -> List[str]:
        """Get list of paths to search for Claude CLI"""
        paths = []
        
        # 1. Preferred path first
        if preferred_path:
            paths.append(preferred_path)
        
        # 2. Environment variable
        if 'CLAUDE_CLI_PATH' in os.environ:
            paths.append(os.environ['CLAUDE_CLI_PATH'])
        
        # 3. Standard system locations
        paths.extend([
            'claude',  # In PATH
            'npx @anthropic-ai/claude-code',  # NPX execution
        ])
        
        # 4. Platform-specific locations
        if os.name == 'nt':  # Windows
            paths.extend(self._get_windows_paths())
        else:  # Unix-like
            paths.extend(self._get_unix_paths())
        
        return paths
    
    def _get_windows_paths(self) -> List[str]:
        """Get Windows-specific Claude CLI paths"""
        paths = []
        home = Path.home()
        
        # npm global paths
        npm_paths = [
            home / 'AppData' / 'Roaming' / 'npm' / 'claude.cmd',
            home / 'AppData' / 'Local' / 'npm' / 'claude.cmd',
            home / '.npm-global' / 'claude.cmd',
            'C:\\Program Files\\nodejs\\claude.cmd',
        ]
        
        # pnpm global paths
        pnpm_base = home / 'AppData' / 'Local' / 'pnpm'
        if pnpm_base.exists():
            # Look for pnpm global installations
            for version_dir in pnpm_base.glob('*'):
                if version_dir.is_dir():
                    claude_path = version_dir / 'claude.cmd'
                    if claude_path.exists():
                        paths.append(str(claude_path))
        
        paths.extend([str(p) for p in npm_paths if isinstance(p, Path) and p.exists()])
        return paths
    
    def _get_unix_paths(self) -> List[str]:
        """Get Unix-specific Claude CLI paths"""
        home = Path.home()
        
        return [
            '/usr/local/bin/claude',
            '/usr/bin/claude',
            '/opt/homebrew/bin/claude',  # macOS Homebrew
            str(home / '.local' / 'bin' / 'claude'),
            str(home / '.npm-global' / 'bin' / 'claude'),
            str(home / '.yarn' / 'bin' / 'claude'),
        ]
    
    async def _test_cli_path(self, cli_path: str) -> bool:
        """Test if a CLI path is valid and working"""
        try:
            # Handle npx commands
            if cli_path.startswith('npx '):
                cmd_parts = cli_path.split()
            else:
                # Test if executable exists
                if not shutil.which(cli_path.split()[0]):
                    return False
                cmd_parts = [cli_path]
            
            # Try to run --help command (faster than --version)
            process = await asyncio.create_subprocess_exec(
                *cmd_parts, '--help',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            try:
                stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=10.0)
                
                # Check if it looks like Claude CLI
                output_text = (stdout + stderr).decode().lower()
                claude_indicators = ['claude', 'anthropic', 'ai assistant']
                
                return (
                    process.returncode == 0 and 
                    any(indicator in output_text for indicator in claude_indicators)
                )
                
            except asyncio.TimeoutError:
                logger.debug(f"CLI test timed out for: {cli_path}")
                process.kill()
                return False
            
        except Exception as e:
            logger.debug(f"CLI test failed for {cli_path}: {e}")
            return False
    
    async def get_cli_version(self, cli_path: str) -> Optional[str]:
        """Get version information from Claude CLI"""
        try:
            cmd_parts = cli_path.split() if cli_path.startswith('npx ') else [cli_path]
            
            process = await asyncio.create_subprocess_exec(
                *cmd_parts, '--version',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=10.0)
            
            if process.returncode == 0:
                return stdout.decode().strip()
            else:
                return None
                
        except Exception as e:
            logger.debug(f"Failed to get version for {cli_path}: {e}")
            return None
    
    async def validate_cli_functionality(self, cli_path: str) -> Dict[str, Any]:
        """
        Comprehensive validation of CLI functionality
        
        Returns:
            Dict with validation results
        """
        results = {
            'path': cli_path,
            'exists': False,
            'executable': False,
            'version': None,
            'help_works': False,
            'errors': []
        }
        
        try:
            # Test existence
            cmd_parts = cli_path.split() if cli_path.startswith('npx ') else [cli_path]
            if not cli_path.startswith('npx ') and not shutil.which(cmd_parts[0]):
                results['errors'].append(f"Executable not found: {cmd_parts[0]}")
                return results
            
            results['exists'] = True
            
            # Test help command
            try:
                process = await asyncio.create_subprocess_exec(
                    *cmd_parts, '--help',
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=10.0)
                
                if process.returncode == 0:
                    results['help_works'] = True
                    results['executable'] = True
                else:
                    results['errors'].append(f"Help command failed: {stderr.decode()}")
            
            except asyncio.TimeoutError:
                results['errors'].append("Help command timed out")
            
            # Get version
            version = await self.get_cli_version(cli_path)
            if version:
                results['version'] = version
            else:
                results['errors'].append("Could not retrieve version")
            
        except Exception as e:
            results['errors'].append(f"Validation error: {str(e)}")
        
        return results
    
    def clear_cache(self) -> None:
        """Clear the detection cache"""
        self._cache.clear()
        logger.debug("CLI detection cache cleared")