import React, { useState, useRef, useEffect, useCallback } from "react";
import { renderMarkdown } from "../utils/markdown.js";
import { DEFAULT_SETTINGS } from "../utils/constants.js";

const TABULAR_SYSTEM_PROMPT = `You are Scopic's Tabular Review assistant. The user has attached a document or dataset — it may be a spreadsheet (CSV/TSV/XLSX), a Word document (DOCX), a PDF, or plain text — and is asking questions about it.

Ground every answer in the actual content above. Cite the row, sheet, page, section, or quoted phrase the value came from. For aggregates over tabular data (counts, totals, ranges, outliers) compute from what you see and briefly show your work. For prose documents, prefer bullet-point summaries with short quoted snippets over long paraphrases. If something is ambiguous, missing, or truncated, flag it explicitly. Keep responses tight — tables and bullets beat paragraphs.`;

// Anything our main-process file:parse handler supports, plus plain text.
const ACCEPTED_EXTENSIONS = [
  ".csv", ".tsv", ".xlsx", ".xls",
  ".docx", ".pdf",
  ".txt", ".md",
];
const ACCEPT_ATTR = [
  ...ACCEPTED_EXTENSIONS,
  "text/csv",
  "text/plain",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
].join(",");

const PLAIN_TEXT_EXTENSIONS = new Set([".csv", ".tsv", ".txt", ".md"]);

