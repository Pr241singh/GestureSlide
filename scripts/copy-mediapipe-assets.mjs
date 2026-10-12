// Copies the MediaPipe WebAssembly files that match the installed
// @mediapipe/tasks-vision package. The names must stay the same.
// FilesetResolver loads them by those names from a directory on this site.
// A Vite import would rewrite the loader, so these stay static files.
import { copyFile, mkdir, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const destRoot = path.join(projectRoot, 'public', 'mediapipe')

// These export names are the files FilesetResolver requests. Copying them
// by the package export keeps the public copies on the installed version.
const files = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
  'vision_wasm_module_internal.js',
  'vision_wasm_module_internal.wasm',
]

await rm(destRoot, { recursive: true, force: true })
await mkdir(destRoot, { recursive: true })

for (const file of files) {
  const source = require.resolve(`@mediapipe/tasks-vision/${file}`, { paths: [projectRoot] })
  await copyFile(source, path.join(destRoot, file))
  console.log(`Copied ${file}`)
}

console.log('Copied MediaPipe wasm files into public/mediapipe')
