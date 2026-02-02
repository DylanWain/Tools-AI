// ============================================================================
// AuthContext - Anonymous Users + Optional Account Auth
// Every user gets a unique device ID - no signup required for full functionality
// Optional: Create account to sync across devices
// ============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '../lib/api';

// Generate a UUID for anonymous users
function generateDeviceId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

interface User {
  id: string;
  email: string | null;
  displayName: string | null;
  isAnonymous: boolean;
}

interface ApiKeys {
  openai: string | null;
  anthropic: string | null;
  google: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;  // Always true (anonymous or logged in)
  isLoggedIn: boolean;       // True only if has account
  apiKeys: ApiKeys;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
  error: string | null;
  clearError: () => void;
  saveApiKey: (provider: 'openai' | 'anthropic' | 'google', key: string) => void;
  removeApiKey: (provider: 'openai' | 'anthropic' | 'google') => void;
  hasApiKey: (provider: 'openai' | 'anthropic' | 'google') => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'persistent_ai_chat_token';
const USER_KEY = 'persistent_ai_chat_user';
const DEVICE_ID_KEY = 'toolsai_device_id';
const API_KEYS_KEY = 'toolsai_api_keys';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeys>({ openai: null, anthropic: null, google: null });

  // Initialize auth state - either logged in user OR anonymous user
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    const storedKeys = localStorage.getItem(API_KEYS_KEY);

    // Check for logged-in user first
    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser({ ...parsedUser, isAnonymous: false });
        api.setToken(storedToken);
      } catch (e) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    } else {
      // No logged-in user - create/retrieve anonymous user
      let deviceId = localStorage.getItem(DEVICE_ID_KEY);
      if (!deviceId) {
        deviceId = generateDeviceId();
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
      }
      
      // Create anonymous user object
      const anonymousUser: User = {
        id: deviceId,
        email: null,
        displayName: 'Guest',
        isAnonymous: true,
      };
      setUser(anonymousUser);
      
      // Use device ID as token for anonymous auth
      setToken(`anon_${deviceId}`);
      api.setToken(`anon_${deviceId}`);
    }

    // Load API keys
    if (storedKeys) {
      try {
        const parsedKeys = JSON.parse(storedKeys);
        setApiKeys(parsedKeys);
        if (parsedKeys.openai) {
          api.setApiKey(parsedKeys.openai);
        }
      } catch (e) {
        localStorage.removeItem(API_KEYS_KEY);
      }
    }

    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Get current device ID to migrate data
      const deviceId = localStorage.getItem(DEVICE_ID_KEY);
      
      const response = await api.post<{ user: User; token: string }>('/auth/login', {
        email,
        password,
        deviceId, // Send device ID so backend can migrate anonymous data
      });

      const loggedInUser = { ...response.user, isAnonymous: false };
      setUser(loggedInUser);
      setToken(response.token);
      api.setToken(response.token);

      localStorage.setItem(TOKEN_KEY, response.token);
      localStorage.setItem(USER_KEY, JSON.stringify(loggedInUser));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, displayName?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Get current device ID to migrate anonymous data to new account
      const deviceId = localStorage.getItem(DEVICE_ID_KEY);
      
      const response = await api.post<{ user: User; token: string }>('/auth/register', {
        email,
        password,
        displayName,
        deviceId, // Send device ID so backend can migrate anonymous data
      });

      const registeredUser = { ...response.user, isAnonymous: false };
      setUser(registeredUser);
      setToken(response.token);
      api.setToken(response.token);

      localStorage.setItem(TOKEN_KEY, response.token);
      localStorage.setItem(USER_KEY, JSON.stringify(registeredUser));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    // Clear logged-in user data
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    
    // Revert to anonymous user
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = generateDeviceId();
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    
    const anonymousUser: User = {
      id: deviceId,
      email: null,
      displayName: 'Guest',
      isAnonymous: true,
    };
    
    setUser(anonymousUser);
    setToken(`anon_${deviceId}`);
    api.setToken(`anon_${deviceId}`);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const saveApiKey = useCallback((provider: 'openai' | 'anthropic' | 'google', key: string) => {
    setApiKeys(prev => {
      const updated = { ...prev, [provider]: key };
      localStorage.setItem(API_KEYS_KEY, JSON.stringify(updated));
      if (provider === 'openai') {
        api.setApiKey(key);
      }
      return updated;
    });
  }, []);

  const removeApiKey = useCallback((provider: 'openai' | 'anthropic' | 'google') => {
    setApiKeys(prev => {
      const updated = { ...prev, [provider]: null };
      localStorage.setItem(API_KEYS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const hasApiKey = useCallback((provider: 'openai' | 'anthropic' | 'google') => {
    return !!apiKeys[provider];
  }, [apiKeys]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,  // Always true - anonymous or logged in
        isLoggedIn: !!user && !user.isAnonymous,  // True only with account
        apiKeys,
        login,
        register,
        logout,
        error,
        clearError,
        saveApiKey,
        removeApiKey,
        hasApiKey,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
