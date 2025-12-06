# Peekdown

A lightweight Electron viewer that renders markdown files with mermaid diagram support. Optimized for quick file inspection, not editing.

## Features

- Renders markdown with GitHub-style typography
- Renders mermaid code blocks as SVG diagrams
- Light/dark theme via system preference
- PDF export (Letter size, auto-scaled diagrams)
- Keyboard shortcuts: `Escape` or `Cmd+W` to close

## Installation

```bash
git clone https://github.com/starfysh-tech/peekdown.git
cd peekdown
yarn install
yarn link
```

## Usage

```bash
# View markdown file
peekdown ./path/to/file.md

# Export to PDF
peekdown ./path/to/file.md --pdf output.pdf
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

## Roadmap

- [ ] Homebrew formula for easier installation
- [ ] Standalone macOS app (.dmg)
