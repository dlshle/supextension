# Supextension

A powerful Chrome extension for browser automation with a clean API layer. Control your browser programmatically for navigation, DOM manipulation, screenshots, network interception, and more.

## Features

- **Navigation Control**: Navigate to URLs, go back in history
- **DOM Access**: Read DOM content, get all visible text from pages
- **Screenshots**: Capture visible area of any webpage
- **Script Injection**: Inject JavaScript at specific moments (on load, when elements appear)
- **Storage Access**: Read and write to localStorage and sessionStorage
- **Cookie Management**: Get, set, and delete cookies
- **Network Interception**: Capture and log HTTP/WebSocket traffic

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Presentation Layer                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │   Popup UI   │  │   Future    │  │   Future    │  │
│  │  (Buttons)   │  │   Web UI    │  │   Server    │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  │
└─────────┼────────────────┼────────────────┼─────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────┐
│                     API Layer                        │
│              (BrowserController Class)               │
│  • navigate()        • takeScreenshot()              │
│  • navigateBack()    • injectScript()                │
│  • getDOM()          • getStorage() / setStorage()   │
│  • getAllText()      • getCookies() / setCookie()    │
│  • startNetworkCapture() / getNetworkLog()           │
│  • getAllTabs()      • other methods...              │
└─────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────┐
│                  Background Worker                   │
│         (Service Worker - handles all logic)         │
└─────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────┐
│                  Content Scripts                     │
│        (Runs in webpage context for DOM access)      │
└─────────────────────────────────────────────────────┘
```

## Adding New Features

To add a new browser automation feature across the entire architecture:

1. **Define API Types**: Add the new message type and interface in `src/api/types.ts`
   - Add to the `MessageType` union type
   - Create a new message interface (e.g., `NewFeatureMessage`)
   - Include in the `ExtensionMessage` union type
   - Define any response data interfaces if needed

2. **Implement Background Handler**: Add functionality in `src/background/background.ts`
   - Add case for the new message type in the message handler switch
   - Create a handler function (e.g., `handleNewFeature()`)
   - Implement the actual browser API interactions

3. **Update Server Communication**: Modify `src/background/serverConnection.ts` if needed
   - Add mapping to the `methodMap` for puppet server communication
   - Map the client method name to the internal message type

4. **Add API Method**: Extend `src/api/BrowserController.ts`
   - Add a new method that sends the appropriate message
   - Include proper typing and documentation

5. **Update Popup UI**: Modify files in `src/popup/`
   - Add HTML elements in `popup.html`
   - Add CSS styling in `popup.css`
   - Add JavaScript logic in `popup.ts`

6. **Update Puppet Client**: Modify `puppet/client.js`
   - Add a new method that calls `sendCommand()` with the appropriate method name

7. **Update Web Client**: Modify files in `puppet/web-client/`
   - Add HTML elements in `index.html`
   - Add CSS styling in `styles.css`
   - Add JavaScript logic in `app.js`

8. **Build and Test**: Run `npm run build` to compile and test the new functionality

## Installation

### Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the extension:
   ```bash
   npm run build
   ```

3. Load in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `dist` folder

### Development Mode

For auto-rebuild on changes:
```bash
npm run watch
```

## API Usage

The extension exposes a `BrowserController` class that can be used programmatically:

```typescript
import { browserController } from './api/BrowserController';

// Navigate to a URL
await browserController.navigate('https://example.com');

// Navigate back
await browserController.navigateBack();

// Get DOM content
const dom = await browserController.getDOM();
console.log(dom.data?.html);

// Get all text from the page
const text = await browserController.getAllText();
console.log(text.data);

// Take a screenshot
const screenshot = await browserController.takeScreenshot('png');
// screenshot.data contains the base64 data URL

// Inject JavaScript
await browserController.injectScript('console.log("Hello from injected script!")');

// Wait for element and then inject
await browserController.injectScript(
  'document.querySelector("#myButton").click()',
  'immediate',
  '#myButton'  // Wait for this selector
);

// Get localStorage
const storage = await browserController.getStorage('local');
console.log(storage.data);

// Set localStorage
await browserController.setStorage('local', { myKey: 'myValue' });

// Get cookies
const cookies = await browserController.getCookies();
console.log(cookies.data);

// Start network capture
await browserController.startNetworkCapture();

// ... browse pages ...

// Get captured network log
const networkLog = await browserController.getNetworkLog();
console.log(networkLog.data);

