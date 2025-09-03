/**
 * Security Configuration Validator
 * Ensures production deployments don't use default/weak credentials
 */

import * as fs from 'fs';
import * as path from 'path';

interface SecurityValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class SecurityValidator {
  private static WEAK_PASSWORDS = [
    'password', 'admin', '123456', 'password123',
    'acc_secure_password_123', 'CHANGE_THIS', 'CHANGE_ME',
    'your_jwt_secret_here', 'your_webhook_secret_here'
  ];

  private static MIN_SECRET_LENGTH = 32;

  /**
   * Validate environment configuration for security issues
   */
  static validateEnvironment(): SecurityValidationResult {
    const result: SecurityValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Check for production mode
    const isProduction = process.env.NODE_ENV === 'production';

    // Validate database password
    const dbPassword = process.env.POSTGRES_PASSWORD;
    if (dbPassword) {
      if (this.isWeakPassword(dbPassword)) {
        const msg = 'Database password appears to be a default or weak value';
        if (isProduction) {
          result.errors.push(msg);
          result.valid = false;
        } else {
          result.warnings.push(msg);
        }
      }
    }

    // Validate JWT secret
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret) {
      if (jwtSecret.length < this.MIN_SECRET_LENGTH) {
        const msg = `JWT secret must be at least ${this.MIN_SECRET_LENGTH} characters`;
        if (isProduction) {
          result.errors.push(msg);
          result.valid = false;
        } else {
          result.warnings.push(msg);
        }
      }
      if (this.isWeakPassword(jwtSecret)) {
        const msg = 'JWT secret appears to be a default value';
        if (isProduction) {
          result.errors.push(msg);
          result.valid = false;
        } else {
          result.warnings.push(msg);
        }
      }
    }

    // Validate webhook secret
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (webhookSecret) {
      if (webhookSecret.length < this.MIN_SECRET_LENGTH) {
        const msg = `Webhook secret must be at least ${this.MIN_SECRET_LENGTH} characters`;
        if (isProduction) {
          result.errors.push(msg);
          result.valid = false;
        } else {
          result.warnings.push(msg);
        }
      }
      if (this.isWeakPassword(webhookSecret)) {
        const msg = 'Webhook secret appears to be a default value';
        if (isProduction) {
          result.errors.push(msg);
          result.valid = false;
        } else {
          result.warnings.push(msg);
        }
      }
    }

    // Check for API key exposure
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey && apiKey.includes('sk-ant-')) {
      // Never log the actual API key
      result.warnings.push('API key detected in environment - ensure it is properly secured');
    }

    return result;
  }

  /**
   * Check if a password/secret is weak or a default value
   */
  private static isWeakPassword(value: string): boolean {
    const lowerValue = value.toLowerCase();
    return this.WEAK_PASSWORDS.some(weak => 
      lowerValue.includes(weak.toLowerCase())
    );
  }

  /**
   * Generate a secure random secret
   */
  static generateSecureSecret(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let result = '';
    const crypto = require('crypto');
    const randomBytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      result += chars[randomBytes[i] % chars.length];
    }
    
    return result;
  }

  /**
   * Validate and report security configuration on startup
   */
  static validateOnStartup(): void {
    const validation = this.validateEnvironment();
    
    if (validation.errors.length > 0) {
      console.error('🔴 SECURITY CONFIGURATION ERRORS:');
      validation.errors.forEach(error => console.error(`  - ${error}`));
      
      if (process.env.NODE_ENV === 'production') {
        console.error('\n⚠️  Production deployment blocked due to security issues');
        console.error('Please update your environment configuration');
        process.exit(1);
      }
    }
    
    if (validation.warnings.length > 0) {
      console.warn('⚠️  Security Configuration Warnings:');
      validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }
    
    if (validation.valid && validation.warnings.length === 0) {
      console.log('✅ Security configuration validated successfully');
    }
  }
}

// Export for use in other modules
export default SecurityValidator;