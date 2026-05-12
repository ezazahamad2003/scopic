import React, { useState, useRef, useEffect } from "react";
import ModelPicker from "./ModelPicker.jsx";

const ACCEPTED_TEXT_TYPES = [
  ".txt", ".md", ".json", ".js", ".ts", ".jsx", ".tsx",
  ".html", ".css", ".py", ".xml", ".yaml", ".yml",
];
const ACCEPTED_BINARY_TYPES = [".pdf", ".docx", ".csv", ".tsv", ".xlsx", ".xls"];
const ALL_ACCEPTED_TYPES = [...ACCEPTED_TEXT_TYPES, ...ACCEPTED_BINARY_TYPES];
const ACCEPT_ATTR = [
  ...ALL_ACCEPTED_TYPES,
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "text/plain",
].join(",");

const PROVIDER_LABELS = {
  ollama: "Ollama",
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Google Gemini",
};

function providerLabel(p) {
  return PROVIDER_LABELS[p] || "provider";
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file, "utf-8");
  });
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

export default function InputBar({
  onSend,
  onStop,
  isStreaming,
  connected,
  activeMode,
  provider,
  settings,
  models,
  onChangeModel,
  draft,
  onDraftConsumed,
}) {
  const [value, setValue] = useState("");
  const [attachedFile, setAttachedFile] = useState(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [value]);

  // When the parent drops a workflow draft into us, prefill the textarea,
  // focus, and select the first "[bracketed placeholder]" so the user can
  // type over it. Then notify the parent so the draft prop clears.
  useEffect(() => {
    if (!draft) return;
    setValue(draft);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      const match = draft.match(/\[[^\]]+\]/);
      if (match && match.index != null) {
        ta.setSelectionRange(match.index, match.index + match[0].length);
      } else {
        ta.setSelectionRange(draft.length, draft.length);
      }
      ta.scrollTop = ta.scrollHeight;
    });
    onDraftConsumed?.();
  }, [draft, onDraftConsumed]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if ((!value.trim() && !attachedFile) || isStreaming || !connected) return;

    let messageContent = value.trim();

    if (attachedFile) {
      messageContent = messageContent
        ? `${messageContent}\n\n---\n\n**Document: ${attachedFile.name}**\n\n\`\`\`\n${attachedFile.content}\n\`\`\``
        : `Please review the following document: **${attachedFile.name}**\n\n---\n\n\`\`\`\n${attachedFile.content}\n\`\`\``;
    }

    onSend(messageContent);
    setValue("");
    setAttachedFile(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!ALL_ACCEPTED_TYPES.includes(ext)) {
      setAttachedFile({
        name: file.name,
        content: null,
        error: `Unsupported file type. Supported: ${ALL_ACCEPTED_TYPES.join(", ")}`,
      });
      return;
    }

    const maxSize = ACCEPTED_BINARY_TYPES.includes(ext) ? 10 * 1024 * 1024 : 500 * 1024;
    if (file.size > maxSize) {
      setAttachedFile({
        name: file.name,
        content: null,
        error: `File too large (max ${ACCEPTED_BINARY_TYPES.includes(ext) ? "10 MB" : "500 KB"}).`,
      });
      return;
    }

    try {
      let text;
      if (ACCEPTED_BINARY_TYPES.includes(ext)) {
        const buffer = await readFileAsArrayBuffer(file);
        const result = await window.fileParser.parse(buffer, file.name);
        if (result.error) throw new Error(result.error);
        text = result.text;
      } else {
        text = await readFileAsText(file);
      }
      setAttachedFile({ name: file.name, content: text, error: null });
    } catch (err) {
      setAttachedFile({ name: file.name, content: null, error: err.message || "Could not read file." });
    }
  };

  const canSend = (value.trim() || (attachedFile && !attachedFile.error)) && !isStreaming && connected;
  const offlineHint = provider === "ollama" ? "Start Ollama to begin..." : "Add an API key in Settings...";
  const placeholder =
    activeMode === "document_review"
      ? connected
        ? "Upload a document or paste contract text..."
        : offlineHint
      : connected
      ? "Ask Scopic about a matter, clause, filing, or workflow..."
      : offlineHint;

  return (
    <div className="px-5 py-4 border-t" style={{ background: "#FBFAF7", borderColor: "#E7E0D2" }}>
      {!connected && (
        <div
          className="mb-3 px-4 py-3 rounded-lg text-sm"
          style={{ background: "#FFF7ED", border: "1px solid #FED7AA", color: "#9A3412" }}
        >
          {provider === "ollama" ? (
            <div>
              <div className="font-medium mb-1">Ollama is not detected.</div>
              <div className="text-xs leading-relaxed">
                Run <code className="px-1.5 py-0.5 rounded bg-white">ollama serve</code>, or pick a cloud model and add its API key.
              </div>
            </div>
          ) : (
            <div>
              API key not set. Open Settings and add your {providerLabel(provider)} key, or pick a ready local model.
            </div>
          )}
        </div>
      )}

      {attachedFile && (
        <div className="mb-2 flex items-center gap-2">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
            style={{
              background: attachedFile.error ? "#FEF2F2" : "#EEF6FF",
              border: `1px solid ${attachedFile.error ? "#FECACA" : "#BFDBFE"}`,
              color: attachedFile.error ? "#DC2626" : "#1D4ED8",
            }}
          >
            <span>{attachedFile.error ? "!" : "doc"}</span>
            <span className="truncate max-w-xs">
              {attachedFile.error ? attachedFile.error : attachedFile.name}
            </span>
            <button onClick={() => setAttachedFile(null)} className="ml-1 hover:opacity-70 transition-opacity">
              x
            </button>
          </div>
        </div>
      )}

      <div
        className="flex items-end gap-3 rounded-xl px-4 py-3 shadow-sm"
        style={{ background: "#FFFFFF", border: "1px solid #D8DEE8" }}
      >
        <div className="hidden md:block mb-0.5">
          <ModelPicker settings={settings} models={models} connected={connected} onChange={onChangeModel} />
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mb-0.5 transition-all duration-150"
          style={{ background: "#F8FAFC", border: "1px solid #D8DEE8", color: "#64748B" }}
          title="Attach document"
          type="button"
        >
          +
        </button>

        <input ref={fileInputRef} type="file" className="hidden" accept={ACCEPT_ATTR} onChange={handleFileChange} />

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={!connected || isStreaming}
          rows={1}
          className="flex-1 bg-transparent text-sm placeholder-gray-400 resize-none outline-none leading-relaxed"
          style={{ maxHeight: 160, overflowY: "auto", color: "#1F2937" }}
        />

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            if (isStreaming) onStop?.();
            else handleSend();
          }}
          disabled={!isStreaming && !canSend}
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150 mb-0.5"
          style={{
            background: isStreaming ? "#DC2626" : canSend ? "#111827" : "#E5E7EB",
            color: isStreaming || canSend ? "#FFFFFF" : "#94A3B8",
            cursor: isStreaming || canSend ? "pointer" : "not-allowed",
          }}
          title={isStreaming ? "Stop response" : "Send"}
        >
          {isStreaming ? (
            <div className="w-3 h-3 rounded-sm" style={{ background: "#FFFFFF" }} />
          ) : (
            <span style={{ fontSize: 15, lineHeight: 1 }}>↑</span>
          )}
        </button>
      </div>

      <div className="mt-2 md:hidden">
        <ModelPicker settings={settings} models={models} connected={connected} onChange={onChangeModel} />
      </div>

      <p className="text-center text-xs mt-2" style={{ color: "#8A8174" }}>
        Scopic provides legal information, not legal advice. Review outputs with a qualified professional.
      </p>
    </div>
  );
}
