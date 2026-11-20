# 🎓 MultiCode Offline — Viva Notes & Interview Guide
> **For**: B.Tech CSE Freshers (Code Fuzion 2026 • Problem H9).  
> **How to use this**: Read this together with your duo partner. You don't need to memorize code syntax—judges only care that you understand the **concepts** and the **reasons behind your choices**.

---

## 🌟 1. What is the Project in One Sentence?
> *"It's an offline-first collaborative code editor where a team can code together in real time over flaky hostel Wi-Fi; if internet drops, everyone can keep typing, and when anyone reconnects, all edits merge automatically with zero lost characters."*

---

## 🧠 2. CRDT vs. OT (The #1 Most Asked Judge Question)

### Q: "Why did you use CRDT instead of OT?"
* **The Fresher Explanation**:
  > *"Google Docs uses **OT (Operational Transformation)**. OT requires a single, central server to receive every keystroke and transform its position in sequence. In our hostel scenario, if Wi-Fi dies, there is no server to arbitrate!*  
  >  
  > *We chose **CRDT (Conflict-free Replicated Data Type)** powered by **Yjs**. With CRDTs, every character has a unique ID and logical clock. Even if edits arrive out of order or after someone was offline for 3 hours, the mathematical rules guarantee that every device converges to the exact same text automatically without needing a server to decide conflicts."*

---

## 💾 3. Offline Storage & Reconnection (`y-indexeddb`)

### Q: "Where does the code go when my Wi-Fi is completely dead?"
* **The Fresher Explanation**:
  > *"It is saved to **IndexedDB**, which is a built-in NoSQL database inside every browser on your hard drive.*  
  >  
  > *Using `y-indexeddb`, every keystroke is immediately written locally to IndexedDB as a binary CRDT update. Even if you turn off Wi-Fi or accidentally close the browser tab, your work is never lost."*

### Q: "What happens the moment Wi-Fi reconnects?"
* **The Fresher Explanation**:
  > *"Our client and the server exchange **State Vectors** (a short cryptographic summary of what updates each peer has). Yjs compares the vectors, calculates only the missing diffs that happened while offline, and merges them in milliseconds without losing a single character."*

---

## ↩️ 4. The Per-User Undo Trap (`Y.UndoManager`)

### Q: "Why does normal Ctrl+Z fail in collaborative editors?"
* **The Fresher Explanation (The AI Trap highlighted in the problem statement)**:
  > *"Monaco Editor (the editor engine from VS Code) has a default undo stack that simply undid whatever text was last changed in the editor buffer.*  
  >  
  > *If User A types 'hello' and User B types 'world', pressing Ctrl+Z in basic Monaco would accidentally delete User B's 'world'!"*

### Q: "How did you fix it in your code?"
* **The Fresher Explanation**:
  > *"We used `Y.UndoManager` and configured `trackedOrigins: new Set([binding])`. We intercepted Monaco's `Ctrl+Z` and `Ctrl+Y` keystrokes.*  
  >  
  > *Now, when User A presses Ctrl+Z, Yjs checks the transaction author and inverts **only the keystrokes made by User A**, leaving User B's code completely untouched."*

---

## 👥 5. Live Presence, Avatars & Cursors (Awareness Protocol)

### Q: "How do you show other people's cursors and colors?"
* **The Fresher Explanation**:
  > *"We use the **Yjs Awareness protocol**. Unlike document text (which is permanent and saved in IndexedDB), awareness data is ephemeral (temporary).*  
  >  
  > *Every connected peer broadcasts their chosen name, custom color, cursor line/column, and active file name. Our frontend receives these packets and dynamically injects colored CSS carets with floating name badges above each teammate's cursor."*

---

## 📁 6. Multi-File Project Architecture

