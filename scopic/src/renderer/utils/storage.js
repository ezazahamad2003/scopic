export async function getConversations() {
  if (window.store) {
    return await window.store.getConversations();
  }
  return [];
}

export async function saveConversation(conversation) {
  if (window.store) {
    return await window.store.saveConversation(conversation);
  }
}

export async function deleteConversation(id) {
  if (window.store) {
    return await window.store.deleteConversation(id);
  }
}

export async function getSettings() {
  if (window.store) {
    return await window.store.getSettings();
  }
  return null;
}

export async function saveSettings(settings) {
  if (window.store) {
    return await window.store.saveSettings(settings);
  }
}

export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function formatConversationTitle(messages) {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New Conversation";
  const content = first.content.trim();
  return content.length > 50 ? content.slice(0, 50) + "..." : content;
}
