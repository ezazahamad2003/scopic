import React, { useState } from "react";
import { renderMarkdown } from "../utils/markdown.js";
import ScopicLogo from "./ScopicLogo.jsx";

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function defaultFilename(content, ext) {
  const firstLine = (content || "")
    .split("\n")
    .map((s) => s.replace(/[#*>`_~\-]+/g, "").trim())
    .find((s) => s.length > 0) || "scopic-message";
  const slug = firstLine
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "scopic-message";
  return `${slug}.${ext}`;
}

export default function MessageBubble({ message, isStreaming }) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const isThinking = isAssistant && isStreaming && message.content === "";
  const [copied, setCopied] = useState(false);

  const showActions = isAssistant && !isThinking && !isStreaming && !message.isError && (message.content || "").trim().length > 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard may not be available — fall back to a download.
      downloadBlob(message.content || "", defaultFilename(message.content, "md"), "text/markdown");
    }
  };

  const handleDownload = (ext) => {
    const mime = ext === "md" ? "text/markdown" : "text/plain";
    downloadBlob(message.content || "", defaultFilename(message.content, ext), mime);
  };

  return (
    <div
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"} mb-4`}
    >
      {/* Avatar for assistant */}
      {isAssistant && (
        <div
          className="w-8 h-8 rounded-lg flex-shrink-0 mr-3 flex items-center justify-center mt-0.5"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--text)",
          }}
        >
          <ScopicLogo size={18} color="var(--text)" />
        </div>
      )}

      <div className={`max-w-[78%] flex flex-col ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={
            isUser
              ? "rounded-2xl rounded-tr-sm px-4 py-3"
              : "rounded-2xl rounded-tl-sm px-4 py-3"
          }
          style={{
            background: isUser ? "var(--surface-soft)" : "var(--surface)",
            border: "1px solid var(--border)",
            color: message.isError ? "var(--danger)" : "var(--text)",
          }}
        >
          {isThinking ? (
            <div className="flex items-center gap-1.5 py-1">
              <span className="text-gray-500 text-sm italic">Thinking</span>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 150}ms`, background: "var(--accent)" }}
                  />
                ))}
              </div>
            </div>
          ) : isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          ) : (
            <div
              className={`prose-legal text-sm ${
                isStreaming && !message.isError ? "streaming-cursor" : ""
              }`}
              dangerouslySetInnerHTML={{
                __html: renderMarkdown(message.content),
              }}
            />
          )}
        </div>

        {showActions && (
          <div className="flex items-center gap-1 mt-1.5 ml-1 text-[11px]" style={{ color: "var(--muted)" }}>
            <ActionButton onClick={handleCopy} title="Copy to clipboard">
              {copied ? "Copied" : "Copy"}
            </ActionButton>
            <span style={{ color: "var(--border)" }}>·</span>
            <ActionButton onClick={() => handleDownload("md")} title="Download as Markdown">
              Download .md
            </ActionButton>
            <span style={{ color: "var(--border)" }}>·</span>
            <ActionButton onClick={() => handleDownload("txt")} title="Download as plain text">
              .txt
            </ActionButton>
          </div>
        )}
      </div>

      {/* Avatar for user */}
      {isUser && (
        <div
          className="w-8 h-8 rounded-lg flex-shrink-0 ml-3 flex items-center justify-center text-xs font-bold mt-0.5"
          style={{ background: "var(--surface-soft)", border: "1px solid var(--border)", color: "var(--text)" }}
        >
          U
        </div>
      )}
    </div>
  );
}

function ActionButton({ children, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="px-1.5 py-0.5 rounded transition-colors"
      style={{ color: "var(--muted)" }}
      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; e.currentTarget.style.background = "var(--surface-soft)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; e.currentTarget.style.background = "transparent"; }}
    >
      {children}
    </button>
  );
}
