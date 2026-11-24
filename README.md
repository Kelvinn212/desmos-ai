# Desmos Graphing Calculator (Hybrid Stealth Edition)

A pixel-accurate clone of the **Desmos Graphing Calculator** built with **React**, **TypeScript**, **Tailwind CSS**, **KaTeX**, and **Vite**, powered by the official **Desmos Graphing Calculator JS API** for 100% authentic coordinate grid, pan/zoom physics, and curve plotting.

## Features

1. **Authentic Desmos UI & Official Graphing Engine**
   - Official Desmos JS API (`expressions: false`, `settingsMenu: false`, `zoomButtons: false`, `border: false`) synced live with the custom expression sidebar via `setExpression()`, `removeExpression()`, `HelperExpression()`, and `expressionAnalysis`.
   - Classic dark charcoal top header (`#2b2b2b`), resizable/collapsible left expression sidebar with Undo/Redo and Edit List color picker, KaTeX math typesetting, bottom-left virtual keypad, and top-right floating Wrench & `+`/`-`/Home zoom controls.

2. **Dual-Purpose Expression Rows (Math + Stealth Inline AI)**
   - **Normal Math Mode**: Type standard expressions (`y = x^2`, `sin(x)`, `2x + 5 = 11`, `145 * 18`) to plot curves or evaluate inline (`= 2610`).
   - **Stealth Inline AI Mode**: Automatically detects natural language prompts (or explicit `?` prefix) and queries **Gemini API** or **OpenAI-compatible** endpoints on `Enter`. Renders concise answers directly beneath the input inside the same expression row using native Desmos evaluation typography—no chat bubbles, avatars, or AI badges.

3. **Discreet Multi-Image Viewer (Wrench Popover)**
   - Clicking the top-right **Wrench** icon opens a compact fixed-size (`320px` wide × `396px` height, `< 420px` max) popover containing exclusively the discreet image viewer.
   - Upload via **File Picker**, **Drag & Drop**, or **Clipboard Paste (`Cmd+V` / `Ctrl+V`)**.
   - Cursor-centered mouse wheel / trackpad pinch zoom, `+/-` controls, click-and-drag panning, `< 1 / N >` multi-image pagination, and persistent local storage in **IndexedDB**.

4. **Two-Tier Panic System (Preserves All Saved Data & Keys)**
   - **Single `Escape`**: Disabled as a panic trigger to prevent accidental activations.
   - **Tier 1 — Quick Hide** (`Double-Tap Shift` within 400ms OR `Double-Tap Top-Right Help (?) Icon`): Immediately closes the Wrench popover, hides visible inline AI outputs with decoy equations, and stops the green unread chat pulse without deleting any images, chat state, or settings.
   - **Tier 2 — Instant Official Desmos Redirect** (`Triple-Press Escape` within 800ms OR `Triple-Tap Top-Left Folder Icon`): Immediately redirects via `window.location.replace("https://www.desmos.com/calculator")` while keeping all API keys, `localStorage` config, chat rooms, and `IndexedDB` images intact.

5. **Hidden Configuration Modal**
   - **Triple-click** the centered `desmos` wordmark in the top header to configure AI provider/API key/model, trigger mode, system prompt, decoy equations, and IndexedDB image cache.

## Quick Start

```bash
npm install
npm run dev
```
