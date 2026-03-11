# Ai Overlay

Open-source desktop AI assistant that overlays your screen. Capture screenshots or text and send them to cloud or local AI models via global shortcuts.

Built with **Tauri v2** (Rust) + **SvelteKit** (Svelte 5) + **TailwindCSS v4** + **TypeScript**.

## Features

- **Multi-provider AI** — OpenAI, Anthropic, Gemini (cloud) and llama.cpp (local, GPU auto-detection)
- **Screen capture** — Freeze screen, select region, send to vision models
- **Text capture** — Copy selected text from any app directly into the prompt
- **Ephemeral chat** — Conversations that are never written to disk (toggleable)
- **Encrypted storage** — API keys via Stronghold vault, chat history via AES-256-GCM
- **Auto-updater** — In-app update notifications with download progress
- **Glassmorphic UI** — Transparent, borderless window with frosted-glass theme

## Shortcuts

| Shortcut | Action                            | Type   |
| -------- | --------------------------------- | ------ |
| `Alt+C`  | Capture selected text into prompt | Global |
| `Alt+S`  | Screenshot region selector        | Global |
| `Alt+A`  | Show / restore window             | Global |
| `Ctrl+N` | New conversation                  | App    |
| `Ctrl+H` | Toggle chat history               | App    |
| `Ctrl+,` | Toggle settings                   | App    |

**Global** shortcuts work system-wide (even when the app is not focused).  
**App** shortcuts only work when the app window is focused.  
All shortcuts are customizable in **Settings → Shortcuts**.

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Node.js](https://nodejs.org/) (v18+)

## Setup

```bash
git clone https://github.com/crony-io/aioverlay.git
cd aioverlay
npm install
```

## Development

```bash
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

Release binaries are output to `src-tauri/target/release/bundle/`.

## Lint & Check

```bash
npm run lint        # ESLint
npm run check       # svelte-check (TypeScript)
npm run format      # Prettier
```

## Project Structure

```
src/                        # SvelteKit frontend
├── routes/                 # Single SPA page (+page.svelte)
├── lib/
│   ├── components/         # Reusable Svelte 5 components
│   ├── services/
│   │   ├── ai/             # Provider abstraction (OpenAI, Anthropic, Gemini, Local)
│   │   ├── local/          # llama.cpp server & model management
│   │   ├── shortcuts/      # Global shortcut registration
│   │   ├── updater/        # Auto-update service
│   │   ├── markdown/       # Marked + Shiki renderer
│   │   └── crypto/         # AES-256-GCM chat encryption
│   ├── stores/             # Chat state & AI streaming
│   └── utils/              # Shared utilities
src-tauri/                  # Rust backend
├── src/
│   ├── lib.rs              # Plugin registration & command handlers
│   ├── ai_proxy.rs         # Secure HTTP proxy (keys never leave Rust)
│   ├── capture.rs          # Screen capture (xcap)
│   ├── input.rs            # Key simulation (enigo)
│   └── llama/              # Local inference (download, process, models, platform)
├── capabilities/           # Tauri permission configs
└── Cargo.toml
```

## Security

- **API keys** are stored in a Stronghold encrypted vault — never exposed to the webview or network inspector
- **Chat history** is encrypted at rest with AES-256-GCM using a per-install derived key
- **AI requests** route through a Rust HTTP proxy; keys are injected server-side
- **CSP** restricts the webview to `self` and local llama-server addresses only

## License

MIT — see [LICENSE](LICENSE).
