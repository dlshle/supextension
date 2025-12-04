/**
 * Copy static assets to dist folder
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');
const distDir = path.join(__dirname, '..', 'dist');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy manifest.json
const manifestSrc = path.join(srcDir, 'manifest.json');
const manifestDest = path.join(distDir, 'manifest.json');
fs.copyFileSync(manifestSrc, manifestDest);
console.log('Copied manifest.json');

// Copy popup folder
const popupSrc = path.join(srcDir, 'popup');
const popupDest = path.join(distDir, 'popup');

if (!fs.existsSync(popupDest)) {
  fs.mkdirSync(popupDest, { recursive: true });
}

// Copy popup.html and popup.css
['popup.html', 'popup.css'].forEach(file => {
  const src = path.join(popupSrc, file);
  const dest = path.join(popupDest, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied popup/${file}`);
  }
});

// Copy icons folder
const iconsSrc = path.join(srcDir, 'icons');
const iconsDest = path.join(distDir, 'icons');

if (fs.existsSync(iconsSrc)) {
  if (!fs.existsSync(iconsDest)) {
    fs.mkdirSync(iconsDest, { recursive: true });
  }
  
  fs.readdirSync(iconsSrc).forEach(file => {
    fs.copyFileSync(path.join(iconsSrc, file), path.join(iconsDest, file));
    console.log(`Copied icons/${file}`);
  });
} else {
  // Create placeholder icons if they don't exist
  console.log('No icons folder found. Creating placeholder icons...');
  if (!fs.existsSync(iconsDest)) {
    fs.mkdirSync(iconsDest, { recursive: true });
  }
  
  // Create minimal 1x1 PNG placeholder (valid PNG header + minimal data)
  // This is a purple 1x1 pixel PNG
  const pngBuffer = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, // width: 1
    0x00, 0x00, 0x00, 0x01, // height: 1
    0x08, 0x02, // bit depth: 8, color type: RGB
    0x00, 0x00, 0x00, // compression, filter, interlace
    0x90, 0x77, 0x53, 0xDE, // CRC
    0x00, 0x00, 0x00, 0x0C, // IDAT length
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x08, 0xD7, 0x63, 0x68, 0x68, 0xF8, 0x0F, 0x00, 0x01, 0x04, 0x01, 0x00, // compressed data
    0x82, 0x4F, 0x23, 0x7F, // CRC
    0x00, 0x00, 0x00, 0x00, // IEND length
    0x49, 0x45, 0x4E, 0x44, // IEND
    0xAE, 0x42, 0x60, 0x82  // CRC
  ]);
  
  [16, 32, 48, 128].forEach(size => {
    const iconPath = path.join(iconsDest, `icon${size}.png`);
    fs.writeFileSync(iconPath, pngBuffer);
    console.log(`Created placeholder icon${size}.png`);
  });
  
  console.log('\\nNote: Replace placeholder icons with proper branded icons for production.');
}

console.log('\\nAssets copied successfully!');

