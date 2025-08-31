import React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { GripVertical } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ResizablePanelsProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  defaultSizes?: [number, number];
  minSizes?: [number, number];
  className?: string;
}

export function ResizablePanels({
  leftPanel,
  rightPanel,
  defaultSizes = [50, 50],
  minSizes = [25, 25],
  className,
}: ResizablePanelsProps) {
  return (
    <div className={cn('h-full', className)}>
      <PanelGroup direction="horizontal">
        <Panel defaultSize={defaultSizes[0]} minSize={minSizes[0]}>
          {leftPanel}
        </Panel>
        
        <PanelResizeHandle className="flex items-center justify-center w-2 bg-border hover:bg-ring transition-colors group">
          <div className="flex items-center justify-center h-8 w-1 bg-muted-foreground/20 rounded-full group-hover:bg-muted-foreground/40 transition-colors">
            <GripVertical className="h-4 w-4 text-muted-foreground/50" />
          </div>
        </PanelResizeHandle>
        
        <Panel defaultSize={defaultSizes[1]} minSize={minSizes[1]}>
          {rightPanel}
        </Panel>
      </PanelGroup>
    </div>
  );
}

interface VerticalResizablePanelsProps {
  topPanel: React.ReactNode;
  bottomPanel: React.ReactNode;
  defaultSizes?: [number, number];
  minSizes?: [number, number];
  className?: string;
}

export function VerticalResizablePanels({
  topPanel,
  bottomPanel,
  defaultSizes = [60, 40],
  minSizes = [20, 20],
  className,
}: VerticalResizablePanelsProps) {
  return (
    <div className={cn('h-full', className)}>
      <PanelGroup direction="vertical">
        <Panel defaultSize={defaultSizes[0]} minSize={minSizes[0]}>
          {topPanel}
        </Panel>
        
        <PanelResizeHandle className="flex items-center justify-center h-2 bg-border hover:bg-ring transition-colors group">
          <div className="flex items-center justify-center w-8 h-1 bg-muted-foreground/20 rounded-full group-hover:bg-muted-foreground/40 transition-colors" />
        </PanelResizeHandle>
        
        <Panel defaultSize={defaultSizes[1]} minSize={minSizes[1]}>
          {bottomPanel}
        </Panel>
      </PanelGroup>
    </div>
  );
}