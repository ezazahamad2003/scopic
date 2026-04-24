const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const Store = require("electron-store");

const isDev = process.env.NODE_ENV !== "production";

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
    },
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../dist-renderer/index.html"));
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

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
