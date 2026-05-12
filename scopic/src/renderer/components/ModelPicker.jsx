import React from "react";
import { DEFAULT_CLOUD_MODELS, MODEL_OPTIONS, modelLabel } from "../utils/constants.js";

const PROVIDER_NAMES = {
  ollama: "Local",
  anthropic: "Anthropic",
  gemini: "Google",
  openai: "OpenAI",
};

export default function ModelPicker({ settings, models, connected, onChange }) {
  const provider = settings?.provider || "ollama";
  const currentModel =
    provider === "ollama"
      ? settings?.model
      : settings?.cloudModels?.[provider] || DEFAULT_CLOUD_MODELS[provider]?.[0];
  const value = `${provider}::${currentModel || ""}`;

  const cloudOptions = MODEL_OPTIONS;
  const localModels = provider === "ollama" && models?.length ? models : [settings?.model || "phi3"];
  const ollamaOptions = localModels
    .filter(Boolean)
    .map((id) => ({ id, label: id, provider: "ollama", group: "Local Ollama" }));
  const allOptions = [...ollamaOptions, ...cloudOptions];
  const selected = allOptions.find((item) => `${item.provider}::${item.id}` === value);

  const handleChange = (e) => {
    const [nextProvider, nextModel] = e.target.value.split("::");
    onChange?.(nextProvider, nextModel);
  };

  const groups = ["Local Ollama", "Anthropic", "Google", "OpenAI"];

  return (
    <label
      className="flex items-center gap-2 h-9 rounded-lg border px-2.5 text-xs"
      style={{
        background: "#FFFFFF",
        borderColor: "#D8DEE8",
        color: "#475569",
      }}
      title="Choose the model for this chat"
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: connected ? "#16A34A" : "#DC2626" }}
      />
      <select
        value={value}
        onChange={handleChange}
        className="bg-transparent outline-none text-xs font-medium"
        style={{ color: "#1F2937", maxWidth: 190 }}
      >
        {groups.map((group) => {
          const options = allOptions.filter((item) => item.group === group);
          if (!options.length) return null;
          return (
            <optgroup key={group} label={group}>
              {options.map((item) => (
                <option key={`${item.provider}-${item.id}`} value={`${item.provider}::${item.id}`}>
                  {item.provider === "ollama"
                    ? `${PROVIDER_NAMES[item.provider]}: ${item.label}`
                    : modelLabel(item.id)}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
      <span className="hidden sm:inline text-[11px]" style={{ color: "#94A3B8" }}>
        {selected?.provider ? PROVIDER_NAMES[selected.provider] : ""}
      </span>
    </label>
  );
}
