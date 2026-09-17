// Bundles the three MV3 entry points with esbuild and assembles dist/ as a
// loadable unpacked extension. No @crxjs/vite-plugin / wxt (the plan doc's
// suggestion) — a service worker + two plain scripts don't need a bundler
// with opinions about manifest generation; esbuild + a manifest.json we
// already control by hand is simpler and has fewer moving parts to debug
// without a live browser reload loop.
import { build, context } from 'esbuild'
import { mkdirSync, copyFileSync, existsSync, readdirSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const distDir = path.join(root, 'dist')

const args = process.argv.slice(2)
const watch = args.includes('--watch')
const apiArg = args.find((a) => a.startsWith('--api='))
const webArg = args.find((a) => a.startsWith('--web='))

const define = {
  'globalThis.JOBMAGNATE_API_BASE_URL': JSON.stringify(apiArg ? apiArg.slice('--api='.length) : 'https://api.jobmagnate.com'),
  'globalThis.JOBMAGNATE_WEB_APP_URL': JSON.stringify(webArg ? webArg.slice('--web='.length) : 'https://jobmagnate.com'),
}

if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true })

const entryPoints = {
  background: path.join(root, 'src/background/index.ts'),
  content: path.join(root, 'src/content/index.ts'),
  popup: path.join(root, 'src/popup/popup.ts'),
}

function copyStaticFiles() {
  copyFileSync(path.join(root, 'manifest.json'), path.join(distDir, 'manifest.json'))
  copyFileSync(path.join(root, 'src/popup/popup.html'), path.join(distDir, 'popup.html'))

  const iconsSrc = path.join(root, 'icons')
  const iconsDist = path.join(distDir, 'icons')
  if (existsSync(iconsSrc)) {
    mkdirSync(iconsDist, { recursive: true })
    for (const file of readdirSync(iconsSrc)) {
      copyFileSync(path.join(iconsSrc, file), path.join(iconsDist, file))
    }
  }
}

const buildOptions = {
  entryPoints,
  outdir: distDir,
  bundle: true,
  format: 'iife',
  target: 'chrome110',
  define,
  logLevel: 'info',
}

if (watch) {
  const ctx = await context(buildOptions)
  await ctx.watch()
  copyStaticFiles()
  console.log(`Watching. Load ${distDir} as an unpacked extension (chrome://extensions → Load unpacked).`)
} else {
  await build(buildOptions)
  copyStaticFiles()
  console.log(`Built to ${distDir}`)
}
