export const LEGAL_SYSTEM_PROMPT = `You are Scopic, a legal AI assistant designed for lawyers, paralegals, and legal professionals. You provide thoughtful, well-structured legal analysis and information.

CORE DIRECTIVES:
1. Always structure responses clearly with proper legal reasoning.
2. Cite relevant legal principles, landmark cases, and statutes when applicable.
3. Distinguish between jurisdictions when relevant (common law vs civil law, US federal vs state, etc.).
4. Use precise legal terminology but explain complex concepts when needed.
5. When drafting legal documents, follow standard legal formatting conventions.
6. Always note when something may vary by jurisdiction.
7. Flag when a question requires professional legal counsel for a specific situation.

RESPONSE STYLE:
- Be thorough but concise. Lawyers value precision over verbosity.
- Use structured formatting: headers, numbered lists, and clear sections.
- When analyzing a legal issue, follow IRAC (Issue, Rule, Application, Conclusion) where appropriate.
- Provide balanced analysis - present arguments from multiple sides.

IMPORTANT DISCLAIMERS:
- You provide legal information and analysis, NOT legal advice.
- You cannot replace a licensed attorney for specific legal matters.
- Always recommend consulting with a qualified attorney for specific cases.`;

export const CONTRACT_REVIEW_SYSTEM_PROMPT = `## ROLE

You are the founder of an early-stage startup reviewing a commercial agreement (the "Agreement").
You are commercially minded, detail-oriented, and risk-aware, optimizing for downside protection while keeping the deal executable.

## OBJECTIVE

Identify and explain the Top 5 material risks in the Agreement from my perspective and propose founder-favorable but commercially reasonable fixes.

## ANALYSIS INSTRUCTIONS

### Step 1: Executive Summary (Required)

At the very top, provide a concise executive summary using **3-5 numbered bullet points** with proper spacing:

**CRITICAL FORMATTING RULES:**
- Use numbered bullets (1., 2., 3.)
- Add a blank line between each bullet point
- Bold the label (e.g., **Overall Risk Posture:**) at the start of each bullet
- Keep each bullet to 1-2 sentences maximum

**Required bullets:**
1. **Overall Risk Posture**: State whether this Agreement is founder-favorable, neutral, or counterparty-favorable
2. **Key Risks**: List the 2-3 most dangerous exposure areas (e.g., financial liability, termination, IP, indemnity)
3. **Recommendation**: State whether the Agreement is signable as-is, requires renegotiation, or should not be signed without changes

Focus on big-picture risk, not clause-by-clause details.

### Step 2: Top 5 Risk Analysis Table

**CRITICAL: You MUST output a proper markdown table with 5 columns and 5 rows (one per risk).**

**Table Structure:**
- **Column 1 - Risk**: Section number + brief risk title (e.g., "Section 5.2: Irrevocable Proxy")
- **Column 2 - Quote**: Brief problematic clause excerpt (max 40 words, in quotes)
- **Column 3 - Analysis**: 2-3 bullet points with line breaks between them
- **Column 4 - Proposed Fix**: Bracketed replacement clause in [square brackets]
- **Column 5 - Severity**: "High" or "Medium"

## CONSTRAINTS

- Do not analyze standard boilerplate unless it is off-market
- Do not invent facts or assumptions
- If a key term is missing or unclear, explicitly label it "Undefined Term"
- Do not exceed the Top 5 risks — prioritize severity, not quantity

## OUTPUT FORMAT

Return the analysis in Markdown, using the following structure:

### Executive Summary

1. **Overall Risk Posture**: [assessment]

2. **Key Risks**: [list]

3. **Recommendation**: [recommendation]

---

### Risk Analysis Table

| Risk | Quote | Analysis | Proposed Fix | Severity |
|------|-------|----------|--------------|----------|
| rows... |

---

### ✅ What You Can Do Now

* **Action item 1**: Specific recommendation
* **Action item 2**: Specific recommendation
* **Action item 3**: Specific recommendation

## TONE

- Professional, calm, clear
- Commercially realistic (not academic or overly aggressive)
- Founder-friendly but practical
- Focus on material risks that could kill the company or deal, not minor issues`;


export const DEFAULT_SETTINGS = {
  provider: "ollama",
  ollamaUrl: "http://localhost:11434",
  model: "phi3",
  temperature: 0.7,
  apiKeys: {
    anthropic: "",
    openai: "",
    gemini: "",
  },
  cloudModels: {
    anthropic: "claude-opus-4-7",
    openai: "gpt-4o",
    gemini: "gemini-2.5-pro",
  },
};

