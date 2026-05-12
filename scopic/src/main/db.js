// Local SQLite store for Scopic.
//
// One file, one process, no daemon. Owns all structured data:
// projects, conversations, messages, documents (metadata),
// document_chunks, FTS5 indexes over chunks and messages,
// and optional vector embeddings stored as JSON blobs.
//
// Document *bytes* live on disk under userData/documents/<sha>/ and
// are managed by documents.js — this module never touches the files.

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

let db = null;
let dbPath = null;
let sqliteVecAvailable = false;
const SQLITE_VEC_DIMENSIONS = 768; // nomic-embed-text

const MIGRATIONS = [
  // v1 — initial schema. Everything we need for Phase 1+2+3+4.
  // schema_version is created out-of-band by runMigrations() so we
  // can read it before any migration ran.
  `
  CREATE TABLE projects (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    color       TEXT,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );

  CREATE TABLE conversations (
    id          TEXT PRIMARY KEY,
    project_id  TEXT REFERENCES projects(id) ON DELETE SET NULL,
    title       TEXT,
    mode        TEXT,
    model       TEXT,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );
  CREATE INDEX idx_conversations_project ON conversations(project_id);
  CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC);

  CREATE TABLE messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL,
    content         TEXT NOT NULL,
    token_count     INTEGER,
    created_at      INTEGER NOT NULL
  );
  CREATE INDEX idx_messages_conversation ON messages(conversation_id, id);

  CREATE TABLE documents (
    id              TEXT PRIMARY KEY,
    sha256          TEXT UNIQUE NOT NULL,
    filename        TEXT NOT NULL,
    mime            TEXT,
    size_bytes      INTEGER NOT NULL,
    page_count      INTEGER,
    parser          TEXT,
    parser_version  TEXT,
    extracted_chars INTEGER,
    short_summary   TEXT,
    structure_json  TEXT,
    index_status    TEXT NOT NULL DEFAULT 'pending',
    indexed_at      INTEGER,
    created_at      INTEGER NOT NULL
  );

  CREATE TABLE project_documents (
    project_id  TEXT NOT NULL REFERENCES projects(id)  ON DELETE CASCADE,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    added_at    INTEGER NOT NULL,
    PRIMARY KEY (project_id, document_id)
  );

  CREATE TABLE message_attachments (
    message_id  INTEGER NOT NULL REFERENCES messages(id)  ON DELETE CASCADE,
    document_id TEXT    NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    PRIMARY KEY (message_id, document_id)
  );

  CREATE TABLE document_chunks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id   TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    ordinal       INTEGER NOT NULL,
    section_path  TEXT,
    page_number   INTEGER,
    start_char    INTEGER,
    end_char      INTEGER,
    text          TEXT NOT NULL,
    token_count   INTEGER,
    embedding     TEXT,      -- JSON array of floats; nullable
    embed_model   TEXT       -- the embedding model name; nullable
  );
  CREATE INDEX idx_chunks_doc ON document_chunks(document_id, ordinal);
  CREATE INDEX idx_chunks_embed_null ON document_chunks(embedding) WHERE embedding IS NULL;

  -- Full-text search over chunks. external-content FTS5 mirroring document_chunks.text.
  CREATE VIRTUAL TABLE chunks_fts USING fts5(
    text,
    content='document_chunks',
    content_rowid='id',
    tokenize='porter unicode61 remove_diacritics 2'
  );
  CREATE TRIGGER chunks_ai AFTER INSERT ON document_chunks BEGIN
    INSERT INTO chunks_fts(rowid, text) VALUES (new.id, new.text);
  END;
  CREATE TRIGGER chunks_ad AFTER DELETE ON document_chunks BEGIN
    INSERT INTO chunks_fts(chunks_fts, rowid, text) VALUES('delete', old.id, old.text);
  END;
  CREATE TRIGGER chunks_au AFTER UPDATE OF text ON document_chunks BEGIN
    INSERT INTO chunks_fts(chunks_fts, rowid, text) VALUES('delete', old.id, old.text);
    INSERT INTO chunks_fts(rowid, text) VALUES (new.id, new.text);
  END;

  -- Full-text search over messages.
  CREATE VIRTUAL TABLE messages_fts USING fts5(
    content,
    content='messages',
    content_rowid='id',
    tokenize='porter unicode61 remove_diacritics 2'
  );
  CREATE TRIGGER messages_ai AFTER INSERT ON messages BEGIN
    INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
  END;
  CREATE TRIGGER messages_ad AFTER DELETE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.id, old.content);
  END;
  CREATE TRIGGER messages_au AFTER UPDATE OF content ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.id, old.content);
    INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
  END;

  CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
];

function open(userDataDir) {
  if (db) return db;
  dbPath = path.join(userDataDir, "scopic.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");
  db.pragma("temp_store = MEMORY");
  loadVectorExtension();
  runMigrations();
  ensureVectorTable();
  backfillVectorTable();
  return db;
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

function runMigrations() {
  // Ensure schema_version table exists (so we can read the current version
  // even on a brand-new DB). The CREATE in migration v1 is a no-op then.
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL
  );`);

  const row = db.prepare("SELECT MAX(version) AS v FROM schema_version").get();
  const current = row?.v || 0;
  for (let i = current; i < MIGRATIONS.length; i++) {
    const sql = MIGRATIONS[i];
    const apply = db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?, ?)")
        .run(i + 1, Date.now());
    });
    apply();
  }
}

