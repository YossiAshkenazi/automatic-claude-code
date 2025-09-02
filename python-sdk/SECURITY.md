# Security Policy

## Supported Versions

Currently supported versions for security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please follow these steps:

### 1. Do NOT Create a Public Issue
Security vulnerabilities should not be reported via public GitHub issues.

### 2. Email Security Team
Send details to: security@claude-code-sdk.dev

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### 3. Response Timeline
- **Initial Response**: Within 48 hours
- **Status Update**: Within 5 business days
- **Resolution Target**: Within 30 days for critical issues

## Security Best Practices

### For Users

1. **Keep SDK Updated**
   ```bash
   pip install --upgrade claude-code-sdk
   ```

2. **Secure API Credentials**
   - Never commit API keys to version control
   - Use environment variables for sensitive data
   - Rotate credentials regularly

3. **Validate Input**
   - Sanitize user input before passing to SDK
   - Implement rate limiting in production

4. **Monitor Usage**
   - Review SDK logs regularly
   - Set up alerts for anomalous behavior
   - Track API usage patterns

### For Contributors

1. **Code Review**
   - All code must be reviewed before merge
   - Security-sensitive changes require additional review

2. **Dependency Management**
   - Keep dependencies updated
   - Review dependency security advisories
   - Use dependency scanning tools

3. **Testing**
   - Include security test cases
   - Test error handling paths
   - Validate input sanitization

## Known Security Considerations

### Claude CLI Integration
- The SDK requires Claude CLI to be installed and authenticated
- Ensure Claude CLI is from official sources
- Keep Claude CLI updated

### Session Management
- Sessions may contain sensitive data
- Implement proper session cleanup
- Use secure session storage

### Network Communication
- All API calls use HTTPS
- Certificate validation is enforced
- No sensitive data in URLs

## Security Features

### Built-in Protections
- Input validation and sanitization
- Secure session handling
- Automatic credential masking in logs
- Rate limiting support
- Timeout configurations

### Audit Logging
- All API calls are logged
- Sensitive data is redacted
- Logs include timestamps and correlation IDs

## Vulnerability Disclosure Process

1. **Report Received**: Acknowledgment sent
2. **Triage**: Severity assessment
3. **Fix Development**: Patch created
4. **Testing**: Security testing of fix
5. **Release**: Coordinated disclosure
6. **Announcement**: Security advisory published

## Security Updates

Subscribe to security updates:
- GitHub Security Advisories
- Email list: security-announce@claude-code-sdk.dev
- RSS feed: /security/feed.xml

## Compliance

The SDK is designed with security best practices:
- OWASP guidelines
- CWE mitigation strategies
- Regular security audits
- Dependency vulnerability scanning

## Contact

- Security Team: security@claude-code-sdk.dev
- PGP Key: [Public key available on request]
- Response Time: 48 hours

Thank you for helping keep claude-code-sdk secure!