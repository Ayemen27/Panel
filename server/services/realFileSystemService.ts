import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { existsSync, statSync, constants as fsConstants } from 'fs';
import { IStorage } from '../storage';
import { logger } from '../utils/logger';

/**
 * Real File System Service
 * Provides secure file system operations with database-backed path validation
 */

export interface RealFileInfo {
  name: string;
  type: 'file' | 'directory';
  path: string;
  absolutePath: string;
  size: number;
  permissions: string;
  owner?: string;
  created: Date;
  modified: Date;
  isHidden: boolean;
  extension?: string;
  mimeType?: string;
}

export interface RealFileOperationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export interface DirectoryListing {
  path: string;
  items: RealFileInfo[];
  totalFiles: number;
  totalDirectories: number;
  totalSize: number;
}

export interface CreateFileOptions {
  content?: string;
  mode?: string | number;
  overwrite?: boolean;
}

export interface CreateDirectoryOptions {
  recursive?: boolean;
  mode?: string | number;
}

export class RealFileSystemService {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * ===========================
   * PATH VALIDATION & SECURITY
   * ===========================
   */

  /**
   * Validate and normalize file path for security
   */
  private async validatePath(inputPath: string): Promise<{ 
    isValid: boolean; 
    normalizedPath: string; 
    error?: string 
  }> {
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

      // Check for null bytes
      if (normalizedPath.includes('\0')) {
        return { 
          isValid: false, 
          normalizedPath, 
          error: 'Invalid path - contains null bytes' 
        };
      }

      // Path length check
      if (normalizedPath.length > 4096) {
        return { 
          isValid: false, 
          normalizedPath, 
          error: 'Path too long' 
        };
      }

      // Check against database allowed paths
      const isAllowed = await this.storage.checkPathAllowed(normalizedPath);
      if (!isAllowed) {
        logger.warn(`Access denied to path not in database whitelist: ${normalizedPath}`);
        return { 
          isValid: false, 
          normalizedPath, 
          error: 'Access denied - path not in allowed paths database' 
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
   * Check Unix file permissions
   */
  private async checkPermissions(
    filePath: string, 
    requiredPermission: 'read' | 'write' | 'execute'
  ): Promise<boolean> {
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
   * Get file permissions as string (rwxrwxrwx format)
   */
  private formatPermissions(mode: number): string {
    const permissions = [];
    
    // Owner permissions
    permissions.push(mode & 0o400 ? 'r' : '-');
    permissions.push(mode & 0o200 ? 'w' : '-');
    permissions.push(mode & 0o100 ? 'x' : '-');
    
    // Group permissions
    permissions.push(mode & 0o040 ? 'r' : '-');
    permissions.push(mode & 0o020 ? 'w' : '-');
    permissions.push(mode & 0o010 ? 'x' : '-');
    
    // Other permissions
    permissions.push(mode & 0o004 ? 'r' : '-');
    permissions.push(mode & 0o002 ? 'w' : '-');
    permissions.push(mode & 0o001 ? 'x' : '-');
    
    return permissions.join('');
  }

  /**
   * Get MIME type based on file extension
   */
  private getMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.html': 'text/html',
      '.css': 'text/css',
      '.xml': 'application/xml',
      '.yaml': 'application/x-yaml',
      '.yml': 'application/x-yaml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(
    action: string,
    userId: string,
    filePath: string,
    details?: string,
    oldValue?: any,
    newValue?: any
  ): Promise<void> {
    try {
      await this.storage.createAuditLog({
        fileId: null, // Real filesystem doesn't have database file ID
        action: action as any,
        userId,
        details: `Real filesystem operation: ${action} on ${filePath}. ${details || ''}`,
        oldValue: oldValue || null,
        newValue: newValue || null,
        ipAddress: null,
        userAgent: null,
      });
    } catch (error) {
      logger.error(`Failed to create audit log: ${error}`);
    }
  }

  /**
   * ===========================
   * CORE FILE SYSTEM OPERATIONS
   * ===========================
   */

  /**
   * List directory contents
   */
  async listDirectory(dirPath: string, userId: string): Promise<RealFileOperationResult> {
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

      // Check if directory exists
      if (!existsSync(normalizedPath)) {
        return {
          success: false,
          message: 'Directory not found',
          error: 'Directory does not exist'
        };
      }

      // Check if it's actually a directory
      const stats = await fs.stat(normalizedPath);
      if (!stats.isDirectory()) {
        return {
          success: false,
          message: 'Path is not a directory',
          error: 'Specified path is not a directory'
        };
      }

      // Check read permission
      const hasReadPermission = await this.checkPermissions(normalizedPath, 'read');
      if (!hasReadPermission) {
        return {
          success: false,
          message: 'Permission denied',
          error: 'No read permission for directory'
        };
      }

      // Read directory contents
      const entries = await fs.readdir(normalizedPath);
      const items: RealFileInfo[] = [];
      let totalFiles = 0;
      let totalDirectories = 0;
      let totalSize = 0;

      for (const entry of entries) {
        const itemPath = path.join(normalizedPath, entry);
        
        try {
          const itemStats = await fs.stat(itemPath);
          const isDirectory = itemStats.isDirectory();
          const isHidden = entry.startsWith('.');

          const fileInfo: RealFileInfo = {
            name: entry,
            type: isDirectory ? 'directory' : 'file',
            path: path.relative(process.cwd(), itemPath),
            absolutePath: itemPath,
            size: itemStats.size,
            permissions: this.formatPermissions(itemStats.mode),
            created: itemStats.birthtime,
            modified: itemStats.mtime,
            isHidden,
            extension: isDirectory ? undefined : path.extname(entry),
            mimeType: isDirectory ? undefined : this.getMimeType(entry)
          };

          items.push(fileInfo);

          if (isDirectory) {
            totalDirectories++;
          } else {
            totalFiles++;
            totalSize += itemStats.size;
          }
        } catch (itemError) {
          logger.warn(`Could not stat item ${itemPath}: ${itemError}`);
          // Skip items we can't stat (permission issues, etc.)
        }
      }

      const directoryListing: DirectoryListing = {
        path: normalizedPath,
        items: items.sort((a, b) => {
          // Directories first, then files, alphabetically
          if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        }),
        totalFiles,
        totalDirectories,
        totalSize
      };

      // Create audit log
      await this.createAuditLog('access', userId, normalizedPath, `Listed directory contents`);

      return {
        success: true,
        message: `Directory listed successfully`,
        data: directoryListing
      };

    } catch (error) {
      logger.error(`Error listing directory ${dirPath}: ${error}`);
      return {
        success: false,
        message: 'Failed to list directory',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get file or directory information
   */
  async getFileInfo(filePath: string, userId: string): Promise<RealFileOperationResult> {
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

      // Check if file/directory exists
      if (!existsSync(normalizedPath)) {
        return {
          success: false,
          message: 'File or directory not found',
          error: 'Path does not exist'
        };
      }

      const stats = await fs.stat(normalizedPath);
      const isDirectory = stats.isDirectory();
      const fileName = path.basename(normalizedPath);

      const fileInfo: RealFileInfo = {
        name: fileName,
        type: isDirectory ? 'directory' : 'file',
        path: path.relative(process.cwd(), normalizedPath),
        absolutePath: normalizedPath,
        size: stats.size,
        permissions: this.formatPermissions(stats.mode),
        created: stats.birthtime,
        modified: stats.mtime,
        isHidden: fileName.startsWith('.'),
        extension: isDirectory ? undefined : path.extname(fileName),
        mimeType: isDirectory ? undefined : this.getMimeType(fileName)
      };

      // Create audit log
      await this.createAuditLog('access', userId, normalizedPath, `Got file info`);

      return {
        success: true,
        message: `File info retrieved successfully`,
        data: fileInfo
      };

    } catch (error) {
      logger.error(`Error getting file info ${filePath}: ${error}`);
      return {
        success: false,
        message: 'Failed to get file info',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Read file content (text files only)
   */
  async readFileContent(
    filePath: string, 
    userId: string, 
    encoding: BufferEncoding = 'utf8'
  ): Promise<RealFileOperationResult> {
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

      // Check if it's a file (not directory)
      const stats = await fs.stat(normalizedPath);
      if (stats.isDirectory()) {
        return {
          success: false,
          message: 'Path is a directory',
          error: 'Cannot read directory as file'
        };
      }

      // Check read permission
      const hasReadPermission = await this.checkPermissions(normalizedPath, 'read');
      if (!hasReadPermission) {
        return {
          success: false,
          message: 'Permission denied',
          error: 'No read permission for file'
        };
      }

      // Check file size (limit to 10MB for text files)
      if (stats.size > 10 * 1024 * 1024) {
        return {
          success: false,
          message: 'File too large',
          error: 'File size exceeds 10MB limit for text reading'
        };
      }

      // Read file content
      const content = await fs.readFile(normalizedPath, encoding);

      // Create audit log
      await this.createAuditLog('access', userId, normalizedPath, `Read file content (${stats.size} bytes)`);

      return {
        success: true,
        message: `File content read successfully`,
        data: {
          content,
          size: stats.size,
          encoding,
          mimeType: this.getMimeType(path.basename(normalizedPath))
        }
      };

    } catch (error) {
      logger.error(`Error reading file ${filePath}: ${error}`);
      return {
        success: false,
        message: 'Failed to read file content',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create a new directory
   */
  async createDirectory(
    dirPath: string, 
    userId: string, 
    options: CreateDirectoryOptions = {}
  ): Promise<RealFileOperationResult> {
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
          error: 'A file or directory with this name already exists'
        };
      }

      // Check write permission on parent directory
      const parentDir = path.dirname(normalizedPath);
      const hasWritePermission = await this.checkPermissions(parentDir, 'write');
      if (!hasWritePermission) {
        return {
          success: false,
          message: 'Permission denied',
          error: 'No write permission in parent directory'
        };
      }

      // Create directory
      await fs.mkdir(normalizedPath, {
        recursive: options.recursive || false,
        mode: options.mode || 0o755
      });

      // Get created directory stats
      const stats = await fs.stat(normalizedPath);

      // Create audit log
      await this.createAuditLog(
        'create', 
        userId, 
        normalizedPath, 
        `Created directory`, 
        null,
        { recursive: options.recursive, mode: options.mode }
      );

      return {
        success: true,
        message: `Directory created successfully`,
        data: {
          path: normalizedPath,
          created: stats.birthtime,
          permissions: this.formatPermissions(stats.mode)
        }
      };

    } catch (error) {
      logger.error(`Error creating directory ${dirPath}: ${error}`);
      return {
        success: false,
        message: 'Failed to create directory',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create a new file
   */
  async createFile(
    filePath: string, 
    userId: string, 
    options: CreateFileOptions = {}
  ): Promise<RealFileOperationResult> {
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

      // Check if file already exists
      if (existsSync(normalizedPath) && !options.overwrite) {
        return {
          success: false,
          message: 'File already exists',
          error: 'A file with this name already exists. Use overwrite option to replace.'
        };
      }

      // Check write permission on parent directory
      const parentDir = path.dirname(normalizedPath);
      const hasWritePermission = await this.checkPermissions(parentDir, 'write');
      if (!hasWritePermission) {
        return {
          success: false,
          message: 'Permission denied',
          error: 'No write permission in parent directory'
        };
      }

      const content = options.content || '';

      // Create file
      await fs.writeFile(normalizedPath, content, {
        mode: options.mode || 0o644
      });

      // Get created file stats
      const stats = await fs.stat(normalizedPath);

      // Generate checksum
      const checksum = crypto.createHash('sha256').update(content).digest('hex');

      // Create audit log
      await this.createAuditLog(
        'create', 
        userId, 
        normalizedPath, 
        `Created file (${stats.size} bytes)`, 
        null,
        { size: stats.size, checksum, mode: options.mode }
      );

      return {
        success: true,
        message: `File created successfully`,
        data: {
          path: normalizedPath,
          size: stats.size,
          created: stats.birthtime,
          permissions: this.formatPermissions(stats.mode),
          checksum,
          mimeType: this.getMimeType(path.basename(normalizedPath))
        }
      };

    } catch (error) {
      logger.error(`Error creating file ${filePath}: ${error}`);
      return {
        success: false,
        message: 'Failed to create file',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete file or directory
   */
  async deleteItem(filePath: string, userId: string): Promise<RealFileOperationResult> {
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

      // Check if item exists
      if (!existsSync(normalizedPath)) {
        return {
          success: false,
          message: 'File or directory not found',
          error: 'Path does not exist'
        };
      }

      // Get item info before deletion
      const stats = await fs.stat(normalizedPath);
      const isDirectory = stats.isDirectory();
      const itemName = path.basename(normalizedPath);

      // Check write permission on parent directory
      const parentDir = path.dirname(normalizedPath);
      const hasWritePermission = await this.checkPermissions(parentDir, 'write');
      if (!hasWritePermission) {
        return {
          success: false,
          message: 'Permission denied',
          error: 'No write permission in parent directory'
        };
      }

      // Delete item
      if (isDirectory) {
        await fs.rmdir(normalizedPath, { recursive: true });
      } else {
        await fs.unlink(normalizedPath);
      }

      // Create audit log
      await this.createAuditLog(
        'delete', 
        userId, 
        normalizedPath, 
        `Deleted ${isDirectory ? 'directory' : 'file'}: ${itemName}`, 
        { name: itemName, type: isDirectory ? 'directory' : 'file', size: stats.size },
        null
      );

      return {
        success: true,
        message: `${isDirectory ? 'Directory' : 'File'} deleted successfully`,
        data: {
          path: normalizedPath,
          name: itemName,
          type: isDirectory ? 'directory' : 'file',
          size: stats.size
        }
      };

    } catch (error) {
      logger.error(`Error deleting item ${filePath}: ${error}`);
      return {
        success: false,
        message: 'Failed to delete item',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Rename file or directory
   */
  async renameItem(
    oldPath: string, 
    newPath: string, 
    userId: string
  ): Promise<RealFileOperationResult> {
    try {
      // Validate both paths
      const oldPathValidation = await this.validatePath(oldPath);
      const newPathValidation = await this.validatePath(newPath);

      if (!oldPathValidation.isValid) {
        return {
          success: false,
          message: 'Source path validation failed',
          error: oldPathValidation.error
        };
      }

      if (!newPathValidation.isValid) {
        return {
          success: false,
          message: 'Destination path validation failed',
          error: newPathValidation.error
        };
      }

      const normalizedOldPath = oldPathValidation.normalizedPath;
      const normalizedNewPath = newPathValidation.normalizedPath;

      // Check if source exists
      if (!existsSync(normalizedOldPath)) {
        return {
          success: false,
          message: 'Source file or directory not found',
          error: 'Source path does not exist'
        };
      }

      // Check if destination already exists
      if (existsSync(normalizedNewPath)) {
        return {
          success: false,
          message: 'Destination already exists',
          error: 'A file or directory with the new name already exists'
        };
      }

      // Get source info
      const stats = await fs.stat(normalizedOldPath);
      const isDirectory = stats.isDirectory();
      const oldName = path.basename(normalizedOldPath);
      const newName = path.basename(normalizedNewPath);

      // Check write permissions on both parent directories
      const oldParentDir = path.dirname(normalizedOldPath);
      const newParentDir = path.dirname(normalizedNewPath);

      const hasOldWritePermission = await this.checkPermissions(oldParentDir, 'write');
      const hasNewWritePermission = await this.checkPermissions(newParentDir, 'write');

      if (!hasOldWritePermission || !hasNewWritePermission) {
        return {
          success: false,
          message: 'Permission denied',
          error: 'No write permission in source or destination directory'
        };
      }

      // Rename item
      await fs.rename(normalizedOldPath, normalizedNewPath);

      // Create audit log
      await this.createAuditLog(
        'rename', 
        userId, 
        normalizedOldPath, 
        `Renamed ${isDirectory ? 'directory' : 'file'} from "${oldName}" to "${newName}"`, 
        { oldPath: normalizedOldPath, oldName },
        { newPath: normalizedNewPath, newName }
      );

      return {
        success: true,
        message: `${isDirectory ? 'Directory' : 'File'} renamed successfully`,
        data: {
          oldPath: normalizedOldPath,
          newPath: normalizedNewPath,
          oldName,
          newName,
          type: isDirectory ? 'directory' : 'file'
        }
      };

    } catch (error) {
      logger.error(`Error renaming item ${oldPath} to ${newPath}: ${error}`);
      return {
        success: false,
        message: 'Failed to rename item',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Copy file or directory
   */
  async copyItem(
    sourcePath: string, 
    destinationPath: string, 
    userId: string
  ): Promise<RealFileOperationResult> {
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

      const normalizedSourcePath = sourceValidation.normalizedPath;
      const normalizedDestPath = destValidation.normalizedPath;

      // Check if source exists
      if (!existsSync(normalizedSourcePath)) {
        return {
          success: false,
          message: 'Source file or directory not found',
          error: 'Source path does not exist'
        };
      }

      // Check if destination already exists
      if (existsSync(normalizedDestPath)) {
        return {
          success: false,
          message: 'Destination already exists',
          error: 'A file or directory with this name already exists at destination'
        };
      }

      // Get source info
      const sourceStats = await fs.stat(normalizedSourcePath);
      const isDirectory = sourceStats.isDirectory();
      const sourceName = path.basename(normalizedSourcePath);

      // Check read permission on source
      const hasReadPermission = await this.checkPermissions(normalizedSourcePath, 'read');
      if (!hasReadPermission) {
        return {
          success: false,
          message: 'Permission denied',
          error: 'No read permission on source'
        };
      }

      // Check write permission on destination parent directory
      const destParentDir = path.dirname(normalizedDestPath);
      const hasWritePermission = await this.checkPermissions(destParentDir, 'write');
      if (!hasWritePermission) {
        return {
          success: false,
          message: 'Permission denied',
          error: 'No write permission in destination directory'
        };
      }

      let copiedSize = 0;

      // Copy item
      if (isDirectory) {
        // Copy directory recursively
        await this.copyDirectoryRecursive(normalizedSourcePath, normalizedDestPath);
        
        // Calculate total size of copied directory
        copiedSize = await this.calculateDirectorySize(normalizedDestPath);
      } else {
        // Copy file
        await fs.copyFile(normalizedSourcePath, normalizedDestPath);
        copiedSize = sourceStats.size;
      }

      // Create audit log
      await this.createAuditLog(
        'copy', 
        userId, 
        normalizedSourcePath, 
        `Copied ${isDirectory ? 'directory' : 'file'} "${sourceName}" to "${normalizedDestPath}" (${copiedSize} bytes)`, 
        { sourcePath: normalizedSourcePath, sourceSize: sourceStats.size },
        { destinationPath: normalizedDestPath, copiedSize }
      );

      return {
        success: true,
        message: `${isDirectory ? 'Directory' : 'File'} copied successfully`,
        data: {
          sourcePath: normalizedSourcePath,
          destinationPath: normalizedDestPath,
          sourceName,
          destinationName: path.basename(normalizedDestPath),
          type: isDirectory ? 'directory' : 'file',
          originalSize: sourceStats.size,
          copiedSize
        }
      };

    } catch (error) {
      logger.error(`Error copying item ${sourcePath} to ${destinationPath}: ${error}`);
      return {
        success: false,
        message: 'Failed to copy item',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Helper method to copy directory recursively
   */
  private async copyDirectoryRecursive(source: string, destination: string): Promise<void> {
    await fs.mkdir(destination, { recursive: true });
    
    const entries = await fs.readdir(source);
    
    for (const entry of entries) {
      const sourcePath = path.join(source, entry);
      const destPath = path.join(destination, entry);
      
      const stats = await fs.stat(sourcePath);
      
      if (stats.isDirectory()) {
        await this.copyDirectoryRecursive(sourcePath, destPath);
      } else {
        await fs.copyFile(sourcePath, destPath);
      }
    }
  }

  /**
   * Helper method to calculate directory size
   */
  private async calculateDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;
    
    try {
      const entries = await fs.readdir(dirPath);
      
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry);
        const stats = await fs.stat(entryPath);
        
        if (stats.isDirectory()) {
          totalSize += await this.calculateDirectorySize(entryPath);
        } else {
          totalSize += stats.size;
        }
      }
    } catch (error) {
      logger.warn(`Error calculating directory size for ${dirPath}: ${error}`);
    }
    
    return totalSize;
  }
}