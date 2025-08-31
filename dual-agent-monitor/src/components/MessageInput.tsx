import React, { useState, KeyboardEvent } from 'react';
import { Send, Paperclip, Mic, Settings2, User, Bot } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

interface MessageInputProps {
  sessionId: string;
  onSendMessage: (content: string, agentType: 'manager' | 'worker' | 'both') => void;
  disabled?: boolean;
  className?: string;
}

export function MessageInput({ sessionId, onSendMessage, disabled, className }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [targetAgent, setTargetAgent] = useState<'manager' | 'worker' | 'both'>('both');
  const [isRecording, setIsRecording] = useState(false);

  const handleSend = () => {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    onSendMessage(message, targetAgent);
    setMessage('');
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceInput = () => {
    setIsRecording(!isRecording);
    if (isRecording) {
      // Stop recording
      toast.info('Voice recording stopped');
    } else {
      // Start recording
      toast.info('Voice recording started (not implemented)');
    }
  };

  const getTargetBadgeVariant = () => {
    switch (targetAgent) {
      case 'manager':
        return 'default';
      case 'worker':
        return 'secondary';
      case 'both':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getTargetIcon = () => {
    switch (targetAgent) {
      case 'manager':
        return <User className="h-3 w-3" />;
      case 'worker':
        return <Bot className="h-3 w-3" />;
      case 'both':
        return <Settings2 className="h-3 w-3" />;
      default:
        return <Settings2 className="h-3 w-3" />;
    }
  };

  return (
    <Card className={cn("p-4", className)}>
      <div className="space-y-3">
        {/* Target selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Send to:</span>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  {getTargetIcon()}
                  <span className="capitalize">{targetAgent === 'both' ? 'Both Agents' : `${targetAgent} Agent`}</span>
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="bg-card border rounded-lg shadow-lg p-2 min-w-[180px] z-50">
                  <DropdownMenu.Item
                    onClick={() => setTargetAgent('both')}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer outline-none",
                      "hover:bg-accent hover:text-accent-foreground",
                      targetAgent === 'both' && "bg-accent text-accent-foreground"
                    )}
                  >
                    <Settings2 className="h-4 w-4" />
                    Both Agents
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onClick={() => setTargetAgent('manager')}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer outline-none",
                      "hover:bg-accent hover:text-accent-foreground",
                      targetAgent === 'manager' && "bg-accent text-accent-foreground"
                    )}
                  >
                    <User className="h-4 w-4" />
                    Manager Agent
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onClick={() => setTargetAgent('worker')}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer outline-none",
                      "hover:bg-accent hover:text-accent-foreground",
                      targetAgent === 'worker' && "bg-accent text-accent-foreground"
                    )}
                  >
                    <Bot className="h-4 w-4" />
                    Worker Agent
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
          <Badge variant={getTargetBadgeVariant()}>
            Session: {sessionId.slice(0, 8)}...
          </Badge>
        </div>

        {/* Input area */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Message to ${targetAgent === 'both' ? 'both agents' : `${targetAgent} agent`}...`}
              disabled={disabled}
              className="pr-20"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => toast.info('File attachment not implemented')}
                disabled={disabled}
                className="h-7 w-7 p-0"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleVoiceInput}
                disabled={disabled}
                className={cn("h-7 w-7 p-0", isRecording && "text-red-500")}
              >
                <Mic className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Button
            onClick={handleSend}
            disabled={disabled || !message.trim()}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            Send
          </Button>
        </div>

        {/* Quick actions */}
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMessage('/status')}
            className="text-xs"
          >
            Check Status
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMessage('/pause')}
            className="text-xs"
          >
            Pause Agents
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMessage('/resume')}
            className="text-xs"
          >
            Resume Agents
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMessage('/help')}
            className="text-xs"
          >
            Get Help
          </Button>
        </div>
      </div>
    </Card>
  );
}