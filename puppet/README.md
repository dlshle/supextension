# Puppet Remote Control System

The Puppet system allows remote control of browsers through WebSocket connections. It consists of agents (browser extensions) that connect to a central server, and clients that can send commands to control those browsers.

## Components

1. **Server** (`server.js`) - Central coordination point that routes messages between clients and agents
2. **Agent** (browser extension) - Connects to server and executes commands in the browser
3. **Client** - Can be either:
   - JavaScript client (`client.js`) - Works in Node.js or browser environments
   - Python client (`client.py`) - Python implementation for WebSocket communication

## Installation

```bash
npm install ws
```

For Python client:
```bash
pip install websockets
```

## Usage

### JavaScript Client

```javascript
const { PuppetClient } = require('./client');

const client = new PuppetClient({
  url: 'ws://localhost:9222',
  apiKey: 'your-api-key-if-needed'
});

await client.connect();

// Navigate to a URL
await client.navigate('https://example.com');

// Take a screenshot
const screenshot = await client.takeScreenshot();

// Get all text from page
const text = await client.getAllText();

await client.disconnect();
```

### Python Client

```python
from client import PuppetClient
import asyncio

async def main():
    client = PuppetClient({
        'url': 'ws://localhost:9222',
        'apiKey': 'your-api-key-if-needed'
    })
    
    await client.connect()
    
    # Navigate to a URL
    await client.navigate('https://example.com')
    
    # Take a screenshot
    screenshot = await client.take_screenshot()
    
    # Get all text from page
    text = await client.get_all_text()
    
    await client.disconnect()

asyncio.run(main())
```

## API Methods

### Navigation
- `navigate(url, tabId)` - Navigate to a URL
- `navigateBack(tabId)` - Go back in browser history
- `scroll(x, y, behavior, tabId)` - Scroll the page

### DOM Operations
- `getDOM(selector, tabId)` - Get DOM elements matching selector
- `getAllText(tabId)` - Extract all text from page

### Screenshots
- `takeScreenshot(format, quality, tabId)` - Take a screenshot (png/jpeg)

### Script Injection
- `injectScript(code, timing, waitForSelector, tabId)` - Inject JavaScript

### Storage
- `getStorage(storageType, keys, tabId)` - Get localStorage/sessionStorage
- `setStorage(storageType, data, tabId)` - Set localStorage/sessionStorage

### Cookies
- `getCookies(url, name)` - Get cookies
- `setCookie(cookie)` - Set a cookie
- `deleteCookie(url, name)` - Delete a cookie

### Network Capture
- `startNetworkCapture()` - Start capturing network requests
- `stopNetworkCapture()` - Stop capturing network requests
- `getNetworkLog()` - Get captured network requests
- `clearNetworkLog()` - Clear network log

### Tabs
- `getAllTabs()` - Get all open tabs

## Message Protocol

All communication happens via JSON messages over WebSocket.

### Client Identification
When a client connects, it must identify itself:

```json
{
  "type": "identify",
  "role": "client",
  "apiKey": "optional-api-key",
  "name": "client-name"
}
```

### Agent Identification
When an agent connects, it must identify itself:

```json
{
  "type": "identify",
  "role": "agent",
  "secret": "agent-secret",
  "name": "agent-name"
}
```

### Commands
Clients send commands to agents through the server:

```json
{
  "type": "command",
  "id": "req_123",
  "method": "navigate",
  "params": {
    "url": "https://example.com"
  }
}
```

### Responses
Agents respond to commands:

```json
{
  "type": "response",
  "id": "req_123",
  "success": true,
  "data": {
    "title": "Example Domain",
    "url": "https://example.com"
  }
}
```

### Events
Agents can send events to clients:

```json
{
  "type": "event",
  "event": "pageLoaded",
  "data": {
    "url": "https://example.com"
  }
}
```

## Examples

See the [examples](./examples/) directory for complete usage examples.