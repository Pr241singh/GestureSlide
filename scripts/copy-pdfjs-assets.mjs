// Copies the PDF.js files that must sit next to the app:
// character maps, standard fonts, color profiles, and WebAssembly decoders.
// The worker itself is bundled by Vite from the same installed package.
import { cp, mkdir, rm, copyFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageJsonPath = require.resolve('pdfjs-dist/package.json', { paths: [projectRoot] })
const sourceRoot = path.dirname(packageJsonPath)
const destRoot = path.join(projectRoot, 'public', 'pdfjs')
const folders = ['cmaps', 'standard_fonts', 'wasm', 'iccs']

await rm(destRoot, { recursive: true, force: true })
await mkdir(destRoot, { recursive: true })

for (const folder of folders) {
  await cp(path.join(sourceRoot, folder), path.join(destRoot, folder), { recursive: true })
}

// Vite rewrites module imports during `npm run dev`. The worker must stay
// byte-for-byte identical to the installed package, so it is copied here
// and loaded as a static file instead.
await copyFile(
  path.join(sourceRoot, 'build', 'pdf.worker.min.mjs'),
  path.join(destRoot, 'pdf.worker.min.mjs'),
)

console.log(`Copied ${folders.join(', ')} and pdf.worker.min.mjs from pdfjs-dist into public/pdfjs`)
