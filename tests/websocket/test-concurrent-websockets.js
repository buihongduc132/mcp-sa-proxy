#!/usr/bin/env node

/**
 * Test script to verify WebSocket server can handle multiple concurrent connections
 * and long-running requests without blocking other clients
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3006/message';
const NUM_CLIENTS = 5;
const TEST_DURATION = 45000; // 45 seconds

console.log('🔄 WebSocket Concurrent Connections Test');
console.log('=======================================');
console.log(`Server: ${WS_URL}`);
console.log(`Clients: ${NUM_CLIENTS}`);
console.log(`Duration: ${TEST_DURATION / 1000}s`);
console.log('');

class WebSocketClient {
  constructor(clientId) {
    this.clientId = clientId;
    this.ws = null;
    this.connected = false;
    this.requestCount = 0;
    this.responseCount = 0;
    this.pingCount = 0;
    this.startTime = Date.now();
    this.lastActivity = Date.now();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      
      this.ws.on('open', () => {
        this.connected = true;
        console.log(`✅ Client ${this.clientId}: Connected`);
        resolve();
      });

      this.ws.on('message', (data) => {
        this.lastActivity = Date.now();
        try {
          const message = JSON.parse(data.toString());
          if (message.id && message.result) {
            this.responseCount++;
            const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
            console.log(`📨 Client ${this.clientId}: Response #${this.responseCount} at ${elapsed}s`);
          }
        } catch (err) {
          console.log(`⚠️  Client ${this.clientId}: Parse error:`, err.message);
        }
      });

      this.ws.on('ping', () => {
        this.pingCount++;
        this.lastActivity = Date.now();
        const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
        console.log(`📡 Client ${this.clientId}: PING #${this.pingCount} at ${elapsed}s`);
      });

      this.ws.on('close', (code, reason) => {
        this.connected = false;
        const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
        console.log(`❌ Client ${this.clientId}: Disconnected at ${elapsed}s (code: ${code})`);
      });

      this.ws.on('error', (error) => {
        console.log(`❌ Client ${this.clientId}: Error:`, error.message);
        reject(error);
      });

      // Timeout for connection
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error(`Client ${this.clientId}: Connection timeout`));
        }
      }, 5000);
    });
  }

  sendRequest(method, params = {}) {
    if (!this.connected || this.ws.readyState !== WebSocket.OPEN) {
      console.log(`⚠️  Client ${this.clientId}: Cannot send - not connected`);
      return;
    }

    this.requestCount++;
    const request = {
      jsonrpc: '2.0',
      method: method,
      id: `${this.clientId}-${this.requestCount}`,
      params: params
    };

    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log(`📤 Client ${this.clientId}: Sending ${method} #${this.requestCount} at ${elapsed}s`);
    this.ws.send(JSON.stringify(request));
  }

  getStats() {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const timeSinceLastActivity = ((Date.now() - this.lastActivity) / 1000).toFixed(1);
    return {
      clientId: this.clientId,
      connected: this.connected,
      elapsed: elapsed,
      requests: this.requestCount,
      responses: this.responseCount,
      pings: this.pingCount,
      lastActivity: timeSinceLastActivity
    };
  }

  close() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }
}

async function runTest() {
  const clients = [];
  
  // Create and connect all clients
  console.log('🚀 Creating clients...');
  for (let i = 1; i <= NUM_CLIENTS; i++) {
    const client = new WebSocketClient(i);
    clients.push(client);
    
    try {
      await client.connect();
      // Small delay between connections
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.log(`❌ Failed to connect client ${i}:`, error.message);
      return;
    }
  }

  console.log('');
  console.log('🧪 Starting concurrent test...');
  
  // Send initial requests
  setTimeout(() => {
    clients.forEach(client => {
      client.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: `test-client-${client.clientId}`,
          version: '1.0.0'
        }
      });
    });
  }, 1000);

  // Send periodic requests to test concurrency
  const requestInterval = setInterval(() => {
    clients.forEach((client, index) => {
      if (client.connected) {
        // Alternate between different request types
        if (index % 2 === 0) {
          client.sendRequest('tools/list');
        } else {
          client.sendRequest('resources/list');
        }
      }
    });
  }, 8000); // Every 8 seconds

  // Print stats periodically
  const statsInterval = setInterval(() => {
    console.log('');
    console.log('📊 Current Stats:');
    clients.forEach(client => {
      const stats = client.getStats();
      console.log(`   Client ${stats.clientId}: ${stats.connected ? '🟢' : '🔴'} | Req: ${stats.requests} | Res: ${stats.responses} | Pings: ${stats.pings} | Last: ${stats.lastActivity}s ago`);
    });
  }, 15000); // Every 15 seconds

  // Test completion
  setTimeout(() => {
    clearInterval(requestInterval);
    clearInterval(statsInterval);
    
    console.log('');
    console.log('🏁 Test completed! Final results:');
    console.log('================================');
    
    let totalRequests = 0;
    let totalResponses = 0;
    let totalPings = 0;
    let connectedClients = 0;
    
    clients.forEach(client => {
      const stats = client.getStats();
      totalRequests += stats.requests;
      totalResponses += stats.responses;
      totalPings += stats.pings;
      if (stats.connected) connectedClients++;
      
      console.log(`Client ${stats.clientId}: ${stats.connected ? '✅ Connected' : '❌ Disconnected'} | Requests: ${stats.requests} | Responses: ${stats.responses} | PINGs: ${stats.pings}`);
      client.close();
    });
    
    console.log('');
    console.log('📈 Summary:');
    console.log(`   Connected clients: ${connectedClients}/${NUM_CLIENTS}`);
    console.log(`   Total requests: ${totalRequests}`);
    console.log(`   Total responses: ${totalResponses}`);
    console.log(`   Total PINGs: ${totalPings}`);
    console.log(`   Success rate: ${totalResponses > 0 ? ((totalResponses / totalRequests) * 100).toFixed(1) : 0}%`);
    
    if (connectedClients === NUM_CLIENTS && totalPings > 0) {
      console.log('');
      console.log('✅ SUCCESS: All clients maintained connections with keep-alive working!');
    } else {
      console.log('');
      console.log('⚠️  ISSUES: Some clients disconnected or keep-alive not working properly');
    }
    
  }, TEST_DURATION);
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('');
  console.log('🛑 Test interrupted by user');
  process.exit(0);
});

// Start the test
runTest().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
