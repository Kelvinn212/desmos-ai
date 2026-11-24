# Desmos AI — Graphing Calculator & Smart Math Workspace

A minimalist, web-based graphing calculator inspired by Desmos, enhanced with dual-mode AI math solving, a local multi-image reference viewer, real-time collaborative room chat, and tablet-ready touch controls.

---

## Key Features

### 1. Dual-Mode AI Math Solver (Groq API)
- **Inline Quick Solver (Left Expression Panel):** Type short or closed-ended math questions directly into expression rows to get instant, concise single-line answers.
- **Detailed AI Chat View (Graph Settings → Sparkle Icon):** Open a dedicated multi-turn AI chat inside the Graph Settings popover for open-ended problems, step-by-step explanations, and follow-up questions.
- **Bring Your Own Key (BYOK):** Uses your personal Groq API key and preferred model (e.g., `openai/gpt-oss-120b`), stored securely in your browser's `localStorage` so it never leaks in the repository.

### 2. Real-Time Collaborative Room Chat (Supabase)
- Built-in room-based live chat accessible via the **Chat icon** inside the Graph Settings popover.
- Powered by **Supabase Realtime** for instant message syncing across devices.
- Subtle unread indicator on the settings icon when new messages arrive.

### 3. Multi-Image Reference Viewer
- Upload and view reference images directly inside the Graph Settings popover.
- Persists images locally using **IndexedDB** so they remain available across reloads.
- Supports smooth **mouse-wheel zoom**, **single-finger drag-to-pan**, and **two-finger pinch-to-zoom** on touchscreens.

### 4. Two-Tier Quick-Hide & Redirect Shortcuts
Designed to prevent accidental triggers (single `Esc` presses are completely disabled) while giving instant workspace control on both desktop and tablets:

| Action | Desktop Shortcut | Tablet / Touch Gesture | Behavior |
| :--- | :--- | :--- | :--- |
| **Tier 1: Quick Hide** | Double-tap `Shift` *(within 400ms)* | Double-tap top-right **`?`** icon | Immediately closes the popover, hides inline AI output, and clears unread indicators. Keeps all images, chat rooms, and keys intact. |
| **Tier 2: Instant Redirect** | Triple-press `Esc` *(within 800ms)* | Triple-tap top-left **Folder** icon | Immediately replaces the current page with the official [desmos.com/calculator](https://www.desmos.com/calculator) via `window.location.replace` without deleting saved API keys, images, or settings. |

### 5. Tablet & Mobile Responsive Design
- Viewport-aware popover sizing (`min(320px, 84vw)` × `min(396px, 62dvh)`) that keeps the graph unobstructed on tablets.
- Virtual keyboard-safe layout (`dvh` / `visualViewport`) so chat inputs stay visible when typing on iPad/Android tablets.

---

## Tech Stack
- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **AI Engine:** Groq API (user-configured model & key)
- **Realtime Backend:** Supabase (PostgreSQL + Realtime)
- **Local Storage:** `IndexedDB` (images) & `localStorage` (API config & preferences)

---

## Getting Started

### 1. Clone & Install
```bash
git clone [https://github.com/](https://github.com/)<your-username>/<your-repo-name>.git
cd <your-repo-name>
npm install
