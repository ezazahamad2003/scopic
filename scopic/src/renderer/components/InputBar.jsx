import React, { useState, useRef, useEffect } from "react";

const ACCEPTED_TEXT_TYPES = [
  ".txt", ".md", ".json", ".js", ".ts", ".jsx", ".tsx",
  ".html", ".css", ".csv", ".py", ".xml", ".yaml", ".yml",
];
const ACCEPTED_BINARY_TYPES = [".pdf", ".docx"];
const ALL_ACCEPTED_TYPES = [...ACCEPTED_TEXT_TYPES, ...ACCEPTED_BINARY_TYPES];
const ACCEPT_ATTR = [
  ...ALL_ACCEPTED_TYPES,
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
].join(",");

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

export default function InputBar({ onSend, onStop, isStreaming, connected, activeMode }) {
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
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
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

  const placeholder =
    activeMode === "document_review"
      ? connected
        ? "Upload a document or paste contract text..."
        : "Start Ollama to begin..."
      : connected
      ? "Ask anything..."
      : "Start Ollama to begin chatting...";

  return (
    <div
      className="px-4 py-4 border-t border-[#1E2535]"
      style={{ background: "#0D1117" }}
    >
      {!connected && (
        <div
          className="mb-3 px-4 py-2 rounded-lg text-sm flex items-center gap-2"
          style={{
            background: "#1a1500",
            border: "1px solid #3a2e0033",
            color: "#EAB308",
          }}
        >
          <span>⚠️</span>
          <span>Ollama not detected. Please start Ollama to use Scopic.</span>
        </div>
      )}

      {/* Attached file chip */}
      {attachedFile && (
        <div className="mb-2 flex items-center gap-2">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
            style={{
              background: attachedFile.error ? "#2a1010" : "#1a2535",
              border: `1px solid ${attachedFile.error ? "#6b1010" : "#2A3F6F"}`,
              color: attachedFile.error ? "#EF4444" : "#7BA4FF",
            }}
          >
            <span>{attachedFile.error ? "⚠️" : "📄"}</span>
            <span className="truncate max-w-xs">
              {attachedFile.error ? attachedFile.error : attachedFile.name}
            </span>
            <button
              onClick={() => setAttachedFile(null)}
              className="ml-1 hover:opacity-70 transition-opacity"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div
        className="flex items-end gap-3 rounded-2xl px-4 py-3"
        style={{ background: "#141820", border: "1px solid #2A3347" }}
      >
        {/* File upload button */}
        <button
          onClick={handleFileClick}
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mb-0.5 transition-all duration-150"
          style={{
            background: "#1E2535",
            border: "1px solid #2A3347",
            color: "#6B7280",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#C9A55C44";
            e.currentTarget.style.color = "#C9A55C";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#2A3347";
            e.currentTarget.style.color = "#6B7280";
          }}
          title="Attach document (.txt, .md, .pdf, .docx, etc.)"
          type="button"
        >
          <span className="text-lg leading-none">+</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={ACCEPT_ATTR}
          onChange={handleFileChange}
        />

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={!connected || isStreaming}
          rows={1}
          className="flex-1 bg-transparent text-sm placeholder-gray-600 resize-none outline-none leading-relaxed"
          style={{ maxHeight: 160, overflowY: "auto", color: "#E2E8F0" }}
        />

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            if (isStreaming) {
              if (typeof onStop === "function") onStop();
            } else {
              handleSend();
            }
          }}
          disabled={!isStreaming && !canSend}
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 mb-0.5"
          style={{
            background: isStreaming
              ? "#DC2626"
              : canSend
              ? "linear-gradient(135deg, #3A5A9F, #2A4A8F)"
              : "#1E2535",
            border: "none",
            color: isStreaming ? "#FFFFFF" : canSend ? "#FFFFFF" : "#4A5568",
            cursor: isStreaming || canSend ? "pointer" : "not-allowed",
          }}
          title={isStreaming ? "Stop response" : "Send"}
        >
          {isStreaming ? (
            <div className="w-3 h-3 rounded-sm" style={{ background: "#FFFFFF" }} />
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>

      <p className="text-center text-xs mt-2" style={{ color: "#374151" }}>
        A reminder that Scopic is an AI assistant providing information, not legal advice.
        No attorney-client relationship is formed here, and always review outputs with a qualified professional.
      </p>
    </div>
  );
}
