/**
 * Popup Script
 * UI for interacting with the Supextension API
 */

import { browserController } from '../api/BrowserController.js';
import type { ApiResponse, NetworkLogEntry } from '../api/types.js';

// DOM Elements
const elements = {
  // Status
  status: document.getElementById('status') as HTMLDivElement,
  statusText: document.querySelector('.status-text') as HTMLSpanElement,
  
  // Navigation
  urlInput: document.getElementById('urlInput') as HTMLInputElement,
  navigateBtn: document.getElementById('navigateBtn') as HTMLButtonElement,
  backBtn: document.getElementById('backBtn') as HTMLButtonElement,
  
  // Scrolling
  scrollTopBtn: document.getElementById('scrollTopBtn') as HTMLButtonElement,
  scrollBottomBtn: document.getElementById('scrollBottomBtn') as HTMLButtonElement,
  scrollCustomBtn: document.getElementById('scrollCustomBtn') as HTMLButtonElement,
  
  // Content
  getDomBtn: document.getElementById('getDomBtn') as HTMLButtonElement,
  getTextBtn: document.getElementById('getTextBtn') as HTMLButtonElement,
  screenshotBtn: document.getElementById('screenshotBtn') as HTMLButtonElement,
  injectBtn: document.getElementById('injectBtn') as HTMLButtonElement,
  
  // Storage
  getLocalStorageBtn: document.getElementById('getLocalStorageBtn') as HTMLButtonElement,
  getSessionStorageBtn: document.getElementById('getSessionStorageBtn') as HTMLButtonElement,
  getCookiesBtn: document.getElementById('getCookiesBtn') as HTMLButtonElement,
  
  // Network
  startCaptureBtn: document.getElementById('startCaptureBtn') as HTMLButtonElement,
  stopCaptureBtn: document.getElementById('stopCaptureBtn') as HTMLButtonElement,
  viewNetworkBtn: document.getElementById('viewNetworkBtn') as HTMLButtonElement,
  clearNetworkBtn: document.getElementById('clearNetworkBtn') as HTMLButtonElement,
  requestCount: document.getElementById('requestCount') as HTMLSpanElement,
  
  // Output
  output: document.getElementById('output') as HTMLPreElement,
  copyOutputBtn: document.getElementById('copyOutputBtn') as HTMLButtonElement,
  
  // Modal
  injectModal: document.getElementById('injectModal') as HTMLDivElement,
  closeModalBtn: document.getElementById('closeModalBtn') as HTMLButtonElement,
  scriptInput: document.getElementById('scriptInput') as HTMLTextAreaElement,
  executeScriptBtn: document.getElementById('executeScriptBtn') as HTMLButtonElement,
  
  // Scroll Modal
  scrollModal: document.getElementById('scrollModal') as HTMLDivElement,
  closeScrollModalBtn: document.getElementById('closeScrollModalBtn') as HTMLButtonElement,
  scrollXInput: document.getElementById('scrollXInput') as HTMLInputElement,
  scrollYInput: document.getElementById('scrollYInput') as HTMLInputElement,
  scrollBehaviorSelect: document.getElementById('scrollBehaviorSelect') as HTMLSelectElement,
  executeScrollBtn: document.getElementById('executeScrollBtn') as HTMLButtonElement,
};

// State
let isCapturing = true;

/**
 * Initialize the popup
 */
function init(): void {
  setupEventListeners();
  loadNetworkStats();
  // Initialize UI to show capturing state by default
  initializeCaptureUI();

  // Start polling for stats since capturing is on by default
  pollNetworkStats();
}

/**
 * Initialize UI to show capturing state by default
 */
function initializeCaptureUI(): void {
  elements.status.classList.add('capturing');
  elements.statusText.textContent = 'Capturing';
  elements.startCaptureBtn.disabled = true;
  elements.stopCaptureBtn.disabled = false;
}

/**
 * Set up all event listeners
 */
function setupEventListeners(): void {
  // Navigation
  elements.navigateBtn.addEventListener('click', handleNavigate);
  elements.urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleNavigate();
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
    if (e.target === elements.injectModal) closeModal();
  });
  
  // Scroll Modal
  elements.closeScrollModalBtn.addEventListener('click', closeScrollModal);
  elements.executeScrollBtn.addEventListener('click', handleCustomScroll);
  elements.scrollModal.addEventListener('click', (e) => {
    if (e.target === elements.scrollModal) closeScrollModal();
  });
}

/**
 * Handle navigation to URL
 */
async function handleNavigate(): Promise<void> {
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
  } else {
    showOutput(`Navigation failed: ${response.error}`, 'error');
  }
}

