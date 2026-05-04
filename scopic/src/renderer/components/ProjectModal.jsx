import React, { useState, useEffect } from "react";

// Modal for creating or editing a project (case / matter / client).
// `project` prop is the existing project (edit mode) or null (create mode).
export default function ProjectModal({ project, onSave, onDelete, onClose }) {
  const isEdit = Boolean(project?.id);
  const [form, setForm] = useState({
    id: project?.id || null,
    name: project?.name || "",
    description: project?.description || "",
    color: project?.color || COLORS[0],
  });

  useEffect(() => {
    setForm({
      id: project?.id || null,
      name: project?.name || "",
      description: project?.description || "",
      color: project?.color || COLORS[0],
    });
  }, [project]);

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave({
      ...form,
      id: form.id || `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: form.name.trim(),
      description: form.description.trim(),
    });
  };

  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={handleBackdrop}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{
          background: "#161B27",
          border: "1px solid #2A3347",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold" style={{ fontFamily: "DM Serif Display, serif", color: "#C9A55C" }}>
            {isEdit ? "Edit Project" : "New Project"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-[#2A3347] transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
              Name
            </label>
            <input
              type="text"
              autoFocus
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Acme Corp v. Smith"
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
              style={{ background: "#0F1117", border: "1px solid #2A3347", color: "#E8E8E8" }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
              Context (optional)
            </label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Background, parties, key dates, jurisdiction. This text is included in every chat in this project."
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
              style={{ background: "#0F1117", border: "1px solid #2A3347", color: "#E8E8E8" }}
            />
            <p className="text-xs text-gray-600 mt-1">
              Anything you put here is prepended to the system prompt for chats in this project.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
              Color
            </label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  className="w-7 h-7 rounded-full transition-transform"
                  style={{
                    background: c,
                    border: form.color === c ? "2px solid #FFFFFF" : "2px solid transparent",
                    transform: form.color === c ? "scale(1.1)" : "scale(1)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          {isEdit && (
            <button
              onClick={() => onDelete(form.id)}
              className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{ background: "#2A1010", border: "1px solid #6b1010", color: "#EF4444" }}
            >
              Delete
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition-colors"
            style={{ background: "#0F1117", border: "1px solid #2A3347" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form.name.trim()}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #C9A55C, #A8874A)",
              color: "#0F1117",
            }}
          >
            {isEdit ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

const COLORS = ["#C9A55C", "#7BA4FF", "#22C55E", "#EF4444", "#A78BFA", "#F59E0B"];
