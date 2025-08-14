# MCP SuperAssistant Proxy

Enhanced MCP SuperAssistant Proxy with WebSocket support and advanced gateway features.

## Features

- **WebSocket Transport** - Real-time bidirectional communication
- **SSE Transport** - Server-Sent Events for streaming  
- **Streamable HTTP** - Modern HTTP streaming
- **Advanced Configuration** - Headers, CORS, health endpoints, sessions

## Quick Start

### WebSocket Transport
```bash
node dist/index.js --config config.json --outputTransport ws --port 3006
```

### SSE Transport
```bash
node dist/index.js --config config.json --outputTransport sse --port 3006
```

## WebSocket Endpoint

When using WebSocket transport, connect to:
```
ws://localhost:3006/message
```

### WebSocket Timeout Configuration

The proxy includes built-in WebSocket keep-alive functionality to prevent 30-second timeouts:

```bash
# Default settings (25s ping interval, 5s pong timeout)
node dist/index.js --config config.json --outputTransport ws --port 3006

# Custom timeout settings
node dist/index.js --config config.json --outputTransport ws --port 3006 \
  --wsPingInterval 20000 --wsPongTimeout 3000

# Disable keep-alive (not recommended)
node dist/index.js --config config.json --outputTransport ws --port 3006 \
  --wsPingInterval 0
```

**Options:**
- `--wsPingInterval`: Ping interval in milliseconds (default: 25000 = 25s)
- `--wsPongTimeout`: Pong timeout in milliseconds (default: 5000 = 5s)

**How it works:**
1. Server sends PING frames every 25 seconds (configurable)
2. Client must respond with PONG within 5 seconds (configurable)
3. If no PONG received, connection is terminated and cleaned up
4. This prevents idle connections from timing out at infrastructure level

## Client Monitoring & Management

The proxy includes built-in admin endpoints for monitoring and managing WebSocket connections:

### Admin Endpoints

```bash
# Get basic server statistics
curl http://localhost:3006/admin/stats

# Get detailed client information
curl http://localhost:3006/admin/clients

# Send message to specific client
curl -X POST http://localhost:3006/admin/clients/{clientId}/send \
  -H "Content-Type: application/json" \
  -d '{"message":{"jsonrpc":"2.0","method":"tools/list","id":"test","params":{}}}'

# Disconnect specific client
curl -X DELETE http://localhost:3006/admin/clients/{clientId}
```

### Response Examples

**Stats endpoint** (`/admin/stats`):
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "connectedClients": 3,
  "servers": 1,
  "uptime": 45.2
}
```

**Clients endpoint** (`/admin/clients`):
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "stats": {
    "connectedClients": 3,
    "servers": [
      {
        "name": "filesystem",
        "connected": true,
        "tools": 14,
        "resources": 0
      }
    ]
  },
  "clients": [
    {
      "clientId": "aa124bf0-7552-40ea-b307-98065ba1efea",
      "readyState": 1
    }
  ]
}
```

## Testing

The project includes comprehensive tests for WebSocket functionality, client metadata tracking, and admin API endpoints.

```bash
# Install dependencies and build
npm install
npm run build

# Run all tests
npm test

# Run specific test categories
npm run test:websocket    # WebSocket timeout and concurrency tests
npm run test:metadata     # Client metadata capture tests
npm run test:admin        # Admin API endpoint tests

# Run individual tests
./tests/websocket/test-websocket-fix.sh
./tests/integration/test-admin-endpoints.sh
```

See `tests/README.md` for detailed test documentation.

## Based On

This project is based on [@srbhptl39/mcp-superassistant-proxy](https://www.npmjs.com/package/@srbhptl39/mcp-superassistant-proxy) with enhancements and customizations.
