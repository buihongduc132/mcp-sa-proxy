#!/usr/bin/env node

/**
 * Test script to demonstrate client monitoring and management capabilities
 */

import WebSocket from 'ws';
import fetch from 'node-fetch';

const WS_URL = 'ws://localhost:3006/message';
const ADMIN_BASE_URL = 'http://localhost:3006/admin';

console.log('🔍 WebSocket Client Monitoring Test');
console.log('===================================');
console.log('');

// Helper function to make admin API calls
async function adminAPI(endpoint, options = {}) {
  try {
    const response = await fetch(`${ADMIN_BASE_URL}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    return await response.json();
  } catch (error) {
    console.error(`❌ Admin API error (${endpoint}):`, error.message);
    return null;
  }
}

// Helper function to create a WebSocket client
function createClient(clientName) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let clientId = null;
    
    ws.on('open', () => {
      console.log(`✅ ${clientName}: Connected`);
      
      // Send initialize message to get started
      const initMessage = {
        jsonrpc: '2.0',
        method: 'initialize',
        id: `${clientName}-init`,
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: clientName, version: '1.0.0' }
        }
      };
      
      ws.send(JSON.stringify(initMessage));
      resolve({ ws, clientName });
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(`📨 ${clientName}: Received:`, message.method || 'response');
      } catch (err) {
        console.log(`📨 ${clientName}: Raw message:`, data.toString());
      }
    });
    
    ws.on('ping', () => {
      console.log(`📡 ${clientName}: PING received`);
    });
    
    ws.on('close', (code) => {
      console.log(`❌ ${clientName}: Disconnected (code: ${code})`);
    });
    
    ws.on('error', (error) => {
      console.error(`❌ ${clientName}: Error:`, error.message);
      reject(error);
    });
  });
}

async function runMonitoringTest() {
  console.log('🚀 Step 1: Creating multiple WebSocket clients...');
  
  // Create 3 clients
  const clients = [];
  for (let i = 1; i <= 3; i++) {
    try {
      const client = await createClient(`TestClient${i}`);
      clients.push(client);
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
    } catch (error) {
      console.error(`Failed to create client ${i}:`, error);
      return;
    }
  }
  
  console.log('');
  console.log('📊 Step 2: Checking admin stats...');
  
  // Wait a moment for connections to stabilize
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Get basic stats
  const stats = await adminAPI('/stats');
  if (stats) {
    console.log('📈 Server Stats:', {
      connectedClients: stats.connectedClients,
      servers: stats.servers,
      uptime: `${stats.uptime.toFixed(1)}s`
    });
  }
  
  console.log('');
  console.log('👥 Step 3: Getting detailed client information...');
  
  // Get detailed client info
  const clientsInfo = await adminAPI('/clients');
  if (clientsInfo) {
    console.log('📋 Connected Clients:');
    clientsInfo.clients.forEach((client, index) => {
      console.log(`   ${index + 1}. ID: ${client.clientId.substring(0, 8)}... | State: ${client.readyState === 1 ? 'OPEN' : 'CLOSED'}`);
    });
    
    console.log('🖥️  Server Info:');
    clientsInfo.stats.servers.forEach(server => {
      console.log(`   - ${server.name}: ${server.connected ? '✅' : '❌'} | Tools: ${server.tools} | Resources: ${server.resources}`);
    });
  }
  
  console.log('');
  console.log('📤 Step 4: Sending message to specific client...');
  
  if (clientsInfo && clientsInfo.clients.length > 0) {
    const targetClientId = clientsInfo.clients[0].clientId;
    console.log(`🎯 Targeting client: ${targetClientId.substring(0, 8)}...`);
    
    const customMessage = {
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 'admin-test-message',
      params: {}
    };
    
    const sendResult = await adminAPI(`/clients/${targetClientId}/send`, {
      method: 'POST',
      body: JSON.stringify({ message: customMessage })
    });
    
    if (sendResult && sendResult.success) {
      console.log('✅ Message sent successfully to specific client');
    } else {
      console.log('❌ Failed to send message:', sendResult);
    }
  }
  
  console.log('');
  console.log('⏳ Step 5: Waiting to observe keep-alive pings...');
  console.log('   (Waiting 25 seconds for ping interval...)');
  
  // Wait for ping interval (25 seconds)
  await new Promise(resolve => setTimeout(resolve, 26000));
  
  console.log('');
  console.log('🔌 Step 6: Disconnecting one client via admin API...');
  
  if (clientsInfo && clientsInfo.clients.length > 1) {
    const targetClientId = clientsInfo.clients[1].clientId;
    console.log(`🎯 Disconnecting client: ${targetClientId.substring(0, 8)}...`);
    
    const disconnectResult = await adminAPI(`/clients/${targetClientId}`, {
      method: 'DELETE'
    });
    
    if (disconnectResult && disconnectResult.success) {
      console.log('✅ Client disconnected successfully via admin API');
    } else {
      console.log('❌ Failed to disconnect client:', disconnectResult);
    }
  }
  
  console.log('');
  console.log('📊 Step 7: Final stats check...');
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const finalStats = await adminAPI('/stats');
  if (finalStats) {
    console.log('📈 Final Stats:', {
      connectedClients: finalStats.connectedClients,
      servers: finalStats.servers,
      uptime: `${finalStats.uptime.toFixed(1)}s`
    });
  }
  
  console.log('');
  console.log('🧹 Cleaning up remaining clients...');
  
  // Close remaining clients
  clients.forEach(({ ws, clientName }) => {
    if (ws.readyState === WebSocket.OPEN) {
      console.log(`🔌 Closing ${clientName}...`);
      ws.close();
    }
  });
  
  console.log('');
  console.log('✅ Monitoring test completed!');
  console.log('');
  console.log('📋 Summary of capabilities demonstrated:');
  console.log('   ✅ Multiple concurrent WebSocket connections');
  console.log('   ✅ Real-time client count monitoring');
  console.log('   ✅ Detailed client information retrieval');
  console.log('   ✅ Send messages to specific clients');
  console.log('   ✅ Disconnect clients via admin API');
  console.log('   ✅ Keep-alive ping/pong mechanism');
  console.log('   ✅ Server and backend status monitoring');
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('');
  console.log('🛑 Test interrupted by user');
  process.exit(0);
});

// Start the test
runMonitoringTest().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
