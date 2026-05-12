import React from "react";
import { WORKFLOWS, WORKFLOW_PIPELINES } from "../utils/constants.js";

// Full-pane gallery of all workflows. Single-prompt ones drop into the
// chat input (caller routes that to Assistant view). Multi-step
// pipelines open the WorkflowRunner.
export default function WorkflowsView({ onPickWorkflow, onRunPipeline }) {
  return (
    <main className="flex flex-col flex-1 overflow-hidden" style={{ background: "#FBFAF7" }}>
      <div className="px-8 py-6 border-b" style={{ borderColor: "#F8FAFC" }}>
        <h1 className="text-xl font-semibold" style={{ fontFamily: "DM Serif Display, serif", color: "#1F2937" }}>
          Workflows
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
          Pre-built legal flows. One-shot prompts drop into chat. Multi-step pipelines run sequentially with streamed outputs.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* Multi-step pipelines */}
        {WORKFLOW_PIPELINES?.length > 0 && (
          <section className="mb-8 max-w-5xl">
            <h2 className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "#315A98" }}>
              Pipelines · multi-step
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {WORKFLOW_PIPELINES.map((pl) => (
                <button
                  key={pl.id}
                  onClick={() => onRunPipeline(pl)}
                  className="text-left p-4 rounded-xl transition-all"
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #D8DEE8",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#315A98"; e.currentTarget.style.background = "#F8FAFC"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#D8DEE8"; e.currentTarget.style.background = "#FFFFFF"; }}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">{pl.icon}</span>
                    <div className="flex-1">
                      <div className="text-sm font-semibold mb-1" style={{ color: "#315A98" }}>
                        {pl.title}
                      </div>
                      <div className="text-xs leading-snug" style={{ color: "#475569" }}>
                        {pl.blurb}
                      </div>
                      <div className="text-[11px] mt-2" style={{ color: "#94A3B8" }}>
                        {pl.steps.length} steps · {pl.inputs.length} input{pl.inputs.length === 1 ? "" : "s"}
                      </div>
                    </div>
                    <span className="text-xs" style={{ color: "#315A98" }}>Run →</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Single-prompt workflows */}
        <section className="max-w-5xl">
          <h2 className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "#315A98" }}>
            Quick prompts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {WORKFLOWS.map((wf) => (
              <button
                key={wf.id}
                onClick={() => onPickWorkflow(wf)}
                className="text-left p-4 rounded-xl transition-all"
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #D8DEE8",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#315A9866"; e.currentTarget.style.background = "#FFFFFF"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#D8DEE8"; e.currentTarget.style.background = "#FFFFFF"; }}
              >
                <div className="flex items-center gap-2 mb-2">
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
        </section>
      </div>
    </main>
  );
}
