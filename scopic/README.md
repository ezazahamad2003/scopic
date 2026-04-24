# Scopic

> Scopic is a local-first legal AI assistant powered by Ollama

![Screenshot placeholder](docs/screenshot.png)

Scopic wraps Ollama (running Phi-3 Mini) in a beautiful ChatGPT-style desktop interface built specifically for lawyers, paralegals, and legal professionals. All processing happens locally on your machine — no data leaves your device.

---

## Download

Download the latest installer from the [Releases](../../releases) page.

- **Windows**: `Scopic-Setup-1.0.0.exe` (~50-70 MB)

---

## Prerequisites

1. **Ollama** — Install from [ollama.ai](https://ollama.ai)
2. **Phi-3 Mini model** — After installing Ollama, run:
   ```bash
   ollama pull phi3
   ```
3. **Hardware minimum**: GTX 1650 (4GB VRAM) or equivalent, 8GB RAM

---

## For Developers

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/scopic.git
cd scopic
npm install
npm run dev
```

### Build Windows Installer

```bash
npm run build:win
```

The `.exe` installer will be in `dist/`.

---

## Changing Models

1. Click the **Settings** icon in the sidebar
2. Select a different model from the dropdown (models pulled via Ollama appear here)
3. Save settings

To pull a new model:
```bash
ollama pull mistral
ollama pull llama3
```

---

## Roadmap

- [x] ChatGPT-style streaming interface
- [x] Persistent conversation history
- [x] Legal system prompt (IRAC-aware)
- [x] Settings: model, temperature, Ollama URL
- [x] Windows .exe installer
- [ ] RAG: drag-drop PDF/DOCX files into chat
- [ ] Conversation export (PDF/Markdown)
- [ ] Legal prompt profiles (Corporate, Criminal, IP, Contract)
- [ ] Citation links to Google Scholar / CourtListener
- [ ] Model manager (pull/delete models in-app)
- [ ] Prompt templates panel
- [ ] Dark/light theme toggle
- [ ] Keyboard shortcuts
- [ ] Token counter
- [ ] Auto-update via electron-updater

---

## Contributing

Contributions are welcome! Please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit --trailer "Made-with: Cursor" -m "feat: add amazing feature"`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT — see [LICENSE](LICENSE) for details.
