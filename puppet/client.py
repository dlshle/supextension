#!/usr/bin/env python3
"""
Puppet Client - Python client for remote browser control
"""

import json
import asyncio
import websockets
from typing import Optional, Dict, Any, List


class PuppetClient:
    """Python client for Supextension Puppet service"""

    def __init__(self, url: str = "ws://localhost:9222", timeout: int = 30):
        """
        Initialize the puppet client
        
        Args:
            url: WebSocket URL of the puppet server
            timeout: Request timeout in seconds
        """
        self.url = url
        self.timeout = timeout
        self.ws = None
        self.message_id = 0
        self.pending_requests: Dict[str, asyncio.Future] = {}
        self.is_connected = False

    async def connect(self):
        """Connect to the puppet server"""
        try:
            self.ws = await websockets.connect(self.url)
            self.is_connected = True
            print(f"[Puppet Client] Connected to {self.url}")
            
            # Start message handler task
            asyncio.create_task(self._handle_messages())
        except Exception as e:
            raise Exception(f"Failed to connect to puppet server: {e}")

    async def disconnect(self):
        """Disconnect from the puppet server"""
        self.is_connected = False
        if self.ws:
            await self.ws.close()
            self.ws = None
        
        # Cancel all pending requests
        for future in self.pending_requests.values():
            if not future.done():
                future.set_exception(Exception("Client disconnected"))
        self.pending_requests.clear()

    async def _handle_messages(self):
        """Handle incoming messages from the server"""
        try:
            async for message in self.ws:
                data = json.loads(message)
                
                if data.get("type") == "connected":
                    print(f"[Puppet Client] {data.get('message')}")
                    continue
                
                msg_id = data.get("id")
                if msg_id and msg_id in self.pending_requests:
                    future = self.pending_requests.pop(msg_id)
                    if not future.done():
                        future.set_result({
                            "success": data.get("success", False),
                            "data": data.get("data"),
                            "error": data.get("error")
                        })
        except websockets.exceptions.ConnectionClosed:
            self.is_connected = False
            print("[Puppet Client] Connection closed")
        except Exception as e:
            print(f"[Puppet Client] Error handling messages: {e}")

    async def _send_command(self, method: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Send a command to the puppet server"""
        if not self.is_connected or not self.ws:
            raise Exception("Not connected to puppet server")

        self.message_id += 1
        msg_id = f"req_{self.message_id}"
        
        future = asyncio.Future()
        self.pending_requests[msg_id] = future

        message = {
            "id": msg_id,
            "method": method,
            "params": params or {}
        }

        try:
            await self.ws.send(json.dumps(message))
            response = await asyncio.wait_for(future, timeout=self.timeout)
            return response
        except asyncio.TimeoutError:
            self.pending_requests.pop(msg_id, None)
            raise Exception("Request timeout")

    # ==================== Navigation APIs ====================

    async def navigate(self, url: str, tab_id: Optional[int] = None) -> Dict[str, Any]:
        """Navigate to a URL"""
        return await self._send_command("navigate", {"url": url, "tabId": tab_id})

    async def navigate_back(self, tab_id: Optional[int] = None) -> Dict[str, Any]:
        """Navigate back in history"""
        return await self._send_command("navigateBack", {"tabId": tab_id})

    # ==================== DOM APIs ====================

    async def get_dom(self, selector: Optional[str] = None, tab_id: Optional[int] = None) -> Dict[str, Any]:
        """Get DOM content"""
        return await self._send_command("getDOM", {"selector": selector, "tabId": tab_id})

    async def get_all_text(self, tab_id: Optional[int] = None) -> Dict[str, Any]:
        """Get all visible text from the page"""
        return await self._send_command("getAllText", {"tabId": tab_id})

    # ==================== Screenshot APIs ====================

    async def take_screenshot(
        self,
        format: str = "png",
        quality: Optional[int] = None,
        tab_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Take a screenshot"""
        return await self._send_command("takeScreenshot", {
            "format": format,
            "quality": quality,
            "tabId": tab_id
        })

    # ==================== Script Injection APIs ====================

    async def inject_script(
        self,
        code: str,
        timing: Optional[str] = None,
        wait_for_selector: Optional[str] = None,
        tab_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Inject JavaScript code into the page"""
        return await self._send_command("injectScript", {
            "code": code,
            "timing": timing,
            "waitForSelector": wait_for_selector,
            "tabId": tab_id
        })

    # ==================== Storage APIs ====================

    async def get_storage(
        self,
        storage_type: str,
        keys: Optional[List[str]] = None,
        tab_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Get storage data"""
        return await self._send_command("getStorage", {
            "storageType": storage_type,
            "keys": keys,
            "tabId": tab_id
        })

    async def set_storage(
        self,
        storage_type: str,
        data: Dict[str, Any],
        tab_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Set storage data"""
        return await self._send_command("setStorage", {
            "storageType": storage_type,
            "data": data,
            "tabId": tab_id
        })

    # ==================== Cookie APIs ====================

    async def get_cookies(
        self,
        url: Optional[str] = None,
        name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get cookies"""
        return await self._send_command("getCookies", {"url": url, "name": name})

    async def set_cookie(self, cookie: Dict[str, Any]) -> Dict[str, Any]:
        """Set a cookie"""
        return await self._send_command("setCookie", {"cookie": cookie})

    async def delete_cookie(self, url: str, name: str) -> Dict[str, Any]:
        """Delete a cookie"""
        return await self._send_command("deleteCookie", {"url": url, "name": name})

    # ==================== Network Capture APIs ====================

    async def start_network_capture(self) -> Dict[str, Any]:
        """Start network capture"""
        return await self._send_command("startNetworkCapture")

    async def stop_network_capture(self) -> Dict[str, Any]:
        """Stop network capture"""
        return await self._send_command("stopNetworkCapture")

    async def get_network_log(self) -> Dict[str, Any]:
        """Get network log"""
        return await self._send_command("getNetworkLog")

    async def clear_network_log(self) -> Dict[str, Any]:
        """Clear network log"""
        return await self._send_command("clearNetworkLog")

    # ==================== Utility Methods ====================

    def connected(self) -> bool:
        """Check if connected"""
        return self.is_connected

    async def wait_for_connection(self, timeout: int = 5):
        """Wait for connection"""
        start_time = asyncio.get_event_loop().time()
        while not self.is_connected and (asyncio.get_event_loop().time() - start_time) < timeout:
            await asyncio.sleep(0.1)
        if not self.is_connected:
            raise Exception("Connection timeout")


# Example usage
if __name__ == "__main__":
    async def example():
        client = PuppetClient()
        await client.connect()
        
        # Navigate to a page
        result = await client.navigate("https://example.com")
        print(f"Navigation result: {result}")
        
        # Wait for page load
        await asyncio.sleep(2)
        
        # Get page text
        text_result = await client.get_all_text()
        if text_result["success"]:
            print(f"Page text: {text_result['data'][:200]}...")
        
        await client.disconnect()

    asyncio.run(example())
