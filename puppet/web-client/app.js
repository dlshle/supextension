(() => {
  const { PuppetClient } = window;
  if (!PuppetClient) {
    console.error('[Puppet Console] PuppetClient is not available.');
    alert('Puppet client library failed to load. Please ensure ../client.js is accessible.');
    return;
  }

  const MAX_LOG_ENTRIES = 250;

  const elements = {
    connectionForm: document.getElementById('connection-form'),
    serverUrl: document.getElementById('server-url'),
    apiKey: document.getElementById('api-key'),
    timeout: document.getElementById('timeout-input'),
    reconnectToggle: document.getElementById('reconnect-toggle'),
    reconnectDelay: document.getElementById('reconnect-delay-input'),
    connectButton: document.getElementById('connect-button'),
    disconnectButton: document.getElementById('disconnect-button'),
    connectionStatus: document.getElementById('connection-status'),
    agentStatus: document.getElementById('agent-status'),
    connectionGuards: document.querySelectorAll('fieldset[data-connection-guard]'),
    tabIdInput: document.getElementById('tab-id-input'),
    logStream: document.getElementById('log-stream'),
    clearLog: document.getElementById('clear-log'),
    navigateForm: document.getElementById('navigate-form'),
    navigateUrl: document.getElementById('navigate-url'),
    navigateBack: document.getElementById('navigate-back'),
    scrollForm: document.getElementById('scroll-form'),
    scrollX: document.getElementById('scroll-x'),
    scrollY: document.getElementById('scroll-y'),
    scrollBehavior: document.getElementById('scroll-behavior'),
    scrollToTop: document.getElementById('scroll-to-top'),
    scrollToBottom: document.getElementById('scroll-to-bottom'),
    domForm: document.getElementById('dom-form'),
    domSelector: document.getElementById('dom-selector'),
    domOutput: document.getElementById('dom-output'),
    textButton: document.getElementById('get-text'),
    textOutput: document.getElementById('text-output'),
    scriptForm: document.getElementById('script-form'),
    scriptCode: document.getElementById('script-code'),
    scriptTiming: document.getElementById('script-timing'),
    waitSelector: document.getElementById('wait-selector'),
    scriptOutput: document.getElementById('script-output'),
    screenshotForm: document.getElementById('screenshot-form'),
    screenshotFormat: document.getElementById('screenshot-format'),
    screenshotQuality: document.getElementById('screenshot-quality'),
    screenshotPreview: document.getElementById('screenshot-preview'),
    screenshotDownload: document.getElementById('download-screenshot'),
    storageGetForm: document.getElementById('get-storage-form'),
    storageTypeGet: document.getElementById('storage-type'),
    storageKeys: document.getElementById('storage-keys'),
    storageSetForm: document.getElementById('set-storage-form'),
    storageTypeSet: document.getElementById('storage-type-set'),
    storageJson: document.getElementById('storage-json'),
    storageOutput: document.getElementById('storage-output'),
    cookiesGetForm: document.getElementById('get-cookies-form'),
    cookieUrl: document.getElementById('cookie-url'),
    cookieName: document.getElementById('cookie-name'),
    cookiesSetForm: document.getElementById('set-cookie-form'),
    cookieJson: document.getElementById('cookie-json'),
    cookiesDeleteForm: document.getElementById('delete-cookie-form'),
    deleteCookieUrl: document.getElementById('delete-cookie-url'),
    deleteCookieName: document.getElementById('delete-cookie-name'),
    cookiesOutput: document.getElementById('cookies-output'),
    startNetwork: document.getElementById('start-network'),
    stopNetwork: document.getElementById('stop-network'),
    fetchNetwork: document.getElementById('get-network-log'),
    clearNetwork: document.getElementById('clear-network-log'),
    networkOutput: document.getElementById('network-output'),
    refreshTabs: document.getElementById('refresh-tabs'),
    tabsListContainer: document.getElementById('tabs-list-container'),
  };

  const state = {
    client: null,
    connectionState: 'disconnected',
    screenshotData: null,
    lastScreenshotFormat: 'png',
    disconnectRequested: false,
  };

  class UIPuppetClient extends PuppetClient {
    constructor(config, hooks) {
      super(config);
      this.hooks = hooks;
    }

    async connect() {
      const result = await super.connect();
      this.hooks?.onConnected?.();
      this.attachSocketHooks();
      return result;
    }

    attachSocketHooks() {
      if (!this.ws) return;
      const previousClose = this.ws.onclose;
      this.ws.onclose = (...args) => {
        this.hooks?.onDisconnected?.();
        if (typeof previousClose === 'function') {
          previousClose.apply(this.ws, args);
        }
      };
    }

    handleMessage(data) {
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'agent-status') {
          this.hooks?.onAgentStatus?.(parsed.status);
        } else if (parsed.type === 'event') {
          this.hooks?.onEvent?.(parsed.event);
        }
      } catch (error) {
        console.warn('[Puppet Console] Unable to parse incoming message', error);
      }
      super.handleMessage(data);
    }
  }

  function bindEvents() {
    elements.connectionForm.addEventListener('submit', handleConnectSubmit);
    elements.disconnectButton.addEventListener('click', handleDisconnectClick);
    elements.reconnectToggle.addEventListener('change', updateReconnectField);
    elements.clearLog.addEventListener('click', clearLogs);

    elements.navigateForm.addEventListener('submit', handleNavigateSubmit);
    elements.navigateBack.addEventListener('click', handleNavigateBack);

    // Scroll event handlers with defensive checks
    if (elements.scrollForm) {
      elements.scrollForm.addEventListener('submit', handleScrollSubmit);
    } else {
      console.error('[Puppet Console] scroll-form element not found');
    }
    if (elements.scrollToTop) {
      elements.scrollToTop.addEventListener('click', handleScrollToTop);
    } else {
      console.error('[Puppet Console] scroll-to-top element not found');
    }
    if (elements.scrollToBottom) {
      elements.scrollToBottom.addEventListener('click', handleScrollToBottom);
    } else {
      console.error('[Puppet Console] scroll-to-bottom element not found');
    }

    elements.domForm.addEventListener('submit', handleDomSubmit);
    elements.textButton.addEventListener('click', handleGetText);

    elements.scriptForm.addEventListener('submit', handleScriptSubmit);

    elements.screenshotFormat.addEventListener('change', toggleScreenshotQuality);
    elements.screenshotForm.addEventListener('submit', handleScreenshotSubmit);
    elements.screenshotDownload.addEventListener('click', downloadScreenshot);

    elements.storageGetForm.addEventListener('submit', handleGetStorage);
    elements.storageSetForm.addEventListener('submit', handleSetStorage);

    elements.cookiesGetForm.addEventListener('submit', handleGetCookies);
    elements.cookiesSetForm.addEventListener('submit', handleSetCookie);
    elements.cookiesDeleteForm.addEventListener('submit', handleDeleteCookie);

    elements.startNetwork.addEventListener('click', () => runCommand('Start network capture', () => state.client.startNetworkCapture()));
    elements.stopNetwork.addEventListener('click', () => runCommand('Stop network capture', () => state.client.stopNetworkCapture()));
    elements.fetchNetwork.addEventListener('click', () =>
      runCommand('Fetch network log', () => state.client.getNetworkLog(), {
        onSuccess: (response) => setPreText(elements.networkOutput, response.data, 'Network log is empty.'),
      })
    );
    elements.clearNetwork.addEventListener('click', () =>
      runCommand('Clear network log', () => state.client.clearNetworkLog(), {
        onSuccess: () => setPreText(elements.networkOutput, null, 'Network log cleared.'),
      })
    );
    elements.refreshTabs.addEventListener('click', handleRefreshTabs);
  }

  function getConnectionConfig() {
    return {
      url: elements.serverUrl.value.trim(),
      apiKey: elements.apiKey.value.trim() || null,
      timeout: parsePositiveNumber(elements.timeout.value, 30000),
      reconnect: elements.reconnectToggle.checked,
      reconnectDelay: parsePositiveNumber(elements.reconnectDelay.value, 5000),
    };
  }

  async function handleConnectSubmit(event) {
    event.preventDefault();
    if (state.connectionState === 'connecting') return;

    const config = getConnectionConfig();
    if (!config.url) {
      addLog('Please provide a WebSocket URL.', 'error');
      elements.serverUrl.focus();
      return;
    }

    if (state.client) {
      state.disconnectRequested = true;
      state.client.disconnect();
      state.client = null;
    }

    const hooks = {
      onConnected: handleClientConnected,
      onDisconnected: handleClientDisconnected,
      onAgentStatus: setAgentStatus,
      onEvent: (payload) => addLog('Agent event', 'info', payload),
    };

    const client = new UIPuppetClient(config, hooks);
    state.client = client;
    state.disconnectRequested = false;

    setConnectionState('connecting');
    addLog(`Connecting to ${config.url}...`, 'info');

    try {
      await client.connect();
    } catch (error) {
      addLog('Failed to connect to puppet server', 'error', error?.message || error);
      setConnectionState('disconnected');
      state.client = null;
    }
  }

  function handleDisconnectClick() {
    if (!state.client) {
      return;
    }
    state.disconnectRequested = true;
    state.client.disconnect();
    state.client = null;
    setConnectionState('disconnected');
    setAgentStatus('unknown');
    addLog('Disconnected from puppet server', 'info');
  }

  function handleClientConnected() {
    const message = state.connectionState === 'connecting' ? 'Connected to puppet server' : 'Reconnected to puppet server';
    setConnectionState('connected');
    addLog(message, 'success');
  }

  function handleClientDisconnected() {
    if (state.disconnectRequested) {
      state.disconnectRequested = false;
      return;
    }

    const willReconnect = Boolean(state.client?.config?.reconnect);
    if (willReconnect) {
      setConnectionState('connecting');
      addLog('Connection lost. Attempting to reconnect...', 'error');
    } else {
      setConnectionState('disconnected');
      addLog('Connection closed.', 'error');
      setAgentStatus('unknown');
    }
  }

  function handleNavigateSubmit(event) {
    event.preventDefault();
    const url = elements.navigateUrl.value.trim();
    if (!url) {
      addLog('Enter a URL to navigate.', 'error');
      return;
    }
    const tabId = readTabId();
    if (tabId === null) return;
    runCommand('Navigate', () => state.client.navigate(url, tabId));
  }

  function handleNavigateBack() {
    const tabId = readTabId();
    if (tabId === null) return;
    runCommand('Navigate back', () => state.client.navigateBack(tabId));
  }

  function handleScrollSubmit(event) {
    event.preventDefault();
    console.log('[Puppet Console] Scroll form submitted');
    const tabId = readTabId();
    if (tabId === null) return;

    if (!elements.scrollX || !elements.scrollY || !elements.scrollBehavior) {
      console.error('[Puppet Console] Scroll form elements not found');
      addLog('Scroll form elements not found', 'error');
      return;
    }

    const xRaw = elements.scrollX.value.trim();
    const yRaw = elements.scrollY.value.trim();
    const x = xRaw ? Number(xRaw) : undefined;
    const y = yRaw ? Number(yRaw) : undefined;
    const behavior = elements.scrollBehavior.value;

    console.log('[Puppet Console] Scroll params:', { x, y, behavior, tabId });

    if (x === undefined && y === undefined) {
      // If both are empty, scroll to bottom
      runCommand('Scroll to bottom', () => state.client.scroll(undefined, undefined, behavior, tabId));
    } else {
      runCommand('Scroll page', () => state.client.scroll(x, y, behavior, tabId));
    }
  }

  function handleScrollToTop() {
    console.log('[Puppet Console] Scroll to top clicked');
    const tabId = readTabId();
    if (tabId === null) return;
    if (!elements.scrollBehavior) {
      console.error('[Puppet Console] scroll-behavior element not found');
      return;
    }
    const behavior = elements.scrollBehavior.value;
    runCommand('Scroll to top', () => state.client.scroll(undefined, 0, behavior, tabId));
  }

  function handleScrollToBottom() {
    console.log('[Puppet Console] Scroll to bottom clicked');
    const tabId = readTabId();
    if (tabId === null) return;
    if (!elements.scrollBehavior) {
      console.error('[Puppet Console] scroll-behavior element not found');
      return;
    }
    const behavior = elements.scrollBehavior.value;
    runCommand('Scroll to bottom', () => state.client.scroll(undefined, undefined, behavior, tabId));
  }

  function handleDomSubmit(event) {
    event.preventDefault();
    const selector = elements.domSelector.value.trim();
    const tabId = readTabId();
    if (tabId === null) return;
    runCommand('Fetch DOM', () => state.client.getDOM(selector || undefined, tabId), {
      onSuccess: (response) => setPreText(elements.domOutput, response.data, 'No DOM data returned.'),
    });
  }

  function handleGetText() {
    const tabId = readTabId();
    if (tabId === null) return;
    runCommand('Get visible text', () => state.client.getAllText(tabId), {
      onSuccess: (response) => setTextareaValue(elements.textOutput, response.data, 'No text returned.'),
    });
  }

  function handleScriptSubmit(event) {
    event.preventDefault();
    const code = elements.scriptCode.value.trim();
    if (!code) {
      addLog('Add JavaScript code to execute.', 'error');
      return;
    }
    const timing = elements.scriptTiming.value;
    const waitFor = elements.waitSelector.value.trim() || undefined;
    const tabId = readTabId();
    if (tabId === null) return;
    runCommand('Inject script', () => state.client.injectScript(code, timing, waitFor, tabId), {
      onSuccess: (response) => setPreText(elements.scriptOutput, response.data, 'Script executed without return value.'),
    });
  }

  function handleScreenshotSubmit(event) {
    event.preventDefault();
    const format = elements.screenshotFormat.value;
    const tabId = readTabId();
    if (tabId === null) return;
    const quality = format === 'jpeg' ? clampNumber(parsePositiveNumber(elements.screenshotQuality.value, 80), 0, 100) : undefined;

    runCommand('Take screenshot', () => state.client.takeScreenshot(format, quality, tabId), {
      onSuccess: (response) => {
        if (response.data) {
          state.screenshotData = response.data;
          state.lastScreenshotFormat = format;
          elements.screenshotPreview.src = response.data;
          elements.screenshotDownload.disabled = false;
        } else {
          addLog('Screenshot returned no data.', 'error');
        }
      },
    });
  }

  function handleGetStorage(event) {
    event.preventDefault();
    const tabId = readTabId();
    if (tabId === null) return;

    const type = elements.storageTypeGet.value;
    const keysRaw = elements.storageKeys.value.trim();
    const keys = keysRaw ? keysRaw.split(',').map((key) => key.trim()).filter(Boolean) : undefined;

    runCommand(`Get ${type} storage`, () => state.client.getStorage(type, keys, tabId), {
      onSuccess: (response) => setPreText(elements.storageOutput, response.data, 'Storage appears to be empty.'),
    });
  }

  function handleSetStorage(event) {
    event.preventDefault();
    const tabId = readTabId();
    if (tabId === null) return;

    const type = elements.storageTypeSet.value;
    const payload = parseJsonInput(elements.storageJson.value);
    if (payload === null) return;

    runCommand(`Set ${type} storage`, () => state.client.setStorage(type, payload, tabId), {
      onSuccess: () => setPreText(elements.storageOutput, payload, 'Storage updated.'),
    });
  }

  function handleGetCookies(event) {
    event.preventDefault();
    const url = elements.cookieUrl.value.trim() || undefined;
    const name = elements.cookieName.value.trim() || undefined;
    runCommand('Get cookies', () => state.client.getCookies(url, name), {
      onSuccess: (response) => setPreText(elements.cookiesOutput, response.data, 'No cookies were returned.'),
    });
  }

  function handleSetCookie(event) {
    event.preventDefault();
    const cookie = parseJsonInput(elements.cookieJson.value);
    if (!cookie) {
      return;
    }
    runCommand('Set cookie', () => state.client.setCookie(cookie), {
      onSuccess: (response) => setPreText(elements.cookiesOutput, response.data, 'Cookie set.'),
    });
  }

  function handleDeleteCookie(event) {
    event.preventDefault();
    const url = elements.deleteCookieUrl.value.trim();
    const name = elements.deleteCookieName.value.trim();
    if (!url || !name) {
      addLog('Both URL and name are required to delete a cookie.', 'error');
      return;
    }
    runCommand('Delete cookie', () => state.client.deleteCookie(url, name), {
      onSuccess: () => setPreText(elements.cookiesOutput, `Deleted ${name}`, ''),
    });
  }

  function handleRefreshTabs() {
    console.log('[Puppet Console] handleRefreshTabs called');
    if (!state.client) {
      console.error('[Puppet Console] No client available');
      addLog('No client available', 'error');
      return;
    }
    console.log('[Puppet Console] Client exists, connected:', state.client.connected());
    console.log('[Puppet Console] Client has getAllTabs method:', typeof state.client.getAllTabs);

    runCommand('Get all tabs', () => state.client.getAllTabs(), {
      onSuccess: (response) => {
        console.log('[Puppet Console] getAllTabs response:', response);
        renderTabs(response.data);
      },
      onError: (response) => {
        console.error('[Puppet Console] getAllTabs error:', response);
        addLog('Failed to get tabs: ' + (response?.error || 'Unknown error'), 'error');
      },
      onException: (error) => {
        console.error('[Puppet Console] getAllTabs exception:', error);
        addLog('Exception getting tabs: ' + error?.message, 'error');
      }
    });
  }

  function renderTabs(tabs) {
    if (!tabs || tabs.length === 0) {
      elements.tabsListContainer.innerHTML = '<div class="tab-item"><div class="tab-info"><div class="tab-title">No tabs found</div></div></div>';
      return;
    }

    elements.tabsListContainer.innerHTML = '';

    tabs.forEach(tab => {
      const tabElement = document.createElement('div');
      tabElement.className = `tab-item ${tab.active ? 'active' : ''}`;
      tabElement.innerHTML = `
        <div class="tab-info">
          <div class="tab-icon">
            ${tab.favIconUrl ? `<img src="${tab.favIconUrl}" width="12" height="12" style="width: 12px; height: 12px;" alt="" onerror="this.style.display='none'; this.parentElement.innerHTML='W'; this.parentElement.style.display='flex'; this.parentElement.style.alignItems='center'; this.parentElement.style.justifyContent='center';">` : 'W'}
          </div>
          <div>
            <div class="tab-title">${escapeHtml(tab.title || 'No Title')}</div>
            <div class="tab-url">${escapeHtml(tab.url || '')}</div>
          </div>
        </div>
      `;

      // Add click handler to focus on the tab
      tabElement.addEventListener('click', () => {
        handleFocusTab(tab.id);
      });

      elements.tabsListContainer.appendChild(tabElement);
    });
  }

  function handleFocusTab(tabId) {
    if (!tabId) return;

    // Set the tab ID in the input field for future operations
    elements.tabIdInput.value = tabId.toString();
    addLog(`Tab #${tabId} selected as target for operations`, 'info');

    // Refresh the tab list to show the selected tab as the active one visually
    runCommand('Get all tabs', () => state.client.getAllTabs(), {
      onSuccess: (response) => renderTabs(response.data),
    });
  }

  function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function toggleScreenshotQuality() {
    const isJpeg = elements.screenshotFormat.value === 'jpeg';
    elements.screenshotQuality.disabled = !isJpeg;
  }

  function downloadScreenshot() {
    if (!state.screenshotData) return;
    const link = document.createElement('a');
    link.href = state.screenshotData;
    link.download = `screenshot-${Date.now()}.${state.lastScreenshotFormat}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLog('Screenshot downloaded.', 'info');
  }

  async function runCommand(label, executor, options = {}) {
    if (!ensureClient()) {
      console.log('[Puppet Console] runCommand: Client not connected');
      return;
    }
    console.log(`[Puppet Console] runCommand: Executing ${label}`);
    try {
      const response = await executor();
      console.log(`[Puppet Console] runCommand: ${label} response:`, response);
      if (response?.success) {
        if (options.logResponse) {
          addLog(`${label} succeeded`, 'success', response.data);
        } else {
          addLog(`${label} succeeded`, 'success');
        }
        options.onSuccess?.(response);
        return response;
      }
      const message = response?.error || 'Unknown error';
      addLog(`${label} failed`, 'error', message);
      options.onError?.(response);
      return response;
    } catch (error) {
      console.error(`[Puppet Console] runCommand: ${label} exception:`, error);
      addLog(`${label} error`, 'error', error?.message || error);
      options.onException?.(error);
      return null;
    }
  }

  function ensureClient() {
    if (!state.client || !state.client.connected()) {
      addLog('Connect to the puppet server before running commands.', 'error');
      return false;
    }
    return true;
  }

  function readTabId() {
    const raw = elements.tabIdInput.value.trim();
    if (!raw) return undefined;
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
      addLog('Tab ID must be a valid number.', 'error');
      return null;
    }
    return parsed;
  }

  function parseJsonInput(value) {
    if (!value.trim()) {
      addLog('JSON input cannot be empty.', 'error');
      return null;
    }
    try {
      return JSON.parse(value);
    } catch (error) {
      addLog('Invalid JSON input.', 'error', error.message);
      return null;
    }
  }

  function parsePositiveNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function setConnectionState(nextState) {
    state.connectionState = nextState;
    const labels = {
      connected: 'Connected',
      connecting: 'Connecting…',
      disconnected: 'Disconnected',
    };
    const classMap = {
      connected: 'status-chip status-chip--connected',
      connecting: 'status-chip status-chip--unknown',
      disconnected: 'status-chip status-chip--disconnected',
    };

    elements.connectionStatus.textContent = labels[nextState] || 'Unknown';
    elements.connectionStatus.className = classMap[nextState] || 'status-chip status-chip--unknown';

    elements.connectButton.disabled = nextState !== 'disconnected';
    elements.disconnectButton.disabled = nextState === 'disconnected';

    elements.connectionGuards.forEach((fieldset) => {
      fieldset.disabled = nextState !== 'connected';
    });

    if (nextState === 'disconnected') {
      state.screenshotData = null;
      elements.screenshotPreview.removeAttribute('src');
      elements.screenshotDownload.disabled = true;
    }
  }

  function setAgentStatus(status) {
    if (!status) {
      elements.agentStatus.textContent = 'Unknown';
      elements.agentStatus.className = 'status-chip status-chip--unknown';
      return;
    }

    const normalized = String(status).toLowerCase();
    if (normalized === 'connected' || normalized === 'ready') {
      elements.agentStatus.textContent = normalized === 'ready' ? 'Ready' : 'Connected';
      elements.agentStatus.className = 'status-chip status-chip--connected';
    } else if (normalized === 'disconnected' || normalized === 'offline') {
      elements.agentStatus.textContent = 'Disconnected';
      elements.agentStatus.className = 'status-chip status-chip--disconnected';
    } else {
      elements.agentStatus.textContent = formatStatusLabel(status);
      elements.agentStatus.className = 'status-chip status-chip--unknown';
    }
  }

  function setPreText(element, value, fallback) {
    if (!element) return;
    if (value === undefined || value === null || value === '') {
      element.textContent = fallback || 'No data available.';
    } else if (typeof value === 'string') {
      element.textContent = value;
    } else {
      element.textContent = JSON.stringify(value, null, 2);
    }
  }

  function setTextareaValue(element, value, fallback) {
    if (!element) return;
    if (value === undefined || value === null || value === '') {
      element.value = '';
      element.placeholder = fallback || 'No data available.';
    } else if (typeof value === 'string') {
      element.value = value;
    } else {
      element.value = JSON.stringify(value, null, 2);
    }
  }

  function addLog(message, level = 'info', payload) {
    const entry = document.createElement('div');
    entry.className = `log-entry log-entry--${level}`;

    const header = document.createElement('div');
    const time = document.createElement('span');
    time.className = 'log-entry__time';
    time.textContent = new Date().toLocaleTimeString();

    const type = document.createElement('span');
    type.className = 'log-entry__type';
    type.textContent = level.toUpperCase();

    const messageEl = document.createElement('span');
    messageEl.className = 'log-entry__message';
    messageEl.textContent = message;

    header.append(time, type, messageEl);
    entry.appendChild(header);

    if (payload !== undefined && payload !== null && payload !== '') {
      const pre = document.createElement('pre');
      pre.textContent = formatPayload(payload);
      entry.appendChild(pre);
    }

    elements.logStream.appendChild(entry);
    elements.logStream.scrollTop = elements.logStream.scrollHeight;

    while (elements.logStream.children.length > MAX_LOG_ENTRIES) {
      elements.logStream.removeChild(elements.logStream.firstChild);
    }
  }

  function formatPayload(payload) {
    if (typeof payload === 'string') return payload;
    try {
      return JSON.stringify(payload, null, 2);
    } catch (error) {
      return String(payload);
    }
  }

  function clearLogs() {
    elements.logStream.innerHTML = '';
    addLog('Log cleared.', 'info');
  }

  function updateReconnectField() {
    elements.reconnectDelay.disabled = !elements.reconnectToggle.checked;
  }

  function formatStatusLabel(status) {
    return String(status)
      .split(/[\s_-]+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function init() {
    bindEvents();
    setConnectionState('disconnected');
    setAgentStatus('unknown');
    updateReconnectField();
    toggleScreenshotQuality();
    addLog('Puppet console ready. Connect to begin.', 'info');
  }

  init();
})();
