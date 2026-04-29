# Scopic v1 - Legal AI Desktop App

## Background and Motivation
Build "Scopic v1" — an open-source Electron desktop app wrapping Ollama (Phi-3 Mini Q4) with a ChatGPT-style interface designed for lawyers. Users have Ollama pre-installed. App ships as a .exe installer.

## Key Challenges and Analysis
- **CORS**: Solved by routing all Ollama API calls through Electron main process (IPC)
- **Streaming**: NDJSON stream from Ollama parsed in main process, tokens relayed to renderer via IPC
- **Persistence**: electron-store (JSON file) for conversations and settings, no database needed
- **Packaging**: electron-builder NSIS for one-click Windows installer
- **Custom titlebar**: frameless window + manual window controls in renderer

## High-level Task Breakdown

### Phase 1: Project Scaffolding
- [x] package.json with all dependencies and scripts
- [x] vite.config.js (React renderer build)
- [x] tailwind.config.js + postcss.config.js
- [x] .gitignore, LICENSE (MIT), README.md

### Phase 2: Electron Main Process
- [x] src/main/index.js (BrowserWindow, IPC handlers, electron-store)
- [x] src/main/preload.js (contextBridge exposing ollama + store APIs)

### Phase 3: React Renderer
- [x] src/renderer/index.html
- [x] src/renderer/main.jsx
- [x] src/renderer/App.jsx
- [x] src/renderer/index.css (Tailwind + custom styles)

### Phase 4: Utilities
- [x] utils/constants.js (LEGAL_SYSTEM_PROMPT, SUGGESTION_CARDS)
- [x] utils/storage.js (electron-store wrapper)
- [x] utils/markdown.js (lightweight markdown renderer)

### Phase 5: Hooks
- [x] hooks/useOllama.js (connection check, models, settings)
- [x] hooks/useChat.js (conversation state, streaming, IPC)

### Phase 6: Components
- [x] components/Sidebar.jsx
- [x] components/ChatArea.jsx
- [x] components/MessageBubble.jsx
- [x] components/InputBar.jsx
- [x] components/WelcomeScreen.jsx
- [x] components/SettingsModal.jsx

### Phase 7: Install & Verify
- [ ] npm install
- [ ] npm run dev (verify dev mode works)
- [ ] npm run build:win (verify .exe builds)

## Project Status Board

### Completed
- [x] All source files generated

### In Progress
- [ ] npm install + dev mode verification

### Pending
- [ ] Build .exe installer
- [ ] Push to GitHub

## Executor Feedback or Assistance Requests
All source files have been generated. Ready for npm install and dev mode testing.

## Lessons
- Use PowerShell here-strings (@' ... '@) for writing files with special characters on Windows
- Use semicolons (;) instead of && for chaining PowerShell commands
- electron-store v8 uses CommonJS require() not ESM import in main process
- Vite root must point to src/renderer, outDir to ../../dist-renderer
- electron-builder "files" must include dist-renderer for packaged app