function extOf(name) {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

// Dedicated page for spreadsheet/tabular data analysis. Drop a file,
// see a preview, ask the model questions about it. Uses the unified
// chat IPC for streaming with a data-analysis system prompt.
export default function TabularReviewView({ settings }) {
  const [file, setFile] = useState(null);  // { name, sizeBytes, text }
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const requestIdRef = useRef(null);
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Streaming listeners.
  useEffect(() => {
    if (!window.chat) return;
    const offToken = window.chat.onToken(({ requestId, token }) => {
      if (requestId !== requestIdRef.current) return;
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated.length - 1;
        if (updated[last]?.role === "assistant") {
          updated[last] = { ...updated[last], content: (updated[last].content || "") + token };
        }
        return updated;
      });
    });
    const offDone = window.chat.onDone(({ requestId }) => {
      if (requestId !== requestIdRef.current) return;
      setIsStreaming(false);
      requestIdRef.current = null;
    });
    const offError = window.chat.onError(({ requestId, error: errMsg }) => {
      if (requestId !== requestIdRef.current) return;
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated.length - 1;
        if (updated[last]?.role === "assistant") {
          updated[last] = { ...updated[last], content: `Error: ${errMsg}`, isError: true };
        }
        return updated;
      });
      setIsStreaming(false);
      requestIdRef.current = null;
    });
    return () => { offToken?.(); offDone?.(); offError?.(); };
  }, []);

  const ingestFile = useCallback(async (f) => {
    if (!f || !window.fileParser) return;
    setParsing(true);
    setError(null);
    try {
      const ext = extOf(f.name);
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        throw new Error(`Unsupported file type "${ext || f.name}". Accepted: ${ACCEPTED_EXTENSIONS.join(", ")}`);
      }
      const buf = await f.arrayBuffer();
      const result = await window.fileParser.parse(buf, f.name);
      if (result?.error) throw new Error(result.error);
      setFile({
        name: f.name,
        sizeBytes: f.size,
        text: result?.text || "",
        kind: PLAIN_TEXT_EXTENSIONS.has(ext) ? "tabular" : "document",
      });
      setMessages([]);
    } catch (err) {
      setError(err?.message || "Failed to parse file");
    } finally {
      setParsing(false);
    }
  }, []);

  const handleFilePick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) ingestFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) ingestFile(f);
  };
  const handleDragOver = (e) => e.preventDefault();

  const handleSend = () => {
    if (!input.trim() || !file || isStreaming || !window.chat) return;
    const userMsg = { role: "user", content: input.trim() };
    const placeholder = { role: "assistant", content: "" };
    const next = [...messages, userMsg, placeholder];
    setMessages(next);
    setInput("");
    setIsStreaming(true);

    const provider = settings?.provider || DEFAULT_SETTINGS.provider;
    const temperature = DEFAULT_SETTINGS.temperature;
    const model =
      provider === "ollama"
        ? settings?.model || DEFAULT_SETTINGS.model
        : settings?.cloudModels?.[provider] || DEFAULT_SETTINGS.cloudModels[provider];

    const label = file.kind === "tabular" ? "spreadsheet" : "document";
    const dataBlock = `## Attached ${label}: ${file.name}\n\n\`\`\`\n${file.text.slice(0, 30000)}${file.text.length > 30000 ? "\n[…truncated…]" : ""}\n\`\`\``;

    const requestId = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    requestIdRef.current = requestId;

    window.chat.send(
      [
        { role: "system", content: `${TABULAR_SYSTEM_PROMPT}\n\n${dataBlock}` },
        ...next.slice(0, -1),
      ],
      { provider, model, temperature },
      requestId
    );
  };

  const handleStop = () => {
    if (requestIdRef.current && window.chat) window.chat.abort(requestIdRef.current);
    requestIdRef.current = null;
    setIsStreaming(false);
  };

  const previewLines = file ? file.text.split("\n").slice(0, 80) : [];
  const totalLines = file ? file.text.split("\n").length : 0;

  return (
    <main className="flex flex-col flex-1 overflow-hidden" style={{ background: "#0D1117" }}>
      <div className="px-8 py-6 border-b" style={{ borderColor: "#1E2535" }}>
        <h1 className="text-xl font-semibold" style={{ fontFamily: "DM Serif Display, serif", color: "#E8E8E8" }}>
          Tabular Review
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
          Drop a Word doc, PDF, spreadsheet, or text file. Ask questions about clauses, dates, parties, totals, anomalies.
        </p>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col px-8 py-5 max-w-5xl w-full mx-auto">
        {/* Drop zone / preview */}
        {!file ? (
          <div
            ref={dropRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center py-14 rounded-xl cursor-pointer transition-all"
            style={{
              background: "#0F1117",
              border: "2px dashed #2A3347",
              color: "#6B7280",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#C9A55C66"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#2A3347"; }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#C9A55C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
            <div className="text-sm" style={{ color: "#E8E8E8" }}>
              {parsing ? "Parsing…" : "Drop a document or spreadsheet here"}
            </div>
            <div className="text-xs mt-1">
              or click to browse — {ACCEPTED_EXTENSIONS.join(", ")}
            </div>
            {error && <div className="text-xs mt-3" style={{ color: "#EF4444" }}>{error}</div>}
            <input ref={fileInputRef} type="file" accept={ACCEPT_ATTR} onChange={handleFilePick} className="hidden" />
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-1 rounded" style={{ background: "#1E2535", color: "#C9A55C" }}>
                  {file.name}
                </span>
                <span style={{ color: "#6B7280" }}>
                  {totalLines.toLocaleString()} lines · {(file.sizeBytes / 1024).toFixed(1)} KB
                </span>
              </div>
              <button
                onClick={() => { setFile(null); setMessages([]); setError(null); }}
                className="text-xs px-2 py-1 rounded transition-colors"
                style={{ color: "#6B7280", border: "1px solid #2A3347" }}
              >
                Replace file
              </button>
            </div>

            {/* Preview */}
            <div
              className="rounded-lg overflow-auto mb-3 font-mono text-xs"
              style={{
                background: "#0F1117",
                border: "1px solid #2A3347",
                maxHeight: "30vh",
                color: "#C8D0E0",
              }}
            >
              <pre className="p-3 whitespace-pre" style={{ tabSize: 16 }}>
                {previewLines.join("\n")}
                {totalLines > 80 && `\n…${totalLines - 80} more lines (full text sent to model)`}
              </pre>
            </div>

            {/* Chat */}
            <div
              className="flex-1 overflow-y-auto rounded-lg p-3 mb-3"
              style={{ background: "#0F1117", border: "1px solid #2A3347" }}
            >
              {messages.length === 0 ? (
                <div className="text-center text-xs py-6" style={{ color: "#6B7280" }}>
                  Ask anything about this {file.kind === "tabular" ? "data" : "document"}. Examples:
                  <div className="mt-3 space-y-1.5 max-w-md mx-auto text-left">
                    {(file.kind === "tabular"
                      ? [
                          "Summarize the columns and what each row represents.",
                          "Are there any duplicate or contradictory rows?",
                          "What's the date range? Any gaps?",
                          "Which entities appear most often, and in what context?",
                        ]
                      : [
                          "Summarize this document in 5 bullets.",
                          "Who are the parties, and what are their core obligations?",
                          "List every defined term and how it's defined.",
                          "Flag any unusual, one-sided, or risky clauses.",
                        ]
                    ).map((q) => (
                      <button
                        key={q}
                        onClick={() => setInput(q)}
                        className="block w-full text-left px-3 py-1.5 rounded text-xs transition-colors"
                        style={{ background: "#161B27", border: "1px solid #1E2535", color: "#9AA0B4" }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((m, i) => (
                    <div key={i} className="text-sm">
                      <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: m.role === "user" ? "#7BA4FF" : "#C9A55C" }}>
                        {m.role === "user" ? "You" : "Scopic"}
                      </div>
                      <div
                        className="leading-relaxed"
                        style={{ color: m.isError ? "#EF4444" : "#E8E8E8" }}
                        dangerouslySetInnerHTML={{ __html: m.role === "assistant" ? renderMarkdown(m.content || "") : escapeHtml(m.content || "") }}
                      />
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Ask about this data…"
                disabled={isStreaming}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none disabled:opacity-50"
                style={{ background: "#0F1117", border: "1px solid #2A3347", color: "#E8E8E8" }}
              />
              {isStreaming ? (
                <button
                  onClick={handleStop}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={{ background: "#2A1010", border: "1px solid #6b1010", color: "#EF4444" }}
                >
                  Stop
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, #C9A55C, #A8874A)",
                    color: "#0F1117",
                  }}
                >
                  Ask
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
