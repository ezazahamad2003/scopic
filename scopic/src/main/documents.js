// Local document store. Content-addressed on disk under
//   userData/documents/<sha256>/{original.<ext>, extracted.txt, chunks.json}
//
// SQLite holds only metadata. Same NDA across three projects = one copy
// on disk, one set of chunks, one embedding pass.
//
// Pipeline:  bytes → hash → dedupe → write → parse → structure → chunk
//            → DB rows (FTS5 auto-fills via triggers).
// The optional embedding pass is owned by rag.js; this module stops at
// "chunked and FTS-indexed".

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const db = require("./db");
const ocr = require("./ocr");

let mammoth = null;
let PDFParse = null;
let ExcelJS = null;
try { mammoth = require("mammoth"); } catch {}
try { ({ PDFParse } = require("pdf-parse")); } catch {}
try { ExcelJS = require("exceljs"); } catch {}

const PARSER_VERSION = "1.0.0";

let docsRoot = null;

function init(userDataDir) {
  docsRoot = path.join(userDataDir, "documents");
  if (!fs.existsSync(docsRoot)) fs.mkdirSync(docsRoot, { recursive: true });
  ocr.init(userDataDir);
}

function pathsFor(sha) {
  const dir = path.join(docsRoot, sha);
  return {
    dir,
    extracted: path.join(dir, "extracted.txt"),
    chunks: path.join(dir, "chunks.json"),
    meta: path.join(dir, "meta.json"),
    originalDir: dir,
  };
}

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function makeId() {
  return "doc-" + Date.now().toString(36) + "-" + crypto.randomBytes(3).toString("hex");
}

// ──────────────────────────────────────────────────────────────────────
// Parsing — return {text, pages} where pages is an array of
// {pageNumber, startChar, endChar} so the chunker can attach page numbers.
// ──────────────────────────────────────────────────────────────────────

async function parse(buf, filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".pdf")  return parsePdf(buf);
  if (ext === ".docx") return parseDocx(buf);
  if (ext === ".xlsx" || ext === ".xls") return parseXlsx(buf);
  if ([".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp"].includes(ext)) return parseImage(buf);
  return parseText(buf);
}

async function parsePdf(buf) {
  if (!PDFParse) throw new Error("PDF parser unavailable");
  const parser = new PDFParse({ data: buf });
  try {
    const result = await parser.getText();
    const pages = [];
    let text = "";
    for (let i = 0; i < (result?.pages || []).length; i++) {
      const p = result.pages[i];
      const pageText = (p?.text || "").trim();
      if (!pageText) continue;
      const start = text.length;
      text += pageText + "\n\n";
      pages.push({ pageNumber: i + 1, startChar: start, endChar: text.length });
    }
    if (!text && result?.text) text = result.text;
    const pageCount = result?.pages?.length || pages.length;
    const normalized = text.trim();
    if (shouldOcrPdf(normalized, pageCount)) {
      const ocrResult = await tryOcrPdf(buf, normalized, pages, pageCount);
      if (ocrResult) return ocrResult;
    }
    return { text: normalized, pages, parser: "pdf-parse" };
  } finally {
    try { await parser.destroy(); } catch {}
  }
}

function shouldOcrPdf(text, pageCount) {
  if (!ocr.available()) return false;
  const pages = Math.max(1, pageCount || 1);
  return text.length < Math.max(200, pages * 40);
}

async function tryOcrPdf(buf, fallbackText, fallbackPages, fallbackPageCount) {
  try {
    const result = await ocr.recognizePdf(buf);
    if (result.text && result.text.length > fallbackText.length) {
      return {
        text: result.text,
        pages: result.pages.length ? result.pages : fallbackPages,
        parser: result.parser,
      };
    }
  } catch {}
  return fallbackText ? {
    text: fallbackText,
    pages: fallbackPages,
    parser: fallbackPageCount ? "pdf-parse:ocr-unavailable" : "pdf-parse",
  } : null;
}

async function parseImage(buf) {
  if (!ocr.available()) throw new Error("Local OCR unavailable");
  const text = await ocr.recognizeImage(buf);
  return {
    text,
    pages: [{ pageNumber: 1, startChar: 0, endChar: text.length }],
    parser: "tesseract-ocr",
  };
}

async function parseDocx(buf) {
  if (!mammoth) throw new Error("DOCX parser unavailable");
  const result = await mammoth.extractRawText({ buffer: buf });
  const text = (result?.value || "").trim();
  // mammoth doesn't expose pagination — fake it with logical 3000-char "pages"
  // so the chunker has *some* citation anchor.
  const pages = [];
  const PAGE_CHARS = 3000;
  for (let i = 0, n = 1; i < text.length; i += PAGE_CHARS, n++) {
    pages.push({ pageNumber: n, startChar: i, endChar: Math.min(i + PAGE_CHARS, text.length) });
  }
  return { text, pages, parser: "mammoth" };
}

