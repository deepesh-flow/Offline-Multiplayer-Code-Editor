# 🎓 MultiCode Offline — Viva Notes & Interview Guide
> **Audience**: B.Tech CSE Freshers preparing for hackathon judge questions (15% Viva weightage).
> **Rule of thumb**: Keep your answers simple, confident, and relate back to our architecture.

---

## 🌟 1. The Core Problem (Problem Statement H9)
- **The Scenario**: In college hostels, Wi-Fi drops constantly. If multiple students are coding on the same project, standard tools overwrite each other's code or lose characters on reconnect.
- **Our Solution**: An **offline-first collaborative code editor**. You can lose internet completely, continue typing, create files, and when Wi-Fi comes back, all changes merge automatically with zero lost characters.

---

## 🧠 2. CRDT vs. OT (Judges LOVE asking this!)
### "Why did you use CRDT instead of OT?"
* **Plain English Answer**:
  > *"OT (Operational Transformation, used by Google Docs) requires a central server to rewrite every operation in sequence. If someone goes offline for 10 minutes, OT struggles or breaks because the server wasn't there to transform operations in order.*
  >
  > *CRDT (Conflict-free Replicated Data Type, powered by Yjs in our app) is mathematically designed to merge peer-to-peer. Every single character typed gets a unique identifier and clock. It doesn't matter if updates arrive out of order, delayed, or after being offline for hours — mathematically, every client converges to the exact same text automatically without needing a server to arbitrate conflicts."*

---

## 💾 3. How Offline Storage Works (`y-indexeddb`)
### "Where do edits go when the Wi-Fi disconnects?"
* **Plain English Answer**:
  > *"We use `y-indexeddb`. IndexedDB is a built-in NoSQL database inside every browser. Every keystroke is saved as a binary CRDT update into IndexedDB locally on the user's computer.*
  >
  > *Even if you close the browser tab while offline, your code is safely preserved. When you open it back up, the editor immediately loads from IndexedDB."*

### "What happens upon reconnecting?"
* **Plain English Answer**:
  > *"When the network comes back, our client and server exchange Yjs state vectors (sync step 1 and step 2). Yjs computes only the missing diffs that occurred during the offline window and merges them seamlessly with everyone else's work."*

---

## ↩️ 4. The Per-User Undo Trap (`Y.UndoManager`)
### "Why does normal Ctrl+Z break in multiplayer editors?"
* **The AI Trap (Mentioned in Problem Statement)**:
  > *"Monaco Editor has its own internal undo stack that blindly undoes whatever was last changed in the text buffer. If User A types 'hello' and User B types 'world', pressing Ctrl+Z in standard Monaco would undo User B's 'world'!"*

### "How did you solve it?"
* **Our Solution**:
  > *"We integrated `Y.UndoManager` and restricted its `trackedOrigins` to our local `MonacoBinding`. We intercepted Monaco's `Ctrl+Z` and `Ctrl+Y` commands.*
  >
  > *Now, when a user presses Ctrl+Z, Yjs checks the transaction origin and inverts **only the keystrokes made by that specific user**, leaving everyone else's concurrent edits untouched."*

---

## 👥 5. Live Presence & Cursors (The Awareness Protocol)
### "How do you show where others are typing and what files they are on?"
* **Plain English Answer**:
  > *"We use the Yjs Awareness protocol. Unlike document edits (which are permanent CRDTs saved in IndexedDB), awareness is ephemeral (temporary). Each user broadcasts their chosen name, cursor color, current selection coordinates, and active file name.*
  >
  > *When a peer moves their cursor or switches files, our client receives the awareness update, translates the character index to Monaco line/column coordinates, and injects colored flags with their name above their caret."*

---

## 📁 6. Multi-File Architecture
### "How does the project handle multiple files simultaneously?"
* **Plain English Answer**:
  > *"We store a shared directory list in a `Y.Map` called `files`. Each file's text content is a shared `Y.Text` named `file:<filename>`.*
  >
  > *This allows teammates to edit different files at the same time or work inside the same file together. In the sidebar, colored indicator dots show which file each team member is currently viewing."*

---

## 🖥️ 7. Frontend & Backend Architecture
- **Frontend**:
  - React 19 + Vite.
  - Monaco Editor (powers VS Code).
  - Yjs (CRDT engine), `y-indexeddb` (offline local persistence), `y-websocket` (network sync provider), `y-monaco` (binds Monaco model to Yjs text).
  - Hosted on **Netlify**.
- **Backend**:
  - Lightweight Node.js server with WebSockets (`ws`).
  - Uses `setupWSConnection` from `y-websocket` to broadcast binary sync messages and relay awareness.
  - Health check endpoint `/health` for cloud platform uptime monitoring.
  - Hosted on **Render** (configured to bind to `0.0.0.0` with dynamic `PORT`).

---

## 🎯 8. Live Demo Script for Judges (Under 2 Minutes)
1. **Show Multiplayer**:
   - Open the app in two browser windows side-by-side.
   - Type in Window 1 — show instantaneous cursor and text sync in Window 2.
2. **Show Per-User Undo**:
   - In Window 1, type `const a = 100;`.
   - In Window 2, type `const b = 200;`.
   - In Window 1, press `Ctrl+Z` — point out that `const a = 100;` disappears, but `const b = 200;` remains completely intact.
3. **Show Bad Hostel Wi-Fi (Offline Merge)**:
   - In Window 1, click **"🔌 Simulate Wi-Fi Drop"**. Show the badge change to `Offline (Simulated)`.
   - In Window 1 (offline), type a function: `function offlineFeature() { return true; }`.
   - In Window 2 (still online), type comments or another function.
   - In Window 1, click **"📶 Reconnect Wi-Fi"**.
   - Show how both texts merge cleanly together with zero lost characters!
4. **Show In-Browser Runner**:
   - Click **"▶ Run"** in the top bar.
   - Watch the built-in Terminal open and instantly log output, even while disconnected!

---

## 🏃‍♂️ 9. In-Browser Code Runner (Viva Guide)
### "How does the 'Run Code' button work?"
* **Plain English Answer**:
  > *"Instead of sending code to a remote backend server (which would fail when offline!), our runner executes 100% directly inside the browser using an isolated JavaScript sandbox.*
  >
  > *We override `console.log`, `console.warn`, and `console.error` inside a function scope, format the values, and stream them into our custom bottom terminal panel with millisecond execution timings.*
  >
  > *Because execution is client-side, it works completely offline without needing any internet connection!"*
