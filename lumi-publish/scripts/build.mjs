// 构建正式版产物到 dist/：单文件游戏，入口为 dist/index.html
import { rmSync, mkdirSync, cpSync, existsSync } from 'node:fs'

const SRC = 'src'
const DIST = 'dist'

if (!existsSync(`${SRC}/index.html`)) {
  console.error(`[build] 缺少 ${SRC}/index.html，无法构建`)
  process.exit(1)
}

rmSync(DIST, { recursive: true, force: true })
mkdirSync(DIST, { recursive: true })
cpSync(`${SRC}/index.html`, `${DIST}/index.html`)

if (existsSync(`${SRC}/assets`)) {
  cpSync(`${SRC}/assets`, `${DIST}/assets`, { recursive: true })
}

console.log('[build] 完成 -> dist/index.html')