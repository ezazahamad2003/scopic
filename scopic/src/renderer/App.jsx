import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "./components/Sidebar.jsx";
import ChatArea from "./components/ChatArea.jsx";
import ProjectsView from "./components/ProjectsView.jsx";
import WorkflowsView from "./components/WorkflowsView.jsx";
import TabularReviewView from "./components/TabularReviewView.jsx";
import SettingsModal from "./components/SettingsModal.jsx";
import DocumentVaultModal from "./components/DocumentVaultModal.jsx";
import ProjectModal from "./components/ProjectModal.jsx";
import WorkflowRunner from "./components/WorkflowRunner.jsx";
import UpdateBanner from "./components/UpdateBanner.jsx";
import { useOllama } from "./hooks/useOllama.js";
import { useChat } from "./hooks/useChat.js";
import { useProjects } from "./hooks/useProjects.js";
import { saveConversation, generateId } from "./utils/storage.js";

export default function App() {
  const [activeView, setActiveView] = useState("assistant");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [projectModalState, setProjectModalState] = useState({ open: false, project: null });
  const [activePipeline, setActivePipeline] = useState(null);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeMode, setActiveMode] = useState("general");
  const [updateState, setUpdateState] = useState({ status: "none", version: null, progress: 0 });
  const [pendingPrompt, setPendingPrompt] = useState(null);
  const [pendingDraft, setPendingDraft] = useState(null);

  const { connected, models, settings, saveSettings, recheckConnection } = useOllama();
  const { projects, upsertProject, deleteProject } = useProjects();

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  const {
    conversations,
    currentMessages,
    isStreaming,
    sendMessage,
    stopStreaming,
    createNewConversation,
    loadConversation,
    deleteConversation,
    moveConversation,
  } = useChat(activeConversationId, setActiveConversationId, settings, activeMode, activeProject, activeProjectId);

  // Auto-update events from main process
  useEffect(() => {
    if (!window.updater) return;
    const off = window.updater.onEvent((evt) => {
      setUpdateState((prev) => ({ ...prev, ...evt }));
    });
    window.updater.checkForUpdates?.();
    return off;
  }, []);

  // When a workflow is picked from the Workflows view, hand the prompt off
  // to a fresh Assistant chat. We use a one-shot pendingPrompt so the
  // ChatArea picks it up after the view switches.
  useEffect(() => {
    if (activeView !== "assistant" || !pendingPrompt) return;
    const id = createNewConversation();
    setActiveConversationId(id);
    const text = pendingPrompt;
    setPendingPrompt(null);
    setTimeout(() => sendMessage(text), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, pendingPrompt]);

  const handleSelectConversation = (id) => {
    setActiveView("assistant");
    setActiveConversationId(id);
    loadConversation(id);
    const conv = conversations.find((c) => c.id === id);
    if (conv?.projectId !== undefined) {
      setActiveProjectId(conv.projectId || null);
    }
  };

  const handleNewConversation = () => {
    setActiveView("assistant");
    setActiveMode("general");
    const id = createNewConversation();
    setActiveConversationId(id);
  };

  const handleDeleteConversation = (id) => {
    deleteConversation(id);
    if (activeConversationId === id) setActiveConversationId(null);
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
    setActiveView("assistant");
    setActiveMode("general");
    const id = createNewConversation();
    setActiveConversationId(id);
    setTimeout(() => sendMessage(message), 50);
  };

  const handleNewProject = () => setProjectModalState({ open: true, project: null });
  const handleEditProject = (project) => setProjectModalState({ open: true, project });

  const handleSaveProject = async (project) => {
    await upsertProject(project);
    setProjectModalState({ open: false, project: null });
  };

  const handleDeleteProject = async (id) => {
    await deleteProject(id);
    setProjectModalState({ open: false, project: null });
    if (activeProjectId === id) setActiveProjectId(null);
  };

  // Open a project: switch to Assistant view, scope to that project, start fresh chat.
  const handleOpenProject = (id) => {
    setActiveProjectId(id);
    setActiveView("assistant");
    setActiveMode("general");
    const newId = createNewConversation();
    setActiveConversationId(newId);
  };

  const handleRunPipeline = (pipeline) => setActivePipeline(pipeline);

  const handleSavePipelineAsConversation = async ({ title, messages }) => {
    const id = generateId();
    await saveConversation({
      id,
      title,
      messages,
      updatedAt: Date.now(),
      mode: "general",
      projectId: activeProjectId || null,
    });
    setActivePipeline(null);
    setActiveView("assistant");
    setActiveMode("general");
    setActiveConversationId(id);
    loadConversation(id);
  };

  // Single-prompt workflow → Assistant view with the prompt dropped into
  // the input as a draft (so the user can fill in placeholders like
  // "[describe the situation]" before sending). Always opens a fresh chat.
  const handlePickWorkflow = (workflow) => {
    setActiveView("assistant");
    setActiveMode("general");
    const id = createNewConversation();
    setActiveConversationId(id);
    setPendingDraft(workflow.prompt);
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
          projects={projects}
          activeId={activeConversationId}
          activeProjectId={activeProjectId}
          activeView={activeView}
          connected={connected}
          settings={settings}
          onChangeView={setActiveView}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onDeleteConversation={handleDeleteConversation}
          onMoveConversation={moveConversation}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        {activeView === "assistant" && (
          <ChatArea
            messages={currentMessages}
            isStreaming={isStreaming}
            connected={connected}
            onSend={sendMessage}
            onStop={stopStreaming}
            conversationId={activeConversationId}
            activeMode={activeMode}
            onSetMode={handleSetMode}
            provider={settings?.provider || "ollama"}
            activeProject={activeProject}
            onClearProject={() => setActiveProjectId(null)}
            onRunPipeline={handleRunPipeline}
            onPickWorkflow={handlePickWorkflow}
            draft={pendingDraft}
            onDraftConsumed={() => setPendingDraft(null)}
          />
        )}

        {activeView === "projects" && (
          <ProjectsView
            projects={projects}
            conversations={conversations}
            onOpenProject={handleOpenProject}
            onNewProject={handleNewProject}
            onEditProject={handleEditProject}
          />
        )}

        {activeView === "workflows" && (
          <WorkflowsView
            onPickWorkflow={handlePickWorkflow}
            onRunPipeline={handleRunPipeline}
          />
        )}

        {activeView === "tabular" && (
          <TabularReviewView settings={settings} />
        )}
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

      {projectModalState.open && (
        <ProjectModal
          project={projectModalState.project}
          onSave={handleSaveProject}
          onDelete={handleDeleteProject}
          onClose={() => setProjectModalState({ open: false, project: null })}
        />
      )}

      {activePipeline && (
        <WorkflowRunner
          pipeline={activePipeline}
          settings={settings}
          onClose={() => setActivePipeline(null)}
          onSaveAsConversation={handleSavePipelineAsConversation}
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
