import React, { useState, useRef, useEffect } from "react";

export default function InputBar({ onSend, isStreaming, connected }) {
  const [value, setValue] = useState("");
  const textareaRef = useRef(null);

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
    if (!value.trim() || isStreaming || !connected) return;
    onSend(value);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const canSend = value.trim() && !isStreaming && connected;

  return (
    <div
      className="px-4 py-4 border-t border-[#2A3347]"
      style={{ background: "#0F1117" }}
    >
      {!connected && (
        <div
          className="mb-3 px-4 py-2 rounded-lg text-sm text-yellow-400 flex items-center gap-2"
          style={{ background: "#2a2010", border: "1px solid #6b4f0033" }}
        >
          <span>⚠️</span>
          <span>
            Ollama not detected. Please start Ollama to use Scopic.
          </span>
        </div>
      )}

      <div
        className="flex items-end gap-3 rounded-xl px-4 py-3"
        style={{ background: "#161B27", border: "1px solid #2A3347" }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            connected
              ? "Ask a legal question... (Enter to send, Shift+Enter for newline)"
              : "Start Ollama to begin chatting..."
          }
          disabled={!connected || isStreaming}
          rows={1}
          className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 resize-none outline-none leading-relaxed"
          style={{ maxHeight: 160, overflowY: "auto" }}
        />

        <button
          onClick={handleSend}
          disabled={!canSend}
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150"
          style={{
            background: canSend
              ? "linear-gradient(135deg, #C9A55C, #A8874A)"
              : "#1E2535",
            color: canSend ? "#0F1117" : "#4A5568",
            cursor: canSend ? "pointer" : "not-allowed",
          }}
        >
          {isStreaming ? (
            <div
              className="w-3 h-3 rounded-sm"
              style={{ background: "#4A5568" }}
            />
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

      <p className="text-center text-gray-600 text-xs mt-2">
        Scopic may make mistakes. Always verify legal information with a qualified attorney.
      </p>
    </div>
  );
}
