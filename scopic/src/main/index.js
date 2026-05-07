const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const Store = require("electron-store");
const { dispatchChat, listProviderModels, pingProvider } = require("./providers");
let mammoth = null;
let PDFParse = null;
let ExcelJS = null;
try { mammoth = require("mammoth"); } catch (e) { console.error("mammoth load failed:", e); }
try { ({ PDFParse } = require("pdf-parse")); } catch (e) { console.error("pdf-parse load failed:", e); }
try { ExcelJS = require("exceljs"); } catch (e) { console.error("exceljs load failed:", e); }
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

const store = new Store({
  defaults: {
    conversations: [],
    projects: [],
    settings: {
      provider: "ollama",
      ollamaUrl: "http://localhost:11434",
      model: "phi3",
      temperature: 0.7,
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

// Track in-flight chat requests so the renderer can abort them.
const activeChatAborts = new Map();

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Scopic - Legal AI Assistant",
    backgroundColor: "#0F1117",
    titleBarStyle: "hiddenInset",
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    show: false,
  });

  // Log render-process load failures
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
    logError(
      `Loading: ${indexPath} | __dirname=${__dirname} | appPath=${app.getAppPath()} | resourcesPath=${process.resourcesPath}`
    );
    mainWindow.loadFile(indexPath).catch((err) => {
      logError(`loadFile threw: ${err && err.message}`);
    });
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    checkOllamaOnStart();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

async function checkOllamaOnStart() {
  try {
    const settings = store.get("settings");
    const provider = settings.provider || "ollama";
    const ok = await pingProvider({ provider, settings });
    mainWindow?.webContents.send("provider:status", { provider, connected: ok });
    // Backward compat for any older renderer paths still listening on ollama:status.
    if (provider === "ollama") {
      mainWindow?.webContents.send("ollama:status", { connected: ok });
    }
  } catch {
    mainWindow?.webContents.send("provider:status", { connected: false });
  }
}

// IPC: ping a provider (presence of key for cloud, /api/tags for ollama).
ipcMain.handle("provider:ping", async (_, { provider } = {}) => {
  const settings = store.get("settings");
  const target = provider || settings.provider || "ollama";
  return pingProvider({ provider: target, settings });
});

// IPC: list models for a given provider.
ipcMain.handle("provider:listModels", async (_, { provider } = {}) => {
  const settings = store.get("settings");
  const target = provider || settings.provider || "ollama";
  return listProviderModels({ provider: target, settings });
});

// IPC (legacy): check ollama specifically.
ipcMain.handle("ollama:check", async () => {
  const settings = store.get("settings");
  return pingProvider({ provider: "ollama", settings });
});

// IPC (legacy): list ollama tags.
ipcMain.handle("ollama:tags", async () => {
  const settings = store.get("settings");
  const models = await listProviderModels({ provider: "ollama", settings });
  return { models: models.map((name) => ({ name })) };
});

// IPC: Unified streaming chat across providers.
ipcMain.on("chat:send", async (event, { messages, options, requestId }) => {
  const settings = store.get("settings");
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

  try {
    await dispatchChat({
      provider,
      settings,
      model,
      temperature,
      messages,
      signal: abort.signal,
      onToken: (token) => {
        event.sender.send("chat:token", { requestId, token });
      },
    });
    event.sender.send("chat:done", { requestId });
  } catch (err) {
    if (err?.name === "AbortError") {
      event.sender.send("chat:done", { requestId, aborted: true });
    } else {
      event.sender.send("chat:error", {
        requestId,
        error: err?.message || "Unknown error",
      });
    }
  } finally {
    activeChatAborts.delete(requestId);
  }
});

// Legacy alias so older renderer builds keep working.
ipcMain.on("ollama:chat", (event, payload) => {
  ipcMain.emit("chat:send", event, {
    ...payload,
    options: { ...(payload?.options || {}), provider: "ollama" },
  });
});

// IPC: abort an in-flight chat.
ipcMain.on("chat:abort", (_, { requestId } = {}) => {
  const abort = activeChatAborts.get(requestId);
  if (abort) {
    abort.abort();
    activeChatAborts.delete(requestId);
  }
});

// IPC: Store — conversations
ipcMain.handle("store:getConversations", () => {
  return store.get("conversations", []);
});

ipcMain.handle("store:saveConversation", (_, conversation) => {
  const conversations = store.get("conversations", []);
  const idx = conversations.findIndex((c) => c.id === conversation.id);
  if (idx >= 0) {
    conversations[idx] = conversation;
  } else {
    conversations.unshift(conversation);
  }
  store.set("conversations", conversations);
  return true;
});

ipcMain.handle("store:deleteConversation", (_, conversationId) => {
  const conversations = store.get("conversations", []);
  store.set(
    "conversations",
    conversations.filter((c) => c.id !== conversationId)
  );
  return true;
});

// IPC: Store — projects
ipcMain.handle("store:getProjects", () => {
  return store.get("projects", []);
});

ipcMain.handle("store:saveProject", (_, project) => {
  const projects = store.get("projects", []);
  const idx = projects.findIndex((p) => p.id === project.id);
  if (idx >= 0) {
    projects[idx] = { ...projects[idx], ...project, updatedAt: Date.now() };
  } else {
    projects.unshift({ ...project, createdAt: Date.now(), updatedAt: Date.now() });
  }
  store.set("projects", projects);
  return projects;
});

ipcMain.handle("store:deleteProject", (_, projectId) => {
  const projects = store.get("projects", []);
  store.set("projects", projects.filter((p) => p.id !== projectId));
  // Detach conversations from the deleted project (don't delete them).
  const conversations = store.get("conversations", []);
  store.set(
    "conversations",
    conversations.map((c) =>
      c.projectId === projectId ? { ...c, projectId: null } : c
    )
  );
  return true;
});

// IPC: Store — settings
ipcMain.handle("store:getSettings", () => {
  return store.get("settings");
});

ipcMain.handle("store:saveSettings", (_, settings) => {
  store.set("settings", settings);
  return true;
});

// Auto-updater wiring
function setupAutoUpdater() {
  if (!autoUpdater || isDev) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const send = (event) => {
    mainWindow?.webContents.send("updater:event", event);
  };

  autoUpdater.on("checking-for-update", () => send({ status: "checking" }));
  autoUpdater.on("update-available", (info) =>
    send({ status: "available", version: info?.version })
  );
  autoUpdater.on("update-not-available", () => send({ status: "none" }));
  autoUpdater.on("download-progress", (p) =>
    send({ status: "downloading", progress: p?.percent || 0 })
  );
  autoUpdater.on("update-downloaded", (info) =>
    send({ status: "downloaded", version: info?.version })
  );
  autoUpdater.on("error", (err) => {
    const msg = (err && (err.message || String(err))) || "unknown";
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
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.on("updater:install", () => {
  if (!autoUpdater || isDev) return;
  autoUpdater.quitAndInstall();
});

// IPC: File parsing (PDF, DOCX, CSV/TSV)
ipcMain.handle("file:parse", async (_, { buffer, filename }) => {
  const ext = path.extname(filename).toLowerCase();
  try {
    const buf = Buffer.from(buffer);
    if (ext === ".docx") {
      if (!mammoth) return { text: null, error: "DOCX parser unavailable" };
      const result = await mammoth.extractRawText({ buffer: buf });
      return { text: result.value, error: null };
    }
    if (ext === ".pdf") {
      if (!PDFParse) return { text: null, error: "PDF parser unavailable" };
      const parser = new PDFParse({ data: buf });
      try {
        const result = await parser.getText();
        const text = (result?.pages || [])
          .map((p) => p.text || "")
          .join("\n\n")
          .trim() || result?.text || "";
        return { text, error: null };
      } finally {
        try { await parser.destroy(); } catch {}
      }
    }
    if (ext === ".csv" || ext === ".tsv" || ext === ".txt" || ext === ".md") {
      // Decode as UTF-8 and lightly normalize so the model sees the content cleanly.
      const raw = buf.toString("utf-8");
      // Strip BOM if present.
      const text = raw.replace(/^﻿/, "");
      return { text, error: null };
    }
    if (ext === ".xlsx" || ext === ".xls") {
      if (!ExcelJS) return { text: null, error: "Spreadsheet parser unavailable" };
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buf);
      const parts = [];
      workbook.eachSheet((sheet) => {
        parts.push(`# Sheet: ${sheet.name}`);
        const rows = [];
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
            } else {
              cells.push(String(v));
            }
          });
          rows.push(cells.join("\t"));
        });
        parts.push(rows.join("\n"));
        parts.push("");
      });
      return { text: parts.join("\n").trim(), error: null };
    }
    return { text: null, error: "Unsupported format" };
  } catch (err) {
    logError(`file:parse failed for ${filename}: ${err && err.message}`);
    return { text: null, error: err.message || "Failed to parse file" };
  }
});

// IPC: App info
ipcMain.handle("app:getVersion", () => app.getVersion());
ipcMain.handle("app:isPackaged", () => app.isPackaged);

// Window controls
ipcMain.on("window:minimize", () => mainWindow?.minimize());
ipcMain.on("window:maximize", () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on("window:close", () => mainWindow?.close());

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
