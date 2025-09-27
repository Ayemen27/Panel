import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { existsSync, statSync, constants as fsConstants } from 'fs';
import { IStorage } from '../storage';
import {
  type File,
  type InsertFile,
  type FileBackup,
  type InsertFileBackup,
  type FileAuditLog,
  type InsertFileAuditLog,
  type FilePermission,
  type InsertFilePermission,
  type FileLock,
} from '@shared/schema';
import { logger } from '../utils/logger';

/**
 * Security Configuration and Constants
 */
const ALLOWED_PATHS = [
  '/home/runner',
  '/home/runner/workspace',
  process.cwd(),
  '/tmp/uploads',
  '/var/tmp'
];

// Maximum file size: 100MB
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// File type whitelist for uploads
const ALLOWED_EXTENSIONS = [
  '.txt', '.md', '.json', '.xml', '.yml', '.yaml', '.conf', '.cfg', '.ini',
  '.js', '.ts', '.jsx', '.tsx', '.html', '.css', '.scss', '.sass',
  '.php', '.py', '.rb', '.go', '.java', '.c', '.cpp', '.h', '.hpp',
  '.sql', '.sh', '.bat', '.ps1',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.tar', '.gz', '.rar', '.7z'
];

export interface FileManagerConfig {
  allowedPaths: string[];
  maxFileSize: number;
  allowedExtensions: string[];
  enableBackup: boolean;
  enableAudit: boolean;
}

export interface FileOperationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export interface FileInfo {
  id?: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  size: number;
  mimeType?: string;
  permissions?: string;
  owner?: string;
  created: Date;
  modified: Date;
  checksum?: string;
  metadata?: Record<string, any>;
}

export interface SearchOptions {
  type?: 'file' | 'folder';
  tags?: string[];
  extensions?: string[];
  sizeMin?: number;
  sizeMax?: number;
  dateFrom?: Date;
  dateTo?: Date;
  content?: boolean; // Search in file content
}

/**
 * Advanced File Manager Service with Security Mechanisms
 */
export class FileManagerService {
  private config: FileManagerConfig;
  private storage: IStorage;

  constructor(storage: IStorage, config?: Partial<FileManagerConfig>) {
    this.storage = storage;
    this.config = {
      allowedPaths: ALLOWED_PATHS,
      maxFileSize: MAX_FILE_SIZE,
      allowedExtensions: ALLOWED_EXTENSIONS,
      enableBackup: true,
      enableAudit: true,
      ...config
    };
  }

  /**
   * ===================
   * SECURITY MECHANISMS
   * ===================
   */

  /**
   * Validate and normalize file path for security
   */
  private async validatePath(inputPath: string): Promise<{ isValid: boolean; normalizedPath: string; error?: string }> {
    try {
      // First normalize and resolve the path
      const normalizedPath = path.resolve(path.normalize(inputPath));
      
      // Check for directory traversal attempts
      if (inputPath.includes('..') || inputPath.includes('./') || inputPath.includes('.\\')) {
        logger.warn(`Directory traversal attempt detected: ${inputPath}`);
        return { 
          isValid: false, 
          normalizedPath, 
          error: 'Directory traversal detected - path contains illegal sequences' 
        };
      }

      // Check against whitelist
      const isAllowed = this.config.allowedPaths.some(allowedPath => {
        // Support wildcard patterns like /home/administrator/app*
        if (allowedPath.endsWith('*')) {
          const basePath = allowedPath.slice(0, -1);
          return normalizedPath.startsWith(path.resolve(basePath));
        }
        return normalizedPath.startsWith(path.resolve(allowedPath));
      });

      if (!isAllowed) {
        logger.warn(`Access denied to path outside whitelist: ${normalizedPath}`);
        return { 
          isValid: false, 
          normalizedPath, 
          error: 'Access denied - path not in whitelist' 
        };
      }

      // Additional security checks
      if (normalizedPath.length > 4096) {
        return { 
          isValid: false, 
          normalizedPath, 
          error: 'Path too long' 
        };
      }

      // Check for null bytes
      if (normalizedPath.includes('\0')) {
        return { 
          isValid: false, 
          normalizedPath, 
          error: 'Invalid path - contains null bytes' 
        };
      }

      return { isValid: true, normalizedPath };
    } catch (error) {
      logger.error(`Path validation error: ${error}`);
      return { 
        isValid: false, 
        normalizedPath: inputPath, 
        error: 'Path validation failed' 
      };
    }
  }