/**
 * Handle navigate back
 */
async function handleNavigateBack(): Promise<void> {
  setLoading(true);
  const response = await browserController.navigateBack();
  setLoading(false);
  
  if (response.success) {
    showOutput('Navigated back', 'success');
  } else {
    showOutput(`Navigation failed: ${response.error}`, 'error');
  }
}

/**
 * Handle scroll to top
 */
async function handleScrollToTop(): Promise<void> {
  setLoading(true);
  const response = await browserController.scroll(undefined, 0, 'smooth');
  setLoading(false);
  
  if (response.success) {
    showOutput('Scrolled to top', 'success');
  } else {
    showOutput(`Scroll failed: ${response.error}`, 'error');
  }
}

/**
 * Handle scroll to bottom
 */
async function handleScrollToBottom(): Promise<void> {
  setLoading(true);
  const response = await browserController.scroll(undefined, undefined, 'smooth');
  setLoading(false);
  
  if (response.success) {
    showOutput('Scrolled to bottom', 'success');
  } else {
    showOutput(`Scroll failed: ${response.error}`, 'error');
  }
}

/**
 * Handle custom scroll
 */
async function handleCustomScroll(): Promise<void> {
  const xRaw = elements.scrollXInput.value.trim();
  const yRaw = elements.scrollYInput.value.trim();
  const x = xRaw ? Number(xRaw) : undefined;
  const y = yRaw ? Number(yRaw) : undefined;
  const behavior = elements.scrollBehaviorSelect.value as 'auto' | 'smooth';
  
  closeScrollModal();
  setLoading(true);
  const response = await browserController.scroll(x, y, behavior);
  setLoading(false);
  
  if (response.success) {
    const position = x !== undefined || y !== undefined 
      ? `to (${x ?? 'auto'}, ${y ?? 'auto'})` 
      : 'to bottom';
    showOutput(`Scrolled ${position}`, 'success');
  } else {
    showOutput(`Scroll failed: ${response.error}`, 'error');
  }
}

/**
 * Open scroll modal
 */
function openScrollModal(): void {
  elements.scrollModal.classList.add('active');
  elements.scrollXInput.focus();
}

/**
 * Close scroll modal
 */
function closeScrollModal(): void {
  elements.scrollModal.classList.remove('active');
  elements.scrollXInput.value = '';
  elements.scrollYInput.value = '';
  elements.scrollBehaviorSelect.value = 'smooth';
}

/**
 * Handle get DOM
 */
async function handleGetDOM(): Promise<void> {
  setLoading(true);
  const response = await browserController.getDOM();
  setLoading(false);
  
  if (response.success && response.data) {
    const data = response.data;
    const preview = data.html.substring(0, 500) + (data.html.length > 500 ? '...' : '');
    showOutput(`Title: ${data.title}\nURL: ${data.url}\n\nHTML Preview:\n${preview}`, 'success');
  } else {
    showOutput(`Failed to get DOM: ${response.error}`, 'error');
  }
}

/**
 * Handle get all text
 */
async function handleGetText(): Promise<void> {
  setLoading(true);
  const response = await browserController.getAllText();
  setLoading(false);
  
  if (response.success && response.data) {
    const text = response.data as string;
    const preview = text.substring(0, 1000) + (text.length > 1000 ? '...' : '');
    showOutput(`Page Text (${text.length} chars):\n\n${preview}`, 'success');
  } else {
    showOutput(`Failed to get text: ${response.error}`, 'error');
  }
}

/**
 * Handle screenshot
 */
async function handleScreenshot(): Promise<void> {
  setLoading(true);
  const response = await browserController.takeScreenshot('png');
  setLoading(false);
  
  if (response.success && response.data) {
    const dataUrl = response.data as string;
    
    // Create download link
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `screenshot-${Date.now()}.png`;
    link.click();
    
    showOutput('Screenshot saved!', 'success');
  } else {
    showOutput(`Screenshot failed: ${response.error}`, 'error');
  }
}

/**
 * Handle get storage
 */
async function handleGetStorage(type: 'local' | 'session'): Promise<void> {
  setLoading(true);
  const response = await browserController.getStorage(type);
  setLoading(false);
  
  if (response.success && response.data) {
    const data = response.data as Record<string, unknown>;
    const entries = Object.entries(data);
    
    if (entries.length === 0) {
      showOutput(`${type === 'local' ? 'Local' : 'Session'} storage is empty`, 'success');
    } else {
      const formatted = JSON.stringify(data, null, 2);
      showOutput(`${type === 'local' ? 'Local' : 'Session'} Storage (${entries.length} items):\n\n${formatted}`, 'success');
    }
  } else {
    showOutput(`Failed to get storage: ${response.error}`, 'error');
  }
}

