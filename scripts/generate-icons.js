// Script to generate PWA icons
// Run with: node scripts/generate-icons.js

import fs from 'fs';
import path from 'path';

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(process.cwd(), 'client', 'public', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create a simple SVG icon that can be converted
const createSvgIcon = (size) => {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="url(#grad)"/>
  <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="${size * 0.35}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">A</text>
  <text x="50%" y="78%" font-family="Arial, sans-serif" font-size="${size * 0.12}" fill="rgba(255,255,255,0.9)" text-anchor="middle">GEN</text>
</svg>`;
};

// Generate SVG icons (browsers can use SVG directly, or you can convert to PNG with a tool)
sizes.forEach(size => {
  const svg = createSvgIcon(size);
  const filename = `icon-${size}x${size}.svg`;
  fs.writeFileSync(path.join(iconsDir, filename), svg);
  console.log(`Generated: ${filename}`);
});

// Also create a favicon SVG
const faviconSvg = createSvgIcon(32);
fs.writeFileSync(path.join(process.cwd(), 'client', 'public', 'favicon.svg'), faviconSvg);
console.log('Generated: favicon.svg');

console.log('\nSVG icons generated! For PNG icons, use a converter like:');
console.log('- https://cloudconvert.com/svg-to-png');
console.log('- Or use sharp/canvas libraries in Node.js');
console.log('\nFor now, the PWA plugin will work with the SVG icons in development.');
