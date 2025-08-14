#!/usr/bin/env bash
set -euo pipefail

# Quick status check for MCP SA Proxy Dev setup

echo "=== MCP SA Proxy Dev Status Check ==="
echo "Timestamp: $(date)"
echo

# Check if dev proxy is running
echo "1. Dev Proxy Status:"
DEV_PROXY_PID=$(pgrep -f "node.*dist/index.js.*dev-config.json" | head -1 || echo "")
if [[ -n "$DEV_PROXY_PID" ]]; then
    echo "   ✅ Dev Proxy running (PID: $DEV_PROXY_PID)"
    echo "   📍 Port: 3108"
    echo "   🌐 WebSocket: ws://localhost:3108/message"
else
    echo "   ❌ Dev Proxy not running"
fi
echo

# Check servers
echo "2. MCP Servers:"
if [[ -n "$DEV_PROXY_PID" ]]; then
    # Check filesystem server (look for @model in process tree)
    FS_PID=$(pstree -p "$DEV_PROXY_PID" 2>/dev/null | grep "@model" | grep -o "node([0-9]*)" | grep -o "[0-9]*" | head -1 || echo "")
    if [[ -n "$FS_PID" ]]; then
        echo "   ✅ Filesystem server running (PID: $FS_PID)"
        echo "      📁 Root: /home/bhd/Documents/Projects/bhd/orches-sa"
    else
        echo "   ❌ Filesystem server not running"
    fi

    # Check Playwright server (look for @playw in process tree)
    PLW_PID=$(pstree -p "$DEV_PROXY_PID" 2>/dev/null | grep "@playw" | grep -o "node([0-9]*)" | grep -o "[0-9]*" | head -1 || echo "")
    if [[ -n "$PLW_PID" ]]; then
        echo "   ✅ Playwright server running (PID: $PLW_PID)"
    else
        echo "   ❌ Playwright server not running"
    fi
else
    echo "   ❓ Cannot check (dev proxy not running)"
fi
echo

# Check log files
echo "3. Log Files:"
for log_file in "logs/dev-proxy.log"; do
    if [[ -f "$log_file" ]]; then
        SIZE=$(du -h "$log_file" | cut -f1)
        LINES=$(wc -l < "$log_file")
        echo "   📄 $log_file: $SIZE ($LINES lines)"
    else
        echo "   ❌ $log_file: Not found"
    fi
done
echo

# Check recent errors
echo "4. Recent Issues:"
ERROR_COUNT=0

# Check dev proxy log for errors (excluding harmless resource warnings)
if [[ -f "logs/dev-proxy.log" ]]; then
    DEV_ERRORS=$(grep -i "error\|fail\|not connected" logs/dev-proxy.log | grep -v "does not support resources" | wc -l 2>/dev/null || echo "0")
    if [[ $DEV_ERRORS -gt 0 ]]; then
        echo "   ⚠️  Found $DEV_ERRORS recent errors in dev proxy log"
        ERROR_COUNT=$((ERROR_COUNT + DEV_ERRORS))
    fi
fi

if [[ $ERROR_COUNT -eq 0 ]]; then
    echo "   ✅ No recent errors found"
fi
echo

# System resources
echo "5. System Resources:"
echo "   💾 Memory: $(free -h | grep '^Mem:' | awk '{print $3 "/" $2 " (" $3/$2*100 "% used)"}')"
echo "   💿 Disk: $(df -h . | tail -1 | awk '{print $3 "/" $2 " (" $5 " used)"}')"
echo

# Summary
echo "=== Summary ==="
if [[ -n "$DEV_PROXY_PID" && -n "$FS_PID" && -n "$PLW_PID" ]]; then
    echo "🟢 Status: HEALTHY - All dev components running"
    EXIT_CODE=0
elif [[ -n "$DEV_PROXY_PID" ]]; then
    echo "🟡 Status: DEGRADED - Dev proxy running but server issues"
    EXIT_CODE=1
else
    echo "🔴 Status: DOWN - Dev proxy not running"
    EXIT_CODE=2
fi

echo
echo "💡 Tips:"
echo "   - View logs: tail -f logs/dev-proxy.log"
echo "   - Restart: ./run_dev.sh"
echo "   - Production status: ../mcp-dc/status.sh"
echo
echo "🔧 Available servers:"
echo "   - filesystem: File operations in project directory"
echo "   - plw-dev: Playwright browser automation"

exit ${EXIT_CODE:-0}
