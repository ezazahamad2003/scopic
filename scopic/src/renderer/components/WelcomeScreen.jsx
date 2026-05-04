import React from "react";
import { WORKFLOWS } from "../utils/constants.js";

const TRENDING_QUESTIONS = [
  "Should I incorporate in Delaware or my home state?",
  "What are standard SAFE terms for a pre-seed round?",
  "How do I protect my IP before raising capital?",
];

export default function WelcomeScreen({ onSuggestion, onSetMode }) {
  return (
    <div className="flex flex-col items-center justify-start h-full px-8 pt-10 pb-12 overflow-y-auto select-none">
      <h1
        className="text-3xl font-semibold mb-2 text-center"
        style={{ color: "#F0F4FF" }}
      >
        How can I help you today?
      </h1>
      <p className="text-sm mb-10 text-center" style={{ color: "#6B7280" }}>
        Choose a starting point or ask anything
      </p>

      {/* Feature cards */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-2xl mb-8">
        {/* Document Review card */}
        <button
          onClick={() => onSetMode("document_review")}
          className="text-left p-6 rounded-2xl transition-all duration-150"
          style={{
            background: "#141C30",
            border: "1px solid #1E3060",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#3A5A9F";
            e.currentTarget.style.background = "#172035";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#1E3060";
            e.currentTarget.style.background = "#141C30";
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">⚖️</span>
          </div>
          <div
            className="text-base font-semibold mb-2"
            style={{ color: "#7BA4FF" }}
          >
            Document Review
          </div>
          <div className="text-sm leading-relaxed" style={{ color: "#6B7280" }}>
            Upload a contract and the AI can identify risks, analyze clauses and
            suggest improvements based on the prompt of your choice
          </div>
        </button>

        {/* Legal Questions card */}
        <button
          onClick={() => onSetMode("general")}
          className="text-left p-6 rounded-2xl transition-all duration-150"
          style={{
            background: "#141820",
            border: "1px solid #2A3347",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#4A5568";
            e.currentTarget.style.background = "#161B27";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#2A3347";
            e.currentTarget.style.background = "#141820";
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">💡</span>
          </div>
          <div
            className="text-base font-semibold mb-2"
            style={{ color: "#F5C842" }}
          >
            Legal Questions
          </div>
          <div className="text-sm leading-relaxed" style={{ color: "#6B7280" }}>
            Ask about fundraising, employment, contracts, IP, or any startup
            legal topic
          </div>
        </button>
      </div>

      {/* Workflows gallery */}
      <div className="w-full max-w-2xl mb-8">
        <div
          className="text-xs font-semibold tracking-widest mb-3 uppercase"
          style={{ color: "#4A5568" }}
        >
          Workflows
        </div>
        <div className="grid grid-cols-2 gap-2">
          {WORKFLOWS.map((wf) => (
            <button
              key={wf.id}
              onClick={() => onSuggestion(wf.prompt)}
              className="text-left p-3 rounded-xl transition-all duration-150"
              style={{
                background: "#0F1117",
                border: "1px solid #1E2535",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#C9A55C44";
                e.currentTarget.style.background = "#141820";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#1E2535";
                e.currentTarget.style.background = "#0F1117";
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{wf.icon}</span>
                <span className="text-sm font-medium" style={{ color: "#E2E8F0" }}>
                  {wf.title}
                </span>
              </div>
              <div className="text-xs leading-snug" style={{ color: "#6B7280" }}>
                {wf.blurb}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Trending questions */}
      <div className="w-full max-w-2xl">
        <div
          className="text-xs font-semibold tracking-widest mb-3 uppercase"
          style={{ color: "#4A5568" }}
        >
          Trending Questions
        </div>
        <div className="space-y-2">
          {TRENDING_QUESTIONS.map((q, i) => (
            <button
              key={i}
              onClick={() => onSuggestion(q)}
              className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all duration-150"
              style={{
                background: "#0D1117",
                border: "1px solid #1E2535",
                color: "#9AA0B4",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#2A3347";
                e.currentTarget.style.background = "#111722";
                e.currentTarget.style.color = "#C8D0E0";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#1E2535";
                e.currentTarget.style.background = "#0D1117";
                e.currentTarget.style.color = "#9AA0B4";
              }}
            >
              "{q}"
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
