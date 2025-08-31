import { useState, useEffect, useCallback } from 'react';

interface PWAState {
  isInstallable: boolean;
  isInstalled: boolean;
  isOffline: boolean;
  hasUpdate: boolean;
  isUpdating: boolean;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWA() {
  const [state, setState] = useState<PWAState>({
    isInstallable: false,
    isInstalled: false,
    isOffline: !navigator.onLine,
    hasUpdate: false,
    isUpdating: false
  });
  
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [serviceWorkerRegistration, setServiceWorkerRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Check if app is running as PWA
  const checkIfInstalled = useCallback(() => {
    const isInstalled = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');
    
    setState(prev => ({ ...prev, isInstalled }));
  }, []);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('SW registered:', registration);
          setServiceWorkerRegistration(registration);
          
          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setState(prev => ({ ...prev, hasUpdate: true }));
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('SW registration failed:', error);
        });
    }
  }, []);

  // Handle install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setState(prev => ({ ...prev, isInstallable: true }));
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setState(prev => ({ 
        ...prev, 
        isInstallable: false, 
        isInstalled: true 
      }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => setState(prev => ({ ...prev, isOffline: false }));
    const handleOffline = () => setState(prev => ({ ...prev, isOffline: true }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check installation status
  useEffect(() => {
    checkIfInstalled();
    
    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = () => checkIfInstalled();
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [checkIfInstalled]);

  // Install app
  const installApp = useCallback(async () => {
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('PWA installation accepted');
        return true;
      } else {
        console.log('PWA installation dismissed');
        return false;
      }
    } catch (error) {
      console.error('PWA installation failed:', error);
      return false;
    } finally {
      setDeferredPrompt(null);
      setState(prev => ({ ...prev, isInstallable: false }));
    }
  }, [deferredPrompt]);

  // Update app
  const updateApp = useCallback(async () => {
    if (!serviceWorkerRegistration) return;

    setState(prev => ({ ...prev, isUpdating: true }));
    
    try {
      // Tell the service worker to skip waiting
      if (serviceWorkerRegistration.waiting) {
        serviceWorkerRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      
      // Wait for the new service worker to take control
      await new Promise<void>((resolve) => {
        const handleControllerChange = () => {
          navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
          resolve();
        };
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
      });
      
      // Reload the page to get the latest version
      window.location.reload();
    } catch (error) {
      console.error('App update failed:', error);
      setState(prev => ({ ...prev, isUpdating: false }));
    }
  }, [serviceWorkerRegistration]);

  // Request persistent storage
  const requestPersistentStorage = useCallback(async () => {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      try {
        const persistent = await navigator.storage.persist();
        console.log('Persistent storage:', persistent ? 'granted' : 'denied');
        return persistent;
      } catch (error) {
        console.error('Failed to request persistent storage:', error);
        return false;
      }
    }
    return false;
  }, []);

  // Get storage usage
  const getStorageUsage = useCallback(async () => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          used: estimate.usage || 0,
          available: estimate.quota || 0,
          percentage: estimate.quota ? Math.round((estimate.usage || 0) / estimate.quota * 100) : 0
        };
      } catch (error) {
        console.error('Failed to get storage usage:', error);
        return { used: 0, available: 0, percentage: 0 };
      }
    }
    return { used: 0, available: 0, percentage: 0 };
  }, []);

  // Enable notifications
  const enableNotifications = useCallback(async () => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }, []);

  // Send notification
  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (Notification.permission !== 'granted') {
      console.warn('Notifications not permitted');
      return null;
    }

    try {
      const notification = new Notification(title, {
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        vibrate: [200, 100, 200],
        ...options
      });
      
      return notification;
    } catch (error) {
      console.error('Failed to send notification:', error);
      return null;
    }
  }, []);

  // Share content (Web Share API)
  const shareContent = useCallback(async (data: ShareData) => {
    if (!navigator.share) {
      console.warn('Web Share API not supported');
      return false;
    }

    try {
      await navigator.share(data);
      return true;
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Failed to share:', error);
      }
      return false;
    }
  }, []);

  // Copy to clipboard
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        return success;
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }, []);

  return {
    ...state,
    installApp,
    updateApp,
    requestPersistentStorage,
    getStorageUsage,
    enableNotifications,
    sendNotification,
    shareContent,
    copyToClipboard
  };
}

// Hook for managing offline data
export function useOfflineStorage() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueue, setSyncQueue] = useState<any[]>([]);
  
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Trigger sync when coming back online
      if (syncQueue.length > 0) {
        processSyncQueue();
      }
    };
    
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncQueue]);
  
  const addToSyncQueue = useCallback((action: any) => {
    setSyncQueue(prev => [...prev, { ...action, timestamp: Date.now() }]);
  }, []);
  
  const processSyncQueue = useCallback(async () => {
    if (!isOnline || syncQueue.length === 0) return;
    
    const pendingActions = [...syncQueue];
    setSyncQueue([]);
    
    for (const action of pendingActions) {
      try {
        // Process the action
        await processOfflineAction(action);
        console.log('Synced offline action:', action.type);
      } catch (error) {
        console.error('Failed to sync action:', action.type, error);
        // Add back to queue for retry
        setSyncQueue(prev => [...prev, action]);
      }
    }
  }, [isOnline, syncQueue]);
  
  const storeOfflineData = useCallback(async (key: string, data: any) => {
    try {
      const dataToStore = {
        ...data,
        _offline: true,
        _timestamp: Date.now()
      };
      localStorage.setItem(`offline_${key}`, JSON.stringify(dataToStore));
    } catch (error) {
      console.error('Failed to store offline data:', error);
    }
  }, []);
  
  const getOfflineData = useCallback((key: string) => {
    try {
      const stored = localStorage.getItem(`offline_${key}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to get offline data:', error);
    }
    return null;
  }, []);
  
  const clearOfflineData = useCallback((key: string) => {
    try {
      localStorage.removeItem(`offline_${key}`);
    } catch (error) {
      console.error('Failed to clear offline data:', error);
    }
  }, []);
  
  return {
    isOnline,
    syncQueue: syncQueue.length,
    addToSyncQueue,
    processSyncQueue,
    storeOfflineData,
    getOfflineData,
    clearOfflineData
  };
}

// Helper function to process offline actions
async function processOfflineAction(action: any) {
  switch (action.type) {
    case 'CREATE_SESSION':
      // Implement session creation sync
      break;
    case 'UPDATE_STATUS':
      // Implement status update sync
      break;
    case 'DELETE_SESSION':
      // Implement session deletion sync
      break;
    default:
      console.warn('Unknown offline action type:', action.type);
  }
}