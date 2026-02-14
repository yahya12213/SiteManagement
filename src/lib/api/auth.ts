import { djangoClient } from './django';

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: 'admin' | 'professor' | 'gerant' | string; // Allow custom roles
  role_id?: string;
  role_name?: string;
  role_description?: string;
  profile_image_url?: string; // User profile photo URL
}

export interface LoginResponse {
  success: boolean;
  user: User;
  token: string;
  permissions: string[];
  expiresIn: string;
}

export interface AuthResponse {
  success: boolean;
  user: User;
  permissions: string[];
}

export interface RefreshTokenResponse {
  success: boolean;
  token: string;
  expiresIn: string;
}

/**
 * Service d'authentification avec JWT
 */
export const authApi = {
  /**
   * Connexion utilisateur - retourne token JWT
   */
  async login(username: string, password: string): Promise<LoginResponse> {
    const response = await djangoClient.post<any>('/auth/login/', { username, password });

    // Map Django response to frontend LoginResponse
    return {
      success: true,
      user: {
        id: response.data.user.id.toString(),
        username: response.data.user.username,
        full_name: response.data.user.full_name || response.data.user.username,
        role: response.data.user.role.toLowerCase(), // Ensure lowercase for frontend
        profile_image_url: response.data.user.profile_picture,
      },
      token: response.data.access,
      permissions: [], // Students typically have no specific permissions in this system yet
      expiresIn: '15m', // Approx
    };
  },

  /**
   * Obtenir l'utilisateur actuel (vérifie le token)
   */
  async getCurrentUser(): Promise<AuthResponse> {
    const response = await djangoClient.get<any>('/student/profile/');

    return {
      success: true,
      user: {
        id: response.data.user.id.toString(),
        username: response.data.user.username,
        full_name: response.data.full_name,
        role: response.data.role.toLowerCase(),
        profile_image_url: response.data.profile_picture,
      },
      permissions: [],
    };
  },

  /**
   * Rafraîchir le token
   */
  async refreshToken(): Promise<RefreshTokenResponse> {
    const refreshToken = localStorage.getItem('refresh_token');
    const response = await djangoClient.post<any>('/auth/refresh/', { refresh: refreshToken });

    return {
      success: true,
      token: response.data.access,
      expiresIn: '15m'
    };
  },

  /**
   * Déconnexion
   */
  async logout(): Promise<{ success: boolean; message: string }> {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      await djangoClient.post('/auth/logout/', { refresh: refreshToken });
    } catch (e) {
      console.error('Logout failed', e);
    }
    return { success: true, message: 'Logged out' };
  },

  /**
   * Changer le mot de passe
   */
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    // Not implemented in Django API yet
    throw new Error('Not implemented');
  },
};
