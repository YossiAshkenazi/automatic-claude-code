import { format, formatDistanceToNow } from 'date-fns';

export function formatTimestamp(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'HH:mm:ss');
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'MMM dd, yyyy HH:mm:ss');
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
}

export function highlightCode(code: string, language: string = 'text'): string {
  // This would integrate with react-syntax-highlighter in the component
  return code;
}

export function getAgentColor(agentType: 'manager' | 'worker'): string {
  return agentType === 'manager' ? 'text-purple-600' : 'text-blue-600';
}

export function getAgentBgColor(agentType: 'manager' | 'worker'): string {
  return agentType === 'manager' ? 'bg-purple-50' : 'bg-blue-50';
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'running':
      return 'text-green-600';
    case 'completed':
      return 'text-green-700';
    case 'failed':
      return 'text-red-600';
    case 'paused':
      return 'text-yellow-600';
    default:
      return 'text-gray-600';
  }
}

export function getStatusBadgeColor(status: string): string {
  switch (status) {
    case 'running':
      return 'bg-green-100 text-green-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    case 'paused':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}