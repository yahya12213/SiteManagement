/**
 * Client API générique pour communiquer avec le backend Express
 * Remplace les appels Supabase par des appels REST classiques
 * Inclut l'authentification JWT automatique
 */

// Détection automatique de l'URL API:
// - Production (build): URL relative /api (même domaine que le frontend)
// - Dev (vite dev): URL relative /api (proxy Vite vers localhost:3001)
// IMPORTANT: En production, TOUJOURS utiliser /api (URL relative) pour éviter les problèmes CORS
const API_URL = import.meta.env.MODE === 'production' ? '/api' : (import.meta.env.VITE_API_URL || '/api');

// Token storage keys
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'current_user';
const PERMISSIONS_KEY = 'user_permissions';
const LAST_ACTIVITY_KEY = 'last_activity';
const SESSION_TYPE_KEY = 'session_type'; // 'session' or 'persistent'

// Session timeout in milliseconds (40 minutes)
const SESSION_TIMEOUT_MS = 40 * 60 * 1000;

export class ApiError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
  skipAuth?: boolean; // Skip adding auth token (for login endpoint)
}

/**
 * Auth token management with session cookie support
 */
export const tokenManager = {
  getToken: (): string | null => {
    // Check session timeout first
    if (tokenManager.isSessionExpired()) {
      tokenManager.clearAll();
      window.dispatchEvent(new CustomEvent('auth:session-timeout'));
      return null;
    }
    // Try sessionStorage first (session cookies), then localStorage (persistent)
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  },

  setToken: (token: string, persistent: boolean = false): void => {
    // Clear both storages first
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);

    if (persistent) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(SESSION_TYPE_KEY, 'persistent');
      sessionStorage.setItem(SESSION_TYPE_KEY, 'persistent');
    } else {
      // Session cookie: expires when browser closes
      sessionStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(SESSION_TYPE_KEY, 'session');
      localStorage.setItem(SESSION_TYPE_KEY, 'session');
    }

    // Update last activity timestamp
    tokenManager.updateActivity();
  },

  removeToken: (): void => {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  },

  getUser: (): any | null => {
    // Check session timeout first
    if (tokenManager.isSessionExpired()) {
      tokenManager.clearAll();
      window.dispatchEvent(new CustomEvent('auth:session-timeout'));
      return null;
    }

    const userStr = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
    return null;
  },

  setUser: (user: any, persistent: boolean = false): void => {
    sessionStorage.removeItem(USER_KEY);
    localStorage.removeItem(USER_KEY);

    const storage = persistent ? localStorage : sessionStorage;
    storage.setItem(USER_KEY, JSON.stringify(user));
  },

  removeUser: (): void => {
    sessionStorage.removeItem(USER_KEY);
    localStorage.removeItem(USER_KEY);
  },

  getPermissions: (): string[] => {
    const permsStr = sessionStorage.getItem(PERMISSIONS_KEY) || localStorage.getItem(PERMISSIONS_KEY);
    if (permsStr) {
      try {
        return JSON.parse(permsStr);
      } catch {
        return [];
      }
    }
    return [];
  },

  setPermissions: (permissions: string[], persistent: boolean = false): void => {
    sessionStorage.removeItem(PERMISSIONS_KEY);
    localStorage.removeItem(PERMISSIONS_KEY);

    const storage = persistent ? localStorage : sessionStorage;
    storage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions));
  },

  removePermissions: (): void => {
    sessionStorage.removeItem(PERMISSIONS_KEY);
    localStorage.removeItem(PERMISSIONS_KEY);
  },

  // Activity tracking for session timeout
  updateActivity: (): void => {
    const now = Date.now().toString();
    sessionStorage.setItem(LAST_ACTIVITY_KEY, now);
    localStorage.setItem(LAST_ACTIVITY_KEY, now);
  },

  getLastActivity: (): number => {
    const lastActivity = sessionStorage.getItem(LAST_ACTIVITY_KEY) || localStorage.getItem(LAST_ACTIVITY_KEY);
    return lastActivity ? parseInt(lastActivity, 10) : 0;
  },

  isSessionExpired: (): boolean => {
    const lastActivity = tokenManager.getLastActivity();
    if (!lastActivity) return false;

    const now = Date.now();
    const elapsed = now - lastActivity;
    return elapsed > SESSION_TIMEOUT_MS;
  },

  // Get remaining session time in milliseconds
  getRemainingTime: (): number => {
    const lastActivity = tokenManager.getLastActivity();
    if (!lastActivity) return SESSION_TIMEOUT_MS;

    const elapsed = Date.now() - lastActivity;
    return Math.max(0, SESSION_TIMEOUT_MS - elapsed);
  },

  clearAll: (): void => {
    // Clear from both storages
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(PERMISSIONS_KEY);
    sessionStorage.removeItem(LAST_ACTIVITY_KEY);
    sessionStorage.removeItem(SESSION_TYPE_KEY);

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(PERMISSIONS_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    localStorage.removeItem(SESSION_TYPE_KEY);
  },

  hasPermission: (permission: string): boolean => {
    const user = tokenManager.getUser();
    // Admin has all permissions
    if (user?.role === 'admin') return true;
    const permissions = tokenManager.getPermissions();
    return permissions.includes(permission) || permissions.includes('*');
  },

  hasAnyPermission: (...perms: string[]): boolean => {
    return perms.some(p => tokenManager.hasPermission(p));
  },

  hasAllPermissions: (...perms: string[]): boolean => {
    return perms.every(p => tokenManager.hasPermission(p));
  },

  // Check if session is persistent (remember me)
  isPersistent: (): boolean => {
    const sessionType = localStorage.getItem(SESSION_TYPE_KEY) || sessionStorage.getItem(SESSION_TYPE_KEY);
    return sessionType === 'persistent';
  },
};

