#!/bin/bash
# Install native messaging host for Supextension Puppet Service
# Supports Linux and macOS

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_PATH="$SCRIPT_DIR/server.js"
MANIFEST_PATH="$SCRIPT_DIR/com.supextension.puppet.json"

echo "=== Supextension Puppet Host Installer ==="
echo ""

# Check if server.js exists
if [ ! -f "$SERVER_PATH" ]; then
  echo "Error: server.js not found at $SERVER_PATH"
  exit 1
fi

# Make server executable
chmod +x "$SERVER_PATH"
echo "✓ Made server.js executable"

# Check for extension ID
if [ -z "$1" ]; then
  echo "Error: Extension ID required"
  echo "Usage: $0 <extension-id>"
  echo ""
  echo "To find your extension ID:"
  echo "  1. Go to chrome://extensions/"
  echo "  2. Enable Developer Mode"
  echo "  3. Copy the ID from your extension"
  exit 1
fi

EXTENSION_ID="$1"
echo "Extension ID: $EXTENSION_ID"
echo ""

# Determine OS and manifest location
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  # Linux
  MANIFEST_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
  echo "Platform: Linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
  echo "Platform: macOS"
else
  echo "Error: Unsupported platform: $OSTYPE"
  exit 1
fi

# Create directory if it doesn't exist
mkdir -p "$MANIFEST_DIR"
echo "✓ Created native messaging directory: $MANIFEST_DIR"

# Create manifest with correct paths and extension ID
INSTALL_MANIFEST="$MANIFEST_DIR/com.supextension.puppet.json"
cat > "$INSTALL_MANIFEST" << EOF
{
  "name": "com.supextension.puppet",
  "description": "Puppet native messaging host for Supextension",
  "path": "$SERVER_PATH",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF

echo "✓ Installed manifest to: $INSTALL_MANIFEST"
echo ""
echo "Installation complete!"
echo ""
echo "Next steps:"
echo "  1. Install dependencies: cd $SCRIPT_DIR && npm install"
echo "  2. Start the puppet server: node $SERVER_PATH"
echo "  3. Or add to package.json scripts and run: npm run puppet:start"
echo ""
