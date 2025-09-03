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
   * POST /api/recordings
   * Start recording a session
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { sessionId, recordingName, description, recordingQuality, settings } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      const recordingId = await recordingService.startRecording(sessionId, {
        recordingName,
        description,
        recordedBy: req.user?.id,
        recordingQuality: recordingQuality || 'high'
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
   * POST /api/recordings/start
   * Alternative endpoint for starting recording
   */
  router.post('/start', async (req: Request, res: Response) => {
    try {
      const { sessionId, recordingName, description, recordingQuality, autoRecord } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      const recordingId = await recordingService.startRecording(sessionId, {
        recordingName,
        description,
        recordedBy: req.user?.id,
        recordingQuality: recordingQuality || 'high'
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
   * POST /api/recordings/:recordingId/stop
   * Stop recording by recording ID
   */
  router.post('/:recordingId/stop', async (req: Request, res: Response) => {
    try {
      const { recordingId } = req.params;
      
      await recordingService.stopRecording(recordingId);
      
      res.json({ message: 'Recording stopped successfully', recordingId });
    } catch (error) {
      console.error('Error stopping recording:', error);
      res.status(500).json({ 
        error: 'Failed to stop recording', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  /**
   * POST /api/recordings/:sessionId/stop
   * Stop recording by session ID (legacy support)
   */
  router.post('/session/:sessionId/stop', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      
      // Find active recording for session
      const recordings = await database.getAllSessionRecordings();
      const activeRecording = recordings.find(r => r.sessionId === sessionId && r.status === 'recording');
      
      if (!activeRecording) {
        return res.status(404).json({ error: 'No active recording found for session' });
      }
      
      await recordingService.stopRecording(activeRecording.id);
      
      res.json({ message: 'Recording stopped successfully', recordingId: activeRecording.id });
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

  /**
   * POST /api/recordings/interactions/batch
   * Batch add interactions to a recording
   */
  router.post('/interactions/batch', async (req: Request, res: Response) => {
    try {
      const { recordingId, interactions } = req.body;
      
      if (!recordingId || !interactions || !Array.isArray(interactions)) {
        return res.status(400).json({ error: 'Recording ID and interactions array are required' });
      }

      // Process each interaction
      for (const interaction of interactions) {
        await recordingService.recordInteraction(recordingId, interaction.sessionId, {
          type: interaction.type,
          content: interaction.content,
          agentType: interaction.agentType,
          metadata: interaction.metadata,
          relatedMessageId: interaction.relatedMessageId,
          relatedEventId: interaction.relatedEventId,
          durationMs: interaction.durationMs
        });
      }
      
      res.json({ 
        message: 'Interactions recorded successfully', 
        count: interactions.length 
      });
    } catch (error) {
      console.error('Error recording interactions:', error);
      res.status(500).json({ 
        error: 'Failed to record interactions', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  /**
   * GET /api/recordings/:recordingId/interactions
   * Get interactions for a recording with optional time range
   */
  router.get('/:recordingId/interactions', async (req: Request, res: Response) => {
    try {
      const { recordingId } = req.params;
      const { startTimeMs, endTimeMs, limit, offset } = req.query;
      
      let interactions;
      
      if (startTimeMs || endTimeMs) {
        interactions = await database.getRecordingInteractionsByTimeRange(
          recordingId,
          startTimeMs ? parseInt(startTimeMs as string) : 0,
          endTimeMs ? parseInt(endTimeMs as string) : Number.MAX_SAFE_INTEGER
        );
      } else {
        interactions = await database.getRecordingInteractions(recordingId);
      }
      
      // Apply pagination if requested
      if (limit || offset) {
        const startIndex = offset ? parseInt(offset as string) : 0;
        const endIndex = limit ? startIndex + parseInt(limit as string) : undefined;
        interactions = interactions.slice(startIndex, endIndex);
      }
      
      res.json({ 
        interactions,
        total: interactions.length,
        recordingId 
      });
    } catch (error) {
      console.error('Error fetching interactions:', error);
      res.status(500).json({ 
        error: 'Failed to fetch interactions', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  /**
   * GET /api/recordings/:recordingId/playback
   * Get playback data for a recording
   */
  router.get('/:recordingId/playback', async (req: Request, res: Response) => {
    try {
      const { recordingId } = req.params;
      const { startTimeMs, endTimeMs } = req.query;
      
      const playbackData = await recordingService.getPlaybackData(
        recordingId,
        startTimeMs ? parseInt(startTimeMs as string) : 0,
        endTimeMs ? parseInt(endTimeMs as string) : undefined
      );
      
      res.json(playbackData);
    } catch (error) {
      console.error('Error fetching playback data:', error);
      res.status(500).json({ 
        error: 'Failed to fetch playback data', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  /**
   * POST /api/recordings/:recordingId/playback
   * Create a playback session
   */
  router.post('/:recordingId/playback', async (req: Request, res: Response) => {
    try {
      const { recordingId } = req.params;
      const { playbackName, playbackSettings } = req.body;
      
      const playbackSessionId = await recordingService.createPlaybackSession(
        recordingId,
        req.user?.id,
        { playbackName, playbackSettings }
      );
      
      res.status(201).json({ 
        playbackSessionId,
        message: 'Playback session created successfully' 
      });
    } catch (error) {
      console.error('Error creating playback session:', error);
      res.status(500).json({ 
        error: 'Failed to create playback session', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  /**
   * PUT /api/recordings/:recordingId/playback/:playbackId
   * Update playback session state
   */
  router.put('/:recordingId/playback/:playbackId', async (req: Request, res: Response) => {
    try {
      const { playbackId } = req.params;
      const updates = req.body;
      
      await recordingService.updatePlaybackState(playbackId, updates);
      
      res.json({ message: 'Playback state updated successfully' });
    } catch (error) {
      console.error('Error updating playback state:', error);
      res.status(500).json({ 
        error: 'Failed to update playback state', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  /**
   * POST /api/recordings/:recordingId/annotations
   * Add annotation to a recording
   */
  router.post('/:recordingId/annotations', async (req: Request, res: Response) => {
    try {
      const { recordingId } = req.params;
      const annotation = req.body;
      
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const annotationId = await recordingService.addAnnotation(
        recordingId,
        req.user.id,
        annotation
      );
      
      res.status(201).json({ 
        annotationId,
        message: 'Annotation added successfully' 
      });
    } catch (error) {
      console.error('Error adding annotation:', error);
      res.status(500).json({ 
        error: 'Failed to add annotation', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  /**
   * POST /api/recordings/:recordingId/bookmarks
   * Add bookmark to a recording
   */
  router.post('/:recordingId/bookmarks', async (req: Request, res: Response) => {
    try {
      const { recordingId } = req.params;
      const bookmark = req.body;
      
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const bookmarkId = await recordingService.addBookmark(
        recordingId,
        req.user.id,
        bookmark
      );
      
      res.status(201).json({ 
        bookmarkId,
        message: 'Bookmark added successfully' 
      });
    } catch (error) {
      console.error('Error adding bookmark:', error);
      res.status(500).json({ 
        error: 'Failed to add bookmark', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  /**
   * POST /api/recordings/:recordingId/export
   * Export recording in various formats
   */
  router.post('/:recordingId/export', async (req: Request, res: Response) => {
    try {
      const { recordingId } = req.params;
      const { 
        exportFormat, 
        exportOptions, 
        includeAnnotations, 
        includeBookmarks, 
        includeMetadata,
        startTimeMs,
        endTimeMs 
      } = req.body;
      
      if (!exportFormat) {
        return res.status(400).json({ error: 'Export format is required' });
      }
      
      const exportId = await recordingService.exportRecording(
        recordingId,
        req.user?.id || 'anonymous',
        {
          exportFormat,
          exportOptions,
          includeAnnotations,
          includeBookmarks,
          includeMetadata,
          startTimeMs,
          endTimeMs
        }
      );
      
      res.status(202).json({ 
        exportId,
        message: 'Export started successfully',
        status: 'processing' 
      });
    } catch (error) {
      console.error('Error starting export:', error);
      res.status(500).json({ 
        error: 'Failed to start export', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  /**
   * GET /api/recordings/stats
   * Get recording statistics
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const recordings = await database.getAllSessionRecordings();
      
      const stats = {
        activeRecordings: recordings.filter(r => r.status === 'recording').length,
        totalRecordings: recordings.length,
        completedRecordings: recordings.filter(r => r.status === 'completed').length,
        failedRecordings: recordings.filter(r => r.status === 'failed').length,
        totalStorageBytes: recordings.reduce((sum, r) => sum + r.totalSizeBytes, 0),
        averageDuration: recordings.reduce((sum, r) => sum + (r.playbackDurationMs || 0), 0) / recordings.length,
        totalDownloads: recordings.reduce((sum, r) => sum + r.downloadCount, 0),
        publicRecordings: recordings.filter(r => r.sharedPublicly).length
      };
      
      res.json({ stats });
    } catch (error) {
      console.error('Error fetching recording stats:', error);
      res.status(500).json({ 
        error: 'Failed to fetch recording stats', 
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