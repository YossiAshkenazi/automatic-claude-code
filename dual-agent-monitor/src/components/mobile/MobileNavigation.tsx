import React, { useState, useEffect } from 'react';
import { Menu, X, Monitor, Home, BarChart3, Settings, Globe, List, Clock, Network, Activity, Brain, GitBranch } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

type ViewMode = 'cross-project' | 'sessions' | 'dual-pane' | 'timeline' | 'analytics' | 'message-flow' | 'comm-timeline' | 'agent-activity' | 'comm-analytics' | 'metrics';

interface MobileNavigationProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  isConnected: boolean;
  selectedSessionTitle?: string;
}

interface NavigationItem {
  id: ViewMode;
  label: string;
  icon: React.ReactNode;
  description: string;
  category: 'main' | 'analysis' | 'visualizations';
}

const navigationItems: NavigationItem[] = [
  {
    id: 'cross-project',
    label: 'All Projects',
    icon: <Globe size={20} />,
    description: 'Cross-project overview',
    category: 'main'
  },
  {
    id: 'sessions',
    label: 'Sessions',
    icon: <List size={20} />,
    description: 'Manage sessions',
    category: 'main'
  },
  {
    id: 'dual-pane',
    label: 'Dual Pane',
    icon: <Monitor size={20} />,
    description: 'Side-by-side view',
    category: 'main'
  },
  {
    id: 'timeline',
    label: 'Timeline',
    icon: <Clock size={20} />,
    description: 'Chronological view',
    category: 'analysis'
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <BarChart3 size={20} />,
    description: 'Performance analytics',
    category: 'analysis'
  },
  {
    id: 'message-flow',
    label: 'Message Flow',
    icon: <Network size={20} />,
    description: 'Message visualization',
    category: 'visualizations'
  },
  {
    id: 'comm-timeline',
    label: 'Communication',
    icon: <GitBranch size={20} />,
    description: 'Agent communication',
    category: 'visualizations'
  },
  {
    id: 'agent-activity',
    label: 'Activity Monitor',
    icon: <Activity size={20} />,
    description: 'Real-time activity',
    category: 'visualizations'
  },
  {
    id: 'comm-analytics',
    label: 'Comm Analytics',
    icon: <Brain size={20} />,
    description: 'Communication analysis',
    category: 'visualizations'
  }
];

const categories = {
  main: 'Core Features',
  analysis: 'Analysis',
  visualizations: 'Visualizations'
};

export function MobileNavigation({ currentView, onViewChange, isConnected, selectedSessionTitle }: MobileNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('main');

  // Close menu when view changes
  useEffect(() => {
    setIsOpen(false);
  }, [currentView]);

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const currentItem = navigationItems.find(item => item.id === currentView);

  const groupedItems = navigationItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, NavigationItem[]>);

  return (
    <>
      {/* Mobile Header with Hamburger */}
      <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={() => setIsOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation"
              aria-label="Open navigation menu"
            >
              <Menu size={20} className="text-gray-700" />
            </button>
            
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {currentItem?.icon}
                <h1 className="font-semibold text-gray-900 truncate text-sm">
                  {currentItem?.label || 'Monitor'}
                </h1>
              </div>
              
              {selectedSessionTitle && (
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {selectedSessionTitle}
                </p>
              )}
            </div>
          </div>
          
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs shrink-0 ${
            isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span className="hidden xs:inline">{isConnected ? 'Live' : 'Offline'}</span>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Slide-out Menu */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-xl z-50 overflow-hidden flex flex-col"
            >
              {/* Menu Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Monitor size={24} />
                    <div>
                      <h2 className="font-semibold text-lg">Navigation</h2>
                      <p className="text-blue-100 text-sm">Dual-Agent Monitor</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
                    aria-label="Close navigation menu"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Category Tabs */}
              <div className="flex border-b border-gray-200 bg-gray-50">
                {Object.entries(categories).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setActiveCategory(key)}
                    className={cn(
                      'flex-1 px-3 py-2 text-xs font-medium transition-colors',
                      activeCategory === key
                        ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Navigation Items */}
              <div className="flex-1 overflow-y-auto py-2">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeCategory}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-1 px-3"
                  >
                    {groupedItems[activeCategory]?.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => onViewChange(item.id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all touch-manipulation',
                          'hover:bg-gray-50 active:bg-gray-100 active:scale-[0.98]',
                          currentView === item.id
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'text-gray-700 hover:text-gray-900'
                        )}
                      >
                        <div className={cn(
                          'p-2 rounded-lg',
                          currentView === item.id
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-gray-100 text-gray-600'
                        )}>
                          {item.icon}
                        </div>
                        <div className="text-left min-w-0 flex-1">
                          <div className="font-medium text-sm">{item.label}</div>
                          <div className="text-xs opacity-70 truncate">
                            {item.description}
                          </div>
                        </div>
                        {currentView === item.id && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        )}
                      </button>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Menu Footer */}
              <div className="border-t border-gray-200 p-4 bg-gray-50">
                <div className="text-xs text-gray-500 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full ${
                      isConnected ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <span>{isConnected ? 'Connected to server' : 'Disconnected'}</span>
                  </div>
                  <div>Tap outside to close</div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}