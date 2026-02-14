import axios from 'axios';
import { tokenManager } from './client';

// Get API URL from environment or default to localhost
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Create Axios instance
export const djangoClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true, // Important for CORS and cookies if used
});

// Request interceptor to add JWT token
djangoClient.interceptors.request.use((config) => {
    // Use tokenManager to get the current token
    const token = tokenManager.getToken();

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

// Response interceptor for token refresh and session timeout
djangoClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If error is 401 and we haven't tried to refresh yet
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                // Try to get refresh token from storage via tokenManager logic
                // (Assuming we store it similarly or in a specific key)
                const refreshToken = localStorage.getItem('refresh_token') || sessionStorage.getItem('refresh_token');

                if (refreshToken) {
                    const response = await axios.post(`${API_BASE_URL}/auth/refresh/`, {
                        refresh: refreshToken,
                    });

                    const newAccessToken = response.data.access;
                    const persistent = tokenManager.isPersistent();

                    // Update storage using tokenManager
                    tokenManager.setToken(newAccessToken, persistent);

                    // Update header and retry request
                    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                    return djangoClient(originalRequest);
                }
            } catch (refreshError) {
                // Refresh failed - logout user
                console.error('Token refresh failed:', refreshError);
                tokenManager.clearAll();

                // Dispatch event so app can redirect to login
                window.dispatchEvent(new CustomEvent('auth:session-timeout'));
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);
