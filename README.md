<p align="center">
  <img src="black scopic.png" alt="Scopic" width="120" />
</p>

<h1 align="center">Scopic</h1>

<p align="center">
  <strong>An open-source, local-first legal AI workspace.</strong><br/>
  Built for lawyers and paralegals who want to keep their documents on their own machine.
</p>

---

Scopic runs as a desktop app on your laptop. Your projects, conversations, and the documents you pin to them live in a single SQLite database and a content-addressed file store under your user data folder — nothing leaves your computer unless you choose a cloud chat model, and even then the cloud only ever sees the small set of retrieved excerpts a question needs, never the raw file.

It works offline against [Ollama](https://ollama.com), and optionally lets you bring your own API key for **Anthropic Claude**, **OpenAI**, or **Google Gemini** for the chat layer. **Embeddings always stay local.**

---

## Why Scopic

Most legal AI tools are SaaS — they require you to upload privileged client files to someone else's server, in someone else's jurisdiction. Scopic flips that: zero infrastructure, no accounts, no sync server, no third-party document store. You get a single binary, a single database file, and a single documents folder. Back up Scopic with `cp scopic.db`.

The whole stack is designed so that a small-firm lawyer or a privacy-strict practice can run a modern AI assistant without giving up control of their data.

---

## What's inside

### Chat
- **Multi-provider chat** — Ollama (local), Anthropic Claude, OpenAI, Google Gemini. Switch in-chat without losing history.
- **Always-on privacy chip** — `Embeddings: local · Chat: <provider · model>`. Green dot when everything is local, orange when chat is cloud.
- **Streaming responses** with a `Stop` action mid-stream.
- **Markdown rendering** with serif legal headings, proper lists, tables, code, and blockquotes.
- **Per-message actions** — Copy, Download `.md`, Download `.txt`.
- **Time-of-day greeting** on the empty Assistant view; Claude-style logo and welcome.

### Projects (matters)
- Group conversations by client, matter, or case.
- Add a project description that's prepended to every chat as context (parties, jurisdiction, background).
- **Pin documents** to a project. They get parsed, structured, chunked, indexed, and (locally) embedded. Every chat inside that project automatically has them available.
- Documents are **content-addressed by sha256** — the same NDA pinned to three matters is stored on disk once.
- Move conversations between projects from the sidebar.

### Documents
- Supported formats: **PDF, scanned PDF, PNG/JPG/TIFF/WebP/BMP, DOCX, XLSX/XLS, CSV/TSV, TXT, MD**.
- Parsers run in-process — no external LibreOffice, MinIO, Chroma, LanceDB, or OCR daemon required.
- Scanned PDFs automatically fall back to **local Tesseract OCR** when normal PDF text extraction finds almost no text. English traineddata is bundled, so OCR does not download language files at runtime.
- Section-aware structure detection for legal docs (`Article I`, `Section 5.2`, `(a)(ii)`, numeric outlines). The detected section tree powers both citations and the Deep Review agent.
- Section-aware chunking (~800 tokens, 100 overlap, sentence-boundary aware). Each chunk is prefixed with its section path so the model always sees self-contained context.
- Documents are written to `userData/documents/<sha256>/{original.<ext>, extracted.txt, chunks.json, meta.json}` so you can inspect and back them up directly.

### Retrieval — Hybrid RAG
Every chat message inside a project is routed through a tiny decision tree:

| Situation | What happens |
|---|---|
| No project | Plain chat. No retrieval. |
| Project, no docs | Matter context is prepended; no retrieval. |
| Project docs fit in 60% of the chat model's context window | All doc text is inlined. |
| Project docs would overflow | **Hybrid RAG** runs. |

Hybrid RAG combines:
- **BM25** keyword retrieval over SQLite's FTS5 index — catches exact legal terminology.
- **SQLite-native vector search** via `sqlite-vec` for nomic-embed-text embeddings, with the prior JSON/cosine path kept as a compatibility fallback.
- **Reciprocal Rank Fusion** (k = 60) merges both rankings.
- **Top 8 excerpts** are sent to the chat model with bracketed `[n]` citations.

Before retrieval, a one-shot **query rewrite** call against Ollama turns *"Is that enforceable?"* into *"Is the irrevocable proxy in Section 5.2 enforceable under New York law?"* so multi-turn follow-ups don't lose recall.

Every retrieved excerpt is surfaced as an expandable **citation chip** under the assistant's reply, showing the source filename and section path.

### Deep Review (tree-walk reasoning)
For whole-document analysis (`"Full Contract Review"`, `"summarize this 200-page filing"`), the LLM navigates the detected section tree of a single document. It picks which sections to read top-down, reads them at full text, and synthesizes a structured, cited answer. No embeddings required — it operates on the structure index alone.

Used by workflow pipelines and exposed via `window.rag.deepReview` (UI surface ships in the next release).

### Workflows
- **Single-shot workflows** — pre-built prompts the user can drop into the input. Today: CP Checklist, Credit Agreement Summary, Shareholder Agreement Summary, Change of Control Review, NDA Drafting, Top 5 Contract Risks, IRAC Case Analysis, Compliance Scan, Pre-Funding IP Audit, Term Sheet Walkthrough.
- **Multi-step pipelines** — chained prompts where each step sees previous outputs. Today: Full Contract Review (extract → risks → redlines), Litigation Prep (IRAC → causes of action → complaint outline), Pre-Investment Diligence (IP audit → corporate audit → red flags).

### Tabular Review
Spreadsheet-style review of a corpus: rows = documents (or clauses), columns = questions you want answered for each row.

### Search
- **FTS5 search over every past message** — the sidebar's `Recents` section is backed by `messages_fts`.
- **FTS5 search over every document chunk** — find every clause containing "force majeure" across pinned docs, no LLM call needed.

### Auto-update
- Signed Windows installer + blockmap + `latest.yml` are published to GitHub Releases.
- Installed clients pick up new versions automatically via `electron-updater`.

---

## Privacy posture

| Action | Data path |
|---|---|
| Open a document | Bytes → local disk only. Hashed, parsed, chunked locally. |
| Embed a document | `Ollama /api/embeddings` (localhost). Never leaves the machine. |
| Ask a question (local chat) | Question + retrieved excerpts → Ollama (localhost). |
| Ask a question (cloud chat) | Question + retrieved excerpts → chosen provider. **Never** the raw file. **Never** the full corpus. |
| Save a conversation | One INSERT into `scopic.db`. |
| Search past chats | One FTS5 query against `messages_fts`. |
| Back up everything | `cp -r userData/scopic ./backup`. |

There is no Scopic server. There is no telemetry. The chip in the chat header always shows you which providers your current message will touch.

---

## Architecture — the full stack

```
┌─────────────────────────────────────────────────────────────────┐
│                       Electron renderer                         │
│   React + Vite + Tailwind                                       │
│   - Sidebar  - ChatArea  - ProjectsView  - TabularReviewView    │
│   - WorkflowsView  - ProjectModal  - SettingsModal              │
│   - PrivacyChip · RetrievalChip · ScopicLogo (inline SVG)       │
└─────────────────────────────┬───────────────────────────────────┘
                              │ contextBridge / ipcRenderer
┌─────────────────────────────▼───────────────────────────────────┐
│                       Electron main                             │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌─────────────┐  │
│  │ db.js    │  │ documents.js │  │ rag.js   │  │ providers.js│  │
│  │ SQLite + │  │ ingest +     │  │ embed +  │  │ Ollama /    │  │
│  │ FTS5 +   │  │ parse +      │  │ retrieve │  │ Anthropic / │  │
│  │ schema + │  │ structure +  │  │ + RRF +  │  │ OpenAI /    │  │
│  │ repos    │  │ chunk + GC   │  │ treewalk │  │ Gemini      │  │
│  └────┬─────┘  └──────┬───────┘  └────┬─────┘  └─────────────┘  │
└───────┼───────────────┼───────────────┼─────────────────────────┘
        │               │               │
   ┌────▼───────────────▼───────────────▼──────┐
   │            userData/scopic/               │
   │  scopic.db        ← all structured data   │
   │  scopic.db-wal    ← WAL journal           │
   │  documents/<sha256>/                      │
   │    original.<ext>                         │
   │    extracted.txt                          │
   │    chunks.json                            │
   │    meta.json                              │
   │  settings.json    ← electron-store KV     │
   └───────────────────────────────────────────┘
```

### Detailed tech stack

**Desktop shell**
- **Electron** — cross-platform desktop runtime. Custom frameless titlebar with our own minimize/maximize/close controls.
- **electron-builder** — packaging + signed installer + auto-updater wiring.
- **electron-updater** — GitHub Releases as the update channel; `latest.yml` + blockmap + setup `.exe`.

**Renderer**
- **React 18** + **Vite 6** — fast dev loop, modern JSX, esbuild bundling.
- **Tailwind CSS 3** — utility-first styling, plus a small set of CSS variables for theming (light / dark / system).
- **DM Serif Display** + **Inter** — typography pair: serif for headings, sans for body.
- **Inline SVG logo** — crisp at any size, follows `currentColor` so it adapts to theme.

**Main-process data layer**
- **better-sqlite3 12** — synchronous, in-process SQLite. WAL journal. Foreign keys on. No daemon, no port.
- **SQLite FTS5** — full-text search over chunks and messages. Porter stemmer, unicode tokenizer, diacritic stripping. Maintained automatically via INSERT/UPDATE/DELETE triggers.
- **sqlite-vec** — optional in-process vector index for 768-dimensional `nomic-embed-text` embeddings. If the extension is unavailable, Scopic automatically falls back to JSON-stored vectors and JS cosine.
- **Filesystem documents store** — content-addressed under `userData/documents/<sha256>/`. The DB holds only metadata; bytes live on disk.
- **electron-store** — tiny KV for settings only (no longer used for conversations or projects).

**Document parsers** (all in-process Node libraries — no external binaries)
- **pdf-parse** — PDF text extraction with per-page offsets, used to anchor citations.
- **pdf.js + @napi-rs/canvas + Tesseract.js** — scanned-PDF/image OCR, local only, with bundled English traineddata.
- **mammoth** — DOCX to plain text.
- **exceljs** — XLSX / XLS workbooks; each sheet becomes a synthetic "page".
- **plain decoder** for TXT / MD / CSV / TSV.

**Indexing pipeline**
1. Hash bytes (sha256) → dedupe by content.
2. Write `original.<ext>` and `extracted.txt` to disk.
3. Detect section structure with a conservative regex (`Article I`, `Section 5.2`, `(a)`, numeric outlines).
4. Build a section tree.
5. Chunk inside sections — ~800 tokens, 100 overlap, sentence-boundary aware.
6. Prefix every chunk with its section path so it's self-contained.
7. Insert into `document_chunks`. FTS5 trigger auto-populates `chunks_fts`.
8. For scanned PDFs/images, run local OCR before structure detection so the same tree/chunk pipeline is reused.
9. Queue embedding pass (background).

**Embeddings**
- **Ollama `/api/embeddings`** with **nomic-embed-text** (768-dim) as the default.
- Embeddings are stored as JSON arrays for compatibility and mirrored into a `sqlite-vec` virtual table when the local extension is available.
- Vector retrieval uses SQLite-native nearest-neighbor search first, then falls back to JS cosine if needed.
- Cloud embeddings (OpenAI / Voyage) are an opt-in setting — disabled by default to keep the privacy story intact.

**Retrieval**
- **BM25** via `bm25(chunks_fts)` — pool of 25.
- **Vector search** through `sqlite-vec` when available, or JS cosine over same-document candidates as a fallback — pool of 25.
- **Reciprocal Rank Fusion** with `k = 60` merges both rankings → final top **8**.
- **Project isolation** is enforced at the SQL level: every retrieval query has `WHERE document_id IN (project's docs)`. No JS post-filter.
- Optional **query rewrite** before retrieval — one Ollama call rewrites context-dependent questions into self-contained ones.

**Tree-walk agent (Deep Review)**
- Operates on the cached section tree, not embeddings.
- Step 1: LLM picks `N` most relevant section paths from the outline.
- Step 2: each picked section is read at full text, capped per section to keep the synthesis prompt sane.
- Step 3: synthesis prompt assembled with numbered citations; streamed to the renderer.

**Chat providers** (all routed through the main process to keep API keys in one trust boundary)
- **Ollama** — `/api/chat` streaming, NDJSON line-by-line decode.
- **Anthropic** — `/v1/messages` SSE; auto-skip `temperature` on Opus 4.7+.
- **OpenAI** — `/v1/chat/completions` SSE; auto-skip `temperature` on o-series and GPT-5 family.
- **Gemini** — `/v1beta/models/...:streamGenerateContent` SSE; auto-skip `temperature` on Gemini 3+.

**System prompt composition** (built in `rag.js`, never in the renderer)
```
[base directives — legal AI core prompt]

═══ MATTER CONTEXT ═══
Matter: <project name>
Background: <project description>
Documents (N): • <filename> (Np) — <short summary>  ...

═══ RETRIEVED EXCERPTS ═══
[1] <filename> — <section path>:
"""<chunk text>"""
[2] ...

═══ INSTRUCTIONS ═══
- Ground answers in excerpts and matter context.
- Cite with [n] for any claim grounded in an excerpt.
- Flag when knowledge is not document-grounded.
- Never reference documents from other matters.
```

**Build + release**
- `vite build` produces `dist-renderer/`.
- `electron-builder --win --publish never` produces `dist/Scopic.Setup.<version>.exe` + `.exe.blockmap` + `latest.yml`.
- GitHub Actions publishes the release on tag push (`v*`).
- Installed clients auto-pick the new version via `electron-updater`.

---

## Getting started — lawyers

**1. Install Ollama** — [ollama.com/download](https://ollama.com/download). Run the installer; it runs in the background.

**2. Pull a chat model and the embedding model.**
```
ollama pull phi3
ollama pull nomic-embed-text
```

Recommended chat models by hardware:
- No dedicated GPU → `phi3` (~2.2 GB, default)
- With NVIDIA GPU → `mistral` (~4.1 GB) or `llama3.1:8b` (~4.7 GB)
- Heavy hardware → `llama3.1:70b-instruct-q4_0` (~40 GB)

**3. Install Scopic** — download the latest `Scopic.Setup.<version>.exe` from the [Releases page](https://github.com/ezazahamad2003/scopic/releases) and run it. A desktop shortcut is created automatically. Future updates install themselves.

**4. Launch Scopic.** The privacy chip in the chat header shows your current setup. Green dot = everything local. Type a legal question, drop a contract into `+ Documents`, or pin a document to a project.

> **No Node.js, no npm, no developer tools required.** The installer is self-contained.

---

## Getting started — developers

```bash
git clone https://github.com/ezazahamad2003/scopic.git
cd scopic/scopic
npm install
npm run rebuild          # rebuild native modules (better-sqlite3/sqlite-vec support) against the Electron ABI
ollama pull phi3
ollama pull nomic-embed-text
npm run dev              # starts Vite + Electron
```

Build a Windows installer:
```bash
npm run build:win
```
Output lands in `scopic/dist/`.

The codebase has three big modules in `src/main/`:
- [`db.js`](scopic/src/main/db.js) — schema, migrations, repositories, retrieval helpers.
- [`documents.js`](scopic/src/main/documents.js) — ingest, parse, structure detection, chunker, GC.
- [`ocr.js`](scopic/src/main/ocr.js) — local scanned-PDF/image OCR via pdf.js, canvas, and bundled Tesseract data.
- [`rag.js`](scopic/src/main/rag.js) — embeddings, hybrid retrieval, prompt composer, tree-walk agent.

The renderer is in `src/renderer/` with hooks in `hooks/` and components in `components/`.

---

## Configuration

Open Settings (gear icon, bottom-left of the sidebar):

- **Provider** — Ollama (local) / Anthropic / OpenAI / Gemini.
- **Model** — live-fetched from the provider; pick from the dropdown.
- **API keys** — stored in your OS user-data directory only; only sent to the matching provider.
- **Embeddings** — on/off, model name. Disabled embeddings = BM25-only retrieval (still works, just less semantic).
- **Theme** — light, dark, or follow system.
- **Ollama URL** — defaults to `http://localhost:11434`.

You can switch providers at any time without losing chat history.

---

## Troubleshooting

**The privacy chip says `indexing N`**
The background embedding pass is still running for newly added documents. Retrieval works in the meantime (BM25 only); semantic recall improves once it finishes.

**Ollama offline**
Open Command Prompt and run `ollama serve`. Restart Scopic.

**Responses are slow on local models**
Normal on CPU-only machines for >7B models. Try `phi3` for quick responses, or pick a cloud provider in Settings.

**Documents not showing up in retrieval**
Make sure they're pinned to the active project (sidebar → Projects → Edit). Documents attached inline via `+ Documents` are sent for that turn only, not indexed.

**Migrating between machines**
Copy `%APPDATA%/scopic/` to the other machine. That's the entire state.

---

## License

**AGPL-3.0-or-later.** Since v1.6.0, Scopic ships under the GNU Affero General Public License v3.0. Full text in [scopic/LICENSE](scopic/LICENSE).

You can use, modify, and distribute Scopic freely. If you distribute a modified version (or run one as a network service), you must publish your source under the same license.

Releases prior to v1.5.5 remain available under the MIT terms they originally shipped with.
