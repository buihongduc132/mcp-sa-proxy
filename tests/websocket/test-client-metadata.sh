#!/bin/bash

# Wrapper script for client metadata test

set -e

echo "🌐 Client Metadata Capture Test"
echo "==============================="
echo ""

# Start server in background
echo "🚀 Starting WebSocket proxy server..."
node ../../dist/index.js --config ../configs/test-config.json --outputTransport ws --port 3006 \
  --wsPingInterval 20000 --wsPongTimeout 3000 --logLevel info &

SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 3

# Check if server is running
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "❌ Server failed to start"
    exit 1
fi

echo "✅ Server started successfully (PID: $SERVER_PID)"
echo ""

# Run the metadata test
echo "🧪 Running client metadata test..."
node test-client-metadata.js

# Cleanup
echo ""
echo "🧹 Cleaning up..."
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true

echo "✅ Client metadata test completed!"