async function parseXlsx(buf) {
  if (!ExcelJS) throw new Error("Spreadsheet parser unavailable");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const parts = [];
  const pages = [];
  wb.eachSheet((sheet) => {
    const start = parts.join("\n").length;
    parts.push(`# Sheet: ${sheet.name}`);
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells = [];
      row.eachCell({ includeEmpty: false }, (cell) => {
        const v = cell.value;
        if (v == null) { cells.push(""); return; }
        if (typeof v === "object") {
          if (v.text) cells.push(String(v.text));
          else if (v.result != null) cells.push(String(v.result));
          else if (v.richText) cells.push(v.richText.map((r) => r.text).join(""));
          else cells.push(JSON.stringify(v));
        } else cells.push(String(v));
      });
      parts.push(cells.join("\t"));
    });
    parts.push("");
    const end = parts.join("\n").length;
    pages.push({ pageNumber: pages.length + 1, startChar: start, endChar: end });
  });
  const text = parts.join("\n").trim();
  return { text, pages, parser: "exceljs" };
}

async function parseText(buf) {
  const text = buf.toString("utf-8").replace(/^﻿/, "");
  return { text, pages: [{ pageNumber: 1, startChar: 0, endChar: text.length }], parser: "plain" };
}

// ──────────────────────────────────────────────────────────────────────
// Structure tree — detect legal section markers and build a hierarchy
// the tree-walk agent can navigate.
// ──────────────────────────────────────────────────────────────────────

// Matches things like:  Section 5.2  Article III  1.1  1.2.3  (a)  (b)(ii)
// We keep it conservative — false positives on body text are worse than
// missing some headers.
const SECTION_RE = /^\s*((?:section|article|clause)\s+[\dA-Za-z][\dA-Za-z.\-]*\.?|[\dA-Z]+(?:\.[\dA-Z]+){0,3}\.?\s+[A-Z][A-Za-z ]{2,60}|\([a-z0-9]{1,3}\))\s*[:.]?\s*(.*)$/i;

function detectSections(text) {
  // Returns a flat list of [{level, label, title, startChar}] in document order.
  const lines = text.split(/\r?\n/);
  const out = [];
  let offset = 0;
  for (const raw of lines) {
    const line = raw.trimEnd();
    const m = SECTION_RE.exec(line);
    if (m && line.length < 120) {
      const label = m[1].trim().replace(/\s+/g, " ");
      // Title may keep a leading separator from the source line (em-dash,
      // hyphen, colon). Strip those so we don't end up with "X — — Y".
      const title = (m[2] || "").trim().replace(/^[-–—:.\s]+/, "").trim();
      const level = guessLevel(label);
      out.push({ level, label, title, startChar: offset });
    }
    offset += raw.length + 1;
  }
  return out;
}

