# Task 7: Unit Test WebSocketServerTransport

## Goal

Write comprehensive unit tests for the `WebSocketServerTransport` class to ensure its reliability and correctness.

## Steps

1.  **Create Test File**:
    - Create a new file at `src/server/websocket.test.ts`.

2.  **Mock Dependencies**:
    - Mock the `ws` library to simulate WebSocket clients and servers without making actual network connections.
    - Mock the `http` server.

3.  **Test Cases**:
    - **Connection Handling**:
        - Test that a new client connection triggers the `onconnection` event with a valid `clientId`.
        - Test that a client disconnection triggers the `ondisconnection` event.
    - **Message Handling**:
        - Test that incoming messages are correctly parsed and passed to the `onmessage` handler.
        - Verify that the `clientId` is correctly prepended to the message `id`.
    - **Sending Messages**:
        - Test sending a message to a specific client.
        - Test broadcasting a message to all clients.
        - Verify that the `clientId` is correctly stripped from the message `id` before sending.
    - **Error Handling**:
        - Test that invalid JSON messages trigger the `onerror` event.
        - Test that WebSocket errors are correctly propagated.