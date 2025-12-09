/**
 * Popup Script
 * UI for interacting with the Supextension API
 */
import { browserController } from '../api/BrowserController.js';
// DOM Elements
const elements = {
    // Status
    status: document.getElementById('status'),
    statusText: document.querySelector('.status-text'),
    // Navigation
    urlInput: document.getElementById('urlInput'),
    navigateBtn: document.getElementById('navigateBtn'),
    backBtn: document.getElementById('backBtn'),
    // Scrolling
    scrollTopBtn: document.getElementById('scrollTopBtn'),
    scrollBottomBtn: document.getElementById('scrollBottomBtn'),
    scrollCustomBtn: document.getElementById('scrollCustomBtn'),
    // Content
    getDomBtn: document.getElementById('getDomBtn'),
    getTextBtn: document.getElementById('getTextBtn'),
    screenshotBtn: document.getElementById('screenshotBtn'),
    injectBtn: document.getElementById('injectBtn'),
    // Storage
    getLocalStorageBtn: document.getElementById('getLocalStorageBtn'),
    getSessionStorageBtn: document.getElementById('getSessionStorageBtn'),
    getCookiesBtn: document.getElementById('getCookiesBtn'),
    // Network
    startCaptureBtn: document.getElementById('startCaptureBtn'),
    stopCaptureBtn: document.getElementById('stopCaptureBtn'),
    viewNetworkBtn: document.getElementById('viewNetworkBtn'),
    clearNetworkBtn: document.getElementById('clearNetworkBtn'),
    requestCount: document.getElementById('requestCount'),
    // Output
    output: document.getElementById('output'),
    copyOutputBtn: document.getElementById('copyOutputBtn'),
    // Modal
    injectModal: document.getElementById('injectModal'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    scriptInput: document.getElementById('scriptInput'),
    executeScriptBtn: document.getElementById('executeScriptBtn'),
    // Scroll Modal
    scrollModal: document.getElementById('scrollModal'),
    closeScrollModalBtn: document.getElementById('closeScrollModalBtn'),
    scrollXInput: document.getElementById('scrollXInput'),
    scrollYInput: document.getElementById('scrollYInput'),
    scrollBehaviorSelect: document.getElementById('scrollBehaviorSelect'),
    executeScrollBtn: document.getElementById('executeScrollBtn'),
    // Tabs
    refreshTabsBtn: document.getElementById('refreshTabsBtn'),
    tabsContainer: document.getElementById('tabsContainer'),
};
// State
let isCapturing = true;
/**
 * Initialize the popup
 */
function init() {
    setupEventListeners();
    loadNetworkStats();
    // Initialize UI to show capturing state by default
    initializeCaptureUI();
    // Start polling for stats since capturing is on by default
    pollNetworkStats();
    // Load initial tab list
    handleRefreshTabs();
}
/**
 * Initialize UI to show capturing state by default
 */
function initializeCaptureUI() {
    elements.status.classList.add('capturing');
    elements.statusText.textContent = 'Capturing';
    elements.startCaptureBtn.disabled = true;
    elements.stopCaptureBtn.disabled = false;
}
/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Navigation
    elements.navigateBtn.addEventListener('click', handleNavigate);
    elements.urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter')
            handleNavigate();
    });
    elements.backBtn.addEventListener('click', handleNavigateBack);
    // Scrolling
    elements.scrollTopBtn.addEventListener('click', handleScrollToTop);
    elements.scrollBottomBtn.addEventListener('click', handleScrollToBottom);
    elements.scrollCustomBtn.addEventListener('click', () => openScrollModal());
    // Content
    elements.getDomBtn.addEventListener('click', handleGetDOM);
    elements.getTextBtn.addEventListener('click', handleGetText);
    elements.screenshotBtn.addEventListener('click', handleScreenshot);
    elements.injectBtn.addEventListener('click', () => openModal());
    // Storage
    elements.getLocalStorageBtn.addEventListener('click', () => handleGetStorage('local'));
    elements.getSessionStorageBtn.addEventListener('click', () => handleGetStorage('session'));
    elements.getCookiesBtn.addEventListener('click', handleGetCookies);
    // Network
    elements.startCaptureBtn.addEventListener('click', handleStartCapture);
    elements.stopCaptureBtn.addEventListener('click', handleStopCapture);
    elements.viewNetworkBtn.addEventListener('click', handleViewNetwork);
    elements.clearNetworkBtn.addEventListener('click', handleClearNetwork);
    // Output
    elements.copyOutputBtn.addEventListener('click', handleCopyOutput);
    // Modal
    elements.closeModalBtn.addEventListener('click', closeModal);
    elements.executeScriptBtn.addEventListener('click', handleExecuteScript);
    elements.injectModal.addEventListener('click', (e) => {
        if (e.target === elements.injectModal)
            closeModal();
    });
    // Scroll Modal
    elements.closeScrollModalBtn.addEventListener('click', closeScrollModal);
    elements.executeScrollBtn.addEventListener('click', handleCustomScroll);
    elements.scrollModal.addEventListener('click', (e) => {
        if (e.target === elements.scrollModal)
            closeScrollModal();
    });
    // Tabs
    elements.refreshTabsBtn.addEventListener('click', handleRefreshTabs);
}
/**
 * Handle navigation to URL
 */
