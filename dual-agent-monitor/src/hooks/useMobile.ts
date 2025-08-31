import { useState, useEffect, useCallback, useRef } from 'react';

interface MobileState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
  orientation: 'portrait' | 'landscape';
  viewportHeight: number;
  viewportWidth: number;
  safeAreaInsets: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

interface TouchGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onPinch?: (scale: number) => void;
  onTap?: (event: TouchEvent) => void;
  onLongPress?: (event: TouchEvent) => void;
  threshold?: number;
  longPressDelay?: number;
}

interface TouchState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  startTime: number;
  initialDistance: number;
}

export function useMobile(): MobileState {
  const [mobileState, setMobileState] = useState<MobileState>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isTouchDevice: false,
    orientation: 'landscape',
    viewportHeight: window.innerHeight,
    viewportWidth: window.innerWidth,
    safeAreaInsets: {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0
    }
  });

  const updateMobileState = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;
    const isDesktop = width >= 1024;
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const orientation = height > width ? 'portrait' : 'landscape';

    // Get safe area insets (for devices with notches)
    const computedStyle = getComputedStyle(document.documentElement);
    const safeAreaInsets = {
      top: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-top)')) || 0,
      bottom: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-bottom)')) || 0,
      left: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-left)')) || 0,
      right: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-right)')) || 0
    };

    setMobileState({
      isMobile,
      isTablet,
      isDesktop,
      isTouchDevice,
      orientation,
      viewportHeight: height,
      viewportWidth: width,
      safeAreaInsets
    });
  }, []);

  useEffect(() => {
    updateMobileState();

    const handleResize = () => updateMobileState();
    const handleOrientationChange = () => {
      // Small delay to ensure viewport dimensions are updated
      setTimeout(updateMobileState, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [updateMobileState]);

  return mobileState;
}

export function useTouchGestures(
  elementRef: React.RefObject<HTMLElement>,
  options: TouchGestureOptions = {}
) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onPinch,
    onTap,
    onLongPress,
    threshold = 50,
    longPressDelay = 500
  } = options;

  const touchState = useRef<TouchState | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isPinching = useRef(false);

  const calculateDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((event: TouchEvent) => {
    const touch = event.touches[0];
    const now = Date.now();

    if (event.touches.length === 1) {
      // Single touch
      touchState.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        currentY: touch.clientY,
        startTime: now,
        initialDistance: 0
      };

      // Start long press timer
      if (onLongPress) {
        longPressTimer.current = setTimeout(() => {
          if (touchState.current) {
            onLongPress(event);
          }
        }, longPressDelay);
      }
    } else if (event.touches.length === 2 && onPinch) {
      // Two finger touch (pinch)
      isPinching.current = true;
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const distance = calculateDistance(touch1, touch2);
      
      touchState.current = {
        startX: (touch1.clientX + touch2.clientX) / 2,
        startY: (touch1.clientY + touch2.clientY) / 2,
        currentX: (touch1.clientX + touch2.clientX) / 2,
        currentY: (touch1.clientY + touch2.clientY) / 2,
        startTime: now,
        initialDistance: distance
      };
    }
  }, [onLongPress, longPressDelay]);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (!touchState.current) return;

    // Clear long press timer on move
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (event.touches.length === 1) {
      // Single touch move
      const touch = event.touches[0];
      touchState.current.currentX = touch.clientX;
      touchState.current.currentY = touch.clientY;
    } else if (event.touches.length === 2 && onPinch && isPinching.current) {
      // Two finger move (pinch)
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const currentDistance = calculateDistance(touch1, touch2);
      
      if (touchState.current.initialDistance > 0) {
        const scale = currentDistance / touchState.current.initialDistance;
        onPinch(scale);
      }
    }
  }, [onPinch]);

  const handleTouchEnd = useCallback((event: TouchEvent) => {
    // Clear long press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (!touchState.current || isPinching.current) {
      isPinching.current = false;
      touchState.current = null;
      return;
    }

    const { startX, startY, currentX, currentY, startTime } = touchState.current;
    const deltaX = currentX - startX;
    const deltaY = currentY - startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const duration = Date.now() - startTime;

    // Check for tap (short touch with minimal movement)
    if (distance < 10 && duration < 300 && onTap) {
      onTap(event);
    }
    // Check for swipe gestures
    else if (distance > threshold) {
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      if (absDeltaX > absDeltaY) {
        // Horizontal swipe
        if (deltaX > 0 && onSwipeRight) {
          onSwipeRight();
        } else if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft();
        }
      } else {
        // Vertical swipe
        if (deltaY > 0 && onSwipeDown) {
          onSwipeDown();
        } else if (deltaY < 0 && onSwipeUp) {
          onSwipeUp();
        }
      }
    }

    touchState.current = null;
  }, [threshold, onTap, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const options = { passive: false };
    
    element.addEventListener('touchstart', handleTouchStart, options);
    element.addEventListener('touchmove', handleTouchMove, options);
    element.addEventListener('touchend', handleTouchEnd, options);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, [elementRef, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    isGestureActive: touchState.current !== null,
    isPinching: isPinching.current
  };
}

// Hook for pull-to-refresh functionality
export function usePullToRefresh(
  containerRef: React.RefObject<HTMLElement>,
  onRefresh: () => Promise<void> | void,
  options: {
    threshold?: number;
    resistance?: number;
    enabled?: boolean;
  } = {}
) {
  const { threshold = 80, resistance = 0.5, enabled = true } = options;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [canPull, setCanPull] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);

  const handleTouchStart = useCallback((event: TouchEvent) => {
    if (!enabled || isRefreshing) return;
    
    const container = containerRef.current;
    if (!container) return;

    // Only allow pull-to-refresh when at the top
    setCanPull(container.scrollTop === 0);
    
    if (canPull) {
      startY.current = event.touches[0].clientY;
    }
  }, [enabled, isRefreshing, canPull, containerRef]);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (!enabled || isRefreshing || !canPull) return;

    currentY.current = event.touches[0].clientY;
    const distance = currentY.current - startY.current;

    if (distance > 0) {
      event.preventDefault();
      const pullValue = Math.min(distance * resistance, threshold * 1.5);
      setPullDistance(pullValue);
    }
  }, [enabled, isRefreshing, canPull, resistance, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!enabled || isRefreshing || !canPull) {
      setPullDistance(0);
      return;
    }

    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    
    setPullDistance(0);
  }, [enabled, isRefreshing, canPull, pullDistance, threshold, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const options = { passive: false };
    
    container.addEventListener('touchstart', handleTouchStart, options);
    container.addEventListener('touchmove', handleTouchMove, options);
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [containerRef, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    isRefreshing,
    pullDistance,
    canPull: canPull && pullDistance > 0
  };
}

// Hook for managing viewport orientation and safe areas
export function useViewport() {
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
    orientation: window.innerHeight > window.innerWidth ? 'portrait' : 'landscape' as 'portrait' | 'landscape',
    isLandscape: window.innerWidth > window.innerHeight,
    isPortrait: window.innerHeight > window.innerWidth
  });

  useEffect(() => {
    const updateViewport = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isLandscape = width > height;
      const isPortrait = height > width;
      const orientation = isPortrait ? 'portrait' : 'landscape';

      setViewport({
        width,
        height,
        orientation,
        isLandscape,
        isPortrait
      });
    };

    const handleResize = () => updateViewport();
    const handleOrientationChange = () => {
      // Delay to ensure dimensions are updated
      setTimeout(updateViewport, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  return viewport;
}