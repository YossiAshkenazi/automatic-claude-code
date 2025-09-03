import React, { memo, useState } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  Minimize2, 
  RotateCcw, 
  Layout, 
  Filter, 
  Play, 
  Pause, 
  Square, 
  RefreshCw,
  Settings,
  Eye,
  EyeOff,
  Grid,
  Layers,
  Download
} from 'lucide-react';

interface WorkflowControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onReset: () => void;
  onAutoLayout: () => void;
  onRefresh: () => void;
  onExport?: () => void;
  isPlaying?: boolean;
  onPlayPause?: () => void;
  onStop?: () => void;
  showFilters?: boolean;
  onToggleFilters?: () => void;
  showMinimap?: boolean;
  onToggleMinimap?: () => void;
  showGrid?: boolean;
  onToggleGrid?: () => void;
  className?: string;
  filters?: {
    showCompleted: boolean;
    showPending: boolean;
    showInProgress: boolean;
    showFailed: boolean;
    agentFilter: 'all' | 'manager' | 'worker';
    timeRange: 'all' | '1h' | '24h' | '7d';
  };
  onFilterChange?: (filters: any) => void;
}

const WorkflowControls = memo<WorkflowControlsProps>(({ 
  onZoomIn,
  onZoomOut,
  onFitView,
  onReset,
  onAutoLayout,
  onRefresh,
  onExport,
  isPlaying = false,
  onPlayPause,
  onStop,
  showFilters = false,
  onToggleFilters,
  showMinimap = true,
  onToggleMinimap,
  showGrid = false,
  onToggleGrid,
  className = '',
  filters,
  onFilterChange
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const handleFilterChange = (key: string, value: any) => {
    if (filters && onFilterChange) {
      onFilterChange({
        ...filters,
        [key]: value
      });
    }
  };

  return (
    <>
      {/* Main Controls Bar */}
      <div className={`
        absolute top-4 right-4 z-10 bg-white rounded-lg shadow-lg border border-gray-200 p-2
        ${className}
      `}>
        <div className="flex items-center gap-1">
          {/* Playback Controls */}
          {(onPlayPause || onStop) && (
            <div className="flex items-center gap-1 mr-2 pr-2 border-r border-gray-200">
              {onPlayPause && (
                <button
                  onClick={onPlayPause}
                  className={`
                    p-2 rounded-lg transition-colors
                    ${isPlaying 
                      ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' 
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }
                  `}
                  title={isPlaying ? 'Pause workflow' : 'Resume workflow'}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
              )}
              {onStop && (
                <button
                  onClick={onStop}
                  className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                  title="Stop workflow"
                >
                  <Square className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
          
          {/* View Controls */}
          <div className="flex items-center gap-1 mr-2 pr-2 border-r border-gray-200">
            <button
              onClick={onZoomIn}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={onZoomOut}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={onFitView}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Fit to view"
            >
              <Maximize className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          
          {/* Layout Controls */}
          <div className="flex items-center gap-1 mr-2 pr-2 border-r border-gray-200">
            <button
              onClick={onAutoLayout}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Auto layout"
            >
              <Layout className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={onReset}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Reset view"
            >
              <RotateCcw className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          
          {/* Display Options */}
          <div className="flex items-center gap-1 mr-2 pr-2 border-r border-gray-200">
            {onToggleMinimap && (
              <button
                onClick={onToggleMinimap}
                className={`
                  p-2 rounded-lg transition-colors
                  ${showMinimap 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'hover:bg-gray-100 text-gray-600'
                  }
                `}
                title={showMinimap ? 'Hide minimap' : 'Show minimap'}
              >
                <Layers className="w-4 h-4" />
              </button>
            )}
            {onToggleGrid && (
              <button
                onClick={onToggleGrid}
                className={`
                  p-2 rounded-lg transition-colors
                  ${showGrid 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'hover:bg-gray-100 text-gray-600'
                  }
                `}
                title={showGrid ? 'Hide grid' : 'Show grid'}
              >
                <Grid className="w-4 h-4" />
              </button>
            )}
            {onToggleFilters && (
              <button
                onClick={() => {
                  onToggleFilters();
                  setShowFilterPanel(!showFilterPanel);
                }}
                className={`
                  p-2 rounded-lg transition-colors
                  ${showFilters 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'hover:bg-gray-100 text-gray-600'
                  }
                `}
                title="Toggle filters"
              >
                <Filter className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Action Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={onRefresh}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Refresh workflow"
            >
              <RefreshCw className="w-4 h-4 text-gray-600" />
            </button>
            {onExport && (
              <button
                onClick={onExport}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Export workflow"
              >
                <Download className="w-4 h-4 text-gray-600" />
              </button>
            )}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`
                p-2 rounded-lg transition-colors
                ${showAdvanced 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'hover:bg-gray-100 text-gray-600'
                }
              `}
              title="Advanced settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Filter Panel */}
      {showFilterPanel && filters && onFilterChange && (
        <div className="absolute top-20 right-4 z-20 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-64">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">Filters</h3>
            <button
              onClick={() => setShowFilterPanel(false)}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <Minimize2 className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          
          {/* Status Filters */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Status</h4>
            <div className="space-y-2">
              {[
                { key: 'showPending', label: 'Pending', color: 'gray' },
                { key: 'showInProgress', label: 'In Progress', color: 'blue' },
                { key: 'showCompleted', label: 'Completed', color: 'green' },
                { key: 'showFailed', label: 'Failed', color: 'red' }
              ].map(({ key, label, color }) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={filters[key as keyof typeof filters] as boolean}
                    onChange={(e) => handleFilterChange(key, e.target.checked)}
                    className={`rounded border-${color}-300 text-${color}-600 focus:ring-${color}-500`}
                  />
                  <span className="text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>
          
          {/* Agent Filter */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Agent</h4>
            <select
              value={filters.agentFilter}
              onChange={(e) => handleFilterChange('agentFilter', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Agents</option>
              <option value="manager">Manager Only</option>
              <option value="worker">Worker Only</option>
            </select>
          </div>
          
          {/* Time Range Filter */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Time Range</h4>
            <select
              value={filters.timeRange}
              onChange={(e) => handleFilterChange('timeRange', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Time</option>
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
            </select>
          </div>
          
          {/* Reset Filters */}
          <button
            onClick={() => {
              onFilterChange({
                showCompleted: true,
                showPending: true,
                showInProgress: true,
                showFailed: true,
                agentFilter: 'all',
                timeRange: 'all'
              });
            }}
            className="w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors"
          >
            Reset Filters
          </button>
        </div>
      )}
      
      {/* Advanced Settings Panel */}
      {showAdvanced && (
        <div className="absolute top-20 right-4 z-20 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-72">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">Advanced Settings</h3>
            <button
              onClick={() => setShowAdvanced(false)}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <Minimize2 className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          
          <div className="space-y-4 text-sm">
            <div>
              <label className="block text-gray-700 font-medium mb-1">Animation Speed</label>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.5"
                defaultValue="1"
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Slow</span>
                <span>Normal</span>
                <span>Fast</span>
              </div>
            </div>
            
            <div>
              <label className="block text-gray-700 font-medium mb-1">Node Spacing</label>
              <input
                type="range"
                min="50"
                max="200"
                step="25"
                defaultValue="100"
                className="w-full"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Auto-arrange nodes</span>
              <input
                type="checkbox"
                defaultChecked={true}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Show performance metrics</span>
              <input
                type="checkbox"
                defaultChecked={true}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Enable drag & drop</span>
              <input
                type="checkbox"
                defaultChecked={true}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
});

WorkflowControls.displayName = 'WorkflowControls';

export { WorkflowControls };