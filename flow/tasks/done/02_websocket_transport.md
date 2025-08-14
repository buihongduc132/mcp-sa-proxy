# Task 2: Implement WebSocket Transport Layer

## Goal

Create a robust `WebSocketServerTransport` class that can handle multiple client connections, manage their lifecycle, and route messages to and from the orchestration layer.

## Requirements

1.  **Create `src/server/websocket.ts`**: This file will contain the `WebSocketServerTransport` class.

2.  **Implement the `Transport` Interface**: The class must implement the `Transport` interface from the `@modelcontextprotocol/sdk`.

3.  **Connection Handling**:
    - When a new client connects, generate a unique `clientId` using `uuid`.
    - Store the client's WebSocket connection in a `Map` keyed by the `clientId`.
    - Emit an `onconnection` event with the `clientId`.

4.  **Message Handling**:
    - When a message is received from a client, parse the JSON.
    - Prepend the `clientId` to the message's `id` field (e.g., `clientId:originalId`) before passing it to the `onmessage` handler. This is crucial for routing responses back to the correct client.

5.  **Sending Messages**:
    - The `send` method should be able to send a message to a specific client (by `clientId`) or broadcast to all connected clients.
    - It must strip the `clientId` prefix from the response message's `id` before sending it back to the client.

6.  **Disconnection and Error Handling**:
    - When a client disconnects, remove it from the client `Map` and emit an `ondisconnection` event.
    - Properly handle and log any WebSocket errors, emitting an `onerror` event.