import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { authApi } from '@/lib/api/auth';
import { tokenManager } from '@/lib/api/client';
import type { User } from '@/lib/api/auth';
import { convertLegacyPermission } from '@/config/permissions';

// Session timeout check interval (every minute)
const SESSION_CHECK_INTERVAL = 60 * 1000;

// Activity events to track
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  logout: () => void;
  isAdmin: boolean;
  isGerant: boolean;
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (...permissions: string[]) => boolean;
  refreshUser: () => Promise<void>;
  sessionTimeRemaining: number; // Remaining session time in ms
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(0);
  const activityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update activity on user interaction
  const handleActivity = useCallback(() => {
    if (user) {
      tokenManager.updateActivity();
      setSessionTimeRemaining(tokenManager.getRemainingTime());
    }
  }, [user]);

  // Debounced activity handler (don't update on every keystroke)
  const debouncedActivityHandler = useCallback(() => {
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }
    activityTimeoutRef.current = setTimeout(handleActivity, 1000);
  }, [handleActivity]);

  // Initialize auth state from storage
  useEffect(() => {
    const initAuth = () => {
      const savedUser = tokenManager.getUser();
      const savedToken = tokenManager.getToken();
      const savedPermissions = tokenManager.getPermissions();

      if (savedUser && savedToken) {
        setUser(savedUser);
        setPermissions(savedPermissions);
        setSessionTimeRemaining(tokenManager.getRemainingTime());
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // Set up activity tracking
  useEffect(() => {
    if (user) {
      // Add activity listeners
      ACTIVITY_EVENTS.forEach(event => {
        window.addEventListener(event, debouncedActivityHandler, { passive: true });
      });

      // Set up session check interval
      sessionCheckIntervalRef.current = setInterval(() => {
        if (tokenManager.isSessionExpired()) {
          console.warn('Session expired due to inactivity');
          logout();
          window.dispatchEvent(new CustomEvent('auth:session-timeout'));
        } else {
          setSessionTimeRemaining(tokenManager.getRemainingTime());
        }
      }, SESSION_CHECK_INTERVAL);

      return () => {
        ACTIVITY_EVENTS.forEach(event => {
          window.removeEventListener(event, debouncedActivityHandler);
        });
        if (sessionCheckIntervalRef.current) {
          clearInterval(sessionCheckIntervalRef.current);
        }
        if (activityTimeoutRef.current) {
          clearTimeout(activityTimeoutRef.current);
        }
      };
    }
  }, [user, debouncedActivityHandler]);

  // Listen for token expiration and session timeout events
  useEffect(() => {
    const handleTokenExpired = () => {
      console.warn('Token expired, logging out...');
      setUser(null);
      setPermissions([]);
    };

    const handleSessionTimeout = () => {
      console.warn('Session timeout, logging out...');
      setUser(null);
      setPermissions([]);
      // Show a message to the user
      alert('Votre session a expiré après 40 minutes d\'inactivité. Veuillez vous reconnecter.');
    };

    window.addEventListener('auth:token-expired', handleTokenExpired);
    window.addEventListener('auth:session-timeout', handleSessionTimeout);

    return () => {
      window.removeEventListener('auth:token-expired', handleTokenExpired);
      window.removeEventListener('auth:session-timeout', handleSessionTimeout);
    };
  }, []);

  const login = async (username: string, password: string, rememberMe: boolean = false): Promise<boolean> => {
    try {
      const response = await authApi.login(username, password);

      // Store token and user data
      // rememberMe=false: session storage (expires on browser close)
      // rememberMe=true: local storage (persists across sessions)
      if (response.token) {
        tokenManager.setToken(response.token, rememberMe);
      }

      // Handle both old response format (user object) and new format (response with user, token, permissions)
      const loggedUser = response.user || response;
      tokenManager.setUser(loggedUser, rememberMe);
      setUser(loggedUser);

      // Store permissions if available
      const userPermissions = response.permissions || [];
      tokenManager.setPermissions(userPermissions, rememberMe);
      setPermissions(userPermissions);

      // Initialize session time
      setSessionTimeRemaining(tokenManager.getRemainingTime());

      return true;
    } catch (error) {
      console.error('Erreur de connexion:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setPermissions([]);
    setSessionTimeRemaining(0);
    tokenManager.clearAll();
  };

  const refreshUser = async () => {
    try {
      const response = await authApi.getCurrentUser();
      const isPersistent = tokenManager.isPersistent();

      if (response.user) {
        tokenManager.setUser(response.user, isPersistent);
        setUser(response.user);
      }
      if (response.permissions) {
        tokenManager.setPermissions(response.permissions, isPersistent);
        setPermissions(response.permissions);
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  const hasPermission = (permission: string): boolean => {
    // Admin has all permissions
    if (user?.role === 'admin') return true;
    // Check wildcard
    if (permissions.includes('*')) return true;

    // Convertir le code demandé (au cas où on demande un ancien code)
    const normalizedRequested = convertLegacyPermission(permission);

    // Vérifier si l'utilisateur a la permission demandée
    // OU une permission legacy qui correspond au code demandé
    return permissions.some(p => {
      const normalizedUserPerm = convertLegacyPermission(p);
      return p === normalizedRequested || normalizedUserPerm === normalizedRequested;
    });
  };

  const hasAnyPermission = (...perms: string[]): boolean => {
    return perms.some(p => hasPermission(p));
  };

  const isAdmin = user?.role === 'admin';
  const isGerant = user?.role === 'gerant';

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        isAdmin,
        isGerant,
        permissions,
        hasPermission,
        hasAnyPermission,
        refreshUser,
        sessionTimeRemaining,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
