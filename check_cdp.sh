#!/bin/bash

# Helper script to check Chrome CDP status and manually start Chrome with CDP if needed

CONTAINER_NAME="supextension-browser-container"
PORT_CDP=9222

echo "=== Chrome CDP Status Checker ==="
echo ""

# Check if container is running
if [ ! "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
    echo "ERROR: Container '$CONTAINER_NAME' is not running!"
    echo "Please start it first with: ./deploy_browser.sh"
    exit 1
fi

echo "1. Checking supervisor status for Chrome..."
if docker exec $CONTAINER_NAME supervisorctl status chrome 2>/dev/null; then
    echo ""
else
    echo "  (supervisorctl not accessible, checking processes directly)"
    echo ""
fi

echo "2. Checking Chrome process..."
docker exec $CONTAINER_NAME ps aux | grep -i chrome | grep -v grep || echo "No Chrome process found"
echo ""

echo "3. Testing CDP endpoint from host..."
CDP_RESPONSE=$(curl -s http://localhost:$PORT_CDP/json 2>&1)
if [ $? -eq 0 ] && [ ! -z "$CDP_RESPONSE" ] && [ "$CDP_RESPONSE" != "curl:"* ]; then
    echo "✓ CDP is accessible from host!"
    echo ""
    echo "CDP Response (first 500 chars):"
    echo "$CDP_RESPONSE" | head -c 500
    echo ""
    echo ""
    echo "Full CDP endpoint: http://localhost:$PORT_CDP/json"
    echo "To see all targets: curl http://localhost:$PORT_CDP/json | jq"
else
    echo "✗ CDP is NOT accessible from host"
    echo "Response: $CDP_RESPONSE"
    echo ""
    echo "Testing CDP from inside container..."
    CDP_CONTAINER=$(docker exec $CONTAINER_NAME curl -s http://localhost:$PORT_CDP/json 2>&1)
    if [ $? -eq 0 ] && [ ! -z "$CDP_CONTAINER" ]; then
        echo "✓ CDP IS working inside container!"
        echo "Response (first 200 chars):"
        echo "$CDP_CONTAINER" | head -c 200
        echo ""
        echo "The issue might be port mapping. Check: docker port $CONTAINER_NAME | grep 9222"
    else
        echo "✗ CDP is NOT working even inside container"
        echo "Container response: $CDP_CONTAINER"
        echo ""
        echo "Chrome might not be running with CDP enabled."
        echo ""
        echo "To manually start Chrome with CDP, you can:"
        echo "  Option 1: Restart Chrome via supervisor:"
        echo "    docker exec $CONTAINER_NAME supervisorctl restart chrome"
        echo ""
        echo "  Option 2: Start Chrome manually inside the container:"
        echo "    docker exec -it $CONTAINER_NAME bash"
        echo "    Then run:"
        echo "    /usr/local/bin/start-chrome.sh"
    fi
fi

echo ""
echo "4. Checking extension loading..."
echo "Extension directory:"
docker exec $CONTAINER_NAME ls -la /opt/extension/ 2>/dev/null | head -10
echo ""
echo "Extension manifest:"
docker exec $CONTAINER_NAME cat /opt/extension/manifest.json 2>/dev/null | head -20 || echo "Manifest not found"
echo ""

echo "5. Checking Chrome logs..."
echo "--- Last 20 lines of Chrome log ---"
docker exec $CONTAINER_NAME tail -n 20 /var/log/chrome.log 2>/dev/null || echo "No Chrome log file found"
echo ""

echo "--- Last 20 lines of Chrome error log ---"
docker exec $CONTAINER_NAME tail -n 20 /var/log/chrome_error.log 2>/dev/null || echo "No Chrome error log file found"
echo ""

echo "--- Chrome startup log ---"
docker exec $CONTAINER_NAME tail -n 20 /var/log/chrome_startup.log 2>/dev/null || echo "No Chrome startup log file found"
echo ""

echo "=== End of Status Check ==="

