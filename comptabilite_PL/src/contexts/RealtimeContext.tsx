/**
 * Realtime Synchronization Context
 *
 * Provides automatic data synchronization across all connected users.
 * Uses efficient polling with smart invalidation.
 *
 * Usage:
 * 1. Wrap your app with <RealtimeProvider>
 * 2. Use useRealtime() hook to access broadcast/subscribe functions
 * 3. Call broadcast('prospects') when you create/update/delete a prospect
 * 4. Subscribe to updates with useRealtimeSubscription('prospects', callback)
 */

import React, { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';

// Polling interval in milliseconds (5 seconds for responsive updates)
const POLLING_INTERVAL = 5000;

// Data types that support realtime sync
export type RealtimeChannel =
  | 'prospects'
  | 'projects'
  | 'declarations'
  | 'students'
  | 'sessions'
  | 'formations'
  | 'users'
  | 'visits';

interface RealtimeContextType {
  // Notify other clients that data has changed
  broadcast: (channel: RealtimeChannel) => void;
  // Subscribe to changes on a channel
  subscribe: (channel: RealtimeChannel, callback: () => void) => () => void;
  // Check if realtime is enabled
  isEnabled: boolean;
  // Last sync timestamp
  lastSync: Record<RealtimeChannel, number>;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

// Store for pending updates (broadcasted by this client)
const pendingBroadcasts = new Set<RealtimeChannel>();

// Store for subscribers
const subscribers: Record<RealtimeChannel, Set<() => void>> = {
  prospects: new Set(),
  projects: new Set(),
  declarations: new Set(),
  students: new Set(),
  sessions: new Set(),
  formations: new Set(),
  users: new Set(),
  visits: new Set(),
};

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [lastSync, setLastSync] = useState<Record<RealtimeChannel, number>>({
    prospects: 0,
    projects: 0,
    declarations: 0,
    students: 0,
    sessions: 0,
    formations: 0,
    users: 0,
    visits: 0,
  });
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPollingRef = useRef(false);

  // Map channels to their React Query keys
  const getQueryKeys = (channel: RealtimeChannel): string[][] => {
    switch (channel) {
      case 'prospects':
        return [['prospects'], ['prospectsStats']];
      case 'projects':
        return [['projects'], ['project-actions']];
      case 'declarations':
        return [['declarations'], ['calculationSheets']];
      case 'students':
        return [['students'], ['session-etudiants']];
      case 'sessions':
        return [['sessions-formation'], ['sessions']];
      case 'formations':
        return [['formations'], ['corps-formation']];
      case 'users':
        return [['users'], ['profiles']];
      case 'visits':
        return [['visits'], ['prospects']];
      default:
        return [[channel]];
    }
  };

  // Broadcast that data has changed
  const broadcast = useCallback((channel: RealtimeChannel) => {
    console.log(`📡 Broadcasting update: ${channel}`);
    pendingBroadcasts.add(channel);

    // Also immediately invalidate local queries
    const queryKeys = getQueryKeys(channel);
    queryKeys.forEach(key => {
      queryClient.invalidateQueries({ queryKey: key });
    });

    // Notify local subscribers immediately
    subscribers[channel].forEach(callback => {
      try {
        callback();
      } catch (e) {
        console.error('Subscriber callback error:', e);
      }
    });

    // Store broadcast timestamp in localStorage for cross-tab sync
    const now = Date.now();
    const syncData = JSON.parse(localStorage.getItem('realtime_sync') || '{}');
    syncData[channel] = now;
    localStorage.setItem('realtime_sync', JSON.stringify(syncData));

    setLastSync(prev => ({ ...prev, [channel]: now }));
  }, [queryClient]);

  // Subscribe to a channel
  const subscribe = useCallback((channel: RealtimeChannel, callback: () => void) => {
    subscribers[channel].add(callback);
    console.log(`📺 Subscribed to ${channel}, total: ${subscribers[channel].size}`);

    // Return unsubscribe function
    return () => {
      subscribers[channel].delete(callback);
      console.log(`📺 Unsubscribed from ${channel}, remaining: ${subscribers[channel].size}`);
    };
  }, []);

  // Check for updates from other tabs/browsers
  const checkForUpdates = useCallback(() => {
    if (!isAuthenticated || isPollingRef.current) return;

    isPollingRef.current = true;

    try {
      const syncData = JSON.parse(localStorage.getItem('realtime_sync') || '{}');

      Object.entries(syncData).forEach(([channel, timestamp]) => {
        const typedChannel = channel as RealtimeChannel;
        const lastKnown = lastSync[typedChannel] || 0;

        if (typeof timestamp === 'number' && timestamp > lastKnown) {
          console.log(`🔄 Detected update on ${channel} from another source`);

          // Skip if this client broadcasted the update
          if (pendingBroadcasts.has(typedChannel)) {
            pendingBroadcasts.delete(typedChannel);
            setLastSync(prev => ({ ...prev, [typedChannel]: timestamp }));
            return;
          }

          // Invalidate relevant queries
          const queryKeys = getQueryKeys(typedChannel);
          queryKeys.forEach(key => {
            queryClient.invalidateQueries({ queryKey: key });
          });

          // Notify subscribers
          subscribers[typedChannel].forEach(callback => {
            try {
              callback();
            } catch (e) {
              console.error('Subscriber callback error:', e);
            }
          });

          setLastSync(prev => ({ ...prev, [typedChannel]: timestamp }));
        }
      });
    } catch (e) {
      console.error('Error checking for realtime updates:', e);
    } finally {
      isPollingRef.current = false;
    }
  }, [isAuthenticated, lastSync, queryClient]);

  // Set up polling when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Initial check
      checkForUpdates();

      // Start polling
      pollingRef.current = setInterval(checkForUpdates, POLLING_INTERVAL);

      // Also listen for storage events (cross-tab communication)
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === 'realtime_sync') {
          checkForUpdates();
        }
      };
      window.addEventListener('storage', handleStorageChange);

      // Listen for visibility change to refresh when tab becomes visible
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          checkForUpdates();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
        window.removeEventListener('storage', handleStorageChange);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [isAuthenticated, checkForUpdates]);

  return (
    <RealtimeContext.Provider
      value={{
        broadcast,
        subscribe,
        isEnabled: isAuthenticated,
        lastSync,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
};

// Hook to use realtime context
export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
};

// Hook to subscribe to realtime updates
export const useRealtimeSubscription = (
  channel: RealtimeChannel,
  callback: () => void,
  deps: React.DependencyList = []
) => {
  const { subscribe } = useRealtime();

  useEffect(() => {
    const unsubscribe = subscribe(channel, callback);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, subscribe, ...deps]);
};

// Hook to broadcast updates after mutations
export const useBroadcast = () => {
  const { broadcast } = useRealtime();
  return broadcast;
};
