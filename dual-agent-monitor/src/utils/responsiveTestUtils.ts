// Responsive Design Testing Utilities

export interface ViewportConfig {
  width: number;
  height: number;
  dpr: number; // Device Pixel Ratio
  name: string;
  category: 'mobile' | 'tablet' | 'desktop';
  orientation?: 'portrait' | 'landscape';
}

// Common device viewports for testing
export const DEVICE_VIEWPORTS: Record<string, ViewportConfig> = {
  // Mobile Devices
  'iphone-se': {
    width: 375,
    height: 667,
    dpr: 2,
    name: 'iPhone SE',
    category: 'mobile',
    orientation: 'portrait'
  },
  'iphone-12': {
    width: 390,
    height: 844,
    dpr: 3,
    name: 'iPhone 12/13/14',
    category: 'mobile',
    orientation: 'portrait'
  },
  'iphone-12-landscape': {
    width: 844,
    height: 390,
    dpr: 3,
    name: 'iPhone 12 Landscape',
    category: 'mobile',
    orientation: 'landscape'
  },
  'iphone-14-pro-max': {
    width: 430,
    height: 932,
    dpr: 3,
    name: 'iPhone 14 Pro Max',
    category: 'mobile',
    orientation: 'portrait'
  },
  'pixel-5': {
    width: 393,
    height: 851,
    dpr: 2.75,
    name: 'Google Pixel 5',
    category: 'mobile',
    orientation: 'portrait'
  },
  'samsung-s21': {
    width: 360,
    height: 800,
    dpr: 3,
    name: 'Samsung Galaxy S21',
    category: 'mobile',
    orientation: 'portrait'
  },
  
  // Tablets
  'ipad-mini': {
    width: 768,
    height: 1024,
    dpr: 2,
    name: 'iPad Mini',
    category: 'tablet',
    orientation: 'portrait'
  },
  'ipad-air': {
    width: 820,
    height: 1180,
    dpr: 2,
    name: 'iPad Air',
    category: 'tablet',
    orientation: 'portrait'
  },
  'ipad-pro': {
    width: 1024,
    height: 1366,
    dpr: 2,
    name: 'iPad Pro 12.9"',
    category: 'tablet',
    orientation: 'portrait'
  },
  'ipad-landscape': {
    width: 1024,
    height: 768,
    dpr: 2,
    name: 'iPad Landscape',
    category: 'tablet',
    orientation: 'landscape'
  },
  
  // Desktop
  'laptop-sm': {
    width: 1280,
    height: 800,
    dpr: 1,
    name: 'Small Laptop',
    category: 'desktop'
  },
  'laptop-md': {
    width: 1440,
    height: 900,
    dpr: 1,
    name: 'Medium Laptop',
    category: 'desktop'
  },
  'desktop-hd': {
    width: 1920,
    height: 1080,
    dpr: 1,
    name: 'Desktop HD',
    category: 'desktop'
  },
  'desktop-4k': {
    width: 3840,
    height: 2160,
    dpr: 2,
    name: 'Desktop 4K',
    category: 'desktop'
  }
};

// Breakpoints matching Tailwind CSS
export const BREAKPOINTS = {
  xs: 475,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536
};

// Touch target sizes (iOS and Material Design guidelines)
export const TOUCH_TARGETS = {
  minimum: 44, // iOS minimum
  recommended: 48, // Material Design
  comfortable: 56 // Comfortable for most users
};

// Responsive testing utilities
export class ResponsiveTestUtils {
  private static currentViewport: ViewportConfig | null = null;
  private static observers: ResizeObserver[] = [];
  
