import React, { useState, useEffect } from "react";
import { DEFAULT_SETTINGS } from "../utils/constants.js";

export default function SettingsModal({ settings, models, onSave, onClose, updateState, onInstallUpdate }) {
  const [form, setForm] = useState({
    ollamaUrl: settings?.ollamaUrl || DEFAULT_SETTINGS.ollamaUrl,
    model: settings?.model || DEFAULT_SETTINGS.model,
    temperature: settings?.temperature ?? DEFAULT_SETTINGS.temperature,
  });
  const [version, setVersion] = useState("");
  const [isPackaged, setIsPackaged] = useState(true);
  const [checkResult, setCheckResult] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    window.appInfo?.getVersion().then(setVersion).catch(() => {});
    window.appInfo?.isPackaged().then(setIsPackaged).catch(() => {});
  }, []);

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
  let updateColor = "#6B7280";
  if (updStatus === "checking") { updateLine = "Checking for updates…"; updateColor = "#7BA4FF"; }
  else if (updStatus === "available") { updateLine = `Update available: v${updVersion}`; updateColor = "#7BA4FF"; }
  else if (updStatus === "downloading") { updateLine = `Downloading… ${Math.round(updProgress)}%`; updateColor = "#7BA4FF"; }
  else if (updStatus === "downloaded") { updateLine = `v${updVersion} ready to install`; updateColor = "#10B981"; }
  else if (updStatus === "error") { updateLine = `Update error: ${updError || "unknown"}`; updateColor = "#EF4444"; }
  else if (checkResult?.skipped) { updateLine = `Update check skipped (${checkResult.reason || "unknown"})`; updateColor = "#9AA0B4"; }
  else if (checkResult?.ok && checkResult?.updateInfo && checkResult.updateInfo.version !== version) { updateLine = `Update available: v${checkResult.updateInfo.version}`; updateColor = "#7BA4FF"; }
  else if (checkResult?.ok) { updateLine = "You're on the latest version."; updateColor = "#10B981"; }
  else if (checkResult?.error) { updateLine = `Check failed: ${checkResult.error}`; updateColor = "#EF4444"; }

  const handleSave = () => {
    onSave(form);
  };

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const allModels = models.length > 0 ? models : [form.model];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={handleBackdrop}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{
          background: "#161B27",
          border: "1px solid #2A3347",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2
            className="text-xl font-semibold"
            style={{ fontFamily: "DM Serif Display, serif", color: "#C9A55C" }}
          >
            Settings
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-[#2A3347] transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5">
          {/* Ollama URL */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
              Ollama URL
            </label>
            <input
              type="text"
              value={form.ollamaUrl}
              onChange={(e) => setForm((f) => ({ ...f, ollamaUrl: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-colors"
              style={{
                background: "#0F1117",
                border: "1px solid #2A3347",
                color: "#E8E8E8",
              }}
              onFocus={(e) => (e.target.style.border = "1px solid #C9A55C66")}
              onBlur={(e) => (e.target.style.border = "1px solid #2A3347")}
            />
          </div>

          {/* Model */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
              Model
            </label>
            <select
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-colors appearance-none"
              style={{
                background: "#0F1117",
                border: "1px solid #2A3347",
                color: "#E8E8E8",
                cursor: "pointer",
              }}
            >
              {allModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-600 mt-1">
              Models are loaded from your Ollama installation
            </p>
          </div>

          {/* Temperature */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
              Temperature:{" "}
              <span style={{ color: "#C9A55C" }}>{form.temperature.toFixed(1)}</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={form.temperature}
              onChange={(e) =>
                setForm((f) => ({ ...f, temperature: parseFloat(e.target.value) }))
              }
              className="w-full"
              style={{ accentColor: "#C9A55C" }}
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>Precise (0.0)</span>
              <span>Creative (1.0)</span>
            </div>
          </div>
        </div>

        {/* About & Updates */}
        <div className="mt-6 pt-5 border-t" style={{ borderColor: "#2A3347" }}>
          <label className="block text-xs font-medium text-gray-400 mb-3 uppercase tracking-wide">
            About & Updates
          </label>
          <div className="rounded-lg p-3" style={{ background: "#0F1117", border: "1px solid #2A3347" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Current version</span>
              <span className="text-sm font-mono" style={{ color: "#E8E8E8" }}>
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
                style={{ background: "#1E2535", border: "1px solid #2A3347", color: "#E8E8E8" }}
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
            style={{ background: "#0F1117", border: "1px solid #2A3347" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: "linear-gradient(135deg, #C9A55C, #A8874A)",
              color: "#0F1117",
            }}
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
