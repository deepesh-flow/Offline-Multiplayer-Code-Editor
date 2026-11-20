# API & Architecture Contract — Problem Statement H9

## 1. Network Protocol
Communication between clients and the server uses binary WebSocket frames adhering to the **Yjs Sync Protocol v1** and **Awareness Protocol**.

### Endpoints
* **HTTP / Health Check**:
  * `GET /health` or `GET /`: Returns `200 OK` JSON `{ "status": "ok", "service": "y-websocket-backend", "time": "..." }`. Used for Render health monitoring and keepalive.
* **WebSocket**:
  * `ws://<backend-host>:<port>/<room-name>` (or `wss://` over SSL in production).
  * Default Room: `h9-room` or custom via URL parameter: `?room=<custom-name>`.

---

## 2. Sync Protocol Messages
WebSocket binary messages are encoded with `lib0/encoding` and decoded with `lib0/decoding`:
1. **Message 0: Sync**
   * **Step 1 (Sync Step 1)**: Client sends its local State Vector.
   * **Step 2 (Sync Step 2)**: Server responds with missing document updates.
   * **Update**: Incremental document update sent whenever edits are made.
2. **Message 1: Awareness**
   * Relays ephemeral user state (Client ID, User Name, Color, Current File, Selection/Cursor positions).
3. **Message 2: Auth (Optional)**
   * Token-based authentication if enabled.

---

## 3. Data Structures (`Y.Doc`)
Inside the shared `Y.Doc` for each room:
* `files` (`Y.Map`):
  * Key: `filename` (string, e.g., `"main.js"`, `"index.html"`).
  * Value: `metadata` (`{ createdAt: number }`).
* `file:<filename>` (`Y.Text`):
  * Collaborative text CRDT for the specific file content.
  * Observed by `MonacoBinding` to synchronize with Monaco's editor model.
* `awareness`:
  * Map of active client states:
    ```json
    {
      "user": {
        "name": "Coder Panda 42",
        "color": "#3B82F6",
        "currentFile": "main.js"
      },
      "selection": {
        "anchor": "<Y.RelativePosition>",
        "head": "<Y.RelativePosition>"
      }
    }
    ```

---

## 4. Local Persistence Layer
* **Store**: HTML5 IndexedDB via `y-indexeddb`.
* **Database Name**: Same as `roomName`.
* **Mechanism**: Every Yjs update is persisted locally in IndexedDB before/in-parallel with network delivery. Upon network reconnection, missing updates are flushed and merged.
