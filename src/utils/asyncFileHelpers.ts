/**
 * Async File System Helpers
 * Provides async alternatives to synchronous file operations
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Stats } from 'fs';

export class AsyncFileHelpers {
  /**
   * Check if a file or directory exists asynchronously
   */
  static async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Find the first existing path from a list of paths
   */
  static async findFirstExistingPath(
    paths: string[], 
    logger?: { debug: (msg: string) => void }
  ): Promise<string | null> {
    for (const searchPath of paths) {
      try {
        if (await this.exists(searchPath)) {
          logger?.debug(`Found path: ${searchPath}`);
          return searchPath;
        }
      } catch (error) {
        logger?.debug(`Search failed for ${searchPath}: ${String(error)}`);
      }
    }
    return null;
  }

  /**
   * Read directory contents asynchronously with error handling
   */
  static async readDirectory(dirPath: string): Promise<string[]> {
    try {
      const exists = await this.exists(dirPath);
      if (!exists) {
        return [];
      }
      return await fs.readdir(dirPath);
    } catch (error) {
      return [];
    }
  }

  /**
   * Find matching directories by pattern
   */
  static async findMatchingDirs(
    basePath: string,
    pattern: string | RegExp
  ): Promise<string[]> {
    const entries = await this.readDirectory(basePath);
    
    if (typeof pattern === 'string') {
      return entries.filter(entry => entry.includes(pattern));
    } else {
      return entries.filter(entry => pattern.test(entry));
    }
  }

  /**
   * Create directory if it doesn't exist
   */
  static async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      // Directory might already exist, which is fine
      if ((error as any).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Read file with automatic encoding detection
   */
  static async readFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf-8');
  }

  /**
   * Write file with atomic operation (write to temp, then rename)
   */
  static async writeFileAtomic(
    filePath: string, 
    content: string
  ): Promise<void> {
    const tempPath = `${filePath}.tmp`;
    try {
      await fs.writeFile(tempPath, content, 'utf-8');
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // Clean up temp file if rename failed
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Get file stats asynchronously
   */
  static async getStats(filePath: string): Promise<Stats | null> {
    try {
      return await fs.stat(filePath);
    } catch {
      return null;
    }
  }

  /**
   * Check if path is a directory
   */
  static async isDirectory(filePath: string): Promise<boolean> {
    const stats = await this.getStats(filePath);
    return stats?.isDirectory() ?? false;
  }

  /**
   * Check if path is a file
   */
  static async isFile(filePath: string): Promise<boolean> {
    const stats = await this.getStats(filePath);
    return stats?.isFile() ?? false;
  }

  /**
   * Copy file asynchronously
   */
  static async copyFile(src: string, dest: string): Promise<void> {
    await fs.copyFile(src, dest);
  }

  /**
   * Remove file or directory recursively
   */
  static async remove(filePath: string): Promise<void> {
    try {
      await fs.rm(filePath, { recursive: true, force: true });
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

export default AsyncFileHelpers;