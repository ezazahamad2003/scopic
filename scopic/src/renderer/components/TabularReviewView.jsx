import React, { useState, useRef, useEffect, useCallback } from "react";
import { renderMarkdown } from "../utils/markdown.js";
import { DEFAULT_SETTINGS } from "../utils/constants.js";
import { getMikeColumnPreset } from "../utils/mikeAdapters.js";

const TABULAR_SYSTEM_PROMPT = `You are Scopic's Tabular Review assistant. The user has attached a document or dataset — it may be a spreadsheet (CSV/TSV/XLSX), a Word document (DOCX), a PDF, or plain text — and is asking questions about it.

Ground every answer in the actual content above. Cite the row, sheet, page, section, or quoted phrase the value came from. For aggregates over tabular data (counts, totals, ranges, outliers) compute from what you see and briefly show your work. For prose documents, prefer bullet-point summaries with short quoted snippets over long paraphrases. If something is ambiguous, missing, or truncated, flag it explicitly. Keep responses tight — tables and bullets beat paragraphs.`;

// Anything our main-process file:parse handler supports, plus plain text.
const ACCEPTED_EXTENSIONS = [
  ".csv", ".tsv", ".xlsx", ".xls",
  ".docx", ".pdf",
  ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp",
  ".txt", ".md",
];
const ACCEPT_ATTR = [
  ...ACCEPTED_EXTENSIONS,
  "text/csv",
  "text/plain",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/tiff",
  "image/bmp",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
].join(",");

const TABULAR_EXTENSIONS = new Set([".csv", ".tsv", ".xlsx", ".xls"]);

