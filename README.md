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

## Based On

This project is based on [@srbhptl39/mcp-superassistant-proxy](https://www.npmjs.com/package/@srbhptl39/mcp-superassistant-proxy) with enhancements and customizations.
