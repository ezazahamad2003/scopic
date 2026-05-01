import React, { useState, useRef } from "react";

const ACCEPTED_TEXT_TYPES = [
  ".txt", ".md", ".json", ".js", ".ts", ".jsx", ".tsx",
  ".html", ".css", ".csv", ".py", ".xml", ".yaml", ".yml",
];
const ACCEPTED_BINARY_TYPES = [".pdf", ".docx"];
const ALL_ACCEPTED_TYPES = [...ACCEPTED_TEXT_TYPES, ...ACCEPTED_BINARY_TYPES];
const ACCEPT_ATTR = [
  ...ALL_ACCEPTED_TYPES,
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
].join(",");

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file, "utf-8");
  });
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

export default function DocumentVaultModal({ onClose, onSubmit }) {
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [query, setQuery] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = async (f) => {
    if (!f) return;
    setFileError(null);

    const ext = "." + f.name.split(".").pop().toLowerCase();
    if (!ALL_ACCEPTED_TYPES.includes(ext)) {
      setFileError(`Unsupported file type. Use: ${ALL_ACCEPTED_TYPES.join(", ")}`);
      return;
    }
    const maxSize = ACCEPTED_BINARY_TYPES.includes(ext) ? 10 * 1024 * 1024 : 500 * 1024;
    if (f.size > maxSize) {
      setFileError(`File too large (max ${ACCEPTED_BINARY_TYPES.includes(ext) ? "10 MB" : "500 KB"}).`);
      return;
    }
    try {
      let content;
      if (ACCEPTED_BINARY_TYPES.includes(ext)) {
        const buffer = await readFileAsArrayBuffer(f);
        const result = await window.fileParser.parse(buffer, f.name);
        if (result.error) throw new Error(result.error);
        content = result.text;
      } else {
        content = await readFileAsText(f);
      }
      setFile({ name: f.name, content });
    } catch (err) {
      setFileError(err.message || "Could not read file.");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const canSubmit = file && query.trim();

  const handleSubmit = () => {
    if (!canSubmit) return;
    const message = `**Document: ${file.name}**\n\n${query.trim()}\n\n---\n\n\`\`\`\n${file.content}\n\`\`\``;
    onSubmit(message);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-6 w-full max-w-lg mx-4"
        style={{ background: "#141820", border: "1px solid #2A3347" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">📁</span>
            <h2 className="text-lg font-semibold" style={{ color: "#E2E8F0" }}>
              Document Vault
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: "#6B7280" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#1E2535";
              e.currentTarget.style.color = "#E2E8F0";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#6B7280";
            }}
          >
            ✕
          </button>
        </div>

        <p className="text-sm mb-4" style={{ color: "#6B7280" }}>
          Upload a document and ask a question. The AI will use it as context for the chat.
        </p>

        {/* File drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-xl p-6 mb-3 text-center cursor-pointer transition-all duration-150"
          style={{
            background: dragOver ? "#1a2540" : "#0D1117",
            border: `1px dashed ${dragOver ? "#3A5A9F" : "#2A3347"}`,
          }}
        >
          {file ? (
            <div className="flex items-center justify-center gap-2 text-sm" style={{ color: "#7BA4FF" }}>
              <span>📄</span>
              <span>{file.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
                className="ml-2 opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ) : (
            <div>
              <div className="text-2xl mb-2">📄</div>
              <div className="text-sm" style={{ color: "#9AA0B4" }}>
                Click to upload or drag a document here
              </div>
              <div className="text-xs mt-1" style={{ color: "#4A5568" }}>
                .pdf, .docx, .txt, .md, .csv, etc. (max 10 MB for PDF/DOCX)
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={ACCEPT_ATTR}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>

        {fileError && (
          <div
            className="mb-3 px-3 py-2 rounded-lg text-xs"
            style={{ background: "#2a1010", border: "1px solid #6b1010", color: "#EF4444" }}
          >
            {fileError}
          </div>
        )}

        {/* Query */}
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What would you like to know about this document?"
          rows={4}
          className="w-full bg-transparent text-sm placeholder-gray-600 resize-none outline-none rounded-xl px-4 py-3 mb-4"
          style={{
            background: "#0D1117",
            border: "1px solid #2A3347",
            color: "#E2E8F0",
          }}
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ background: "transparent", color: "#9AA0B4", border: "1px solid #2A3347" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150"
            style={{
              background: canSubmit ? "linear-gradient(135deg, #3A5A9F, #2A4A8F)" : "#1E2535",
              color: canSubmit ? "#FFFFFF" : "#4A5568",
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
          >
            Start Chat
          </button>
        </div>
      </div>
    </div>
  );
}
