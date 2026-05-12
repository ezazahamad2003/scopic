import React from "react";
import { renderMarkdown } from "../utils/markdown.js";
import scopicBlackLogo from "../assets/scopic-black.png";

export default function MessageBubble({ message, isStreaming }) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const isThinking = isAssistant && isStreaming && message.content === "";

  return (
    <div
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"} mb-4`}
    >
      {/* Avatar for assistant */}
      {isAssistant && (
        <div
          className="w-8 h-8 rounded-lg flex-shrink-0 mr-3 flex items-center justify-center text-xs font-bold mt-0.5"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--text)",
          }}
        >
          <img src={scopicBlackLogo} alt="" className="theme-invert-logo h-5 w-5 object-contain" />
        </div>
      )}

      <div
        className={`max-w-[78%] ${
          isUser
            ? "rounded-2xl rounded-tr-sm px-4 py-3"
            : "rounded-2xl rounded-tl-sm px-4 py-3"
        }`}
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
                  className="w-1.5 h-1.5 rounded-full bg-[#315A98] animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
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
