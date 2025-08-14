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

## Based On

This project is based on [@srbhptl39/mcp-superassistant-proxy](https://www.npmjs.com/package/@srbhptl39/mcp-superassistant-proxy) with enhancements and customizations.
