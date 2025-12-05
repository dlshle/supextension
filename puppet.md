# Remote Browser Control (Puppet Service)

## Overview

The Puppet Service enables remote browser control through a coordinator server. The Chrome extension acts as an "agent" connecting to the server, while remote clients connect and issue commands. The server bridges the communication between clients and agents.

## Architecture

```
┌──────────────────┐       ┌──────────────────┐
│  Remote Client 1 │       │  Remote Client 2 │
│  (Your App)      │       │  (Your Script)   │
└────────┬─────────┘       └────────┬─────────┘
         │                          │
         │      WebSocket           │
         └─────────┬────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │   Puppet Server      │  (Node.js Coordinator)
        │   ws://localhost:9222│
        └──────────┬───────────┘
                   │ WebSocket
                   ▼
        ┌──────────────────────┐
        │  Chrome Extension    │  (Agent)
        │  Background Worker   │
        └──────────┬───────────┘
                   │ Chrome APIs
                   ▼
        ┌──────────────────────┐
        │   Chrome Browser     │
        └──────────────────────┘
```

## Key Concepts

### Roles

1. **Server (Coordinator)**: Node.js process that routes messages between clients and agents
2. **Agent**: Chrome extension that executes commands via Chrome APIs
3. **Client**: External application/script that sends commands to control the browser

### Protocol

All communication uses WebSocket with JSON messages. Connections must identify their role upon connection.

## Installation & Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Build Extension

```bash
npm run build
```

### 3. Load Extension in Chrome

1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder

The extension will automatically try to connect to `ws://localhost:9222`

### 4. Start Puppet Server

```bash
npm run puppet:start
```

The server listens on:
- WebSocket: `ws://0.0.0.0:9222`
- HTTP (health): `http://0.0.0.0:9223/health`

### 5. Run Client Example

```bash
node puppet/examples/basic-usage.js
```

## Configuration

### Server Configuration

Edit `puppet/config.json`:

```json
{
  "websocket": {
    "host": "0.0.0.0",
    "port": 9222
  },
  "http": {
    "enabled": true,
    "port": 9223
  },
  "security": {
    "apiKey": null,
    "agentSecret": null,
    "allowedOrigins": ["*"]
  },
  "debug": false
}
```

### Agent (Extension) Configuration

By default, the agent connects to `ws://localhost:9222`. To change the server URL:

**Option 1: Using Extension DevTools Console**

```javascript
chrome.storage.local.set({ puppetServerUrl: 'ws://YOUR_SERVER:9222' });
```

**Option 2: Programmatically**

Add UI in the popup to let users configure the server URL.

## Security

### API Key (Client Authentication)

Set in `puppet/config.json`:

```json
{
  "security": {
    "apiKey": "your-secret-key"
  }
}
```

Clients must include the API key:

```javascript
const puppet = new PuppetClient({
  url: 'ws://localhost:9222',
  apiKey: 'your-secret-key'
});
```

### Agent Secret (Extension Authentication)

Set in `puppet/config.json`:

```json
{
  "security": {
    "agentSecret": "agent-secret-token"
  }
}
```

The agent must be modified to send the secret during identification (not currently implemented in the basic version).

### Allowed Origins

Restrict WebSocket origins:

```json
{
  "security": {
    "allowedOrigins": ["http://localhost:3000", "https://myapp.com"]
  }
}
```

## Client Usage

### JavaScript/Node.js

```javascript
const { PuppetClient } = require('./puppet/client');

async function main() {
  // Connect to server
  const puppet = new PuppetClient('ws://localhost:9222');
  await puppet.connect();

  // Navigate
  await puppet.navigate('https://example.com');

  // Get DOM
  const dom = await puppet.getDOM();
  console.log('Title:', dom.data?.title);

  // Take screenshot
  const screenshot = await puppet.takeScreenshot('png');
  console.log('Screenshot captured:', screenshot.success);

  // Inject script
  await puppet.injectScript('console.log("Hello from remote client")');

  // Cleanup
  puppet.disconnect();
}

main().catch(console.error);
```

### Browser (via script tag)

```html
<script src="/path/to/puppet/client.js"></script>
<script>
  const puppet = new PuppetClient('ws://localhost:9222');
  puppet.connect().then(async () => {
    await puppet.navigate('https://example.com');
    const dom = await puppet.getDOM();
    console.log(dom);
  });
</script>
```

## Available Commands

All BrowserController methods are available:

### Navigation
- `navigate(url, tabId?)` - Navigate to URL
- `navigateBack(tabId?)` - Go back

