import { WebhookEventPayload, WebhookEvent } from '../../types.js';

export interface EmailMessage {
  to: string;
  from?: string;
  subject: string;
  text?: string;
  html?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
  encoding?: string;
  cid?: string;
}

export class EmailIntegration {
  /**
   * Transform webhook event payload to email format
   */
  static transformPayload(event: WebhookEvent, payload: WebhookEventPayload, config: { to: string; from?: string }): EmailMessage {
    const baseEmail: EmailMessage = {
      to: config.to,
      from: config.from || 'noreply@dual-agent-monitor.com',
      subject: '',
      text: '',
      html: ''
    };

    switch (event) {
      case 'session.started':
        return {
          ...baseEmail,
          subject: `🚀 Dual-Agent Session Started - ${payload.sessionId}`,
          text: this.generateTextContent('session.started', payload),
          html: this.generateHtmlContent('session.started', payload)
        };

      case 'session.completed':
        return {
          ...baseEmail,
          subject: `✅ Session Completed Successfully - ${payload.sessionId}`,
          text: this.generateTextContent('session.completed', payload),
          html: this.generateHtmlContent('session.completed', payload)
        };

      case 'session.failed':
        return {
          ...baseEmail,
          subject: `❌ Session Failed - ${payload.sessionId}`,
          text: this.generateTextContent('session.failed', payload),
          html: this.generateHtmlContent('session.failed', payload)
        };

      case 'performance.alert':
        const severity = payload.alert?.severity || 'medium';
        const severityEmojis = { low: '⚡', medium: '⚠️', high: '🚨', critical: '🆘' };
        return {
          ...baseEmail,
          subject: `${severityEmojis[severity as keyof typeof severityEmojis]} Performance Alert - ${severity.toUpperCase()}`,
          text: this.generateTextContent('performance.alert', payload),
          html: this.generateHtmlContent('performance.alert', payload)
        };

      case 'anomaly.detected':
        return {
          ...baseEmail,
          subject: `🔍 Anomaly Detected - ${payload.anomaly?.type || 'Unknown'}`,
          text: this.generateTextContent('anomaly.detected', payload),
          html: this.generateHtmlContent('anomaly.detected', payload)
        };

      case 'cost.threshold':
        return {
          ...baseEmail,
          subject: `💰 Cost Threshold Exceeded - $${payload.cost?.current.toFixed(2) || '0.00'}`,
          text: this.generateTextContent('cost.threshold', payload),
          html: this.generateHtmlContent('cost.threshold', payload)
        };

      case 'user.login':
        return {
          ...baseEmail,
          subject: `👤 User Login Alert - ${payload.user?.email || 'Unknown User'}`,
          text: this.generateTextContent('user.login', payload),
          html: this.generateHtmlContent('user.login', payload)
        };

      case 'webhook.test':
        return {
          ...baseEmail,
          subject: '🧪 Webhook Test - Dual-Agent Monitor',
          text: this.generateTextContent('webhook.test', payload),
          html: this.generateHtmlContent('webhook.test', payload)
        };

      default:
        return {
          ...baseEmail,
          subject: `📢 Webhook Event - ${event}`,
          text: this.generateTextContent(event, payload),
          html: this.generateHtmlContent(event, payload)
        };
    }
  }

