import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Copy,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Filter,
  Search,
  MoreVertical,
  Eye,
  EyeOff,
  Clock,
  User,
  Bot,
  Code,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Card, CardContent } from '../ui/Card';
import { useTheme } from '../ui/ThemeProvider';
import { AgentMessage, DualAgentSession } from '../../types';
import { cn, formatRelativeTime, copyToClipboard, getAgentColor } from '../../lib/utils';
import { toast } from 'sonner';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

interface EnhancedMessagePaneProps {
  agentType: 'manager' | 'worker' | 'all';
  messages: AgentMessage[];
  session: DualAgentSession;
  className?: string;
}

interface MessageFilters {
  messageType?: string;
  search?: string;
  dateRange?: { start: Date; end: Date };
}

export function EnhancedMessagePane({
  agentType,
  messages,
  session,
  className,
}: EnhancedMessagePaneProps) {
  const { theme } = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [filters, setFilters] = useState<MessageFilters>({});
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  // Filter messages based on agent type and filters
  const filteredMessages = useMemo(() => {
    let filtered = messages;

    // Filter by agent type
    if (agentType !== 'all') {
      filtered = filtered.filter(msg => msg.agentType === agentType);
    }

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(msg => {
        const content = typeof msg.content === 'string' 
          ? msg.content 
          : JSON.stringify(msg.content);
        return content.toLowerCase().includes(searchLower) ||
               msg.messageType.toLowerCase().includes(searchLower);
      });
    }

    // Apply message type filter
    if (filters.messageType) {
      filtered = filtered.filter(msg => msg.messageType === filters.messageType);
    }

    // Apply date range filter
    if (filters.dateRange) {
      filtered = filtered.filter(msg => {
        const msgDate = new Date(msg.timestamp);
        return msgDate >= filters.dateRange!.start && msgDate <= filters.dateRange!.end;
      });
    }

    return filtered.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [messages, agentType, filters]);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredMessages, autoScroll]);

  // Check if user has scrolled away from bottom
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollHeight - scrollTop === clientHeight;
    setAutoScroll(isAtBottom);
  };

  const toggleMessageExpanded = (messageId: string) => {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(messageId)) {
      newExpanded.delete(messageId);
    } else {
      newExpanded.add(messageId);
    }
    setExpandedMessages(newExpanded);
  };

  const copyMessageContent = (message: AgentMessage) => {
    const content = typeof message.content === 'string' 
      ? message.content 
      : JSON.stringify(message.content, null, 2);
    copyToClipboard(content);
    toast.success('Message content copied to clipboard');
  };

  const getMessageIcon = (messageType: string, agentType: string) => {
    switch (messageType) {
      case 'user_message':
        return <User className="w-4 h-4" />;
      case 'assistant_message':
        return <Bot className="w-4 h-4" />;
      case 'tool_use':
        return <Code className="w-4 h-4" />;
      case 'tool_result':
        return <FileText className="w-4 h-4" />;
      case 'error':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return agentType === 'manager' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />;
    }
  };

  const renderMessageContent = (message: AgentMessage) => {
    const isExpanded = expandedMessages.has(message.id);
    const content = typeof message.content === 'string' 
      ? message.content 
      : JSON.stringify(message.content, null, 2);

    // Check if content looks like code
    const isCodeLike = content.includes('```') || 
                      content.includes('{') || 
                      content.includes('function') ||
                      content.includes('import ') ||
                      message.messageType === 'tool_use' ||
                      message.messageType === 'tool_result';

    if (isCodeLike && isExpanded) {
      // Try to extract language from markdown code blocks
      const codeBlockMatch = content.match(/```(\w+)?\n?([\s\S]*?)```/);
      if (codeBlockMatch) {
        const language = codeBlockMatch[1] || 'text';
        const code = codeBlockMatch[2];
        
        return (
          <div className="mt-2">
            <SyntaxHighlighter
              style={theme === 'dark' ? oneDark : oneLight}
              language={language}
              className="rounded-md text-sm"
            >
              {code}
            </SyntaxHighlighter>
          </div>
        );
      } else if (message.messageType === 'tool_use' || message.messageType === 'tool_result') {
        return (
          <div className="mt-2">
            <SyntaxHighlighter
              style={theme === 'dark' ? oneDark : oneLight}
              language="json"
              className="rounded-md text-sm"
            >
              {content}
            </SyntaxHighlighter>
          </div>
        );
      }
    }

    // Regular text content
    const truncatedContent = isExpanded ? content : content.slice(0, 300);
    const shouldTruncate = content.length > 300;

    return (
      <div className="mt-2">
        <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">
          {truncatedContent}
          {shouldTruncate && !isExpanded && (
            <span className="text-muted-foreground">...</span>
          )}
        </pre>
        {shouldTruncate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleMessageExpanded(message.id)}
            className="mt-2 text-xs"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3 h-3 mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3 mr-1" />
                Show more
              </>
            )}
          </Button>
        )}
      </div>
    );
  };

  const messageTypes = Array.from(new Set(messages.map(m => m.messageType)));

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Header */}
      <div className="border-b border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              'p-2 rounded-lg',
              agentType === 'manager' 
                ? 'bg-purple-100 dark:bg-purple-900/20' 
                : agentType === 'worker'
                ? 'bg-blue-100 dark:bg-blue-900/20'
                : 'bg-secondary'
            )}>
              {agentType === 'manager' ? (
                <User className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              ) : agentType === 'worker' ? (
                <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3 className="font-semibold capitalize">
                {agentType === 'all' ? 'All Messages' : `${agentType} Agent`}
              </h3>
              <p className="text-sm text-muted-foreground">
                {filteredMessages.length} message{filteredMessages.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAutoScroll(!autoScroll)}
              className={autoScroll ? 'text-primary' : 'text-muted-foreground'}
            >
              {autoScroll ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search messages..."
              value={filters.search || ''}
              onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })}
              className="pl-10"
            />
          </div>
          
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Type
                {filters.messageType && <Badge variant="secondary" className="ml-2">1</Badge>}
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <DropdownMenu.Item onClick={() => setFilters({ ...filters, messageType: undefined })}>
                All Types
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              {messageTypes.map(type => (
                <DropdownMenu.Item
                  key={type}
                  onClick={() => setFilters({ ...filters, messageType: type })}
                >
                  {type.replace('_', ' ')}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4"
      >
        {filteredMessages.length === 0 ? (
          <div className="h-full">
            <EmptyState
              icon={<FileText className="w-12 h-12" />}
              title={filters.search ? 'No matching messages' : 
                     agentType === 'all' ? 'No messages yet' : `No ${agentType} messages`}
              description={
                filters.search 
                  ? `No messages match "${filters.search}". Try adjusting your search or filters.`
                  : agentType === 'all'
                  ? 'Messages will appear here as agents communicate'
                  : `Messages from the ${agentType} agent will appear here`
              }
              action={filters.search ? {
                label: 'Clear Search',
                onClick: () => setFilters({ ...filters, search: undefined }),
                variant: 'outline'
              } : undefined}
              size="md"
            />
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredMessages.map((message, index) => {
            const agentColors = getAgentColor(message.agentType);
            const isSelected = selectedMessageId === message.id;
            
            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2, delay: index * 0.02 }}
              >
                <Card
                  className={cn(
                    'transition-all duration-200 cursor-pointer',
                    isSelected && 'ring-2 ring-primary',
                    agentColors.bg,
                    agentColors.border + ' border-l-4'
                  )}
                  onClick={() => setSelectedMessageId(isSelected ? null : message.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={cn('p-1.5 rounded-lg bg-background/50')}>
                          {getMessageIcon(message.messageType, message.agentType)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {message.messageType.replace('_', ' ')}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatRelativeTime(message.timestamp)}
                            </span>
                          </div>
                          
                          {renderMessageContent(message)}
                        </div>
                      </div>
                      
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <Button variant="ghost" size="icon" className="shrink-0">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content align="end">
                          <DropdownMenu.Item onClick={() => copyMessageContent(message)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy Content
                          </DropdownMenu.Item>
                          <DropdownMenu.Item onClick={() => toggleMessageExpanded(message.id)}>
                            {expandedMessages.has(message.id) ? (
                              <>
                                <ChevronRight className="mr-2 h-4 w-4" />
                                Collapse
                              </>
                            ) : (
                              <>
                                <ChevronDown className="mr-2 h-4 w-4" />
                                Expand
                              </>
                            )}
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Root>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
            })}
          </AnimatePresence>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-4 right-4"
        >
          <Button
            size="sm"
            onClick={() => {
              setAutoScroll(true);
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="shadow-lg"
          >
            <ChevronDown className="w-4 h-4 mr-2" />
            Scroll to bottom
          </Button>
        </motion.div>
      )}
    </div>
  );
}