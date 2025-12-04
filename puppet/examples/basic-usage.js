#!/usr/bin/env node
/**
 * Basic Usage Example - Supextension Puppet Client
 * Demonstrates basic browser automation using the puppet client
 */

const { PuppetClient } = require('../client');

async function main() {
  // Connect to puppet server
  const puppet = new PuppetClient('ws://localhost:9222');
  
  console.log('Connecting to puppet server...');
  await puppet.connect();
  console.log('Connected!');

  try {
    // Navigate to a website
    console.log('\n=== Navigation ===');
    console.log('Navigating to example.com...');
    const navResult = await puppet.navigate('https://example.com');
    console.log('Navigation result:', navResult);
    
    // Wait a bit for page to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get page DOM
    console.log('\n=== DOM Access ===');
    const domResult = await puppet.getDOM();
    if (domResult.success && domResult.data) {
      console.log('Page title:', domResult.data.title);
      console.log('Page URL:', domResult.data.url);
      console.log('HTML length:', domResult.data.html.length);
    }

    // Get all visible text
    console.log('\n=== Text Extraction ===');
    const textResult = await puppet.getAllText();
    if (textResult.success && textResult.data) {
      console.log('Page text (first 200 chars):');
      console.log(textResult.data.substring(0, 200));
    }

    // Take a screenshot
    console.log('\n=== Screenshot ===');
    const screenshotResult = await puppet.takeScreenshot('png');
    if (screenshotResult.success && screenshotResult.data) {
      console.log('Screenshot captured! Length:', screenshotResult.data.length);
      console.log('Data URL prefix:', screenshotResult.data.substring(0, 50));
    }

    // Inject a script
    console.log('\n=== Script Injection ===');
    const scriptResult = await puppet.injectScript(
      'document.title = "Modified by Puppet"; return document.title;'
    );
    if (scriptResult.success) {
      console.log('Script result:', scriptResult.data);
    }

    // Get cookies
    console.log('\n=== Cookies ===');
    const cookiesResult = await puppet.getCookies();
    if (cookiesResult.success && cookiesResult.data) {
      console.log('Number of cookies:', cookiesResult.data.length);
      cookiesResult.data.forEach(cookie => {
        console.log(`  - ${cookie.name}: ${cookie.value.substring(0, 20)}...`);
      });
    }

    // Test storage
    console.log('\n=== Storage ===');
    await puppet.setStorage('local', { myKey: 'myValue', timestamp: Date.now() });
    console.log('Set localStorage values');
    
    const storageResult = await puppet.getStorage('local');
    if (storageResult.success && storageResult.data) {
      console.log('localStorage contents:', storageResult.data);
    }

    console.log('\n=== Test Complete ===');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    puppet.disconnect();
    console.log('Disconnected');
  }
}

// Run the example
main().catch(console.error);
