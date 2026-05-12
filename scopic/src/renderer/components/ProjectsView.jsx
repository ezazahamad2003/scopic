import React, { useMemo } from "react";

// Full-pane grid of project cards. Click a card to enter that project
// (switches to Assistant view, scoped to the project). Each card shows
// name, color, doc count, and conversation count.
export default function ProjectsView({
  projects,
  conversations,
  onOpenProject,
  onNewProject,
  onEditProject,
}) {
  const counts = useMemo(() => {
    const map = new Map();
    for (const c of conversations) {
      if (c.projectId) map.set(c.projectId, (map.get(c.projectId) || 0) + 1);
    }
    return map;
  }, [conversations]);

  return (
    <main className="flex flex-col flex-1 overflow-hidden" style={{ background: "#FBFAF7" }}>
      <div className="flex items-center justify-between px-8 py-6 border-b" style={{ borderColor: "#F8FAFC" }}>
        <div>
          <h1 className="text-xl font-semibold" style={{ fontFamily: "DM Serif Display, serif", color: "#1F2937" }}>
            Projects
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
            Group cases, matters, or clients. Pin documents and context.
          </p>
        </div>
        <button
          onClick={onNewProject}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            background: "linear-gradient(135deg, #315A98, #244876)",
            color: "#FFFFFF",
          }}
        >
          + New Project
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {projects.length === 0 ? (
          <EmptyState onNewProject={onNewProject} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl">
            {projects.map((proj) => {
              const convCount = counts.get(proj.id) || 0;
              const docCount = (proj.documents || []).length;
              return (
                <div
                  key={proj.id}
                  className="group relative rounded-xl p-4 transition-all cursor-pointer overflow-hidden"
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #D8DEE8",
                    boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#315A9866";
                    e.currentTarget.style.background = "#FFFFFF";
                    e.currentTarget.style.boxShadow = "0 8px 24px rgba(49,90,152,0.10)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#D8DEE8";
                    e.currentTarget.style.background = "#FFFFFF";
                    e.currentTarget.style.boxShadow = "0 1px 2px rgba(15,23,42,0.06)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                  onClick={() => onOpenProject(proj.id)}
                >
                  {/* Soft color wash from the project's own dot color */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"
                    style={{ background: proj.color || "#315A98" }}
                  />
                  <div className="flex items-start gap-2.5 mb-3">
                    <span
                      className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
                      style={{ background: proj.color || "#315A98" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: "#1F2937" }}>
                        {proj.name}
                      </div>
                      {proj.description && (
                        <div className="text-xs mt-1 line-clamp-2" style={{ color: "#64748B" }}>
                          {proj.description}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onEditProject(proj); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-xs px-1.5 py-0.5 rounded"
                      style={{ color: "#64748B" }}
                      title="Edit project"
                    >
                      ⚙
                    </button>
                  </div>

                  <div className="flex items-center gap-3 text-xs" style={{ color: "#64748B" }}>
                    <span className="flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      {convCount} chat{convCount === 1 ? "" : "s"}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      {docCount} doc{docCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function EmptyState({ onNewProject }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 max-w-md mx-auto text-center">
      <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: "#FFFFFF", border: "1px solid #D8DEE8" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#315A98" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <h3 className="text-base font-semibold mb-2" style={{ color: "#1F2937" }}>
        No projects yet
      </h3>
      <p className="text-sm mb-5" style={{ color: "#64748B" }}>
        Projects keep matters organized — pin client context, attach foundational documents, and every chat in a project sees them.
      </p>
      <button
        onClick={onNewProject}
        className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
        style={{
          background: "linear-gradient(135deg, #315A98, #244876)",
          color: "#FFFFFF",
        }}
      >
        + Create your first project
      </button>
    </div>
  );
}
