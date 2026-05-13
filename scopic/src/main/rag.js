// Retrieval-Augmented Generation for Scopic.
//
// Two modes, sharing the same parse + structure + chunk index:
//
//   1. Hybrid RAG — BM25 (FTS5) ⊕ vector cosine (Ollama embeddings),
//      fused with RRF. Default for ad-hoc Q&A inside a project.
//
//   2. Tree-walk — agent navigates the section tree of a single doc,
//      reads sections by label. Used by Deep Review and the contract-
//      review workflow. No embeddings required.
//
// Embedding model is INDEPENDENT of the chat model. Ollama
// nomic-embed-text by default; nothing leaves the machine for indexing
// even when the user picks a cloud chat model. Retrieval only sends the
// top-k chunks to the chat provider.

const db = require("./db");
const documentsModule = require("./documents");

// ──────────────────────────────────────────────────────────────────────
// Embeddings via Ollama.
// ──────────────────────────────────────────────────────────────────────

const DEFAULT_EMBED_MODEL = "nomic-embed-text";

// Avoid Node's IPv6-first resolution of `localhost`. Ollama listens on
// IPv4 by default, so resolving to ::1 produces "fetch failed".
function normalizeUrl(url) {
  if (!url) return "http://127.0.0.1:11434";
  return url.replace(/\/\/localhost(?=[:\/]|$)/i, "//127.0.0.1");
}

async function embedText(text, { ollamaUrl, model = DEFAULT_EMBED_MODEL, signal } = {}) {
  const target = `${normalizeUrl(ollamaUrl)}/api/embeddings`;
  let response;
  try {
    response = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: text }),
      signal,
    });
  } catch (err) {
    const code = err?.cause?.code || err?.cause?.errno;
    const detail = err?.cause?.message || err?.message || "unknown";
    const hint = code === "ECONNREFUSED" ? " Is Ollama running? Start it with `ollama serve`." : "";
    throw new Error(`Cannot reach Ollama (embeddings) at ${target}. ${detail}.${hint}`);
  }
  if (!response.ok) {
    const err = await response.text().catch(() => response.statusText);
    throw new Error(`Embedding failed: ${err}`);
  }
  const data = await response.json();
  return data.embedding;
}

