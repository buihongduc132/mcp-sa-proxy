#!/usr/bin/env node

/**
 * Test script to verify WebSocket timeout functionality
 * This script connects to a WebSocket server and tests the ping/pong mechanism
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3006/message';
const TEST_DURATION = 60000; // 60 seconds

console.log('WebSocket Timeout Test');
console.log('====================');
console.log(`Connecting to: ${WS_URL}`);
console.log(`Test duration: ${TEST_DURATION / 1000} seconds`);
console.log('');

const ws = new WebSocket(WS_URL);
let pingCount = 0;
let pongCount = 0;
let startTime = Date.now();

ws.on('open', () => {
  console.log('✅ WebSocket connected successfully');
  console.log('Waiting for ping/pong messages...');
  console.log('');
});

ws.on('ping', (data) => {
  pingCount++;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`📡 Received PING #${pingCount} at ${elapsed}s`);
  // WebSocket automatically sends pong response
});

ws.on('pong', (data) => {
  pongCount++;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`📡 Received PONG #${pongCount} at ${elapsed}s`);
});

ws.on('close', (code, reason) => {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('');
  console.log(`❌ WebSocket closed at ${elapsed}s`);
  console.log(`   Code: ${code}`);
  console.log(`   Reason: ${reason.toString()}`);
  console.log(`   Total PINGs received: ${pingCount}`);
  console.log(`   Total PONGs received: ${pongCount}`);
  
  if (elapsed < 30) {
    console.log('⚠️  Connection closed before 30s - this might indicate a timeout issue');
  } else {
    console.log('✅ Connection lasted longer than 30s - timeout issue likely resolved');
  }
});

ws.on('error', (error) => {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('');
  console.log(`❌ WebSocket error at ${elapsed}s:`, error.message);
});

// Send a test message to initialize the connection
ws.on('open', () => {
  setTimeout(() => {
    const testMessage = {
      jsonrpc: '2.0',
      method: 'initialize',
      id: 1,
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'websocket-timeout-test',
          version: '1.0.0'
        }
      }
    };
    
    console.log('📤 Sending test initialize message...');
    ws.send(JSON.stringify(testMessage));
  }, 1000);
});

// Auto-close after test duration
setTimeout(() => {
  if (ws.readyState === WebSocket.OPEN) {
    console.log('');
    console.log(`⏰ Test duration (${TEST_DURATION / 1000}s) reached, closing connection...`);
    ws.close();
  }
}, TEST_DURATION);

// Handle process termination
process.on('SIGINT', () => {
  console.log('');
  console.log('🛑 Test interrupted by user');
  if (ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
  process.exit(0);
});
