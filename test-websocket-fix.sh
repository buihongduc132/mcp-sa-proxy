#!/bin/bash

# Test script to demonstrate WebSocket timeout fix
# This script starts the proxy server and runs a timeout test

set -e

echo "🚀 WebSocket Timeout Fix Test"
echo "============================="
echo ""

# Check if required dependencies are available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed"
    exit 1
fi

if ! command -v npx &> /dev/null; then
    echo "❌ npx is required but not installed"
    exit 1
fi

# Build the project
echo "📦 Building project..."
npm run build

# Start the proxy server in background
echo "🌐 Starting WebSocket proxy server..."
echo "   Config: test-config.json"
echo "   Port: 3006"
echo "   Ping interval: 20s (faster than default for testing)"
echo "   Pong timeout: 3s"
echo ""

# Start server with custom timeout settings for faster testing
node dist/index.js --config test-config.json --outputTransport ws --port 3006 \
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

# Run the WebSocket timeout test
echo "🧪 Running WebSocket timeout test..."
echo "   This will test the connection for 60 seconds"
echo "   You should see PING messages every 20 seconds"
echo "   Press Ctrl+C to stop the test early"
echo ""

# Run the test client
node test-websocket-timeout.js

# Cleanup
echo ""
echo "🧹 Cleaning up..."
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true

echo "✅ Test completed!"
echo ""
echo "📋 Results Summary:"
echo "   - If you saw PING messages every 20s, the keep-alive is working"
echo "   - If the connection lasted > 30s, the timeout fix is successful"
echo "   - If the connection closed before 30s, there may still be issues"
