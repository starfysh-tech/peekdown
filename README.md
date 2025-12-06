# Peekdown

A lightweight Electron viewer that renders markdown files with mermaid diagram support. Optimized for quick file inspection, not editing.

## Features

- Renders markdown with GitHub-style typography
- Renders mermaid code blocks as SVG diagrams
- Light/dark theme via system preference
- Single window, minimal chrome
- Keyboard shortcuts: `Escape` or `Cmd+W` to close

## Installation

```bash
npm install
```

## Usage

```bash
# Development
npm start -- ./path/to/file.md

# After packaging
peekdown ./path/to/file.md
```

## Building

```bash
# Build for macOS
npm run build:mac
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Escape | Close window |
| Cmd+W | Close window |
| Cmd+Q | Quit app |

## Tech Stack

- Electron
- markdown-it
- mermaid
- DOMPurify
