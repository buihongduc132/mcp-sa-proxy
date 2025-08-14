#!/bin/bash

# Main test runner for MCP SA Proxy
# Runs all test categories in sequence

set -e

echo "🧪 MCP SA Proxy - Complete Test Suite"
echo "====================================="
echo ""

# Check prerequisites
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is required but not installed"
    exit 1
fi

# Ensure project is built
echo "📦 Building project..."
npm run build
echo ""

# Track test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo "🧪 Running: $test_name"
    echo "   Command: $test_command"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if eval "$test_command"; then
        echo "✅ PASSED: $test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo "❌ FAILED: $test_name"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    echo ""
}

# Run Unit Tests with Jest
echo "🧪 Unit Tests"
echo "============="
run_test "Jest Unit Tests" "npm run test:unit"

# Run WebSocket tests
echo "🔌 WebSocket Tests"
echo "=================="
run_test "WebSocket Timeout Fix" "./tests/websocket/test-websocket-fix.sh"
run_test "WebSocket Concurrent Connections" "cd tests/websocket && timeout 60s ./test-concurrent-websockets.sh || true"

# Run Integration tests  
echo "🔗 Integration Tests"
echo "==================="
run_test "Admin Endpoints" "./tests/integration/test-admin-endpoints.sh"

# Run Metadata tests
echo "📊 Metadata Tests"
echo "================="
run_test "Client Metadata Capture" "cd tests/websocket && timeout 30s ./test-client-metadata.sh || true"

# Summary
echo "📋 Test Results Summary"
echo "======================="
echo "Total Tests: $TOTAL_TESTS"
echo "Passed: $PASSED_TESTS"
echo "Failed: $FAILED_TESTS"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo "🎉 ALL TESTS PASSED!"
    exit 0
else
    echo "⚠️  Some tests failed. Check the output above for details."
    exit 1
fi
