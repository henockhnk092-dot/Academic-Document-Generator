// Script to generate Electron app icons
// For proper icons, you'll need to:
// 1. Use an online tool like https://icoconvert.com or https://cloudconvert.com
// 2. Convert the SVG to ICO (for Windows) and ICNS (for Mac)
// 3. Place icon.ico in the electron folder
// 4. Place icon.icns in the electron folder

import fs from 'fs';
import path from 'path';

const electronDir = path.join(process.cwd(), 'electron');

// Create a simple 256x256 SVG icon for Electron
const createIconSvg = () => {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="38" fill="url(#grad)"/>
  <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="90" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">A</text>
  <text x="50%" y="78%" font-family="Arial, sans-serif" font-size="30" fill="rgba(255,255,255,0.9)" text-anchor="middle">GEN</text>
</svg>`;
};

// Ensure electron directory exists
if (!fs.existsSync(electronDir)) {
  fs.mkdirSync(electronDir, { recursive: true });
}

// Generate SVG icon
const iconSvg = createIconSvg();
fs.writeFileSync(path.join(electronDir, 'icon.svg'), iconSvg);
console.log('Generated: electron/icon.svg');

console.log('\\nTo create proper app icons:');
console.log('1. Convert icon.svg to icon.ico for Windows using:');
console.log('   - https://icoconvert.com');
console.log('   - https://cloudconvert.com/svg-to-ico');
console.log('');
console.log('2. Convert icon.svg to icon.icns for Mac using:');
console.log('   - https://cloudconvert.com/svg-to-icns');
console.log('');
console.log('3. Place the converted files in the electron/ folder');
console.log('\\nFor now, electron-builder will use a default icon.');
