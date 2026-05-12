import React, { useState, useEffect, useMemo } from "react";
import { DEFAULT_SETTINGS, PROVIDERS, DEFAULT_CLOUD_MODELS } from "../utils/constants.js";

export default function SettingsModal({ settings, models, onSave, onClose, updateState, onInstallUpdate }) {
  const [form, setForm] = useState(() => mergeWithDefaults(settings));
  const [showKey, setShowKey] = useState({ anthropic: false, openai: false, gemini: false });
  const [liveCloudModels, setLiveCloudModels] = useState({ anthropic: [], openai: [], gemini: [] });
  const [loadingModels, setLoadingModels] = useState(false);
  const [liveOllamaModels, setLiveOllamaModels] = useState(null); // null = not yet fetched

  const [version, setVersion] = useState("");
  const [isPackaged, setIsPackaged] = useState(true);
  const [checkResult, setCheckResult] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    window.appInfo?.getVersion().then(setVersion).catch(() => {});
    window.appInfo?.isPackaged().then(setIsPackaged).catch(() => {});
  }, []);

  // Live-fetch model lists from each cloud provider that has a *plausibly
  // complete* key. Guarded by length so we don't spam /models with invalid
  // partial keys while the user is still typing. Debounced 600ms.
  useEffect(() => {
    if (!window.providers) return;
    const handle = setTimeout(async () => {
      setLoadingModels(true);
      const results = {};
      for (const p of ["anthropic", "openai", "gemini"]) {
        const key = form.apiKeys?.[p];
        if (!key || key.length < 25) continue;
        try {
          const list = await window.providers.listModels(p);
          if (Array.isArray(list) && list.length) results[p] = list;
        } catch {}
      }
      setLiveCloudModels((prev) => ({ ...prev, ...results }));
      setLoadingModels(false);
    }, 600);
    return () => clearTimeout(handle);
  }, [form.apiKeys.anthropic, form.apiKeys.openai, form.apiKeys.gemini]);

  // Live-fetch Ollama models when the user is on (or switches to) the
  // Local provider. The `models` prop from useOllama reflects whatever
  // provider was active when settings loaded — if the user opens Settings
  // while on a cloud provider and clicks "Local (Ollama)", the prop is
  // still cloud models, so we fetch directly here.
  useEffect(() => {
    if (form.provider !== "ollama") return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${form.ollamaUrl}/api/tags`, {
          signal: AbortSignal.timeout(3000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (cancelled) return;
        setLiveOllamaModels((data?.models || []).map((m) => m.name));
      } catch {
        if (!cancelled) setLiveOllamaModels([]);
      }
    })();
    return () => { cancelled = true; };
  }, [form.provider, form.ollamaUrl]);

  const handleCheckForUpdates = async () => {
    if (!window.updater) return;
    setChecking(true);
    setCheckResult(null);
    try {
      const result = await window.updater.checkForUpdates();
      setCheckResult(result);
    } catch (e) {
      setCheckResult({ ok: false, error: e.message });
    } finally {
      setChecking(false);
    }
  };

  const updStatus = updateState?.status || "none";
  const updVersion = updateState?.version;
  const updProgress = updateState?.progress || 0;
  const updError = updateState?.error;

  let updateLine = "You're up to date.";
  let updateColor = "#64748B";
  if (updStatus === "checking") { updateLine = "Checking for updates…"; updateColor = "#315A98"; }
  else if (updStatus === "available") { updateLine = `Update available: v${updVersion}`; updateColor = "#315A98"; }
  else if (updStatus === "downloading") { updateLine = `Downloading… ${Math.round(updProgress)}%`; updateColor = "#315A98"; }
  else if (updStatus === "downloaded") { updateLine = `v${updVersion} ready to install`; updateColor = "#10B981"; }
  else if (updStatus === "error") { updateLine = `Update error: ${updError || "unknown"}`; updateColor = "#EF4444"; }
  else if (checkResult?.skipped) { updateLine = `Update check skipped (${checkResult.reason || "unknown"})`; updateColor = "#475569"; }
  else if (checkResult?.ok && checkResult?.updateInfo && checkResult.updateInfo.version !== version) { updateLine = `Update available: v${checkResult.updateInfo.version}`; updateColor = "#315A98"; }
  else if (checkResult?.ok) { updateLine = "You're on the latest version."; updateColor = "#10B981"; }
  else if (checkResult?.error) { updateLine = `Check failed: ${checkResult.error}`; updateColor = "#EF4444"; }

  const handleSave = () => onSave(form);
  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

  const provider = form.provider || "ollama";

  // Models for the active provider's picker.
  const providerModels = useMemo(() => {
    if (provider === "ollama") {
      // Trust our own live-fetch over the prop, since the prop reflects
      // whichever provider was active when the parent's useOllama last
      // refreshed (which may have been a cloud provider).
      if (Array.isArray(liveOllamaModels)) {
        return liveOllamaModels.length > 0 ? liveOllamaModels : (form.model ? [form.model] : []);
      }
      // Pre-fetch: only trust the prop if the saved provider is also ollama;
      // otherwise show nothing rather than leak cloud models into this picker.
      if (settings?.provider === "ollama" && models.length > 0) return models;
      return form.model ? [form.model] : [];
    }
    const live = liveCloudModels[provider] || [];
    if (live.length) return live;
    return DEFAULT_CLOUD_MODELS[provider] || [];
  }, [provider, models, liveCloudModels, liveOllamaModels, form.model, settings?.provider]);

  const activeCloudModel = form.cloudModels?.[provider] || providerModels[0] || "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(15,23,42,0.28)", backdropFilter: "blur(4px)" }}
      onClick={handleBackdrop}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{
          background: "#FFFFFF",
          border: "1px solid #D8DEE8",
          boxShadow: "0 24px 64px rgba(15,23,42,0.16)",
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2
            className="text-xl font-semibold"
            style={{ fontFamily: "DM Serif Display, serif", color: "#315A98" }}
          >
            Settings
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-[#D8DEE8] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Provider picker */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
            AI Provider
          </label>
          <div className="grid grid-cols-2 gap-2">
            {PROVIDERS.map((p) => {
              const active = provider === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, provider: p.id }))}
                  className="text-left px-3 py-2.5 rounded-lg text-xs transition-colors"
                  style={{
                    background: active ? "#F8FAFC" : "#FFFFFF",
                    border: active ? "1px solid #315A9866" : "1px solid #D8DEE8",
                    color: active ? "#1F2937" : "#475569",
                  }}
                >
                  <div className="font-medium" style={{ color: active ? "#315A98" : "#1F2937" }}>
                    {p.label}
                  </div>
                  <div className="text-[10px] mt-0.5 leading-tight" style={{ color: "#64748B" }}>
                    {p.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Provider-specific config */}
        {provider === "ollama" && (
          <div className="space-y-4">
            <Field label="Ollama URL">
              <input
                type="text"
                value={form.ollamaUrl}
                onChange={(e) => setForm((f) => ({ ...f, ollamaUrl: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: "#FFFFFF", border: "1px solid #D8DEE8", color: "#1F2937" }}
              />
            </Field>

            <Field
              label="Local Model"
              hint={
                liveOllamaModels === null
                  ? "Loading models from your Ollama installation…"
                  : liveOllamaModels.length === 0
                    ? "Couldn't reach Ollama. Make sure it's running and the URL above is correct."
                    : "Models loaded from your Ollama installation"
              }
            >
              <select
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none appearance-none disabled:opacity-50"
                style={{
                  background: "#FFFFFF", border: "1px solid #D8DEE8",
                  color: "#1F2937", cursor: "pointer",
                }}
                disabled={providerModels.length === 0}
              >
                {providerModels.length === 0 && <option value="">(no models found)</option>}
                {providerModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {provider !== "ollama" && (
          <div className="space-y-4">
            <Field
              label={`${PROVIDERS.find((p) => p.id === provider)?.label} API Key`}
              hint="Stored locally on this machine. Never sent anywhere except the provider you're calling."
            >
              <div className="flex gap-2">
                <input
                  type={showKey[provider] ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  value={form.apiKeys?.[provider] || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      apiKeys: { ...f.apiKeys, [provider]: e.target.value },
                    }))
                  }
                  placeholder={placeholderForProvider(provider)}
                  className="flex-1 px-3 py-2.5 rounded-lg text-sm outline-none font-mono"
                  style={{ background: "#FFFFFF", border: "1px solid #D8DEE8", color: "#1F2937" }}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => ({ ...s, [provider]: !s[provider] }))}
                  className="px-3 rounded-lg text-xs"
                  style={{ background: "#FFFFFF", border: "1px solid #D8DEE8", color: "#475569" }}
                >
                  {showKey[provider] ? "Hide" : "Show"}
                </button>
              </div>
            </Field>

            <Field
              label="Model"
              hint={loadingModels ? "Looking up models from provider…" : (form.apiKeys?.[provider] ? "Live list from provider" : "Default list (add a key to fetch live)")}
            >
              <select
                value={activeCloudModel}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    cloudModels: { ...f.cloudModels, [provider]: e.target.value },
                  }))
                }
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none appearance-none"
                style={{
                  background: "#FFFFFF", border: "1px solid #D8DEE8",
                  color: "#1F2937", cursor: "pointer",
                }}
              >
                {providerModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </Field>
          </div>
        )}

{/* About & Updates */}
        <div className="mt-6 pt-5 border-t" style={{ borderColor: "#D8DEE8" }}>
          <label className="block text-xs font-medium text-gray-400 mb-3 uppercase tracking-wide">
            About & Updates
          </label>
          <div className="rounded-lg p-3" style={{ background: "#FFFFFF", border: "1px solid #D8DEE8" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Current version</span>
              <span className="text-sm font-mono" style={{ color: "#1F2937" }}>
                v{version || "…"}{!isPackaged && " (dev)"}
              </span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-400">Status</span>
              <span className="text-xs" style={{ color: updateColor }}>{updateLine}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCheckForUpdates}
                disabled={checking || updStatus === "checking" || updStatus === "downloading"}
                className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                style={{ background: "#F8FAFC", border: "1px solid #D8DEE8", color: "#1F2937" }}
              >
                {checking ? "Checking…" : "Check for updates"}
              </button>
              {updStatus === "downloaded" && (
                <button
                  onClick={onInstallUpdate}
                  className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                  style={{ background: "linear-gradient(135deg, #10B981, #059669)", color: "#FFFFFF" }}
                >
                  Restart & install
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition-colors"
            style={{ background: "#FFFFFF", border: "1px solid #D8DEE8" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: "linear-gradient(135deg, #315A98, #244876)",
              color: "#FFFFFF",
            }}
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-600 mt-1">{hint}</p>}
    </div>
  );
}

function placeholderForProvider(p) {
  if (p === "anthropic") return "sk-ant-…";
  if (p === "openai") return "sk-…";
  if (p === "gemini") return "AIza…";
  return "API key";
}

function mergeWithDefaults(settings) {
  const base = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  base.apiKeys = { ...DEFAULT_SETTINGS.apiKeys, ...(settings?.apiKeys || {}) };
  base.cloudModels = { ...DEFAULT_SETTINGS.cloudModels, ...(settings?.cloudModels || {}) };
  return base;
}