  // Set viewport for testing
  static setViewport(config: ViewportConfig): void {
    this.currentViewport = config;
    
    if (typeof window !== 'undefined') {
      // Set viewport dimensions
      if (window.innerWidth !== config.width || window.innerHeight !== config.height) {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: config.width
        });
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: config.height
        });
        
        // Trigger resize event
        window.dispatchEvent(new Event('resize'));
      }
      
      // Set device pixel ratio
      Object.defineProperty(window, 'devicePixelRatio', {
        writable: true,
        configurable: true,
        value: config.dpr
      });
      
      // Set user agent for mobile detection (simplified)
      if (config.category === 'mobile') {
        Object.defineProperty(navigator, 'userAgent', {
          writable: true,
          configurable: true,
          value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
        });
      }
    }
  }
  
  // Get current viewport
  static getCurrentViewport(): ViewportConfig | null {
    return this.currentViewport;
  }
  
  // Test component at different viewports
  static async testAtViewports(
    viewports: ViewportConfig[],
    testFn: (viewport: ViewportConfig) => Promise<void> | void
  ): Promise<void> {
    for (const viewport of viewports) {
      console.log(`Testing at viewport: ${viewport.name} (${viewport.width}x${viewport.height})`);
      this.setViewport(viewport);
      await testFn(viewport);
    }
  }
  
  // Check if element meets touch target guidelines
  static checkTouchTarget(element: HTMLElement): {
    width: number;
    height: number;
    meetsMinimum: boolean;
    meetsRecommended: boolean;
    meetsComfortable: boolean;
  } {
    const rect = element.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    return {
      width,
      height,
      meetsMinimum: width >= TOUCH_TARGETS.minimum && height >= TOUCH_TARGETS.minimum,
      meetsRecommended: width >= TOUCH_TARGETS.recommended && height >= TOUCH_TARGETS.recommended,
      meetsComfortable: width >= TOUCH_TARGETS.comfortable && height >= TOUCH_TARGETS.comfortable
    };
  }
  
  // Check element visibility and accessibility
  static checkAccessibility(element: HTMLElement): {
    isVisible: boolean;
    hasAriaLabel: boolean;
    hasProperRole: boolean;
    isKeyboardAccessible: boolean;
    contrastRatio?: number;
  } {
    const computedStyle = window.getComputedStyle(element);
    const isVisible = computedStyle.display !== 'none' && 
                     computedStyle.visibility !== 'hidden' && 
                     computedStyle.opacity !== '0';
    
    const hasAriaLabel = element.hasAttribute('aria-label') || 
                        element.hasAttribute('aria-labelledby');
    
    const hasProperRole = element.hasAttribute('role') || 
                         element.tagName.toLowerCase() === 'button' ||
                         element.tagName.toLowerCase() === 'a';
    
    const isKeyboardAccessible = element.tabIndex >= 0 || 
                               ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName);
    
    return {
      isVisible,
      hasAriaLabel,
      hasProperRole,
      isKeyboardAccessible
    };
  }
  
  // Simulate touch events
  static simulateTouch(element: HTMLElement, type: 'tap' | 'swipe' | 'pinch', options: any = {}): void {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    switch (type) {
      case 'tap':
        this.simulateTouchTap(element, centerX, centerY);
        break;
      case 'swipe':
        this.simulateTouchSwipe(element, options.direction || 'left', options.distance || 100);
        break;
      case 'pinch':
        this.simulateTouchPinch(element, options.scale || 1.5);
        break;
    }
  }
  
  private static simulateTouchTap(element: HTMLElement, x: number, y: number): void {
    const touchStart = new TouchEvent('touchstart', {
      touches: [new Touch({
        identifier: 1,
        target: element,
        clientX: x,
        clientY: y
      })]
    });
    
    const touchEnd = new TouchEvent('touchend', {
      changedTouches: [new Touch({
        identifier: 1,
        target: element,
        clientX: x,
        clientY: y
      })]
    });
    
    element.dispatchEvent(touchStart);
    setTimeout(() => element.dispatchEvent(touchEnd), 100);
  }
  
  private static simulateTouchSwipe(element: HTMLElement, direction: string, distance: number): void {
    const rect = element.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    
    let endX = startX;
    let endY = startY;
    
    switch (direction) {
      case 'left':
        endX = startX - distance;
        break;
      case 'right':
        endX = startX + distance;
        break;
      case 'up':
        endY = startY - distance;
        break;
      case 'down':
        endY = startY + distance;
        break;
    }
    
    const touchStart = new TouchEvent('touchstart', {
      touches: [new Touch({
        identifier: 1,
        target: element,
        clientX: startX,
        clientY: startY
      })]
    });
    
    const touchMove = new TouchEvent('touchmove', {
      touches: [new Touch({
        identifier: 1,
        target: element,
        clientX: endX,
        clientY: endY
      })]
    });
    
    const touchEnd = new TouchEvent('touchend', {
      changedTouches: [new Touch({
        identifier: 1,
        target: element,
        clientX: endX,
        clientY: endY
      })]
    });
    
    element.dispatchEvent(touchStart);
    setTimeout(() => element.dispatchEvent(touchMove), 50);
    setTimeout(() => element.dispatchEvent(touchEnd), 200);
  }
  
  private static simulateTouchPinch(element: HTMLElement, scale: number): void {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const distance = 100;
    const newDistance = distance * scale;
    
    const touch1Start = new Touch({
      identifier: 1,
      target: element,
      clientX: centerX - distance / 2,
      clientY: centerY
    });
    
    const touch2Start = new Touch({
      identifier: 2,
      target: element,
      clientX: centerX + distance / 2,
      clientY: centerY
    });
    
    const touchStart = new TouchEvent('touchstart', {
      touches: [touch1Start, touch2Start]
    });
    
    const touch1End = new Touch({
      identifier: 1,
      target: element,
      clientX: centerX - newDistance / 2,
      clientY: centerY
    });
    
    const touch2End = new Touch({
      identifier: 2,
      target: element,
      clientX: centerX + newDistance / 2,
      clientY: centerY
    });
    
    const touchEnd = new TouchEvent('touchend', {
      changedTouches: [touch1End, touch2End]
    });
    
    element.dispatchEvent(touchStart);
    setTimeout(() => element.dispatchEvent(touchEnd), 500);
  }
  
  // Performance testing for mobile
  static measurePerformance(testName: string, fn: () => void): {
    duration: number;
    fps: number;
    memoryUsage?: number;
  } {
    const startTime = performance.now();
    let frameCount = 0;
    
    // Measure FPS during execution
    const measureFPS = () => {
      frameCount++;
      if (performance.now() - startTime < 1000) {
        requestAnimationFrame(measureFPS);
      }
    };
    
    requestAnimationFrame(measureFPS);
    
    // Execute test function
    fn();
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    const fps = frameCount;
    
    const result: any = { duration, fps };
    
    // Memory usage if available
    if ('memory' in performance) {
      result.memoryUsage = (performance as any).memory.usedJSHeapSize;
    }
    
    console.log(`Performance test "${testName}":`, result);
    return result;
  }
  
  // Cleanup observers and reset viewport
  static cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.currentViewport = null;
  }
}

