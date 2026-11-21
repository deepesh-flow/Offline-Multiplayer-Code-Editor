# ⚡ MultiCode Offline — Multiplayer Code Editor that Works Offline

[![Problem Statement](https://img.shields.io/badge/Code%20Fuzion%202026-H9%20(Hard)-red.svg)](#)
[![Sync Engine](https://img.shields.io/badge/Sync-Yjs%20CRDT-blue.svg)](#)
[![Offline Storage](https://img.shields.io/badge/Offline-IndexedDB-green.svg)](#)

A browser-based collaborative code editor built for flaky hostel Wi-Fi. Supports 4+ concurrent developers editing simultaneously across multiple files, keeps working when internet drops, and merges cleanly on reconnect with zero lost characters.

---

## 🚀 Key Features

* **Conflict-Free Real-Time Collaboration**: CRDT-powered synchronization via **Yjs** ensures mathematical convergence without character loss or overwrites.
* **Offline-First Persistence**: Local browser storage powered by **IndexedDB** (`y-indexeddb`). Write code, switch files, and refresh while completely offline without losing changes.
* **Automatic Merge on Reconnect**: Seamless state vector diff calculation merges offline changes with teammates' work as soon as Wi-Fi returns.
* **True Per-User Undo**: `Y.UndoManager` strictly scoped to local transactions. Pressing `Ctrl+Z` undoes **only your edits**, never touching teammates' concurrent typing.
* **Multi-File Workspace**: Shared project directory supporting multiple files with automatic syntax highlighting (JS, TS, Python, HTML, CSS, C++, Java, Markdown, and more).
* **Live Presence & Cursors**: Visual remote carets with custom username flags, color coding, and indicator dots showing which file teammates are active on.
* **Wi-Fi Drop Simulator**: Built-in 1-click network toggle to simulate hostel connection dropouts live during judging.

---

## 🛠️ Tech Stack

* **Frontend**: React 19, Vite, Monaco Editor (`@monaco-editor/react`), Yjs, `y-monaco`, `y-websocket`, `y-indexeddb`.
* **Backend**: Node.js, `ws`, `y-websocket`.
* **Deployment**: Netlify (Frontend) + Render (Backend).

---

## 💻 Local Development Setup

### 1. Start the WebSocket Backend
```bash
cd backend
npm install
npm start
```
The server will run on `http://0.0.0.0:1234` (with WebSocket listener ready).

### 2. Start the Frontend
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser. Open multiple tabs or incognito windows to test multiplayer collaboration!

---

## 🌐 Production Deployment Guide

### Backend on Render (Web Service)
1. Push this repository to GitHub.
2. In Render, create a new **Web Service** connected to your repo.
3. Configure the following settings:
   * **Root Directory**: `backend`
   * **Build Command**: `npm install`
   * **Start Command**: `npm start`
   * **Environment Variables**:
     * `HOST`: `0.0.0.0`
     * `PORT`: `10000` (Render sets this automatically)
4. Your WebSocket URL will be: `wss://<your-service-name>.onrender.com`.

### Frontend on Netlify
1. In Netlify, create a new site from your GitHub repository.
2. Configure build settings:
   * **Base directory**: `frontend`
   * **Build command**: `npm run build`
   * **Publish directory**: `dist`
3. Under **Site Configuration** > **Environment variables**, set:
   * `VITE_WS_URL`: `wss://<your-render-service>.onrender.com`
4. Deploy!

---

## 📖 Viva & Interview Reference
Check [VIVA_SHEET.md](VIVA_SHEET.md) for plain-English explanations of CRDTs, OT vs CRDT, Vector Clocks, and per-user undo mechanics.
