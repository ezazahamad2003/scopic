import React, { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble.jsx";
import InputBar from "./InputBar.jsx";
import WelcomeScreen from "./WelcomeScreen.jsx";

export default function ChatArea({
  messages,
  isStreaming,
  connected,
  onSend,
  conversationId,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const showWelcome = messages.length === 0;

  return (
    <main className="flex flex-col flex-1 overflow-hidden" style={{ background: "#0F1117" }}>
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {showWelcome ? (
          <WelcomeScreen onSuggestion={onSend} />
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
      />
    </main>
  );
}
