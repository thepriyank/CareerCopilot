// Regenerates extension/icons/*.png from the same source the web app's own
// PWA icon uses (frontend/src/app/manifest.ts's icon-512.png — the JM mark,
// see frontend/public/icons/README.md for provenance/colors). Run this again
// if that source ever changes; there's nothing extension-specific to it.
import sharp from 'sharp'
import { mkdirSync } from 'fs'

const SRC = '../frontend/public/icons/icon-512.png'
mkdirSync('icons', { recursive: true })

for (const size of [16, 32, 48, 128]) {
  await sharp(SRC)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(`icons/icon-${size}.png`)
  console.log(`Created icons/icon-${size}.png (${size}x${size})`)
}