  /**
   * Check Unix file permissions (rwx)
   */
  private async checkPermissions(filePath: string, requiredPermission: 'read' | 'write' | 'execute'): Promise<boolean> {
    try {
      let mode: number;
      
      switch (requiredPermission) {
        case 'read':
          mode = fsConstants.R_OK;
          break;
        case 'write':
          mode = fsConstants.W_OK;
          break;
        case 'execute':
          mode = fsConstants.X_OK;
          break;
        default:
          return false;
      }

      await fs.access(filePath, mode);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Set Unix file permissions
   */
  private async setPermissions(filePath: string, mode: string | number): Promise<boolean> {
    try {
      await fs.chmod(filePath, mode);
      return true;
    } catch (error) {
      logger.error(`Failed to set permissions on ${filePath}: ${error}`);
      return false;
    }
  }

  /**
   * Check file ownership
   */
  private async checkOwnership(filePath: string, expectedUserId?: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      
      // If no expected user ID provided, just check if file exists and is accessible
      if (!expectedUserId) {
        return true;
      }

      // In a real implementation, you'd check against system user ID
      // For now, we'll use a simplified check
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate user access to file through database permissions
   */
  private async validateUserAccess(
    fileId: string | undefined, 
    userId: string, 
    requiredPermission: 'read' | 'write' | 'delete'
  ): Promise<boolean> {
    try {
      if (!fileId) {
        return false;
      }
      
      return await this.storage.checkFilePermission(fileId, userId, requiredPermission);
    } catch (error) {
      logger.error(`User access validation error: ${error}`);
      return false;
    }
  }

  /**
   * Generate file checksum for integrity verification
   */
  private async generateChecksum(content: Buffer | string): Promise<string> {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Validate file extension
   */
  private validateFileExtension(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return this.config.allowedExtensions.includes(ext);
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(
    action: string,
    userId: string,
    fileId?: string,
    details?: string,
    oldValue?: any,
    newValue?: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    if (!this.config.enableAudit) return;

    try {
      await this.storage.createAuditLog({
        fileId: fileId || null,
        action: action as any,
        userId,
        details: details || null,
        oldValue: oldValue || null,
        newValue: newValue || null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      });
    } catch (error) {
      logger.error(`Failed to create audit log: ${error}`);
    }
  }

  /**
   * ===========================
   * FILESYSTEM OPERATIONS
   * ===========================
   */

  /**
   * Read file with security checks
   */
  async readFile(filePath: string, userId: string, options?: {
    encoding?: BufferEncoding;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<FileOperationResult> {
    try {
      // Validate path
      const pathValidation = await this.validatePath(filePath);
      if (!pathValidation.isValid) {
        return {
          success: false,
          message: 'Path validation failed',
          error: pathValidation.error
        };
      }

      const normalizedPath = pathValidation.normalizedPath;

      // Check if file exists
      if (!existsSync(normalizedPath)) {
        return {
          success: false,
          message: 'File not found',
          error: 'File does not exist'
        };
      }

      // Check Unix permissions
      const hasReadPermission = await this.checkPermissions(normalizedPath, 'read');
      if (!hasReadPermission) {
        return {
          success: false,
          message: 'Permission denied',
          error: 'No read permission'
        };
      }

      // Get file from database if exists
      const dbFile = await this.storage.getFileByPath(normalizedPath, userId);
      
      // Check database permissions if file is tracked
      if (dbFile) {
        const hasAccess = await this.validateUserAccess(dbFile.id, userId, 'read');
        if (!hasAccess) {
          await this.createAuditLog('access', userId, dbFile.id, 'Access denied - insufficient permissions', null, null, options?.ipAddress, options?.userAgent);
          return {
            success: false,
            message: 'Access denied',
            error: 'Insufficient permissions'
          };
        }
      }

      // Read file content
      const content = await fs.readFile(normalizedPath, options?.encoding || 'utf8');
      
      // Create audit log
      await this.createAuditLog('access', userId, dbFile?.id, 'File read successfully', null, null, options?.ipAddress, options?.userAgent);

      return {
        success: true,
        message: 'File read successfully',
        data: {
          content,
          path: normalizedPath,
          size: content.length,
          file: dbFile
        }
      };
    } catch (error) {
      logger.error(`Read file error: ${error}`);
      return {
        success: false,
        message: 'Failed to read file',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Write file with automatic backup
   */
  async writeFile(
    filePath: string, 
    content: string | Buffer, 
    userId: string,
    options?: {
      createBackup?: boolean;
      metadata?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<FileOperationResult> {
    try {
      // Validate path
      const pathValidation = await this.validatePath(filePath);
      if (!pathValidation.isValid) {
        return {
          success: false,
          message: 'Path validation failed',
          error: pathValidation.error
        };
      }

      const normalizedPath = pathValidation.normalizedPath;
      const filename = path.basename(normalizedPath);

      // Validate file extension
      if (!this.validateFileExtension(filename)) {
        return {
          success: false,
          message: 'File type not allowed',
          error: 'File extension not in whitelist'
        };
      }

      // Check file size
      const contentBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
      if (contentBuffer.length > this.config.maxFileSize) {
        return {
          success: false,
          message: 'File too large',
          error: `File size exceeds ${this.config.maxFileSize} bytes`
        };
      }

      // Check if file exists
      const fileExists = existsSync(normalizedPath);
      let dbFile: File | undefined;
      
      if (fileExists) {
        // Check write permissions
        const hasWritePermission = await this.checkPermissions(normalizedPath, 'write');
        if (!hasWritePermission) {
          return {
            success: false,
            message: 'Permission denied',
            error: 'No write permission'
          };
        }

        // Get existing file from database
        dbFile = await this.storage.getFileByPath(normalizedPath, userId);
        
        if (dbFile) {
          // Check database permissions
          const hasAccess = await this.validateUserAccess(dbFile.id, userId, 'write');
          if (!hasAccess) {
            await this.createAuditLog('update', userId, dbFile.id, 'Write access denied', null, null, options?.ipAddress, options?.userAgent);
            return {
              success: false,
              message: 'Access denied',
              error: 'Insufficient permissions'
            };
          }

          // Create backup if enabled and requested
          if (this.config.enableBackup && (options?.createBackup !== false)) {
            const oldContent = await fs.readFile(normalizedPath, 'utf8');
            await this.storage.createBackup(dbFile.id, oldContent, userId);
          }
        }
      } else {
        // Ensure directory exists
        const dirname = path.dirname(normalizedPath);
        await fs.mkdir(dirname, { recursive: true });
      }

      // Generate checksum
      const checksum = await this.generateChecksum(contentBuffer);

      // Write file
      await fs.writeFile(normalizedPath, contentBuffer);

      // Update or create database record
      if (dbFile) {
        // Update existing file
        dbFile = await this.storage.updateFile(dbFile.id, {
          size: contentBuffer.length,
          content: contentBuffer.length < 1024 ? content.toString() : null, // Store small files in DB
          checksum,
          metadata: { ...(dbFile.metadata || {}), ...options?.metadata },
          updatedAt: new Date()
        }, userId);
        
        await this.createAuditLog('update', userId, dbFile.id, 'File updated', null, { size: contentBuffer.length, checksum }, options?.ipAddress, options?.userAgent);
      } else {
        // Create new file record
        dbFile = await this.storage.createFile({
          name: filename,
          type: 'file',
          path: normalizedPath,
          filePath: normalizedPath,
          size: contentBuffer.length,
          mimeType: this.getMimeType(filename),
          content: contentBuffer.length < 1024 ? content.toString() : null,
          checksum,
          ownerId: userId,
          metadata: options?.metadata || {}
        });
        
        await this.createAuditLog('create', userId, dbFile.id, 'File created', null, { size: contentBuffer.length, checksum }, options?.ipAddress, options?.userAgent);
      }

      return {
        success: true,
        message: 'File written successfully',
        data: dbFile
      };
    } catch (error) {
      logger.error(`Write file error: ${error}`);
      return {
        success: false,
        message: 'Failed to write file',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create directory with permission setup
   */
  async createDirectory(
    dirPath: string, 
    userId: string,
    options?: {
      recursive?: boolean;
      mode?: string | number;
      metadata?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<FileOperationResult> {
    try {
      // Validate path
      const pathValidation = await this.validatePath(dirPath);
      if (!pathValidation.isValid) {
        return {
          success: false,
          message: 'Path validation failed',
          error: pathValidation.error
        };
      }

      const normalizedPath = pathValidation.normalizedPath;

      // Check if directory already exists
      if (existsSync(normalizedPath)) {
        return {
          success: false,
          message: 'Directory already exists',
          error: 'Directory exists'
        };
      }

      // Create directory
      await fs.mkdir(normalizedPath, { 
        recursive: options?.recursive !== false,
        mode: options?.mode || 0o755 
      });

      // Create database record
      const dbFolder = await this.storage.createFile({
        name: path.basename(normalizedPath),
        type: 'folder',
        path: normalizedPath,
        filePath: normalizedPath,
        size: 0,
        ownerId: userId,
        metadata: options?.metadata || {}
      });

      await this.createAuditLog('create', userId, dbFolder.id, 'Directory created', null, { path: normalizedPath }, options?.ipAddress, options?.userAgent);

      return {
        success: true,
        message: 'Directory created successfully',
        data: dbFolder
      };
    } catch (error) {
      logger.error(`Create directory error: ${error}`);
      return {
        success: false,
        message: 'Failed to create directory',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete file safely (move to trash first)
   */
  async deleteFile(
    filePath: string, 
    userId: string,
    options?: {
      permanent?: boolean;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<FileOperationResult> {
    try {
      // Validate path
      const pathValidation = await this.validatePath(filePath);
      if (!pathValidation.isValid) {
        return {
          success: false,
          message: 'Path validation failed',
          error: pathValidation.error
        };
      }

      const normalizedPath = pathValidation.normalizedPath;

      // Check if file exists
      if (!existsSync(normalizedPath)) {
        return {
          success: false,
          message: 'File not found',
          error: 'File does not exist'
        };
      }

      // Get file from database
      const dbFile = await this.storage.getFileByPath(normalizedPath, userId);
      
      if (dbFile) {
        // Check permissions
        const hasAccess = await this.validateUserAccess(dbFile.id, userId, 'delete');
        if (!hasAccess) {
          await this.createAuditLog('delete', userId, dbFile.id, 'Delete access denied', null, null, options?.ipAddress, options?.userAgent);
          return {
            success: false,
            message: 'Access denied',
            error: 'Insufficient permissions'
          };
        }

        if (options?.permanent) {
          // Permanent deletion
          await fs.rm(normalizedPath, { recursive: true, force: true });
          await this.storage.deleteFile(dbFile.id, userId);
          
          await this.createAuditLog('delete', userId, dbFile.id, 'File permanently deleted', { path: normalizedPath }, null, options?.ipAddress, options?.userAgent);
        } else {
          // Move to trash
          await this.storage.moveToTrash(dbFile.id, userId);
          
          await this.createAuditLog('delete', userId, dbFile.id, 'File moved to trash', { path: normalizedPath }, null, options?.ipAddress, options?.userAgent);
        }
      } else {
        // File not in database, delete directly if permanent
        if (options?.permanent) {
          await fs.rm(normalizedPath, { recursive: true, force: true });
        }
      }

      return {
        success: true,
        message: options?.permanent ? 'File permanently deleted' : 'File moved to trash',
        data: { path: normalizedPath, permanent: options?.permanent || false }
      };
    } catch (error) {
      logger.error(`Delete file error: ${error}`);
      return {
        success: false,
        message: 'Failed to delete file',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Move file with destination validation
   */
  async moveFile(
    sourcePath: string, 
    destinationPath: string, 
    userId: string,
    options?: {
      overwrite?: boolean;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<FileOperationResult> {
    try {
      // Validate both paths
      const sourceValidation = await this.validatePath(sourcePath);
      const destValidation = await this.validatePath(destinationPath);

      if (!sourceValidation.isValid) {
        return {
          success: false,
          message: 'Source path validation failed',
          error: sourceValidation.error
        };
      }

      if (!destValidation.isValid) {
        return {
          success: false,
          message: 'Destination path validation failed',
          error: destValidation.error
        };
      }

      const normalizedSource = sourceValidation.normalizedPath;
      const normalizedDest = destValidation.normalizedPath;

      // Check if source exists
      if (!existsSync(normalizedSource)) {
        return {
          success: false,
          message: 'Source file not found',
          error: 'Source file does not exist'
        };
      }

      // Check if destination exists and overwrite is not allowed
      if (existsSync(normalizedDest) && !options?.overwrite) {
        return {
          success: false,
          message: 'Destination exists',
          error: 'Destination file already exists'
        };
      }

      // Get source file from database
      const sourceDbFile = await this.storage.getFileByPath(normalizedSource, userId);
      
      if (sourceDbFile) {
        // Check permissions
        const hasAccess = await this.validateUserAccess(sourceDbFile.id, userId, 'write');
        if (!hasAccess) {
          return {
            success: false,
            message: 'Access denied',
            error: 'Insufficient permissions'
          };
        }
      }

      // Ensure destination directory exists
      await fs.mkdir(path.dirname(normalizedDest), { recursive: true });

      // Move file
      await fs.rename(normalizedSource, normalizedDest);

      // Update database record
      if (sourceDbFile) {
        await this.storage.updateFile(sourceDbFile.id, {
          path: normalizedDest,
          filePath: normalizedDest,
          name: path.basename(normalizedDest),
          updatedAt: new Date()
        }, userId);

        await this.createAuditLog(
          'move', 
          userId, 
          sourceDbFile.id, 
          'File moved', 
          { path: normalizedSource }, 
          { path: normalizedDest },
          options?.ipAddress, 
          options?.userAgent
        );
      }

      return {
        success: true,
        message: 'File moved successfully',
        data: {
          source: normalizedSource,
          destination: normalizedDest,
          file: sourceDbFile
        }
      };
    } catch (error) {
      logger.error(`Move file error: ${error}`);
      return {
        success: false,
        message: 'Failed to move file',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Copy file with metadata preservation
   */
  async copyFile(
    sourcePath: string, 
    destinationPath: string, 
    userId: string,
    options?: {
      overwrite?: boolean;
      preserveMetadata?: boolean;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<FileOperationResult> {
    try {
      // Validate both paths
      const sourceValidation = await this.validatePath(sourcePath);
      const destValidation = await this.validatePath(destinationPath);

      if (!sourceValidation.isValid) {
        return {
          success: false,
          message: 'Source path validation failed',
          error: sourceValidation.error
        };
      }

      if (!destValidation.isValid) {
        return {
          success: false,
          message: 'Destination path validation failed',
          error: destValidation.error
        };
      }

      const normalizedSource = sourceValidation.normalizedPath;
      const normalizedDest = destValidation.normalizedPath;

      // Check if source exists
      if (!existsSync(normalizedSource)) {
        return {
          success: false,
          message: 'Source file not found',
          error: 'Source file does not exist'
        };
      }

      // Check if destination exists and overwrite is not allowed
      if (existsSync(normalizedDest) && !options?.overwrite) {
        return {
          success: false,
          message: 'Destination exists',
          error: 'Destination file already exists'
        };
      }

      // Get source file from database
      const sourceDbFile = await this.storage.getFileByPath(normalizedSource, userId);
      
      if (sourceDbFile) {
        // Check permissions
        const hasAccess = await this.validateUserAccess(sourceDbFile.id, userId, 'read');
        if (!hasAccess) {
          return {
            success: false,
            message: 'Access denied',
            error: 'Insufficient permissions to read source file'
          };
        }
      }

      // Ensure destination directory exists
      await fs.mkdir(path.dirname(normalizedDest), { recursive: true });

      // Copy file
      await fs.copyFile(normalizedSource, normalizedDest);

      // Get file stats for metadata
      const stats = await fs.stat(normalizedDest);
      let content: string | null = null;
      let checksum: string | null = null;

      // For small files, store content and calculate checksum
      if (stats.size < 1024) {
        content = await fs.readFile(normalizedDest, 'utf8');
        checksum = await this.generateChecksum(content);
      }

      // Create database record for destination
      const destDbFile = await this.storage.createFile({
        name: path.basename(normalizedDest),
        type: stats.isDirectory() ? 'folder' : 'file',
        path: normalizedDest,
        filePath: normalizedDest,
        size: stats.size,
        mimeType: this.getMimeType(path.basename(normalizedDest)),
        content,
        checksum,
        ownerId: userId,
        metadata: options?.preserveMetadata && sourceDbFile ? sourceDbFile.metadata : {}
      });

      await this.createAuditLog(
        'copy', 
        userId, 
        destDbFile.id, 
        'File copied', 
        { source: normalizedSource }, 
        { destination: normalizedDest },
        options?.ipAddress, 
        options?.userAgent
      );

      return {
        success: true,
        message: 'File copied successfully',
        data: {
          source: normalizedSource,
          destination: normalizedDest,
          sourceFile: sourceDbFile,
          destinationFile: destDbFile
        }
      };
    } catch (error) {
      logger.error(`Copy file error: ${error}`);
      return {
        success: false,
        message: 'Failed to copy file',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get detailed file information
   */
  async getFileInfo(filePath: string, userId: string): Promise<FileOperationResult> {
    try {
      const pathValidation = await this.validatePath(filePath);
      if (!pathValidation.isValid) {
        return {
          success: false,
          message: 'Path validation failed',
          error: pathValidation.error
        };
      }

      const normalizedPath = pathValidation.normalizedPath;

      if (!existsSync(normalizedPath)) {
        return {
          success: false,
          message: 'File not found',
          error: 'File does not exist'
        };
      }

      const stats = await fs.stat(normalizedPath);
      const dbFile = await this.storage.getFileByPath(normalizedPath, userId);

      const fileInfo: FileInfo = {
        id: dbFile?.id,
        name: path.basename(normalizedPath),
        type: stats.isDirectory() ? 'folder' : 'file',
        path: normalizedPath,
        size: stats.size,
        mimeType: stats.isFile() ? this.getMimeType(path.basename(normalizedPath)) : undefined,
        permissions: stats.mode.toString(8),
        created: stats.birthtime,
        modified: stats.mtime,
        checksum: dbFile?.checksum || undefined,
        metadata: dbFile?.metadata || {}
      };

      return {
        success: true,
        message: 'File information retrieved',
        data: fileInfo
      };
    } catch (error) {
      logger.error(`Get file info error: ${error}`);
      return {
        success: false,
        message: 'Failed to get file information',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get directory listing
   */
  async getDirectoryListing(
    dirPath: string, 
    userId: string,
    options?: {
      recursive?: boolean;
      includeHidden?: boolean;
    }
  ): Promise<FileOperationResult> {
    try {
      const pathValidation = await this.validatePath(dirPath);
      if (!pathValidation.isValid) {
        return {
          success: false,
          message: 'Path validation failed',
          error: pathValidation.error
        };
      }

      const normalizedPath = pathValidation.normalizedPath;

      if (!existsSync(normalizedPath)) {
        return {
          success: false,
          message: 'Directory not found',
          error: 'Directory does not exist'
        };
      }

      const stats = await fs.stat(normalizedPath);
      if (!stats.isDirectory()) {
        return {
          success: false,
          message: 'Not a directory',
          error: 'Path is not a directory'
        };
      }

      // Get directory contents
      const entries = await fs.readdir(normalizedPath, { withFileTypes: true });
      const listing: FileInfo[] = [];

      for (const entry of entries) {
        // Skip hidden files unless requested
        if (!options?.includeHidden && entry.name.startsWith('.')) {
          continue;
        }

        const entryPath = path.join(normalizedPath, entry.name);
        const entryStats = await fs.stat(entryPath);
        const dbFile = await this.storage.getFileByPath(entryPath, userId);

        listing.push({
          id: dbFile?.id,
          name: entry.name,
          type: entry.isDirectory() ? 'folder' : 'file',
          path: entryPath,
          size: entryStats.size,
          mimeType: entry.isFile() ? this.getMimeType(entry.name) : undefined,
          permissions: entryStats.mode.toString(8),
          created: entryStats.birthtime,
          modified: entryStats.mtime,
          checksum: dbFile?.checksum || undefined,
          metadata: dbFile?.metadata || {}
        });
      }

      return {
        success: true,
        message: 'Directory listing retrieved',
        data: {
          path: normalizedPath,
          entries: listing,
          total: listing.length
        }
      };
    } catch (error) {
      logger.error(`Get directory listing error: ${error}`);
      return {
        success: false,
        message: 'Failed to get directory listing',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * =========================
   * BACKUP AND VERSIONING
   * =========================
   */

  /**
   * Create backup before modification
   */
  async createBackup(
    fileId: string, 
    userId: string,
    comment?: string
  ): Promise<FileOperationResult> {
    try {
      const file = await this.storage.getFile(fileId, userId);
      if (!file) {
        return {
          success: false,
          message: 'File not found',
          error: 'File does not exist in database'
        };
      }

      // Check permissions
      const hasAccess = await this.validateUserAccess(fileId, userId, 'read');
      if (!hasAccess) {
        return {
          success: false,
          message: 'Access denied',
          error: 'Insufficient permissions'
        };
      }

      // Read current file content
      let content = '';
      if (file.content) {
        content = file.content;
      } else if (file.filePath) {
        try {
          content = await fs.readFile(file.filePath, 'utf8');
        } catch (error) {
          logger.warn(`Could not read file content for backup: ${error}`);
        }
      }

      // Create backup
      const backup = await this.storage.createBackup(fileId, content, userId);

      await this.createAuditLog('create', userId, fileId, `Backup created: ${comment || 'Manual backup'}`);

      return {
        success: true,
        message: 'Backup created successfully',
        data: backup
      };
    } catch (error) {
      logger.error(`Create backup error: ${error}`);
      return {
        success: false,
        message: 'Failed to create backup',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get file versions (backups)
   */
  async getFileVersions(fileId: string, userId: string): Promise<FileOperationResult> {
    try {
      const file = await this.storage.getFile(fileId, userId);
      if (!file) {
        return {
          success: false,
          message: 'File not found',
          error: 'File does not exist'
        };
      }

      // Check permissions
      const hasAccess = await this.validateUserAccess(fileId, userId, 'read');
      if (!hasAccess) {
        return {
          success: false,
          message: 'Access denied',
          error: 'Insufficient permissions'
        };
      }

      const versions = await this.storage.getFileBackups(fileId, userId);

      return {
        success: true,
        message: 'File versions retrieved',
        data: {
          file,
          versions,
          total: versions.length
        }
      };
    } catch (error) {
      logger.error(`Get file versions error: ${error}`);
      return {
        success: false,
        message: 'Failed to get file versions',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Restore specific version
   */
  async restoreVersion(
    backupId: string, 
    userId: string,
    options?: {
      createBackupBeforeRestore?: boolean;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<FileOperationResult> {
    try {
      // Create backup of current version before restoring if requested
      if (options?.createBackupBeforeRestore) {
        // This would require getting the backup first to know the file ID
        // Implementation depends on specific requirements
      }

      const restoredFile = await this.storage.restoreBackup(backupId, userId);

      await this.createAuditLog(
        'restore', 
        userId, 
        restoredFile.id, 
        'Version restored', 
        null, 
        { backupId },
        options?.ipAddress, 
        options?.userAgent
      );

      return {
        success: true,
        message: 'Version restored successfully',
        data: restoredFile
      };
    } catch (error) {
      logger.error(`Restore version error: ${error}`);
      return {
        success: false,
        message: 'Failed to restore version',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * ===========================
   * SEARCH AND QUERY OPERATIONS
   * ===========================
   */

  /**
   * Search files by name, type, and content
   */
  async searchFiles(
    userId: string, 
    query: string, 
    options?: SearchOptions
  ): Promise<FileOperationResult> {
    try {
      // Use storage interface for basic search
      const files = await this.storage.searchFiles(userId, query, {
        type: options?.type,
        tags: options?.tags
      });

      let filteredFiles = files;

      // Apply additional filters
      if (options?.extensions) {
        filteredFiles = filteredFiles.filter(file => {
          if (file.type === 'folder') return true;
          const ext = path.extname(file.name).toLowerCase();
          return options.extensions!.includes(ext);
        });
      }

      if (options?.sizeMin !== undefined) {
        filteredFiles = filteredFiles.filter(file => (file.size || 0) >= options.sizeMin!);
      }

      if (options?.sizeMax !== undefined) {
        filteredFiles = filteredFiles.filter(file => (file.size || 0) <= options.sizeMax!);
      }

      if (options?.dateFrom) {
        filteredFiles = filteredFiles.filter(file => file.createdAt && file.createdAt >= options.dateFrom!);
      }

      if (options?.dateTo) {
        filteredFiles = filteredFiles.filter(file => file.createdAt && file.createdAt <= options.dateTo!);
      }

      // Content search for small files (if enabled and files have content stored)
      if (options?.content && query.trim()) {
        const contentMatches = filteredFiles.filter(file => 
          file.content && file.content.toLowerCase().includes(query.toLowerCase())
        );
        
        // For larger files, we'd need to read from disk (not implemented for security)
        filteredFiles = contentMatches;
      }

      return {
        success: true,
        message: 'Search completed',
        data: {
          query,
          options,
          results: filteredFiles,
          total: filteredFiles.length
        }
      };
    } catch (error) {
      logger.error(`Search files error: ${error}`);
      return {
        success: false,
        message: 'Search failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * ===========================
   * UTILITY METHODS
   * ===========================
   */

  /**
   * Get MIME type based on file extension
   */
  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.ts': 'text/typescript',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.zip': 'application/zip',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Get configuration
   */
  getConfig(): FileManagerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<FileManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export default FileManagerService;