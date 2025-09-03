import React from 'react';
import { Wifi, WifiOff, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

interface ConnectionStatusProps {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  onReconnect: () => void;
  onDismissError?: () => void;
  className?: string;
}

export function ConnectionStatus({
  connected,
  connecting,
  error,
  onReconnect,
  onDismissError,
  className
}: ConnectionStatusProps) {
  const getStatusInfo = () => {
    if (connecting) {
      return {
        icon: Loader2,
        text: 'Connecting...',
        variant: 'secondary' as const,
        className: 'bg-yellow-100 text-yellow-700',
        iconClassName: 'text-yellow-600 animate-spin'
      };
    }
    
    if (connected) {
      return {
        icon: CheckCircle,
        text: 'Connected to Python Agent Server',
        variant: 'success' as const,
        className: 'bg-green-100 text-green-700',
        iconClassName: 'text-green-600'
      };
    }
    
    return {
      icon: WifiOff,
      text: 'Disconnected from Python Agent Server',
      variant: 'destructive' as const,
      className: 'bg-red-100 text-red-700',
      iconClassName: 'text-red-600'
    };
  };

  const status = getStatusInfo();
  const StatusIcon = status.icon;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Connection Status Badge */}
      <div className={cn(
        'flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium',
        status.className
      )}>
        <StatusIcon className={cn('w-4 h-4', status.iconClassName)} />
        <span>{status.text}</span>
      </div>

      {/* Server Info */}
      <div className="text-xs text-gray-500">
        ws://localhost:8765
      </div>

      {/* Error Display */}
      {error && !connecting && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-2 py-1 bg-red-50 text-red-700 rounded text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
            {onDismissError && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismissError}
                className="h-auto p-0 text-red-600 hover:text-red-800"
              >
                ×
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Reconnect Button */}
      {!connected && !connecting && (
        <Button
          variant="outline"
          size="sm"
          onClick={onReconnect}
          className="flex items-center gap-2"
        >
          <Wifi className="w-4 h-4" />
          Reconnect
        </Button>
      )}

      {/* Real-time Indicator */}
      {connected && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Real-time updates active
        </div>
      )}
    </div>
  );
}