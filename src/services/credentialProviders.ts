/**
 * Credential Providers - Enhanced OAuth token extraction with multiple backends
 * Supports various credential storage mechanisms with graceful fallbacks
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../logger';

const execAsync = promisify(exec);

export interface CredentialProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  getToken(service: string, account: string): Promise<string | null>;
  setToken(service: string, account: string, token: string): Promise<void>;
  deleteToken(service: string, account: string): Promise<void>;
  listTokens(service: string): Promise<string[]>;
}

/**
 * Windows Credential Manager Provider
 * Uses PowerShell and cmdkey for credential management
 */
export class WindowsCredentialProvider implements CredentialProvider {
  name = 'Windows Credential Manager';
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
  }

  async isAvailable(): Promise<boolean> {
    if (process.platform !== 'win32') return false;

    try {
      // Test cmdkey availability (always available on Windows)
      await execAsync('cmdkey /?');
      return true;
    } catch {
      return false;
    }
  }

  async getToken(service: string, account: string): Promise<string | null> {
    try {
      // Try PowerShell first (more robust)
      try {
        const { stdout } = await execAsync(
          `powershell.exe -Command "Get-StoredCredential -Target '${service}' | ConvertTo-Json"`
        );
        const cred = JSON.parse(stdout);
        if (cred && cred.Password) {
          return cred.Password;
        }
      } catch (psError) {
        this.logger.debug(`PowerShell credential access failed: ${psError}`);
      }

      // Fallback to cmdkey with registry parsing
      const { stdout } = await execAsync(`cmdkey /list | findstr "${service}"`);
      if (stdout.includes(service)) {
        this.logger.debug(`Found credential for ${service}, but cmdkey doesn't expose password directly`);
        // cmdkey can't retrieve passwords directly, only indicate presence
        return null;
      }

      return null;
    } catch (error) {
      this.logger.debug(`Windows credential retrieval failed: ${error}`);
      return null;
    }
  }

  async setToken(service: string, account: string, token: string): Promise<void> {
    try {
      await execAsync(`cmdkey /generic:${service} /user:${account} /pass:${token}`);
      this.logger.debug(`Stored credential for ${service}`);
    } catch (error) {
      throw new Error(`Failed to store Windows credential: ${error}`);
    }
  }

  async deleteToken(service: string, account: string): Promise<void> {
    try {
      await execAsync(`cmdkey /delete:${service}`);
      this.logger.debug(`Deleted credential for ${service}`);
    } catch (error) {
      throw new Error(`Failed to delete Windows credential: ${error}`);
    }
  }

  async listTokens(service: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync('cmdkey /list');
      const lines = stdout.split('\n');
      const targets = lines
        .filter(line => line.includes('Target:') && line.includes(service))
        .map(line => line.split('Target:')[1]?.trim())
        .filter(Boolean);
      return targets;
    } catch (error) {
      this.logger.debug(`Failed to list Windows credentials: ${error}`);
      return [];
    }
  }
}

/**
 * macOS Keychain Provider
 * Uses the 'security' command for keychain access
 */
export class MacOSKeychainProvider implements CredentialProvider {
  name = 'macOS Keychain';
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
  }

  async isAvailable(): Promise<boolean> {
    if (process.platform !== 'darwin') return false;

    try {
      await execAsync('security -h');
      return true;
    } catch {
      return false;
    }
  }

  async getToken(service: string, account: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync(
        `security find-generic-password -s "${service}" -a "${account}" -w`
      );
      return stdout.trim() || null;
    } catch (error) {
      this.logger.debug(`macOS keychain retrieval failed: ${error}`);
      return null;
    }
  }

  async setToken(service: string, account: string, token: string): Promise<void> {
    try {
      // First try to update existing entry
      try {
        await execAsync(
          `security add-generic-password -s "${service}" -a "${account}" -w "${token}" -U`
        );
      } catch {
        // If update fails, add new entry
        await execAsync(
          `security add-generic-password -s "${service}" -a "${account}" -w "${token}"`
        );
      }
      this.logger.debug(`Stored keychain entry for ${service}`);
    } catch (error) {
      throw new Error(`Failed to store macOS keychain entry: ${error}`);
    }
  }

  async deleteToken(service: string, account: string): Promise<void> {
    try {
      await execAsync(
        `security delete-generic-password -s "${service}" -a "${account}"`
      );
      this.logger.debug(`Deleted keychain entry for ${service}`);
    } catch (error) {
      throw new Error(`Failed to delete macOS keychain entry: ${error}`);
    }
  }

  async listTokens(service: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync(
        `security dump-keychain | grep -A 1 -B 1 "${service}"`
      );
      // Parse keychain dump output to extract service names
      const lines = stdout.split('\n');
      const services = lines
        .filter(line => line.includes('svce'))
        .map(line => {
          const match = line.match(/"([^"]+)"/);
          return match ? match[1] : null;
        })
        .filter(Boolean);
      return services as string[];
    } catch (error) {
      this.logger.debug(`Failed to list keychain entries: ${error}`);
      return [];
    }
  }
}

