# MCP SuperAssistant Proxy Tests

This directory contains tests for the MCP SuperAssistant Proxy.

## Test Categories

### Unit Tests

Unit tests are written using Jest and are located in the `__tests__` directories throughout the codebase. These tests verify the functionality of individual components in isolation.

To run unit tests:

```bash
npm run test:unit
```

To run unit tests with coverage:

```bash
npm run test:coverage
```

### Integration Tests

Integration tests verify that different components work together correctly.

- **Admin Endpoints**: Tests the admin endpoints for monitoring and management.
  ```bash
  npm run test:admin
  ```

### WebSocket Tests

Tests for the WebSocket transport functionality.

- **WebSocket Timeout Fix**: Tests the WebSocket timeout handling.
  ```bash
  npm run test:websocket
  ```

- **Concurrent Connections**: Tests handling multiple WebSocket connections simultaneously.

### Metadata Tests

Tests for client metadata capture and handling.

- **Client Metadata Capture**: Tests the capture and storage of client metadata.
  ```bash
  npm run test:metadata
  ```

## Running All Tests

To run all tests:

```bash
npm test
```

This will execute the `run-all-tests.sh` script, which runs all test categories in sequence and provides a summary of the results.

## Coverage Requirements

The project aims for 90% code coverage across all files. The Jest configuration in `jest.config.js` enforces this threshold.

## Adding New Tests

When adding new functionality, please add corresponding tests:

1. For unit tests, add them to the appropriate `__tests__` directory.
2. For integration or specialized tests, add them to the relevant subdirectory in `tests/`.
3. Update `run-all-tests.sh` if you add a new test category.

## Test Structure

- `tests/run-all-tests.sh`: Main test runner script
- `tests/integration/`: Integration tests
- `tests/websocket/`: WebSocket-specific tests
- `src/**/__tests__/`: Unit tests for specific components

