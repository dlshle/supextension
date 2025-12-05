# Supextension Puppet Console

A modern, browser-based front-end application for remotely controlling the Supextension browser automation agent. This web console provides a graphical interface for all puppet client capabilities without requiring any code.

## Features

### Complete Remote Control
- **Navigation**: Navigate to URLs, go back in history
- **DOM Extraction**: Fetch full DOM or specific elements via CSS selectors
- **Text Extraction**: Extract all visible text from pages
- **Script Injection**: Run JavaScript code in browser tabs with flexible timing options
- **Screenshots**: Capture PNG or JPEG screenshots and download them
- **Storage Management**: Read and write localStorage and sessionStorage
- **Cookie Operations**: Get, set, and delete cookies
- **Network Capture**: Monitor HTTP/WebSocket traffic with start/stop controls

### User-Friendly Interface
- Real-time connection and agent status indicators
- Live log stream of all operations
- Organized card-based layout
- Responsive design for desktop and mobile
- Dark theme optimized for extended use
- Form validation and error handling

## Getting Started

### Prerequisites

1. **Puppet server must be running**:
   ```bash
   npm run puppet:start
   ```

2. **Chrome extension must be loaded** with the Supextension agent connected to the server

### Running the Console

Since this is a static web application, you can serve it using any HTTP server (from the repository root so the puppet client file stays accessible):

#### Option 1: Python (recommended)
```bash
python3 -m http.server 8080
```

Then open [http://localhost:8080/puppet/web-client/](http://localhost:8080/puppet/web-client/) in your browser.

#### Option 2: Node.js http-server
```bash
npm install -g http-server
http-server -p 8080 .
```

Visit [http://localhost:8080/puppet/web-client/](http://localhost:8080/puppet/web-client/).

#### Option 3: VS Code Live Server
1. Install the "Live Server" extension in VS Code
2. Right-click `puppet/web-client/index.html` (from the repo root) and select "Open with Live Server"

### Connecting to the Puppet Server

1. Open the web console in your browser
2. In the **Server Connection** panel:
   - Enter the WebSocket URL (default: `ws://localhost:9222`)
   - Optionally provide an API key if configured
   - Adjust timeout and reconnection settings as needed
3. Click **Connect**
4. Status indicators will show:
   - **Connection**: Shows your connection to the puppet server
   - **Agent**: Shows whether the browser extension agent is connected

## Usage Guide

### Navigation

Navigate to any URL or go back in browser history:

```
Navigate to URL: https://example.com
[Go] [Navigate Back]
```

### DOM & Text Extraction

Extract DOM content with optional CSS selector filtering:

```
CSS Selector: body, #app, .headline (optional)
[Fetch DOM] [Get All Text]
```

Results appear in the DOM Snapshot and Visible Text sections below.

### Script Injection

Run JavaScript code in the browser tab:

```
Execution Timing: immediate | document_start | document_end | document_idle
Wait for selector: #app-ready (optional)
JavaScript to run:
  return document.title;

[Run Script]
```

The result will be displayed in the Script Result section.

### Screenshots

Capture screenshots in PNG or JPEG format:

```
Format: PNG | JPEG
JPEG Quality: 80 (only for JPEG)
[Capture Screenshot]
```

Preview appears below, with a download button.

### Storage Operations

Read and write browser storage:

**Get Storage:**
```
Storage Type: localStorage | sessionStorage
Keys: key1, key2 (comma separated, or leave blank for all)
[Get Storage]
```

**Set Storage:**
```
Storage Type: localStorage | sessionStorage
JSON payload:
  {"example": "value", "timestamp": 1234567890}

[Set Storage]
```

### Cookie Management

**Get Cookies:**
```
URL: https://example.com (optional)
Cookie Name: session (optional)
[Get Cookies]
```

**Set Cookie:**
```
Cookie JSON:
  {"name": "token", "url": "https://example.com", "value": "abc"}

[Set Cookie]
```

**Delete Cookie:**
```
URL: https://example.com
Name: session
[Delete Cookie]
```

### Network Capture

Monitor network traffic:

```
[Start Capture] [Stop] [Fetch Log] [Clear Log]
```

1. Click **Start Capture** to begin monitoring
2. Interact with the browser (navigate, click, etc.)
3. Click **Fetch Log** to retrieve captured traffic
4. Review HTTP requests, responses, and WebSocket messages
5. Click **Clear Log** to reset the capture buffer

## Advanced Features

### Target Tab ID

By default, all commands execute on the active tab in the agent browser. To target a specific tab:

1. Find the tab ID (visible in Chrome DevTools or via extension popup)
2. Enter it in the **Execution Context** panel
3. All subsequent commands will use that tab ID

### API Key Authentication

If the puppet server has API key authentication enabled:

1. Obtain the API key from your server administrator
2. Enter it in the **API Key** field when connecting
3. The key is sent with every connection attempt

### Auto-Reconnection

The console can automatically reconnect if the connection drops:

- **Auto reconnect**: Check to enable automatic reconnection
- **Reconnect Delay**: Time in milliseconds between reconnection attempts

## Architecture

### File Structure

```
puppet/web-client/
├── index.html      # Main HTML structure
├── styles.css      # Complete styling and theming
├── app.js          # Application logic and event handlers
└── README.md       # This file
```

### Dependencies

- **PuppetClient**: The JavaScript client library (`../client.js`)
- **WebSocket**: Native browser WebSocket API for real-time communication
- No external frameworks or libraries required

### How It Works

1. User connects to the puppet server via WebSocket
2. Server identifies the connection as a client
3. Client sends commands through the WebSocket
4. Server forwards commands to the connected agent (Chrome extension)
5. Agent executes browser automation actions
6. Results flow back through server to client
7. UI updates with results and logs

## Troubleshooting

### Cannot Connect to Server

- Verify puppet server is running: `npm run puppet:start`
- Check the WebSocket URL (default: `ws://localhost:9222`)
- Ensure no firewall is blocking the port
- Check browser console for connection errors

### Agent Status Shows "Disconnected"

- Load the Chrome extension in `chrome://extensions`
- Check that the extension is connected to the puppet server
- Verify the server URL in extension settings
- Review server logs for agent connection messages

### Commands Timeout

- Ensure the target tab is loaded and active
- Increase the timeout value in connection settings
- Check if the page has JavaScript errors (console)
- Some operations (like screenshot) require visible tabs

### Screenshots Don't Appear

- Screenshots only capture visible tab content
- Bring the target tab to the foreground
- Ensure the tab is not minimized
- Try PNG format if JPEG fails

## Security Considerations

1. **Local Network Only**: By default, the server binds to localhost. Use caution when exposing to network.
2. **API Key**: Always use API key authentication in production environments.
3. **HTTPS/WSS**: Use TLS for encrypted communication over untrusted networks.
4. **CORS**: The server validates origins; ensure your console origin is allowed.
5. **Sensitive Data**: Cookies, storage, and network logs may contain sensitive information.

## Tips & Best Practices

- **Use the logs**: The log stream at the bottom shows all operations and errors
- **JSON Formatting**: Use a JSON validator before setting cookies or storage
- **Network Capture**: Start capture before navigating to catch all traffic
- **Screenshots**: Larger viewports take longer to capture
- **Tab IDs**: Tab IDs change when tabs are closed/reopened
- **Selectors**: Test CSS selectors in browser DevTools first

## Contributing

To extend the web console:

1. Add new UI elements in `index.html`
2. Add styling in `styles.css`
3. Add event handlers and logic in `app.js`
4. Follow existing patterns for consistency
5. Test with both connected and disconnected states

## License

MIT License - Same as the parent Supextension project