  /**
   * Generate plain text email content
   */
  private static generateTextContent(event: WebhookEvent, payload: WebhookEventPayload): string {
    const timestamp = new Date().toLocaleString();
    
    switch (event) {
      case 'session.started':
        return `
Dual-Agent Monitor Alert
========================

🚀 NEW SESSION STARTED

Session Details:
- Session ID: ${payload.sessionId || 'Unknown'}
- Initial Task: ${payload.session?.initialTask || 'Not specified'}
- Status: ${payload.session?.status || 'running'}
- Started At: ${timestamp}
- Work Directory: ${payload.session?.workDir || 'Not specified'}

The dual-agent system has begun processing this task. You will receive additional notifications as the session progresses.

---
Dual-Agent Monitor
Generated at: ${timestamp}
        `.trim();

      case 'session.completed':
        const summary = payload.session?.summary;
        const duration = summary?.totalDuration ? Math.round(summary.totalDuration / 1000) : 0;
        const successRate = summary?.successRate ? Math.round(summary.successRate * 100) : 0;

        return `
Dual-Agent Monitor Alert
========================

✅ SESSION COMPLETED SUCCESSFULLY

Session Details:
- Session ID: ${payload.sessionId || 'Unknown'}
- Task: ${payload.session?.initialTask || 'Not specified'}
- Duration: ${duration}s
- Completed At: ${timestamp}

Performance Summary:
- Total Messages: ${summary?.totalMessages || 0}
- Manager Messages: ${summary?.managerMessages || 0}
- Worker Messages: ${summary?.workerMessages || 0}
- Success Rate: ${successRate}%
- Files Modified: ${summary?.filesModified?.length || 0}
- Commands Executed: ${summary?.commandsExecuted?.length || 0}
- Tools Used: ${summary?.toolsUsed?.length || 0}

${summary?.filesModified && summary.filesModified.length > 0 ? `
Modified Files:
${summary.filesModified.map(file => `- ${file}`).join('\n')}
` : ''}

The session has completed successfully with all tasks finished.

---
Dual-Agent Monitor
Generated at: ${timestamp}
        `.trim();

      case 'session.failed':
        return `
Dual-Agent Monitor Alert
========================

❌ SESSION FAILED

Session Details:
- Session ID: ${payload.sessionId || 'Unknown'}
- Task: ${payload.session?.initialTask || 'Not specified'}
- Failed At: ${timestamp}
- Severity: ${payload.alert?.severity?.toUpperCase() || 'UNKNOWN'}

Error Information:
${payload.alert?.message || 'Unknown error occurred'}

${payload.alert?.details ? `
Additional Details:
${JSON.stringify(payload.alert.details, null, 2)}
` : ''}

The session encountered a critical error and was unable to complete. Please review the error details and consider restarting the session if appropriate.

---
Dual-Agent Monitor
Generated at: ${timestamp}
        `.trim();

      case 'performance.alert':
        return `
Dual-Agent Monitor Alert
========================

⚠️ PERFORMANCE ALERT

Alert Details:
- Type: ${payload.alert?.type || 'Unknown'}
- Severity: ${payload.alert?.severity?.toUpperCase() || 'UNKNOWN'}
- Session ID: ${payload.sessionId || 'N/A'}
- Detected At: ${timestamp}

Alert Message:
${payload.alert?.message || 'No details available'}

${payload.metrics ? `
Performance Metrics:
- Agent Type: ${payload.metrics.agentType || 'Unknown'}
- Response Time: ${payload.metrics.responseTime || 0}ms
- Tokens Used: ${payload.metrics.tokensUsed || 0}
- Error Rate: ${(payload.metrics.errorRate || 0) * 100}%
` : ''}

Please review the system performance and consider investigating if this alert persists.

---
Dual-Agent Monitor
Generated at: ${timestamp}
        `.trim();

      case 'anomaly.detected':
        return `
Dual-Agent Monitor Alert
========================

🔍 ANOMALY DETECTED

Anomaly Details:
- Type: ${payload.anomaly?.type || 'Unknown'}
- Confidence: ${payload.anomaly?.confidence ? Math.round(payload.anomaly.confidence * 100) + '%' : 'Unknown'}
- Session ID: ${payload.sessionId || 'N/A'}
- Detected At: ${timestamp}

Description:
${payload.anomaly?.description || 'No description available'}

${payload.anomaly?.data ? `
Additional Data:
${JSON.stringify(payload.anomaly.data, null, 2)}
` : ''}

An unusual pattern has been detected in the system behavior. Please review and investigate as needed.

---
Dual-Agent Monitor
Generated at: ${timestamp}
        `.trim();

      case 'cost.threshold':
        const currentCost = payload.cost?.current || 0;
        const threshold = payload.cost?.threshold || 0;
        const overage = currentCost - threshold;
        const overagePercent = threshold > 0 ? Math.round((overage / threshold) * 100) : 0;

        return `
Dual-Agent Monitor Alert
========================

💰 COST THRESHOLD EXCEEDED

Cost Information:
- Current Cost: $${currentCost.toFixed(2)}
- Threshold: $${threshold.toFixed(2)}
- Overage: $${overage.toFixed(2)} (${overagePercent}% over)
- Period: ${payload.cost?.period || 'Unknown'}
- Alert Time: ${timestamp}

${payload.alert?.message || 'Your usage has exceeded the configured cost threshold.'}

Please review your usage and consider adjusting your budget limits or optimizing system usage.

---
Dual-Agent Monitor
Generated at: ${timestamp}
        `.trim();

      case 'user.login':
        return `
Dual-Agent Monitor Alert
========================

👤 USER LOGIN EVENT

Login Details:
- User ID: ${payload.user?.id || 'Unknown'}
- Email: ${payload.user?.email || 'Unknown'}
- Login Time: ${payload.user?.timestamp ? new Date(payload.user.timestamp).toLocaleString() : timestamp}
- IP Address: ${payload.user?.ipAddress || 'Not available'}
- User Agent: ${payload.user?.userAgent || 'Not available'}

A user has successfully logged into the Dual-Agent Monitor system.

---
Dual-Agent Monitor
Generated at: ${timestamp}
        `.trim();

      case 'webhook.test':
        return `
Dual-Agent Monitor Alert
========================

🧪 WEBHOOK TEST

Test Details:
- Status: SUCCESS
- Test Time: ${timestamp}
- Integration: Email
- Webhook URL: ${payload.webhookUrl || 'Not specified'}

This is a test email from Dual-Agent Monitor to verify that your email webhook integration is working correctly.

If you received this email, your webhook configuration is properly set up and functioning.

---
Dual-Agent Monitor
Generated at: ${timestamp}
        `.trim();

      default:
        return `
Dual-Agent Monitor Alert
========================

📢 WEBHOOK EVENT: ${event.toUpperCase()}

Event Details:
- Event Type: ${event}
- Timestamp: ${timestamp}
- Session ID: ${payload.sessionId || 'N/A'}

Raw Event Data:
${JSON.stringify(payload, null, 2)}

---
Dual-Agent Monitor
Generated at: ${timestamp}
        `.trim();
    }
  }

