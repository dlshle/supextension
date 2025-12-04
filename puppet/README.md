# Supextension Puppet Service

Remote browser control service for Supextension Chrome extension.

## Overview

The Puppet Service allows external applications and scripts to remotely control a Chrome browser through the Supextension extension. It consists of:

- **Native Messaging Host**: Node.js server that bridges the extension and remote clients
- **WebSocket Server**: Accepts remote commands via WebSocket connections
- **HTTP Server**: REST API for simple request/response interactions
- **Client Libraries**: JavaScript and Python clients for easy integration

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Build Extension

```bash
npm run build
```

### 3. Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `dist` folder from this project
5. Copy the extension ID (e.g., `abcdefghijklmnopqrstuvwxyz123456`)

### 4. Install Native Messaging Host

**Linux/macOS:**
```bash
npm run puppet:install -- --extension-id=YOUR_EXTENSION_ID
```

**Windows:**
```bash
npm run puppet:install -- --extension-id=YOUR_EXTENSION_ID
```

Replace `YOUR_EXTENSION_ID` with the actual extension ID from step 3.

### 5. Start Puppet Server

```bash
npm run puppet:start
```

The server will start on:
- WebSocket: `ws://localhost:9222`
- HTTP: `http://localhost:9223`

### 6. Test with Example

**JavaScript:**
```bash
npm run puppet:example
```

**Python:**
```bash
npm run puppet:example:python
```

## Client Libraries

### JavaScript/Node.js

```javascript
const { PuppetClient } = require('./puppet/client');

async function example() {
  const puppet = new PuppetClient('ws://localhost:9222');
  await puppet.connect();

  // Navigate
  await puppet.navigate('https://example.com');
  
  // Get page content
  const dom = await puppet.getDOM();
  console.log(dom.data.title);
  
  // Take screenshot
  const screenshot = await puppet.takeScreenshot('png');
  
  puppet.disconnect();
}

example();
```

### Python

```python
import asyncio
from puppet.client import PuppetClient

async def example():
    puppet = PuppetClient("ws://localhost:9222")
    await puppet.connect()
    
    # Navigate
    await puppet.navigate("https://example.com")
    
    # Get page content
    dom = await puppet.get_dom()
    print(dom["data"]["title"])
    
    # Take screenshot
    screenshot = await puppet.take_screenshot("png")
    
    await puppet.disconnect()

asyncio.run(example())
```

## Configuration

Edit `puppet/config.json`:

```json
{
  "websocket": {
    "host": "localhost",
    "port": 9222
  },
  "http": {
    "enabled": true,
    "port": 9223
  },
  "security": {
    "apiKey": null,
    "allowedOrigins": ["*"]
  },
  "debug": false
}
```

### Environment Variables

You can also configure via environment variables:

- `PUPPET_HOST`: Server host (default: localhost)
- `PUPPET_PORT`: WebSocket port (default: 9222)
- `PUPPET_HTTP_PORT`: HTTP port (default: 9223)
- `PUPPET_HTTP_ENABLED`: Enable HTTP server (default: true)
- `PUPPET_API_KEY`: API key for authentication
- `PUPPET_ALLOWED_ORIGINS`: Comma-separated list of allowed origins
- `PUPPET_DEBUG`: Enable debug logging (default: false)

## API Methods

### Navigation

- `navigate(url, tabId?)` - Navigate to URL
- `navigateBack(tabId?)` - Go back in history

### DOM Access

- `getDOM(selector?, tabId?)` - Get DOM content
- `getAllText(tabId?)` - Get all visible text

### Screenshots

- `takeScreenshot(format, quality?, tabId?)` - Capture screenshot

### Script Injection

- `injectScript(code, timing?, waitForSelector?, tabId?)` - Execute JavaScript

### Storage

- `getStorage(storageType, keys?, tabId?)` - Read localStorage/sessionStorage
- `setStorage(storageType, data, tabId?)` - Write localStorage/sessionStorage

### Cookies

- `getCookies(url?, name?)` - Get cookies
- `setCookie(cookie)` - Set cookie
- `deleteCookie(url, name)` - Delete cookie

### Network

- `startNetworkCapture()` - Start capturing network traffic
- `stopNetworkCapture()` - Stop capturing
- `getNetworkLog()` - Get captured requests
- `clearNetworkLog()` - Clear log

## Message Protocol

### Request Format

```json
{
  "id": "req_123",
  "method": "navigate",
  "params": {
    "url": "https://example.com"
  },
  "apiKey": "optional-api-key"
}
```

### Response Format

```json
{
  "id": "req_123",
  "success": true,
  "data": { ... },
  "error": null
}
```

## Security

### API Key Authentication

Set an API key in `config.json`:

```json
{
  "security": {
    "apiKey": "your-secret-key"
  }
}
```

Then include it in client requests:

```javascript
const puppet = new PuppetClient({
  url: 'ws://localhost:9222',
  apiKey: 'your-secret-key'
});
```

### Origin Restrictions

Limit which origins can connect:

```json
{
  "security": {
    "allowedOrigins": [
      "http://localhost:3000",
      "https://myapp.example.com"
    ]
  }
}
```

## Troubleshooting

### Extension not connecting

1. Check Chrome's native messaging logs:
   - Linux: `~/.config/google-chrome/NativeMessagingHosts/`
   - macOS: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`
   - Windows: Check registry at `HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\`

2. Verify manifest file exists with correct path
3. Ensure extension ID matches in manifest
4. Check extension console for errors

### Server not starting

1. Check if port is already in use:
   ```bash
   lsof -i :9222  # Linux/macOS
   netstat -ano | findstr :9222  # Windows
   ```

2. Try different port:
   ```bash
   PUPPET_PORT=9333 npm run puppet:start
   ```

### Connection timeouts

1. Verify server is running
2. Check firewall settings
3. Ensure WebSocket connection is not blocked
4. Try increasing timeout in client config

### Commands not working

1. Check if page is fully loaded
2. Verify selectors are correct
3. Check extension permissions
4. Look at browser console for errors

## Advanced Usage

### Multiple Tabs

```javascript
// Create new tab and get ID
const tabs = await puppet.navigate('https://example.com');

// Navigate specific tab
await puppet.navigate('https://github.com', tabId);
```

### Script Injection with Selector Wait

```javascript
// Wait for element before executing script
await puppet.injectScript(
  'document.querySelector("#button").click()',
  'immediate',
  '#button'  // Wait for this selector
);
```

### Network Monitoring

```javascript
await puppet.startNetworkCapture();

// Browse pages...
await puppet.navigate('https://example.com');

// Get captured traffic
const log = await puppet.getNetworkLog();
console.log(log.data);

await puppet.stopNetworkCapture();
```

## Examples

See `puppet/examples/` directory for complete examples:

- `basic-usage.js` - JavaScript basic automation
- `basic-usage.py` - Python basic automation

## Development

### Running in Debug Mode

```bash
PUPPET_DEBUG=true npm run puppet:start
```

### Testing Native Messaging

```bash
# Send test message to server
echo '{"type":"NAVIGATE","url":"https://example.com"}' | node puppet/server.js
```

## License

MIT
