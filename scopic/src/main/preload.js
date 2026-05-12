const { contextBridge, ipcRenderer } = require("electron");

// ───── Chat (LLM streaming) ─────
contextBridge.exposeInMainWorld("chat", {
  send: (messages, options, requestId) => {
    ipcRenderer.send("chat:send", { messages, options, requestId });
  },
  abort: (requestId) => ipcRenderer.send("chat:abort", { requestId }),
  onToken: (cb) => sub("chat:token", cb),
  onDone:  (cb) => sub("chat:done", cb),
  onError: (cb) => sub("chat:error", cb),
  onCitations: (cb) => sub("chat:citations", cb),
});

// ───── Provider availability ─────
contextBridge.exposeInMainWorld("providers", {
  ping: (provider) => ipcRenderer.invoke("provider:ping", { provider }),
  listModels: (provider) => ipcRenderer.invoke("provider:listModels", { provider }),
  onStatus: (cb) => sub("provider:status", cb),
});

// ───── Back-compat for old Ollama surface ─────
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
  onToken: (cb) => sub("chat:token", cb),
  onDone:  (cb) => sub("chat:done", cb),
  onError: (cb) => sub("chat:error", cb),
  onStatus:(cb) => sub("ollama:status", cb),
});

// ───── Structured store (SQLite-backed) ─────
contextBridge.exposeInMainWorld("store", {
  getConversations: () => ipcRenderer.invoke("store:getConversations"),
  saveConversation: (c) => ipcRenderer.invoke("store:saveConversation", c),
  deleteConversation: (id) => ipcRenderer.invoke("store:deleteConversation", id),
  getProjects: () => ipcRenderer.invoke("store:getProjects"),
  saveProject: (p) => ipcRenderer.invoke("store:saveProject", p),
  deleteProject: (id) => ipcRenderer.invoke("store:deleteProject", id),
  getSettings: () => ipcRenderer.invoke("store:getSettings"),
  saveSettings: (s) => ipcRenderer.invoke("store:saveSettings", s),
  searchMessages: (query, limit) =>
    ipcRenderer.invoke("search:messages", { query, limit }),
});

// ───── Documents — content-addressed local store ─────
contextBridge.exposeInMainWorld("documents", {
  ingest: (buffer, filename, mime) =>
    ipcRenderer.invoke("documents:ingest", { buffer, filename, mime }),
  list: () => ipcRenderer.invoke("documents:list"),
  get:  (id) => ipcRenderer.invoke("documents:get", id),
  remove: (id) => ipcRenderer.invoke("documents:remove", id),
});

// ───── RAG: hybrid retrieve, embedding status, deep review ─────
contextBridge.exposeInMainWorld("rag", {
  retrieve: (query, projectId) =>
    ipcRenderer.invoke("rag:retrieve", { query, projectId }),
  embedStatus: () => ipcRenderer.invoke("rag:embedStatus"),
  embedRun: () => ipcRenderer.invoke("rag:embedRun"),
  onEmbedProgress: (cb) => sub("rag:embedProgress", cb),
  deepReview: (documentId, question, requestId, options) =>
    ipcRenderer.send("rag:deepReview", { documentId, question, requestId, options }),
  onDeepReviewProgress: (cb) => sub("rag:deepReviewProgress", cb),
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
  parse: (buffer, filename) =>
    ipcRenderer.invoke("file:parse", { buffer, filename }),
});

contextBridge.exposeInMainWorld("updater", {
  checkForUpdates: () => ipcRenderer.invoke("updater:check"),
  installUpdate: () => ipcRenderer.send("updater:install"),
  onEvent: (cb) => sub("updater:event", cb),
});

function sub(channel, cb) {
  const handler = (_, data) => cb(data);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}