async function embedPendingChunks({ ollamaUrl, model = DEFAULT_EMBED_MODEL, onProgress, signal } = {}) {
  // Walk the table in pages of 50 until nothing remains.
  let total = 0;
  for (;;) {
    const batch = db.documents.chunksWithoutEmbedding(model, 50);
    if (!batch.length) break;
    for (const chunk of batch) {
      if (signal?.aborted) return total;
      try {
        const vec = await embedText(chunk.text, { ollamaUrl, model, signal });
        if (Array.isArray(vec) && vec.length) {
          db.documents.setChunkEmbedding(chunk.id, vec, model);
          total++;
          onProgress?.({ done: total, current: chunk });
        }
      } catch (err) {
        // Skip this chunk on failure — it'll be retried on the next pass.
        onProgress?.({ done: total, error: err.message });
      }
    }
  }
  return total;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ──────────────────────────────────────────────────────────────────────
// Hybrid retrieval — BM25 ⊕ vector, fused with Reciprocal Rank Fusion.
// ──────────────────────────────────────────────────────────────────────

const RRF_K = 60;
const BM25_POOL = 25;
const VECTOR_POOL = 25;
const FINAL_TOP_K = 8;

async function hybridRetrieve(query, projectId, { ollamaUrl, embedModel = DEFAULT_EMBED_MODEL } = {}) {
  const documentIds = db.retrieval.projectDocumentIds(projectId);
  if (!documentIds.length) return [];

  // 1. BM25 candidate set (free, fast).
  const bm25 = db.retrieval.bm25(query, documentIds, BM25_POOL);

  // 2. Vector candidates — only if embeddings are present.
  let vector = [];
  let queryVec = null;
  try {
    queryVec = ollamaUrl ? await embedText(query, { ollamaUrl, model: embedModel }) : null;
  } catch {
    queryVec = null;
  }
  if (queryVec) {
    const accelerated = db.retrieval.vectorSearch(documentIds, embedModel, queryVec, VECTOR_POOL);
    if (accelerated.length) {
      vector = accelerated.map((row) => ({ ...row, score: 1 / (1 + row.score) }));
    } else {
      const candidates = db.retrieval.vectorCandidates(documentIds, embedModel, 500);
      vector = candidates
        .map((c) => {
          let v;
          try { v = JSON.parse(c.embedding); } catch { return null; }
          return { ...c, score: cosine(queryVec, v) };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)
        .slice(0, VECTOR_POOL);
    }
  }

  // 3. Reciprocal Rank Fusion.
  const fused = new Map(); // chunk id → {row, rrf}
  bm25.forEach((row, rank) => {
    const slot = fused.get(row.id) || { row, rrf: 0 };
    slot.rrf += 1 / (RRF_K + rank + 1);
    fused.set(row.id, slot);
  });
  vector.forEach((row, rank) => {
    const slot = fused.get(row.id) || { row, rrf: 0 };
    slot.rrf += 1 / (RRF_K + rank + 1);
    fused.set(row.id, slot);
  });

  return [...fused.values()]
    .sort((a, b) => b.rrf - a.rrf)
    .slice(0, FINAL_TOP_K)
    .map(({ row, rrf }, idx) => ({
      citationIndex: idx + 1,
      chunkId: row.id,
      documentId: row.documentId,
      sectionPath: row.sectionPath,
      pageNumber: row.pageNumber,
      text: row.text,
      score: rrf,
    }));
}

// ──────────────────────────────────────────────────────────────────────
// Query rewrite — turn a context-dependent follow-up into a self-
// contained question so retrieval doesn't whiff on pronouns.
// One small Ollama call (or skip if Ollama isn't around).
// ──────────────────────────────────────────────────────────────────────

async function rewriteQuery(question, history, { ollamaUrl, model } = {}) {
  if (!ollamaUrl || !model) return question;
  const turns = (history || []).slice(-6).map((m) =>
    `${m.role === "assistant" ? "A" : "U"}: ${m.content?.slice(0, 400) || ""}`
  ).join("\n");
  const prompt = `You rewrite legal questions so they stand alone.

Conversation so far:
${turns}

User just asked: ${question}

Rewrite the question into one self-contained sentence, preserving every reference
to documents, sections, parties, jurisdictions, and dates. If the question is
already self-contained, return it unchanged. Output only the rewritten question
and nothing else.`;
  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0.1, num_predict: 200 } }),
    });
    if (!response.ok) return question;
    const data = await response.json();
    const out = (data?.response || "").trim().replace(/^["']|["']$/g, "");
    return out || question;
  } catch {
    return question;
  }
}

// ──────────────────────────────────────────────────────────────────────
// Prompt composition — base directives first, then matter context, then
// excerpts, then explicit instructions. The retrieved chunks always go
// last so they're freshest in the model's attention.
// ──────────────────────────────────────────────────────────────────────