// Stop capture
await browserController.stopNetworkCapture();
```

## Project Structure

```
supextension/
├── src/
│   ├── api/
│   │   ├── BrowserController.ts   # Main API class
│   │   ├── types.ts               # TypeScript types
│   │   └── index.ts               # API exports
│   ├── background/
│   │   └── background.ts          # Service worker
│   ├── content/
│   │   └── content.ts             # Content script
│   ├── popup/
│   │   ├── popup.html             # Popup UI
│   │   ├── popup.css              # Styles
│   │   └── popup.ts               # Popup logic
│   ├── icons/                     # Extension icons
│   └── manifest.json              # Extension manifest
├── puppet/                        # Remote control server & client
│   ├── config.json                # Server configuration
│   ├── server.js                  # WebSocket/HTTP coordinator server
│   ├── client.js                  # Browser client library
│   ├── examples/                  # Example scripts
│   └── web-client/                # No-code web console
│       ├── index.html             # Main UI
│       ├── styles.css             # Styling
│       ├── app.js                 # Application logic
│       └── README.md              # Console documentation
├── dist/                          # Build output
├── package.json
├── tsconfig.json
└── README.md
```

## Remote Browser Control (Puppet Service)

The extension now includes a **Puppet Service** that enables remote browser control over WebSocket. A lightweight Node.js server coordinates commands between the extension (as an "agent") and any number of remote clients.

**Quick Start:**

```bash
# 1. Install dependencies
npm install

# 2. Build the extension and load dist/ in Chrome
npm run build

# 3. Start the remote coordinator server (defaults to ws://localhost:9222)
npm run puppet:start

# 4. (Optional) Set a custom server URL for the extension
#    The popup can expose a simple input backed by chrome.storage.local
#    or run the following in the DevTools console for the extension service worker:
chrome.storage.local.set({ puppetServerUrl: 'ws://YOUR_SERVER:9222' });

# 5. Run the JavaScript client example to issue commands
node puppet/examples/basic-usage.js
```

Prefer a no-code workflow? Launch the [web console](./puppet/web-client/README.md) after starting the puppet server:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080/puppet/web-client/`, connect to your WebSocket endpoint, and drive the browser from the UI.

See [puppet.md](./puppet.md) and [puppet/README.md](./puppet/README.md) for complete documentation, including deployment, authentication, and API details.

## Future Enhancements

- [ ] WebSocket message content capture
- [ ] Request/response body capture
- [x] Remote control server (Puppet Service)
- [ ] Record and playback functionality
- [ ] Element selector builder
- [ ] Network request modification/blocking

## Permissions Explained

- `tabs`: Access tab information and navigation
- `activeTab`: Access currently active tab
- `scripting`: Execute scripts in pages
- `cookies`: Read and write cookies
- `storage`: Use extension storage
- `webRequest`: Intercept network requests
- `debugger`: Advanced debugging capabilities (WebSocket capture)
- `<all_urls>`: Access all websites

## License

MIT

## Docker Deployment

The Puppet server can be deployed using Docker for easier distribution and scaling.

### Prerequisites
- Docker installed on your system

### Quick Deploy
Run the deployment script to build and start the container:
```bash
./deploy.sh
```

### Manual Docker Deployment
To build and run manually:

1. Build the image:
   ```bash
   docker build -t supextension-puppet .
   ```

2. Run the container:
   ```bash
   docker run -d \
     --name supextension-puppet-container \
     -p 9222:9222 \
     -p 9223:9223 \
     -e PUPPET_HOST=0.0.0.0 \
     -e PUPPET_PORT=9222 \
     -e PUPPET_HTTP_PORT=9223 \
     supextension-puppet
   ```

### Configuration via Environment Variables
The Puppet server can be configured with the following environment variables:
- `PUPPET_HOST`: Host address (default: 0.0.0.0)
- `PUPPET_PORT`: WebSocket port (default: 9222)
- `PUPPET_HTTP_PORT`: HTTP port (default: 9223)
- `PUPPET_HTTP_ENABLED`: Enable HTTP server (default: true)
- `PUPPET_API_KEY`: API key for client authentication
- `PUPPET_AGENT_SECRET`: Secret for agent authentication
- `PUPPET_ALLOWED_ORIGINS`: Comma-separated list of allowed origins
- `PUPPET_DEBUG`: Enable debug logging (default: false)

### Health Check
Once deployed, verify the service is running at `http://localhost:9223/health`

