import { useState, useEffect, useRef, useCallback } from "react";
import {
  getConversations,
  saveConversation,
  deleteConversation as deleteConv,
  generateId,
  formatConversationTitle,
} from "../utils/storage.js";
import {
  LEGAL_SYSTEM_PROMPT,
  CONTRACT_REVIEW_SYSTEM_PROMPT,
  DEFAULT_SETTINGS,
} from "../utils/constants.js";

// Hard cap on total project-document text injected into the system prompt.
// Keeps us under cloud-provider context limits even with long docs pinned.
const MAX_TOTAL_DOC_CHARS = 30000;

function getSystemPrompt(mode, project) {
  const base = mode === "document_review" ? CONTRACT_REVIEW_SYSTEM_PROMPT : LEGAL_SYSTEM_PROMPT;
  if (!project) return base;

  const hasDescription = Boolean(project.description?.trim());
  const docs = (project.documents || []).filter((d) => d.text && !d.error);
  if (!hasDescription && docs.length === 0) return base;

  const parts = [];
  parts.push(`## ACTIVE PROJECT: ${project.name}`);
  if (hasDescription) {
    parts.push("");
    parts.push("### Context");
    parts.push(project.description.trim());
  }
  if (docs.length > 0) {
    parts.push("");
    parts.push("### Pinned Documents");
    let used = 0;
    for (const doc of docs) {
      const remaining = MAX_TOTAL_DOC_CHARS - used;
      if (remaining <= 200) break;
      const text = doc.text.length > remaining
        ? doc.text.slice(0, remaining) + "\n\n[…truncated…]"
        : doc.text;
      parts.push("");
      parts.push(`#### ${doc.name}`);
      parts.push(text);
      used += text.length;
    }
  }
  parts.push("");
  parts.push("Keep the above project context in mind for all responses.");
  parts.push("");
  parts.push("---");
  parts.push("");
  return `${parts.join("\n")}${base}`;
}

