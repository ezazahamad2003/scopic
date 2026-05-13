import React, { useMemo, useState } from "react";
import { WORKFLOWS, WORKFLOW_PIPELINES } from "../utils/constants.js";
import { MIKE_PRACTICES, mikeAssistantWorkflows, mikeTabularWorkflows } from "../utils/mikeAdapters.js";

const TYPE_OPTIONS = ["All types", "Assistant", "Pipeline", "Tabular"];
const PRACTICE_OPTIONS = [
  "All practices",
  "Corporate",
  "Finance",
  "General Transactions",
  "Litigation",
  "Private Equity",
  "Regulatory",
  "Startup",
  ...MIKE_PRACTICES.filter(
    (practice) =>
      ![
        "Corporate",
        "Finance",
        "General Transactions",
        "Litigation",
        "Private Equity",
      ].includes(practice)
  ),
];

const WORKFLOW_META = {
  "cp-checklist": { practice: "Finance" },
  "credit-summary": { practice: "Finance" },
  "shareholder-summary": { practice: "Corporate" },
  "change-control": { practice: "Corporate" },
  "nda-draft": { practice: "General Transactions" },
  "contract-risks": { practice: "General Transactions" },
  "case-irac": { practice: "Litigation" },
  "compliance-scan": { practice: "Regulatory" },
  "ip-protection": { practice: "Startup" },
  "term-sheet": { practice: "Startup" },
  "contract-pipeline": { practice: "General Transactions" },
  "litigation-prep": { practice: "Litigation" },
  "diligence-pipeline": { practice: "Private Equity" },
};

function typeColor(type) {
  if (type === "Tabular") return "#0F766E";
  return type === "Pipeline" ? "#7C3AED" : "#006BFF";
}

