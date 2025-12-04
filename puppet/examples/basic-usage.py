#!/usr/bin/env python3
"""
Basic Usage Example - Supextension Puppet Client (Python)
Demonstrates basic browser automation using the Python puppet client
"""

import asyncio
import sys
import os

# Add parent directory to path to import client
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from client import PuppetClient


async def main():
    """Run basic automation example"""
    # Connect to puppet server
    client = PuppetClient("ws://localhost:9222")
    
    print("Connecting to puppet server...")
    await client.connect()
    print("Connected!")

    try:
        # Navigate to a website
        print("\n=== Navigation ===")
        print("Navigating to example.com...")
        nav_result = await client.navigate("https://example.com")
        print(f"Navigation result: {nav_result}")
        
        # Wait for page to load
        await asyncio.sleep(2)

        # Get page DOM
        print("\n=== DOM Access ===")
        dom_result = await client.get_dom()
        if dom_result["success"] and dom_result["data"]:
            data = dom_result["data"]
            print(f"Page title: {data['title']}")
            print(f"Page URL: {data['url']}")
            print(f"HTML length: {len(data['html'])}")

        # Get all visible text
        print("\n=== Text Extraction ===")
        text_result = await client.get_all_text()
        if text_result["success"] and text_result["data"]:
            print("Page text (first 200 chars):")
            print(text_result["data"][:200])

        # Take a screenshot
        print("\n=== Screenshot ===")
        screenshot_result = await client.take_screenshot("png")
        if screenshot_result["success"] and screenshot_result["data"]:
            print(f"Screenshot captured! Length: {len(screenshot_result['data'])}")
            print(f"Data URL prefix: {screenshot_result['data'][:50]}")

        # Inject a script
        print("\n=== Script Injection ===")
        script_result = await client.inject_script(
            'document.title = "Modified by Puppet"; return document.title;'
        )
        if script_result["success"]:
            print(f"Script result: {script_result['data']}")

        # Get cookies
        print("\n=== Cookies ===")
        cookies_result = await client.get_cookies()
        if cookies_result["success"] and cookies_result["data"]:
            print(f"Number of cookies: {len(cookies_result['data'])}")
            for cookie in cookies_result["data"]:
                value = cookie.get("value", "")[:20]
                print(f"  - {cookie['name']}: {value}...")

        # Test storage
        print("\n=== Storage ===")
        import time
        await client.set_storage("local", {
            "myKey": "myValue",
            "timestamp": int(time.time())
        })
        print("Set localStorage values")
        
        storage_result = await client.get_storage("local")
        if storage_result["success"] and storage_result["data"]:
            print(f"localStorage contents: {storage_result['data']}")

        print("\n=== Test Complete ===")
    except Exception as error:
        print(f"Error: {error}")
    finally:
        await client.disconnect()
        print("Disconnected")


if __name__ == "__main__":
    asyncio.run(main())
