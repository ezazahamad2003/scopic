import React, { useState, useEffect } from "react";
import { DEFAULT_SETTINGS } from "../utils/constants.js";

export default function SettingsModal({ settings, models, onSave, onClose }) {
  const [form, setForm] = useState({
    ollamaUrl: settings?.ollamaUrl || DEFAULT_SETTINGS.ollamaUrl,
    model: settings?.model || DEFAULT_SETTINGS.model,
    temperature: settings?.temperature ?? DEFAULT_SETTINGS.temperature,
  });

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
