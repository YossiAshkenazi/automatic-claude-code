# Security Policy

## Reporting Security Vulnerabilities

We take the security of the Claude Code Python SDK seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### How to Report a Security Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: **security@automatic-claude-code.com**

Include the following information:
- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### Response Timeline

We will acknowledge your email within 48 hours and will send a more detailed response within 96 hours indicating the next steps in handling your report.

After the initial reply to your report, we will:
- Investigate and validate the vulnerability
- Work to release a fix as soon as possible
- Notify you when the fix has been released
- Credit you for the discovery (if you wish)

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x.x   | :white_check_mark: |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Security Features

### Command Injection Prevention

The SDK implements multiple layers of protection against command injection:

1. **Argument Sanitization**: All CLI arguments are sanitized to remove dangerous characters
2. **Allowlist Filtering**: Only safe environment variables are passed to subprocess
3. **Input Validation**: All user inputs are validated before processing
4. **Secure Subprocess Handling**: Uses subprocess with shell=False and proper argument escaping

### Environment Variable Security

- **Allowlist Approach**: Only predefined safe environment variables are passed to Claude processes
- **Sensitive Data Filtering**: Automatically filters out credentials and API keys from logs
- **Process Isolation**: Each Claude process runs in an isolated environment

### Authentication Security

- **No Hardcoded Secrets**: No API keys or secrets are hardcoded in the codebase
- **Secure Token Handling**: API tokens are handled securely through environment variables
- **Authentication Error Handling**: Proper error handling for authentication failures

### Process Security

- **Process Isolation**: Each Claude execution runs in a separate, isolated process
- **Timeout Protection**: All processes have configurable timeouts to prevent hanging
- **Resource Limits**: Memory and CPU limits can be configured
- **Graceful Termination**: Processes are terminated gracefully with fallback to force kill

## Security Best Practices

### For Developers

1. **Input Validation**
   - Always validate user inputs before processing
   - Use type hints and runtime validation
   - Sanitize file paths and command arguments

2. **Environment Variables**
   - Never log sensitive environment variables
   - Use the provided allowlist for environment variable filtering
   - Rotate API keys regularly

3. **Process Management**
   - Always use context managers for process handling
   - Set appropriate timeouts for all operations
   - Clean up processes properly on exit

4. **Error Handling**
   - Don't expose sensitive information in error messages
   - Log security events appropriately
   - Handle authentication errors gracefully

### For Users

1. **API Key Management**
   - Store API keys in environment variables, not in code
   - Use different API keys for different environments
   - Rotate API keys regularly

2. **File Permissions**
   - Ensure proper file permissions for config files
   - Don't share log files that might contain sensitive data

3. **Network Security**
   - Use HTTPS for all API communications
   - Validate SSL certificates
   - Use secure networks for sensitive operations

## Known Security Considerations

### Subprocess Usage

The SDK uses subprocess to execute Claude CLI commands. While this is properly secured:

- All subprocess calls use `shell=False` to prevent shell injection
- Arguments are sanitized to remove dangerous characters
- Environment variables are filtered using an allowlist approach
- Processes are properly managed and terminated

### File System Access

The SDK may create temporary files and directories:

- Temporary files are created with secure permissions
- Files are cleaned up after use
- Working directory access is controlled

### Network Communications

The SDK communicates with the Claude API:

- All communications use HTTPS
- API keys are handled securely
- Network errors are handled gracefully

## Security Updates

This security policy is reviewed and updated regularly. Last updated: September 2025

For questions about this security policy, please contact: security@automatic-claude-code.com