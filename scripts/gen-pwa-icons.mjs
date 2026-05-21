import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const iconDir = resolve(here, '..', 'src', 'assets', 'icon');
const source = resolve(iconDir, 'favicon.png');

const targets = [
  { name: 'icon-192.png', size: 192, background: { r: 255, g: 255, b: 255, alpha: 0 } },
  { name: 'icon-512.png', size: 512, background: { r: 255, g: 255, b: 255, alpha: 0 } },
  // Maskable icons need ~10% safe-zone padding. We pad with theme color so the icon
  // fills the device's adaptive shape without cropping the artwork.
  { name: 'icon-maskable-192.png', size: 192, background: { r: 255, g: 159, b: 28, alpha: 1 }, pad: true },
  { name: 'icon-maskable-512.png', size: 512, background: { r: 255, g: 159, b: 28, alpha: 1 }, pad: true },
];

for (const t of targets) {
  const inner = t.pad ? Math.round(t.size * 0.8) : t.size;
  const offset = Math.floor((t.size - inner) / 2);
  await sharp({
    create: {
      width: t.size,
      height: t.size,
      channels: 4,
      background: t.background,
    },
  })
    .composite([
      {
        input: await sharp(source)
          .resize(inner, inner, { kernel: 'lanczos3', fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .toBuffer(),
        top: offset,
        left: offset,
      },
    ])
    .png()
    .toFile(resolve(iconDir, t.name));
  console.log('wrote', t.name);
}
