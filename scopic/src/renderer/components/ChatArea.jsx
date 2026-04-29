import React, { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble.jsx";
import InputBar from "./InputBar.jsx";
import WelcomeScreen from "./WelcomeScreen.jsx";

const MODE_LABELS = {
  document_review: "Document Review",
  agentic_debate: "Agentic Debate",
  general: null,
};

export default function ChatArea({
  messages,
  isStreaming,
  connected,
  onSend,
  conversationId,
  activeMode,
  onSetMode,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const showWelcome = messages.length === 0;
  const modeLabel = MODE_LABELS[activeMode];

  return (
    <main
      className="flex flex-col flex-1 overflow-hidden"
      style={{ background: "#0D1117" }}
    >
      {/* Mode indicator banner */}
      {modeLabel && (
        <div
          className="flex items-center justify-center gap-2 py-1.5 text-xs font-medium border-b"
          style={{
            background: activeMode === "document_review" ? "#0D1528" : "#140D28",
            borderColor: activeMode === "document_review" ? "#1E3060" : "#2A1E50",
            color: activeMode === "document_review" ? "#7BA4FF" : "#A78BFA",
          }}
        >
          <span>{activeMode === "document_review" ? "⚖️" : "✦"}</span>
          <span>{modeLabel} Mode</span>
          <button
            onClick={() => onSetMode("general")}
            className="ml-2 text-xs opacity-50 hover:opacity-100 transition-opacity"
          >
            ✕ Exit
          </button>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {showWelcome ? (
          <WelcomeScreen onSuggestion={onSend} onSetMode={onSetMode} />
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-6">
            {messages.map((msg, idx) => {
              const isLast = idx === messages.length - 1;
              const isStreamingThis =
                isStreaming && isLast && msg.role === "assistant";
              return (
                <MessageBubble
                  key={`${conversationId}-${idx}`}
                  message={msg}
                  isStreaming={isStreamingThis}
                />
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <InputBar
        onSend={onSend}
        isStreaming={isStreaming}
        connected={connected}
        activeMode={activeMode}
      />
    </main>
  );
}