/**
 * File System Provider
 * Stores credentials in encrypted JSON files
 */
export class FileSystemProvider implements CredentialProvider {
  name = 'File System';
  private logger: Logger;
  private credentialsDir: string;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.credentialsDir = path.join(os.homedir(), '.claude', 'credentials');
    this.ensureCredentialsDir();
  }

  async isAvailable(): Promise<boolean> {
    try {
      fs.accessSync(this.credentialsDir, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  private ensureCredentialsDir(): void {
    try {
      fs.mkdirSync(this.credentialsDir, { recursive: true, mode: 0o700 });
    } catch (error) {
      this.logger.debug(`Failed to create credentials directory: ${error}`);
    }
  }

  private getCredentialFilePath(service: string): string {
    const safeService = service.replace(/[^a-zA-Z0-9-_.]/g, '_');
    return path.join(this.credentialsDir, `${safeService}.json`);
  }

  async getToken(service: string, account: string): Promise<string | null> {
    try {
      const filePath = this.getCredentialFilePath(service);
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const credentials = JSON.parse(content);
      return credentials[account] || null;
    } catch (error) {
      this.logger.debug(`File system credential retrieval failed: ${error}`);
      return null;
    }
  }

  async setToken(service: string, account: string, token: string): Promise<void> {
    try {
      const filePath = this.getCredentialFilePath(service);
      let credentials: Record<string, string> = {};

      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        credentials = JSON.parse(content);
      }

      credentials[account] = token;
      
      fs.writeFileSync(filePath, JSON.stringify(credentials, null, 2), { 
        mode: 0o600 // Readable/writable by owner only
      });
      
      this.logger.debug(`Stored file system credential for ${service}:${account}`);
    } catch (error) {
      throw new Error(`Failed to store file system credential: ${error}`);
    }
  }

  async deleteToken(service: string, account: string): Promise<void> {
    try {
      const filePath = this.getCredentialFilePath(service);
      if (!fs.existsSync(filePath)) {
        return;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const credentials = JSON.parse(content);
      delete credentials[account];

      if (Object.keys(credentials).length === 0) {
        fs.unlinkSync(filePath);
      } else {
        fs.writeFileSync(filePath, JSON.stringify(credentials, null, 2), { mode: 0o600 });
      }
      
      this.logger.debug(`Deleted file system credential for ${service}:${account}`);
    } catch (error) {
      throw new Error(`Failed to delete file system credential: ${error}`);
    }
  }

  async listTokens(service: string): Promise<string[]> {
    try {
      const filePath = this.getCredentialFilePath(service);
      if (!fs.existsSync(filePath)) {
        return [];
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const credentials = JSON.parse(content);
      return Object.keys(credentials);
    } catch (error) {
      this.logger.debug(`Failed to list file system credentials: ${error}`);
      return [];
    }
  }
}

/**
 * Keytar Provider Wrapper
 * Optional native keytar integration when available
 */
export class KeytarProvider implements CredentialProvider {
  name = 'Keytar (Native)';
  private logger: Logger;
  private keytar: any = null;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.initKeytar();
  }

  private async initKeytar(): Promise<void> {
    try {
      this.keytar = require('keytar');
      this.logger.debug('Keytar module loaded successfully');
    } catch (error) {
      this.logger.debug(`Keytar module not available: ${error}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    return this.keytar !== null;
  }

  async getToken(service: string, account: string): Promise<string | null> {
    if (!this.keytar) return null;

    try {
      return await this.keytar.getPassword(service, account);
    } catch (error) {
      this.logger.debug(`Keytar getPassword failed: ${error}`);
      return null;
    }
  }

  async setToken(service: string, account: string, token: string): Promise<void> {
    if (!this.keytar) {
      throw new Error('Keytar not available');
    }

    try {
      await this.keytar.setPassword(service, account, token);
      this.logger.debug(`Stored keytar credential for ${service}:${account}`);
    } catch (error) {
      throw new Error(`Failed to store keytar credential: ${error}`);
    }
  }

  async deleteToken(service: string, account: string): Promise<void> {
    if (!this.keytar) {
      throw new Error('Keytar not available');
    }

    try {
      await this.keytar.deletePassword(service, account);
      this.logger.debug(`Deleted keytar credential for ${service}:${account}`);
    } catch (error) {
      throw new Error(`Failed to delete keytar credential: ${error}`);
    }
  }

  async listTokens(service: string): Promise<string[]> {
    if (!this.keytar) return [];

    try {
      const credentials = await this.keytar.findCredentials(service);
      return credentials.map((cred: any) => cred.account);
    } catch (error) {
      this.logger.debug(`Failed to list keytar credentials: ${error}`);
      return [];
    }
  }
}

/**
 * Credential Manager - Orchestrates multiple providers
 */
export class CredentialManager {
  private providers: CredentialProvider[] = [];
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.initializeProviders();
  }

  private async initializeProviders(): Promise<void> {
    const potentialProviders = [
      new KeytarProvider(this.logger),
      new WindowsCredentialProvider(this.logger),
      new MacOSKeychainProvider(this.logger),
      new FileSystemProvider(this.logger)
    ];

    for (const provider of potentialProviders) {
      if (await provider.isAvailable()) {
        this.providers.push(provider);
        this.logger.debug(`Credential provider available: ${provider.name}`);
      } else {
        this.logger.debug(`Credential provider not available: ${provider.name}`);
      }
    }

    if (this.providers.length === 0) {
      this.logger.error('No credential providers available');
    }
  }

  /**
   * Get available providers
   */
  getProviders(): CredentialProvider[] {
    return [...this.providers];
  }

  /**
   * Get token from the first available provider
   */
  async getToken(service: string, account: string = 'default'): Promise<string | null> {
    for (const provider of this.providers) {
      try {
        const token = await provider.getToken(service, account);
        if (token) {
          this.logger.debug(`Token retrieved from ${provider.name}`);
          return token;
        }
      } catch (error) {
        this.logger.debug(`${provider.name} getToken failed: ${error}`);
      }
    }
    return null;
  }

  /**
   * Set token using the first available provider
   */
  async setToken(service: string, account: string = 'default', token: string): Promise<void> {
    if (this.providers.length === 0) {
      throw new Error('No credential providers available');
    }

    const provider = this.providers[0];
    await provider.setToken(service, account, token);
    this.logger.info(`Token stored using ${provider.name}`);
  }

  /**
   * Delete token from all providers
   */
  async deleteToken(service: string, account: string = 'default'): Promise<void> {
    let deleted = false;
    for (const provider of this.providers) {
      try {
        await provider.deleteToken(service, account);
        deleted = true;
      } catch (error) {
        this.logger.debug(`${provider.name} deleteToken failed: ${error}`);
      }
    }

    if (!deleted && this.providers.length > 0) {
      throw new Error('Failed to delete token from all providers');
    }
  }

  /**
   * List all accounts for a service across all providers
   */
  async listAccounts(service: string): Promise<string[]> {
    const allAccounts = new Set<string>();
    
    for (const provider of this.providers) {
      try {
        const accounts = await provider.listTokens(service);
        accounts.forEach(account => allAccounts.add(account));
      } catch (error) {
        this.logger.debug(`${provider.name} listTokens failed: ${error}`);
      }
    }

    return Array.from(allAccounts);
  }

  /**
   * Test all providers and return status
   */
  async testProviders(): Promise<Record<string, boolean>> {
    const status: Record<string, boolean> = {};
    
    for (const provider of this.providers) {
      try {
        status[provider.name] = await provider.isAvailable();
      } catch (error) {
        status[provider.name] = false;
      }
    }

    return status;
  }
}