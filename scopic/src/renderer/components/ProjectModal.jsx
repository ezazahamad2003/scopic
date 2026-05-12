import React, { useState, useEffect, useRef } from "react";

const ACCEPT_ATTR = [
  ".pdf", ".docx", ".txt", ".md", ".csv", ".tsv", ".xlsx", ".xls",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv",
].join(",");

// No more truncation cap — documents go through the content-addressed
// store now. The whole text gets chunked + indexed; retrieval picks what
// to send the model per question.

// Modal for creating or editing a project (case / matter / client).
// `project` prop is the existing project (edit mode) or null (create mode).
export default function ProjectModal({ project, onSave, onDelete, onClose }) {
  const isEdit = Boolean(project?.id);
  const [form, setForm] = useState({
    id: project?.id || null,
    name: project?.name || "",
    description: project?.description || "",
    color: project?.color || COLORS[0],
    documents: project?.documents || [],
  });
  const fileInputRef = useRef(null);
  const [parsing, setParsing] = useState(null);

  useEffect(() => {
    setForm({
      id: project?.id || null,
      name: project?.name || "",
      description: project?.description || "",
      color: project?.color || COLORS[0],
      documents: project?.documents || [],
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

  const handleAddDocument = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!window.documents) return;
    setParsing(file.name);
    try {
      const buf = await file.arrayBuffer();
      const result = await window.documents.ingest(buf, file.name, file.type);
      if (!result?.ok) throw new Error(result?.error || "Ingest failed");
      const d = result.document;
      const doc = {
        id: d.id,
        name: d.filename,
        sizeBytes: d.sizeBytes,
        pageCount: d.pageCount,
        extractedChars: d.extractedChars,
        addedAt: Date.now(),
      };
      // Dedupe: ignore if this document id is already attached.
      setForm((f) => f.documents.some((x) => x.id === doc.id)
        ? f
        : { ...f, documents: [...f.documents, doc] }
      );
    } catch (err) {
      const errDoc = {
        id: `doc-err-${Date.now()}`,
        name: file.name,
        error: err?.message || "Failed to ingest",
        addedAt: Date.now(),
      };
      setForm((f) => ({ ...f, documents: [...f.documents, errDoc] }));
    } finally {
      setParsing(null);
    }
  };

  const handleRemoveDocument = (id) => {
    setForm((f) => ({ ...f, documents: f.documents.filter((d) => d.id !== id) }));
  };

  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(15,23,42,0.28)", backdropFilter: "blur(4px)" }}
      onClick={handleBackdrop}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{
          background: "#FFFFFF",
          border: "1px solid #D8DEE8",
          boxShadow: "0 24px 64px rgba(15,23,42,0.16)",
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold" style={{ fontFamily: "DM Serif Display, serif", color: "#315A98" }}>
            {isEdit ? "Edit Project" : "New Project"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-[#D8DEE8] transition-colors"
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
              style={{ background: "#FFFFFF", border: "1px solid #D8DEE8", color: "#1F2937" }}
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
              style={{ background: "#FFFFFF", border: "1px solid #D8DEE8", color: "#1F2937" }}
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Documents ({form.documents.length})
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={Boolean(parsing)}
                className="text-xs px-2 py-1 rounded transition-colors disabled:opacity-50"
                style={{ background: "#FFFFFF", border: "1px solid #D8DEE8", color: "#315A98" }}
              >
                {parsing ? `Parsing ${parsing}…` : "+ Add"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_ATTR}
                onChange={handleAddDocument}
                className="hidden"
              />
            </div>
            {form.documents.length === 0 ? (
              <p className="text-xs text-gray-600">
                Pin PDFs, DOCXs, or spreadsheets to this project. Their text gets included in every chat in this project.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {form.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs"
                    style={{
                      background: doc.error ? "#2A1010" : "#FFFFFF",
                      border: `1px solid ${doc.error ? "#6b1010" : "#D8DEE8"}`,
                      color: doc.error ? "#EF4444" : "#1F2937",
                    }}
                  >
                    <span className="truncate flex-1">{doc.name}</span>
                    {doc.error ? (
                      <span className="text-[10px]" style={{ color: "#EF4444" }}>{doc.error}</span>
                    ) : doc.pageCount ? (
                      <span className="text-[10px]" style={{ color: "#64748B" }}>{doc.pageCount}p</span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleRemoveDocument(doc.id)}
                      className="text-gray-500 hover:text-red-400 px-1"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
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
            style={{ background: "#FFFFFF", border: "1px solid #D8DEE8" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form.name.trim()}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #315A98, #244876)",
              color: "#FFFFFF",
            }}
          >
            {isEdit ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

const COLORS = ["#315A98", "#315A98", "#22C55E", "#EF4444", "#A78BFA", "#F59E0B"];
