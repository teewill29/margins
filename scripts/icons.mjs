// Renders scripts/icon.svg to the PNG sizes the manifest and iOS need.
// Run with `npm run icons` after changing the SVG. Output is committed to public/.
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const svg = await readFile(new URL('./icon.svg', import.meta.url));
const out = (name) => new URL(`../public/${name}`, import.meta.url);

const sizes = [
  ['pwa-192.png', 192],
  ['pwa-512.png', 512],
  ['pwa-maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
];

for (const [name, size] of sizes) {
  const png = await sharp(svg, { density: 300 }).resize(size, size).png().toBuffer();
  await writeFile(out(name), png);
  console.log(`public/${name} ${size}x${size}`);
}
await writeFile(out('favicon.svg'), svg);
console.log('public/favicon.svg');
