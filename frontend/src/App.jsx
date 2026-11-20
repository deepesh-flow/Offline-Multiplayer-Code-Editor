import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:1234";

const ydoc = new Y.Doc();
new WebsocketProvider(WS_URL, "h9-room", ydoc);
const filesMap = ydoc.getMap("files");

function App() {
  const [fileNames, setFileNames] = useState([]);

  useEffect(() => {
    const update = () => setFileNames(Array.from(filesMap.keys()).sort());
    update();
    filesMap.observe(update);
    return () => filesMap.unobserve(update);
  }, []);

  function createFile() {
    const name = prompt("File name (e.g. main.py):");
    if (!name || !name.trim()) return;
    const clean = name.trim();
    if (filesMap.has(clean)) {
      alert("A file with that name already exists.");
      return;
    }
    filesMap.set(clean, new Y.Text());
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "#1e1e1e" }}>
      <div
        style={{
          width: 220,
          borderRight: "1px solid #333",
          color: "#ddd",
          fontFamily: "sans-serif",
          padding: 8,
        }}
      >
        <button onClick={createFile} style={{ width: "100%", marginBottom: 8 }}>
          + New file
        </button>
        {fileNames.map((name) => (
          <div key={name} style={{ padding: "4px 6px" }}>
            {name}
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }}>
        <Editor height="100%" defaultLanguage="javascript" theme="vs-dark" />
      </div>
    </div>
  );
}

export default App;