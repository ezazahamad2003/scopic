import React from "react";

export default function UpdateBanner({ status, version, progress, onInstall }) {
  const isReady = status === "downloaded";
  const isDownloading = status === "downloading";
  const isAvailable = status === "available";

  if (!isReady && !isDownloading && !isAvailable) return null;

  let label = "";
  if (isAvailable) label = `Update available (v${version || ""})`;
  else if (isDownloading) label = `Downloading update… ${progress ? Math.round(progress) + "%" : ""}`;
  else if (isReady) label = `Update ready (v${version || ""}) — restart to install`;

  return (
    <div
      className="fixed bottom-4 right-4 z-40 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg"
      style={{
        background: isReady ? "#EEF6FF" : "#FFFFFF",
        border: `1px solid ${isReady ? "#3A5A9F" : "#D8DEE8"}`,
        color: "#1F2937",
        maxWidth: 360,
      }}
    >
      <span className="text-base">{isReady ? "✨" : "⬇️"}</span>
      <div className="flex-1 text-xs">{label}</div>
      {isReady && (
        <button
          onClick={onInstall}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            background: "linear-gradient(135deg, #3A5A9F, #2A4A8F)",
            color: "#FFFFFF",
          }}
        >
          Restart
        </button>
      )}
    </div>
  );
}
