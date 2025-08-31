import React, { useState } from 'react';
import { Play, Eye, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { SessionReplayPlayer } from './SessionReplayPlayer';
import { DualAgentSession } from '../../types';

interface ReplayButtonProps {
  session: DualAgentSession;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
  showLabel?: boolean;
  disabled?: boolean;
  onReplayStart?: (sessionId: string) => void;
  onReplayEnd?: (sessionId: string) => void;
}

export function ReplayButton({ 
  session, 
  size = 'sm',
  variant = 'outline',
  showLabel = true,
  disabled = false,
  onReplayStart,
  onReplayEnd
}: ReplayButtonProps) {
  const [isReplayOpen, setIsReplayOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const canReplay = session.messages && session.messages.length > 0 && session.status !== 'running';

  const handleReplayClick = async () => {
    if (!canReplay || disabled) return;
    
    setIsLoading(true);
    try {
      onReplayStart?.(session.id);
      setIsReplayOpen(true);
    } catch (error) {
      console.error('Failed to start replay:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReplayClose = () => {
    setIsReplayOpen(false);
    onReplayEnd?.(session.id);
  };

  const getButtonTooltip = () => {
    if (!canReplay) {
      if (session.status === 'running') {
        return 'Cannot replay active session';
      }
      if (!session.messages || session.messages.length === 0) {
        return 'No messages to replay';
      }
    }
    return 'Replay session';
  };

  if (isReplayOpen) {
    return (
      <div className="fixed inset-0 bg-white z-50">
        <SessionReplayPlayer 
          sessionId={session.id}
          onClose={handleReplayClose}
          showCollaborativeFeatures={true}
        />
      </div>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleReplayClick}
      disabled={!canReplay || disabled || isLoading}
      title={getButtonTooltip()}
      className="flex items-center gap-1"
    >
      {isLoading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Play size={14} />
      )}
      {showLabel && (
        <span className={size === 'sm' ? 'text-xs' : 'text-sm'}>
          Replay
        </span>
      )}
    </Button>
  );
}

// Alternative compact version for use in tables/lists
export function ReplayIconButton({ 
  session, 
  disabled = false, 
  onReplayStart,
  onReplayEnd 
}: Pick<ReplayButtonProps, 'session' | 'disabled' | 'onReplayStart' | 'onReplayEnd'>) {
  return (
    <ReplayButton 
      session={session}
      size="sm"
      variant="ghost"
      showLabel={false}
      disabled={disabled}
      onReplayStart={onReplayStart}
      onReplayEnd={onReplayEnd}
    />
  );
}

// Modal version that opens replay in a modal instead of fullscreen
export function ReplayModalButton({ 
  session,
  trigger,
  onReplayStart,
  onReplayEnd
}: {
  session: DualAgentSession;
  trigger?: React.ReactNode;
  onReplayStart?: (sessionId: string) => void;
  onReplayEnd?: (sessionId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => {
    onReplayStart?.(session.id);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    onReplayEnd?.(session.id);
  };

  const canReplay = session.messages && session.messages.length > 0 && session.status !== 'running';

  return (
    <>
      <div onClick={handleOpen}>
        {trigger || (
          <Button 
            variant="outline" 
            size="sm"
            disabled={!canReplay}
            className="flex items-center gap-1"
          >
            <Eye size={14} />
            Watch Replay
          </Button>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full h-full max-w-7xl max-h-[90vh] overflow-hidden">
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">Session Replay</h2>
                <Button 
                  variant="outline" 
                  onClick={handleClose}
                  size="sm"
                >
                  Close
                </Button>
              </div>
              
              <div className="flex-1 min-h-0">
                <SessionReplayPlayer 
                  sessionId={session.id}
                  onClose={handleClose}
                  showCollaborativeFeatures={false}
                  isEmbedded={true}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}