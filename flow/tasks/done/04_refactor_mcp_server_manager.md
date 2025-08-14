# Task 4: Refactor McpServerManager

## Goal

Refactor the `McpServerManager` to be more robust and to support the new modular architecture. This manager is the central point for handling all downstream MCP servers.

## Requirements

1.  **Update `src/lib/mcpServerManager.ts`**: All changes will be within this file.

2.  **Connection Management**:
    - The `addServer` method should be able to handle different server types (`stdio`, `sse`, `streamable-http`) by using the appropriate client transport from the SDK.
    - It should gracefully handle connection errors and prevent a single failed server from crashing the entire proxy.

3.  **Request Routing**:
    - The `handleRequest` method needs to be enhanced to correctly parse tool and resource names that are prefixed with the server name (e.g., `filesystem.readFile`).
    - It must route the request to the correct `Client` instance based on the server name prefix.
    - For requests without a prefix (e.g., `initialize`), it should handle them directly or broadcast them if necessary.

4.  **Tool and Resource Aggregation**:
    - The `tools/list` and `resources/list` methods must iterate through all connected servers and aggregate their tools and resources into a single list.
    - All tool and resource names must be prefixed with their server name (e.g., `filesystem.list`, `brave_search.search`).

5.  **Graceful Shutdown**:
    - The `cleanup` method should properly terminate all child processes for `stdio` servers and disconnect from all remote servers.