import React, { useState } from "react";

export default function Sidebar({
  conversations,
  activeId,
  connected,
  settings,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onOpenSettings,
}) {
  const [hoveredId, setHoveredId] = useState(null);

  return (
    <aside
      className="flex flex-col sidebar-gradient border-r border-[#2A3347]"
      style={{ width: 280, minWidth: 280, height: "100%" }}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#2A3347]">
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
            style={{ background: "linear-gradient(135deg, #C9A55C, #A8874A)" }}
          >
            S
          </div>
          <span
            className="text-xl font-semibold tracking-tight"
            style={{ fontFamily: "DM Serif Display, serif", color: "#C9A55C" }}
          >
            Scopic
          </span>
        </div>

        <button
          onClick={onNewConversation}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-150"
          style={{
            background: "linear-gradient(135deg, #C9A55C22, #C9A55C11)",
            border: "1px solid #C9A55C44",
            color: "#C9A55C",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background =
              "linear-gradient(135deg, #C9A55C33, #C9A55C22)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background =
              "linear-gradient(135deg, #C9A55C22, #C9A55C11)";
          }}
        >
          <span className="text-lg leading-none">+</span>
          New Conversation
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto py-2">
        {conversations.length === 0 ? (
          <div className="text-center text-gray-500 text-xs px-4 py-8">
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
                  background:
                    activeId === conv.id ? "#1E2535" : "transparent",
                  color: activeId === conv.id ? "#E8E8E8" : "#9AA0B4",
                  border:
                    activeId === conv.id
                      ? "1px solid #2A3347"
                      : "1px solid transparent",
                }}
              >
                <div className="truncate pr-6">{conv.title || "Untitled"}</div>
              </button>
              {hoveredId === conv.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(conv.id);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-red-400 hover:bg-[#2A3347] transition-colors"
                  title="Delete"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer: connection status + settings */}
      <div className="px-4 py-3 border-t border-[#2A3347]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: connected ? "#22C55E" : "#EF4444" }}
            />
            <span className="text-gray-400 truncate" style={{ maxWidth: 150 }}>
              {connected ? settings?.model || "Connected" : "Ollama offline"}
            </span>
          </div>
          <button
            onClick={onOpenSettings}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#C9A55C] hover:bg-[#1E2535] transition-colors"
            title="Settings"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