function loadVectorExtension() {
  try {
    const sqliteVec = require("sqlite-vec");
    sqliteVec.load(db);
    db.prepare("SELECT vec_version() AS version").get();
    sqliteVecAvailable = true;
  } catch {
    sqliteVecAvailable = false;
  }
}

function ensureVectorTable() {
  if (!sqliteVecAvailable) return;
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS chunk_vectors
      USING vec0(embedding float[${SQLITE_VEC_DIMENSIONS}]);
    `);
  } catch {
    sqliteVecAvailable = false;
  }
}

function backfillVectorTable() {
  if (!sqliteVecAvailable) return;
  try {
    const rows = db.prepare(`
      SELECT id, embedding
      FROM document_chunks
      WHERE embedding IS NOT NULL
        AND id NOT IN (SELECT rowid FROM chunk_vectors)
    `).all();
    const insert = db.prepare("INSERT OR REPLACE INTO chunk_vectors(rowid, embedding) VALUES (?, ?)");
    const tx = db.transaction(() => {
      for (const row of rows) {
        let embedding = null;
        try { embedding = JSON.parse(row.embedding); } catch {}
        if (Array.isArray(embedding) && embedding.length === SQLITE_VEC_DIMENSIONS) {
          insert.run(vectorRowId(row.id), vectorBlob(embedding));
        }
      }
    });
    tx();
  } catch {}
}

function vectorBlob(embedding) {
  return Float32Array.from(embedding);
}

function vectorRowId(id) {
  return BigInt(id);
}

function deleteChunkVectors(chunkIds) {
  if (!sqliteVecAvailable || !chunkIds?.length) return;
  const del = db.prepare("DELETE FROM chunk_vectors WHERE rowid = ?");
  for (const id of chunkIds) {
    try { del.run(vectorRowId(id)); } catch {}
  }
}

// ──────────────────────────────────────────────────────────────────────
// Repository — projects
// ──────────────────────────────────────────────────────────────────────

const projectsRepo = {
  list() {
    return db.prepare(`
      SELECT id, name, description, color, created_at AS createdAt, updated_at AS updatedAt
      FROM projects
      ORDER BY updated_at DESC
    `).all().map(withProjectDocs);
  },
  get(id) {
    const row = db.prepare(`
      SELECT id, name, description, color, created_at AS createdAt, updated_at AS updatedAt
      FROM projects WHERE id = ?
    `).get(id);
    return row ? withProjectDocs(row) : null;
  },
  upsert(project) {
    const now = Date.now();
    const exists = db.prepare("SELECT 1 FROM projects WHERE id = ?").get(project.id);
    if (exists) {
      db.prepare(`
        UPDATE projects SET name=?, description=?, color=?, updated_at=?
        WHERE id=?
      `).run(project.name, project.description || null, project.color || null, now, project.id);
    } else {
      db.prepare(`
        INSERT INTO projects (id, name, description, color, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(project.id, project.name, project.description || null, project.color || null, now, now);
    }
    // Reconcile document membership if the caller passed it.
    if (Array.isArray(project.documents)) {
      const ids = project.documents.map((d) => d.id).filter(Boolean);
      reconcileProjectDocs(project.id, ids);
    }
    return projectsRepo.list();
  },
  remove(id) {
    db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    // Conversations whose project is being removed keep their messages,
    // they just become "unassigned" — handled by ON DELETE SET NULL.
  },
};

