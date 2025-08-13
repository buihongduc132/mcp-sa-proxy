# Task 3: Create `configToWs` Gateway

## Goal

Implement the `configToWs` gateway, which will serve as the main entry point for WebSocket connections when the proxy is started with a `--config` file.

## Requirements

1.  **Create `src/gateways/configToWs.ts`**: This will contain the `configToWs` function.

2.  **Function Signature**: The function should accept an arguments object containing `configPath`, `port`, `host`, `messagePath`, `logger`, etc.

3.  **Initialization**:
    - Create an instance of `McpServerManager` to handle the backend servers.
    - Load the configuration from the `configPath` and initialize all servers defined in it.
    - Create an `express` app and an `http` server.

4.  **WebSocket Server Setup**:
    - Instantiate the `WebSocketServerTransport` from the previous task, attaching it to the `http` server.
    - Connect the transport to a new `Server` instance from the `@modelcontextprotocol/sdk`.

5.  **Request Handling**:
    - When a message is received from a client via the WebSocket transport, pass it to the `McpServerManager`'s `handleRequest` method.
    - The `handleRequest` method will be responsible for routing the request to the correct downstream server.
    - Send the response from the `McpServerManager` back to the client through the WebSocket transport.

6.  **Client ID Management**:
    - Ensure that the `clientId` from the WebSocket transport is correctly passed along so that responses can be routed to the appropriate client.