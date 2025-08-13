## 3. Orchestration Layer

This is the core of the proxy. It will be responsible for:

- **Session Management**: A `SessionManager` class will track active connections, handle timeouts, and manage session state. It will use a simple in-memory store for now, backed by SQLite for persistence if the proxy needs to be restarted.
- **Request Routing**: When a request comes in, the orchestrator will identify the target server based on the tool name prefix (e.g., `filesystem.readFile`).
- **Request Handling**: It will delegate the request to the appropriate `McpServerManager`.

## 4. Transport Layer

This layer will contain individual modules for each transport protocol:

- **`WebSocketTransport.ts`**: Handles WebSocket connections, including message framing and client lifecycle events.
- **`SseTransport.ts`**: Manages Server-Sent Events connections.
- **`StreamableHttpTransport.ts`**: Handles the streamable HTTP protocol.

Each transport module will be responsible for listening for incoming connections and passing messages up to the Orchestration Layer.## 5. Backend Layer

The `McpServerManager` will be responsible for managing the lifecycle of downstream MCP servers. It will:

- **Load Server Configurations**: Read the `config.json` file to get the list of available servers.
- **Connect to Servers**: Establish connections to each server, whether it's a local `stdio` process or a remote `http`/`sse` endpoint.
- **Handle Requests**: Forward requests from the Orchestration Layer to the correct server and return the response.

## 6. Database Schema (SQLite)

For initial stateful support, we'll use a simple SQLite database with the following schema:

**`sessions` table:**

| Column | Type | Description |
|---|---|---|
| `id` | TEXT | Primary key, the session ID. |
| `transport` | TEXT | The transport type (e.g., 'websocket', 'sse'). |
| `last_activity` | INTEGER | Timestamp of the last activity. |
| `state` | TEXT | A JSON blob to store session-specific state. |