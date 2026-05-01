import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar.jsx";
import ChatArea from "./components/ChatArea.jsx";
import SettingsModal from "./components/SettingsModal.jsx";
import DocumentVaultModal from "./components/DocumentVaultModal.jsx";
import UpdateBanner from "./components/UpdateBanner.jsx";
import { useOllama } from "./hooks/useOllama.js";
import { useChat } from "./hooks/useChat.js";

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeMode, setActiveMode] = useState("general");
  const [updateState, setUpdateState] = useState({ status: "none", version: null, progress: 0 });

  const { connected, models, settings, saveSettings, recheckConnection } = useOllama();
  const {
    conversations,
    currentMessages,
    isStreaming,
    sendMessage,
    stopStreaming,
    createNewConversation,
    loadConversation,
    deleteConversation,
  } = useChat(activeConversationId, setActiveConversationId, settings, activeMode);

  // Auto-update events from main process
  useEffect(() => {
    if (!window.updater) return;
    const off = window.updater.onEvent((evt) => {
      setUpdateState((prev) => ({ ...prev, ...evt }));
    });
    window.updater.checkForUpdates?.();
    return off;
  }, []);

  const handleSelectConversation = (id) => {
    setActiveConversationId(id);
    loadConversation(id);
  };

  const handleNewConversation = () => {
    setActiveMode("general");
    const id = createNewConversation();
    setActiveConversationId(id);
  };

  const handleDeleteConversation = (id) => {
    deleteConversation(id);
    if (activeConversationId === id) {
      setActiveConversationId(null);
    }
  };

  const handleSetMode = (mode) => {
    setActiveMode(mode);
    if (mode !== "general") {
      const id = createNewConversation();
      setActiveConversationId(id);
    }
  };

  const handleVaultSubmit = (message) => {
    setVaultOpen(false);
    setActiveMode("general");
    const id = createNewConversation();
    setActiveConversationId(id);
    setTimeout(() => sendMessage(message), 50);
  };

  return (
    <div
      className="flex h-screen w-screen overflow-hidden select-none"
      style={{ background: "#0D1117" }}
    >
      {/* Custom Titlebar */}
      <div
        className="titlebar-drag fixed top-0 left-0 right-0 h-8 z-50 flex items-center justify-end"
        style={{ background: "#0D1117" }}
      >
        <div className="titlebar-no-drag flex items-center h-full">
          <button
            onClick={() => window.windowControls?.minimize()}
            className="w-12 h-8 flex items-center justify-center text-gray-500 hover:bg-[#1E2535] hover:text-white transition-colors text-sm"
          >
            &#8722;
          </button>
          <button
            onClick={() => window.windowControls?.maximize()}
            className="w-12 h-8 flex items-center justify-center text-gray-500 hover:bg-[#1E2535] hover:text-white transition-colors text-xs"
          >
            &#9633;
          </button>
          <button
            onClick={() => window.windowControls?.close()}
            className="w-12 h-8 flex items-center justify-center text-gray-500 hover:bg-red-600 hover:text-white transition-colors text-sm"
          >
            &#10005;
          </button>
        </div>
      </div>

      {/* Main layout below titlebar */}
      <div className="flex w-full mt-8" style={{ height: "calc(100vh - 2rem)" }}>
        <Sidebar
          conversations={conversations}
          activeId={activeConversationId}
          connected={connected}
          settings={settings}
          activeMode={activeMode}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onDeleteConversation={handleDeleteConversation}
          onOpenSettings={() => setSettingsOpen(true)}
          onSetMode={handleSetMode}
          onOpenDocumentVault={() => setVaultOpen(true)}
        />
        <ChatArea
          messages={currentMessages}
          isStreaming={isStreaming}
          connected={connected}
          onSend={sendMessage}
          onStop={stopStreaming}
          conversationId={activeConversationId}
          activeMode={activeMode}
          onSetMode={handleSetMode}
        />
      </div>

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          models={models}
          updateState={updateState}
          onInstallUpdate={() => window.updater?.installUpdate()}
          onSave={(s) => {
            saveSettings(s);
            setSettingsOpen(false);
            recheckConnection();
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {vaultOpen && (
        <DocumentVaultModal
          onClose={() => setVaultOpen(false)}
          onSubmit={handleVaultSubmit}
        />
      )}

      <UpdateBanner
        status={updateState.status}
        version={updateState.version}
        progress={updateState.progress}
        onInstall={() => window.updater?.installUpdate()}
      />
    </div>
  );
}
