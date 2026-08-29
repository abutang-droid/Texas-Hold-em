/**
 * Generates Expo app icons from design tokens (run: node scripts/generate-icons.mjs).
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, '../assets');

const BG = '#0F4A2F';
const GOLD = '#C9A227';
const DARK = '#121418';

/** Simple spade-like mark as SVG. */
function iconSvg(size) {
  const pad = size * 0.14;
  const inner = size - pad * 2;
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${BG}"/>
      <stop offset="100%" stop-color="#1B5E3B"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.18}" fill="url(#g)"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${inner * 0.42}" fill="none" stroke="${GOLD}" stroke-width="${size * 0.018}" opacity="0.35"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
    font-family="Georgia, serif" font-size="${inner * 0.55}" font-weight="700" fill="${GOLD}">♠</text>
</svg>`;
}

async function writePng(name, size) {
  const svg = Buffer.from(iconSvg(size));
  await sharp(svg).png().toFile(join(assetsDir, name));
  console.log(`wrote ${name} (${size}px)`);
}

await mkdir(assetsDir, { recursive: true });
await writePng('icon.png', 1024);
await writePng('adaptive-icon.png', 1024);
await writePng('splash-icon.png', 512);
await writePng('favicon.png', 48);