async function handleNavigate() {
    const url = elements.urlInput.value.trim();
    if (!url) {
        showOutput('Please enter a URL', 'error');
        return;
    }
    // Add protocol if missing
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    setLoading(true);
    const response = await browserController.navigate(fullUrl);
    setLoading(false);
    if (response.success) {
        showOutput(`Navigated to: ${fullUrl}`, 'success');
        elements.urlInput.value = '';
    }
    else {
        showOutput(`Navigation failed: ${response.error}`, 'error');
    }
}
/**
 * Handle navigate back
 */
async function handleNavigateBack() {
    setLoading(true);
    const response = await browserController.navigateBack();
    setLoading(false);
    if (response.success) {
        showOutput('Navigated back', 'success');
    }
    else {
        showOutput(`Navigation failed: ${response.error}`, 'error');
    }
}
/**
 * Handle scroll to top
 */
async function handleScrollToTop() {
    setLoading(true);
    const response = await browserController.scroll(undefined, 0, 'smooth');
    setLoading(false);
    if (response.success) {
        showOutput('Scrolled to top', 'success');
    }
    else {
        showOutput(`Scroll failed: ${response.error}`, 'error');
    }
}
/**
 * Handle scroll to bottom
 */
async function handleScrollToBottom() {
    setLoading(true);
    const response = await browserController.scroll(undefined, undefined, 'smooth');
    setLoading(false);
    if (response.success) {
        showOutput('Scrolled to bottom', 'success');
    }
    else {
        showOutput(`Scroll failed: ${response.error}`, 'error');
    }
}
/**
 * Handle custom scroll
 */
async function handleCustomScroll() {
    const xRaw = elements.scrollXInput.value.trim();
    const yRaw = elements.scrollYInput.value.trim();
    const x = xRaw ? Number(xRaw) : undefined;
    const y = yRaw ? Number(yRaw) : undefined;
    const behavior = elements.scrollBehaviorSelect.value;
    closeScrollModal();
    setLoading(true);
    const response = await browserController.scroll(x, y, behavior);
    setLoading(false);
    if (response.success) {
        const position = x !== undefined || y !== undefined
            ? `to (${x ?? 'auto'}, ${y ?? 'auto'})`
            : 'to bottom';
        showOutput(`Scrolled ${position}`, 'success');
    }
    else {
        showOutput(`Scroll failed: ${response.error}`, 'error');
    }
}
/**
 * Open scroll modal
 */
function openScrollModal() {
    elements.scrollModal.classList.add('active');
    elements.scrollXInput.focus();
}
/**
 * Close scroll modal
 */
function closeScrollModal() {
    elements.scrollModal.classList.remove('active');
    elements.scrollXInput.value = '';
    elements.scrollYInput.value = '';
    elements.scrollBehaviorSelect.value = 'smooth';
}
/**
 * Handle get DOM
 */
async function handleGetDOM() {
    setLoading(true);
    const response = await browserController.getDOM();
    setLoading(false);
    if (response.success && response.data) {
        const data = response.data;
        const preview = data.html.substring(0, 500) + (data.html.length > 500 ? '...' : '');
        showOutput(`Title: ${data.title}\nURL: ${data.url}\n\nHTML Preview:\n${preview}`, 'success');
    }
    else {
        showOutput(`Failed to get DOM: ${response.error}`, 'error');
    }
}
/**
 * Handle get all text
 */
async function handleGetText() {
    setLoading(true);
    const response = await browserController.getAllText();
    setLoading(false);
    if (response.success && response.data) {
        const text = response.data;
        const preview = text.substring(0, 1000) + (text.length > 1000 ? '...' : '');
        showOutput(`Page Text (${text.length} chars):\n\n${preview}`, 'success');
    }
    else {
        showOutput(`Failed to get text: ${response.error}`, 'error');
    }
}
/**
 * Handle screenshot
 */
