import React, { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_CLOUD_MODELS, MODEL_OPTIONS, modelLabel } from "../utils/constants.js";

const PROVIDER_NAMES = {
  ollama: "Local",
  anthropic: "Anthropic",
  gemini: "Google",
  openai: "OpenAI",
};

const GROUPS = [
  { id: "ollama", label: "Local" },
  { id: "anthropic", label: "Anthropic" },
  { id: "gemini", label: "Google" },
  { id: "openai", label: "OpenAI" },
];

export default function ModelPicker({ settings, models, connected, onChange }) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState("up");
  const pickerRef = useRef(null);
  const buttonRef = useRef(null);
  const provider = settings?.provider || "ollama";
  const currentModel =
    provider === "ollama"
      ? settings?.model
      : settings?.cloudModels?.[provider] || DEFAULT_CLOUD_MODELS[provider]?.[0];
  const value = `${provider}::${currentModel || ""}`;

  const localModels = Array.from(
    new Set([settings?.model || "phi3", ...((provider === "ollama" && models?.length ? models : []))].filter(Boolean))
  );
  const ollamaOptions = localModels
    .filter(Boolean)
    .map((id) => ({ id, label: id, provider: "ollama", group: "Local" }));

  const allOptions = useMemo(
    () => [...ollamaOptions, ...MODEL_OPTIONS],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [models, settings?.model]
  );
  const selected = allOptions.find((item) => `${item.provider}::${item.id}` === value);
  const selectedLabel =
    selected?.provider === "ollama"
      ? selected?.label || currentModel || "Local model"
      : modelLabel(selected?.id || currentModel);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!pickerRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const hasKey = (itemProvider) =>
    itemProvider === "ollama" || Boolean(settings?.apiKeys?.[itemProvider]);

  const handlePick = (item) => {
    if (!hasKey(item.provider)) return;
    onChange?.(item.provider, item.id);
    setOpen(false);
  };

  const toggleOpen = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const estimatedMenuHeight = 360;
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      setPlacement(spaceAbove >= estimatedMenuHeight || spaceAbove > spaceBelow ? "up" : "down");
    }
    setOpen((next) => !next);
  };

  return (
    <div ref={pickerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        className="flex h-10 max-w-[220px] items-center gap-2 rounded-xl px-2.5 text-sm font-medium outline-none transition-colors hover:bg-[#F3F4F6] focus:bg-[#F3F4F6]"
        style={{ color: "#111827" }}
        title="Choose the model for this chat"
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: connected ? "#16A34A" : "#DC2626" }}
        />
        <span className="truncate">{selectedLabel}</span>
        <span
          className="text-xs transition-transform"
          style={{ color: "#8A93A6", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ^
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 w-72 overflow-hidden rounded-2xl py-2 shadow-xl"
          style={{
            ...(placement === "up"
              ? { bottom: "calc(100% + 10px)" }
              : { top: "calc(100% + 10px)" }),
            background: "#FFFFFF",
            border: "1px solid #E5E7EB",
            boxShadow: "0 18px 45px rgba(15, 23, 42, 0.14)",
            maxHeight: "min(380px, calc(100vh - 96px))",
            overflowY: "auto",
          }}
        >
          {GROUPS.map((group) => {
            const options = allOptions.filter((item) => item.provider === group.id);
            if (!options.length) return null;
            return (
              <div key={group.id} className="border-b last:border-b-0" style={{ borderColor: "#E5E7EB" }}>
                <div
                  className="px-4 pb-2 pt-3 text-[11px] font-bold uppercase tracking-wide"
                  style={{ color: "#9CA3AF" }}
                >
                  {group.label}
                </div>
                <div className="pb-2">
                  {options.map((item) => {
                    const itemValue = `${item.provider}::${item.id}`;
                    const active = itemValue === value;
                    const unavailable = !hasKey(item.provider);
                    return (
                      <button
                        key={itemValue}
                        type="button"
                        onClick={() => handlePick(item)}
                        disabled={unavailable}
                        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors"
                        style={{
                          color: unavailable ? "#9CA3AF" : "#111827",
                          cursor: unavailable ? "not-allowed" : "pointer",
                          background: "transparent",
                        }}
                        onMouseEnter={(e) => {
                          if (!unavailable) e.currentTarget.style.background = "#F9FAFB";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                        title={unavailable ? `Add a ${PROVIDER_NAMES[item.provider]} API key in Settings` : item.id}
                      >
                        <span className="truncate">
                          {item.provider === "ollama" ? item.label : modelLabel(item.id)}
                        </span>
                        {active && !unavailable && (
                          <span className="text-base" style={{ color: "#315A98" }}>
                            ✓
                          </span>
                        )}
                        {unavailable && (
                          <span
                            className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
                            style={{ border: "1px solid #EF4444", color: "#EF4444" }}
                          >
                            !
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
