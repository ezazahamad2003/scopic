import React, { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble.jsx";
import InputBar from "./InputBar.jsx";

const MODE_LABELS = {
  document_review: "Document Review",
  general: null,
};

export default function ChatArea({
  messages,
  isStreaming,
  connected,
  onSend,
  onStop,
  conversationId,
  activeMode,
  onSetMode,
  provider,
  activeProject,
  onClearProject,
  onOpenProjects,
  onOpenWorkflows,
  settings,
  models,
  onChangeModel,
  onRunPipeline,
  onPickWorkflow,
  draft,
  onDraftConsumed,
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
      style={{ background: "var(--bg)" }}
    >
      {/* Project context banner */}
      {activeProject && (
        <div
          className="flex items-center justify-center gap-2 py-1.5 text-xs font-medium border-b"
          style={{
            background: "var(--surface-soft)",
            borderColor: "var(--border)",
            color: "var(--accent-strong)",
          }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: activeProject.color || "var(--accent)" }}
          />
          <span>Project: {activeProject.name}</span>
          {onClearProject && (
            <button
              onClick={onClearProject}
              className="ml-2 text-xs opacity-50 hover:opacity-100 transition-opacity"
              title="Leave project context"
            >
              ✕ Leave
            </button>
          )}
        </div>
      )}

      {/* Mode indicator banner */}
      {modeLabel && (
        <div
          className="flex items-center justify-center gap-2 py-1.5 text-xs font-medium border-b"
          style={{
            background: "var(--surface-soft)",
            borderColor: "var(--border)",
            color: "var(--accent-strong)",
          }}
        >
          <span>⚖️</span>
          <span>{modeLabel} Mode</span>
          <button
            onClick={() => onSetMode("general")}
            className="ml-2 text-xs opacity-50 hover:opacity-100 transition-opacity"
          >
            ✕ Exit
          </button>
        </div>
      )}

      {showWelcome ? (
        <div className="flex flex-1 flex-col justify-center pb-16">
          <InputBar
            onSend={onSend}
            onStop={onStop}
            isStreaming={isStreaming}
            connected={connected}
            activeMode={activeMode}
            provider={provider}
            onOpenProjects={onOpenProjects}
            onOpenWorkflows={onOpenWorkflows}
            draft={draft}
            onDraftConsumed={onDraftConsumed}
            settings={settings}
            models={models}
            onChangeModel={onChangeModel}
          />
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto">
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
          </div>

          <InputBar
            onSend={onSend}
            onStop={onStop}
            isStreaming={isStreaming}
            connected={connected}
            activeMode={activeMode}
            provider={provider}
            onOpenProjects={onOpenProjects}
            onOpenWorkflows={onOpenWorkflows}
            draft={draft}
            onDraftConsumed={onDraftConsumed}
            settings={settings}
            models={models}
            onChangeModel={onChangeModel}
          />
        </>
      )}
    </main>
  );
}
