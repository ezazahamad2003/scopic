const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const Store = require("electron-store");
const { dispatchChat, listProviderModels, pingProvider } = require("./providers");
const db = require("./db");
const documents = require("./documents");
const rag = require("./rag");
const { LEGAL_SYSTEM_PROMPT, CONTRACT_REVIEW_SYSTEM_PROMPT } = require("./prompts");

let autoUpdater = null;
try {
  autoUpdater = require("electron-updater").autoUpdater;
} catch {}

const isDev = !app.isPackaged && process.env.NODE_ENV !== "production";

function logError(msg) {
  try {
    const logPath = path.join(app.getPath("userData"), "startup.log");
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
}

function findIndexHtml() {
  const candidates = [
    path.join(app.getAppPath(), "dist-renderer", "index.html"),
    path.join(__dirname, "..", "..", "dist-renderer", "index.html"),
    path.join(process.resourcesPath || "", "dist-renderer", "index.html"),
    path.join(process.resourcesPath || "", "app", "dist-renderer", "index.html"),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        logError(`Found index.html at: ${p}`);
        return p;
      }
    } catch {}
  }
  logError(`No index.html found. Checked: ${JSON.stringify(candidates)}`);
  return candidates[0];
}

// Settings still live in electron-store — they're tiny and convenient.
// All other data has moved to SQLite (see db.js + documents.js).
const settingsStore = new Store({
  name: "settings",
  defaults: {
    settings: {
      provider: "ollama",
      ollamaUrl: "http://localhost:11434",
      model: "phi3",
      temperature: 0.7,
      embeddings: {
        enabled: true,
        provider: "ollama",
        model: rag.DEFAULT_EMBED_MODEL,
      },
      apiKeys: {
        anthropic: "",
        openai: "",
        gemini: "",
      },
      cloudModels: {
        anthropic: "claude-opus-4-7",
        openai: "gpt-4o",
        gemini: "gemini-2.5-pro",
      },
    },
  },
});

const activeChatAborts = new Map();
let mainWindow = null;

function resolveAppIcon() {
  const candidates = [
    path.join(__dirname, "..", "..", "build", "icon.ico"),
    path.join(__dirname, "..", "..", "build", "icon.png"),
    path.join(process.resourcesPath || "", "build", "icon.ico"),
    path.join(process.resourcesPath || "", "build", "icon.png"),
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch {}
  }
  return undefined;
}

function createWindow() {
  const iconPath = resolveAppIcon();
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Scopic - Legal AI Assistant",
    backgroundColor: "#0F1117",
    titleBarStyle: "hiddenInset",
    frame: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    show: false,
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_e, errorCode, errorDescription, validatedURL) => {
      const errMsg = `did-fail-load: ${errorCode} ${errorDescription} url=${validatedURL}`;
      logError(errMsg);
      mainWindow.webContents.executeJavaScript(
        `document.body.innerHTML = ${JSON.stringify(
          `<pre style="color:#fff;background:#0F1117;padding:20px;font-family:monospace;font-size:12px;white-space:pre-wrap;">Scopic failed to load.\n\n${errMsg}\n\nLog file: ${path.join(
            app.getPath("userData"),
            "startup.log"
          )}</pre>`
        )}`
      ).catch(() => {});
    }
  );

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = findIndexHtml();
    logError(`Loading: ${indexPath}`);
    mainWindow.loadFile(indexPath).catch((err) => {
      logError(`loadFile threw: ${err && err.message}`);
    });
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    checkProviderOnStart();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

async function checkProviderOnStart() {
  try {
    const settings = settingsStore.get("settings");
    const provider = settings.provider || "ollama";
    const ok = await pingProvider({ provider, settings });
    mainWindow?.webContents.send("provider:status", { provider, connected: ok });
  } catch {
    mainWindow?.webContents.send("provider:status", { connected: false });
  }
}

// ────────────────────────────────────────────────────────────────
// IPC: providers
// ────────────────────────────────────────────────────────────────

ipcMain.handle("provider:ping", async (_, { provider } = {}) => {
  const settings = settingsStore.get("settings");
  const target = provider || settings.provider || "ollama";
  return pingProvider({ provider: target, settings });
});

