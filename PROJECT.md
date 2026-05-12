# Scopic Project Brief

Scopic is an open-source, local-first legal AI assistant for lawyers, paralegals, and legal professionals. The product should feel practical, trustworthy, and polished: fast legal workflows, clear document review, model choice in the chat flow, and privacy-first defaults.

## Product Direction

- Build for working lawyers, not hobby demos.
- Keep Ollama/local use first-class, with optional BYO API keys for Anthropic, OpenAI, and Gemini.
- Treat open-source legal tooling as part of the value, not only API-key chat.
- Prefer workflows that save lawyer time: contract review, issue spotting, redline support, checklists, summaries, tabular review, and document-grounded analysis.
- UI should feel light, calm, and professional, closer to Claude/Codex than a generic dark chatbot.

## Current Architecture

- Desktop app: Electron.
- Renderer: React + Vite.
- Styling: Tailwind CSS plus component-level CSS.
- Local model runtime: Ollama.
- Cloud providers: Anthropic, OpenAI, Gemini.
- Persistence: electron-store.
- Auto-update/release: GitHub Releases with `latest.yml`, installer, and blockmap assets.

## Important Paths

- App source: `scopic/`
- Renderer components: `scopic/src/renderer/components/`
- Shared renderer constants and legal prompts: `scopic/src/renderer/utils/constants.js`
- Package version and release metadata: `scopic/package.json`
- GitHub release workflow: `.github/workflows/`

## Release Rules

- Before releasing, check the latest GitHub release tag.
- Bump the patch version from the current latest release unless a larger version is explicitly requested.
- For Windows auto-update, the release must include:
  - `latest.yml`
  - `Scopic.Setup.<version>.exe`
  - `Scopic.Setup.<version>.exe.blockmap`
- After tagging, verify the GitHub Actions release workflow completes successfully and that GitHub reports the new tag as the latest release.

## Development Notes

- Preserve local user files under `.claude/`, `.cursor/`, and other personal tooling directories unless the user explicitly asks to change them.
- Keep changes scoped and avoid unrelated refactors.
- Use existing app patterns before adding new abstractions.
- Verify UI changes with a local build, and use the browser when checking visual behavior.
- For legal features, write copy with precision and jurisdiction awareness.

## Recent Direction

- `v1.8.3` shipped UI polish, expanded model options, in-chat model selection, and additional legal workflow entry points.
- Future improvements should continue tightening the lawyer workflow: less settings-hunting, more context-aware actions directly inside chat and document review.
