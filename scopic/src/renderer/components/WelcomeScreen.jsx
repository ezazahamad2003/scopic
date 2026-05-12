import React from "react";
import { WORKFLOWS, WORKFLOW_PIPELINES } from "../utils/constants.js";

const TRENDING_QUESTIONS = [
  "Should I incorporate in Delaware or my home state?",
  "What are standard SAFE terms for a pre-seed round?",
  "How do I protect my IP before raising capital?",
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "Working late?";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Working late?";
}

export default function WelcomeScreen({ onSuggestion, onSetMode, onRunPipeline, onPickWorkflow }) {
  return (
    <div className="flex flex-col items-center justify-start h-full px-8 pt-12 pb-12 overflow-y-auto select-none">
      <p className="text-xs font-bold tracking-[0.2em] uppercase mb-3" style={{ color: "#C9A55C" }}>
        {getGreeting()}
      </p>
      <h1
        className="text-3xl font-semibold mb-2 text-center"
        style={{ color: "#1F2937" }}
      >
        How can I help you today?
      </h1>
      <p className="text-sm mb-10 text-center" style={{ color: "#64748B" }}>
        Choose a starting point or ask anything
      </p>

      {/* Feature cards */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-2xl mb-8">
        {/* Document Review card */}
        <button
          onClick={() => onSetMode("document_review")}
          className="text-left p-6 rounded-2xl transition-all duration-150"
          style={{
            background: "#FFFFFF",
            border: "1px solid #D8DEE8",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#315A98";
            e.currentTarget.style.background = "#F8FAFC";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#D8DEE8";
            e.currentTarget.style.background = "#FFFFFF";
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">⚖️</span>
          </div>
          <div
            className="text-base font-semibold mb-2"
            style={{ color: "#315A98" }}
          >
            Document Review
          </div>
          <div className="text-sm leading-relaxed" style={{ color: "#64748B" }}>
            Upload a contract and the AI can identify risks, analyze clauses and
            suggest improvements based on the prompt of your choice
          </div>
        </button>

        {/* Legal Questions card */}
        <button
          onClick={() => onSetMode("general")}
          className="text-left p-6 rounded-2xl transition-all duration-150"
          style={{
            background: "#FFFFFF",
            border: "1px solid #D8DEE8",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#94A3B8";
            e.currentTarget.style.background = "#FFFFFF";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#D8DEE8";
            e.currentTarget.style.background = "#FFFFFF";
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">💡</span>
          </div>
          <div
            className="text-base font-semibold mb-2"
            style={{ color: "#315A98" }}
          >
            Legal Questions
          </div>
          <div className="text-sm leading-relaxed" style={{ color: "#64748B" }}>
            Ask about fundraising, employment, contracts, IP, or any startup
            legal topic
          </div>
        </button>
      </div>

      {/* Pipelines (multi-step) */}
      {onRunPipeline && WORKFLOW_PIPELINES?.length > 0 && (
        <div className="w-full max-w-2xl mb-8">
          <div
            className="text-xs font-semibold tracking-widest mb-3 uppercase"
            style={{ color: "#94A3B8" }}
          >
            Pipelines · multi-step
          </div>
          <div className="grid grid-cols-1 gap-2">
            {WORKFLOW_PIPELINES.map((pl) => (
              <button
                key={pl.id}
                onClick={() => onRunPipeline(pl)}
                className="text-left p-3 rounded-xl transition-all duration-150 flex items-center gap-3"
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #D8DEE8",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#315A98";
                  e.currentTarget.style.background = "#F8FAFC";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#D8DEE8";
                  e.currentTarget.style.background = "#FFFFFF";
                }}
              >
                <span className="text-xl">{pl.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium" style={{ color: "#315A98" }}>
                    {pl.title}
                  </div>
                  <div className="text-xs leading-snug mt-0.5" style={{ color: "#64748B" }}>
                    {pl.blurb}
                  </div>
                </div>
                <span className="text-xs" style={{ color: "#315A98" }}>Run →</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Workflows gallery */}
      <div className="w-full max-w-2xl mb-8">
        <div
          className="text-xs font-semibold tracking-widest mb-3 uppercase"
          style={{ color: "#94A3B8" }}
        >
          Workflows
        </div>
        <div className="grid grid-cols-2 gap-2">
          {WORKFLOWS.map((wf) => (
            <button
              key={wf.id}
              onClick={() => (onPickWorkflow ? onPickWorkflow(wf) : onSuggestion(wf.prompt))}
              className="text-left p-3 rounded-xl transition-all duration-150"
              style={{
                background: "#FFFFFF",
                border: "1px solid #F8FAFC",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#315A9844";
                e.currentTarget.style.background = "#FFFFFF";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#F8FAFC";
                e.currentTarget.style.background = "#FFFFFF";
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{wf.icon}</span>
                <span className="text-sm font-medium" style={{ color: "#1F2937" }}>
                  {wf.title}
                </span>
              </div>
              <div className="text-xs leading-snug" style={{ color: "#64748B" }}>
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
          style={{ color: "#94A3B8" }}
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
                background: "#FBFAF7",
                border: "1px solid #F8FAFC",
                color: "#475569",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#D8DEE8";
                e.currentTarget.style.background = "#FFFFFF";
                e.currentTarget.style.color = "#334155";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#F8FAFC";
                e.currentTarget.style.background = "#FBFAF7";
                e.currentTarget.style.color = "#475569";
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
