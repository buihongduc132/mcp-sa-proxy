# MCP SA Proxy - Development Setup

This directory contains the development proxy setup for the MCP SuperAssistant Proxy, providing an alternative development environment alongside the production setup in `../mcp-dc`.

## Quick Start

```bash
# Build the proxy
npm run build

# Start dev proxy (port 3108)
./run_dev.sh

# Check status
./status_dev.sh
```

## Architecture

### Dev Proxy (Port 3108)
- **WebSocket endpoint**: `ws://localhost:3108/message`
- **Configuration**: `dev-config.json`
- **Logs**: `logs/dev-proxy.log`

### Available MCP Servers

1. **Filesystem Server** (14 tools)
   - File operations in project directory
   - Root: `/home/bhd/Documents/Projects/bhd/orches-sa`
   - Tools: read_file, write_file, create_directory, list_directory, etc.

2. **Playwright Dev** (24 tools)
   - Browser automation for development
   - Chrome profile: `/home/bhd/ChromeProfiles/dev`
   - CDP endpoint: `http://localhost:9223`

## Configuration

### dev-config.json
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/bhd/Documents/Projects/bhd/orches-sa"]
    },
    "plw-dev": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"],
      "env": {
        "--cdp-endpoint": "http://localhost:9223",
        "--user-data-dir": "/home/bhd/ChromeProfiles/dev",
        "--browser": "/usr/bin/google-chrome"
      }
    }
  }
}
```

### Environment Variables
```bash
PORT=3108                    # Dev proxy port
LOG_LEVEL=debug             # Logging level
SESSION_TIMEOUT_MS=3600000  # 1 hour session timeout
```

## Scripts

### ./run_dev.sh
Starts the development proxy with:
- Port 3108 (configurable via `PORT` env var)
- Debug logging
- Enhanced session timeout
- Log output to `logs/dev-proxy.log`

### ./status_dev.sh
Comprehensive health check showing:
- Dev proxy status and PID
- MCP server status (filesystem, playwright)
- Log file information
- Recent error analysis
- System resource usage
- Exit codes: 0=healthy, 1=degraded, 2=down

## Comparison with Production

| Aspect | Production (`../mcp-dc`) | Development (`../mcp-sa-proxy`) |
|--------|-------------------------|--------------------------------|
| Port | 3007 | 3108 |
| Desktop Commander | ✅ (23 tools) | ❌ (conflicts) |
| Filesystem | ❌ | ✅ (14 tools) |
| Playwright | ✅ (prod profile) | ✅ (dev profile) |
| Chrome CDP | 9222 | 9223 |
| Use Case | Production operations | Development & testing |

## Development Workflow

1. **Start both environments**:
   ```bash
   # Production (in ../mcp-dc)
   cd ../mcp-dc && ./run_prod.sh
   
   # Development (in ../mcp-sa-proxy)
   cd ../mcp-sa-proxy && ./run_dev.sh
   ```

2. **Monitor health**:
   ```bash
   # Check production
   ../mcp-dc/status.sh
   
   # Check development
   ./status_dev.sh
   ```

3. **Use different endpoints**:
   - Production: `ws://localhost:3007/message`
   - Development: `ws://localhost:3108/message`

## Troubleshooting

### Common Issues

1. **Port conflicts**: Change `PORT` environment variable
2. **Chrome CDP conflicts**: Ensure different CDP ports (9222 vs 9223)
3. **Profile conflicts**: Use separate Chrome profiles

### Logs
```bash
# View dev proxy logs
tail -f logs/dev-proxy.log

# Check for errors
grep -i error logs/dev-proxy.log
```

### Recovery
```bash
# Kill dev proxy
pkill -f "node.*dist/index.js.*dev-config.json"

# Restart
./run_dev.sh
```

## Benefits

- **Isolated development environment** - No conflicts with production
- **Different tool sets** - Filesystem tools for development tasks
- **Separate browser profiles** - Clean testing environment
- **Independent monitoring** - Dedicated status and logging
- **Flexible configuration** - Easy to modify for testing

This setup allows you to run both production and development MCP environments simultaneously, each optimized for their specific use cases.
