/**
 * PWA 图标生成脚本
 * 从 SVG 生成多尺寸 PNG 图标
 *
 * 使用方法: node scripts/generate-pwa-icons.mjs
 */

import sharp from 'sharp'
import { mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]
const outputDir = join(rootDir, 'public', 'icons')

// 确保输出目录存在
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true })
}

// AnyKeep logo SVG
const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366F1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8B5CF6;stop-opacity:1" />
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect x="32" y="32" width="448" height="448" rx="96" fill="url(#grad)"/>
  <!-- Bookmark icon -->
  <path d="M160 112h192c17.6 0 32 14.4 32 32v256c0 11.2-12.8 17.6-21.6 10.4L256 320l-106.4 90.4c-8.8 7.2-21.6 0.8-21.6-10.4V144c0-17.6 14.4-32 32-32z" fill="white"/>
</svg>
`

console.log('🎨 开始生成 PWA 图标...\n')

// 生成各尺寸图标
for (const size of sizes) {
  const outputPath = join(outputDir, `icon-${size}x${size}.png`)

  await sharp(Buffer.from(svgContent))
    .resize(size, size)
    .png()
    .toFile(outputPath)

  console.log(`✅ 生成 ${size}x${size} 图标`)
}

// 生成 Apple Touch Icon
await sharp(Buffer.from(svgContent))
  .resize(180, 180)
  .png()
  .toFile(join(rootDir, 'public', 'apple-touch-icon.png'))

console.log('✅ 生成 Apple Touch Icon (180x180)')

// 生成 Favicon
await sharp(Buffer.from(svgContent))
  .resize(32, 32)
  .png()
  .toFile(join(rootDir, 'public', 'favicon-32x32.png'))

await sharp(Buffer.from(svgContent))
  .resize(16, 16)
  .png()
  .toFile(join(rootDir, 'public', 'favicon-16x16.png'))

console.log('✅ 生成 Favicon (16x16, 32x32)')

// 生成快捷方式图标
const addIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <rect width="96" height="96" rx="16" fill="#6366F1"/>
  <path d="M48 24v48M24 48h48" stroke="white" stroke-width="6" stroke-linecap="round"/>
</svg>
`

const searchIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <rect width="96" height="96" rx="16" fill="#6366F1"/>
  <circle cx="42" cy="42" r="18" stroke="white" stroke-width="6" fill="none"/>
  <path d="M56 56l16 16" stroke="white" stroke-width="6" stroke-linecap="round"/>
</svg>
`

await sharp(Buffer.from(addIconSvg))
  .resize(96, 96)
  .png()
  .toFile(join(outputDir, 'shortcut-add.png'))

await sharp(Buffer.from(searchIconSvg))
  .resize(96, 96)
  .png()
  .toFile(join(outputDir, 'shortcut-search.png'))

console.log('✅ 生成快捷方式图标')

console.log('\n🎉 所有 PWA 图标生成完成！')
