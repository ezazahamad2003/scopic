const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ollama", {
  chat: (messages, options, requestId) => {
    ipcRenderer.send("ollama:chat", { messages, options, requestId });
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
  getSettings: () => ipcRenderer.invoke("store:getSettings"),
  saveSettings: (settings) => ipcRenderer.invoke("store:saveSettings", settings),
});

contextBridge.exposeInMainWorld("windowControls", {
  minimize: () => ipcRenderer.send("window:minimize"),
  maximize: () => ipcRenderer.send("window:maximize"),
  close: () => ipcRenderer.send("window:close"),
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
