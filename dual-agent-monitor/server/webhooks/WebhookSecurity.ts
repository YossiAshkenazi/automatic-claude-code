import crypto from 'crypto';
import { EventEmitter } from 'events';

export interface WebhookSecurityOptions {
  enableSignatureVerification: boolean;
  signatureAlgorithm: 'sha256' | 'sha1' | 'sha512';
  signatureHeader: string;
  timestampHeader: string;
  timestampToleranceSeconds: number;
  enableRateLimiting: boolean;
  rateLimitWindow: number; // seconds
  rateLimitMaxRequests: number;
  enableIpWhitelisting: boolean;
  allowedIps: string[];
  enablePayloadEncryption: boolean;
  encryptionAlgorithm: string;
  encryptionKey?: string;
}

export interface SignatureValidationResult {
  valid: boolean;
  error?: string;
  computedSignature?: string;
  providedSignature?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  error?: string;
}

export interface EncryptionResult {
  encryptedData: string;
  iv: string;
  authTag?: string;
}

export class WebhookSecurity extends EventEmitter {
  private rateLimitStore: Map<string, { count: number; resetTime: number }> = new Map();
  private nonceStore: Set<string> = new Set();
  private readonly options: WebhookSecurityOptions;

  constructor(options?: Partial<WebhookSecurityOptions>) {
    super();
    this.options = {
      enableSignatureVerification: true,
      signatureAlgorithm: 'sha256',
      signatureHeader: 'X-Webhook-Signature',
      timestampHeader: 'X-Webhook-Timestamp',
      timestampToleranceSeconds: 300, // 5 minutes
      enableRateLimiting: true,
      rateLimitWindow: 3600, // 1 hour
      rateLimitMaxRequests: 1000,
      enableIpWhitelisting: false,
      allowedIps: [],
      enablePayloadEncryption: false,
      encryptionAlgorithm: 'aes-256-gcm',
      ...options
    };

    // Clean up expired rate limit entries every minute
    setInterval(() => this.cleanupRateLimit(), 60000);

    // Clean up old nonces every hour
    setInterval(() => this.cleanupNonces(), 3600000);
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  generateSignature(payload: string, secret: string): string {
    const hmac = crypto.createHmac(this.options.signatureAlgorithm, secret);
    hmac.update(payload, 'utf8');
    return `${this.options.signatureAlgorithm}=${hmac.digest('hex')}`;
  }

  /**
   * Verify webhook signature
   */
  verifySignature(
    payload: string, 
    signature: string, 
    secret: string, 
    timestamp?: string
  ): SignatureValidationResult {
    try {
      // Verify timestamp if provided and enabled
      if (timestamp && this.options.timestampToleranceSeconds > 0) {
        const timestampValidation = this.verifyTimestamp(timestamp);
        if (!timestampValidation.valid) {
          return {
            valid: false,
            error: timestampValidation.error
          };
        }
      }

      // Generate expected signature
      const computedSignature = this.generateSignature(payload, secret);
      
      // Normalize signatures for comparison
      const normalizedProvided = this.normalizeSignature(signature);
      const normalizedComputed = this.normalizeSignature(computedSignature);

      // Use constant-time comparison to prevent timing attacks
      const valid = this.constantTimeCompare(normalizedProvided, normalizedComputed);

      if (!valid) {
        this.emit('signature.invalid', {
          providedSignature: signature,
          computedSignature,
          payload: payload.substring(0, 100) + '...' // Log first 100 chars only
        });
      }

      return {
        valid,
        computedSignature,
        providedSignature: signature,
        error: valid ? undefined : 'Invalid signature'
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Signature verification failed'
      };
    }
  }

  /**
   * Verify timestamp to prevent replay attacks
   */
  verifyTimestamp(timestamp: string): { valid: boolean; error?: string } {
    try {
      const providedTime = parseInt(timestamp, 10);
      const currentTime = Math.floor(Date.now() / 1000);
      const timeDifference = Math.abs(currentTime - providedTime);

      if (timeDifference > this.options.timestampToleranceSeconds) {
        return {
          valid: false,
          error: `Timestamp too old or too far in future. Difference: ${timeDifference}s`
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: 'Invalid timestamp format'
      };
    }
  }

  /**
   * Check rate limiting for an IP address or endpoint
   */
  checkRateLimit(identifier: string): RateLimitResult {
    if (!this.options.enableRateLimiting) {
      return {
        allowed: true,
        remaining: this.options.rateLimitMaxRequests,
        resetTime: new Date(Date.now() + this.options.rateLimitWindow * 1000)
      };
    }

    const now = Math.floor(Date.now() / 1000);
    const windowStart = Math.floor(now / this.options.rateLimitWindow) * this.options.rateLimitWindow;
    const windowEnd = windowStart + this.options.rateLimitWindow;
    const key = `${identifier}:${windowStart}`;

    let entry = this.rateLimitStore.get(key);
    if (!entry) {
      entry = { count: 0, resetTime: windowEnd };
      this.rateLimitStore.set(key, entry);
    }

    entry.count++;

    const allowed = entry.count <= this.options.rateLimitMaxRequests;
    const remaining = Math.max(0, this.options.rateLimitMaxRequests - entry.count);

    if (!allowed) {
      this.emit('rateLimit.exceeded', {
        identifier,
        count: entry.count,
        limit: this.options.rateLimitMaxRequests,
        resetTime: new Date(entry.resetTime * 1000)
      });
    }

    return {
      allowed,
      remaining,
      resetTime: new Date(entry.resetTime * 1000),
      error: allowed ? undefined : 'Rate limit exceeded'
    };
  }

  /**
   * Verify IP whitelist
   */
  verifyIpWhitelist(clientIp: string): { allowed: boolean; error?: string } {
    if (!this.options.enableIpWhitelisting || this.options.allowedIps.length === 0) {
      return { allowed: true };
    }

    // Normalize IPv6 addresses
    const normalizedIp = this.normalizeIpAddress(clientIp);
    
    for (const allowedIp of this.options.allowedIps) {
      const normalizedAllowed = this.normalizeIpAddress(allowedIp);
      
      // Check for exact match or CIDR match
      if (normalizedIp === normalizedAllowed || this.isIpInCidr(normalizedIp, normalizedAllowed)) {
        return { allowed: true };
      }
    }

    this.emit('ip.blocked', { clientIp, allowedIps: this.options.allowedIps });
    
    return {
      allowed: false,
      error: `IP address ${clientIp} is not whitelisted`
    };
  }

  /**
   * Encrypt payload for sensitive data
   */
  encryptPayload(payload: string, key?: string): EncryptionResult {
    if (!this.options.enablePayloadEncryption) {
      throw new Error('Payload encryption is not enabled');
    }

    const encryptionKey = key || this.options.encryptionKey;
    if (!encryptionKey) {
      throw new Error('Encryption key is required');
    }

    try {
      const algorithm = this.options.encryptionAlgorithm;
      const keyBuffer = crypto.createHash('sha256').update(encryptionKey).digest();
      const iv = crypto.randomBytes(16);
      
      const cipher = crypto.createCipher(algorithm, keyBuffer);
      cipher.setAAD(Buffer.from('webhook-payload'));

      let encrypted = cipher.update(payload, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const result: EncryptionResult = {
        encryptedData: encrypted,
        iv: iv.toString('hex')
      };

      // Add auth tag for authenticated encryption algorithms
      if (algorithm.includes('gcm')) {
        result.authTag = (cipher as any).getAuthTag().toString('hex');
      }

      return result;
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt payload
   */
  decryptPayload(encryptedData: string, iv: string, key?: string, authTag?: string): string {
    if (!this.options.enablePayloadEncryption) {
      throw new Error('Payload encryption is not enabled');
    }

    const encryptionKey = key || this.options.encryptionKey;
    if (!encryptionKey) {
      throw new Error('Encryption key is required');
    }

    try {
      const algorithm = this.options.encryptionAlgorithm;
      const keyBuffer = crypto.createHash('sha256').update(encryptionKey).digest();
      const ivBuffer = Buffer.from(iv, 'hex');
      
      const decipher = crypto.createDecipher(algorithm, keyBuffer);
      
      if (algorithm.includes('gcm') && authTag) {
        (decipher as any).setAuthTag(Buffer.from(authTag, 'hex'));
        decipher.setAAD(Buffer.from('webhook-payload'));
      }

      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate secure random nonce
   */
  generateNonce(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Verify nonce to prevent replay attacks
   */
  verifyNonce(nonce: string, maxAge: number = 300000): { valid: boolean; error?: string } {
    if (this.nonceStore.has(nonce)) {
      return {
        valid: false,
        error: 'Nonce already used'
      };
    }

    // Store nonce with expiration
    this.nonceStore.add(nonce);
    
    // Schedule cleanup for this specific nonce
    setTimeout(() => {
      this.nonceStore.delete(nonce);
    }, maxAge);

    return { valid: true };
  }

  /**
   * Generate webhook signature for outgoing webhooks
   */
  signOutgoingWebhook(payload: any, secret: string): {
    signature: string;
    timestamp: string;
    nonce: string;
  } {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = this.generateNonce();
    const payloadString = JSON.stringify(payload);
    
    // Include timestamp and nonce in signature
    const signaturePayload = `${timestamp}.${nonce}.${payloadString}`;
    const signature = this.generateSignature(signaturePayload, secret);

    return {
      signature,
      timestamp,
      nonce
    };
  }

  /**
   * Verify incoming webhook signature (full verification)
   */
  verifyIncomingWebhook(
    payload: string,
    headers: Record<string, string>,
    secret: string
  ): {
    valid: boolean;
    errors: string[];
    details: {
      signatureValid: boolean;
      timestampValid: boolean;
      nonceValid: boolean;
    };
  } {
    const errors: string[] = [];
    let signatureValid = false;
    let timestampValid = false;
    let nonceValid = false;

    try {
      // Extract headers
      const signature = headers[this.options.signatureHeader.toLowerCase()];
      const timestamp = headers[this.options.timestampHeader.toLowerCase()];
      const nonce = headers['x-webhook-nonce'];

      if (!signature) {
        errors.push('Missing signature header');
      }

      if (!timestamp) {
        errors.push('Missing timestamp header');
      }

      // Verify timestamp
      if (timestamp) {
        const timestampResult = this.verifyTimestamp(timestamp);
        timestampValid = timestampResult.valid;
        if (!timestampValid) {
          errors.push(timestampResult.error || 'Invalid timestamp');
        }
      }

      // Verify nonce if provided
      if (nonce) {
        const nonceResult = this.verifyNonce(nonce);
        nonceValid = nonceResult.valid;
        if (!nonceValid) {
          errors.push(nonceResult.error || 'Invalid nonce');
        }
      } else {
        nonceValid = true; // Nonce is optional
      }

      // Verify signature
      if (signature) {
        const signaturePayload = nonce ? `${timestamp}.${nonce}.${payload}` : payload;
        const signatureResult = this.verifySignature(signaturePayload, signature, secret);
        signatureValid = signatureResult.valid;
        if (!signatureValid) {
          errors.push(signatureResult.error || 'Invalid signature');
        }
      }

      const valid = signatureValid && timestampValid && nonceValid;

      return {
        valid,
        errors,
        details: {
          signatureValid,
          timestampValid,
          nonceValid
        }
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Verification failed');
      return {
        valid: false,
        errors,
        details: {
          signatureValid,
          timestampValid,
          nonceValid
        }
      };
    }
  }

  /**
   * Normalize signature format
   */
  private normalizeSignature(signature: string): string {
    // Remove algorithm prefix if present (e.g., "sha256=abc123" -> "abc123")
    const match = signature.match(/^(\w+)=(.+)$/);
    return match ? match[2] : signature;
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Normalize IP address for comparison
   */
  private normalizeIpAddress(ip: string): string {
    // Remove port if present
    const ipWithoutPort = ip.replace(/:\d+$/, '');
    
    // Handle IPv4-mapped IPv6 addresses
    if (ipWithoutPort.startsWith('::ffff:')) {
      return ipWithoutPort.substring(7);
    }
    
    return ipWithoutPort;
  }

  /**
   * Check if IP is in CIDR range
   */
  private isIpInCidr(ip: string, cidr: string): boolean {
    if (!cidr.includes('/')) {
      return false; // Not a CIDR notation
    }

    try {
      const [network, prefixLength] = cidr.split('/');
      const prefix = parseInt(prefixLength, 10);
      
      // This is a simplified implementation
      // For production, consider using a proper CIDR library
      const ipParts = ip.split('.').map(Number);
      const networkParts = network.split('.').map(Number);
      
      if (ipParts.length !== 4 || networkParts.length !== 4) {
        return false; // Not IPv4
      }
      
      const ipInt = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
      const networkInt = (networkParts[0] << 24) | (networkParts[1] << 16) | (networkParts[2] << 8) | networkParts[3];
      const mask = ~(0xffffffff >>> prefix);
      
      return (ipInt & mask) === (networkInt & mask);
    } catch {
      return false;
    }
  }

  /**
   * Clean up expired rate limit entries
   */
  private cleanupRateLimit(): void {
    const now = Math.floor(Date.now() / 1000);
    
    for (const [key, entry] of this.rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        this.rateLimitStore.delete(key);
      }
    }
  }

  /**
   * Clean up old nonces
   */
  private cleanupNonces(): void {
    // Nonces are cleaned up individually with setTimeout
    // This method can be used for additional cleanup if needed
    if (this.nonceStore.size > 10000) {
      // If we have too many nonces, clear all (emergency cleanup)
      console.warn('Too many nonces stored, performing emergency cleanup');
      this.nonceStore.clear();
    }
  }

  /**
   * Get security statistics
   */
  getSecurityStatistics(): {
    rateLimitEntries: number;
    activeNonces: number;
    blockedIps: number;
    invalidSignatures: number;
  } {
    return {
      rateLimitEntries: this.rateLimitStore.size,
      activeNonces: this.nonceStore.size,
      blockedIps: 0, // Could track this if needed
      invalidSignatures: 0 // Could track this if needed
    };
  }

  /**
   * Update security configuration
   */
  updateConfiguration(updates: Partial<WebhookSecurityOptions>): void {
    Object.assign(this.options, updates);
    this.emit('configuration.updated', updates);
  }

  /**
   * Validate security configuration
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.options.enablePayloadEncryption && !this.options.encryptionKey) {
      errors.push('Encryption key is required when payload encryption is enabled');
    }

    if (this.options.timestampToleranceSeconds < 0) {
      errors.push('Timestamp tolerance must be non-negative');
    }

    if (this.options.rateLimitMaxRequests < 1) {
      errors.push('Rate limit max requests must be at least 1');
    }

    if (this.options.rateLimitWindow < 1) {
      errors.push('Rate limit window must be at least 1 second');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}