### DOM
- `getDOM(selector?, tabId?)` - Get page HTML
- `getAllText(tabId?)` - Get visible text

### Screenshots
- `takeScreenshot(format?, quality?, tabId?)` - Capture screen

### Script Injection
- `injectScript(code, timing?, waitForSelector?, tabId?)` - Execute JavaScript

### Storage
- `getStorage(storageType, keys?, tabId?)` - Read storage
- `setStorage(storageType, data, tabId?)` - Write storage

### Cookies
- `getCookies(url?, name?)` - Get cookies
- `setCookie(cookie)` - Set cookie
- `deleteCookie(url, name)` - Delete cookie

### Network
- `startNetworkCapture()` - Start logging requests
- `stopNetworkCapture()` - Stop logging
- `getNetworkLog()` - Get captured requests
- `clearNetworkLog()` - Clear log

## Protocol Details

### Identification (Required on Connect)

**Agent:**
```json
{
  "type": "identify",
  "role": "agent",
  "agentId": "chrome-extension-id",
  "name": "Supextension",
  "version": "1.0.0",
  "secret": "optional-agent-secret"
}
```

**Client:**
```json
{
  "type": "identify",
  "role": "client",
  "apiKey": "optional-api-key",
  "name": "my-automation-script"
}
```

### Command (Client → Server → Agent)

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

### Response (Agent → Server → Client)

```json
{
  "type": "response",
  "id": "req_123",
  "success": true,
  "data": { ... },
  "error": null
}
```

### Events (Agent → Server → All Clients)

```json
{
  "type": "event",
  "event": "page-loaded",
  "data": { "url": "https://example.com" }
}
```

### Agent Status (Server → Client)

```json
{
  "type": "agent-status",
  "status": "online",
  "info": {
    "agentId": "...",
    "name": "Supextension",
    "version": "1.0.0"
  }
}
```

## Environment Variables

Override configuration via environment variables:

- `PUPPET_HOST` - Server bind address (default: `0.0.0.0`)
- `PUPPET_PORT` - WebSocket port (default: `9222`)
- `PUPPET_HTTP_ENABLED` - Enable HTTP server (default: `true`)
- `PUPPET_HTTP_PORT` - HTTP port (default: `9223`)
- `PUPPET_API_KEY` - Client API key
- `PUPPET_AGENT_SECRET` - Agent authentication secret
- `PUPPET_ALLOWED_ORIGINS` - Comma-separated allowed origins
- `PUPPET_DEBUG` - Enable debug logging (default: `false`)

## Deployment

### Running on a Remote Server

1. **Update server config** to bind to `0.0.0.0`:
   ```json
   { "websocket": { "host": "0.0.0.0" } }
   ```

2. **Start server** on remote machine:
   ```bash
   npm run puppet:start
   ```

3. **Configure agent** to connect to remote server:
   ```javascript
   chrome.storage.local.set({ puppetServerUrl: 'ws://YOUR_SERVER_IP:9222' });
   ```

4. **Connect clients** to remote server:
   ```javascript
   const puppet = new PuppetClient('ws://YOUR_SERVER_IP:9222');
   ```

### Using PM2 (Process Manager)

```bash
# Install PM2
npm install -g pm2

# Start server
pm2 start puppet/server.js --name puppet-server

# View logs
pm2 logs puppet-server

# Restart
pm2 restart puppet-server
```

### Using Docker

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY puppet/ ./puppet/
EXPOSE 9222 9223
CMD ["node", "puppet/server.js"]
```

Build and run:

```bash
docker build -t puppet-server .
docker run -p 9222:9222 -p 9223:9223 puppet-server
```

## Troubleshooting

### Extension not connecting to server

1. Check server is running: `curl http://localhost:9223/health`
2. Verify server URL in extension storage
3. Check browser console for connection errors
4. Ensure firewall allows WebSocket connections

### Commands timeout

1. Verify agent is connected (check server logs)
2. Ensure page is loaded before sending commands
3. Increase timeout in client config

### "No agent connected" error

1. Verify extension is loaded and enabled
2. Check extension service worker console for errors
3. Restart extension or reload service worker
4. Verify server URL configuration

## Examples

See `puppet/examples/basic-usage.js` for a complete example demonstrating:
- Navigation
- DOM access
- Screenshots
- Script injection
- Cookie management
- Storage manipulation

## Future Enhancements

- [ ] Multiple agent support (control multiple browsers)
- [ ] Event streaming (real-time browser events)
- [ ] Session management
- [ ] Command queuing and prioritization
- [ ] TLS/WSS support for secure remote connections
- [ ] Rate limiting
- [ ] Audit logging