function guessLevel(label) {
  const l = label.toLowerCase();
  if (l.startsWith("article")) return 1;
  if (l.startsWith("section")) return 2;
  if (l.startsWith("clause"))  return 2;
  if (/^\(/.test(l))           return 4;        // (a), (b)(ii)
  const dots = (label.match(/\./g) || []).length;
  return Math.min(2 + dots, 4);                 // 1, 1.1, 1.1.1, …
}

function buildSectionTree(sections, totalChars) {
  // Walk forward, push/pop a stack by level to produce a tree.
  const root = { level: 0, label: "ROOT", title: "", startChar: 0, endChar: totalChars, children: [] };
  const stack = [root];
  for (let i = 0; i < sections.length; i++) {
    const s = { ...sections[i], children: [], endChar: totalChars };
    while (stack.length > 1 && stack[stack.length - 1].level >= s.level) {
      const popped = stack.pop();
      popped.endChar = s.startChar;
    }
    stack[stack.length - 1].children.push(s);
    stack.push(s);
  }
  return root;
}

function sectionPathFor(tree, charOffset) {
  // Find the deepest section containing charOffset and return its label path.
  const path = [];
  let node = tree;
  while (true) {
    const next = (node.children || []).find(
      (c) => c.startChar <= charOffset && charOffset < c.endChar
    );
    if (!next) break;
    path.push(next.label + (next.title ? ` — ${next.title}` : ""));
    node = next;
  }
  return path.join(" › ");
}

// ──────────────────────────────────────────────────────────────────────
// Chunking — section-aware, sentence-boundary-aware windows.
// ~800 "tokens" with ~100 overlap. We use a fast char-based proxy
// (4 chars ≈ 1 token) — accurate enough for budget math; the real model
// tokenizers are too heavy for a desktop hot path.
// ──────────────────────────────────────────────────────────────────────

const CHARS_PER_TOKEN = 4;
const CHUNK_TOKENS = 800;
const CHUNK_OVERLAP = 100;
const TARGET_CHARS  = CHUNK_TOKENS  * CHARS_PER_TOKEN;
const OVERLAP_CHARS = CHUNK_OVERLAP * CHARS_PER_TOKEN;

function chunkText(text, { tree, pages }) {
  const chunks = [];
  let cursor = 0;
  let ordinal = 0;
  const total = text.length;
  while (cursor < total) {
    let end = Math.min(cursor + TARGET_CHARS, total);
    // Prefer to break at a sentence boundary near the target.
    if (end < total) {
      const slice = text.slice(cursor, end + 200);
      const lastBreak = Math.max(
        slice.lastIndexOf(". "),
        slice.lastIndexOf(".\n"),
        slice.lastIndexOf("\n\n"),
      );
      if (lastBreak > TARGET_CHARS * 0.6) end = cursor + lastBreak + 1;
    }
    const start = cursor;
    const body = text.slice(start, end).trim();
    if (body) {
      chunks.push({
        ordinal: ordinal++,
        startChar: start,
        endChar: end,
        text: body,
        tokenCount: Math.ceil(body.length / CHARS_PER_TOKEN),
        sectionPath: sectionPathFor(tree, start),
        pageNumber: pageFor(pages, start),
      });
    }
    cursor = end - OVERLAP_CHARS;
    if (cursor <= start) cursor = end; // safety: never go backwards
  }
  // Re-prefix each chunk's text with its section path so the model sees
  // self-contained context.
  for (const c of chunks) {
    if (c.sectionPath) c.text = `[${c.sectionPath}]\n${c.text}`;
  }
  return chunks;
}

function pageFor(pages, offset) {
  for (const p of pages) {
    if (p.startChar <= offset && offset < p.endChar) return p.pageNumber;
  }
  return pages.length ? pages[pages.length - 1].pageNumber : null;
}

// ──────────────────────────────────────────────────────────────────────
// Public surface: ingest a file buffer end-to-end.
// Returns the document row (creates one or reuses by sha).
// ──────────────────────────────────────────────────────────────────────

async function ingest(buf, filename, mime) {
  const buffer = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  const sha = sha256(buffer);
  const existing = db.documents.getBySha(sha);
  if (existing) return existing;

  const { dir, extracted, chunks: chunksPath, meta, originalDir } = pathsFor(sha);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(filename) || "";
  fs.writeFileSync(path.join(originalDir, "original" + ext), buffer);

  const parsed = await parse(buffer, filename);
  fs.writeFileSync(extracted, parsed.text, "utf-8");

  const sections = detectSections(parsed.text);
  const tree = buildSectionTree(sections, parsed.text.length);
  const chunks = chunkText(parsed.text, { tree, pages: parsed.pages });

  fs.writeFileSync(chunksPath, JSON.stringify({ chunks, tree }, null, 2), "utf-8");
  fs.writeFileSync(meta, JSON.stringify({
    filename, sha256: sha, parser: parsed.parser, parserVersion: PARSER_VERSION,
    pageCount: parsed.pages.length, sizeBytes: buffer.length,
    extractedChars: parsed.text.length, ingestedAt: Date.now(),
  }, null, 2), "utf-8");

  const id = makeId();
  db.documents.insert({
    id, sha256: sha, filename,
    mime: mime || null,
    sizeBytes: buffer.length,
    pageCount: parsed.pages.length,
    parser: parsed.parser,
    parserVersion: PARSER_VERSION,
    extractedChars: parsed.text.length,
    structureJson: JSON.stringify(treeOutline(tree)),
    indexStatus: "indexed",
  });
  db.documents.insertChunks(id, chunks);
  db.documents.setIndexed(id, "indexed");

  return db.documents.get(id);
}

// Strip the section tree down to just label + range + children for the DB
// (we don't need the heavy text duplicate).
function treeOutline(tree) {
  function walk(node) {
    return {
      label: node.label, title: node.title, level: node.level,
      startChar: node.startChar, endChar: node.endChar,
      children: (node.children || []).map(walk),
    };
  }
  return walk(tree);
}

function loadStructure(docId) {
  const doc = db.documents.get(docId);
  if (!doc?.structureJson) return null;
  try { return JSON.parse(doc.structureJson); } catch { return null; }
}

function readExtracted(sha) {
  try { return fs.readFileSync(pathsFor(sha).extracted, "utf-8"); }
  catch { return ""; }
}

function readRange(sha, startChar, endChar) {
  const text = readExtracted(sha);
  return text.slice(Math.max(0, startChar), Math.min(text.length, endChar));
}

function gc() {
  // Drop any folder whose hash has no row.
  if (!docsRoot || !fs.existsSync(docsRoot)) return;
  const validShas = new Set(db.documents.list().map((d) => d.sha256));
  for (const entry of fs.readdirSync(docsRoot)) {
    if (!validShas.has(entry)) {
      const p = path.join(docsRoot, entry);
      try { fs.rmSync(p, { recursive: true, force: true }); } catch {}
    }
  }
}

module.exports = {
  init,
  ingest,
  gc,
  parse, // exposed for legacy file:parse handler
  loadStructure,
  readExtracted,
  readRange,
  PARSER_VERSION,
};
