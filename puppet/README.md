# Puppet Service

Remote coordinator that links the Supextension agent (Chrome extension) with remote clients.

## Components

- **Agent** – the Chrome extension service worker that connects to the server
- **Server** – Node.js WebSocket/HTTP process (`puppet/server.js`)
- **Client** – JavaScript library (`puppet/client.js`) for remote control
- **Web Console** – Browser-based UI (`web-client/`) for graphical remote control

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Build the extension**
   ```bash
   npm run build
   ```

3. **Load the `dist/` folder in Chrome** via `chrome://extensions`

4. **Start the coordinator server**
   ```bash
   npm run puppet:start
   ```

5. **Run the JavaScript example client**
   ```bash
   npm run puppet:example
   ```

### Web Console (No-Code Remote Control)

A full-featured front-end lives in `web-client/` for teams that prefer a graphical interface.

1. Make sure the puppet server (`npm run puppet:start`) and Chrome agent are connected
2. Serve the static files from the repo root (for example: `python3 -m http.server 8080`)
3. Visit `http://localhost:8080/web-client/`, enter your WebSocket URL/API key, and click **Connect**
4. Use the cards to navigate, read DOM/text, run scripts, manage storage & cookies, and capture network traffic

See `web-client/README.md` for a full tour of the console and troubleshooting tips.

## Configuration

### Server (`puppet/config.json`)

```json
{
  "websocket": { "host": "0.0.0.0", "port": 9222 },
  "http": { "enabled": true, "port": 9223 },
  "security": {
    "apiKey": null,
    "agentSecret": null,
    "allowedOrigins": ["*"]
  },
  "debug": false
}
```

- `apiKey` – optional client authentication
- `agentSecret` – optional agent authentication
- `allowedOrigins` – restrict WebSocket/HTTP origins

Environment variables (`PUPPET_HOST`, `PUPPET_PORT`, `PUPPET_API_KEY`, etc.) override config values.

### Agent (Extension) server URL

The agent connects to `ws://localhost:9222` by default. Override via:

```javascript
chrome.storage.local.set({ puppetServerUrl: 'ws://YOUR_SERVER:9222' });
```

Add UI in the popup for a better UX.

## Message Flow

1. Client connects → sends `{ type: "identify", role: "client", apiKey }`
2. Agent connects → sends `{ type: "identify", role: "agent", agentId, name, version }`
3. Client sends `{ type: "command", method, params }`
4. Server forwards to agent → agent executes Chrome commands
5. Agent responds `{ type: "response", success, data }`
6. Server forwards response back to originating client

## Client Library (`puppet/client.js`)

Usage:

```javascript
const { PuppetClient } = require('./puppet/client');

async function main() {
  const puppet = new PuppetClient({
    url: 'ws://localhost:9222',
    apiKey: null,
  });

  await puppet.connect();
  await puppet.navigate('https://example.com');
  const dom = await puppet.getDOM();
  console.log(dom.data?.title);
  puppet.disconnect();
}

main().catch(console.error);
```

Supports all BrowserController actions: navigation, DOM access, screenshots, script injection, storage, cookies, and network capture.

## Server API

- **WebSocket** `ws://host:port`
  - `identify` (client/agent)
  - `command` (client → agent)
  - `response` (agent → client)
  - `event` (agent → clients)
  - `agent-status` (server → clients)

- **HTTP** `GET /health` – returns `{ status, agentConnected, clients }`

## Security Recommendations

1. Set both `apiKey` and `agentSecret` in production
2. Use TLS termination (run server behind a reverse proxy that terminates HTTPS/WSS)
3. Restrict `allowedOrigins`
4. Run server on private network/VPN when possible

## Deployment Tips

- Use `pm2` or systemd to keep the server running
- Containerize with Docker for easier shipping
- Scale horizontally by running one agent per machine and configuring unique agent IDs

## Troubleshooting

- **Client receives "No agent connected"** – ensure the extension is loaded and connected
- **Agent cannot connect** – verify server URL and firewall rules
- **Command timeout** – check browser tab readiness and server/agent logs
- **Unauthorized** – confirm `apiKey`/`agentSecret` values on both ends

## Next Steps

- Add UI in popup to configure server URL & authentication
- Stream browser events back to clients (DOM changes, console logs, etc.)
- Support multiple concurrent agents
