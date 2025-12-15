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

echo "3. Testing CDP endpoint..."
CDP_RESPONSE=$(curl -s http://localhost:$PORT_CDP/json 2>&1)
if [ $? -eq 0 ] && [ ! -z "$CDP_RESPONSE" ]; then
    echo "✓ CDP is accessible!"
    echo ""
    echo "CDP Response (first 500 chars):"
    echo "$CDP_RESPONSE" | head -c 500
    echo ""
    echo ""
    echo "Full CDP endpoint: http://localhost:$PORT_CDP/json"
    echo "To see all targets: curl http://localhost:$PORT_CDP/json | jq"
else
    echo "✗ CDP is NOT accessible"
    echo "Response: $CDP_RESPONSE"
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
    echo "    OR directly (with all flags including first-run skip):"
    echo "    google-chrome-stable --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0 --no-sandbox --disable-dev-shm-usage --disable-gpu --user-data-dir=/home/chromeuser/chrome-data --disable-extensions-except=/opt/extension --load-extension=/opt/extension --window-size=1280,960 --start-maximized --no-first-run --no-default-browser-check --disable-default-apps --disable-sync"
fi

echo ""
echo "4. Checking Chrome logs..."
echo "--- Last 20 lines of Chrome log ---"
docker exec $CONTAINER_NAME tail -n 20 /var/log/chrome.log 2>/dev/null || echo "No Chrome log file found"
echo ""

echo "--- Last 20 lines of Chrome error log ---"
docker exec $CONTAINER_NAME tail -n 20 /var/log/chrome_error.log 2>/dev/null || echo "No Chrome error log file found"
echo ""

echo "=== End of Status Check ==="