ipcMain.handle("provider:listModels", async (_, { provider } = {}) => {
  const settings = settingsStore.get("settings");
  const target = provider || settings.provider || "ollama";
  return listProviderModels({ provider: target, settings });
});

// ────────────────────────────────────────────────────────────────
// IPC: unified chat (now with RAG router).
// ────────────────────────────────────────────────────────────────

ipcMain.on("chat:send", async (event, payload) => {
  const { messages: incomingMessages, options, requestId } = payload || {};
  const settings = settingsStore.get("settings");
  const provider = options?.provider || settings.provider || "ollama";
  const temperature = options?.temperature ?? settings.temperature;
  const model =
    options?.model ||
    (provider === "ollama" ? settings.model : settings.cloudModels?.[provider]);

  if (!model) {
    event.sender.send("chat:error", {
      requestId,
      error: `No model configured for ${provider}. Open Settings and pick one.`,
    });
    return;
  }

  const abort = new AbortController();
  activeChatAborts.set(requestId, abort);

  if (options?.rawMessages) {
    try {
      await dispatchChat({
        provider,
        settings,
        model,
        temperature,
        messages: incomingMessages || [],
        signal: abort.signal,
        onToken: (token) => event.sender.send("chat:token", { requestId, token }),
      });
      event.sender.send("chat:done", { requestId, mode: options?.mode || "raw" });
    } catch (err) {
      if (err?.name === "AbortError") {
        event.sender.send("chat:done", { requestId, aborted: true });
      } else {
        event.sender.send("chat:error", { requestId, error: err?.message || "Unknown error" });
      }
    } finally {
      activeChatAborts.delete(requestId);
    }
    return;
  }

  // Hydrate project (with fresh document membership) from the DB.
  const project = options?.projectId
    ? db.projects.get(options.projectId)
    : null;

  // The renderer sends the full message array INCLUDING the system msg
  // it built locally. Strip system; keep user/assistant history; pop
  // the trailing user message as the prompt for routing.
  const history = (incomingMessages || []).filter((m) => m.role !== "system");
  let userPrompt = "";
  if (history.length && history[history.length - 1].role === "user") {
    userPrompt = history.pop().content || "";
  }

  const basePrompt = options?.mode === "document_review"
    ? CONTRACT_REVIEW_SYSTEM_PROMPT
    : LEGAL_SYSTEM_PROMPT;

  let assembled;
  try {
    assembled = await rag.buildChatPayload({
      basePrompt,
      project,
      history,
      userPrompt,
      chatProvider: provider,
      chatModel: model,
      ollamaUrl: settings.ollamaUrl,
      embedModel: settings.embeddings?.model || rag.DEFAULT_EMBED_MODEL,
    });
  } catch (err) {
    event.sender.send("chat:error", { requestId, error: err.message });
    return;
  }

  if (assembled.citations?.length) {
    event.sender.send("chat:citations", {
      requestId,
      mode: assembled.mode,
      citations: assembled.citations,
    });
  }

  try {
    await dispatchChat({
      provider,
      settings,
      model,
      temperature,
      messages: assembled.messages,
      signal: abort.signal,
      onToken: (token) => event.sender.send("chat:token", { requestId, token }),
    });
    event.sender.send("chat:done", { requestId, mode: assembled.mode });
  } catch (err) {
    if (err?.name === "AbortError") {
      event.sender.send("chat:done", { requestId, aborted: true });
    } else {
      event.sender.send("chat:error", { requestId, error: err?.message || "Unknown error" });
    }
  } finally {
    activeChatAborts.delete(requestId);
  }
});

ipcMain.on("chat:abort", (_, { requestId } = {}) => {
  const abort = activeChatAborts.get(requestId);
  if (abort) { abort.abort(); activeChatAborts.delete(requestId); }
});

// ────────────────────────────────────────────────────────────────
// IPC: store — backed by SQLite now.
// ────────────────────────────────────────────────────────────────

ipcMain.handle("store:getConversations", () => db.conversations.list());
ipcMain.handle("store:saveConversation",  (_, conv) => db.conversations.upsert(conv));
ipcMain.handle("store:deleteConversation",(_, id)   => db.conversations.remove(id));

