// Provider chat adapters. Each function streams tokens via the supplied
// onToken callback and resolves when the provider signals completion.
// All cloud providers are routed through the main process to avoid CORS
// and to keep API keys in a single trust boundary.

async function chatOllama({ url, model, temperature, messages, onToken, signal }) {
  const response = await fetch(`${url}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      options: { temperature },
    }),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    throw new Error(errText || `Ollama HTTP ${response.status}`);
  }

  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.message?.content) onToken(parsed.message.content);
        if (parsed.done) return;
      } catch {}
    }
  }
}

async function chatAnthropic({ apiKey, model, temperature, messages, onToken, signal }) {
  if (!apiKey) throw new Error("Anthropic API key not set");

  const sysParts = messages.filter((m) => m.role === "system").map((m) => m.content);
  const conv = messages.filter((m) => m.role !== "system").map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  // Opus 4.7+ deprecates the temperature parameter; older models still accept it.
  const supportsTemperature = !/opus-4-7/.test(model);

  const body = {
    model,
    max_tokens: 4096,
    stream: true,
    system: sysParts.join("\n\n") || undefined,
    messages: conv,
  };
  if (supportsTemperature) body.temperature = temperature;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    throw new Error(errText || `Anthropic HTTP ${response.status}`);
  }

  await consumeSSE(response.body, (event) => {
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
      onToken(event.delta.text);
    }
  });
}

async function chatOpenAI({ apiKey, model, temperature, messages, onToken, signal }) {
  if (!apiKey) throw new Error("OpenAI API key not set");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature,
    }),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    throw new Error(errText || `OpenAI HTTP ${response.status}`);
  }

  await consumeSSE(response.body, (event) => {
    const delta = event.choices?.[0]?.delta?.content;
    if (delta) onToken(delta);
  });
}

async function chatGemini({ apiKey, model, temperature, messages, onToken, signal }) {
  if (!apiKey) throw new Error("Gemini API key not set");

  const sysParts = messages.filter((m) => m.role === "system").map((m) => m.content);
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents,
    generationConfig: { temperature },
  };
  if (sysParts.length) {
    body.systemInstruction = { parts: [{ text: sysParts.join("\n\n") }] };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    throw new Error(errText || `Gemini HTTP ${response.status}`);
  }

  await consumeSSE(response.body, (event) => {
    const parts = event.candidates?.[0]?.content?.parts || [];
    for (const p of parts) if (p.text) onToken(p.text);
  });
}

// Generic SSE reader. Each `data:` line is parsed as JSON and forwarded.
async function consumeSSE(body, onEvent) {
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line || line.startsWith(":")) continue;
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        onEvent(JSON.parse(payload));
      } catch {}
    }
  }
}

async function dispatchChat({ provider, settings, model, temperature, messages, onToken, signal }) {
  switch (provider) {
    case "ollama":
      return chatOllama({
        url: settings.ollamaUrl,
        model,
        temperature,
        messages,
        onToken,
        signal,
      });
    case "anthropic":
      return chatAnthropic({
        apiKey: settings.apiKeys?.anthropic,
        model,
        temperature,
        messages,
        onToken,
        signal,
      });
    case "openai":
      return chatOpenAI({
        apiKey: settings.apiKeys?.openai,
        model,
        temperature,
        messages,
        onToken,
        signal,
      });
    case "gemini":
      return chatGemini({
        apiKey: settings.apiKeys?.gemini,
        model,
        temperature,
        messages,
        onToken,
        signal,
      });
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

async function listProviderModels({ provider, settings }) {
  if (provider === "ollama") {
    try {
      const response = await fetch(`${settings.ollamaUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return [];
      const data = await response.json();
      return (data?.models || []).map((m) => m.name);
    } catch {
      return [];
    }
  }
  if (provider === "anthropic") {
    if (!settings.apiKeys?.anthropic) return [];
    try {
      const response = await fetch("https://api.anthropic.com/v1/models", {
        headers: {
          "x-api-key": settings.apiKeys.anthropic,
          "anthropic-version": "2023-06-01",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return [];
      const data = await response.json();
      return (data?.data || []).map((m) => m.id);
    } catch {
      return [];
    }
  }
  if (provider === "openai") {
    if (!settings.apiKeys?.openai) return [];
    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${settings.apiKeys.openai}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return [];
      const data = await response.json();
      return (data?.data || [])
        .map((m) => m.id)
        .filter((id) => id.startsWith("gpt-") || id.startsWith("o1") || id.startsWith("o3") || id.startsWith("o4") || id.startsWith("chatgpt-"))
        .sort();
    } catch {
      return [];
    }
  }
  if (provider === "gemini") {
    if (!settings.apiKeys?.gemini) return [];
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(settings.apiKeys.gemini)}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) return [];
      const data = await response.json();
      return (data?.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
        .map((m) => (m.name || "").replace(/^models\//, ""))
        .filter(Boolean)
        .sort();
    } catch {
      return [];
    }
  }
  return [];
}

async function pingProvider({ provider, settings }) {
  if (provider === "ollama") {
    try {
      const response = await fetch(`${settings.ollamaUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  // Cloud providers: presence of an API key is the readiness signal.
  // Live verification happens implicitly on first chat or via listProviderModels.
  return Boolean(settings.apiKeys?.[provider]);
}

module.exports = {
  dispatchChat,
  listProviderModels,
  pingProvider,
};
