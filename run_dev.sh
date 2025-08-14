#!/usr/bin/env bash
set -euo pipefail

# Dev proxy launcher for mcp-sa-proxy
# Default: port 3008, WS transport, long timeouts for agent sessions.
# Usage:
#   PORT=3208 LOG_LEVEL=debug ./run_dev.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="$SCRIPT_DIR/dev-config.json"

if [[ ! -f "$CONFIG" ]]; then
  echo "[ERROR] Missing config: $CONFIG" >&2
  exit 1
fi

PORT="${PORT:-3108}"
LOG_LEVEL="${LOG_LEVEL:-debug}"
SESSION_TIMEOUT_MS="${SESSION_TIMEOUT_MS:-3600000}"

# Create logs directory if it doesn't exist
mkdir -p logs

# Set environment variables for enhanced logging
export NODE_ENV=development
export MCP_SERVER_NAME=mcp-sa-proxy-dev
export MCP_DEBUG=true
export ENABLE_VERBOSE_LOGGING=true
export ENABLE_FILE_LOGGING=true
export LOG_LEVEL=debug

echo "[DEV] Starting mcp-sa-proxy on port $PORT with $CONFIG"
echo "[DEV] LOG_LEVEL=$LOG_LEVEL SESSION_TIMEOUT_MS=$SESSION_TIMEOUT_MS"
echo "[DEV] Proxy logs: $(pwd)/logs/dev-proxy.log"
echo "[DEV] Session timeout: ${SESSION_TIMEOUT_MS}ms (1 hour)"

exec npm run start -- \
  --config "$CONFIG" \
  --outputTransport ws \
  --logLevel "$LOG_LEVEL" \
  --port "$PORT" \
  --sessionTimeout "$SESSION_TIMEOUT_MS" \
  2>&1 | tee logs/dev-proxy.log
