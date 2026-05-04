import { useState, useEffect, useCallback } from "react";
import { DEFAULT_SETTINGS, DEFAULT_CLOUD_MODELS } from "../utils/constants.js";
import { getSettings, saveSettings as persistSettings } from "../utils/storage.js";

// Despite the name, this hook now manages all providers (kept as
// useOllama for stable imports). Returns connection state for the
// active provider plus the available model list for the picker.
export function useOllama() {
  const [connected, setConnected] = useState(false);
  const [models, setModels] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const stored = await getSettings();
    const merged = mergeSettings(stored);
    setSettings(merged);
    await refreshFor(merged);
  };

  const refreshFor = async (active) => {
    const provider = active.provider || "ollama";

    if (provider === "ollama") {
      try {
        const response = await fetch(`${active.ollamaUrl}/api/tags`, {
          signal: AbortSignal.timeout(3000),
        });
        if (response.ok) {
          const data = await response.json();
          setModels((data?.models || []).map((m) => m.name));
          setConnected(true);
          return;
        }
      } catch {}
      setConnected(false);
      setModels([]);
      return;
    }

    // Cloud provider: ready if a key is stored. Try to live-fetch models
    // from the provider; fall back to the defaults if that fails.
    const keyed = Boolean(active.apiKeys?.[provider]);
    setConnected(keyed);
    if (!keyed) {
      setModels(DEFAULT_CLOUD_MODELS[provider] || []);
      return;
    }
    try {
      const live = await window.providers?.listModels(provider);
      if (Array.isArray(live) && live.length) {
        setModels(live);
        return;
      }
    } catch {}
    setModels(DEFAULT_CLOUD_MODELS[provider] || []);
  };

  const checkConnection = useCallback(async () => {
    return refreshFor(settings);
  }, [settings]);

  const saveSettings = useCallback(async (newSettings) => {
    const merged = mergeSettings(newSettings);
    setSettings(merged);
    await persistSettings(merged);
    await refreshFor(merged);
  }, []);

  return {
    connected,
    models,
    settings,
    saveSettings,
    recheckConnection: checkConnection,
  };
}

function mergeSettings(stored) {
  const base = { ...DEFAULT_SETTINGS, ...(stored || {}) };
  base.apiKeys = { ...DEFAULT_SETTINGS.apiKeys, ...(stored?.apiKeys || {}) };
  base.cloudModels = { ...DEFAULT_SETTINGS.cloudModels, ...(stored?.cloudModels || {}) };
  return base;
}