function extOf(name) {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

// Dedicated page for spreadsheet/tabular data analysis. Drop a file,
// see a preview, ask the model questions about it. Uses the unified
// chat IPC for streaming with a data-analysis system prompt.
export default function TabularReviewView({ settings, preset }) {
  const [file, setFile] = useState(null);  // { name, sizeBytes, text }
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [columns, setColumns] = useState([]);
  const [cells, setCells] = useState({});
  const [tableRunning, setTableRunning] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");

  const requestIdRef = useRef(null);
  const tableRequestsRef = useRef(new Map());
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!preset?.columns?.length) return;
    setColumns(preset.columns);
    setCells({});
  }, [preset]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Streaming listeners.
  useEffect(() => {
    if (!window.chat) return;
    const offToken = window.chat.onToken(({ requestId, token }) => {
      const tableReq = tableRequestsRef.current.get(requestId);
      if (tableReq) {
        setCells((prev) => ({
          ...prev,
          [tableReq.columnIndex]: {
            ...(prev[tableReq.columnIndex] || {}),
            status: "generating",
            content: `${prev[tableReq.columnIndex]?.content || ""}${token}`,
          },
        }));
        return;
      }
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
      const tableReq = tableRequestsRef.current.get(requestId);
      if (tableReq) {
        tableRequestsRef.current.delete(requestId);
        setCells((prev) => ({
          ...prev,
          [tableReq.columnIndex]: {
            ...(prev[tableReq.columnIndex] || {}),
            status: "done",
          },
        }));
        if (tableRequestsRef.current.size === 0) setTableRunning(false);
        return;
      }
      if (requestId !== requestIdRef.current) return;
      setIsStreaming(false);
      requestIdRef.current = null;
    });
    const offError = window.chat.onError(({ requestId, error: errMsg }) => {
      const tableReq = tableRequestsRef.current.get(requestId);
      if (tableReq) {
        tableRequestsRef.current.delete(requestId);
        setCells((prev) => ({
          ...prev,
          [tableReq.columnIndex]: {
            status: "error",
            content: errMsg || "Column extraction failed.",
          },
        }));
        if (tableRequestsRef.current.size === 0) setTableRunning(false);
        return;
      }
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
      if (!result?.text?.trim()) throw new Error("No readable text was found in this file.");
      setFile({
        name: f.name,
        sizeBytes: f.size,
        text: result?.text || "",
        kind: TABULAR_EXTENSIONS.has(ext) ? "tabular" : "document",
      });
      setMessages([]);
      setCells({});
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
    const temperature = settings?.temperature ?? DEFAULT_SETTINGS.temperature;
    const model =
      provider === "ollama"
        ? settings?.model || DEFAULT_SETTINGS.model
        : settings?.cloudModels?.[provider] || DEFAULT_SETTINGS.cloudModels[provider];

    const label = file.kind === "tabular" ? "spreadsheet" : "document";
    const modelTextLimit = 30000;
    const dataBlock = `## Attached ${label}: ${file.name}\n\n\`\`\`\n${file.text.slice(0, modelTextLimit)}${file.text.length > modelTextLimit ? "\n[…truncated…]" : ""}\n\`\`\``;

    const requestId = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    requestIdRef.current = requestId;

    window.chat.send(
      [
        { role: "system", content: `${TABULAR_SYSTEM_PROMPT}\n\n${dataBlock}` },
        ...next.slice(0, -1),
      ],
      { provider, model, temperature, rawMessages: true, mode: "tabular_review" },
      requestId
    );
  };

  const handleStop = () => {
    if (requestIdRef.current && window.chat) window.chat.abort(requestIdRef.current);
    for (const requestId of tableRequestsRef.current.keys()) {
      window.chat?.abort(requestId);
    }
    tableRequestsRef.current.clear();
    requestIdRef.current = null;
    setIsStreaming(false);
    setTableRunning(false);
  };

  const addColumn = () => {
    const name = newColumnName.trim();
    if (!name) return;
    const presetConfig = getMikeColumnPreset(name);
    setColumns((prev) => [
      ...prev,
      {
        index: prev.length,
        name,
        format: presetConfig?.format || "text",
        prompt: presetConfig?.prompt || "",
        tags: presetConfig?.tags || [],
      },
    ]);
    setNewColumnName("");
  };

  const removeColumn = (index) => {
    setColumns((prev) =>
      prev
        .filter((column) => column.index !== index)
        .map((column, nextIndex) => ({ ...column, index: nextIndex }))
    );
    setCells((prev) => {
      const next = {};
      Object.entries(prev).forEach(([key, value]) => {
        const n = Number(key);
        if (n < index) next[n] = value;
        if (n > index) next[n - 1] = value;
      });
      return next;
    });
  };

  const runColumnExtraction = (column) => {
    if (!file || !window.chat) return;
    const provider = settings?.provider || DEFAULT_SETTINGS.provider;
    const temperature = 0.1;
    const model =
      provider === "ollama"
        ? settings?.model || DEFAULT_SETTINGS.model
        : settings?.cloudModels?.[provider] || DEFAULT_SETTINGS.cloudModels[provider];

    const textLimit = 50000;
    const documentText = `${file.text.slice(0, textLimit)}${file.text.length > textLimit ? "\n[truncated]" : ""}`;
    const requestId = `tabcell-${Date.now()}-${column.index}-${Math.random().toString(36).slice(2, 7)}`;
    tableRequestsRef.current.set(requestId, { columnIndex: column.index });
    setCells((prev) => ({
      ...prev,
      [column.index]: { status: "generating", content: "" },
    }));
    setTableRunning(true);

    window.chat.send(
      [
        {
          role: "system",
          content:
            "You are Scopic's tabular legal review extractor. Extract exactly one field from one document. " +
            "Ground the answer in the document text. Be concise. If the answer is absent, return \"Not addressed\". " +
            "Include clause, page, section, row, or short quote references where available.",
        },
        {
          role: "user",
          content:
            `Document name: ${file.name}\n\n` +
            `Column: ${column.name}\n` +
            `Expected format: ${column.format || "text"}\n` +
            `Extraction instruction: ${column.prompt || `Extract ${column.name}.`}\n\n` +
            `Document text:\n\`\`\`\n${documentText}\n\`\`\``,
        },
      ],
      { provider, model, temperature, rawMessages: true, mode: "tabular_cell" },
      requestId
    );
  };

  const runPresetTable = () => {
    if (!file || !columns.length || tableRunning) return;
    setCells({});
    columns.forEach(runColumnExtraction);
  };

  const exportTable = async () => {
    if (!file || !columns.length) return;
    const ExcelModule = await import("exceljs");
    const ExcelJS = ExcelModule.default || ExcelModule;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Review");
    worksheet.columns = [
      { header: "Document", width: 36 },
      ...columns.map((column) => ({ header: column.name, width: 42 })),
    ];
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF3F4F6" },
    };
    const row = worksheet.addRow([
      file.name,
      ...columns.map((column) => (cells[column.index]?.content || "").trim()),
    ]);
    row.alignment = { vertical: "top", wrapText: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const cleanTitle = (preset?.title || "Scopic Tabular Review").replace(/[\\/:*?"<>|]/g, "").slice(0, 80);
    anchor.href = url;
    anchor.download = `${cleanTitle || "Scopic Tabular Review"}.xlsx`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const previewLines = file ? file.text.split("\n").slice(0, 80) : [];
  const totalLines = file ? file.text.split("\n").length : 0;
  const isModelTextTruncated = file ? file.text.length > 30000 : false;

  return (
    <main className="flex flex-col flex-1 overflow-hidden" style={{ background: "#FBFAF7" }}>
      <div className="px-8 py-6 border-b" style={{ borderColor: "#F8FAFC" }}>
        <h1 className="text-xl font-semibold" style={{ fontFamily: "DM Serif Display, serif", color: "#1F2937" }}>
          {preset?.title || "Tabular Review"}
        </h1>
<p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
          {preset?.columns?.length
            ? `${preset.practice || "Legal"} review from Mike, adapted for Scopic local files. ${preset.columns.length} extraction columns loaded.`
            : "Drop a Word doc, PDF, spreadsheet, or text file. Ask questions about clauses, dates, parties, totals, anomalies."}
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
              background: "#FFFFFF",
              border: "2px dashed #D8DEE8",
              color: "#64748B",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#315A9866"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#D8DEE8"; }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#315A98" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
<div className="text-sm" style={{ color: "#1F2937" }}>
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
                <span className="px-2 py-1 rounded" style={{ background: "#F8FAFC", color: "#315A98" }}>
                  {file.name}
                </span>
                <span style={{ color: "#64748B" }}>
                  {totalLines.toLocaleString()} lines · {(file.sizeBytes / 1024).toFixed(1)} KB
                </span>
              </div>
              <button
                onClick={() => { setFile(null); setMessages([]); setCells({}); setError(null); }}
                className="text-xs px-2 py-1 rounded transition-colors"
                style={{ color: "#64748B", border: "1px solid #D8DEE8" }}
              >
                Replace file
              </button>
            </div>

            {/* Preview */}
            <div
              className="rounded-lg overflow-auto mb-3 font-mono text-xs"
              style={{
                background: "#FFFFFF",
                border: "1px solid #D8DEE8",
                maxHeight: "30vh",
                color: "#334155",
              }}
            >
              <pre className="p-3 whitespace-pre" style={{ tabSize: 16 }}>
                {previewLines.join("\n")}
                {totalLines > 80 && `\n…${totalLines - 80} more lines (${isModelTextTruncated ? "first 30,000 characters sent to model" : "full text sent to model"})`}
              </pre>
            </div>

            {/* Mike-style column review */}
            {columns.length > 0 && (
              <div
                className="rounded-lg overflow-hidden mb-3"
                style={{ background: "#FFFFFF", border: "1px solid #D8DEE8" }}
              >
                <div
                  className="flex items-center justify-between gap-3 px-3 py-2 border-b"
                  style={{ borderColor: "#E5E7EB" }}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold" style={{ color: "#1F2937" }}>
                      Review table
                    </div>
                    <div className="text-[11px] truncate" style={{ color: "#64748B" }}>
                      {columns.length} column{columns.length === 1 ? "" : "s"} loaded from {preset?.source || "Scopic"}.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={runPresetTable}
                      disabled={!file || tableRunning}
                      className="px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
                      style={{ background: "#315A98", color: "#FFFFFF" }}
                    >
                      {tableRunning ? "Running" : "Run review"}
                    </button>
                    <button
                      type="button"
                      onClick={exportTable}
                      disabled={Object.keys(cells).length === 0}
                      className="px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
                      style={{ border: "1px solid #D8DEE8", color: "#334155" }}
                    >
                      Export XLSX
                    </button>
                  </div>
                </div>
                <div className="overflow-auto" style={{ maxHeight: "32vh" }}>
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr style={{ background: "#F8FAFC", color: "#475569" }}>
                        <th className="sticky left-0 z-10 min-w-44 px-3 py-2 font-medium" style={{ background: "#F8FAFC" }}>
                          Document
                        </th>
                        {columns.map((column) => (
                          <th key={column.index} className="min-w-64 px-3 py-2 font-medium">
                            <div className="flex items-center justify-between gap-2">
                              <span>{column.name}</span>
                              <button
                                type="button"
                                onClick={() => removeColumn(column.index)}
                                className="opacity-50 hover:opacity-100"
                                title={`Remove ${column.name}`}
                              >
                                x
                              </button>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderTop: "1px solid #E5E7EB" }}>
                        <td
                          className="sticky left-0 z-10 px-3 py-3 align-top font-medium"
                          style={{ background: "#FFFFFF", color: "#1F2937" }}
                        >
                          {file.name}
                        </td>
                        {columns.map((column) => {
                          const cell = cells[column.index];
                          return (
                            <td
                              key={column.index}
                              className="px-3 py-3 align-top leading-relaxed"
                              style={{ borderLeft: "1px solid #EEF2F7", color: cell?.status === "error" ? "#DC2626" : "#334155" }}
                            >
                              {cell?.content ? (
                                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(cell.content) }} />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => runColumnExtraction(column)}
                                  disabled={tableRunning}
                                  className="text-left text-xs disabled:opacity-50"
                                  style={{ color: "#315A98" }}
                                >
                                  Extract
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mb-3">
              <input
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addColumn(); }}
                className="flex-1 px-3 py-2 rounded-lg text-xs outline-none"
                style={{ background: "#FFFFFF", border: "1px solid #D8DEE8", color: "#1F2937" }}
                placeholder="Add a Mike-style extraction column, e.g. Governing Law"
              />
              <button
                type="button"
                onClick={addColumn}
                className="px-3 py-2 rounded-lg text-xs font-medium"
                style={{ border: "1px solid #D8DEE8", color: "#334155" }}
              >
                Add column
              </button>
            </div>

            {/* Chat */}
            <div
              className="flex-1 overflow-y-auto rounded-lg p-3 mb-3"
              style={{ background: "#FFFFFF", border: "1px solid #D8DEE8" }}
            >
              {messages.length === 0 ? (
<div className="text-center text-xs py-6" style={{ color: "#64748B" }}>
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
                        style={{ background: "#FFFFFF", border: "1px solid #F8FAFC", color: "#475569" }}
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
                      <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: m.role === "user" ? "#315A98" : "#315A98" }}>
                        {m.role === "user" ? "You" : "Scopic"}
                      </div>
                      <div
                        className="leading-relaxed"
                        style={{ color: m.isError ? "#EF4444" : "#1F2937" }}
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
                style={{ background: "#FFFFFF", border: "1px solid #D8DEE8", color: "#1F2937" }}
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
                    background: "linear-gradient(135deg, #315A98, #244876)",
                    color: "#FFFFFF",
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
