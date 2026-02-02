// ============================================================================
// useSettings Hook - User settings and API key management
// ============================================================================

import { useState, useCallback, useEffect } from 'react';
import type { UserSettings, ApiKey, ApiProvider } from '../types';
import { api } from '../lib/api';

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'dark',
  defaultModel: 'gpt-4',
  defaultProvider: 'openai',
  memoryEnabled: true,
  autoSummarize: true,
  exportFormat: 'pdf',
};

interface UseSettingsReturn {
  settings: UserSettings;
  apiKeys: ApiKey[];
  isLoading: boolean;
  error: string | null;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  saveApiKey: (provider: ApiProvider, key: string) => Promise<void>;
  deleteApiKey: (provider: ApiProvider) => Promise<void>;
  validateApiKey: (provider: ApiProvider) => Promise<boolean>;
  loadSettings: () => Promise<void>;
  loadApiKeys: () => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [settingsRes, keysRes] = await Promise.all([
        api.get<{ settings: UserSettings }>('/settings'),
        api.get<{ apiKeys: ApiKey[] }>('/api-keys'),
      ]);

      setSettings(settingsRes.settings || DEFAULT_SETTINGS);
      setApiKeys(keysRes.apiKeys || []);
    } catch (err) {
      // Use defaults if can't load
      console.warn('Failed to load settings, using defaults:', err);
      setSettings(DEFAULT_SETTINGS);
      setApiKeys([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadApiKeys = useCallback(async () => {
    try {
      const keysRes = await api.get<{ apiKeys: ApiKey[] }>('/api-keys');
      setApiKeys(keysRes.apiKeys || []);
    } catch (err) {
      console.warn('Failed to load API keys:', err);
    }
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
    const updated = { ...settings, ...newSettings };
    
    // Optimistic update
    setSettings(updated);
    
    try {
      await api.patch('/settings', newSettings);
    } catch (err) {
      // Revert on error
      setSettings(settings);
      setError(err instanceof Error ? err.message : 'Failed to update settings');
      throw err;
    }
  }, [settings]);

  const saveApiKey = useCallback(async (provider: ApiProvider, key: string) => {
    setError(null);

    try {
      const response = await api.post<{ apiKey: ApiKey; isValid: boolean }>(
        '/api-keys',
        { provider, apiKey: key }
      );

      // Update or add the key
      setApiKeys(prev => {
        const existing = prev.findIndex(k => k.provider === provider);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = response.apiKey;
          return updated;
        }
        return [...prev, response.apiKey];
      });

      if (!response.isValid) {
        setError(`API key for ${provider} saved but validation failed`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save API key');
      throw err;
    }
  }, []);

  const deleteApiKey = useCallback(async (provider: ApiProvider) => {
    setError(null);

    try {
      await api.delete(`/api-keys/${provider}`);
      setApiKeys(prev => prev.filter(k => k.provider !== provider));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete API key');
      throw err;
    }
  }, []);

  const validateApiKey = useCallback(async (provider: ApiProvider): Promise<boolean> => {
    try {
      const response = await api.post<{ isValid: boolean }>(
        `/api-keys/${provider}/validate`
      );
      
      // Update validation status
      setApiKeys(prev =>
        prev.map(k =>
          k.provider === provider
            ? { ...k, isValid: response.isValid, lastValidatedAt: new Date().toISOString() }
            : k
        )
      );

      return response.isValid;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate API key');
      return false;
    }
  }, []);

  return {
    settings,
    apiKeys,
    isLoading,
    error,
    updateSettings,
    saveApiKey,
    deleteApiKey,
    validateApiKey,
    loadSettings,
    loadApiKeys,
  };
}
