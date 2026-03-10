# Ai Overlay

Ai Overlay is an open-source, local-first desktop Tauri application that provides a AI assistant overlaid directly on your screen. Seamlessly capture screenshots or text and send them to your favorite AI models (Cloud-based or Local) using global keyboard shortcuts.

## 🌟 Key Features

- **Glassmorphic UI**: A stunning, frosted-glass interface that floats over your workspace.
- **Global Shortcuts**:
  - `Ctrl + Shift + C`: Programmatically copy selected text and open the AI prompt.
  - `Ctrl + Shift + S`: Freeze the screen to capture specific regions for vision analysis.
- **Multi-Provider Support**:
  - **Cloud**: OpenAI, Anthropic, Gemini, and more providers soon.
  - **Local**: `llama.cpp` runtime download with GPU variant auto-detection for running GGUF models completely offline.
- **Modular Architecture**: Unified AI interface for seamless switching between local and cloud models without code duplication.
- **Privacy First**: Securely store API keys using `Tauri Stronghold` (encrypted on-disk storage).
- **Click-Through Mode**: "Pin" the assistant to keep it visible while you work, with mouse ignore capability.

## 🏗️ Architecture & Tech Stack

- **Backend**: [Tauri v2](https://v2.tauri.app/) (Rust)
- **Frontend**: [SvelteKit](https://kit.svelte.dev/) + [TailwindCSS](https://tailwindcss.com/)
- **Local Inference**: [llama.cpp](https://github.com/ggml-org/llama.cpp) (runtime download with GPU variant auto-detection)
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

## 🛡️ Security

This app uses **Tauri Stronghold** to store sensitive information. Your API keys never leave your device and are stored in an encrypted database managed by the OS user permissions.

## 📄 License

MIT License. See [LICENSE](LICENSE) for more details.