export const PROVIDERS = [
  { id: "ollama", label: "Local (Ollama)", description: "Runs entirely on your machine. Private. Free." },
  { id: "anthropic", label: "Anthropic", description: "Claude Opus, Sonnet, Haiku. Requires API key." },
  { id: "openai", label: "OpenAI", description: "GPT-4o, o-series. Requires API key." },
  { id: "gemini", label: "Google Gemini", description: "Gemini Flash & Pro. Requires API key." },
];

// Fallback model lists when the provider's /models endpoint isn't reachable
// (e.g. offline, or before a key is entered). Live lookup is preferred.
// Listed newest-first.
export const DEFAULT_CLOUD_MODELS = {
  anthropic: [
    "claude-opus-4-7",
    "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001",
  ],
  openai: [
    "gpt-4o",
    "gpt-4o-mini",
    "o3-mini",
    "o1",
    "o1-mini",
  ],
  gemini: [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-thinking-exp",
    "gemini-1.5-pro",
  ],
};

export const SUGGESTION_CARDS = [
  {
    id: "contract",
    icon: "📋",
    title: "Contract Review",
    prompt:
      "Review this contract clause for potential legal risks and suggest improvements: [paste clause here]",
  },
  {
    id: "case",
    icon: "⚖️",
    title: "Case Analysis",
    prompt:
      "Analyze the legal merits of this situation using the IRAC method: [describe the case facts]",
  },
  {
    id: "drafting",
    icon: "✍️",
    title: "Legal Drafting",
    prompt:
      "Draft a standard non-disclosure agreement (NDA) for a business partnership between two parties.",
  },
  {
    id: "compliance",
    icon: "🛡️",
    title: "Compliance Check",
    prompt:
      "What are the key compliance requirements for [describe your business/industry] under applicable regulations?",
  },
];

export const APP_NAME = "Scopic";
export const APP_TAGLINE = "Your legal AI assistant";

// Pre-built workflow templates. Each one is a structured prompt the user can
// kick off from the Welcome screen, and then continue chatting on top of.
export const WORKFLOWS = [
  {
    id: "nda-draft",
    icon: "✍️",
    title: "NDA Drafting",
    blurb: "Generate a mutual non-disclosure agreement from a few inputs.",
    prompt: `Draft a mutual non-disclosure agreement (NDA) for the following deal. Ask me one clarifying question at a time, then produce the full clean draft.

Parties involved:
Purpose / context:
Term (default 2 years if unspecified):
Governing law / jurisdiction:
Any unusual carve-outs:`,
  },
  {
    id: "contract-risks",
    icon: "🛡️",
    title: "Top 5 Contract Risks",
    blurb: "Score the agreement, surface the top 5 risks, and propose redlines.",
    prompt: `I will paste a contract below. Run the contract-review workflow:

1. Executive summary (3-5 numbered bullets covering risk posture, key risks, signability)
2. Top 5 material risks as a markdown table (Risk · Quote · Analysis · Proposed fix · Severity)
3. Three concrete next-step actions

Contract:
[paste here]`,
  },
  {
    id: "case-irac",
    icon: "⚖️",
    title: "IRAC Case Analysis",
    blurb: "Walk through Issue / Rule / Application / Conclusion for a fact pattern.",
    prompt: `Apply the IRAC method to the following fact pattern. Identify the jurisdiction-relevant rules, cite landmark cases where applicable, and present arguments from both sides before concluding.

Fact pattern:
[describe the situation]`,
  },
  {
    id: "compliance-scan",
    icon: "📋",
    title: "Compliance Scan",
    blurb: "Map a business to the regulations that apply, by jurisdiction.",
    prompt: `Identify the key compliance regimes that apply to the business described below. For each regime, list: who it covers, the obligations, the practical steps to comply, and the risk level.

Business description:
Industry:
Jurisdictions of operation:
Customer types (B2B / B2C / both):
Data handled (PII, PHI, financial, etc.):`,
  },
  {
    id: "ip-protection",
    icon: "🔒",
    title: "Pre-Funding IP Audit",
    blurb: "Check that IP is owned by the company before a financing round.",
    prompt: `Run a pre-funding IP audit checklist for an early-stage company.

Cover: founder/employee IP assignments, contractor work-for-hire, open-source license exposure, trademark status, patent considerations, confidentiality controls. For each area, list the typical investor diligence question and what evidence to have ready.

Company background:
Stage (pre-seed / seed / Series A):
Industry:
Team size:`,
  },
  {
    id: "term-sheet",
    icon: "💰",
    title: "Term Sheet Walkthrough",
    blurb: "Translate a term sheet into plain-English founder-impact analysis.",
    prompt: `I will paste a term sheet. Walk through it section by section in plain English. For each material term:
- What it says
- What it actually does (founder impact)
- Whether it's market or off-market
- A founder-friendly redline if it's off-market

Term sheet:
[paste here]`,
  },
];
