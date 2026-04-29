import React, { useState } from "react";

export default function Sidebar({
  conversations,
  activeId,
  connected,
  settings,
  activeMode,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onOpenSettings,
  onSetMode,
  onOpenDocumentVault,
}) {
  const [hoveredId, setHoveredId] = useState(null);

  return (
    <aside
      className="flex flex-col border-r border-[#2A3347]"
      style={{ width: 280, minWidth: 280, height: "100%", background: "#0D1117" }}
    >
      {/* Logo */}
      <div className="px-5 pt-5 pb-4 border-b border-[#2A3347]">
        <div className="mb-4">
          <span
            className="text-sm font-bold tracking-widest"
            style={{ color: "#FFFFFF", letterSpacing: "0.12em" }}
          >
            SCOPIC LEGAL
          </span>
          <p className="text-xs mt-0.5" style={{ color: "#4A5568" }}>
            Private Beta Program
          </p>
        </div>

        <button
          onClick={onNewConversation}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all duration-150"
          style={{
            background: "#161B27",
            border: "1px solid #2A3347",
            color: "#E2E8F0",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#1E2535";
            e.currentTarget.style.borderColor = "#C9A55C44";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#161B27";
            e.currentTarget.style.borderColor = "#2A3347";
          }}
        >
          <span className="text-base leading-none">+</span>
          New Chat
        </button>
      </div>

      {/* Mode buttons */}
      <div className="px-3 pt-3 pb-2 space-y-1">
        <button
          onClick={() => onSetMode("document_review")}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
          style={{
            background: activeMode === "document_review" ? "#1E2535" : "transparent",
            border:
              activeMode === "document_review"
                ? "1px solid #2A3347"
                : "1px solid transparent",
            color: activeMode === "document_review" ? "#E2E8F0" : "#6B7280",
          }}
          onMouseEnter={(e) => {
            if (activeMode !== "document_review") {
              e.currentTarget.style.background = "#161B27";
              e.currentTarget.style.color = "#9AA0B4";
            }
          }}
          onMouseLeave={(e) => {
            if (activeMode !== "document_review") {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#6B7280";
            }
          }}
        >
          <span className="text-base leading-none w-5 text-center">⚖️</span>
          Document Review
        </button>

        <button
          onClick={onOpenDocumentVault}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
          style={{
            background: "transparent",
            border: "1px solid transparent",
            color: "#6B7280",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#161B27";
            e.currentTarget.style.color = "#9AA0B4";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#6B7280";
          }}
        >
          <span className="text-base leading-none w-5 text-center">📁</span>
          Document Vault
        </button>
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-[#1E2535]" />

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto py-2">
        {conversations.length === 0 ? (
          <div className="text-center text-xs px-4 py-8" style={{ color: "#4A5568" }}>
            No conversations yet.
            <br />
            Start a new one above.
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className="relative group mx-2 my-0.5"
              onMouseEnter={() => setHoveredId(conv.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <button
                onClick={() => onSelectConversation(conv.id)}
                className="w-full text-left px-3 py-2.5 rounded-lg transition-colors duration-100 text-sm"
                style={{
                  background: activeId === conv.id ? "#161B27" : "transparent",
                  color: activeId === conv.id ? "#E2E8F0" : "#6B7280",
                  border:
                    activeId === conv.id ? "1px solid #2A3347" : "1px solid transparent",
                }}
              >
                <div className="truncate pr-6 text-xs">{conv.title || "Untitled"}</div>
                {conv.updatedAt && (
                  <div className="text-xs mt-0.5" style={{ color: "#4A5568" }}>
                    {new Date(conv.updatedAt).toLocaleDateString("en-US", {
                      month: "numeric",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                )}
              </button>
              {hoveredId === conv.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(conv.id);
                  }}
                  className="absolute right-2 top-3 w-5 h-5 flex items-center justify-center rounded text-gray-600 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M9 3L3 9M3 3l6 6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer: connection + settings */}
      <div className="px-3 pb-4 pt-2 border-t border-[#1E2535]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: connected ? "#22C55E" : "#EF4444" }}
            />
            <span className="truncate" style={{ color: "#4A5568", maxWidth: 140 }}>
              {connected ? settings?.model || "Connected" : "Ollama offline"}
            </span>
          </div>
          <button
            onClick={onOpenSettings}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: "#4A5568" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#C9A55C";
              e.currentTarget.style.background = "#161B27";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#4A5568";
              e.currentTarget.style.background = "transparent";
            }}
            title="Settings"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
