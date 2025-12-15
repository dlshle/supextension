# Chrome DevTools Protocol (CDP) Debugging Setup - Problem Solving Log

This document logs the step-by-step process of enabling Chrome DevTools Protocol (CDP) debugging in a Docker container with Chrome browser and NoVNC.

## Initial Situation

We have a Docker container setup that runs:
- **Xvfb** - Virtual framebuffer for headless display
- **Fluxbox** - Lightweight window manager
- **x11vnc** - VNC server to share the display
- **noVNC** - Web-based VNC client
- **Chrome browser** - Needs to run with CDP debugging enabled

The goal is to:
1. Automatically start Chrome with CDP debugging enabled
2. Expose CDP on port 9222 to the host machine
3. Automatically load the browser extension
4. Make Chrome visible in the NoVNC interface

---

## Problem 1: Chrome Not Starting Automatically

### Symptoms
- Chrome didn't start when the container launched
- Only the default desktop was visible in NoVNC
- Had to manually open Chrome via CLI

### Root Cause
Chrome wasn't configured to start automatically via supervisor. The supervisor configuration was missing a Chrome program entry.

### Solution
Added a `[program:chrome]` entry to the supervisor configuration in `Dockerfile.browser`:

```ini
[program:chrome]
command=/usr/local/bin/start-chrome.sh
priority=5
autorestart=true
startsecs=5
user=chromeuser
environment=DISPLAY=":99",HOME="/home/chromeuser"
```

### Why It Works
Supervisor manages all processes in the container. By adding Chrome as a supervised program, it automatically starts when the container launches and restarts if it crashes. The priority ensures it starts after the window manager (Fluxbox) is ready.

---

## Problem 2: Chrome Welcome Dialog Blocking Startup

### Symptoms
- Chrome started but showed a "Welcome to Google Chrome" dialog
- Dialog required user interaction to proceed
- This prevented automated startup

### Root Cause
Chrome's first-run dialog appears on first launch and requires user interaction, blocking automated execution.

### Solution
Added flags to skip first-run dialogs:

```bash
--no-first-run \
--no-default-browser-check \
--disable-default-apps \
--disable-sync
```

### Why It Works
These flags tell Chrome to skip all first-run setup dialogs and checks, allowing it to start immediately without user interaction.

---

## Problem 3: Permission Errors When Starting Chrome

### Symptoms
- Chrome process failed to start
- Error logs showed:
  ```
  mkdir: cannot create directory '/root': Permission denied
  touch: cannot touch '/root/.local/share/applications/mimeapps.list': Permission denied
  chrome_crashpad_handler: --database is required
  ```

### Root Cause
Chrome was trying to write to `/root` directory, but it was running as `chromeuser` without proper `HOME` environment variable set. Chrome also needed certain directories to exist.

### Solution
1. **Set HOME environment variable** in both the startup script and supervisor config:
   ```bash
   export HOME=/home/chromeuser
   ```

2. **Created required directories** with proper ownership:
   ```dockerfile
   RUN mkdir -p /home/chromeuser/chrome-data /home/chromeuser/.local/share/applications && \
       chown -R chromeuser:chromeuser /home/chromeuser
   ```

3. **Disabled crashpad** to avoid crash handler database issues:
   ```bash
   --disable-crashpad \
   --disable-breakpad
   ```

### Why It Works
Setting `HOME` ensures Chrome writes to the correct user directory. Creating directories upfront prevents permission errors. Disabling crashpad removes the need for crash report database configuration.

---

## Problem 4: Extension Not Loading Automatically

### Symptoms
- Chrome started but extension wasn't loaded
- Had to manually load the extension via `chrome://extensions`

### Root Cause
The `--disable-extensions-except` flag was preventing the extension from loading properly, even though `--load-extension` was specified.

### Solution
Removed the `--disable-extensions-except` flag and kept only:
```bash
--load-extension=/opt/extension
```

Also added validation and permission fixes:
```bash
# Ensure extension directory is readable
chmod -R a+r /opt/extension 2>/dev/null || true
```

### Why It Works
The `--disable-extensions-except` flag is meant to allow only specific extensions, but it can conflict with `--load-extension` in some Chrome versions. Using only `--load-extension` is simpler and more reliable. The `chmod` ensures the extension is readable even if volume mount permissions differ.

---

## Problem 5: CDP Not Accessible from Host

### Symptoms
- CDP worked inside the container (`curl http://localhost:9222/json` from inside container worked)
- CDP was NOT accessible from the host machine
- Port mapping showed: `9222/tcp -> 0.0.0.0:9222`
- But `netstat` showed Chrome listening on `127.0.0.1:9222` instead of `0.0.0.0:9222`

### Root Cause
Even though we specified `--remote-debugging-address=0.0.0.0`, Chrome was still binding to `127.0.0.1:9222` (localhost only). This meant:
- Inside container: ✅ Accessible (localhost works)
- From host: ❌ Not accessible (can't reach container's localhost)

