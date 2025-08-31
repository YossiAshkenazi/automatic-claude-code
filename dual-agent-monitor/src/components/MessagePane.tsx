import React, { useEffect, useRef } from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Clock, Tool, FileText, Terminal } from 'lucide-react';
import { MessagePaneProps } from '../types';
import { formatTimestamp, getAgentColor, getAgentBgColor, truncateText } from '../utils/formatters';

// Register languages for syntax highlighting
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';

SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('json', json);

export function MessagePane({ agentType, messages, session }: MessagePaneProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const agentMessages = messages.filter(msg => msg.agentType === agentType);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentMessages]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const detectLanguage = (content: string): string => {
    if (content.includes('```')) {
      const match = content.match(/```(\w+)/);
      if (match) return match[1];
    }
    
    if (content.startsWith('{') || content.startsWith('[')) return 'json';
    if (content.includes('def ') || content.includes('import ')) return 'python';
    if (content.includes('function ') || content.includes('const ')) return 'javascript';
    if (content.includes('$') || content.includes('cd ')) return 'bash';
    
    return 'text';
  };

  const renderMessageContent = (content: string, messageType: string) => {
    if (messageType === 'tool_call' || content.includes('```')) {
      const codeBlocks = content.split(/```(\w*)\n?/);
      
      return (
        <div className="space-y-2">
          {codeBlocks.map((block, index) => {
            if (index % 2 === 0) {
              // Regular text
              return block ? (
                <div key={index} className="whitespace-pre-wrap">
                  {block}
                </div>
              ) : null;
            } else {
              // Code block
              const language = codeBlocks[index] || detectLanguage(codeBlocks[index + 1]);
              const code = codeBlocks[index + 1];
              
              return (
                <div key={index} className="relative">
                  <SyntaxHighlighter
                    language={language}
                    style={tomorrow}
                    customStyle={{
                      margin: 0,
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                    }}
                  >
                    {code}
                  </SyntaxHighlighter>
                  <button
                    onClick={() => copyToClipboard(code)}
                    className="absolute top-2 right-2 p-1 bg-gray-700 hover:bg-gray-600 rounded text-white opacity-75 hover:opacity-100"
                    title="Copy code"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              );
            }
          })}
        </div>
      );
    }

    return (
      <div className="whitespace-pre-wrap">
        {content}
      </div>
    );
  };

  const getMessageIcon = (messageType: string) => {
    switch (messageType) {
      case 'tool_call':
        return <Tool size={16} />;
      case 'error':
        return <div className="w-4 h-4 bg-red-500 rounded-full" />;
      case 'system':
        return <div className="w-4 h-4 bg-gray-500 rounded-full" />;
      default:
        return <FileText size={16} />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`${getAgentBgColor(agentType)} px-4 py-3 border-b border-gray-200`}>
        <h2 className={`text-lg font-semibold ${getAgentColor(agentType)} flex items-center gap-2`}>
          <div className={`w-3 h-3 rounded-full ${agentType === 'manager' ? 'bg-purple-500' : 'bg-blue-500'}`} />
          {agentType === 'manager' ? 'Manager (Opus)' : 'Worker (Sonnet)'}
          <span className="text-sm text-gray-500 font-normal">
            ({agentMessages.length} messages)
          </span>
        </h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {agentMessages.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            No messages from {agentType} agent yet
          </div>
        ) : (
          agentMessages.map((message) => (
            <div
              key={message.id}
              className={`p-4 rounded-lg border ${getAgentBgColor(agentType)} border-gray-200 hover:shadow-sm transition-shadow`}
            >
              {/* Message Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getMessageIcon(message.messageType)}
                  <span className="text-sm font-medium capitalize">
                    {message.messageType.replace('_', ' ')}
                  </span>
                  {message.metadata?.duration && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock size={12} />
                      {message.metadata.duration}s
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {formatTimestamp(message.timestamp)}
                  </span>
                  <button
                    onClick={() => copyToClipboard(message.content)}
                    className="p-1 hover:bg-gray-200 rounded"
                    title="Copy message"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>

              {/* Message Content */}
              <div className="text-sm">
                {renderMessageContent(message.content, message.messageType)}
              </div>

              {/* Metadata */}
              {message.metadata && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                    {message.metadata.tools && (
                      <div className="flex items-center gap-1">
                        <Tool size={12} />
                        Tools: {message.metadata.tools.join(', ')}
                      </div>
                    )}
                    {message.metadata.files && (
                      <div className="flex items-center gap-1">
                        <FileText size={12} />
                        Files: {message.metadata.files.length}
                      </div>
                    )}
                    {message.metadata.commands && (
                      <div className="flex items-center gap-1">
                        <Terminal size={12} />
                        Commands: {message.metadata.commands.length}
                      </div>
                    )}
                    {message.metadata.cost && (
                      <div>
                        Cost: ${message.metadata.cost.toFixed(4)}
                      </div>
                    )}
                    {message.metadata.exitCode !== undefined && (
                      <div className={message.metadata.exitCode === 0 ? 'text-green-600' : 'text-red-600'}>
                        Exit: {message.metadata.exitCode}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}