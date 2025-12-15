"""
Puppet Client - Python client for remote browser control
Can be used in Python environments to communicate with the puppet server via WebSocket
"""

import json
import asyncio
import websockets
import logging
from typing import Optional, Dict, Any, Union, List

logger = logging.getLogger(__name__)


class PuppetClient:
    def __init__(self, config: Union[str, Dict[str, Any]]):
        """
        Initialize the PuppetClient
        
        Args:
            config: Either a URL string or a configuration dictionary
        """
        if isinstance(config, str):
            self.config = {
                'url': config,
                'timeout': 30000,
                'reconnect': True,
                'reconnectDelay': 5000,
                'apiKey': None,
            }
        else:
            self.config = {
                'timeout': 30000,
                'reconnect': True,
                'reconnectDelay': 5000,
                'apiKey': None,
                **config,
            }

        self.websocket = None
        self.message_id = 0
        self.pending_requests = {}
        self.is_connected = False
        self.should_reconnect = True
        self._connection_lock = asyncio.Lock()

    async def connect(self):
        """
        Connect to the puppet server
        """
        async with self._connection_lock:
            if self.is_connected:
                return

        try:
            # Connect to WebSocket server
            self.websocket = await websockets.connect(self.config['url'])
            
            # Send identification as client
            identify_msg = {
                'type': 'identify',
                'role': 'client',
                'apiKey': self.config['apiKey'],
                'name': 'remote-python-client'
            }
            await self.websocket.send(json.dumps(identify_msg))
            
            # Wait for ready confirmation
            async def wait_for_ready():
                while True:
                    response = await self.websocket.recv()
                    message = json.loads(response)
                    
                    if message.get('type') == 'ready':
                        async with self._connection_lock:
                            self.is_connected = True
                        logger.info('[Puppet Client] Connected and identified')
                        return
                    
                    elif message.get('type') == 'error':
                        raise Exception(message.get('error', 'Connection error'))
            
            # Wait for ready with timeout
            await asyncio.wait_for(wait_for_ready(), timeout=5.0)
            
        except asyncio.TimeoutError:
            if self.websocket:
                await self.websocket.close()
            raise Exception('Identification timeout')
        except Exception as e:
            if self.websocket:
                await self.websocket.close()
            raise Exception(f'Failed to connect to puppet server: {str(e)}')

    async def disconnect(self):
        """
        Disconnect from the puppet server
        """
        self.should_reconnect = False
        if self.websocket:
            await self.websocket.close()
            self.websocket = None
            
        async with self._connection_lock:
            self.is_connected = False

        # Cancel all pending requests
        for request_id in list(self.pending_requests.keys()):
            future = self.pending_requests.pop(request_id)
            if not future.done():
                future.set_exception(Exception('Client disconnected'))

    async def _handle_message(self, data: str):
        """
        Handle incoming message
        """
        try:
            message = json.loads(data)
            
            if message.get('type') == 'agent-status':
                logger.info(f'[Puppet Client] Agent status: {message.get("status")}')
                return

            if message.get('type') == 'event':
                logger.info(f'[Puppet Client] Event: {message.get("event")}')
                return

            if message.get('type') == 'response':
                msg_id = message.get('id')
                if msg_id and msg_id in self.pending_requests:
                    future = self.pending_requests.pop(msg_id)
                    if not future.done():
                        future.set_result({
                            'success': message.get('success'),
                            'data': message.get('data'),
                            'error': message.get('error')
                        })
                return
                
        except Exception as e:
            logger.error(f'[Puppet Client] Failed to parse message: {e}')

    async def _listen(self):
        """
        Listen for incoming messages
        """
        try:
            async for message in self.websocket:
                await self._handle_message(message)
        except websockets.exceptions.ConnectionClosed:
            logger.info('[Puppet Client] Disconnected from server')
            async with self._connection_lock:
                self.is_connected = False
                
            # Attempt reconnection if enabled
            if self.should_reconnect and self.config['reconnect']:
                logger.info('[Puppet Client] Reconnecting...')
                await asyncio.sleep(self.config['reconnectDelay'] / 1000)
                await self.connect()

    async def send_command(self, method: str, params: Optional[Dict[str, Any]] = None):
        """
        Send command to puppet server
        
        Args:
            method: Command method name
            params: Command parameters
        """
        if params is None:
            params = {}

        async with self._connection_lock:
            if not self.is_connected or not self.websocket:
                raise Exception('Not connected to puppet server')

        # Create future for response
        future = asyncio.Future()
        self.message_id += 1
        msg_id = f"req_{self.message_id}"
        self.pending_requests[msg_id] = future

        # Prepare message
        message = {
            'type': 'command',
            'id': msg_id,
            'method': method,
            'params': params,
        }

        try:
            await self.websocket.send(json.dumps(message))
            # Wait for response with timeout
            return await asyncio.wait_for(future, timeout=self.config['timeout'] / 1000)
        except asyncio.TimeoutError:
            # Clean up on timeout
            self.pending_requests.pop(msg_id, None)
            raise Exception('Request timeout')

    # ==================== Navigation APIs ====================

    async def navigate(self, url: str, tab_id: Optional[str] = None):
        """Navigate to a URL"""
        return await self.send_command('navigate', {'url': url, 'tabId': tab_id})

    async def navigate_back(self, tab_id: Optional[str] = None):
        """Navigate back in history"""
        return await self.send_command('navigateBack', {'tabId': tab_id})

    async def scroll(self, x: int, y: int, behavior: str = 'auto', tab_id: Optional[str] = None):
        """Scroll the page"""
        return await self.send_command('scroll', {'x': x, 'y': y, 'behavior': behavior, 'tabId': tab_id})

    # ==================== DOM APIs ====================

    async def get_dom(self, selector: str, tab_id: Optional[str] = None):
        """Get DOM elements matching selector"""
        return await self.send_command('getDOM', {'selector': selector, 'tabId': tab_id})

    async def get_all_text(self, tab_id: Optional[str] = None):
        """Get all text content from page"""
        return await self.send_command('getAllText', {'tabId': tab_id})

    # ==================== Screenshot APIs ====================

    async def take_screenshot(self, format: str = 'png', quality: Optional[int] = None, tab_id: Optional[str] = None):
        """Take screenshot of current page"""
        params = {'format': format}
        if quality is not None:
            params['quality'] = quality
        if tab_id is not None:
            params['tabId'] = tab_id
        return await self.send_command('takeScreenshot', params)

    # ==================== Script Injection APIs ====================

    async def inject_script(self, code: str, timing: str = 'immediate', wait_for_selector: Optional[str] = None, tab_id: Optional[str] = None):
        """Inject JavaScript code into page"""
        params = {
            'code': code,
            'timing': timing
        }
        if wait_for_selector is not None:
            params['waitForSelector'] = wait_for_selector
        if tab_id is not None:
            params['tabId'] = tab_id
        return await self.send_command('injectScript', params)

    # ==================== Storage APIs ====================

    async def get_storage(self, storage_type: str, keys: Optional[List[str]] = None, tab_id: Optional[str] = None):
        """Get storage values"""
        params = {'storageType': storage_type}
        if keys is not None:
            params['keys'] = keys
        if tab_id is not None:
            params['tabId'] = tab_id
        return await self.send_command('getStorage', params)

    async def set_storage(self, storage_type: str, data: Dict[str, Any], tab_id: Optional[str] = None):
        """Set storage values"""
        params = {'storageType': storage_type, 'data': data}
        if tab_id is not None:
            params['tabId'] = tab_id
        return await self.send_command('setStorage', params)

    # ==================== Cookie APIs ====================

    async def get_cookies(self, url: Optional[str] = None, name: Optional[str] = None):
        """Get cookies"""
        params = {}
        if url is not None:
            params['url'] = url
        if name is not None:
            params['name'] = name
        return await self.send_command('getCookies', params)

    async def set_cookie(self, cookie: Dict[str, Any]):
        """Set a cookie"""
        return await self.send_command('setCookie', {'cookie': cookie})

    async def delete_cookie(self, url: str, name: str):
        """Delete a cookie"""
        return await self.send_command('deleteCookie', {'url': url, 'name': name})

    # ==================== Network Capture APIs ====================

    async def start_network_capture(self):
        """Start network capture"""
        return await self.send_command('startNetworkCapture')

    async def stop_network_capture(self):
        """Stop network capture"""
        return await self.send_command('stopNetworkCapture')

    async def get_network_log(self):
        """Get network log"""
        return await self.send_command('getNetworkLog')

    async def clear_network_log(self):
        """Clear network log"""
        return await self.send_command('clearNetworkLog')

    # ==================== Tab APIs ====================

    async def get_all_tabs(self):
        """Get all tabs"""
        return await self.send_command('getAllTabs')

    # ==================== Utility Methods ====================

    def connected(self) -> bool:
        """Check if client is connected"""
        return self.is_connected

    async def wait_for_connection(self, timeout: int = 5000):
        """Wait for connection to be established"""
        start_time = asyncio.get_event_loop().time()
        while not self.connected() and (asyncio.get_event_loop().time() - start_time) * 1000 < timeout:
            await asyncio.sleep(0.1)
        
        if not self.connected():
            raise Exception('Connection timeout')