async function handleScreenshot() {
    setLoading(true);
    const response = await browserController.takeScreenshot('png');
    setLoading(false);
    if (response.success && response.data) {
        const dataUrl = response.data;
        // Create download link
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `screenshot-${Date.now()}.png`;
        link.click();
        showOutput('Screenshot saved!', 'success');
    }
    else {
        showOutput(`Screenshot failed: ${response.error}`, 'error');
    }
}
/**
 * Handle get storage
 */
async function handleGetStorage(type) {
    setLoading(true);
    const response = await browserController.getStorage(type);
    setLoading(false);
    if (response.success && response.data) {
        const data = response.data;
        const entries = Object.entries(data);
        if (entries.length === 0) {
            showOutput(`${type === 'local' ? 'Local' : 'Session'} storage is empty`, 'success');
        }
        else {
            const formatted = JSON.stringify(data, null, 2);
            showOutput(`${type === 'local' ? 'Local' : 'Session'} Storage (${entries.length} items):\n\n${formatted}`, 'success');
        }
    }
    else {
        showOutput(`Failed to get storage: ${response.error}`, 'error');
    }
}
/**
 * Handle get cookies
 */
async function handleGetCookies() {
    setLoading(true);
    const response = await browserController.getCookies();
    setLoading(false);
    if (response.success && response.data) {
        const cookies = response.data;
        if (cookies.length === 0) {
            showOutput('No cookies found for this page', 'success');
        }
        else {
            const formatted = cookies.map(c => `${c.name}: ${c.value.substring(0, 50)}${c.value.length > 50 ? '...' : ''}`).join('\n');
            showOutput(`Cookies (${cookies.length}):\n\n${formatted}`, 'success');
        }
    }
    else {
        showOutput(`Failed to get cookies: ${response.error}`, 'error');
    }
}
/**
 * Handle start network capture
 */
async function handleStartCapture() {
    const response = await browserController.startNetworkCapture();
    if (response.success) {
        isCapturing = true;
        elements.status.classList.add('capturing');
        elements.statusText.textContent = 'Capturing';
        elements.startCaptureBtn.disabled = true;
        elements.stopCaptureBtn.disabled = false;
        showOutput('Network capture started', 'success');
        // Start polling for stats
        pollNetworkStats();
    }
    else {
        showOutput(`Failed to start capture: ${response.error}`, 'error');
    }
}
/**
 * Handle stop network capture
 */
async function handleStopCapture() {
    const response = await browserController.stopNetworkCapture();
    if (response.success) {
        isCapturing = false;
        elements.status.classList.remove('capturing');
        elements.statusText.textContent = 'Ready';
        elements.startCaptureBtn.disabled = false;
        elements.stopCaptureBtn.disabled = true;
        showOutput('Network capture stopped', 'success');
    }
    else {
        showOutput(`Failed to stop capture: ${response.error}`, 'error');
    }
}
/**
 * Handle view network log
 */
async function handleViewNetwork() {
    setLoading(true);
    const response = await browserController.getNetworkLog();
    setLoading(false);
    if (response.success && response.data) {
        const log = response.data;
        if (log.length === 0) {
            showOutput('No network requests captured yet', 'success');
        }
        else {
            const summary = log.slice(-20).map(entry => {
                const method = entry.method || 'WS';
                const status = entry.statusCode || '-';
                const url = entry.url.length > 60 ? entry.url.substring(0, 60) + '...' : entry.url;
                return `[${method}] ${status} ${url}`;
            }).join('\n');
            showOutput(`Last 20 requests (${log.length} total):\n\n${summary}`, 'success');
        }
    }
    else {
        showOutput(`Failed to get network log: ${response.error}`, 'error');
    }
}
/**
 * Handle clear network log
 */
async function handleClearNetwork() {
    const response = await browserController.clearNetworkLog();
    if (response.success) {
        elements.requestCount.textContent = '0';
        showOutput('Network log cleared', 'success');
    }
    else {
        showOutput(`Failed to clear log: ${response.error}`, 'error');
    }
}
/**
 * Handle refresh tabs
 */
async function handleRefreshTabs() {
    setLoading(true);
    const response = await browserController.getAllTabs();
    setLoading(false);
    if (response.success && response.data) {
        renderTabs(response.data);
    }
    else {
        showOutput(`Failed to get tabs: ${response.error}`, 'error');
        elements.tabsContainer.innerHTML = '<div class="tab-item"><div class="tab-info"><div class="tab-title">Error loading tabs</div></div></div>';
    }
}
/**
 * Render tabs in the UI
 */
