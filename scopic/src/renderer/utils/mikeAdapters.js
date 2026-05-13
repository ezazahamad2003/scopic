import { MIKE_WORKFLOWS } from "./mikeWorkflows.js";

export const MIKE_PRACTICES = [
  "General Transactions",
  "Corporate",
  "Finance",
  "Litigation",
  "Real Estate",
  "Tax",
  "Employment",
  "IP",
  "Competition",
  "Tech Transactions",
  "Project Finance",
  "EC/VC",
  "Private Equity",
  "Private Credit",
  "ECM",
  "DCM",
  "Lev Fin",
  "Arbitration",
  "Others",
];

const DOCX_TOOL_HINT = /\bYou MUST use the generate_docx tool[\s\S]*?(?=\n\nStructure|\n\nDeliver|\n\n[A-Z]|\n?$)/i;

function adaptAssistantPrompt(prompt = "") {
  return prompt
    .replace(DOCX_TOOL_HINT, "Produce the result inline unless the user explicitly asks for a downloadable file.")
    .replace(/Do not display the checklist inline[\s\S]*?provide the download link\.\n\n/i, "")
    .replace(/Generate the summary as a downloadable Word document\./gi, "Deliver the summary inline in the chat response.")
    .trim();
}

export function mikeAssistantWorkflows() {
  return MIKE_WORKFLOWS
    .filter((workflow) => workflow.type === "assistant" && workflow.prompt_md)
    .map((workflow) => ({
      id: `mike-${workflow.id}`,
      icon: "MK",
      title: workflow.title,
      blurb: `${workflow.practice || "Legal"} workflow imported from Mike.`,
      prompt: adaptAssistantPrompt(workflow.prompt_md),
      practice: workflow.practice || "General Transactions",
      source: "Mike",
      mikeWorkflow: workflow,
    }));
}

export function mikeTabularWorkflows() {
  return MIKE_WORKFLOWS
    .filter((workflow) => workflow.type === "tabular" && Array.isArray(workflow.columns_config))
    .map((workflow) => ({
      id: `mike-${workflow.id}`,
      title: workflow.title,
      blurb: `${workflow.columns_config.length} extraction columns for local tabular review.`,
      practice: workflow.practice || "General Transactions",
      source: "Mike",
      columns: workflow.columns_config
        .slice()
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .map((column, index) => ({
          index,
          name: column.name || `Column ${index + 1}`,
          format: column.format || "text",
          prompt: column.prompt || "",
          tags: column.tags || [],
        })),
      mikeWorkflow: workflow,
    }));
}

export const MIKE_TABULAR_PROMPT_PRESETS = [
  {
    name: "Parties",
    matches: /\bpart(y|ies)\b/i,
    format: "bulleted_list",
    prompt:
      "List all parties to this agreement. For each party, state their full legal name, entity type, and defined role. One party per bullet. No additional commentary.",
  },
  {
    name: "Governing Law",
    matches: /\bgoverning law\b|\bjurisdiction\b/i,
    format: "text",
    prompt:
      'State only the governing law of this agreement using the short-form jurisdiction name, e.g. "New York Law", "English Law", "Indian Law", "PRC Law". No other text.',
  },
  {
    name: "Effective Date",
    matches: /\beffective date\b/i,
    format: "date",
    prompt:
      'State only the effective date of this agreement in DD Mon YYYY format, e.g. "2 Jan 2026". If not explicitly stated, write "Not specified".',
  },
  {
    name: "Term",
    matches: /\bterm\b|\bduration\b/i,
    format: "text",
    prompt:
      'State only the duration or term of this agreement in a concise form, e.g. "3 years", "24 months", "perpetual". No other text.',
  },
  {
    name: "Termination",
    matches: /\bterminat(e|ion|ing)\b/i,
    format: "text",
    prompt:
      "Extract the termination provisions. State who may terminate, the trigger events, required notice period, any cure period, and the key consequences of termination. Be concise.",
  },
  {
    name: "Change of Control",
    matches: /\bchange of control\b/i,
    format: "text",
    prompt:
      "Identify any change of control provisions. Summarize the trigger events, consequences, consent requirements, and any related termination or acceleration rights. Be concise.",
  },
  {
    name: "Confidentiality",
    matches: /\bconfidential(ity)?\b|\bnon-?disclosure\b/i,
    format: "text",
    prompt:
      "Summarize the confidentiality obligations: scope of confidential information, permitted disclosures, use restrictions, duration, and key carve-outs or exceptions.",
  },
  {
    name: "Assignment",
    matches: /\bassign(ment|ability)?\b/i,
    format: "yes_no",
    prompt: "Is assignment of this agreement permitted without the other party's consent?",
  },
  {
    name: "Payment & Fees",
    matches: /\bpayment\b|\bfees?\b/i,
    format: "text",
    prompt:
      'State the key payment obligations concisely: amount, timing, and currency, e.g. "USD 10,000 payable within 30 days of invoice". Note any late payment consequences.',
  },
  {
    name: "Amendment",
    matches: /\bamendment\b|\bvariation\b/i,
    format: "text",
    prompt:
      "Summarize the amendment provisions: how amendments may be made, who must consent, and any formality requirements such as writing or signature.",
  },
  {
    name: "Indemnity",
    matches: /\bindemni(ty|ties|fication)\b/i,
    format: "text",
    prompt:
      "Summarize the indemnity provisions: who indemnifies whom, the scope of indemnified losses, any liability caps or exclusions, and key claims procedures.",
  },
  {
    name: "Warranties",
    matches: /\bwarrant(y|ies|ing)\b|\brepresentations?\b/i,
    format: "text",
    prompt:
      "Identify and describe key representations and warranties provided by any party, including scope, time periods, conditions, and any non-standard warranties.",
  },
  {
    name: "Force Majeure",
    matches: /\bforce majeure\b/i,
    format: "yes_no",
    prompt: "Does this agreement contain a force majeure clause?",
  },
];

export function getMikeColumnPreset(title) {
  const trimmed = title.trim();
  if (!trimmed) return null;
  const preset = MIKE_TABULAR_PROMPT_PRESETS.find(({ matches }) => matches.test(trimmed));
  if (!preset) {
    return {
      format: "text",
      prompt:
        `Review the document and extract the information relevant to "${trimmed}". ` +
        `Include key facts, dates, thresholds, parties, and conditions where applicable. ` +
        `If the document does not contain relevant information, return "Not addressed".`,
    };
  }
  return { prompt: preset.prompt, format: preset.format, tags: preset.tags || [] };
}