  /**
   * Generate HTML email content
   */
  private static generateHtmlContent(event: WebhookEvent, payload: WebhookEventPayload): string {
    const timestamp = new Date().toLocaleString();
    const baseStyle = `
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef; }
        .alert { padding: 15px; border-radius: 6px; margin: 15px 0; }
        .alert-success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
        .alert-warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; }
        .alert-danger { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
        .alert-info { background: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 15px 0; }
        .metric-item { background: white; padding: 10px; border-radius: 6px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-value { font-size: 1.5em; font-weight: bold; color: #495057; }
        .metric-label { font-size: 0.9em; color: #6c757d; }
        .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 0.9em; }
        .code { background: #f1f3f4; padding: 10px; border-radius: 4px; font-family: monospace; overflow-x: auto; }
        .list-item { padding: 5px 0; }
        h1 { margin: 0; font-size: 1.5em; }
        h2 { color: #495057; margin-top: 25px; margin-bottom: 10px; }
        .timestamp { font-weight: normal; font-size: 0.9em; opacity: 0.8; }
      </style>
    `;

    switch (event) {
      case 'session.started':
        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Session Started - Dual-Agent Monitor</title>
  ${baseStyle}
</head>
<body>
  <div class="header">
    <h1>🚀 New Session Started</h1>
    <div class="timestamp">${timestamp}</div>
  </div>
  <div class="content">
    <div class="alert alert-success">
      A new dual-agent session has been initiated and is now running.
    </div>
    
    <h2>Session Details</h2>
    <div class="metrics-grid">
      <div class="metric-item">
        <div class="metric-value">${payload.sessionId || 'Unknown'}</div>
        <div class="metric-label">Session ID</div>
      </div>
      <div class="metric-item">
        <div class="metric-value">${payload.session?.status || 'running'}</div>
        <div class="metric-label">Status</div>
      </div>
    </div>
    
    <h2>Initial Task</h2>
    <div class="code">${this.escapeHtml(payload.session?.initialTask || 'Not specified')}</div>
    
    ${payload.session?.workDir ? `
    <h2>Work Directory</h2>
    <div class="code">${this.escapeHtml(payload.session.workDir)}</div>
    ` : ''}
    
    <div class="footer">
      <p><strong>Dual-Agent Monitor</strong></p>
      <p>Generated at: ${timestamp}</p>
    </div>
  </div>
</body>
</html>
        `.trim();

      case 'session.completed':
        const summary = payload.session?.summary;
        const duration = summary?.totalDuration ? Math.round(summary.totalDuration / 1000) : 0;
        const successRate = summary?.successRate ? Math.round(summary.successRate * 100) : 0;

        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Session Completed - Dual-Agent Monitor</title>
  ${baseStyle}
</head>
<body>
  <div class="header">
    <h1>✅ Session Completed Successfully</h1>
    <div class="timestamp">${timestamp}</div>
  </div>
  <div class="content">
    <div class="alert alert-success">
      The dual-agent session has completed successfully with all tasks finished.
    </div>
    
    <h2>Session Summary</h2>
    <div class="metrics-grid">
      <div class="metric-item">
        <div class="metric-value">${duration}s</div>
        <div class="metric-label">Duration</div>
      </div>
      <div class="metric-item">
        <div class="metric-value">${successRate}%</div>
        <div class="metric-label">Success Rate</div>
      </div>
      <div class="metric-item">
        <div class="metric-value">${summary?.totalMessages || 0}</div>
        <div class="metric-label">Total Messages</div>
      </div>
      <div class="metric-item">
        <div class="metric-value">${summary?.filesModified?.length || 0}</div>
        <div class="metric-label">Files Modified</div>
      </div>
    </div>
    
    <h2>Task Details</h2>
    <div class="code">${this.escapeHtml(payload.session?.initialTask || 'Not specified')}</div>
    
    ${summary?.filesModified && summary.filesModified.length > 0 ? `
    <h2>Modified Files</h2>
    <ul>
      ${summary.filesModified.map(file => `<li class="list-item"><code>${this.escapeHtml(file)}</code></li>`).join('')}
    </ul>
    ` : ''}
    
    <div class="footer">
      <p><strong>Dual-Agent Monitor</strong></p>
      <p>Generated at: ${timestamp}</p>
    </div>
  </div>
</body>
</html>
        `.trim();

      case 'session.failed':
        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Session Failed - Dual-Agent Monitor</title>
  ${baseStyle}
</head>
<body>
  <div class="header">
    <h1>❌ Session Failed</h1>
    <div class="timestamp">${timestamp}</div>
  </div>
  <div class="content">
    <div class="alert alert-danger">
      The session encountered a critical error and was unable to complete.
    </div>
    
    <h2>Error Information</h2>
    <div class="metrics-grid">
      <div class="metric-item">
        <div class="metric-value">${payload.sessionId || 'Unknown'}</div>
        <div class="metric-label">Session ID</div>
      </div>
      <div class="metric-item">
        <div class="metric-value">${payload.alert?.severity?.toUpperCase() || 'UNKNOWN'}</div>
        <div class="metric-label">Severity</div>
      </div>
    </div>
    
    <h2>Task Details</h2>
    <div class="code">${this.escapeHtml(payload.session?.initialTask || 'Not specified')}</div>
    
    <h2>Error Message</h2>
    <div class="alert alert-danger">
      ${this.escapeHtml(payload.alert?.message || 'Unknown error occurred')}
    </div>
    
    ${payload.alert?.details ? `
    <h2>Additional Details</h2>
    <div class="code">${this.escapeHtml(JSON.stringify(payload.alert.details, null, 2))}</div>
    ` : ''}
    
    <div class="footer">
      <p><strong>Dual-Agent Monitor</strong></p>
      <p>Generated at: ${timestamp}</p>
    </div>
  </div>
</body>
</html>
        `.trim();

      default:
        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Webhook Event - Dual-Agent Monitor</title>
  ${baseStyle}
</head>
<body>
  <div class="header">
    <h1>📢 Webhook Event: ${event}</h1>
    <div class="timestamp">${timestamp}</div>
  </div>
  <div class="content">
    <div class="alert alert-info">
      A webhook event has been triggered in the Dual-Agent Monitor system.
    </div>
    
    <h2>Event Data</h2>
    <div class="code">${this.escapeHtml(JSON.stringify(payload, null, 2))}</div>
    
    <div class="footer">
      <p><strong>Dual-Agent Monitor</strong></p>
      <p>Generated at: ${timestamp}</p>
    </div>
  </div>
</body>
</html>
        `.trim();
    }
  }

  /**
   * Escape HTML special characters
   */
  private static escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * Validate email configuration
   */
  static validateConfig(config: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.to || !this.isValidEmail(config.to)) {
      errors.push('Valid recipient email address is required');
    }

    if (config.from && !this.isValidEmail(config.from)) {
      errors.push('From email address must be valid');
    }

    if (config.cc && Array.isArray(config.cc)) {
      for (const email of config.cc) {
        if (!this.isValidEmail(email)) {
          errors.push(`Invalid CC email: ${email}`);
        }
      }
    }

    if (config.bcc && Array.isArray(config.bcc)) {
      for (const email of config.bcc) {
        if (!this.isValidEmail(email)) {
          errors.push(`Invalid BCC email: ${email}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate email address format
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get recommended configuration for email integration
   */
  static getRecommendedConfig() {
    return {
      headers: {
        'Content-Type': 'application/json'
      },
      events: [
        'session.failed',
        'performance.alert',
        'cost.threshold',
        'anomaly.detected'
      ],
      payloadFields: ['to', 'from', 'subject', 'text', 'html'],
      rateLimitPerMinute: 10 // Conservative rate limit for email
    };
  }
}