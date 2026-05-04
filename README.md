# Scopic - Legal AI Assistant

Scopic is a free AI assistant built for lawyers and legal professionals.

- **Local-first by default** — runs Ollama on your machine, no data leaves your computer
- **Optional cloud providers** — bring your own API key for Anthropic Claude, OpenAI, or Google Gemini
- **One UI for all providers** — switch between local and frontier models from Settings

---

## For Lawyers: Getting Started

### Step 1 — Download and Install Ollama

Ollama is the engine that runs the AI model locally on your computer.

1. Go to **[ollama.com/download](https://ollama.com/download)**
2. Download the Windows installer and run it
3. Ollama will install and run automatically in the background

### Step 2 — Download the AI Model

Open **Command Prompt** (search for "cmd" in the Start menu) and run:

```
ollama pull phi3
```

This downloads the AI model (~2.2 GB). Wait for it to finish before continuing.

> **Recommended models by computer speed:**
> - Standard computer (no dedicated GPU): `phi3` (default, 2.2 GB)
> - Computer with NVIDIA GPU: `mistral` (4.1 GB) — much faster responses

### Step 3 — Download and Install Scopic

1. Go to the [**Releases page**](https://github.com/ezazahamad2003/scopic/releases)
2. Download the latest `Scopic-Setup.exe`
3. Run the installer — it creates a desktop shortcut automatically

### Step 4 — Start Using Scopic

1. Make sure Ollama is running (it runs in the background after installation)
2. Open Scopic from your desktop shortcut
3. A green dot in the bottom-left means the AI is ready
4. Type your legal question or click one of the suggestion cards to get started

> **No Node.js, npm, or developer tools required.** The installer includes everything.

---

## Features

- **Multi-provider** — pick Ollama (local), Anthropic Claude, OpenAI, or Google Gemini
- **Local-first** — Ollama is the default; no data leaves your machine in that mode
- **API keys stay local** — provider keys are stored in your OS user data directory and only sent to the provider you're calling
- **Legal-focused AI** — pre-configured system prompts (general legal Q&A and contract review with IRAC analysis)
- **Document Vault** — upload PDFs/DOCXs and analyze them in chat
- **Chat history** — all conversations saved locally
- **Multiple conversations** — create, switch between, delete
- **Auto-update** — installer updates ship via GitHub Releases

---

## System Prompt

Scopic uses the following system prompt to tune the AI for legal work:

```
You are Scopic, a legal AI assistant designed for lawyers, paralegals, and legal professionals.
You provide thoughtful, well-structured legal analysis and information.

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
- Always recommend consulting with a qualified attorney for specific cases.
```

To modify it, edit `scopic/src/renderer/utils/constants.js`.

---

## Changing the AI Model

1. Open Command Prompt and pull the model you want: `ollama pull mistral`
2. Open Scopic and click the gear icon (bottom-left corner)
3. Select the new model from the dropdown and save

---

## Troubleshooting

**"Ollama offline" shown in the app**
- Open Command Prompt and run: `ollama serve`
- Restart Scopic

**Responses are very slow**
- Normal on computers without a dedicated GPU. `phi3` takes 30-60 seconds per response on CPU-only machines.
- For faster responses: `ollama pull tinyllama` and switch to it in Settings

**No response appears after waiting**
- Verify a model is installed: open Command Prompt, run `ollama list`
- Make sure the model name in Scopic Settings matches exactly what `ollama list` shows

---

## For Developers: Running from Source

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or later
- [Ollama](https://ollama.com/download) installed and running

### Setup

```bash
git clone https://github.com/ezazahamad2003/scopic.git
cd scopic/scopic
npm install
ollama pull phi3
npm run dev
```

### Build Windows Installer

```bash
npm run build:win
```

The installer is created in the `dist/` folder.

---

## Tech Stack

- **Electron** — cross-platform desktop app
- **React + Vite** — UI
- **Tailwind CSS** — styling
- **Ollama** — local AI model runner (default)
- **Anthropic / OpenAI / Gemini** — optional cloud providers (BYO key)
- **electron-store** — local conversation + settings persistence

## Using a Cloud Provider

1. Open Scopic → click the gear icon (bottom-left).
2. Pick your provider (Anthropic, OpenAI, or Gemini).
3. Paste your API key. Keys stay on your machine — they're written to your OS user-data directory and only sent to the provider you're calling.
4. Pick a model from the dropdown (live-fetched from the provider) and Save.

You can switch providers at any time without losing chat history.

---

## License

**AGPL-3.0-or-later.** As of v1.6.0, Scopic is licensed under the GNU Affero General Public License v3.0. The full text is in [scopic/LICENSE](scopic/LICENSE).

What this means in practice:
- You can use, modify, and distribute Scopic freely.
- If you distribute a modified version (or run one as a network service), you must publish your source under the same license.
- Earlier releases (v1.5.5 and prior) remain available under the MIT terms they shipped with.
