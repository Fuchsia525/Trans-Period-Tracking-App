import sharp from 'sharp'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const root  = join(__dir, '..')
const svg         = readFileSync(join(root, 'public', 'icon.svg'))
const svgMaskable = readFileSync(join(root, 'public', 'icon-maskable.svg'))

for (const size of [192, 512]) {
  await sharp(svg).resize(size, size).png().toFile(join(root, 'public', `icon-${size}.png`))
  console.log(`icon-${size}.png`)
  await sharp(svgMaskable).resize(size, size).png().toFile(join(root, 'public', `icon-maskable-${size}.png`))
  console.log(`icon-maskable-${size}.png`)
}
