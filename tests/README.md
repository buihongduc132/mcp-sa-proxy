# MCP SA Proxy Tests

This directory contains comprehensive tests for the MCP Super Assistant Proxy.

## Test Structure

```
tests/
├── configs/           # Test configuration files
├── websocket/         # WebSocket-specific tests
├── integration/       # Integration and admin API tests
├── unit/             # Unit tests (future)
└── run-all-tests.sh  # Main test runner
```

## Test Categories

### WebSocket Tests (`tests/websocket/`)
- **`test-websocket-timeout.js`** - Tests WebSocket timeout and keep-alive functionality
- **`test-websocket-fix.sh`** - Integration test for WebSocket timeout fix
- **`test-concurrent-websockets.js`** - Tests multiple concurrent WebSocket connections
- **`test-client-metadata.js`** - Tests client metadata capture and tracking

### Integration Tests (`tests/integration/`)
- **`test-admin-endpoints.sh`** - Tests admin API endpoints for monitoring

### Configuration Files (`tests/configs/`)
- **`test-config.json`** - Basic test configuration with filesystem server
- **`test-config-simple.json`** - Minimal test configuration

## Running Tests

### Run All Tests
```bash
./tests/run-all-tests.sh
```

### Run Specific Test Categories
```bash
# WebSocket tests only
./tests/run-websocket-tests.sh

# Integration tests only  
./tests/run-integration-tests.sh
```

### Run Individual Tests
```bash
# Test WebSocket timeout fix
./tests/websocket/test-websocket-fix.sh

# Test client metadata capture
cd tests/websocket && node test-client-metadata.js

# Test admin endpoints
./tests/integration/test-admin-endpoints.sh
```

## Test Requirements

- Node.js and npm installed
- Project built (`npm run build`)
- Available ports: 3006 (default test port)

## Test Features Covered

### ✅ WebSocket Functionality
- Connection establishment and management
- Ping/pong keep-alive mechanism
- Multiple concurrent connections
- Connection timeout prevention
- Client metadata capture

### ✅ Admin API
- Client monitoring endpoints
- Connection statistics
- Targeted client messaging
- Client disconnection management

### ✅ Client Metadata Tracking
- Browser information (Chrome, Firefox, Edge)
- URL and domain tracking
- Custom tags and routing groups
- Extension-specific metadata
- User and session identification

## Expected Test Results

All tests should pass with:
- ✅ Connections lasting longer than 30 seconds
- ✅ Multiple clients connecting simultaneously
- ✅ Rich metadata capture from initialize requests
- ✅ Admin API returning client information
- ✅ Proper cleanup on disconnection
