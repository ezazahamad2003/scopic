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

function getSystemPrompt(mode) {
  if (mode === "document_review") return CONTRACT_REVIEW_SYSTEM_PROMPT;
  return LEGAL_SYSTEM_PROMPT;
}

export function useChat(activeConversationId, setActiveConversationId, settings, activeMode) {
  const [conversations, setConversations] = useState([]);
  const [currentMessages, setCurrentMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const streamingMessageRef = useRef("");
  const activeIdRef = useRef(activeConversationId);
  const abortRef = useRef(null);

  useEffect(() => {
    activeIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    loadConversations();
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
    streamingMessageRef.current = "";
    return id;
  }, []);

  const sendMessage = useCallback(
    async (content) => {
      if (!content.trim() || isStreaming) return;

      let convId = activeConversationId;
      if (!convId) {
        convId = generateId();
        setActiveConversationId(convId);
        activeIdRef.current = convId;
      }

      const userMessage = { role: "user", content: content.trim() };
      const assistantPlaceholder = { role: "assistant", content: "" };
      const newMessages = [...currentMessages, userMessage, assistantPlaceholder];

      setCurrentMessages(newMessages);
      streamingMessageRef.current = "";
      setIsStreaming(true);

      const ollamaUrl = settings?.ollamaUrl || DEFAULT_SETTINGS.ollamaUrl;
      const model = settings?.model || DEFAULT_SETTINGS.model;
      const temperature = settings?.temperature ?? DEFAULT_SETTINGS.temperature;

      const systemPrompt = getSystemPrompt(activeMode);

      const messagesToSend = [
        { role: "system", content: systemPrompt },
        ...newMessages.slice(0, -1),
      ];

      const abort = new AbortController();
      abortRef.current = abort;

      try {
        const response = await fetch(`${ollamaUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: messagesToSend,
            stream: true,
            options: { temperature },
          }),
          signal: abort.signal,
        });

        if (!response.ok) {
          const errText = await response.text();
          setCurrentMessages((prev) => {
            const updated = [...prev];
            const last = updated.length - 1;
            if (updated[last]?.role === "assistant") {
              updated[last] = {
                ...updated[last],
                content: `Error: ${errText}`,
                isError: true,
              };
            }
            return updated;
          });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              if (parsed.message?.content) {
                streamingMessageRef.current += parsed.message.content;
                const snapshot = streamingMessageRef.current;
                setCurrentMessages((prev) => {
                  const updated = [...prev];
                  const last = updated.length - 1;
                  if (updated[last]?.role === "assistant") {
                    updated[last] = { ...updated[last], content: snapshot };
                  }
                  return updated;
                });
              }
            } catch {
              // skip malformed JSON lines
            }
          }
        }

        // Save completed conversation
        setCurrentMessages((prev) => {
          const title = formatConversationTitle(prev);
          saveConversation({
            id: convId,
            title,
            messages: prev,
            updatedAt: Date.now(),
            mode: activeMode,
          }).then(() => loadConversations());
          return prev;
        });
      } catch (err) {
        if (err.name === "AbortError") return;
        setCurrentMessages((prev) => {
          const updated = [...prev];
          const last = updated.length - 1;
          if (updated[last]?.role === "assistant") {
            updated[last] = {
              ...updated[last],
              content: `Error: ${err.message}`,
              isError: true,
            };
          }
          return updated;
        });
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [activeConversationId, currentMessages, isStreaming, settings, setActiveConversationId, activeMode]
  );

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
    createNewConversation,
    loadConversation,
    deleteConversation,
  };
}
