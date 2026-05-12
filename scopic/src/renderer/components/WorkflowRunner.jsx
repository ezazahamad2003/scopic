import React, { useState, useEffect, useRef, useCallback } from "react";
import { renderMarkdown } from "../utils/markdown.js";
import { DEFAULT_SETTINGS, LEGAL_SYSTEM_PROMPT } from "../utils/constants.js";

// Sequentially executes a multi-step pipeline. Each step's prompt may
// reference user inputs as {{inputId}} and earlier outputs as
// {{stepId_output}}. Streams each step through the unified chat IPC
// using whatever provider/model is set in the active settings.
export default function WorkflowRunner({ pipeline, settings, onClose, onSaveAsConversation }) {
  const [inputs, setInputs] = useState(() =>
    Object.fromEntries(pipeline.inputs.map((i) => [i.id, ""]))
  );
  const [outputs, setOutputs] = useState({});
  const [errors, setErrors] = useState({});
  const [phase, setPhase] = useState("idle"); // idle | running | done | aborted | error
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);

  const requestIdRef = useRef(null);
  const stepIndexRef = useRef(-1);
  const inputsRef = useRef(inputs);
  const outputsRef = useRef(outputs);

  useEffect(() => { inputsRef.current = inputs; }, [inputs]);
  useEffect(() => { outputsRef.current = outputs; }, [outputs]);

  // Wire up streaming listeners once.
  useEffect(() => {
    if (!window.chat) return;

    const offToken = window.chat.onToken(({ requestId, token }) => {
      if (requestId !== requestIdRef.current) return;
      const stepId = pipeline.steps[stepIndexRef.current]?.id;
      if (!stepId) return;
      setOutputs((prev) => ({ ...prev, [stepId]: (prev[stepId] || "") + token }));
    });

    const offDone = window.chat.onDone(({ requestId }) => {
      if (requestId !== requestIdRef.current) return;
      const nextIdx = stepIndexRef.current + 1;
      if (nextIdx >= pipeline.steps.length) {
        setPhase("done");
        setCurrentStepIndex(-1);
        return;
      }
      runStep(nextIdx);
    });

    const offError = window.chat.onError(({ requestId, error }) => {
      if (requestId !== requestIdRef.current) return;
      const stepId = pipeline.steps[stepIndexRef.current]?.id;
      if (stepId) setErrors((prev) => ({ ...prev, [stepId]: error }));
      setPhase("error");
      setCurrentStepIndex(-1);
    });

    return () => {
      offToken?.();
      offDone?.();
      offError?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const substitute = useCallback((template) => {
    return template.replace(/\{\{(\w+)\}\}/g, (_match, name) => {
      if (name.endsWith("_output")) {
        const stepId = name.slice(0, -"_output".length);
        return outputsRef.current[stepId] || "";
      }
      return inputsRef.current[name] || "";
    });
  }, []);

  const runStep = useCallback((idx) => {
    const step = pipeline.steps[idx];
    if (!step) return;
    stepIndexRef.current = idx;
    setCurrentStepIndex(idx);

    const prompt = substitute(step.prompt);
    const requestId = `wf-${pipeline.id}-${step.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    requestIdRef.current = requestId;

    const provider = settings?.provider || DEFAULT_SETTINGS.provider;
    const temperature = DEFAULT_SETTINGS.temperature;
    const model =
      provider === "ollama"
        ? settings?.model || DEFAULT_SETTINGS.model
        : settings?.cloudModels?.[provider] || DEFAULT_SETTINGS.cloudModels[provider];

    window.chat.send(
      [
        { role: "system", content: LEGAL_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      { provider, model, temperature },
      requestId
    );
  }, [pipeline, settings, substitute]);

  const handleRun = () => {
    setOutputs({});
    setErrors({});
    setPhase("running");
    runStep(0);
  };

  const handleStop = () => {
    if (requestIdRef.current && window.chat) {
      window.chat.abort(requestIdRef.current);
    }
    requestIdRef.current = null;
    stepIndexRef.current = -1;
    setPhase("aborted");
    setCurrentStepIndex(-1);
  };

  const handleSaveAsConversation = () => {
    const conversation = pipeline.steps
      .map((s) => `## ${s.title}\n\n${outputs[s.id] || "(no output)"}`)
      .join("\n\n---\n\n");
    const userPrompt =
      `# ${pipeline.title}\n\n` +
      pipeline.inputs
        .filter((i) => inputs[i.id])
        .map((i) => `**${i.label}:**\n${inputs[i.id]}`)
        .join("\n\n");
    onSaveAsConversation?.({
      title: pipeline.title,
      messages: [
        { role: "user", content: userPrompt },
        { role: "assistant", content: conversation },
      ],
    });
  };

  const allInputsFilled = pipeline.inputs.every((i) => inputs[i.id]?.trim());
  const handleBackdrop = (e) => { if (e.target === e.currentTarget && phase !== "running") onClose(); };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(15,23,42,0.28)", backdropFilter: "blur(4px)" }}
      onClick={handleBackdrop}
    >
      <div
        className="w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col"
        style={{
          background: "#FFFFFF",
          border: "1px solid #D8DEE8",
          boxShadow: "0 24px 64px rgba(15,23,42,0.16)",
          maxHeight: "90vh",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "#D8DEE8" }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{pipeline.icon}</span>
            <div>
              <h2 className="text-lg font-semibold" style={{ fontFamily: "DM Serif Display, serif", color: "#315A98" }}>
                {pipeline.title}
              </h2>
              <p className="text-xs" style={{ color: "#64748B" }}>{pipeline.blurb}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={phase === "running"}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-[#D8DEE8] transition-colors disabled:opacity-40"
            title={phase === "running" ? "Stop the run first" : "Close"}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Inputs */}
          {phase === "idle" && (
            <div className="space-y-3">
              <div className="text-xs font-medium uppercase tracking-wide" style={{ color: "#64748B" }}>
                Inputs
              </div>
              {pipeline.inputs.map((inp) => (
                <div key={inp.id}>
                  <label className="block text-xs font-medium mb-1" style={{ color: "#475569" }}>
                    {inp.label}
                  </label>
                  {inp.multiline ? (
                    <textarea
                      rows={6}
                      value={inputs[inp.id]}
                      onChange={(e) => setInputs((s) => ({ ...s, [inp.id]: e.target.value }))}
                      placeholder={inp.placeholder}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y font-mono"
                      style={{ background: "#FFFFFF", border: "1px solid #D8DEE8", color: "#1F2937" }}
                    />
                  ) : (
                    <input
                      type="text"
                      value={inputs[inp.id]}
                      onChange={(e) => setInputs((s) => ({ ...s, [inp.id]: e.target.value }))}
                      placeholder={inp.placeholder}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ background: "#FFFFFF", border: "1px solid #D8DEE8", color: "#1F2937" }}
                    />
                  )}
                </div>
              ))}
              <div className="text-xs" style={{ color: "#64748B" }}>
                Pipeline runs {pipeline.steps.length} steps sequentially through your active provider
                ({settings?.provider === "ollama" ? "Ollama" : (settings?.provider || "ollama").toUpperCase()}).
              </div>
            </div>
          )}

          {/* Steps & outputs */}
          {phase !== "idle" && pipeline.steps.map((step, idx) => {
            const output = outputs[step.id] || "";
            const error = errors[step.id];
            const isCurrent = idx === currentStepIndex && phase === "running";
            const isDone = output && !isCurrent && !error;
            const isPending = !output && !isCurrent && !error;
            return (
              <div
                key={step.id}
                className="rounded-lg p-4"
                style={{
                  background: "#FFFFFF",
                  border: `1px solid ${isCurrent ? "#315A9866" : "#D8DEE8"}`,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                    style={{
                      background: isDone ? "#22C55E" : isCurrent ? "#315A98" : "#D8DEE8",
                      color: isDone || isCurrent ? "#FFFFFF" : "#64748B",
                    }}
                  >
                    {isDone ? "✓" : idx + 1}
                  </div>
                  <span className="text-sm font-medium" style={{ color: "#1F2937" }}>
                    {step.title}
                  </span>
                  {isCurrent && (
                    <span className="text-xs ml-auto" style={{ color: "#315A98" }}>streaming…</span>
                  )}
                  {isPending && (
                    <span className="text-xs ml-auto" style={{ color: "#94A3B8" }}>pending</span>
                  )}
                </div>
                {error ? (
                  <div className="text-xs" style={{ color: "#EF4444" }}>Error: {error}</div>
                ) : output ? (
                  <div
                    className="text-sm leading-relaxed prose-sm"
                    style={{ color: "#334155" }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(output) }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="p-5 border-t flex gap-3" style={{ borderColor: "#D8DEE8" }}>
          {phase === "idle" && (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition-colors"
                style={{ background: "#FFFFFF", border: "1px solid #D8DEE8" }}
              >
                Cancel
              </button>
              <button
                onClick={handleRun}
                disabled={!allInputsFilled}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, #315A98, #244876)",
                  color: "#FFFFFF",
                }}
              >
                Run pipeline
              </button>
            </>
          )}
          {phase === "running" && (
            <button
              onClick={handleStop}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{ background: "#2A1010", border: "1px solid #6b1010", color: "#EF4444" }}
            >
              Stop
            </button>
          )}
          {(phase === "done" || phase === "aborted" || phase === "error") && (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition-colors"
                style={{ background: "#FFFFFF", border: "1px solid #D8DEE8" }}
              >
                Close
              </button>
              {phase === "done" && (
                <button
                  onClick={handleSaveAsConversation}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: "linear-gradient(135deg, #315A98, #244876)",
                    color: "#FFFFFF",
                  }}
                >
                  Save & open in chat
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
