import { useRef } from "react";
import Editor from "@monaco-editor/react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:1234";

function App() {
  const cleanupRef = useRef(null);

  function handleMount(editor) {
    // Remove any earlier connection (React can mount twice in dev)
    if (cleanupRef.current) cleanupRef.current();

    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider(WS_URL, "h9-room", ydoc);
    const ytext = ydoc.getText("monaco");

    const binding = new MonacoBinding(
      ytext,
      editor.getModel(),
      new Set([editor]),
      provider.awareness
    );

    cleanupRef.current = () => {
      binding.destroy();
      provider.destroy();
      ydoc.destroy();
    };
  }

  return (
    <div style={{ height: "100vh" }}>
      <Editor
        height="100%"
        defaultLanguage="javascript"
        theme="vs-dark"
        onMount={handleMount}
      />
    </div>
  );
}

export default App;