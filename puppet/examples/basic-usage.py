#!/usr/bin/env python3
"""
Basic usage example for the Python Puppet Client
"""

import asyncio
import sys
import os

# Add parent directory to path so we can import the client
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from client import PuppetClient


async def main():
    # Create client instance
    client = PuppetClient({
        'url': 'ws://localhost:9222',
        'apiKey': None  # Add your API key here if authentication is enabled
    })

    try:
        # Connect to the puppet server
        print("Connecting to puppet server...")
        await client.connect()
        print("Connected!")

        # Get all tabs
        print("Getting tabs...")
        tabs_response = await client.get_all_tabs()
        print(f"Tabs: {tabs_response}")

        # Navigate to a website
        print("Navigating to example.com...")
        navigate_response = await client.navigate("https://example.com")
        print(f"Navigation result: {navigate_response}")

        # Get all text from the page
        print("Getting all text from page...")
        text_response = await client.get_all_text()
        print(f"Page text preview: {str(text_response)[:200]}...")

        # Take a screenshot
        print("Taking screenshot...")
        screenshot_response = await client.take_screenshot()
        print(f"Screenshot taken: {screenshot_response['success']}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        # Disconnect
        print("Disconnecting...")
        await client.disconnect()
        print("Disconnected!")


if __name__ == "__main__":
    asyncio.run(main())