/**
 * Handle get cookies
 */
async function handleGetCookies(): Promise<void> {
  setLoading(true);
  const response = await browserController.getCookies();
  setLoading(false);
  
  if (response.success && response.data) {
    const cookies = response.data as chrome.cookies.Cookie[];
    
    if (cookies.length === 0) {
      showOutput('No cookies found for this page', 'success');
    } else {
      const formatted = cookies.map(c => `${c.name}: ${c.value.substring(0, 50)}${c.value.length > 50 ? '...' : ''}`).join('\n');
      showOutput(`Cookies (${cookies.length}):\n\n${formatted}`, 'success');
    }
  } else {
    showOutput(`Failed to get cookies: ${response.error}`, 'error');
  }
}

/**
 * Handle start network capture
 */
async function handleStartCapture(): Promise<void> {
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
  } else {
    showOutput(`Failed to start capture: ${response.error}`, 'error');
  }
}

/**
 * Handle stop network capture
 */
async function handleStopCapture(): Promise<void> {
  const response = await browserController.stopNetworkCapture();
  
  if (response.success) {
    isCapturing = false;
    elements.status.classList.remove('capturing');
    elements.statusText.textContent = 'Ready';
    elements.startCaptureBtn.disabled = false;
    elements.stopCaptureBtn.disabled = true;
    showOutput('Network capture stopped', 'success');
  } else {
    showOutput(`Failed to stop capture: ${response.error}`, 'error');
  }
}

/**
 * Handle view network log
 */
async function handleViewNetwork(): Promise<void> {
  setLoading(true);
  const response = await browserController.getNetworkLog();
  setLoading(false);
  
  if (response.success && response.data) {
    const log = response.data as NetworkLogEntry[];
    
    if (log.length === 0) {
      showOutput('No network requests captured yet', 'success');
    } else {
      const summary = log.slice(-20).map(entry => {
        const method = entry.method || 'WS';
        const status = entry.statusCode || '-';
        const url = entry.url.length > 60 ? entry.url.substring(0, 60) + '...' : entry.url;
        return `[${method}] ${status} ${url}`;
      }).join('\n');
      
      showOutput(`Last 20 requests (${log.length} total):\n\n${summary}`, 'success');
    }
  } else {
    showOutput(`Failed to get network log: ${response.error}`, 'error');
  }
}

/**
 * Handle clear network log
 */
async function handleClearNetwork(): Promise<void> {
  const response = await browserController.clearNetworkLog();
  
  if (response.success) {
    elements.requestCount.textContent = '0';
    showOutput('Network log cleared', 'success');
  } else {
    showOutput(`Failed to clear log: ${response.error}`, 'error');
  }
}

/**
 * Handle execute injected script
 */
async function handleExecuteScript(): Promise<void> {
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
  } else {
    showOutput(`Script failed: ${response.error}`, 'error');
  }
}

/**
 * Handle copy output to clipboard
 */
async function handleCopyOutput(): Promise<void> {
  const text = elements.output.textContent || '';
  
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!');
  } catch {
    showOutput('Failed to copy to clipboard', 'error');
  }
}

/**
 * Open inject script modal
 */
function openModal(): void {
  elements.injectModal.classList.add('active');
  elements.scriptInput.focus();
}

/**
 * Close inject script modal
 */
function closeModal(): void {
  elements.injectModal.classList.remove('active');
  elements.scriptInput.value = '';
}

/**
 * Show output in the output panel
 */
function showOutput(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  elements.output.textContent = message;
  elements.output.className = `output ${type}`;
}

/**
 * Set loading state
 */
function setLoading(loading: boolean): void {
  if (loading) {
    elements.statusText.textContent = 'Working...';
  } else {
    elements.statusText.textContent = isCapturing ? 'Capturing' : 'Ready';
  }
}

/**
 * Show toast notification
 */
function showToast(message: string): void {
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
async function loadNetworkStats(): Promise<void> {
  const response = await browserController.getNetworkLog();
  if (response.success && response.data) {
    const log = response.data as NetworkLogEntry[];
    elements.requestCount.textContent = log.length.toString();
  }
}

/**
 * Poll network stats while capturing
 */
function pollNetworkStats(): void {
  if (!isCapturing) return;
  
  loadNetworkStats();
  setTimeout(pollNetworkStats, 1000);
}

// Initialize popup
init();

