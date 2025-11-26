/**
 * Generate multi-size PNG icons from SVG
 * Run: node scripts/generate-icons.mjs
 */

import sharp from 'sharp'
import { mkdir, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

const SIZES = [16, 32, 48, 96, 128]

async function generateIcons() {
  const svgPath = join(rootDir, 'public/icon.svg')
  const outputDir = join(rootDir, 'public/icon')

  await mkdir(outputDir, { recursive: true })

  const svgBuffer = await readFile(svgPath)

  console.log('Generating icons from SVG...')

  for (const size of SIZES) {
    const outputPath = join(outputDir, `${size}.png`)
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath)
    console.log(`  Created ${size}x${size} icon`)
  }

  console.log('\nAll icons generated!')
}

generateIcons().catch(console.error)
