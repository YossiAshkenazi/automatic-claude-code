import { Router, Request, Response } from 'express';
import { DatabaseInterface } from '../database/DatabaseInterface';
import { SessionRecordingService } from '../services/SessionRecordingService';
import { RecordingManager } from '../services/RecordingManager';
import { 
  SessionRecording, 
  PlaybackSession, 
  RecordingAnnotation, 
  RecordingBookmark,
  RecordingExport 
} from '../types';

export function createRecordingRoutes(
  database: DatabaseInterface,
  recordingService: SessionRecordingService,
  recordingManager: RecordingManager
): Router {
  const router = Router();

  // ===============================================
  // RECORDING MANAGEMENT ENDPOINTS
  // ===============================================

  /**
   * POST /api/recordings/start
   * Start recording a session
   */
  router.post('/start', async (req: Request, res: Response) => {
    try {
      const { sessionId, recordingName, description, recordingQuality, autoRecord } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      const recordingId = await recordingManager.startSessionRecording(sessionId, {
        recordingName,
        description,
        recordedBy: req.user?.id,
        recordingQuality,
        autoRecord
      });

      const recording = await database.getSessionRecording(recordingId);
      res.status(201).json({ recordingId, recording });
    } catch (error) {
      console.error('Error starting recording:', error);
      res.status(500).json({ 
        error: 'Failed to start recording', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  /**
   * POST /api/recordings/:sessionId/stop
   * Stop recording a session
   */
  router.post('/:sessionId/stop', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      
      await recordingManager.stopSessionRecording(sessionId);
      
      res.json({ message: 'Recording stopped successfully' });
    } catch (error) {
      console.error('Error stopping recording:', error);
      res.status(500).json({ 
        error: 'Failed to stop recording', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  /**
   * GET /api/recordings
   * Get all recordings with optional filtering
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { limit, status, quality, search } = req.query;
      
      let recordings = await database.getAllSessionRecordings(
        limit ? parseInt(limit as string) : undefined
      );
      
      // Apply filters
      if (status && status !== 'all') {
        recordings = recordings.filter(r => r.status === status);
      }
      
      if (quality && quality !== 'all') {
        recordings = recordings.filter(r => r.recordingQuality === quality);
      }
      
      if (search) {
        const searchTerm = (search as string).toLowerCase();
        recordings = recordings.filter(r => 
          r.recordingName?.toLowerCase().includes(searchTerm) ||
          r.description?.toLowerCase().includes(searchTerm) ||
          r.sessionId.toLowerCase().includes(searchTerm)
        );
      }
      
      res.json({ recordings, total: recordings.length });
    } catch (error) {
      console.error('Error fetching recordings:', error);
      res.status(500).json({ 
        error: 'Failed to fetch recordings', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  /**
   * GET /api/recordings/:recordingId
   * Get a specific recording
   */
  router.get('/:recordingId', async (req: Request, res: Response) => {
    try {
      const { recordingId } = req.params;
      
      const recording = await database.getSessionRecording(recordingId);
      if (!recording) {
        return res.status(404).json({ error: 'Recording not found' });
      }
      
      res.json({ recording });
    } catch (error) {
      console.error('Error fetching recording:', error);
      res.status(500).json({ 
        error: 'Failed to fetch recording', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  return router;
}

// Helper function to get content type for export formats
function getContentTypeForFormat(format: string): string {
  const contentTypes: { [key: string]: string } = {
    json: 'application/json',
    csv: 'text/csv',
    html: 'text/html',
    pdf: 'application/pdf',
    zip: 'application/zip',
    video: 'video/mp4'
  };
  
  return contentTypes[format] || 'application/octet-stream';
}

// Type augmentation for Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        email: string;
        role: string;
      };
    }
  }
}