import { useState, useEffect, useCallback } from "react";
import { DEFAULT_SETTINGS } from "../utils/constants.js";
import { getSettings, saveSettings as persistSettings } from "../utils/storage.js";

export function useOllama() {
  const [connected, setConnected] = useState(false);
  const [models, setModels] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const stored = await getSettings();
    const active = stored || DEFAULT_SETTINGS;
    if (stored) setSettings(stored);
    await checkConnectionWith(active.ollamaUrl);
  };

  const checkConnectionWith = async (ollamaUrl) => {
    try {
      const response = await fetch(`${ollamaUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok) {
        setConnected(true);
        const data = await response.json();
        if (data?.models) setModels(data.models.map((m) => m.name));
        return true;
      }
      setConnected(false);
      return false;
    } catch {
      setConnected(false);
      return false;
    }
  };

  const checkConnection = useCallback(async () => {
    return checkConnectionWith(settings.ollamaUrl);
  }, [settings.ollamaUrl]);

  const saveSettings = useCallback(async (newSettings) => {
    setSettings(newSettings);
    await persistSettings(newSettings);
  }, []);

  return {
    connected,
    models,
    settings,
    saveSettings,
    recheckConnection: checkConnection,
  };
}
