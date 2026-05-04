import React, { useState, useMemo } from "react";

const PROVIDER_LABELS = {
  ollama: "Ollama",
  anthropic: "Claude",
  openai: "OpenAI",
  gemini: "Gemini",
};

function activeModelLabel(settings) {
  const provider = settings?.provider || "ollama";
  if (provider === "ollama") return settings?.model || "Connected";
  const model = settings?.cloudModels?.[provider];
  const label = PROVIDER_LABELS[provider] || provider;
  return model ? `${label} · ${model}` : label;
}

function offlineLabel(settings) {
  const provider = settings?.provider || "ollama";
  if (provider === "ollama") return "Ollama offline";
  return `${PROVIDER_LABELS[provider] || provider} — add API key`;
}

export default function Sidebar({
  conversations,
  projects,
  activeId,
  activeProjectId,
  connected,
  settings,
  activeMode,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onMoveConversation,
  onOpenSettings,
  onSetMode,
  onOpenDocumentVault,
  onNewProject,
  onEditProject,
  onSelectProject,
}) {
  const [hoveredId, setHoveredId] = useState(null);
  const [collapsed, setCollapsed] = useState(() => new Set());

  const grouped = useMemo(() => {
    const byProject = new Map();
    const ungrouped = [];
    for (const c of conversations) {
      if (c.projectId) {
        if (!byProject.has(c.projectId)) byProject.set(c.projectId, []);
        byProject.get(c.projectId).push(c);
      } else {
        ungrouped.push(c);
      }
    }
    return { byProject, ungrouped };
  }, [conversations]);

  const toggleCollapsed = (projectId) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

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

      {/* Projects header */}
      <div className="px-3 pt-3 pb-1 flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#4A5568" }}>
          Projects
        </span>
        <button
          onClick={onNewProject}
          className="text-xs px-1.5 py-0.5 rounded transition-colors"
          style={{ color: "#6B7280" }}
          title="New project"
          onMouseEnter={(e) => { e.currentTarget.style.color = "#C9A55C"; e.currentTarget.style.background = "#161B27"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#6B7280"; e.currentTarget.style.background = "transparent"; }}
        >
          + Project
        </button>
      </div>

      {/* List: projects (with their convs) + ungrouped */}
      <div className="flex-1 overflow-y-auto py-1">
        {projects.length === 0 && conversations.length === 0 ? (
          <div className="text-center text-xs px-4 py-8" style={{ color: "#4A5568" }}>
            No conversations yet.
            <br />
            Start a new one above, or create a project.
          </div>
        ) : null}

        {projects.map((proj) => {
          const convs = grouped.byProject.get(proj.id) || [];
          const isCollapsed = collapsed.has(proj.id);
          const isActiveProj = activeProjectId === proj.id;
          return (
            <div key={proj.id} className="mb-1">
              <div
                className="group flex items-center gap-1.5 mx-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors"
                style={{
                  background: isActiveProj ? "#161B27" : "transparent",
                  border: isActiveProj ? "1px solid #2A3347" : "1px solid transparent",
                }}
                onClick={() => onSelectProject?.(proj.id)}
                onMouseEnter={(e) => {
                  if (!isActiveProj) e.currentTarget.style.background = "#0F1726";
                }}
                onMouseLeave={(e) => {
                  if (!isActiveProj) e.currentTarget.style.background = "transparent";
                }}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); toggleCollapsed(proj.id); }}
                  className="w-4 h-4 flex items-center justify-center text-[10px]"
                  style={{ color: "#6B7280" }}
                >
                  {isCollapsed ? "▶" : "▼"}
                </button>
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: proj.color || "#C9A55C" }}
                />
                <span
                  className="flex-1 truncate text-xs font-medium"
                  style={{ color: isActiveProj ? "#E2E8F0" : "#9AA0B4" }}
                >
                  {proj.name}
                </span>
                <span className="text-[10px]" style={{ color: "#4A5568" }}>
                  {convs.length}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onEditProject(proj); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] px-1"
                  style={{ color: "#6B7280" }}
                  title="Edit project"
                >
                  ⚙
                </button>
              </div>

              {!isCollapsed && convs.map((conv) => (
                <ConversationRow
                  key={conv.id}
                  conv={conv}
                  active={activeId === conv.id}
                  hovered={hoveredId === conv.id}
                  setHovered={setHoveredId}
                  onSelect={() => onSelectConversation(conv.id)}
                  onDelete={() => onDeleteConversation(conv.id)}
                  onMove={onMoveConversation ? (pid) => onMoveConversation(conv.id, pid) : null}
                  projects={projects}
                  indent
                />
              ))}
            </div>
          );
        })}

        {grouped.ungrouped.length > 0 && (
          <>
            {projects.length > 0 && (
              <div className="px-3 pt-3 pb-1">
                <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#4A5568" }}>
                  Unassigned
                </span>
              </div>
            )}
            {grouped.ungrouped.map((conv) => (
              <ConversationRow
                key={conv.id}
                conv={conv}
                active={activeId === conv.id}
                hovered={hoveredId === conv.id}
                setHovered={setHoveredId}
                onSelect={() => onSelectConversation(conv.id)}
                onDelete={() => onDeleteConversation(conv.id)}
                onMove={onMoveConversation ? (pid) => onMoveConversation(conv.id, pid) : null}
                projects={projects}
              />
            ))}
          </>
        )}
      </div>

      {/* Footer: connection + settings */}
      <div className="px-3 pb-4 pt-2 border-t border-[#1E2535]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs min-w-0">
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: connected ? "#22C55E" : "#EF4444" }}
            />
            <span className="truncate" style={{ color: "#4A5568", maxWidth: 180 }}>
              {connected
                ? activeModelLabel(settings)
                : offlineLabel(settings)}
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}

