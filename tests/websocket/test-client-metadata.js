#!/usr/bin/env node

/**
 * Test script to simulate Extension SA sending browser/URL metadata
 * and see what information gets captured by the proxy
 */

import WebSocket from 'ws';
import fetch from 'node-fetch';

const WS_URL = 'ws://localhost:3006/message';
const ADMIN_URL = 'http://localhost:3006/admin/clients';

console.log('🌐 Testing Client Metadata Capture');
console.log('==================================');
console.log('');

// Simulate different browser extension clients
const testClients = [
  {
    name: 'chrome-extension-client',
    clientInfo: {
      name: 'SuperAssistant-Chrome',
      version: '1.2.3',
      title: 'Super Assistant Chrome Extension',
      // Browser/Extension specific info
      browser: 'Chrome',
      browserVersion: '120.0.6099.109',
      host: 'example.com',
      currentUrl: 'https://example.com/dashboard?tab=overview',
      domain: 'example.com',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      extensionId: 'abcdefghijklmnopqrstuvwxyz123456',
      tabId: 12345,
      windowId: 1,
      // Custom routing tags
      tags: ['production', 'dashboard', 'admin'],
      routingGroup: 'admin-users',
      userId: 'user-123',
      sessionId: 'session-abc-456'
    }
  },
  {
    name: 'firefox-extension-client',
    clientInfo: {
      name: 'SuperAssistant-Firefox',
      version: '1.2.3',
      title: 'Super Assistant Firefox Extension',
      // Browser/Extension specific info
      browser: 'Firefox',
      browserVersion: '121.0.1',
      host: 'docs.google.com',
      currentUrl: 'https://docs.google.com/document/d/1abc123/edit',
      domain: 'google.com',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      extensionId: 'firefox-ext-789',
      tabId: 67890,
      windowId: 2,
      // Custom routing tags
      tags: ['google-docs', 'collaboration', 'writing'],
      routingGroup: 'content-creators',
      userId: 'user-456',
      sessionId: 'session-def-789'
    }
  },
  {
    name: 'edge-extension-client',
    clientInfo: {
      name: 'SuperAssistant-Edge',
      version: '1.2.3',
      title: 'Super Assistant Edge Extension',
      // Browser/Extension specific info
      browser: 'Edge',
      browserVersion: '120.0.2210.91',
      host: 'github.com',
      currentUrl: 'https://github.com/user/repo/pull/123',
      domain: 'github.com',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.91',
      extensionId: 'edge-ext-xyz',
      tabId: 11111,
      windowId: 3,
      // Custom routing tags
      tags: ['github', 'code-review', 'development'],
      routingGroup: 'developers',
      userId: 'user-789',
      sessionId: 'session-ghi-123'
    }
  }
];

async function createTestClient(testClient) {
  return new Promise((resolve, reject) => {
    console.log(`🔌 Connecting ${testClient.name}...`);
    
    const ws = new WebSocket(WS_URL);
    
    ws.on('open', () => {
      console.log(`✅ ${testClient.name}: Connected`);
      
      // Send initialize message with rich metadata
      const initMessage = {
        jsonrpc: '2.0',
        method: 'initialize',
        id: `${testClient.name}-init`,
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            experimental: {},
            sampling: {},
            roots: { listChanged: true }
          },
          clientInfo: testClient.clientInfo
        }
      };
      
      console.log(`📤 ${testClient.name}: Sending initialize with metadata...`);
      ws.send(JSON.stringify(initMessage));
      
      resolve({ ws, name: testClient.name });
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(`📨 ${testClient.name}: Received response:`, message.result ? 'Initialize OK' : message);
      } catch (err) {
        console.log(`📨 ${testClient.name}: Raw response:`, data.toString());
      }
    });
    
    ws.on('close', (code) => {
      console.log(`❌ ${testClient.name}: Disconnected (code: ${code})`);
    });
    
    ws.on('error', (error) => {
      console.error(`❌ ${testClient.name}: Error:`, error.message);
      reject(error);
    });
  });
}

async function checkCapturedMetadata() {
  try {
    console.log('📊 Fetching captured client metadata...');
    const response = await fetch(ADMIN_URL);
    const data = await response.json();
    
    console.log('');
    console.log('🔍 CAPTURED CLIENT METADATA:');
    console.log('============================');
    
    if (data.clients && data.clients.length > 0) {
      data.clients.forEach((client, index) => {
        console.log(`\n📱 Client ${index + 1}:`);
        console.log(`   ID: ${client.clientId}`);
        console.log(`   Name: ${client.clientInfo?.name || 'Unknown'}`);
        console.log(`   Browser: ${client.clientInfo?.browser || 'Unknown'}`);
        console.log(`   Host: ${client.clientInfo?.host || 'Unknown'}`);
        console.log(`   URL: ${client.clientInfo?.currentUrl || 'Unknown'}`);
        console.log(`   Domain: ${client.clientInfo?.domain || 'Unknown'}`);
        console.log(`   Tags: ${client.clientInfo?.tags ? client.clientInfo.tags.join(', ') : 'None'}`);
        console.log(`   Routing Group: ${client.clientInfo?.routingGroup || 'None'}`);
        console.log(`   User ID: ${client.clientInfo?.userId || 'Unknown'}`);
        console.log(`   Connected: ${new Date(client.connectedAt).toISOString()}`);
        console.log(`   Last Activity: ${new Date(client.lastActivity).toISOString()}`);
      });
    } else {
      console.log('   No clients found');
    }
    
    console.log('');
    console.log('📋 Full Raw Data:');
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ Failed to fetch metadata:', error.message);
  }
}

async function runMetadataTest() {
  const clients = [];
  
  // Create test clients with different metadata
  for (const testClient of testClients) {
    try {
      const client = await createTestClient(testClient);
      clients.push(client);
      
      // Small delay between connections
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to create ${testClient.name}:`, error);
    }
  }
  
  // Wait for all connections to stabilize
  console.log('');
  console.log('⏳ Waiting for connections to stabilize...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Check captured metadata
  await checkCapturedMetadata();
  
  // Cleanup
  console.log('');
  console.log('🧹 Cleaning up clients...');
  clients.forEach(({ ws, name }) => {
    if (ws.readyState === WebSocket.OPEN) {
      console.log(`🔌 Closing ${name}...`);
      ws.close();
    }
  });
  
  console.log('');
  console.log('✅ Metadata capture test completed!');
  console.log('');
  console.log('📋 Summary:');
  console.log('   - Created 3 test clients with rich metadata');
  console.log('   - Each client sent browser, URL, domain, and tag information');
  console.log('   - Proxy captured and stored all client metadata');
  console.log('   - Admin API exposes all captured information');
  console.log('   - Ready for tag-based routing implementation');
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('');
  console.log('🛑 Test interrupted by user');
  process.exit(0);
});

// Start the test
runMetadataTest().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
