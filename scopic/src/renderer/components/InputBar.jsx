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
  onOpenProjects,
  onOpenWorkflows,
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
        Math.min(textareaRef.current.scrollHeight, 170) + "px";
    }
  }, [value]);

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
        ? "Ask a question about your documents..."
        : offlineHint
      : connected
      ? "Ask a question about your documents..."
      : offlineHint;

  const actionStyle = { color: "var(--muted)" };

  return (
    <div className="px-6 pt-3 pb-5" style={{ background: "var(--bg)" }}>
      {!connected && (
        <div
          className="mx-auto mb-3 max-w-5xl px-4 py-3 rounded-lg text-sm"
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
        <div className="mx-auto mb-2 flex max-w-5xl items-center gap-2">
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
        className="mx-auto flex max-w-5xl flex-col gap-5 rounded-3xl px-5 py-5"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 18px 45px var(--shadow)" }}
      >
        <input ref={fileInputRef} type="file" className="hidden" accept={ACCEPT_ATTR} onChange={handleFileChange} />

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={!connected || isStreaming}
          rows={1}
          className="w-full bg-transparent text-base placeholder-gray-400 resize-none outline-none leading-relaxed"
          style={{ minHeight: 32, maxHeight: 170, overflowY: "auto", color: "var(--text)" }}
        />

        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-5">
            <button
              onClick={() => {
                fileInputRef.current?.click();
              }}
              className="text-sm font-medium transition-colors"
              style={actionStyle}
              title="Add documents"
              type="button"
            >
              + Documents
            </button>
            <button
              onClick={onOpenProjects}
              className="text-sm font-medium transition-colors"
              style={actionStyle}
              title="Open projects"
              type="button"
            >
              Projects
            </button>
            <button
              onClick={onOpenWorkflows}
              className="text-sm font-medium transition-colors"
              style={actionStyle}
              title="Open workflows"
              type="button"
            >
              Workflows
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <ModelPicker settings={settings} models={models} connected={connected} onChange={onChangeModel} />
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (isStreaming) onStop?.();
                else handleSend();
              }}
              disabled={!isStreaming && !canSend}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-150"
              style={{
                background: isStreaming ? "var(--danger)" : canSend ? "var(--button)" : "var(--surface-soft)",
                color: isStreaming || canSend ? "var(--button-text)" : "var(--muted-2)",
                cursor: isStreaming || canSend ? "pointer" : "not-allowed",
                boxShadow: canSend ? "0 8px 18px rgba(17, 24, 39, 0.2)" : "none",
              }}
              title={isStreaming ? "Stop response" : "Send"}
            >
              {isStreaming ? (
                <div className="w-3 h-3 rounded-sm" style={{ background: "#FFFFFF" }} />
              ) : (
                <span style={{ fontSize: 18, lineHeight: 1 }}>-&gt;</span>
              )}
            </button>
          </div>
        </div>
      </div>

      <p className="text-center text-xs mt-3" style={{ color: "var(--muted)" }}>
        AI can make mistakes. Answers are not legal advice.
      </p>
    </div>
  );
}
