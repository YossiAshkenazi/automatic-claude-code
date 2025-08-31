import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMobile, usePullToRefresh, useViewport } from '../../hooks/useMobile';
import { MobileNavigation } from '../mobile';
import { cn } from '../../lib/utils';
import { RefreshCw } from 'lucide-react';

type ViewMode = 'cross-project' | 'sessions' | 'dual-pane' | 'timeline' | 'analytics' | 'message-flow' | 'comm-timeline' | 'agent-activity' | 'comm-analytics' | 'metrics';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  isConnected: boolean;
  selectedSessionTitle?: string;
  onRefresh?: () => Promise<void> | void;
  showHeader?: boolean;
  className?: string;
}

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  threshold: number;
  isRefreshing: boolean;
}

function PullToRefreshIndicator({ pullDistance, threshold, isRefreshing }: PullToRefreshIndicatorProps) {
  const progress = Math.min(pullDistance / threshold, 1);
  const rotation = progress * 360;
  
  return (
    <AnimatePresence>
      {(pullDistance > 0 || isRefreshing) && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="absolute top-0 left-0 right-0 flex items-center justify-center py-4 bg-gradient-to-b from-blue-50 to-transparent z-30"
        >
          <div className="flex items-center gap-2 text-blue-600">
            <motion.div
              animate={{ rotate: isRefreshing ? 360 : rotation }}
              transition={{
                duration: isRefreshing ? 1 : 0,
                repeat: isRefreshing ? Infinity : 0,
                ease: "linear"
              }}
            >
              <RefreshCw size={20} />
            </motion.div>
            <span className="text-sm font-medium">
              {isRefreshing ? 'Refreshing...' : 
               progress >= 1 ? 'Release to refresh' : 'Pull to refresh'}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ResponsiveLayout({
  children,
  currentView,
  onViewChange,
  isConnected,
  selectedSessionTitle,
  onRefresh,
  showHeader = true,
  className
}: ResponsiveLayoutProps) {
  const mobile = useMobile();
  const viewport = useViewport();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { isRefreshing, pullDistance } = usePullToRefresh(
    containerRef,
    onRefresh || (() => {}),
    {
      enabled: mobile.isMobile && !!onRefresh,
      threshold: 80,
      resistance: 0.6
    }
  );

  // Mobile layout
  if (mobile.isMobile) {
    return (
      <div className={cn(
        "min-h-screen bg-gray-50 flex flex-col touch-manipulation",
        "pb-safe", // Safe area padding for devices with home indicator
        className
      )}>
        {/* Mobile Navigation */}
        {showHeader && (
          <MobileNavigation
            currentView={currentView}
            onViewChange={onViewChange}
            isConnected={isConnected}
            selectedSessionTitle={selectedSessionTitle}
          />
        )}

        {/* Main Content with Pull-to-Refresh */}
        <motion.div
          ref={containerRef}
          className="flex-1 relative overflow-y-auto overscroll-y-contain"
          style={{
            transform: pullDistance > 0 ? `translateY(${Math.min(pullDistance * 0.5, 40)}px)` : undefined,
            transition: pullDistance === 0 ? 'transform 0.3s ease-out' : 'none'
          }}
        >
          <PullToRefreshIndicator
            pullDistance={pullDistance}
            threshold={80}
            isRefreshing={isRefreshing}
          />
          
          <motion.div
            key={currentView}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="min-h-full"
          >
            {children}
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // Tablet layout
  if (mobile.isTablet) {
    return (
      <div className={cn(
        "min-h-screen bg-gray-50 flex flex-col",
        className
      )}>
        {/* Tablet Header */}
        {showHeader && (
          <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h1 className="text-xl font-semibold text-gray-900">
                  Dual-Agent Monitor
                </h1>
                <div className={cn(
                  "flex items-center gap-2 px-3 py-1 rounded-full text-sm",
                  isConnected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                )}>
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    isConnected ? "bg-green-500" : "bg-red-500"
                  )} />
                  {isConnected ? 'Connected' : 'Disconnected'}
                </div>
              </div>
              
              <div className="text-sm text-gray-500">
                {selectedSessionTitle && (
                  <span className="truncate max-w-xs">{selectedSessionTitle}</span>
                )}
              </div>
            </div>
            
            {/* Tablet Navigation */}
            <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-2">
              {[
                { id: 'cross-project', label: 'All Projects' },
                { id: 'sessions', label: 'Sessions' },
                { id: 'dual-pane', label: 'Dual Pane' },
                { id: 'timeline', label: 'Timeline' },
                { id: 'analytics', label: 'Analytics' },
                { id: 'message-flow', label: 'Message Flow' },
                { id: 'comm-timeline', label: 'Communication' },
                { id: 'agent-activity', label: 'Activity' },
                { id: 'comm-analytics', label: 'Comm Analytics' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id as ViewMode)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                    currentView === item.id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tablet Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </div>
      </div>
    );
  }

  // Desktop layout (existing layout)
  return (
    <div className={cn(
      "min-h-screen bg-gray-50 flex flex-col",
      className
    )}>
      {children}
    </div>
  );
}

// Responsive grid component for mobile-optimized layouts
interface ResponsiveGridProps {
  children: React.ReactNode;
  className?: string;
  cols?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  gap?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
}

export function ResponsiveGrid({ 
  children, 
  className, 
  cols = { mobile: 1, tablet: 2, desktop: 3 },
  gap = { mobile: 3, tablet: 4, desktop: 6 }
}: ResponsiveGridProps) {
  const mobile = useMobile();
  
  const gridCols = mobile.isMobile ? cols.mobile : mobile.isTablet ? cols.tablet : cols.desktop;
  const gridGap = mobile.isMobile ? gap.mobile : mobile.isTablet ? gap.tablet : gap.desktop;
  
  return (
    <div 
      className={cn(
        "grid",
        `grid-cols-${gridCols}`,
        `gap-${gridGap}`,
        className
      )}
    >
      {children}
    </div>
  );
}

// Responsive card component optimized for touch interaction
interface ResponsiveCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  pressable?: boolean;
  elevated?: boolean;
}

export function ResponsiveCard({ 
  children, 
  className, 
  onClick, 
  pressable = false,
  elevated = false 
}: ResponsiveCardProps) {
  const mobile = useMobile();
  
  return (
    <motion.div
      className={cn(
        "bg-white rounded-xl border border-gray-200 transition-all duration-200",
        mobile.isMobile ? "p-4" : "p-6",
        elevated && (mobile.isMobile ? "shadow-mobile" : "shadow-lg"),
        pressable && (
          mobile.isTouchDevice 
            ? "active:scale-[0.98] active:bg-gray-50" 
            : "hover:shadow-lg hover:border-gray-300"
        ),
        onClick && "cursor-pointer",
        mobile.isTouchDevice && onClick && "min-h-touch", // Ensure minimum touch target size
        className
      )}
      onClick={onClick}
      whileTap={pressable ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.1 }}
    >
      {children}
    </motion.div>
  );
}

// Mobile-optimized bottom navigation
interface BottomNavigationProps {
  items: {
    id: string;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[];
  activeItem: string;
  onItemSelect: (id: string) => void;
  className?: string;
}

export function BottomNavigation({ 
  items, 
  activeItem, 
  onItemSelect, 
  className 
}: BottomNavigationProps) {
  const mobile = useMobile();
  
  if (!mobile.isMobile) return null;
  
  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40",
      "pb-safe", // Safe area padding
      className
    )}>
      <div className="grid grid-cols-5 gap-1 px-2 py-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onItemSelect(item.id)}
            className={cn(
              "flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-colors min-h-touch",
              activeItem === item.id
                ? "bg-blue-50 text-blue-600"
                : "text-gray-600 hover:bg-gray-50"
            )}
          >
            <div className="relative">
              {item.icon}
              {item.badge && item.badge > 0 && (
                <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                  {item.badge > 99 ? '99+' : item.badge}
                </div>
              )}
            </div>
            <span className="text-xs font-medium mt-1 truncate max-w-full">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}