function workflowRows() {
  const assistantRows = WORKFLOWS.map((workflow) => ({
    id: workflow.id,
    name: workflow.title,
    description: workflow.blurb,
    type: "Assistant",
    practice: WORKFLOW_META[workflow.id]?.practice || "General Transactions",
    source: "Scopic",
    item: workflow,
  }));

  const pipelineRows = (WORKFLOW_PIPELINES || []).map((pipeline) => ({
    id: pipeline.id,
    name: pipeline.title,
    description: pipeline.blurb,
    type: "Pipeline",
    practice: WORKFLOW_META[pipeline.id]?.practice || "General Transactions",
    source: "Scopic",
    item: pipeline,
  }));

  const mikeAssistantRows = mikeAssistantWorkflows().map((workflow) => ({
    id: workflow.id,
    name: workflow.title,
    description: workflow.blurb,
    type: "Assistant",
    practice: workflow.practice,
    source: "Mike",
    item: workflow,
  }));

  const mikeTabularRows = mikeTabularWorkflows().map((workflow) => ({
    id: workflow.id,
    name: workflow.title,
    description: workflow.blurb,
    type: "Tabular",
    practice: workflow.practice,
    source: "Mike",
    item: workflow,
  }));

  return [...assistantRows, ...pipelineRows, ...mikeAssistantRows, ...mikeTabularRows].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

export default function WorkflowsView({ onPickWorkflow, onRunPipeline, onOpenTabularPreset }) {
  const [activeTab, setActiveTab] = useState("All Workflows");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All types");
  const [practiceFilter, setPracticeFilter] = useState("All practices");
  const rows = useMemo(workflowRows, []);

  const filteredRows = rows.filter((row) => {
    if (activeTab === "Built-in" && row.source !== "Scopic") return false;
    if (activeTab === "Custom") return false;
    if (activeTab === "Hidden") return false;
    if (typeFilter !== "All types" && row.type !== typeFilter) return false;
    if (practiceFilter !== "All practices" && row.practice !== practiceFilter) return false;
    if (query.trim()) {
      const haystack = `${row.name} ${row.description} ${row.practice} ${row.type}`.toLowerCase();
      if (!haystack.includes(query.trim().toLowerCase())) return false;
    }
    return true;
  });

  const handleRun = (row) => {
    if (row.type === "Pipeline") onRunPipeline(row.item);
    else if (row.type === "Tabular") onOpenTabularPreset(row.item);
    else onPickWorkflow(row.item);
  };

  return (
    <main className="flex flex-1 flex-col overflow-hidden" style={{ background: "var(--surface)" }}>
      <div className="border-b px-10 py-7" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-start justify-between gap-6">
          <h1
            className="text-3xl font-semibold"
            style={{ fontFamily: "DM Serif Display, Georgia, serif", color: "var(--text)" }}
          >
            Workflows
          </h1>
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 items-center rounded-lg border px-3"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}
            >
              <span className="text-sm">Search</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="ml-2 w-44 bg-transparent text-sm outline-none"
                style={{ color: "var(--text)" }}
                placeholder="workflow name"
              />
            </div>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-xl transition-colors hover:bg-[#F3F4F6]"
              style={{ color: "var(--muted)" }}
              title="New workflow"
            >
              +
            </button>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between gap-6">
          <div className="flex items-center gap-7">
            {["All Workflows", "Built-in", "Custom", "Hidden"].map((tab) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className="text-sm font-medium transition-colors"
                  style={{ color: active ? "var(--text)" : "var(--muted)" }}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent text-sm outline-none"
              style={{ color: "var(--text-soft)" }}
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
            <select
              value={practiceFilter}
              onChange={(e) => setPracticeFilter(e.target.value)}
              className="bg-transparent text-sm outline-none"
              style={{ color: "var(--text-soft)" }}
            >
              {PRACTICE_OPTIONS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b text-sm" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
              <th className="w-12 px-5 py-3 font-medium">
                <input type="checkbox" aria-label="Select all workflows" />
              </th>
              <th className="px-3 py-3 font-medium">Name</th>
              <th className="w-36 px-3 py-3 font-medium">Type</th>
              <th className="w-52 px-3 py-3 font-medium">Practice</th>
              <th className="w-40 px-3 py-3 font-medium">Source</th>
              <th className="w-24 px-6 py-3 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr
                key={row.id}
                className="group border-b transition-colors"
                style={{ borderColor: "var(--border-soft)" }}
              >
                <td className="px-5 py-4">
                  <input type="checkbox" aria-label={`Select ${row.name}`} />
                </td>
                <td className="px-3 py-4">
                  <button
                    type="button"
                    onClick={() => handleRun(row)}
                    className="text-left text-base font-medium transition-colors hover:text-[#315A98]"
                    style={{ color: "var(--text)" }}
                  >
                    {row.name}
                  </button>
                  <div className="mt-1 max-w-2xl truncate text-xs" style={{ color: "var(--muted)" }}>
                    {row.description}
                  </div>
                </td>
                <td className="px-3 py-4">
                  <span className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: typeColor(row.type) }}>
                    <span
                      className="h-3 w-3 rounded-[3px] border"
                      style={{ borderColor: typeColor(row.type) }}
                    />
                    {row.type}
                  </span>
                </td>
                <td className="px-3 py-4 text-sm" style={{ color: "var(--text-soft)" }}>
                  {row.practice}
                </td>
                <td className="px-3 py-4">
                  <span className="inline-flex items-center gap-2 text-sm" style={{ color: "var(--text-soft)" }}>
                    <span className="text-base">✺</span>
                    {row.source}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => handleRun(row)}
                    className="rounded-lg px-2 py-1 text-sm opacity-60 transition-opacity hover:opacity-100"
                    style={{ color: "var(--text)" }}
                    title={`Run ${row.name}`}
                  >
                    ...
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredRows.length === 0 && (
          <div className="flex h-56 items-center justify-center text-sm" style={{ color: "var(--muted)" }}>
            No workflows match these filters.
          </div>
        )}
      </div>
    </main>
  );
}