This is a known Chrome behavior - the `--remote-debugging-address` flag doesn't always work as expected, especially in containerized environments.

### Solution
Used **socat** as a TCP proxy to forward connections:

1. **Changed Chrome to use internal port 9223**:
   ```bash
   --remote-debugging-port=9223 \
   --remote-debugging-address=127.0.0.1
   ```

2. **Added socat proxy** in supervisor to forward port 9222 → 9223:
   ```ini
   [program:cdp-proxy]
   command=/bin/bash -c "sleep 5 && /usr/bin/socat TCP-LISTEN:9222,fork,reuseaddr,bind=0.0.0.0 TCP:127.0.0.1:9223"
   priority=6
   autorestart=true
   ```

3. **Installed socat** in Dockerfile:
   ```dockerfile
   RUN apt-get install -y ... socat ...
   ```

### Why It Works
The solution creates a two-layer architecture:

```
Host Machine (port 9222)
    ↓ Docker port mapping
Container (port 9222) - socat listening on 0.0.0.0:9222
    ↓ TCP forwarding
Chrome (port 9223) - listening on 127.0.0.1:9223
```

- **socat** listens on `0.0.0.0:9222` (all interfaces), making it accessible from outside the container
- **socat** forwards all connections to Chrome on `127.0.0.1:9223` (internal)
- Docker port mapping exposes container's port 9222 to the host
- Chrome can safely bind to localhost since it only needs to accept connections from socat

This is a common pattern for exposing services that only bind to localhost in containers.

---

## Final Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Host Machine                          │
│                                                          │
│  curl http://localhost:9222/json                        │
└────────────────────┬────────────────────────────────────┘
                     │ Docker Port Mapping
                     │ -p 9222:9222
┌────────────────────▼────────────────────────────────────┐
│              Docker Container                            │
│                                                          │
│  ┌──────────────────────────────────────────┐          │
│  │  Supervisor                              │          │
│  │                                           │          │
│  │  [program:cdp-proxy]                     │          │
│  │  socat TCP-LISTEN:9222 (0.0.0.0)         │          │
│  │         ↓ forwards to                    │          │
│  │  TCP:127.0.0.1:9223                      │          │
│  └──────────────────┬───────────────────────┘          │
│                     │                                    │
│                     │ localhost connection              │
│  ┌──────────────────▼───────────────────────┐          │
│  │  Chrome Browser                          │          │
│  │  --remote-debugging-port=9223            │          │
│  │  --remote-debugging-address=127.0.0.1    │          │
│  │  --load-extension=/opt/extension         │          │
│  └──────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────┘
```

---

## Key Learnings

1. **Supervisor for Process Management**: Using supervisor ensures all services start automatically and restart on failure.

2. **Chrome Flags Matter**: Chrome has many flags that control behavior. `--no-first-run`, `--disable-crashpad`, etc. are essential for automated environments.

3. **Permission Issues in Containers**: Always set proper `HOME` environment variable and create required directories with correct ownership.

4. **Port Binding in Containers**: Services binding to `127.0.0.1` are not accessible from outside the container, even with port mapping. Use a proxy (like socat) to forward connections.

5. **Extension Loading**: Sometimes simpler is better - `--load-extension` alone works better than combining it with `--disable-extensions-except`.

6. **Debugging Strategy**: When something doesn't work:
   - Check if the process is running (`ps aux`)
   - Check what ports are listening (`netstat` or `ss`)
   - Test from inside the container first
   - Check logs for errors
   - Verify environment variables and permissions

---

## Verification Commands

After deployment, verify everything works:

```bash
# Check if Chrome is running
docker exec supextension-browser-container ps aux | grep chrome

# Check if CDP proxy is running
docker exec supextension-browser-container ps aux | grep socat

# Test CDP from host
curl http://localhost:9222/json

# Test CDP from inside container
docker exec supextension-browser-container curl -s http://localhost:9223/json

# Check port bindings
docker exec supextension-browser-container netstat -tlnp | grep 922

# Check supervisor status
docker exec supextension-browser-container supervisorctl status

# View Chrome logs
docker exec supextension-browser-container tail -f /var/log/chrome.log
```

---

## Files Modified

1. **Dockerfile.browser**
   - Added socat package
   - Created Chrome startup script with proper flags
   - Added supervisor configuration for Chrome and CDP proxy
   - Set up proper directory permissions

2. **deploy_browser.sh**
   - Added CDP port mapping (`-p 9222:9222`)
   - Added CDP status checking

3. **check_cdp.sh** (new)
   - Diagnostic script to check CDP status
   - Tests CDP from both host and inside container
   - Shows extension loading status
   - Displays relevant logs

---

## Conclusion

The final solution uses a **socat TCP proxy** to bridge the gap between Chrome's localhost-only binding and the need for external access. This is a robust pattern that works reliably in containerized environments where services don't bind to all interfaces by default.