### Q: "How do multiple files work collaboratively?"
* **The Fresher Explanation**:
  > *"We have a shared directory stored in a `Y.Map` called `files`. The content of each file is stored in a separate `Y.Text` called `file:<filename>`.*  
  >  
  > *This allows teammates to edit different files at the exact same time, or work together on the same file. In the sidebar, little colored dots show in real time which file each teammate is currently looking at."*

---

## 🏃‍♂️ 7. In-Browser Code Runner (JavaScript & Python)

### Q: "How does the '▶ Run Code' button work without a backend compiler?"
* **The Fresher Explanation**:
  > *"Running code on a remote server would fail completely when offline! So our code runner executes **100% inside the client browser**.*  
  >  
  > *• **For JavaScript**: It runs in an isolated async function sandbox where we intercept `console.log()` and stream outputs into our custom terminal.*  
  > *• **For Python 3**: It runs via **Pyodide**, which is the full CPython interpreter compiled to WebAssembly (Wasm). It executes real Python code (loops, list comprehensions, `print()`) directly in the browser's memory without needing any backend!"*

---

## 🌐 8. Rooms & Deployment (Render + Netlify)

### Q: "How do different teams get their own private rooms?"
* **The Fresher Explanation**:
  > *"We read the room name from the URL query parameter: `?room=xyz`. The WebSocket server and local IndexedDB use that room name as an isolated namespace. Anyone with the same link joins the same project room."*

### Q: "Where is this deployed?"
* **The Fresher Explanation**:
  > *"• **Frontend**: Hosted on **Netlify** (built with Vite).*  
  > *• **Backend**: A lightweight Node.js WebSocket server hosted on **Render**, listening on `0.0.0.0` with dynamic port handling and a `/health` endpoint for uptime monitoring."*

---

## 🎯 9. The 2-Minute Live Demo Script for Judges

When judges come to your desk, follow this exact sequence:

1. **Step 1: Live Multiplayer (15 seconds)**
   - Open your project link in **two side-by-side browser windows**.
   - Type in Window 1 ➔ Show that text, cursor flags, and user colors appear in real time in Window 2.

2. **Step 2: Per-User Undo (20 seconds)**
   - In Window 1, type: `let a = 10;`.
   - In Window 2, type: `let b = 20;`.
   - In Window 1, press `Ctrl+Z`.
   - **Point to the screen**: *"Notice that `let a = 10;` is undone, but my partner's `let b = 20;` remained completely untouched. That is our scoped UndoManager at work."*

3. **Step 3: Flaky Hostel Wi-Fi / Offline Merge (45 seconds)**
   - In Window 1, click **"🔌 Simulate Wi-Fi Drop"**. Show that the status badge turns red (`Offline (Simulated)`).
   - In Window 1 (offline), type a function: `function offlineTest() { return true; }`.
   - In Window 2 (online), type some comments or another function.
   - In Window 1, click **"📶 Reconnect Wi-Fi"**.
   - **Point to the screen**: *"Watch both screens merge automatically. Zero lost characters, zero manual git conflicts."*

4. **Step 4: In-Browser Execution (20 seconds)**
   - Switch to `script.py` and click **"▶ Run Code"**.
   - Show the terminal open at the bottom and cleanly print Python outputs in 2 milliseconds.

---

## 🤝 10. How the Two of You Should Divide the Viva

Judges can pick either of you at random. Split the topics so both of you shine:

* **Partner 1 (Frontend & User Experience)**:
  - Monaco Editor integration.
  - Per-User Undo mechanics (`Y.UndoManager` + `trackedOrigins`).
  - Live Awareness, cursors, and user color badges.
  - In-browser Code Runner (JS sandbox & Python Pyodide).

* **Partner 2 (Data, CRDT & Network Architecture)**:
  - CRDT vs. OT theory (mathematical convergence without central conflict server).
  - Offline local persistence (`y-indexeddb` saving binary CRDT updates).
  - State Vector diffing and automatic merge upon reconnect.
  - WebSocket backend architecture and room namespacing.
