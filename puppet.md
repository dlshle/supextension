# Remote Browser Control (Puppet Service)

## Overview

The Puppet Service extends Supextension to enable remote browser control via WebSocket or HTTP connections. This allows external applications, scripts, or services to programmatically control a Chrome browser through the extension.

## Architecture

```
┌─────────────────────┐
│  Remote Client      │  (Your App/Script)
│  (Python, Node, etc)│
└──────────┬──────────┘
           │ WebSocket/HTTP
           ▼
┌─────────────────────┐
│  Puppet Server      │  (Node.js)
│  (WebSocket/HTTP)   │
└──────────┬──────────┘
           │ Native Messaging
           ▼
┌─────────────────────┐
│  Chrome Extension   │  (Supextension)
│  Background Worker  │
└──────────┬──────────┘
           │ Chrome APIs
           ▼
┌─────────────────────┐
│  Chrome Browser     │
└─────────────────────┘
```

## Implementation Steps

### Step 1: Create Native Messaging Host

Create a Node.js server that:
- Communicates with the Chrome extension via native messaging
- Exposes a WebSocket server for remote clients
- Routes commands between clients and the extension

### Step 2: Update Extension Manifest

Add native messaging host configuration to allow external communication.

### Step 3: Create Puppet Client Library

Provide client libraries in multiple languages:
- JavaScript/TypeScript
- Python
- Other languages as needed

## Features

### Core Commands

All BrowserController methods are available remotely:

1. **Navigation**
   - `navigate(url)` - Navigate to a URL
   - `navigateBack()` - Go back in history

2. **DOM Access**
   - `getDOM(selector?)` - Get page DOM
   - `getAllText()` - Get all visible text

3. **Screenshots**
   - `takeScreenshot(format, quality)` - Capture screen

4. **Script Injection**
   - `injectScript(code, timing, waitForSelector)` - Run JavaScript

5. **Storage**
   - `getStorage(type, keys)` - Read storage
   - `setStorage(type, data)` - Write storage

6. **Cookies**
   - `getCookies(url, name)` - Get cookies
   - `setCookie(details)` - Set cookie
   - `deleteCookie(url, name)` - Delete cookie

7. **Network Capture**
   - `startNetworkCapture()` - Start logging
   - `getNetworkLog()` - Get captured requests
   - `stopNetworkCapture()` - Stop logging
   - `clearNetworkLog()` - Clear log

## Usage Example

### JavaScript/Node.js Client

```javascript
const { PuppetClient } = require('./puppet/client');

async function run() {
  const puppet = new PuppetClient('ws://localhost:9222');
  await puppet.connect();

  await puppet.navigate('https://example.com');
  const dom = await puppet.getDOM();
  console.log(dom.data?.title);

  const screenshot = await puppet.takeScreenshot('png');
  console.log('Screenshot bytes:', screenshot.data?.length);

  await puppet.injectScript('document.title = "Hello from Puppet"');
  puppet.disconnect();
}

run().catch(console.error);
```

### Python Client

```python
from puppet.client import PuppetClient
import asyncio

async def run():
    puppet = PuppetClient('ws://localhost:9222')
    await puppet.connect()

    await puppet.navigate('https://example.com')
    dom = await puppet.get_dom()
    print(dom["data"]["title"])

    await puppet.disconnect()

asyncio.run(run())
```

### HTTP API Example

```bash
curl -X POST http://localhost:9223 \
  -H "Content-Type: application/json" \
  -d '{
    "id": "req_1",
    "method": "navigate",
    "params": { "url": "https://example.com" },
    "apiKey": "optional-api-key"
  }'
```

## Installation & Setup

### Python Dependencies

```bash
pip install -r puppet/requirements.txt
```

### 1. Install Dependencies

```bash
npm install
```

### 2. Build Extension

```bash
npm run build
```

### 3. Load Extension in Chrome

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder
5. Copy the extension ID (visible on the extension card)

### 4. Install Native Messaging Host

```bash
# Replace YOUR_EXTENSION_ID with the actual ID from step 3
npm run puppet:install -- --extension-id=YOUR_EXTENSION_ID
```

### 5. Start Puppet Server

```bash
npm run puppet:start
```

The server will start on:
- WebSocket: `ws://localhost:9222`
- HTTP: `http://localhost:9223`

### 6. Test with Example

```bash
# JavaScript example
npm run puppet:example

# Python example
npm run puppet:example:python
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
    "apiKey": "your-secret-key",
    "allowedOrigins": ["*"]
  }
}
```

## Security Considerations

1. **API Key Authentication**: Use API keys for production
2. **CORS/Origin Restrictions**: Limit allowed origins
3. **Local Network Only**: Bind to localhost in production
4. **TLS/SSL**: Use WSS for remote connections
5. **Rate Limiting**: Implement rate limits

## Protocol

### Message Format

All messages use JSON:

```json
{
  "id": "unique-request-id",
  "method": "navigate",
  "params": {
    "url": "https://example.com"
  }
}
```

### Response Format

```json
{
  "id": "unique-request-id",
  "success": true,
  "data": { ... },
  "error": null
}
```

## Future Improvements

- Connection sessions per client
- Event streaming for DOM/network updates
- Multi-tab orchestration helpers
- Rate limiting and audit logging

## Troubleshooting

### Extension not connecting to host

1. Verify native messaging host is installed correctly
2. Check Chrome's native messaging logs
3. Ensure extension has proper permissions

### WebSocket connection fails

1. Verify puppet server is running
2. Check firewall settings
3. Verify port is not in use

### Commands timeout

1. Increase timeout settings
2. Check if page is loaded
3. Verify selectors are correct

## Examples

See [puppet/examples/](./puppet/examples/) for complete working examples:
- `basic-usage.js` - JavaScript/Node.js basic automation
- `basic-usage.py` - Python async basic automation

Both examples demonstrate:
- Navigation
- DOM access
- Text extraction
- Screenshots
- Script injection
- Cookie management
- Storage manipulation
