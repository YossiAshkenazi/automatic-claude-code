import React, { useState } from 'react';
import { useSessionStore } from '../../store/useSessionStore';
import { useSidebarBadges } from '../../hooks/useAnalytics';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  Monitor,
  BarChart3,
  Clock,
  List,
  Settings,
  Zap,
  Activity,
  Archive,
  Users,
  Database,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path?: string;
  children?: SidebarItem[];
  badge?: string | number;
}

interface SidebarProps {
  items?: SidebarItem[];
  currentPath?: string;
  onNavigate?: (path: string) => void;
  className?: string;
  sessionCount?: number; // Allow override for custom session count
}

  // Create dynamic items with badges from analytics
  const dynamicItems: SidebarItem[] = items === defaultItems ? [
    {
      id: 'overview',
      label: 'Overview',
      icon: Monitor,
      path: '/overview',
    },
    {
      id: 'sessions',
      label: 'Sessions',
      icon: List,
      path: '/sessions',
      badge: dynamicSessionCount > 0 ? dynamicSessionCount : undefined,
    },
    {
      id: 'agents',
      label: 'Agents',
      icon: Users,
      badge: badges.agents,
      children: [
        { id: 'manager', label: 'Manager Agents', icon: Zap, path: '/agents/manager' },
        { id: 'worker', label: 'Worker Agents', icon: Activity, path: '/agents/worker' },
      ],
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      badge: badges.analytics,
      children: [
        { id: 'performance', label: 'Performance', icon: Activity, path: '/analytics/performance' },
        { id: 'timeline', label: 'Timeline', icon: Clock, path: '/analytics/timeline' },
      ],
    },
    {
      id: 'data',
      label: 'Data Management',
      icon: Database,
      children: [
        { id: 'export', label: 'Export Data', icon: Archive, path: '/data/export' },
        { id: 'import', label: 'Import Data', icon: Database, path: '/data/import' },
      ],
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      path: '/settings',
      badge: badges.alerts, // Show critical alerts in settings
    },
  ] : items;

const defaultItems: SidebarItem[] = [];

export function Sidebar({
  items = defaultItems,
  currentPath = '',
  onNavigate,
  className,
  sessionCount,
}: SidebarProps) {
  const { sessions } = useSessionStore();
  const badges = useSidebarBadges(sessions);
  
  // Use provided sessionCount or calculate from analytics
  const dynamicSessionCount = sessionCount ?? badges.sessions;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const handleItemClick = (item: SidebarItem) => {
    if (item.children) {
      toggleExpanded(item.id);
    } else if (item.path && onNavigate) {
      onNavigate(item.path);
    }
  };

  const renderItem = (item: SidebarItem, level = 0) => {
    const isActive = currentPath === item.path;
    const isExpanded = expandedItems.has(item.id);
    const hasChildren = item.children && item.children.length > 0;
    const Icon = item.icon;

    return (
      <div key={item.id} className={cn('select-none', level > 0 && 'ml-4')}>
        <button
          onClick={() => handleItemClick(item)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group',
            isActive
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
            level === 0 ? 'font-semibold' : 'font-normal'
          )}
        >
          <Icon
            size={18}
            className={cn(
              'shrink-0 transition-colors',
              isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'
            )}
          />
          
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="flex items-center gap-2 flex-1 min-w-0"
              >
                <span className="truncate flex-1">{item.label}</span>
                
                {item.badge && (
                  <span className="px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded-full shrink-0">
                    {item.badge}
                  </span>
                )}
                
                {hasChildren && (
                  <motion.div
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronRight size={14} />
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        <AnimatePresence>
          {hasChildren && isExpanded && !isCollapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mt-1"
            >
              <div className="space-y-1">
                {item.children!.map((child) => renderItem(child, level + 1))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <motion.aside
      animate={{ width: isCollapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className={cn(
        'h-full bg-card border-r border-border flex flex-col shadow-sm',
        className
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3"
              >
                <div className="p-2 bg-primary rounded-lg">
                  <Monitor className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="font-semibold text-sm">Dual Agent Monitor</h2>
                  <p className="text-xs text-muted-foreground">Enterprise Edition</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="shrink-0"
          >
            {isCollapsed ? <Menu size={18} /> : <X size={18} />}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-thin">
        {dynamicItems.map((item) => renderItem(item))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-muted-foreground space-y-1"
            >
              <div className="flex items-center justify-between">
                <span>Version</span>
                <span className="font-mono">2.1.0</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Status</span>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-green-600">Online</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}