function buildSystemPrompt({ basePrompt, project, excerpts }) {
  const parts = [basePrompt.trim()];

  if (project) {
    parts.push("", "═══ MATTER CONTEXT ═══", `Matter: ${project.name}`);
    if (project.description?.trim()) {
      parts.push("", "Background:", project.description.trim());
    }
    const docs = project.documents || [];
    if (docs.length) {
      parts.push("", `Documents in this matter (${docs.length} files):`);
      for (const d of docs.slice(0, 20)) {
        const summary = d.shortSummary ? ` — ${d.shortSummary}` : "";
        const pages = d.pageCount ? ` (${d.pageCount}p)` : "";
        parts.push(`  • ${d.name}${pages}${summary}`);
      }
      if (docs.length > 20) parts.push(`  • …and ${docs.length - 20} more.`);
    }
  }

  if (excerpts?.length) {
    parts.push("", "═══ RETRIEVED EXCERPTS ═══",
      "The following excerpts were retrieved as most relevant to the user's question.",
      "Cite them inline using bracketed indices like [1], [3]. Only cite from these",
      "excerpts — never invent citations or quote text not shown here.",
    );
    for (const e of excerpts) {
      const where = e.sectionPath || (e.pageNumber ? `p. ${e.pageNumber}` : "");
      const doc = db.documents.get(e.documentId);
      const name = doc?.filename || "document";
      parts.push("", `[${e.citationIndex}] ${name}${where ? ` — ${where}` : ""}:`, `"""`, e.text, `"""`);
    }
  }

  parts.push("", "═══ INSTRUCTIONS ═══");
  if (excerpts?.length) {
    parts.push(
      "- Ground your answer in the excerpts and matter context above.",
      "- Cite with [n] markers whenever you rely on an excerpt.",
      "- If the excerpts don't cover the question, say so explicitly, then answer",
      "  from general legal knowledge and flag that part as not document-grounded.",
      "- Never reference documents from other matters.",
    );
  } else if (project) {
    parts.push(
      "- Use the matter context above when relevant.",
      "- If you'd need document content to answer well, say so and suggest which",
      "  document the user should pin or attach.",
    );
  } else {
    parts.push("- Answer the user's legal question directly.");
  }
  return parts.join("\n");
}

// ──────────────────────────────────────────────────────────────────────
// Router — decide retrieval mode and assemble the final messages array.
// Called by the chat IPC handler. Returns {messages, citations, mode}.
// ──────────────────────────────────────────────────────────────────────

const INLINE_BUDGET_CHARS = {
  ollama:    20000,
  anthropic: 400000,
  openai:    250000,
  gemini:    1000000,
};

async function buildChatPayload({
  basePrompt, project, history, userPrompt,
  chatProvider, chatModel, ollamaUrl, embedModel = DEFAULT_EMBED_MODEL,
}) {
  // No project → plain chat, no retrieval.
  if (!project) {
    return {
      mode: "plain",
      citations: [],
      messages: [
        { role: "system", content: basePrompt },
        ...history,
        { role: "user", content: userPrompt },
      ],
    };
  }

  // Project has no docs → just project context, no retrieval.
  const docs = project.documents || [];
  if (!docs.length) {
    return {
      mode: "project",
      citations: [],
      messages: [
        { role: "system", content: buildSystemPrompt({ basePrompt, project, excerpts: [] }) },
        ...history,
        { role: "user", content: userPrompt },
      ],
    };
  }

  // Budget check — can we inline every doc's full text?
  const budget = INLINE_BUDGET_CHARS[chatProvider] || INLINE_BUDGET_CHARS.ollama;
  const totalChars = docs.reduce((sum, d) => sum + (d.extractedChars || 0), 0);
  if (totalChars > 0 && totalChars <= budget * 0.6) {
    // Inline mode — small project, send everything.
    const fullExcerpts = docs
      .map((d, i) => {
        const doc = db.documents.get(d.id);
        if (!doc) return null;
        const text = documentsModule.readExtracted(doc.sha256);
        return text ? {
          citationIndex: i + 1,
          chunkId: null,
          documentId: doc.id,
          sectionPath: null,
          pageNumber: null,
          text,
        } : null;
      })
      .filter(Boolean);
    return {
      mode: "inline",
      citations: fullExcerpts.map((e) => ({
        citationIndex: e.citationIndex,
        documentId: e.documentId,
        sectionPath: e.sectionPath,
        pageNumber: e.pageNumber,
      })),
      messages: [
        { role: "system", content: buildSystemPrompt({ basePrompt, project, excerpts: fullExcerpts }) },
        ...history,
        { role: "user", content: userPrompt },
      ],
    };
  }

  // Overflow — RAG.
  const rewritten = await rewriteQuery(userPrompt, history, { ollamaUrl, model: chatProvider === "ollama" ? chatModel : null });
  const excerpts = await hybridRetrieve(rewritten || userPrompt, project.id, { ollamaUrl, embedModel });
  return {
    mode: "rag",
    rewrittenQuery: rewritten,
    citations: excerpts.map((e) => ({
      citationIndex: e.citationIndex,
      chunkId: e.chunkId,
      documentId: e.documentId,
      sectionPath: e.sectionPath,
      pageNumber: e.pageNumber,
    })),
    messages: [
      { role: "system", content: buildSystemPrompt({ basePrompt, project, excerpts }) },
      ...history,
      { role: "user", content: userPrompt },
    ],
  };
}