function renderTabs(tabs) {
    if (!tabs || tabs.length === 0) {
        elements.tabsContainer.innerHTML = '<div class="tab-item"><div class="tab-info"><div class="tab-title">No tabs found</div></div></div>';
        return;
    }
    elements.tabsContainer.innerHTML = '';
    tabs.forEach(tab => {
        const tabElement = document.createElement('div');
        tabElement.className = `tab-item ${tab.active ? 'active' : ''}`;
        tabElement.innerHTML = `
      <div class="tab-info">
        <div class="tab-icon">
          ${tab.favIconUrl ? `<img src="${tab.favIconUrl}" width="12" height="12" style="width: 12px; height: 12px;" alt="" onerror="this.style.display='none'; this.parentElement.innerHTML='W'; this.parentElement.style.display='flex'; this.parentElement.style.alignItems='center'; this.parentElement.style.justifyContent='center';">` : 'W'}
        </div>
        <div>
          <div class="tab-title">${escapeHtml(tab.title)}</div>
          <div class="tab-url">${escapeHtml(tab.url)}</div>
        </div>
      </div>
    `;
        // Add click handler to focus on the tab
        tabElement.addEventListener('click', () => {
            handleFocusTab(tab.id);
        });
        elements.tabsContainer.appendChild(tabElement);
    });
}
/**
 * Focus on a specific tab
 */
async function handleFocusTab(tabId) {
    if (!tabId)
        return;
    setLoading(true);
    // We can't programmatically focus a tab from popup, so we just show a message
    const currentTabsResponse = await browserController.getAllTabs();
    if (currentTabsResponse.success && currentTabsResponse.data) {
        const targetTab = currentTabsResponse.data.find(t => t.id === tabId);
        if (targetTab) {
            showOutput(`Selected tab: ${targetTab.title}\nURL: ${targetTab.url}`, 'info');
            // Update the UI to show this is the selected tab
            renderTabs(currentTabsResponse.data);
        }
    }
    setLoading(false);
}
/**
 * Simple HTML escaping function to prevent XSS
 */
function escapeHtml(unsafe) {
    if (!unsafe)
        return '';
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
/**
 * Handle execute injected script
 */
async function handleExecuteScript() {
    const code = elements.scriptInput.value.trim();
    if (!code) {
        showOutput('Please enter JavaScript code', 'error');
        return;
    }
    closeModal();
    setLoading(true);
    const response = await browserController.injectScript(code);
    setLoading(false);
    if (response.success) {
        const result = response.data;
        showOutput(`Script executed!\n\nResult: ${JSON.stringify(result, null, 2)}`, 'success');
    }
    else {
        showOutput(`Script failed: ${response.error}`, 'error');
    }
}
/**
 * Handle copy output to clipboard
 */
async function handleCopyOutput() {
    const text = elements.output.textContent || '';
    try {
        await navigator.clipboard.writeText(text);
        showToast('Copied to clipboard!');
    }
    catch {
        showOutput('Failed to copy to clipboard', 'error');
    }
}
/**
 * Open inject script modal
 */
function openModal() {
    elements.injectModal.classList.add('active');
    elements.scriptInput.focus();
}
/**
 * Close inject script modal
 */
function closeModal() {
    elements.injectModal.classList.remove('active');
    elements.scriptInput.value = '';
}
/**
 * Show output in the output panel
 */
function showOutput(message, type = 'info') {
    elements.output.textContent = message;
    elements.output.className = `output ${type}`;
}
/**
 * Set loading state
 */
function setLoading(loading) {
    if (loading) {
        elements.statusText.textContent = 'Working...';
    }
    else {
        elements.statusText.textContent = isCapturing ? 'Capturing' : 'Ready';
    }
}
/**
 * Show toast notification
 */
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 2500);
}
/**
 * Load network stats
 */
async function loadNetworkStats() {
    const response = await browserController.getNetworkLog();
    if (response.success && response.data) {
        const log = response.data;
        elements.requestCount.textContent = log.length.toString();
    }
}
/**
 * Poll network stats while capturing
 */
function pollNetworkStats() {
    if (!isCapturing)
        return;
    loadNetworkStats();
    setTimeout(pollNetworkStats, 1000);
}
// Initialize popup
init();
//# sourceMappingURL=popup.js.map