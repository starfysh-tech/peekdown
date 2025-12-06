# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Peekdown is a lightweight Electron viewer that renders markdown files with mermaid diagram support. Optimized for quick file inspection, not editing.

## Development Commands

```bash
# Install dependencies
npm install

# Start development (with markdown file)
npm start -- ./path/to/file.md

# Build for macOS
npm run build:mac
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Electron                      │
├──────────────────┬──────────────────────────────┤
│   Main Process   │      Renderer Process        │
│                  │                              │
│  - File I/O      │  - markdown-it parsing       │
│  - Window mgmt   │  - mermaid rendering         │
│  - CLI args      │  - DOM injection             │
│  - IPC bridge    │  - Theme detection           │
└──────────────────┴──────────────────────────────┘
```

**File Structure:**
- `src/main.js` - Electron main process (CLI args, window, IPC)
- `src/preload.js` - Context bridge for IPC (exposes electronAPI)
- `src/renderer.js` - Markdown + mermaid rendering pipeline
- `src/index.html` - App shell
- `assets/github-markdown.css` - GitHub-style markdown CSS
- `assets/app.css` - Theme variables and custom styles

**Rendering Pipeline:**
1. Main process reads markdown file from CLI arg
2. Content sent to renderer via IPC
3. markdown-it parses content (custom fence for mermaid blocks)
4. DOMPurify sanitizes HTML output
5. HTML injected into DOM
6. mermaid.run() converts divs to SVG

**Security:**
- `contextIsolation: true` / `nodeIntegration: false`
- DOMPurify sanitizes all markdown output
- Mermaid `securityLevel: 'strict'`
