const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const Store = require("electron-store");
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
    settings: {
      ollamaUrl: "http://localhost:11434",
      model: "phi3",
      temperature: 0.7,
    },
  },
});

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
    const response = await fetch(`${settings.ollamaUrl}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      mainWindow?.webContents.send("ollama:status", { connected: true });
    } else {
      mainWindow?.webContents.send("ollama:status", { connected: false });
    }
  } catch {
    mainWindow?.webContents.send("ollama:status", { connected: false });
  }
}

// IPC: Check if Ollama is running
ipcMain.handle("ollama:check", async () => {
  try {
    const settings = store.get("settings");
    const response = await fetch(`${settings.ollamaUrl}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
});

// IPC: Get available models
ipcMain.handle("ollama:tags", async () => {
  try {
    const settings = store.get("settings");
    const response = await fetch(`${settings.ollamaUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { models: [] };
    const data = await response.json();
    return data;
  } catch {
    return { models: [] };
  }
});

// IPC: Streaming chat
ipcMain.on("ollama:chat", async (event, { messages, options, requestId }) => {
  try {
    const settings = store.get("settings");
    const model = options?.model || settings.model;
    const temperature = options?.temperature ?? settings.temperature;

    const response = await fetch(`${settings.ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options: { temperature },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      event.sender.send("chat:error", { requestId, error: errText });
      return;
    }

    const reader = response.body;
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    for await (const chunk of reader) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.message?.content) {
            event.sender.send("chat:token", {
              requestId,
              token: parsed.message.content,
            });
          }
          if (parsed.done) {
            event.sender.send("chat:done", { requestId });
            return;
          }
        } catch {
          // skip malformed JSON lines
        }
      }
    }

    event.sender.send("chat:done", { requestId });
  } catch (err) {
    event.sender.send("chat:error", {
      requestId,
      error: err.message || "Unknown error",
    });
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
    logError(`autoUpdater error: ${err && err.message}`);
    send({ status: "error" });
  });
}

ipcMain.handle("updater:check", async () => {
  if (!autoUpdater || isDev) return { skipped: true };
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.on("updater:install", () => {
  if (!autoUpdater || isDev) return;
  autoUpdater.quitAndInstall();
});

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
