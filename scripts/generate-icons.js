/**
 * Simple icon generator script
 * Creates basic colored square icons for development
 * 
 * For production, replace with proper branded icons
 */

const fs = require('fs');
const path = require('path');

const sizes = [16, 32, 48, 128];
const iconDir = path.join(__dirname, '..', 'src', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

// Create simple SVG-based placeholder icons
// These will be converted to PNG in a real build process
sizes.forEach(size => {
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#grad)"/>
  <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="${size * 0.5}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">S</text>
</svg>`;
  
  fs.writeFileSync(path.join(iconDir, `icon${size}.svg`), svg);
  console.log(`Created icon${size}.svg`);
});

console.log('\\nNote: For Chrome extension, you need PNG icons.');
console.log('Convert these SVGs to PNGs using a tool like:');
console.log('  - Inkscape: inkscape icon.svg --export-type=png -w 128 -h 128');
console.log('  - ImageMagick: convert icon.svg icon.png');
console.log('  - Online: https://svgtopng.com/');