// React hook for responsive testing
export function useResponsiveTesting() {
  const setViewport = (config: ViewportConfig) => {
    ResponsiveTestUtils.setViewport(config);
  };
  
  const testAtViewports = async (
    viewports: ViewportConfig[],
    testFn: (viewport: ViewportConfig) => Promise<void> | void
  ) => {
    await ResponsiveTestUtils.testAtViewports(viewports, testFn);
  };
  
  const getCurrentViewport = () => {
    return ResponsiveTestUtils.getCurrentViewport();
  };
  
  return {
    setViewport,
    testAtViewports,
    getCurrentViewport,
    devices: DEVICE_VIEWPORTS,
    breakpoints: BREAKPOINTS,
    touchTargets: TOUCH_TARGETS
  };
}

// Helper to get all mobile viewports
export function getMobileViewports(): ViewportConfig[] {
  return Object.values(DEVICE_VIEWPORTS).filter(v => v.category === 'mobile');
}

// Helper to get all tablet viewports
export function getTabletViewports(): ViewportConfig[] {
  return Object.values(DEVICE_VIEWPORTS).filter(v => v.category === 'tablet');
}

// Helper to get all desktop viewports
export function getDesktopViewports(): ViewportConfig[] {
  return Object.values(DEVICE_VIEWPORTS).filter(v => v.category === 'desktop');
}

// Generate test cases for common scenarios
export function generateResponsiveTestCases() {
  return {
    mobile: {
      portrait: DEVICE_VIEWPORTS['iphone-12'],
      landscape: DEVICE_VIEWPORTS['iphone-12-landscape'],
      small: DEVICE_VIEWPORTS['iphone-se'],
      large: DEVICE_VIEWPORTS['iphone-14-pro-max']
    },
    tablet: {
      portrait: DEVICE_VIEWPORTS['ipad-air'],
      landscape: DEVICE_VIEWPORTS['ipad-landscape'],
      small: DEVICE_VIEWPORTS['ipad-mini']
    },
    desktop: {
      small: DEVICE_VIEWPORTS['laptop-sm'],
      medium: DEVICE_VIEWPORTS['laptop-md'],
      large: DEVICE_VIEWPORTS['desktop-hd']
    }
  };
}