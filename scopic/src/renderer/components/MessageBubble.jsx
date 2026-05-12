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

  // Assistant: full-width, no surrounding box — text flows on the chat
  // background like Claude. The logo sits to the left, large, no chrome.
  if (isAssistant) {
    return (
      <div className="flex w-full gap-4 mb-8">
        <div className="flex-shrink-0 pt-1" style={{ width: 40 }}>
          <ScopicLogo size={32} color="var(--text)" />
        </div>
        <div className="flex-1 min-w-0">
          {isThinking ? (
            <div className="flex items-center gap-1.5 py-1">
              <span className="text-sm italic" style={{ color: "var(--muted)" }}>Thinking</span>
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
          ) : (
            <div
              className={`prose-legal ${
                isStreaming && !message.isError ? "streaming-cursor" : ""
              }`}
              style={{ color: message.isError ? "var(--danger)" : "var(--text)" }}
              dangerouslySetInnerHTML={{
                __html: renderMarkdown(message.content),
              }}
            />
          )}

          {showActions && (
            <div className="flex items-center gap-1 mt-3 -ml-1 text-[11px]" style={{ color: "var(--muted)" }}>
              <ActionButton onClick={handleCopy} title="Copy to clipboard">
                {copied ? "Copied" : "Copy"}
              </ActionButton>
              <ActionButton onClick={() => handleDownload("md")} title="Download as Markdown">
                .md
              </ActionButton>
              <ActionButton onClick={() => handleDownload("txt")} title="Download as plain text">
                .txt
              </ActionButton>
            </div>
          )}
        </div>
      </div>
    );
  }

  // User: subtle pill on the right.
  return (
    <div className="flex w-full justify-end mb-6">
      <div
        className="max-w-[78%] rounded-2xl px-4 py-2.5"
        style={{
          background: "var(--surface-soft)",
          border: "1px solid var(--border-soft)",
          color: "var(--text)",
        }}
      >
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>
      </div>
    </div>
  );
}

function ActionButton({ children, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="px-2 py-1 rounded transition-colors"
      style={{ color: "var(--muted)" }}
      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; e.currentTarget.style.background = "var(--surface-soft)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; e.currentTarget.style.background = "transparent"; }}
    >
      {children}
    </button>
  );
}
