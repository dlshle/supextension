# Quick Start Guide - Supextension Puppet Console

Get up and running with the web console in 5 minutes.

## Step 1: Prerequisites

You need three components running:

1. ✅ **Chrome Extension** loaded in Chrome (`chrome://extensions`)
2. ✅ **Puppet Server** running (`npm run puppet:start`)
3. ✅ **Web Server** serving the console (see below)

## Step 2: Start the Web Server

From the repository root, start an HTTP server:

```bash
python3 -m http.server 8080
```

Or use Node.js:

```bash
npx http-server -p 8080
```

## Step 3: Open the Console

Visit [http://localhost:8080/web-client/](http://localhost:8080/web-client/) in your browser.

You should see the **Remote Control Console** with:
- A connection form at the top
- Status indicators showing "Disconnected" and "Unknown"
- Disabled control cards below

## Step 4: Connect

In the **Server Connection** panel:

1. Confirm the URL is `ws://localhost:9222` (or your custom server URL)
2. Leave API Key blank (unless you configured one)
3. Click **Connect**

The status indicators should update:
- **Connection**: Green "Connected"
- **Agent**: Green "Connected" (if your Chrome extension is running)

## Step 5: Run Your First Command

Try navigating to a website:

1. Scroll to the **Navigation** card
2. Enter `https://example.com` in the URL field
3. Click **Go**
4. Check the logs at the bottom—you should see "Navigate succeeded"
5. The Chrome browser should navigate to example.com

## Step 6: Explore Features

### Take a Screenshot

1. Go to the **Screenshots** card
2. Click **Capture Screenshot**
3. See the preview appear
4. Click **Download Image** to save it

### Extract Page Text

1. Go to the **DOM & Text** card
2. Click **Get All Text**
3. See the page text appear in the textarea below

### Run JavaScript

1. Go to the **Script Injection** card
2. The default code is `return document.title;`
3. Click **Run Script**
4. See the page title in the output

### View Cookies

1. Go to the **Cookies** card
2. Click **Get Cookies**
3. See all cookies for the current page

## Troubleshooting

### "Connect to the puppet server before running commands"

The web console is not connected. Check:
- Is the puppet server running? (`npm run puppet:start`)
- Is the WebSocket URL correct? (`ws://localhost:9222`)
- Check the browser console for errors (F12)

### Agent Status Shows "Disconnected"

The Chrome extension is not connected to the server. Check:
- Is the extension loaded in Chrome?
- Open the extension popup and verify it's active
- Check the puppet server logs for connection messages

### Commands Timeout

- Make sure the browser tab is visible and active
- Some operations require the tab to be in the foreground
- Try increasing the timeout in connection settings

## Next Steps

- Read the [full documentation](./README.md) for all features
- Explore network capture for monitoring HTTP traffic
- Try the storage and cookie management features
- Use the Tab ID field to control specific browser tabs

## Help & Support

- See [web-client/README.md](./README.md) for detailed usage
- See [puppet/README.md](../puppet/README.md) for server configuration
- See [README.md](../README.md) for the main project documentation

Happy automating! 🎭
