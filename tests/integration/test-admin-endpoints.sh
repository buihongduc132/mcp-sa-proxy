#!/bin/bash

# Test script to demonstrate admin endpoints for monitoring WebSocket clients

echo "🔍 Testing WebSocket Admin Endpoints"
echo "===================================="
echo ""

# Start the server in background
echo "🚀 Starting WebSocket proxy server..."
node ../../dist/index.js --config ../configs/test-config.json --outputTransport ws --port 3006 \
  --wsPingInterval 20000 --wsPongTimeout 3000 --logLevel info &

SERVER_PID=$!
echo "   Server PID: $SERVER_PID"

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 3

# Check if server is running
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "❌ Server failed to start"
    exit 1
fi

echo "✅ Server started successfully"
echo ""

# Test basic stats endpoint
echo "📊 Testing /admin/stats endpoint:"
echo "curl http://localhost:3006/admin/stats"
curl -s http://localhost:3006/admin/stats | jq '.' || curl -s http://localhost:3006/admin/stats
echo ""
echo ""

# Test detailed clients endpoint  
echo "👥 Testing /admin/clients endpoint:"
echo "curl http://localhost:3006/admin/clients"
curl -s http://localhost:3006/admin/clients | jq '.' || curl -s http://localhost:3006/admin/clients
echo ""
echo ""

# Create a WebSocket client in background for testing
echo "🔌 Creating a test WebSocket client..."
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3006/message');
ws.on('open', () => {
  console.log('✅ Test client connected');
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'initialize',
    id: 'test-init',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'curl-test-client', version: '1.0.0' }
    }
  }));
});
ws.on('message', (data) => {
  console.log('📨 Test client received response');
});
setTimeout(() => {
  console.log('⏳ Test client staying connected for 30 seconds...');
}, 1000);
setTimeout(() => {
  console.log('🔌 Test client disconnecting...');
  ws.close();
}, 30000);
" &

CLIENT_PID=$!

# Wait for client to connect
sleep 2

echo ""
echo "📊 Stats after client connection:"
curl -s http://localhost:3006/admin/stats | jq '.' || curl -s http://localhost:3006/admin/stats
echo ""
echo ""

echo "👥 Client details after connection:"
curl -s http://localhost:3006/admin/clients | jq '.' || curl -s http://localhost:3006/admin/clients
echo ""
echo ""

# Get client ID for targeted operations
CLIENT_ID=$(curl -s http://localhost:3006/admin/clients | jq -r '.clients[0].clientId' 2>/dev/null)

if [ "$CLIENT_ID" != "null" ] && [ -n "$CLIENT_ID" ]; then
    echo "🎯 Found client ID: ${CLIENT_ID:0:8}..."
    echo ""
    
    echo "📤 Testing send message to specific client:"
    echo "curl -X POST http://localhost:3006/admin/clients/$CLIENT_ID/send"
    curl -s -X POST http://localhost:3006/admin/clients/$CLIENT_ID/send \
      -H "Content-Type: application/json" \
      -d '{"message":{"jsonrpc":"2.0","method":"tools/list","id":"admin-test","params":{}}}' \
      | jq '.' || curl -s -X POST http://localhost:3006/admin/clients/$CLIENT_ID/send \
      -H "Content-Type: application/json" \
      -d '{"message":{"jsonrpc":"2.0","method":"tools/list","id":"admin-test","params":{}}}'
    echo ""
    echo ""
    
    # Wait a moment
    sleep 2
    
    echo "🔌 Testing disconnect specific client:"
    echo "curl -X DELETE http://localhost:3006/admin/clients/$CLIENT_ID"
    curl -s -X DELETE http://localhost:3006/admin/clients/$CLIENT_ID \
      | jq '.' || curl -s -X DELETE http://localhost:3006/admin/clients/$CLIENT_ID
    echo ""
    echo ""
    
    # Check stats after disconnect
    sleep 1
    echo "📊 Stats after client disconnect:"
    curl -s http://localhost:3006/admin/stats | jq '.' || curl -s http://localhost:3006/admin/stats
    echo ""
else
    echo "⚠️  No clients found for targeted testing"
    echo ""
fi

# Cleanup
echo "🧹 Cleaning up..."
kill $CLIENT_PID 2>/dev/null || true
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true

echo ""
echo "✅ Admin endpoints test completed!"
echo ""
echo "📋 Available Admin Endpoints:"
echo "   GET  /admin/stats              - Basic server statistics"
echo "   GET  /admin/clients            - Detailed client information"
echo "   POST /admin/clients/:id/send   - Send message to specific client"
echo "   DELETE /admin/clients/:id      - Disconnect specific client"