ipcMain.handle("store:getProjects",  () => db.projects.list());
ipcMain.handle("store:saveProject",  (_, project) => db.projects.upsert(project));
ipcMain.handle("store:deleteProject",(_, id)      => db.projects.remove(id));

ipcMain.handle("store:getSettings", () => settingsStore.get("settings"));
ipcMain.handle("store:saveSettings",(_, s) => { settingsStore.set("settings", s); return true; });

ipcMain.handle("search:messages", (_, { query, limit } = {}) =>
  db.conversations.searchMessages(query, limit)
);

// ────────────────────────────────────────────────────────────────
// IPC: documents.
// ────────────────────────────────────────────────────────────────

ipcMain.handle("documents:ingest", async (_, { buffer, filename, mime }) => {
  try {
    const buf = Buffer.from(buffer);
    const doc = await documents.ingest(buf, filename, mime);
    triggerEmbeddingPass();
    return { ok: true, document: doc };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("documents:list", () => db.documents.list());
ipcMain.handle("documents:get",  (_, id) => db.documents.get(id));
ipcMain.handle("documents:remove",(_, id) => {
  db.documents.remove(id);
  documents.gc();
  return true;
});

// Legacy single-shot parse for inline (un-pinned) attachments.
ipcMain.handle("file:parse", async (_, { buffer, filename }) => {
  try {
    const buf = Buffer.from(buffer);
    const parsed = await documents.parse(buf, filename);
    return { text: parsed.text, error: null };
  } catch (err) {
    return { text: null, error: err.message };
  }
});

// ────────────────────────────────────────────────────────────────
// IPC: RAG / Deep Review.
// ────────────────────────────────────────────────────────────────

ipcMain.handle("rag:retrieve", async (_, { query, projectId }) => {
  const settings = settingsStore.get("settings");
  return rag.hybridRetrieve(query, projectId, {
    ollamaUrl: settings.ollamaUrl,
    embedModel: settings.embeddings?.model || rag.DEFAULT_EMBED_MODEL,
  });
});

ipcMain.handle("rag:embedStatus", () => {
  const settings = settingsStore.get("settings");
  const model = settings.embeddings?.model || rag.DEFAULT_EMBED_MODEL;
  const pending = db.documents.chunksWithoutEmbedding(model, 1).length;
  return { model, pendingChunks: pending, enabled: !!settings.embeddings?.enabled };
});

ipcMain.handle("rag:embedRun", async () => {
  const settings = settingsStore.get("settings");
  if (!settings.embeddings?.enabled) return { ok: false, skipped: true };
  await rag.embedPendingChunks({
    ollamaUrl: settings.ollamaUrl,
    model: settings.embeddings?.model || rag.DEFAULT_EMBED_MODEL,
    onProgress: (p) => mainWindow?.webContents.send("rag:embedProgress", p),
  });
  return { ok: true };
});

ipcMain.on("rag:deepReview", async (event, { documentId, question, requestId, options }) => {
  const settings = settingsStore.get("settings");
  const provider = options?.provider || settings.provider || "ollama";
  const model = options?.model
    || (provider === "ollama" ? settings.model : settings.cloudModels?.[provider]);
  const abort = new AbortController();
  activeChatAborts.set(requestId, abort);

  try {
    const dispatchLLM = async ({ prompt }) => {
      const messages = [
        { role: "system", content: "You are a precise legal document navigator. Reply tersely." },
        { role: "user", content: prompt },
      ];
      let buffer = "";
      await dispatchChat({
        provider, settings, model, temperature: 0.1, messages,
        signal: abort.signal,
        onToken: (t) => { buffer += t; },
      });
      return buffer;
    };

    event.sender.send("rag:deepReviewProgress", { requestId, status: "picking sections" });
    const { sectionsRead, findings } = await rag.deepReview({
      documentId, question, dispatchLLM, signal: abort.signal,
      onProgress: (p) => event.sender.send("rag:deepReviewProgress", { requestId, ...p }),
    });

    event.sender.send("chat:citations", {
      requestId,
      mode: "deep-review",
      citations: findings.map((f) => ({
        citationIndex: f.citationIndex,
        documentId: f.documentId,
        sectionPath: f.sectionPath,
        pageNumber: f.pageNumber,
      })),
    });

    const doc = db.documents.get(documentId);
    const messages = [
      {
        role: "system",
        content: rag.buildSystemPrompt({
          basePrompt: LEGAL_SYSTEM_PROMPT,
          project: {
            name: doc?.filename || "document",
            documents: [],
            description: "Deep review mode — single document analysis.",
          },
          excerpts: findings,
        }),
      },
      {
        role: "user",
        content: question + "\n\nProduce a thorough, structured answer with [n] citations for every claim.",
      },
    ];

    await dispatchChat({
      provider, settings, model, temperature: 0.2, messages,
      signal: abort.signal,
      onToken: (t) => event.sender.send("chat:token", { requestId, token: t }),
    });
    event.sender.send("chat:done", { requestId, mode: "deep-review", sectionsRead });
  } catch (err) {
    if (err?.name === "AbortError") {
      event.sender.send("chat:done", { requestId, aborted: true });
    } else {
      event.sender.send("chat:error", { requestId, error: err?.message || "Unknown error" });
    }
  } finally {
    activeChatAborts.delete(requestId);
  }
});

// ────────────────────────────────────────────────────────────────
// Background embedding queue — fires after each ingest.
// ────────────────────────────────────────────────────────────────

let embedRunning = false;
async function triggerEmbeddingPass() {
  if (embedRunning) return;
  const settings = settingsStore.get("settings");
  if (!settings.embeddings?.enabled) return;
  embedRunning = true;
  try {
    await rag.embedPendingChunks({
      ollamaUrl: settings.ollamaUrl,
      model: settings.embeddings?.model || rag.DEFAULT_EMBED_MODEL,
      onProgress: (p) => mainWindow?.webContents.send("rag:embedProgress", p),
    });
  } catch (err) {
    logError(`embedding pass failed: ${err.message}`);
  } finally {
    embedRunning = false;
  }
}

// ────────────────────────────────────────────────────────────────
// Auto-updater — unchanged.
// ────────────────────────────────────────────────────────────────

function setupAutoUpdater() {
  if (!autoUpdater || isDev) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  const send = (e) => mainWindow?.webContents.send("updater:event", e);
  autoUpdater.on("checking-for-update", () => send({ status: "checking" }));
  autoUpdater.on("update-available",    (i) => send({ status: "available", version: i?.version }));
  autoUpdater.on("update-not-available",() => send({ status: "none" }));
  autoUpdater.on("download-progress",   (p) => send({ status: "downloading", progress: p?.percent || 0 }));
  autoUpdater.on("update-downloaded",   (i) => send({ status: "downloaded", version: i?.version }));
  autoUpdater.on("error", (e) => {
    const msg = (e && (e.message || String(e))) || "unknown";
    logError(`autoUpdater error: ${msg}`);
    send({ status: "error", error: msg });
  });
}

ipcMain.handle("updater:check", async () => {
  if (!autoUpdater) return { skipped: true, reason: "updater not available" };
  if (isDev) return { skipped: true, reason: "dev mode" };
  try {
    const result = await autoUpdater.checkForUpdates();
    return {
      ok: true,
      currentVersion: app.getVersion(),
      updateInfo: result?.updateInfo
        ? { version: result.updateInfo.version, releaseDate: result.updateInfo.releaseDate }
        : null,
    };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.on("updater:install", () => {
  if (!autoUpdater || isDev) return;
  autoUpdater.quitAndInstall();
});

ipcMain.handle("app:getVersion", () => app.getVersion());
ipcMain.handle("app:isPackaged", () => app.isPackaged);

ipcMain.on("window:minimize", () => mainWindow?.minimize());
ipcMain.on("window:maximize", () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on("window:close", () => mainWindow?.close());

app.whenReady().then(() => {
  const userDataDir = app.getPath("userData");
  try {
    db.open(userDataDir);
    documents.init(userDataDir);
    documents.gc();
  } catch (err) {
    logError(`DB open failed: ${err.message}`);
  }

  createWindow();
  setupAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  db.close();
  if (process.platform !== "darwin") app.quit();
});
