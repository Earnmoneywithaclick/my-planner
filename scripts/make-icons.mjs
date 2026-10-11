// public/icons/favicon.svg 하나로 iOS·PWA용 PNG 아이콘을 만든다.
import sharp from 'sharp'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const dir = new URL('../public/icons/', import.meta.url)
const svg = await readFile(new URL('favicon.svg', dir))

// iOS는 모서리를 자체적으로 둥글게 깎으므로 둥근 모서리 없는(꽉 찬) 버전을 쓴다
const square = Buffer.from(svg.toString().replace('rx="112"', 'rx="0"'))

const outputs = [
  { file: 'apple-touch-icon.png', size: 180, src: square },
  { file: 'icon-192.png', size: 192, src: svg },
  { file: 'icon-512.png', size: 512, src: svg },
  { file: 'icon-512-maskable.png', size: 512, src: square },
]

for (const { file, size, src } of outputs) {
  await sharp(src, { density: 300 }).resize(size, size).png().toFile(fileURLToPath(new URL(file, dir)))
  console.log('✓', file)
}
