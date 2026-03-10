# Ai Overlay

Ai Overlay is an open-source, local-first desktop application that provides a AI assistant overlaid directly on your screen. Seamlessly capture screenshots or text and send them to your favorite AI models (Cloud-based or Local) using global keyboard shortcuts.

![Ai Overlay Banner](https://raw.githubusercontent.com/tauri-apps/tauri/dev/.github/tauri-logo-light.png) *Draft Image Placeholder*

## 🌟 Key Features

- **Glassmorphic UI**: A stunning, frosted-glass interface that floats over your workspace.
- **Global Shortcuts**:
  - `Ctrl + Shift + C`: Programmatically copy selected text and open the AI prompt.
  - `Ctrl + Shift + S`: Freeze the screen to capture specific regions for vision analysis.
- **Multi-Provider Support**: 
  - **Cloud**: OpenAI (GPT-4o), Anthropic (Claude 3.5 Sonnet), Gemini (1.5 Pro).
  - **Local**: `llama.cpp` sidecar integration for running GGUF models (like Qwen2.5-VL/Qwen3-VL) completely offline.
- **Modular Architecture**: Unified AI interface for seamless switching between local and cloud models without code duplication.
- **Privacy First**: Securely store API keys using `Tauri Stronghold` (encrypted on-disk storage).
- **Click-Through Mode**: "Pin" the assistant to keep it visible while you work, with mouse ignore capability.

## 🏗️ Architecture & Tech Stack

- **Backend**: [Tauri v2](https://v2.tauri.app/) (Rust)
- **Frontend**: [SvelteKit](https://kit.svelte.dev/) + [TailwindCSS](https://tailwindcss.com/)
- **Local Inference**: [llama.cpp](https://github.com/ggerganov/llama.cpp) (packaged as a Native Sidecar)
- **Security**: `tauri-plugin-stronghold` for encrypted credential management.
- **Automation**: `enigo` for key simulation and `xcap` for screen capture.

## 🚀 Installation & Development

### Prerequisites
- [Rust](https://www.rust-lang.org/tools/install)
- [Node.js](https://nodejs.org/)
- [Tauri CLI](https://v2.tauri.app/reference/cli/)

### Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/aioverlay.git
   cd aioverlay
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run in development mode:
   ```bash
   npm run tauri dev
   ```

## 🗺️ Roadmap

### Phase 1: Foundation (Current)
- [x] Initial Tauri + Svelte setup.
- [x] Integration of core plugins (Global Shortcuts, Stronghold, FS, etc.).
- [ ] Implement Window Transparency & Logic (Glassmorphism).
- [ ] Setup unified `AIService` abstraction for multi-provider support.

### Phase 2: AI Core
- [ ] Integrate Cloud APIs (OpenAI, Anthropic, Gemini).
- [ ] Implement `llama.cpp` sidecar lifecycle management.
- [ ] Local model downloader UI with progress tracking.

### Phase 3: Interaction & Vision
- [ ] Implement Text Capture flow (`simulate_copy`).
- [ ] Implement Screen Capture flow (`xcap` integration).
- [ ] Add Markdown rendering with syntax highlighting.
- [ ] Implement "Pin" & "Click-Through" modes.

### Phase 4: Polish & Performance
- [ ] Add Chat History persistence.
- [ ] Web Search integration (Real-time context).
- [ ] Performance optimization for local inference (VRAM management).
- [ ] Cross-platform build testing (Windows/macOS).

## 🛡️ Security

This app uses **Tauri Stronghold** to store sensitive information. Your API keys never leave your device and are stored in an encrypted database managed by the OS user permissions.

## 📄 License

MIT License. See [LICENSE](LICENSE) for more details.
