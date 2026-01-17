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

## Quick Look (macOS 14+)

Peekdown bundles a Quick Look extension for rendering Markdown (including mermaid) in Finder previews.

```bash
# Build the helper app + extension
yarn build:quicklook
```

On first launch, Peekdown will prompt to move into `/Applications` or `~/Applications` and register the Quick Look extension.
Quick Look extensions require a Developer ID Application signature to load outside of Xcode.
For startup telemetry, launch with `PEEKDOWN_QL_DEBUG=1` or `--ql-debug` and check `~/Library/Application Support/Peekdown/quicklook-telemetry.json`.
For Quick Look extension telemetry, enable `QLDebug` and check the extension cache log:
`defaults write com.peekdown.app.quicklook-host.quicklook QLDebug -bool YES`
then open Quick Look and review `~/Library/Containers/com.peekdown.app.quicklook-host.quicklook/Data/Library/Caches/quicklook-extension.log`.

### Notarization

Set these values in `.env` before running `yarn build:mac` (API key or Apple ID):

```
NOTARY_KEY_ID=...
NOTARY_ISSUER_ID=...
NOTARY_KEY_PATH=/absolute/path/to/AuthKey_XXXX.p8
NOTARY_TEAM_ID=A3KNB5VZH2
NOTARY_APPLE_ID=...
NOTARY_APP_PASSWORD=...
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