function reconcileProjectDocs(projectId, docIds) {
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM project_documents WHERE project_id = ?").run(projectId);
    const insert = db.prepare(
      "INSERT OR IGNORE INTO project_documents (project_id, document_id, added_at) VALUES (?, ?, ?)"
    );
    const now = Date.now();
    for (const docId of docIds) insert.run(projectId, docId, now);
  });
  tx();
}

function withProjectDocs(row) {
  const docs = db.prepare(`
    SELECT d.id, d.filename AS name, d.size_bytes AS sizeBytes,
           d.page_count AS pageCount, d.extracted_chars AS extractedChars,
           d.short_summary AS shortSummary, d.index_status AS indexStatus,
           d.created_at AS createdAt
    FROM project_documents pd
    JOIN documents d ON d.id = pd.document_id
    WHERE pd.project_id = ?
    ORDER BY pd.added_at ASC
  `).all(row.id);
  return { ...row, documents: docs };
}

// ──────────────────────────────────────────────────────────────────────
// Repository — conversations + messages
// ──────────────────────────────────────────────────────────────────────

const conversationsRepo = {
  list() {
    const rows = db.prepare(`
      SELECT id, project_id AS projectId, title, mode, model,
             created_at AS createdAt, updated_at AS updatedAt
      FROM conversations
      ORDER BY updated_at DESC
    `).all();
    // Attach a lightweight messages array (just role+content) so the
    // renderer keeps its existing shape. For very long chats this is fine
    // — they're text, not files. Heavy lifting is in document_chunks.
    const stmt = db.prepare(`
      SELECT role, content, id FROM messages
      WHERE conversation_id = ?
      ORDER BY id ASC
    `);
    return rows.map((r) => ({ ...r, messages: stmt.all(r.id) }));
  },
  upsert(conv) {
    const now = Date.now();
    const exists = db.prepare("SELECT 1 FROM conversations WHERE id = ?").get(conv.id);
    const tx = db.transaction(() => {
      if (exists) {
        db.prepare(`
          UPDATE conversations
          SET project_id=?, title=?, mode=?, model=?, updated_at=?
          WHERE id=?
        `).run(conv.projectId || null, conv.title || null, conv.mode || null, conv.model || null, now, conv.id);
      } else {
        db.prepare(`
          INSERT INTO conversations (id, project_id, title, mode, model, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(conv.id, conv.projectId || null, conv.title || null, conv.mode || null, conv.model || null, now, now);
      }
      if (Array.isArray(conv.messages)) {
        // Replace the message list — simplest semantics, matches how the
        // renderer already produces full-message snapshots.
        db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(conv.id);
        const ins = db.prepare(
          "INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)"
        );
        for (const m of conv.messages) {
          ins.run(conv.id, m.role, m.content || "", now);
        }
      }
    });
    tx();
    return true;
  },
  remove(id) {
    db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
  },
  searchMessages(query, limit = 50) {
    if (!query?.trim()) return [];
    // FTS5 sanitize: quote terms to avoid parser surprises with user input.
    const safe = query
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => `"${t.replace(/"/g, '""')}"`)
      .join(" ");
    if (!safe) return [];
    return db.prepare(`
      SELECT m.id, m.conversation_id AS conversationId, m.role,
             snippet(messages_fts, 0, '[', ']', '…', 12) AS excerpt,
             c.title
      FROM messages_fts
      JOIN messages m ON m.id = messages_fts.rowid
      JOIN conversations c ON c.id = m.conversation_id
      WHERE messages_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(safe, limit);
  },
};

// ──────────────────────────────────────────────────────────────────────
// Repository — documents + chunks (metadata; bytes live on disk)
// ──────────────────────────────────────────────────────────────────────

const documentsRepo = {
  getBySha(sha) {
    return db.prepare(`
      SELECT id, sha256, filename, mime, size_bytes AS sizeBytes,
             page_count AS pageCount, parser, parser_version AS parserVersion,
             extracted_chars AS extractedChars, short_summary AS shortSummary,
             structure_json AS structureJson, index_status AS indexStatus,
             indexed_at AS indexedAt, created_at AS createdAt
      FROM documents WHERE sha256 = ?
    `).get(sha);
  },
  get(id) {
    return db.prepare(`
      SELECT id, sha256, filename, mime, size_bytes AS sizeBytes,
             page_count AS pageCount, parser, parser_version AS parserVersion,
             extracted_chars AS extractedChars, short_summary AS shortSummary,
             structure_json AS structureJson, index_status AS indexStatus,
             indexed_at AS indexedAt, created_at AS createdAt
      FROM documents WHERE id = ?
    `).get(id);
  },
  list() {
    return db.prepare(`
      SELECT id, sha256, filename, size_bytes AS sizeBytes,
             page_count AS pageCount, extracted_chars AS extractedChars,
             short_summary AS shortSummary, index_status AS indexStatus,
             indexed_at AS indexedAt, created_at AS createdAt
      FROM documents
      ORDER BY created_at DESC
    `).all();
  },
  insert(doc) {
    const now = Date.now();
    db.prepare(`
      INSERT INTO documents (
        id, sha256, filename, mime, size_bytes, page_count,
        parser, parser_version, extracted_chars, short_summary,
        structure_json, index_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      doc.id, doc.sha256, doc.filename, doc.mime || null,
      doc.sizeBytes, doc.pageCount || null,
      doc.parser || null, doc.parserVersion || null,
      doc.extractedChars || null, doc.shortSummary || null,
      doc.structureJson || null, doc.indexStatus || "pending",
      now,
    );
    return doc.id;
  },
  setIndexed(id, status, indexedAt = Date.now()) {
    db.prepare("UPDATE documents SET index_status = ?, indexed_at = ? WHERE id = ?")
      .run(status, indexedAt, id);
  },
  setSummary(id, summary) {
    db.prepare("UPDATE documents SET short_summary = ? WHERE id = ?").run(summary, id);
  },
  remove(id) {
    const chunkIds = db.prepare("SELECT id FROM document_chunks WHERE document_id = ?").all(id).map((r) => r.id);
    deleteChunkVectors(chunkIds);
    db.prepare("DELETE FROM documents WHERE id = ?").run(id);
  },
  insertChunks(documentId, chunks) {
    const ins = db.prepare(`
      INSERT INTO document_chunks (
        document_id, ordinal, section_path, page_number,
        start_char, end_char, text, token_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = db.transaction(() => {
      const oldChunkIds = db.prepare("SELECT id FROM document_chunks WHERE document_id = ?").all(documentId).map((r) => r.id);
      deleteChunkVectors(oldChunkIds);
      db.prepare("DELETE FROM document_chunks WHERE document_id = ?").run(documentId);
      for (const c of chunks) {
        ins.run(
          documentId, c.ordinal, c.sectionPath || null, c.pageNumber || null,
          c.startChar || null, c.endChar || null, c.text, c.tokenCount || null,
        );
      }
    });
    tx();
  },
  listChunks(documentId) {
    return db.prepare(`
      SELECT id, ordinal, section_path AS sectionPath, page_number AS pageNumber,
             start_char AS startChar, end_char AS endChar, text, token_count AS tokenCount
      FROM document_chunks
      WHERE document_id = ?
      ORDER BY ordinal ASC
    `).all(documentId);
  },
  chunksWithoutEmbedding(model, limit = 100) {
    return db.prepare(`
      SELECT id, document_id AS documentId, text
      FROM document_chunks
      WHERE embedding IS NULL OR embed_model != ?
      LIMIT ?
    `).all(model, limit);
  },
  setChunkEmbedding(chunkId, embedding, model) {
    const json = JSON.stringify(embedding);
    db.prepare("UPDATE document_chunks SET embedding = ?, embed_model = ? WHERE id = ?")
      .run(json, model, chunkId);
    if (sqliteVecAvailable && Array.isArray(embedding) && embedding.length === SQLITE_VEC_DIMENSIONS) {
      try {
        db.prepare("INSERT OR REPLACE INTO chunk_vectors(rowid, embedding) VALUES (?, ?)")
          .run(vectorRowId(chunkId), vectorBlob(embedding));
      } catch {}
    }
  },
};

// ──────────────────────────────────────────────────────────────────────
// Repository — settings (KV)
// ──────────────────────────────────────────────────────────────────────

const settingsRepo = {
  getAll() {
    const rows = db.prepare("SELECT key, value FROM settings").all();
    const out = {};
    for (const r of rows) {
      try { out[r.key] = JSON.parse(r.value); }
      catch { out[r.key] = r.value; }
    }
    return out;
  },
  get(key, fallback = null) {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
    if (!row) return fallback;
    try { return JSON.parse(row.value); } catch { return row.value; }
  },
  set(key, value) {
    db.prepare(
      "INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(key, JSON.stringify(value));
  },
  setMany(obj) {
    const tx = db.transaction(() => {
      for (const [k, v] of Object.entries(obj)) settingsRepo.set(k, v);
    });
    tx();
  },
};

// ──────────────────────────────────────────────────────────────────────
// Retrieval helpers used by the RAG layer. Kept here because they're
// pure SQL and benefit from being close to the schema.
// ──────────────────────────────────────────────────────────────────────

const retrieval = {
  // BM25 ranked chunk ids, scoped to a set of document ids. Returns rows
  // with id, score (lower-is-better in FTS5; we invert before fusion).
  bm25(query, documentIds, limit = 25) {
    if (!query?.trim() || !documentIds?.length) return [];
    const safe = query
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => `"${t.replace(/"/g, '""')}"`)
      .join(" ");
    if (!safe) return [];
    const placeholders = documentIds.map(() => "?").join(",");
    return db.prepare(`
      SELECT c.id, c.document_id AS documentId, c.section_path AS sectionPath,
             c.page_number AS pageNumber, c.text, c.ordinal,
             bm25(chunks_fts) AS score
      FROM chunks_fts
      JOIN document_chunks c ON c.id = chunks_fts.rowid
      WHERE chunks_fts MATCH ?
        AND c.document_id IN (${placeholders})
      ORDER BY score ASC
      LIMIT ?
    `).all(safe, ...documentIds, limit);
  },
  // Vector candidates scoped to a set of documents. Returns chunk rows
  // with their embedding JSON for in-process cosine similarity. We
  // intentionally use SQL only to scope; the actual dot-product happens
  // in JS over a small candidate set.
  vectorCandidates(documentIds, embedModel, limit = 500) {
    if (!documentIds?.length) return [];
    const placeholders = documentIds.map(() => "?").join(",");
    return db.prepare(`
      SELECT id, document_id AS documentId, section_path AS sectionPath,
             page_number AS pageNumber, text, ordinal, embedding
      FROM document_chunks
      WHERE document_id IN (${placeholders})
        AND embedding IS NOT NULL
        AND embed_model = ?
      LIMIT ?
    `).all(...documentIds, embedModel, limit);
  },
  vectorSearch(documentIds, embedModel, queryEmbedding, limit = 25) {
    if (!sqliteVecAvailable || !documentIds?.length || !Array.isArray(queryEmbedding)) return [];
    if (queryEmbedding.length !== SQLITE_VEC_DIMENSIONS) return [];
    const placeholders = documentIds.map(() => "?").join(",");
    try {
      return db.prepare(`
        SELECT c.id, c.document_id AS documentId, c.section_path AS sectionPath,
               c.page_number AS pageNumber, c.text, c.ordinal, v.distance AS score
        FROM chunk_vectors v
        JOIN document_chunks c ON c.id = v.rowid
        WHERE v.embedding MATCH ?
          AND k = ?
          AND c.document_id IN (${placeholders})
          AND c.embed_model = ?
        ORDER BY v.distance ASC
      `).all(vectorBlob(queryEmbedding), limit, ...documentIds, embedModel);
    } catch {
      return [];
    }
  },
  // Project's document ids.
  projectDocumentIds(projectId) {
    if (!projectId) return [];
    return db.prepare(
      "SELECT document_id AS id FROM project_documents WHERE project_id = ?"
    ).all(projectId).map((r) => r.id);
  },
};

module.exports = {
  open,
  close,
  get db() { return db; },
  get path() { return dbPath; },
  projects: projectsRepo,
  conversations: conversationsRepo,
  documents: documentsRepo,
  settings: settingsRepo,
  retrieval,
  vector: {
    available() { return sqliteVecAvailable; },
    dimensions: SQLITE_VEC_DIMENSIONS,
  },
};
