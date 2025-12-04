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
├── puppet/                        # Remote control server & clients
│   ├── config.json                # Server configuration
│   ├── server.js                  # Native messaging host + WS/HTTP server
│   ├── client.js / client.py      # Reference clients
│   └── examples/                  # Example scripts
├── dist/                          # Build output
├── package.json
├── tsconfig.json
└── README.md
```

## Remote Browser Control (Puppet Service)

The extension now includes a **Puppet Service** that enables remote browser control via WebSocket or HTTP. This allows external applications to programmatically control Chrome.

**Quick Start:**

```bash
# 1. Install dependencies
npm install

# 2. Build extension and load it in Chrome
npm run build

# 3. Install native messaging host (get extension ID from chrome://extensions/)
npm run puppet:install -- --extension-id=YOUR_EXTENSION_ID

# 4. Start puppet server
npm run puppet:start

# 5. Use client library to control browser
node puppet/examples/basic-usage.js
```

See [puppet.md](./puppet.md) and [puppet/README.md](./puppet/README.md) for complete documentation.

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

