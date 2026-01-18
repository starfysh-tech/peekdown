# Repository Guidelines

## Project Structure & Module Organization
- `src/main.js` is the Electron main process: CLI args, file I/O, window setup, IPC.
- `src/renderer.js` handles markdown parsing, mermaid rendering, and theme sync.
- `src/preload.js` exposes a safe IPC bridge via `contextBridge`.
- `src/index.html` and `assets/app.css` define the renderer shell and styling.
- `bin/peekdown.js` is the CLI entry point; `dist/` holds build artifacts.

## Build, Test, and Development Commands
- `yarn install` installs dependencies.
- `yarn start -- ./file.md` launches the app to view a markdown file.
- `yarn start -- ./file.md --pdf out.pdf` exports a PDF.
- `yarn build` packages the app with `electron-builder`.
- `yarn build:mac` creates a notarized macOS `.dmg` after building the Quick Look helper.

## Coding Style & Naming Conventions
- JavaScript uses `snake_case` for functions and variables (e.g., `render_content`).
- CSS classes use `kebab-case` (e.g., `markdown-body`).
- IPC channel names use `kebab-case` (e.g., `file-content`).
- Use CSS variables for all colors in `assets/app.css` (`:root` and `.theme-dark`).
- Keep `contextIsolation: true` and `nodeIntegration: false` in Electron config.

## Testing Guidelines
- No automated test suite is currently configured.
- If you add tests, prefer colocating them under a new `tests/` directory and
  document how to run them in `package.json` scripts.

## Commit & Pull Request Guidelines
- Recent commits use an emoji + type prefix: `✨ feat: ...`, `🐛 fix: ...`,
  `🔖 chore: ...`. Follow the same pattern.
- PRs should include a concise description, reproduction steps (if a bug fix),
  and screenshots or a short GIF for UI changes.
- Link related issues when applicable.

## Security & Configuration Tips
- Sanitize all HTML with DOMPurify before DOM injection.
- Keep mermaid `securityLevel: 'strict'`; do not enable click handlers.
- Add new IPC channels through `main.js` → `preload.js` → `renderer.js`.
- Quick Look extensions require Developer ID signing to load outside of Xcode.
