# Task 8: End-to-End Test for `configToWs`

## Goal

Create an end-to-end test to verify that the `configToWs` gateway can successfully proxy requests from a WebSocket client to a downstream `stdio` MCP server.

## Steps

1.  **Create Test File**:
    - Create a new file at `src/gateways/configToWs.test.ts`.

2.  **Create a Mock `stdio` Server**:
    - In your test file, create a simple Node.js script that acts as a `stdio` MCP server.
    - This server should listen for `tools/call` requests on its standard input and send a predefined response to its standard output.

3.  **Write Test Case**:
    - **Setup**:
        - Programmatically start the `mcp-sa-proxy` using the `configToWs` gateway, configured to use your mock `stdio` server.
        - Create a WebSocket client and connect to the proxy's WebSocket endpoint.
    - **Execution**:
        - Send a `tools/call` request from the WebSocket client to the proxy.
    - **Assertion**:
        - Assert that the client receives the expected response from the mock `stdio` server.
    - **Teardown**:
        - Ensure that both the proxy and the mock `stdio` server are properly terminated after the test.