/**
 * Client HTTP générique avec gestion d'erreurs et authentification JWT
 */
class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { params, skipAuth, ...fetchOptions } = options;

    // Construire l'URL avec les query params si fournis
    let url = `${this.baseURL}${endpoint}`;
    if (params) {
      const queryString = new URLSearchParams(params).toString();
      url += `?${queryString}`;
    }

    // Headers par défaut (sauf si FormData est utilisé)
    const isFormData = fetchOptions.body instanceof FormData;
    const headers: HeadersInit = isFormData
      ? {
          // Ne pas définir Content-Type pour FormData (le navigateur le fait automatiquement avec boundary)
          ...fetchOptions.headers,
        }
      : {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        };

    // Add JWT Authorization header if token exists and not skipped
    if (!skipAuth) {
      const token = tokenManager.getToken();
      if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
      }
    }

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
      });

      // Handle authentication errors
      if (response.status === 401) {
        const errorData = await response.json().catch(() => ({}));

        // If token expired, clear auth state
        if (errorData.code === 'TOKEN_EXPIRED' || errorData.code === 'INVALID_TOKEN') {
          tokenManager.clearAll();
          // Optionally trigger a re-login flow
          window.dispatchEvent(new CustomEvent('auth:token-expired'));
        }

        throw new ApiError(
          errorData.error || 'Authentication required',
          response.status,
          errorData.code
        );
      }

      // Handle permission errors
      if (response.status === 403) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.error || 'Permission denied',
          response.status,
          errorData.code || 'FORBIDDEN'
        );
      }

      // Gestion des erreurs HTTP
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.error || errorData.message || 'Une erreur est survenue',
          response.status,
          errorData.code
        );
      }

      // Parser la réponse JSON
      const data = await response.json();
      return data as T;
    } catch (error) {
      // Si c'est déjà une ApiError, la relancer
      if (error instanceof ApiError) {
        throw error;
      }

      // Erreur réseau ou autre
      if (error instanceof Error) {
        throw new ApiError(
          `Erreur de connexion: ${error.message}`,
          undefined,
          'NETWORK_ERROR'
        );
      }

      throw new ApiError('Une erreur inconnue est survenue');
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, data?: unknown, options?: { skipAuth?: boolean }): Promise<T> {
    // Si data est FormData, l'envoyer tel quel (ne pas stringifier)
    const body = data instanceof FormData ? data : JSON.stringify(data);

    return this.request<T>(endpoint, {
      method: 'POST',
      body,
      skipAuth: options?.skipAuth,
    });
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    // Si data est FormData, l'envoyer tel quel (ne pas stringifier)
    const body = data instanceof FormData ? data : JSON.stringify(data);

    return this.request<T>(endpoint, {
      method: 'PUT',
      body,
    });
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    // Si data est FormData, l'envoyer tel quel (ne pas stringifier)
    const body = data instanceof FormData ? data : JSON.stringify(data);

    return this.request<T>(endpoint, {
      method: 'PATCH',
      body,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }
}

// Instance singleton du client API
export const apiClient = new ApiClient(API_URL);
