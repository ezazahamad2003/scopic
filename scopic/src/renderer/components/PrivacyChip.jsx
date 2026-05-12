import React, { useEffect, useState } from "react";

// "Embeddings: local · Chat: claude-sonnet" privacy indicator.
// The point: lawyers should be able to see at a glance whether their
// documents leave the machine. Local embeddings → docs never leave;
// only retrieved chunks travel to the chat provider.
export default function PrivacyChip({ settings, provider, model }) {
  const [embedStatus, setEmbedStatus] = useState(null);

  useEffect(() => {
    if (!window.rag) return;
    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const s = await window.rag.embedStatus();
        if (!cancelled) setEmbedStatus(s);
      } catch {}
    };
    fetchStatus();
    const id = setInterval(fetchStatus, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const embedEnabled = embedStatus?.enabled !== false && (settings?.embeddings?.enabled !== false);
  const embedModel = embedStatus?.model || settings?.embeddings?.model || "nomic-embed-text";
  const pending = embedStatus?.pendingChunks || 0;

  const chatLabel = (() => {
    if (provider === "ollama") return `Ollama · ${model || "—"}`;
    return `${capitalize(provider)} · ${model || "—"}`;
  })();

  const allLocal = provider === "ollama" && embedEnabled;

  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px]"
      style={{
        background: "var(--surface-soft)",
        border: "1px solid var(--border-soft)",
        color: "var(--muted)",
      }}
      title={allLocal
        ? "Everything stays on your machine."
        : "Documents stay local. Only retrieved excerpts are sent to the cloud chat model."
      }
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: allLocal ? "#22C55E" : "#D97757" }}
      />
      <span>
        Embeddings: <strong style={{ color: "var(--text-soft)" }}>{embedEnabled ? "local" : "off"}</strong>
        <span style={{ color: "var(--muted-2)" }}> ({embedModel.replace(/^.*\//, "")})</span>
      </span>
      <span style={{ color: "var(--border)" }}>·</span>
      <span>
        Chat: <strong style={{ color: "var(--text-soft)" }}>{chatLabel}</strong>
      </span>
      {pending > 0 && (
        <>
          <span style={{ color: "var(--border)" }}>·</span>
          <span style={{ color: "var(--accent-strong)" }}>indexing {pending}</span>
        </>
      )}
    </div>
  );
}

function capitalize(s) {
  if (!s) return "";
  return s[0].toUpperCase() + s.slice(1);
}