// ──────────────────────────────────────────────────────────────────────
// Tree-walk reasoning agent. Used by Deep Review and the contract
// pipeline. Navigates a single document's section tree, expanding the
// most relevant branches.
//
// We deliberately don't use embeddings here — the LLM picks sections by
// label + summary. This makes it fast on local models and easy to
// explain ("the model is reading Section 5.2 now").
// ──────────────────────────────────────────────────────────────────────

async function deepReview({ documentId, question, dispatchLLM, maxSections = 8, signal, onProgress } = {}) {
  const doc = db.documents.get(documentId);
  if (!doc) throw new Error("Document not found");
  const outline = (() => { try { return JSON.parse(doc.structureJson); } catch { return null; } })();
  if (!outline) throw new Error("Document has no structure index");

  // Flatten the outline into a navigable list of {path, range, label}.
  const flat = [];
  (function walk(node, path) {
    for (const child of node.children || []) {
      const p = [...path, child.label + (child.title ? ` — ${child.title}` : "")];
      flat.push({ path: p.join(" › "), startChar: child.startChar, endChar: child.endChar, label: child.label });
      walk(child, p);
    }
  })(outline, []);

  if (!flat.length) {
    // Doc has no detected structure — fall back to a straight read of the
    // first ~2 chunks plus the BM25 top-3 for the question.
    const chunks = db.documents.listChunks(documentId);
    const seed = chunks.slice(0, 2).map((c, i) => ({ citationIndex: i + 1, ...c }));
    return { sectionsRead: [], findings: seed };
  }

  // Step 1 — let the LLM pick a small set of section paths to read.
  const outlineText = flat.slice(0, 80).map((s, i) => `  ${i + 1}. ${s.path}`).join("\n");
  const pickerPrompt =
    `You are reviewing the document "${doc.filename}".\n` +
    `Question: ${question}\n\n` +
    `Section outline (truncated to first 80):\n${outlineText}\n\n` +
    `Pick the ${maxSections} section numbers most relevant to answering. Reply with only a comma-separated list of numbers, no prose.`;

  const pickResp = await dispatchLLM({ prompt: pickerPrompt, max_tokens: 200, temperature: 0.1, signal });
  const picks = (pickResp.match(/\d+/g) || [])
    .map((s) => parseInt(s, 10))
    .filter((n) => n >= 1 && n <= flat.length)
    .slice(0, maxSections)
    .map((n) => flat[n - 1]);

  if (!picks.length) {
    const chunks = db.documents.listChunks(documentId).slice(0, maxSections);
    return { sectionsRead: [], findings: chunks.map((c, i) => ({ citationIndex: i + 1, ...c, documentId })) };
  }

  // Step 2 — read each picked section's text.
  const findings = [];
  let idx = 1;
  for (const s of picks) {
    onProgress?.({ section: s.path });
    const text = documentsModule.readRange(doc.sha256, s.startChar, s.endChar);
    findings.push({
      citationIndex: idx++,
      documentId,
      sectionPath: s.path,
      pageNumber: null,
      text: text.slice(0, 4000), // cap per-section to keep prompt sane
    });
  }
  return { sectionsRead: picks.map((s) => s.path), findings };
}

module.exports = {
  DEFAULT_EMBED_MODEL,
  embedText,
  embedPendingChunks,
  hybridRetrieve,
  rewriteQuery,
  buildSystemPrompt,
  buildChatPayload,
  deepReview,
};