export function useChat(activeConversationId, setActiveConversationId, settings, activeMode, activeProject, activeProjectId) {
  const [conversations, setConversations] = useState([]);
  const [currentMessages, setCurrentMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const streamingMessageRef = useRef("");
  const activeIdRef = useRef(activeConversationId);
  const activeModeRef = useRef(activeMode);
  const activeProjectIdRef = useRef(activeProjectId);
  const currentMessagesRef = useRef([]);
  const activeProjectRef = useRef(activeProject);
  const requestIdRef = useRef(null);

  useEffect(() => {
    activeIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    activeModeRef.current = activeMode;
  }, [activeMode]);

  useEffect(() => {
    activeProjectIdRef.current = activeProjectId;
  }, [activeProjectId]);

  useEffect(() => {
    currentMessagesRef.current = currentMessages;
  }, [currentMessages]);

  useEffect(() => {
    activeProjectRef.current = activeProject;
  }, [activeProject]);

  useEffect(() => {
    loadConversations();
  }, []);

  // Wire up streaming listeners once.
  useEffect(() => {
    if (!window.chat) return;

    const offToken = window.chat.onToken(({ requestId, token }) => {
      if (requestId !== requestIdRef.current) return;
      streamingMessageRef.current += token;
      const snapshot = streamingMessageRef.current;
      setCurrentMessages((prev) => {
        const updated = [...prev];
        const last = updated.length - 1;
        if (updated[last]?.role === "assistant") {
          updated[last] = { ...updated[last], content: snapshot };
        }
        return updated;
      });
    });

    const offDone = window.chat.onDone(({ requestId }) => {
      if (requestId !== requestIdRef.current) return;
      finalizeStream();
    });

    const offError = window.chat.onError(({ requestId, error }) => {
      if (requestId !== requestIdRef.current) return;
      setCurrentMessages((prev) => {
        const updated = [...prev];
        const last = updated.length - 1;
        if (updated[last]?.role === "assistant") {
          updated[last] = {
            ...updated[last],
            content: `Error: ${error}`,
            isError: true,
          };
        }
        return updated;
      });
      setIsStreaming(false);
      requestIdRef.current = null;
    });

    return () => {
      offToken?.();
      offDone?.();
      offError?.();
    };
  }, []);

  const loadConversations = async () => {
    const convs = await getConversations();
    setConversations(convs);
  };

  const loadConversation = useCallback((id) => {
    setConversations((prev) => {
      const conv = prev.find((c) => c.id === id);
      if (conv) setCurrentMessages(conv.messages || []);
      return prev;
    });
  }, []);

  const createNewConversation = useCallback(() => {
    const id = generateId();
    setCurrentMessages([]);
    currentMessagesRef.current = [];
    activeIdRef.current = id;
    streamingMessageRef.current = "";
    return id;
  }, []);

  const finalizeStream = useCallback(() => {
    setCurrentMessages((prev) => {
      const convId = activeIdRef.current;
      if (convId) {
        const title = formatConversationTitle(prev);
        saveConversation({
          id: convId,
          title,
          messages: prev,
          updatedAt: Date.now(),
          mode: activeModeRef.current,
          projectId: activeProjectIdRef.current || null,
        }).then(() => loadConversations());
      }
      return prev;
    });
    setIsStreaming(false);
    requestIdRef.current = null;
  }, []);

  const sendMessage = useCallback(
    async (content) => {
      if (!content.trim() || isStreaming) return;
      if (!window.chat) return;

      // Always read the latest conversation/messages from refs so that
      // callers who just created a new chat (e.g. workflow launchers using
      // setTimeout) don't accidentally append to a stale closure's state.
      let convId = activeIdRef.current;
      if (!convId) {
        convId = generateId();
        setActiveConversationId(convId);
        activeIdRef.current = convId;
      }

      const userMessage = { role: "user", content: content.trim() };
      const assistantPlaceholder = { role: "assistant", content: "" };
      const baseMessages = currentMessagesRef.current || [];
      const newMessages = [...baseMessages, userMessage, assistantPlaceholder];

      setCurrentMessages(newMessages);
      currentMessagesRef.current = newMessages;
      streamingMessageRef.current = "";
      setIsStreaming(true);

      const provider = settings?.provider || DEFAULT_SETTINGS.provider;
      const temperature = DEFAULT_SETTINGS.temperature;
      const model =
        provider === "ollama"
          ? settings?.model || DEFAULT_SETTINGS.model
          : settings?.cloudModels?.[provider] || DEFAULT_SETTINGS.cloudModels[provider];

      const systemPrompt = getSystemPrompt(activeModeRef.current, activeProjectRef.current);
      const messagesToSend = [
        { role: "system", content: systemPrompt },
        ...newMessages.slice(0, -1),
      ];

      const requestId = generateId();
      requestIdRef.current = requestId;

      window.chat.send(
        messagesToSend,
        { provider, model, temperature },
        requestId
      );
    },
    [isStreaming, settings, setActiveConversationId]
  );

  const moveConversation = useCallback(async (conversationId, projectId) => {
    setConversations((prev) => {
      const conv = prev.find((c) => c.id === conversationId);
      if (!conv) return prev;
      const updated = { ...conv, projectId: projectId || null, updatedAt: Date.now() };
      saveConversation(updated).then(() => loadConversations());
      return prev.map((c) => (c.id === conversationId ? updated : c));
    });
  }, []);

  const stopStreaming = useCallback(() => {
    const requestId = requestIdRef.current;
    if (requestId && window.chat) {
      window.chat.abort(requestId);
    }
    requestIdRef.current = null;
    setIsStreaming(false);
  }, []);

  const deleteConversation = useCallback(async (id) => {
    await deleteConv(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeIdRef.current === id) setCurrentMessages([]);
  }, []);

  return {
    conversations,
    currentMessages,
    isStreaming,
    sendMessage,
    stopStreaming,
    createNewConversation,
    loadConversation,
    deleteConversation,
    moveConversation,
  };
}
