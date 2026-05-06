/**
 * Edullent PWA icon generator.
 *
 * Resizes the source brand asset (public/edullent-icon.png) into every
 * PWA / favicon size the manifest + index.html reference. Also produces
 * 192/512 maskable variants with a brand-colour safe-zone for Android.
 *
 * Requires `sharp` (preferred) — falls back to a clear error message so
 * the contributor knows what to install. Reason for sharp: pure-Node
 * PNG resizing without proper resampling produces ugly aliased icons
 * at small sizes (the previous version of this script hand-drew a
 * graduation cap to avoid the dependency, which is no longer the brand).
 *
 * Usage: `node scripts/generate-icons.mjs`
 */
import { mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error(
    'sharp is not installed. Install it with `bun add -d sharp` (or `npm i -D sharp`) and retry.\n' +
    'Alternative: run scripts/generate-icons.py (Pillow) which produces identical output.'
  );
  process.exit(1);
}

const SRC = resolve('public/edullent-icon.png');
const OUT_DIR = resolve('public/icons');
const BRAND_BG = { r: 32, g: 56, b: 108, alpha: 1 }; // sampled from icon body

if (!existsSync(SRC)) {
  console.error(`Source not found: ${SRC}`);
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });

// Trim transparent padding then pad to a square so resize preserves aspect.
const trimmed = await sharp(SRC).trim().toBuffer();
const meta = await sharp(trimmed).metadata();
const side = Math.max(meta.width, meta.height);
const square = await sharp(trimmed)
  .extend({
    top: Math.floor((side - meta.height) / 2),
    bottom: Math.ceil((side - meta.height) / 2),
    left: Math.floor((side - meta.width) / 2),
    right: Math.ceil((side - meta.width) / 2),
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .toBuffer();

const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];
for (const s of sizes) {
  const name = s === 180 ? `${OUT_DIR}/apple-touch-icon.png` : `${OUT_DIR}/icon-${s}x${s}.png`;
  await sharp(square).resize(s, s, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(name);
  console.log(`OK ${s}x${s} -> ${name}`);
}

// 32x32 favicon
await sharp(square).resize(32, 32, { kernel: 'lanczos3' }).png().toFile('public/favicon-32x32.png');
console.log('OK 32x32 -> public/favicon-32x32.png');

// Maskable: brand bg fills full canvas, logo at 78% so the safe zone
// (inner 80% per spec) keeps the mark visible after Android's circle crop.
for (const s of [192, 512]) {
  const inner = Math.round(s * 0.78);
  const fg = await sharp(square).resize(inner, inner, { kernel: 'lanczos3' }).toBuffer();
  await sharp({
    create: { width: s, height: s, channels: 4, background: BRAND_BG },
  })
    .composite([{ input: fg, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(`${OUT_DIR}/icon-${s}x${s}-maskable.png`);
  console.log(`OK maskable ${s}x${s}`);
}

console.log('\nAll icons generated from public/edullent-icon.png');
