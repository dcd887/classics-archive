// 工程自检：入口存在、无在线外链（平台要求资源全本地化）
import { existsSync, readFileSync } from 'node:fs'

let failed = false
const fail = (msg) => { failed = true; console.error(`[validate] 失败：${msg}`) }

if (!existsSync('src/index.html')) {
  fail('缺少 src/index.html')
} else {
  const html = readFileSync('src/index.html', 'utf8')
  const externals = []
  const re = /(?:src|href)\s*=\s*["'](https?:)?\/\//gi
  let m
  while ((m = re.exec(html))) externals.push(m[0])
  if (externals.length) fail(`发现在线外链：${externals.join(', ')}`)
  if (/lumimaker-game\.js/i.test(html)) fail('严禁在作品中引入 SDK 文件')
}

if (!existsSync('package.json')) fail('缺少 package.json')

if (!failed) console.log('[validate] 通过：入口正常、无在线外链')
process.exit(failed ? 1 : 0)