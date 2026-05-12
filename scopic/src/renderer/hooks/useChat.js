import { useState, useEffect, useRef, useCallback } from "react";
import {
  getConversations,
  saveConversation,
  deleteConversation as deleteConv,
  generateId,
  formatConversationTitle,
} from "../utils/storage.js";
import { DEFAULT_SETTINGS } from "../utils/constants.js";

// The renderer no longer builds the system prompt — main owns retrieval,
// system prompt composition, and citations. We just hand main the chat
// history + the active project id and let it route.
export function useChat(activeConversationId, setActiveConversationId, settings, activeMode, activeProject, activeProjectId) {
  const [conversations, setConversations] = useState([]);
  const [currentMessages, setCurrentMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const streamingMessageRef = useRef("");
  const activeIdRef = useRef(activeConversationId);
  const activeModeRef = useRef(activeMode);
  const activeProjectIdRef = useRef(activeProjectId);
  const currentMessagesRef = useRef([]);
  const requestIdRef = useRef(null);

  useEffect(() => { activeIdRef.current = activeConversationId; }, [activeConversationId]);
  useEffect(() => { activeModeRef.current = activeMode; }, [activeMode]);
  useEffect(() => { activeProjectIdRef.current = activeProjectId; }, [activeProjectId]);
  useEffect(() => { currentMessagesRef.current = currentMessages; }, [currentMessages]);

  useEffect(() => { loadConversations(); }, []);

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

    const offDone = window.chat.onDone(({ requestId, mode }) => {
      if (requestId !== requestIdRef.current) return;
      // Tag the final assistant message with retrieval mode so the
      // citations chip can render the right label.
      setCurrentMessages((prev) => {
        const updated = [...prev];
        const last = updated.length - 1;
        if (updated[last]?.role === "assistant") {
          updated[last] = { ...updated[last], retrievalMode: mode };
        }
        return updated;
      });
      finalizeStream();
    });

    const offError = window.chat.onError(({ requestId, error }) => {
      if (requestId !== requestIdRef.current) return;
      setCurrentMessages((prev) => {
        const updated = [...prev];
        const last = updated.length - 1;
        if (updated[last]?.role === "assistant") {
          updated[last] = { ...updated[last], content: `Error: ${error}`, isError: true };
        }
        return updated;
      });
      setIsStreaming(false);
      requestIdRef.current = null;
    });

    const offCitations = window.chat.onCitations(({ requestId, mode, citations }) => {
      if (requestId !== requestIdRef.current) return;
      setCurrentMessages((prev) => {
        const updated = [...prev];
        const last = updated.length - 1;
        if (updated[last]?.role === "assistant") {
          updated[last] = { ...updated[last], citations, retrievalMode: mode };
        }
        return updated;
      });
    });

    return () => { offToken?.(); offDone?.(); offError?.(); offCitations?.(); };
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
      const temperature = settings?.temperature ?? DEFAULT_SETTINGS.temperature;
      const model =
        provider === "ollama"
          ? settings?.model || DEFAULT_SETTINGS.model
          : settings?.cloudModels?.[provider] || DEFAULT_SETTINGS.cloudModels[provider];

      // Send only user/assistant history (with the new user msg at the end).
      // Main builds the system message based on project context + retrieval.
      const messagesToSend = newMessages.slice(0, -1); // drop the assistant placeholder

      const requestId = generateId();
      requestIdRef.current = requestId;

      window.chat.send(
        messagesToSend,
        {
          provider,
          model,
          temperature,
          mode: activeModeRef.current,
          projectId: activeProjectIdRef.current || null,
        },
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
    if (requestId && window.chat) window.chat.abort(requestId);
    requestIdRef.current = null;
    setIsStreaming(false);
  }, []);

  const deleteConversation = useCallback(async (id) => {
    await deleteConv(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeIdRef.current === id) setCurrentMessages([]);
  }, []);

  // Deep Review — agent-style single-doc walk. Used by a button in chat.
  const runDeepReview = useCallback(
    async (documentId, question) => {
      if (isStreaming || !window.rag) return;
      let convId = activeIdRef.current;
      if (!convId) {
        convId = generateId();
        setActiveConversationId(convId);
        activeIdRef.current = convId;
      }
      const userMsg = { role: "user", content: `[Deep Review] ${question}` };
      const placeholder = { role: "assistant", content: "" };
      const next = [...(currentMessagesRef.current || []), userMsg, placeholder];
      setCurrentMessages(next);
      currentMessagesRef.current = next;
      streamingMessageRef.current = "";
      setIsStreaming(true);

      const provider = settings?.provider || DEFAULT_SETTINGS.provider;
      const model =
        provider === "ollama"
          ? settings?.model || DEFAULT_SETTINGS.model
          : settings?.cloudModels?.[provider] || DEFAULT_SETTINGS.cloudModels[provider];
      const requestId = generateId();
      requestIdRef.current = requestId;
      window.rag.deepReview(documentId, question, requestId, { provider, model });
    },
    [isStreaming, settings, setActiveConversationId]
  );

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
    runDeepReview,
  };
}
