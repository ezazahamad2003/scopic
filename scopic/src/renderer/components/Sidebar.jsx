import React, { useState, useMemo } from "react";
import scopicBlackLogo from "../assets/scopic-black.png";
import scopicWhiteLogo from "../assets/scopic-white.png";

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

const NAV_ITEMS = [
  { id: "assistant", label: "Assistant", icon: ChatIcon },
  { id: "projects", label: "Projects", icon: FolderIcon },
  { id: "tabular", label: "Tabular Review", icon: TableIcon },
  { id: "workflows", label: "Workflows", icon: WorkflowIcon },
];

export default function Sidebar({
  conversations,
  projects,
  activeId,
  activeProjectId,
  activeView,
  connected,
  settings,
  theme,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onMoveConversation,
  onOpenSettings,
  onChangeView,
}) {
  const [hoveredId, setHoveredId] = useState(null);
  const [collapsedProjects, setCollapsedProjects] = useState(() => new Set());
  const [historyOpen, setHistoryOpen] = useState(true);

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

  const toggleProject = (id) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <aside
      className="flex flex-col border-r "
      style={{ width: 260, minWidth: 260, height: "100%", background: "var(--sidebar)", borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2.5">
          <img
            src={theme === "dark" ? scopicWhiteLogo : scopicBlackLogo}
            alt=""
            className="h-7 w-7 object-contain"
          />
          <span
            className="text-2xl font-semibold"
            style={{ color: "var(--text)", fontFamily: "DM Serif Display, Georgia, serif" }}
          >
            Scopic
          </span>
        </div>
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          Open-source legal workspace
        </p>
      </div>

      {/* Top-level section nav */}
      <nav className="px-2 pt-3 pb-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className="relative w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
              style={{
                background: active ? "var(--sidebar-hover)" : "transparent",
                border: active ? "1px solid var(--border)" : "1px solid transparent",
                color: active ? "var(--text)" : "var(--text-soft)",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "var(--sidebar-hover)";
                  e.currentTarget.style.color = "var(--text)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-soft)";
                }
              }}
            >
              <Icon size={16} color={active ? "var(--accent)" : "currentColor"} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Assistant history (only in Assistant view) */}
      {activeView === "assistant" && (
        <>
          <div className="mx-3 mt-2 border-t" style={{ borderColor: "var(--border)" }} />
          <div className="px-3 pt-3 pb-1 flex items-center justify-between">
            <button
              onClick={() => setHistoryOpen((v) => !v)}
              className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase"
              style={{ color: "var(--muted)" }}
            >
              <span>{historyOpen ? "▼" : "▶"}</span>
              <span>Assistant History</span>
            </button>
            <button
              onClick={onNewConversation}
              className="text-xs px-1.5 py-0.5 rounded transition-colors"
              style={{ color: "var(--muted)" }}
              title="New chat"
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.background = "var(--sidebar-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; e.currentTarget.style.background = "transparent"; }}
            >
              + New
            </button>
          </div>

          {historyOpen && (
            <div className="flex-1 overflow-y-auto py-1">
              {conversations.length === 0 ? (
                <div className="text-center text-xs px-4 py-6" style={{ color: "var(--muted)" }}>
                  No chats yet. Click + New above.
                </div>
              ) : null}

              {projects.map((proj) => {
                const convs = grouped.byProject.get(proj.id) || [];
                if (convs.length === 0) return null;
                const isCollapsed = collapsedProjects.has(proj.id);
                return (
                  <div key={proj.id} className="mb-1">
                    <div
                      className="group flex items-center gap-1.5 mx-2 px-2 py-1 rounded-lg cursor-pointer text-xs"
                      onClick={() => toggleProject(proj.id)}
                    >
                      <span style={{ color: "#7C7368" }}>{isCollapsed ? "▶" : "▼"}</span>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: proj.color || "var(--accent)" }} />
                      <span className="flex-1 truncate" style={{ color: "var(--text-soft)" }}>{proj.name}</span>
                      <span style={{ color: "var(--muted)" }}>{convs.length}</span>
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
                  {projects.some((p) => (grouped.byProject.get(p.id) || []).length > 0) && (
                    <div className="px-3 pt-2 pb-0.5">
                      <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "var(--muted)" }}>
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
          )}
        </>
      )}

      {/* Spacer for non-Assistant views so footer pins to bottom */}
      {activeView !== "assistant" && <div className="flex-1" />}

      {/* Footer */}
      <div className="px-3 pb-4 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs min-w-0">
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: connected ? "#22C55E" : "#EF4444" }}
            />
            <span className="truncate" style={{ color: "var(--muted)", maxWidth: 170 }}>
              {connected ? activeModelLabel(settings) : offlineLabel(settings)}
            </span>
          </div>
          <button
            onClick={onOpenSettings}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: "var(--muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.background = "var(--sidebar-hover)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; e.currentTarget.style.background = "transparent"; }}
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
        className="w-full text-left px-3 py-2 rounded-lg transition-colors duration-100 text-xs"
        style={{
          background: active ? "var(--sidebar-hover)" : "transparent",
          color: active ? "var(--text)" : "var(--muted)",
          border: active ? "1px solid var(--border)" : "1px solid transparent",
        }}
      >
        <div className="truncate pr-10">{conv.title || "Untitled"}</div>
      </button>
      {hovered === conv.id && (
        <div className="absolute right-1 top-1.5 flex gap-0.5">
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
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 8px 24px var(--shadow)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => { onMove(null); setMenuOpen(false); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#FFFFFF]"
                    style={{ color: "var(--text-soft)" }}
                  >
                    Unassigned
                  </button>
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { onMove(p.id); setMenuOpen(false); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-[#FFFFFF] flex items-center gap-2"
                      style={{ color: "var(--text)" }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color || "var(--accent)" }} />
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

function ChatIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function FolderIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function TableIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}
function WorkflowIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="3" cy="6" r="1" />
      <circle cx="3" cy="12" r="1" />
      <circle cx="3" cy="18" r="1" />
    </svg>
  );
}
