import React from "react";
import { renderMarkdown } from "../utils/markdown.js";

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
            background: "linear-gradient(135deg, #315A98, #244876)",
            color: "#FFFFFF",
          }}
        >
          S
        </div>
      )}

      <div
        className={`max-w-[78%] ${
          isUser
            ? "rounded-2xl rounded-tr-sm px-4 py-3"
            : "rounded-2xl rounded-tl-sm px-4 py-3"
        }`}
        style={{
          background: isUser ? "#1E3A5F" : "#FFFFFF",
          border: isUser ? "1px solid #2A5080" : "1px solid #D8DEE8",
          color: message.isError ? "#EF4444" : "#1F2937",
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
          style={{ background: "#1E3A5F", border: "1px solid #2A5080", color: "#7DB3E8" }}
        >
          U
        </div>
      )}
    </div>
  );
}
