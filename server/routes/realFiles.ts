import express from 'express';
import { RealFileSystemService } from '../services/realFileSystemService';
import { storage } from '../storage';
import { isAuthenticated } from '../auth';
import { logger } from '../utils/logger';

const router = express.Router();
const realFileService = new RealFileSystemService(storage);

// Browse directory
router.get('/browse', isAuthenticated, async (req, res) => {
  try {
    const { path } = req.query;
    const userId = req.user!.id;

    if (!path || typeof path !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Path parameter is required'
      });
    }

    const result = await realFileService.listDirectory(path, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('Error browsing directory:', error as any);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get file content
router.get('/content', isAuthenticated, async (req, res) => {
  try {
    const { path } = req.query;
    const userId = req.user!.id;

    if (!path || typeof path !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Path parameter is required'
      });
    }

    const result = await realFileService.readFileContent(path, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('Error reading file content:', error as any);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create file or directory
router.post('/create', isAuthenticated, async (req, res) => {
  try {
    const { path, type, content, mode } = req.body;
    const userId = req.user!.id;

    if (!path || !type) {
      return res.status(400).json({
        success: false,
        error: 'Path and type are required'
      });
    }

    let result;
    if (type === 'directory') {
      result = await realFileService.createDirectory(path, userId, {
        recursive: true,
        mode: mode || 0o755
      });
    } else {
      result = await realFileService.createFile(path, userId, {
        content: content || '',
        mode: mode || 0o644
      });
    }

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('Error creating item:', error as any);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete file or directory
router.delete('/delete', isAuthenticated, async (req, res) => {
  try {
    const { path } = req.body;
    const userId = req.user!.id;

    if (!path) {
      return res.status(400).json({
        success: false,
        error: 'Path is required'
      });
    }

    const result = await realFileService.deleteItem(path, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('Error deleting item:', error as any);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Rename file or directory
router.put('/rename', isAuthenticated, async (req, res) => {
  try {
    const { oldPath, newPath } = req.body;
    const userId = req.user!.id;

    if (!oldPath || !newPath) {
      return res.status(400).json({
        success: false,
        error: 'Both oldPath and newPath are required'
      });
    }

    const result = await realFileService.renameItem(oldPath, newPath, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('Error renaming item:', error as any);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Copy file or directory
router.post('/copy', isAuthenticated, async (req, res) => {
  try {
    const { sourcePath, destinationPath } = req.body;
    const userId = req.user!.id;

    if (!sourcePath || !destinationPath) {
      return res.status(400).json({
        success: false,
        error: 'Both sourcePath and destinationPath are required'
      });
    }

    const result = await realFileService.copyItem(sourcePath, destinationPath, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('Error copying item:', error as any);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get file info
router.get('/info', isAuthenticated, async (req, res) => {
  try {
    const { path } = req.query;
    const userId = req.user!.id;

    if (!path || typeof path !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Path parameter is required'
      });
    }

    const result = await realFileService.getFileInfo(path, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('Error getting file info:', error as any);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;