function ConversationRow({ conv, active, hovered, setHovered, onSelect, onDelete, onMove, projects, indent }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div
      className={`relative group ${indent ? "mx-2 ml-7" : "mx-2"} my-0.5`}
      onMouseEnter={() => setHovered(conv.id)}
      onMouseLeave={() => { setHovered(null); setMenuOpen(false); }}
    >
      <button
        onClick={onSelect}
        className="w-full text-left px-3 py-2 rounded-lg transition-colors duration-100 text-sm"
        style={{
          background: active ? "#161B27" : "transparent",
          color: active ? "#E2E8F0" : "#6B7280",
          border: active ? "1px solid #2A3347" : "1px solid transparent",
        }}
      >
        <div className="truncate pr-10 text-xs">{conv.title || "Untitled"}</div>
        {conv.updatedAt && (
          <div className="text-[10px] mt-0.5" style={{ color: "#4A5568" }}>
            {new Date(conv.updatedAt).toLocaleDateString("en-US", {
              month: "numeric", day: "numeric", year: "numeric",
              hour: "numeric", minute: "2-digit",
            })}
          </div>
        )}
      </button>
      {hovered === conv.id && (
        <div className="absolute right-1 top-2 flex gap-0.5">
          {onMove && (
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
                className="w-5 h-5 flex items-center justify-center rounded text-gray-600 hover:text-gray-300 transition-colors"
                title="Move to project"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                </svg>
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 top-6 z-10 rounded-lg overflow-hidden text-xs min-w-[140px]"
                  style={{ background: "#161B27", border: "1px solid #2A3347", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => { onMove(null); setMenuOpen(false); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#1E2535]"
                    style={{ color: "#9AA0B4" }}
                  >
                    Unassigned
                  </button>
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { onMove(p.id); setMenuOpen(false); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-[#1E2535] flex items-center gap-2"
                      style={{ color: "#E8E8E8" }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color || "#C9A55C" }} />
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-5 h-5 flex items-center justify-center rounded text-gray-600 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
