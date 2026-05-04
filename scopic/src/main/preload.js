const { contextBridge, ipcRenderer } = require("electron");

// Unified chat API across providers (ollama, anthropic, openai, gemini).
contextBridge.exposeInMainWorld("chat", {
  send: (messages, options, requestId) => {
    ipcRenderer.send("chat:send", { messages, options, requestId });
  },
  abort: (requestId) => {
    ipcRenderer.send("chat:abort", { requestId });
  },
  onToken: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on("chat:token", handler);
    return () => ipcRenderer.removeListener("chat:token", handler);
  },
  onDone: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on("chat:done", handler);
    return () => ipcRenderer.removeListener("chat:done", handler);
  },
  onError: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on("chat:error", handler);
    return () => ipcRenderer.removeListener("chat:error", handler);
  },
});

contextBridge.exposeInMainWorld("providers", {
  ping: (provider) => ipcRenderer.invoke("provider:ping", { provider }),
  listModels: (provider) => ipcRenderer.invoke("provider:listModels", { provider }),
  onStatus: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on("provider:status", handler);
    return () => ipcRenderer.removeListener("provider:status", handler);
  },
});

// Backward-compat: keep the old window.ollama surface so existing renderer
// builds continue to work while we transition.
contextBridge.exposeInMainWorld("ollama", {
  chat: (messages, options, requestId) => {
    ipcRenderer.send("chat:send", {
      messages,
      options: { ...(options || {}), provider: "ollama" },
      requestId,
    });
  },
  checkConnection: () => ipcRenderer.invoke("ollama:check"),
  getModels: () => ipcRenderer.invoke("ollama:tags"),
  onToken: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on("chat:token", handler);
    return () => ipcRenderer.removeListener("chat:token", handler);
  },
  onDone: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on("chat:done", handler);
    return () => ipcRenderer.removeListener("chat:done", handler);
  },
  onError: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on("chat:error", handler);
    return () => ipcRenderer.removeListener("chat:error", handler);
  },
  onStatus: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on("ollama:status", handler);
    return () => ipcRenderer.removeListener("ollama:status", handler);
  },
});

contextBridge.exposeInMainWorld("store", {
  getConversations: () => ipcRenderer.invoke("store:getConversations"),
  saveConversation: (conversation) =>
    ipcRenderer.invoke("store:saveConversation", conversation),
  deleteConversation: (id) => ipcRenderer.invoke("store:deleteConversation", id),
  getProjects: () => ipcRenderer.invoke("store:getProjects"),
  saveProject: (project) => ipcRenderer.invoke("store:saveProject", project),
  deleteProject: (id) => ipcRenderer.invoke("store:deleteProject", id),
  getSettings: () => ipcRenderer.invoke("store:getSettings"),
  saveSettings: (settings) => ipcRenderer.invoke("store:saveSettings", settings),
});

contextBridge.exposeInMainWorld("windowControls", {
  minimize: () => ipcRenderer.send("window:minimize"),
  maximize: () => ipcRenderer.send("window:maximize"),
  close: () => ipcRenderer.send("window:close"),
});

contextBridge.exposeInMainWorld("appInfo", {
  getVersion: () => ipcRenderer.invoke("app:getVersion"),
  isPackaged: () => ipcRenderer.invoke("app:isPackaged"),
});

contextBridge.exposeInMainWorld("fileParser", {
  parse: (buffer, filename) => ipcRenderer.invoke("file:parse", { buffer, filename }),
});

contextBridge.exposeInMainWorld("updater", {
  checkForUpdates: () => ipcRenderer.invoke("updater:check"),
  installUpdate: () => ipcRenderer.send("updater:install"),
  onEvent: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on("updater:event", handler);
    return () => ipcRenderer.removeListener("updater:event", handler);
  },
});
