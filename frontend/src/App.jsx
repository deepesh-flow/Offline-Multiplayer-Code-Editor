import React, { useEffect, useState, useRef, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import { MonacoBinding } from 'y-monaco';

import {
  USER_COLORS,
  getStoredUser,
  saveStoredUser,
  getLanguageByFilename,
  updateRemoteCursorStyles,
} from './utils/collab';
import './App.css';

const DEFAULT_WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:1234';

// Sample default files to populate on fresh project start
const DEFAULT_FILES = {
  'main.js': `// ⚡ Collaborative JavaScript Runner
function greet(name) {
  return "Hello, " + name + "!";
}

console.log(greet("Code Fuzion Team"));
`,
  'script.py': `# 🐍 Python 3 Runner (Pyodide WebAssembly)
def greet(name):
    return f"Hello, {name}!"

print(greet("Code Fuzion Team"))
`,
  'README.md': `# MultiCode Offline (H9 Problem Statement)

### Features:
1. **CRDT-based Sync (Yjs)**: Conflict-free real-time typing across 4+ users.
2. **Offline-First with IndexedDB**: Edits persist locally when Wi-Fi drops.
3. **Automatic Merge on Reconnect**: Zero lost characters when reconnecting.
4. **Per-User Undo**: Ctrl+Z / Cmd+Z reverts only your own keystrokes!
5. **In-Browser Execution**: Run JavaScript (.js) and Python (.py) directly in the browser!
`,
};

function App() {
  // Query param for room code, e.g. ?room=project-demo
  const roomName = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || 'h9-room';
  }, []);

  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [fileList, setFileList] = useState([]);
  const [activeFile, setActiveFile] = useState('main.js');
  const [wsStatus, setWsStatus] = useState('connecting'); // 'connecting' | 'connected' | 'disconnected'
  const [isIndexedDBSynced, setIsIndexedDBSynced] = useState(false);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const [editorCursorPos, setEditorCursorPos] = useState({ line: 1, col: 1 });

  // Modals & Panels
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [newFileNameInput, setNewFileNameInput] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);

  // In-Browser Code Runner & Terminal
  const [showConsole, setShowConsole] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  // Offline-Synced Team Chat (Feature 2)
  const [chatMessages, setChatMessages] = useState([]);
  const [showChat, setShowChat] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [chatInputText, setChatInputText] = useState('');
  const [clearedAtMap, setClearedAtMap] = useState({});
  const showChatRef = useRef(false);
  const chatEndRef = useRef(null);

  // Core references
  const ydocRef = useRef(null);
  const wsProviderRef = useRef(null);
  const idbProviderRef = useRef(null);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const bindingRef = useRef(null);
  const undoManagerRef = useRef(null);
  const pyodideRef = useRef(null);

  // Initialize Yjs, IndexedDB, and WebSocket Provider
  useEffect(() => {
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // 1. Client-side IndexedDB persistence for offline-first support
    const idbProvider = new IndexeddbPersistence(roomName, ydoc);
    idbProviderRef.current = idbProvider;

    idbProvider.on('synced', () => {
      setIsIndexedDBSynced(true);
      // If doc is completely fresh in IndexedDB, seed default files
      const filesMap = ydoc.getMap('files');
      if (filesMap.size === 0) {
        Object.entries(DEFAULT_FILES).forEach(([name, content]) => {
          filesMap.set(name, { createdAt: Date.now() });
          const ytext = ydoc.getText(`file:${name}`);
          if (ytext.length === 0) {
            ytext.insert(0, content);
          }
        });
      }
    });

    // 2. WebSocket provider for real-time collaboration
    const wsProvider = new WebsocketProvider(DEFAULT_WS_URL, roomName, ydoc);
    wsProviderRef.current = wsProvider;

    wsProvider.on('status', ({ status }) => {
      setWsStatus(status);
    });

    // 3. Awareness setup for live cursors and user presence
    const awareness = wsProvider.awareness;

    const handleAwarenessChange = () => {
      const states = Array.from(awareness.getStates().entries());
      const peers = states
        .filter(([, state]) => state && state.user)
        .map(([clientId, state]) => ({
          clientId,
          isSelf: clientId === ydoc.clientID,
          ...state.user,
        }));
      setCollaborators(peers);
      updateRemoteCursorStyles(awareness);
    };

    awareness.on('change', handleAwarenessChange);

    // 4. Track file list changes from shared files Y.Map
    const filesMap = ydoc.getMap('files');
    const handleFilesChange = () => {
      const names = Array.from(filesMap.keys()).sort();
      setFileList(names);
      // Auto-select first file if active file was deleted
      setActiveFile((prev) => {
        if (names.length > 0 && !names.includes(prev)) {
          return names[0];
        }
        return prev;
      });
    };

    filesMap.observe(handleFilesChange);
    handleFilesChange();

    // 5. Offline-synced team chat via Y.Array
    const chatArray = ydoc.getArray('chat-messages');
    const handleChatChange = (event) => {
      const msgs = chatArray.toArray();
      setChatMessages(msgs);
      if (!showChatRef.current && event && event.delta) {
        const addedCount = event.delta.reduce(
          (acc, d) => acc + (d.insert ? d.insert.length : 0),
          0
        );
        if (addedCount > 0) {
          setUnreadChatCount((prev) => prev + addedCount);
        }
      }
    };

    chatArray.observe(handleChatChange);
    handleChatChange();

    return () => {
      awareness.off('change', handleAwarenessChange);
      filesMap.unobserve(handleFilesChange);
      chatArray.unobserve(handleChatChange);
      wsProvider.destroy();
      idbProvider.destroy();
      ydoc.destroy();
    };
  }, [roomName]);

  // Keep ref synced to avoid stale closures in Yjs observer
  useEffect(() => {
    showChatRef.current = showChat;
  }, [showChat]);

  // Derive per-room cleared timestamp without triggering cascading renders in effects
  const chatClearedAt = useMemo(() => {
    if (clearedAtMap[roomName] !== undefined) {
      return clearedAtMap[roomName];
    }
    try {
      const stored = localStorage.getItem(`multicode_chat_cleared_${roomName}`);
      return stored ? parseInt(stored, 10) : 0;
    } catch {
      return 0;
    }
  }, [clearedAtMap, roomName]);

  function handleToggleChat() {
    setShowChat((prev) => {
      const next = !prev;
      if (next) {
        setUnreadChatCount(0);
      }
      return next;
    });
  }

  // Filter messages for current user so clearing chat affects only this user
  const visibleChatMessages = useMemo(() => {
    if (!chatClearedAt) return chatMessages;
    return chatMessages.filter((msg) => !msg.timestamp || msg.timestamp > chatClearedAt);
  }, [chatMessages, chatClearedAt]);

  // Auto-scroll chat to bottom when new messages arrive or drawer opens
  useEffect(() => {
    if (showChat) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [visibleChatMessages, showChat]);

  // Keep awareness synced when user changes active file
  useEffect(() => {
    if (wsProviderRef.current?.awareness) {
      wsProviderRef.current.awareness.setLocalStateField('user', {
        name: currentUser.name,
        color: currentUser.color,
        currentFile: activeFile,
      });
    }
  }, [activeFile, currentUser]);

  // Bind Monaco Editor to the active file's Y.Text with scoped Y.UndoManager
  const bindEditorToFile = (filename) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const ydoc = ydocRef.current;
    const wsProvider = wsProviderRef.current;

    if (!editor || !monaco || !ydoc || !wsProvider || !filename) return;

    // Clean up existing binding and undoManager
    if (bindingRef.current) {
      bindingRef.current.destroy();
      bindingRef.current = null;
    }
    if (undoManagerRef.current) {
      undoManagerRef.current.destroy();
      undoManagerRef.current = null;
    }

    const ytext = ydoc.getText(`file:${filename}`);
    const model = editor.getModel();

    if (model) {
      // Set syntax highlighting language based on file extension
      const lang = getLanguageByFilename(filename);
      monaco.editor.setModelLanguage(model, lang);

      // Cleanly load the file content into the editor model to prevent any bleeding from previous file
      const currentContent = ytext.toString();
      if (model.getValue() !== currentContent) {
        model.setValue(currentContent);
      }

      // Create MonacoBinding with awareness for remote cursor display
      const binding = new MonacoBinding(
        ytext,
        model,
        new Set([editor]),
        wsProvider.awareness
      );
      bindingRef.current = binding;

      // Robust Per-User Undo:
      // Track ONLY operations originating from this local MonacoBinding!
      // This ensures Ctrl+Z only inverts changes you made, ignoring teammates' concurrent edits.
      const undoManager = new Y.UndoManager(ytext, {
        trackedOrigins: new Set([binding]),
      });
      undoManagerRef.current = undoManager;

      // Override Monaco's default undo/redo keyboard shortcuts
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, () => {
        undoManager.undo();
      });
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY, () => {
        undoManager.redo();
      });
      editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ,
        () => {
          undoManager.redo();
        }
      );
    }
  };

  // Re-bind when activeFile changes or editor mounts
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      bindEditorToFile(activeFile);
    }
  }, [activeFile]);

  function handleEditorMount(editor, monaco) {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Track cursor line & column
    editor.onDidChangeCursorPosition((e) => {
      setEditorCursorPos({
        line: e.position.lineNumber,
        col: e.position.column,
      });
    });

    bindEditorToFile(activeFile);
  }

  // File Operations
  function handleCreateFile(e) {
    e.preventDefault();
    const clean = newFileNameInput.trim();
    if (!clean) return;

    const filesMap = ydocRef.current?.getMap('files');
    if (!filesMap) return;

    if (filesMap.has(clean)) {
      alert('A file with that name already exists in this project.');
      return;
    }

    // Register file in Y.Map and initialize its Y.Text with valid language comments
    filesMap.set(clean, { createdAt: Date.now() });
    const ytext = ydocRef.current.getText(`file:${clean}`);
    if (ytext.length === 0) {
      if (clean.endsWith('.py')) {
        ytext.insert(0, `# ${clean}\nprint("Hello from ${clean}!")\n`);
      } else if (clean.endsWith('.html')) {
        ytext.insert(0, `<!DOCTYPE html>\n<html>\n<body>\n  <h1>${clean}</h1>\n</body>\n</html>\n`);
      } else if (clean.endsWith('.css')) {
        ytext.insert(0, `/* ${clean} */\n`);
      } else {
        ytext.insert(0, `// ${clean}\nconsole.log("Hello from ${clean}!");\n`);
      }
    }

    setActiveFile(clean);
    setNewFileNameInput('');
    setShowNewFileModal(false);
  }

  function handleDeleteFile(fileName, e) {
    e.stopPropagation();
    if (fileList.length <= 1) {
      alert('Cannot delete the last remaining file in the project.');
      return;
    }
    const confirmed = window.confirm(`Are you sure you want to delete "${fileName}"?`);
    if (!confirmed) return;

    const filesMap = ydocRef.current?.getMap('files');
    if (filesMap && filesMap.has(fileName)) {
      filesMap.delete(fileName);
    }
  }

  // Network Simulation (Bad Hostel Wi-Fi test)
  function handleToggleSimulateOffline() {
    const ws = wsProviderRef.current;
    if (!ws) return;

    if (isSimulatedOffline) {
      // Reconnect
      ws.connect();
      setIsSimulatedOffline(false);
    } else {
      // Disconnect
      ws.disconnect();
      setIsSimulatedOffline(true);
      setWsStatus('disconnected');
    }
  }

  // Per-User Undo/Redo handlers
  function handleUndo() {
    if (undoManagerRef.current) {
      undoManagerRef.current.undo();
    }
  }

  function handleRedo() {
    if (undoManagerRef.current) {
      undoManagerRef.current.redo();
    }
  }

  // User Profile
  function handleSaveProfile(newName, newColor) {
    const updated = { name: newName, color: newColor };
    setCurrentUser(updated);
    saveStoredUser(updated);
    if (wsProviderRef.current?.awareness) {
      wsProviderRef.current.awareness.setLocalStateField('user', {
        ...updated,
        currentFile: activeFile,
      });
    }
    setShowProfileModal(false);
  }

  function handleCopyShareLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  }

  function handleSwitchRoom(targetRoom) {
    const clean = targetRoom.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    if (!clean) return;
    const url = new URL(window.location.href);
    url.searchParams.set('room', clean);
    window.location.href = url.toString();
  }

  function handleCreateRandomRoom() {
    const randomId = Math.random().toString(36).substring(2, 8);
    handleSwitchRoom(`room-${randomId}`);
  }

  // Feature 2: Offline-Synced Team Chat Handlers
  function handleSendChatMessage(e) {
    e.preventDefault();
    const clean = chatInputText.trim();
    if (!clean) return;

    const chatArray = ydocRef.current?.getArray('chat-messages');
    if (!chatArray) return;

    const newMsg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      senderName: currentUser.name,
      senderColor: currentUser.color,
      text: clean,
      timestamp: Date.now(),
    };

    chatArray.push([newMsg]);
    setChatInputText('');
  }

  function handleClearChat() {
    const confirmed = window.confirm(
      'Clear chat history on your screen? (This will only clear for you; teammates will still see the messages)'
    );
    if (!confirmed) return;
    const now = Date.now();
    setClearedAtMap((prev) => ({ ...prev, [roomName]: now }));
    try {
      localStorage.setItem(`multicode_chat_cleared_${roomName}`, String(now));
    } catch {
      // LocalStorage fallback
    }
  }

  function handleRestoreChat() {
    setClearedAtMap((prev) => ({ ...prev, [roomName]: 0 }));
    try {
      localStorage.removeItem(`multicode_chat_cleared_${roomName}`);
    } catch {
      // LocalStorage fallback
    }
  }

  // Helper to format arguments nicely for terminal display
  function formatArg(arg) {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (typeof arg === 'string') return arg;
    if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
    if (typeof arg === 'function') return arg.toString();
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  }

  // Pyodide loader for browser-native Python execution
  async function getPyodide() {
    if (pyodideRef.current) return pyodideRef.current;
    if (window.pyodideInstance) {
      pyodideRef.current = window.pyodideInstance;
      return window.pyodideInstance;
    }

    if (!window.loadPyodide) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
        script.onload = resolve;
        script.onerror = () =>
          reject(
            new Error(
              'Could not load Pyodide engine from CDN. Connect to internet once to download Python.'
            )
          );
        document.head.appendChild(script);
      });
    }

    const pyodide = await window.loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
    });
    window.pyodideInstance = pyodide;
    pyodideRef.current = pyodide;
    return pyodide;
  }

  // In-Browser Code Runner for JavaScript and Python
  async function handleRunCode() {
    setShowConsole(true);
    setIsRunning(true);

    let code = '';
    if (editorRef.current) {
      code = editorRef.current.getValue();
    } else if (ydocRef.current) {
      code = ydocRef.current.getText(`file:${activeFile}`)?.toString() || '';
    }

    const lang = getLanguageByFilename(activeFile);
    const runTimestamp = new Date().toLocaleTimeString();

    // Start each run with a clean log so previous runs don't clutter the terminal
    setConsoleLogs([
      { type: 'system', text: `🚀 [${activeFile}] Starting execution...`, time: runTimestamp },
    ]);

    const capture = (type, text) => {
      setConsoleLogs((prev) => [
        ...prev,
        { type, text, time: new Date().toLocaleTimeString() },
      ]);
    };

    const startTime = performance.now();
    let capturedAnyOutput = false;

    try {
      if (lang === 'javascript' || lang === 'typescript') {
        const customConsole = {
          log: (...args) => {
            capturedAnyOutput = true;
            console.log(...args);
            capture('log', args.map(formatArg).join(' '));
          },
          info: (...args) => {
            capturedAnyOutput = true;
            console.info(...args);
            capture('info', args.map(formatArg).join(' '));
          },
          warn: (...args) => {
            capturedAnyOutput = true;
            console.warn(...args);
            capture('warn', args.map(formatArg).join(' '));
          },
          error: (...args) => {
            capturedAnyOutput = true;
            console.error(...args);
            capture('error', args.map(formatArg).join(' '));
          },
        };

        const customPrint = (...args) => {
          capturedAnyOutput = true;
          capture('log', args.map(formatArg).join(' '));
        };

        // AsyncFunction allows both sync code and async/await!
        const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
        const executeScript = new AsyncFunction('console', 'print', code);
        const result = await executeScript(customConsole, customPrint);

        if (result !== undefined) {
          capturedAnyOutput = true;
          capture('return', `↳ ${formatArg(result)}`);
        }

        if (!capturedAnyOutput) {
          capture(
            'info',
            'ℹ️ (Code executed successfully with no output. Try: console.log("Hello World"))'
          );
        }
      } else if (lang === 'python') {
        // Auto-fix any accidental JS-style '//' comments at start of lines to '#'
        let sanitizedPython = code.replace(/^\s*\/\/(.*)$/gm, '#$1');

        if (!sanitizedPython.trim()) {
          capture('info', 'ℹ️ (Python file is empty. Try adding: print("Hello World"))');
          setIsRunning(false);
          return;
        }

        capture('system', '🐍 Running Python 3 (Pyodide WebAssembly)...');
        const pyodide = await getPyodide();

        // Redirect stdout and stderr cleanly
        pyodide.setStdout({
          batched: (msg) => {
            if (msg && msg.trim()) {
              capturedAnyOutput = true;
              capture('log', msg);
            }
          },
        });
        pyodide.setStderr({
          batched: (msg) => {
            if (msg && msg.trim()) {
              capturedAnyOutput = true;
              capture('error', msg);
            }
          },
        });

        const result = await pyodide.runPythonAsync(sanitizedPython);
        if (result !== undefined && result !== null) {
          const resStr = String(result);
          if (resStr !== 'None' && resStr.trim() !== '') {
            capturedAnyOutput = true;
            capture('return', `↳ ${resStr}`);
          }
        }

        if (!capturedAnyOutput) {
          capture('info', 'ℹ️ (Python executed successfully with no print output)');
        }
      } else {
        capture(
          'info',
          `📄 [${activeFile}] In-browser execution supports JavaScript (.js) and Python (.py). Syntax highlighting is active for ${lang.toUpperCase()}.`
        );
      }
    } catch (err) {
      let rawMsg = err.message || String(err);
      // Clean up internal Pyodide engine paths so users see clear syntax/runtime errors
      if (rawMsg.includes('SyntaxError:')) {
        const syntaxLine = rawMsg.split('\n').find((l) => l.includes('SyntaxError:')) || rawMsg;
        capture('error', `❌ ${syntaxLine}`);
      } else {
        capture('error', `❌ ${rawMsg}`);
      }
    } finally {
      const elapsed = Math.round(performance.now() - startTime);
      capture('system', `⚡ Finished in ${elapsed}ms`);
      setIsRunning(false);
    }
  }

  // Peers active on specific file
  const getPeersOnFile = (filename) => {
    return collaborators.filter((p) => p.currentFile === filename);
  };

  return (
    <div className="ide-container">
      {/* Header Bar */}
      <header className="ide-header">
        <div className="header-left">
          <div className="brand-badge">
            <span className="brand-icon">⚡</span>
            <span>MultiCode</span>
            <span className="brand-tag">H9 Offline Ready</span>
          </div>

          <div className="room-pill">
            <span>Room:</span>
            <strong>{roomName}</strong>
            <button
              className="copy-btn"
              title="Copy shareable invite link"
              onClick={handleCopyShareLink}
            >
              {copyFeedback ? '✓ Copied' : '🔗 Copy Link'}
            </button>
            <button
              className="copy-btn"
              style={{
                marginLeft: 4,
                background: '#3b82f633',
                color: '#93c5fd',
                padding: '2px 7px',
                borderRadius: 4,
                fontWeight: 600,
              }}
              title="Create or switch rooms"
              onClick={() => setShowRoomModal(true)}
            >
              ➕ Switch / New
            </button>
          </div>
        </div>

        <div className="header-center">
          {/* Connection Status Badge */}
          {wsStatus === 'connected' && !isSimulatedOffline ? (
            <div className="status-indicator status-online" title="Real-time WebSocket connected and syncing">
              <span className="status-dot"></span>
              <span>Online</span>
            </div>
          ) : isSimulatedOffline ? (
            <div className="status-indicator status-offline" title="Simulated Wi-Fi disconnect. Changes saved locally to IndexedDB!">
              <span className="status-dot"></span>
              <span>Offline (Simulated)</span>
            </div>
          ) : wsStatus === 'connecting' ? (
            <div className="status-indicator status-syncing" title="Connecting to collaboration server...">
              <span className="status-dot"></span>
              <span>Connecting...</span>
            </div>
          ) : (
            <div className="status-indicator status-offline" title="No network connection. Working completely offline via IndexedDB.">
              <span className="status-dot"></span>
              <span>Offline</span>
            </div>
          )}

          {/* Simulate Bad Hostel Wi-Fi Button */}
          <button
            className={`btn-simulate ${isSimulatedOffline ? 'active' : ''}`}
            onClick={handleToggleSimulateOffline}
            title="Click to simulate hostel Wi-Fi drop and test offline merge"
          >
            {isSimulatedOffline ? '📶 Reconnect Wi-Fi' : '🔌 Simulate Wi-Fi Drop'}
          </button>

          {/* Undo / Redo Toolbar */}
          <button className="icon-btn" onClick={handleUndo} title="Per-User Undo (Ctrl+Z) - Only undoes your own edits">
            ↶ Undo
          </button>
          <button className="icon-btn" onClick={handleRedo} title="Per-User Redo (Ctrl+Y)">
            ↷ Redo
          </button>

          {/* In-Browser Code Runner */}
          <button
            className="btn-run"
            onClick={handleRunCode}
            disabled={isRunning}
            title="Execute code directly in browser (works offline!)"
          >
            {isRunning ? '⏳ Running...' : '▶ Run'}
          </button>
          <button
            className="icon-btn"
            onClick={() => setShowConsole((prev) => !prev)}
            title="Toggle Console / Terminal"
            style={{ color: showConsole ? '#60a5fa' : 'inherit' }}
          >
            💻 Terminal
          </button>
          <button
            className={`icon-btn ${showChat ? 'active' : ''}`}
            onClick={handleToggleChat}
            title="Toggle Offline-Synced Team Chat"
            style={{
              background: showChat ? '#3b82f633' : undefined,
              color: showChat ? '#60a5fa' : undefined,
              position: 'relative',
            }}
          >
            💬 Chat
            {unreadChatCount > 0 && !showChat && (
              <span className="chat-badge">{unreadChatCount}</span>
            )}
          </button>
        </div>

        <div className="header-right">
          {/* Collaborators Active Tray */}
          <div className="collaborators-tray">
            {collaborators.map((c) => (
              <div
                key={c.clientId}
                className="user-badge"
                title={`${c.name} ${c.isSelf ? '(You)' : ''} - Editing: ${c.currentFile || 'none'}`}
                onClick={() => c.isSelf && setShowProfileModal(true)}
              >
                <span
                  className="user-avatar-dot"
                  style={{ backgroundColor: c.color }}
                ></span>
                <span>{c.isSelf ? `${c.name} (You)` : c.name}</span>
              </div>
            ))}
            <span className="user-count-chip" title="Connected teammates">
              👥 {collaborators.length}
            </span>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="ide-body">
        {/* Sidebar File Explorer */}
        <aside className="ide-sidebar">
          <div className="sidebar-header">
            <span className="sidebar-title">Files</span>
            <button
              className="btn-new-file"
              onClick={() => setShowNewFileModal(true)}
              title="Create new file"
            >
              + New File
            </button>
          </div>

          <div className="file-list">
            {fileList.map((filename) => {
              const peersOnFile = getPeersOnFile(filename);
              return (
                <div
                  key={filename}
                  className={`file-item ${activeFile === filename ? 'active' : ''}`}
                  onClick={() => setActiveFile(filename)}
                >
                  <div className="file-info">
                    <span className="file-icon">📄</span>
                    <span>{filename}</span>
                  </div>

                  {/* Remote peers currently editing this file */}
                  <div className="file-collaborators">
                    {peersOnFile.map((p) => (
                      <span
                        key={p.clientId}
                        className="file-collab-dot"
                        style={{ backgroundColor: p.color }}
                        title={`${p.name} is on this file`}
                      ></span>
                    ))}
                  </div>

                  {fileList.length > 1 && (
                    <button
                      className="file-delete-btn"
                      onClick={(e) => handleDeleteFile(filename, e)}
                      title="Delete file"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Quick Viva & Demo Notes in Sidebar */}
          <div className="sidebar-footer">
            <strong>💡 Quick Viva Guide:</strong>
            <div>• <b>CRDT (Yjs)</b>: Conflict-free merge</div>
            <div>• <b>IndexedDB</b>: Offline storage</div>
            <div>• <b>UndoManager</b>: Tracks local origin only</div>
          </div>
        </aside>

        {/* Editor Area */}
        <main className="ide-workspace">
          {/* Tab Bar */}
          <div className="tab-bar">
            <div className="editor-tab">
              <span>📄 {activeFile}</span>
              <span className="editor-tab-lang">
                {getLanguageByFilename(activeFile)}
              </span>
            </div>

            {/* Tab Bar Run & Terminal actions */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                className="btn-run"
                onClick={handleRunCode}
                disabled={isRunning}
                title="Execute active code in browser"
              >
                {isRunning ? '⏳ Running...' : '▶ Run Code'}
              </button>
              <button
                className="icon-btn"
                onClick={() => setShowConsole((prev) => !prev)}
                title="Toggle Output Terminal"
                style={{
                  background: showConsole ? '#3b82f633' : undefined,
                  color: showConsole ? '#60a5fa' : undefined,
                }}
              >
                💻 Terminal {showConsole ? '▼' : '▲'}
              </button>
              <button
                className="icon-btn"
                onClick={handleToggleChat}
                title="Toggle Team Chat"
                style={{
                  background: showChat ? '#3b82f633' : undefined,
                  color: showChat ? '#60a5fa' : undefined,
                  position: 'relative',
                }}
              >
                💬 Chat {unreadChatCount > 0 && !showChat && (
                  <span className="chat-badge">{unreadChatCount}</span>
                )}
              </button>
            </div>
          </div>

          {/* Monaco Editor Canvas */}
          <div className="monaco-wrapper">
            <Editor
              height="100%"
              theme="vs-dark"
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: 'on',
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
              }}
              onMount={handleEditorMount}
            />
          </div>

          {/* In-Browser Output Terminal */}
          {showConsole && (
            <div className="ide-terminal">
              <div className="terminal-header">
                <div className="terminal-title">
                  <span>💻 Terminal / Output</span>
                  <span style={{ fontSize: 10, color: '#10b981' }}>• Active</span>
                </div>
                <div className="terminal-actions">
                  <button
                    className="terminal-btn"
                    onClick={() => setConsoleLogs([])}
                    title="Clear console output"
                  >
                    Clear
                  </button>
                  <button
                    className="terminal-btn"
                    onClick={() => setShowConsole(false)}
                    title="Close terminal"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="terminal-logs">
                {consoleLogs.length === 0 ? (
                  <div style={{ color: '#52525b', fontStyle: 'italic' }}>
                    Click "▶ Run Code" to execute Python (.py) or JavaScript (.js)...
                  </div>
                ) : (
                  consoleLogs.map((log, idx) => (
                    <div key={idx} className={`log-entry log-${log.type}`}>
                      <span className="log-time">[{log.time}]</span>
                      <span>{log.text}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </main>

        {/* Collapsible Offline-Synced Team Chat Drawer (Feature 2) */}
        {showChat && (
          <aside className="ide-chat-drawer">
            <div className="chat-header">
              <div className="chat-title-group">
                <span className="chat-title">💬 Team Chat</span>
                <span className="chat-badge-offline">Offline Synced</span>
              </div>
              <div className="chat-header-actions">
                {visibleChatMessages.length > 0 && (
                  <button
                    className="chat-clear-btn"
                    onClick={handleClearChat}
                    title="Clear chat for me only (teammates keep their messages)"
                  >
                    Clear (for me)
                  </button>
                )}
                {chatClearedAt > 0 && chatMessages.length > visibleChatMessages.length && (
                  <button
                    className="chat-clear-btn"
                    style={{ color: '#60a5fa' }}
                    onClick={handleRestoreChat}
                    title="Restore previously hidden chat history"
                  >
                    Restore
                  </button>
                )}
                <button
                  className="chat-close-btn"
                  onClick={() => setShowChat(false)}
                  title="Close chat drawer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="chat-messages-container">
              {visibleChatMessages.length === 0 ? (
                <div className="chat-empty-state">
                  <div className="chat-empty-icon">💭</div>
                  <div className="chat-empty-text">
                    {chatClearedAt > 0 ? 'Chat cleared for you.' : 'No messages yet.'}
                  </div>
                  <div className="chat-empty-hint">
                    {chatClearedAt > 0 ? (
                      <>
                        You cleared your chat history on this device. Teammates can still see their messages.
                        <br />
                        <button
                          type="button"
                          onClick={handleRestoreChat}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#60a5fa',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            marginTop: 8,
                            fontSize: 11,
                          }}
                        >
                          Restore previous messages
                        </button>
                      </>
                    ) : (
                      'Type a message below to test live team chat! Messages are stored in IndexedDB and sync automatically across peers even if Wi-Fi drops.'
                    )}
                  </div>
                </div>
              ) : (
                visibleChatMessages.map((msg) => {
                  const isSelf = msg.senderName === currentUser.name;
                  const timeStr = msg.timestamp
                    ? new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '';
                  return (
                    <div
                      key={msg.id || `${msg.senderName}-${msg.timestamp}`}
                      className={`chat-message-bubble ${isSelf ? 'msg-self' : 'msg-teammate'}`}
                    >
                      <div className="msg-header">
                        <span
                          className="msg-avatar-dot"
                          style={{ backgroundColor: msg.senderColor || '#3b82f6' }}
                        ></span>
                        <span className="msg-sender">{isSelf ? 'You' : msg.senderName}</span>
                        <span className="msg-time">{timeStr}</span>
                      </div>
                      <div className="msg-body">{msg.text}</div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            <form className="chat-input-form" onSubmit={handleSendChatMessage}>
              <input
                type="text"
                className="chat-input"
                placeholder={
                  isSimulatedOffline
                    ? 'Chat offline (synced on reconnect)...'
                    : 'Type a message... (Enter to send)'
                }
                value={chatInputText}
                onChange={(e) => setChatInputText(e.target.value)}
              />
              <button
                type="submit"
                className="chat-send-btn"
                disabled={!chatInputText.trim()}
                title="Send message"
              >
                Send
              </button>
            </form>
          </aside>
        )}
      </div>

      {/* Bottom Status Bar */}
      <footer className={`ide-statusbar ${isSimulatedOffline ? 'statusbar-offline-mode' : ''}`}>
        <div className="statusbar-left">
          <span>
            {isIndexedDBSynced ? '💾 IndexedDB: Synced (Offline Safe)' : '💾 IndexedDB: Initializing...'}
          </span>
          <span>
            {isSimulatedOffline
              ? '⚠️ Wi-Fi Disconnected — Editing Offline'
              : wsStatus === 'connected'
              ? '⚡ WebSocket: Live Connected'
              : '⚡ WebSocket: Reconnecting...'}
          </span>
        </div>
        <div className="statusbar-right">
          <span>Ln {editorCursorPos.line}, Col {editorCursorPos.col}</span>
          <span>UTF-8</span>
          <span>{getLanguageByFilename(activeFile).toUpperCase()}</span>
        </div>
      </footer>

      {/* New File Modal */}
      {showNewFileModal && (
        <div className="modal-overlay" onClick={() => setShowNewFileModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Create New File</h3>
            <form onSubmit={handleCreateFile}>
              <input
                type="text"
                className="modal-input"
                placeholder="e.g. script.py, styles.css, app.js"
                autoFocus
                value={newFileNameInput}
                onChange={(e) => setNewFileNameInput(e.target.value)}
              />
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowNewFileModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Profile / Name & Color Modal */}
      {showProfileModal && (
        <ProfileModal
          currentUser={currentUser}
          onSave={handleSaveProfile}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {/* Room Management Modal */}
      {showRoomModal && (
        <RoomModal
          currentRoom={roomName}
          onSwitchRoom={handleSwitchRoom}
          onCreateRandomRoom={handleCreateRandomRoom}
          onClose={() => setShowRoomModal(false)}
        />
      )}
    </div>
  );
}

function RoomModal({ currentRoom, onSwitchRoom, onCreateRandomRoom, onClose }) {
  const [customRoomInput, setCustomRoomInput] = useState('');
  const [copied, setCopied] = useState(false);

  function handleCustomSubmit(e) {
    e.preventDefault();
    if (!customRoomInput.trim()) return;
    onSwitchRoom(customRoomInput.trim());
  }

  function handleCopyCurrent() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: 420 }}>
        <h3 className="modal-title">Collaborative Rooms</h3>

        {/* Current Room Info & Direct Share Link */}
        <div style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 6, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#a1a1aa', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>
            Current Room:
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#60a5fa', marginBottom: 8 }}>
            {currentRoom}
          </div>
          <button
            type="button"
            className="btn-primary"
            style={{ width: '100%', fontSize: 13, padding: '7px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
            onClick={handleCopyCurrent}
          >
            {copied ? '✓ Invite Link Copied to Clipboard!' : '🔗 Copy Shareable Invite Link'}
          </button>
        </div>

        {/* Option 1: Quick Generate New Room */}
        <div style={{ marginBottom: 16 }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ width: '100%', fontSize: 13, padding: '8px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
            onClick={onCreateRandomRoom}
          >
            🎲 Generate New Private Room
          </button>
        </div>

        {/* Option 2: Custom Room Name */}
        <form onSubmit={handleCustomSubmit}>
          <label style={{ fontSize: 12, color: '#a1a1aa', display: 'block', marginBottom: 6 }}>
            Or join/create custom room name:
          </label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              type="text"
              className="modal-input"
              style={{ marginBottom: 0 }}
              placeholder="e.g. project-x, team-alpha"
              value={customRoomInput}
              onChange={(e) => setCustomRoomInput(e.target.value)}
            />
            <button type="submit" className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
              Go
            </button>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProfileModal({ currentUser, onSave, onClose }) {
  const [name, setName] = useState(currentUser.name);
  const [color, setColor] = useState(currentUser.color);

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), color);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Customize Your Identity</h3>
        <form onSubmit={handleSubmit}>
          <label style={{ fontSize: 12, color: '#a1a1aa', display: 'block', marginBottom: 6 }}>
            Display Name:
          </label>
          <input
            type="text"
            className="modal-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoFocus
          />

          <label style={{ fontSize: 12, color: '#a1a1aa', display: 'block', marginBottom: 8 }}>
            Cursor & Avatar Color:
          </label>
          <div className="color-picker-grid">
            {USER_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className={`color-option ${color === c ? 'selected' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
