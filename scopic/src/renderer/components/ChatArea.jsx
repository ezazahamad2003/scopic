import React, { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble.jsx";
import InputBar from "./InputBar.jsx";
import ScopicLogo from "./ScopicLogo.jsx";
import PrivacyChip from "./PrivacyChip.jsx";

function greetingForNow() {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Working late";
}

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
  draft,
  onDraftConsumed,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const showWelcome = messages.length === 0;
  const modeLabel = MODE_LABELS[activeMode];

  const currentModel =
    provider === "ollama"
      ? settings?.model
      : settings?.cloudModels?.[provider];

  return (
    <main
      className="flex flex-col flex-1 overflow-hidden"
      style={{ background: "var(--bg)" }}
    >
      {/* Privacy / model chip — always visible above any chat content */}
      <div className="flex justify-center pt-3 pb-1">
        <PrivacyChip settings={settings} provider={provider} model={currentModel} />
      </div>

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
          <div className="mx-auto w-full max-w-5xl px-6 mb-8 flex flex-col items-center text-center select-none">
            <ScopicLogo size={88} color="var(--text)" title="Scopic" />
            <h1
              className="text-4xl mt-6"
              style={{
                fontFamily: "DM Serif Display, Georgia, serif",
                color: "var(--text)",
                letterSpacing: "-0.015em",
                lineHeight: 1.15,
              }}
            >
              {greetingForNow()} — hi from <span style={{ color: "var(--accent-strong)" }}>Scopic</span>.
            </h1>
            <p
              className="text-sm mt-3 max-w-md"
              style={{ color: "var(--muted)" }}
            >
              Ask a legal question, drop in a contract, or pick a workflow below.
            </p>
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
