// PDF.js loads and draws the file. React only decides which page to show.
import {
  getDocument,
  GlobalWorkerOptions,
  version as pdfjsVersion,
} from 'pdfjs-dist'

// public/pdfjs is filled by scripts/copy-pdfjs-assets.mjs from this same package.
// The worker is a static copy of pdf.worker.min.mjs. A direct import would let
// the Vite dev server rewrite that file, so the worker would no longer match
// the installed PDF.js build.
const assetBase = `${import.meta.env.BASE_URL}pdfjs/`
GlobalWorkerOptions.workerSrc = `${assetBase}pdf.worker.min.mjs`

export { pdfjsVersion }

export function openPdf(data) {
  // `data` is a Uint8Array. PDF.js may transfer it to the worker, so the caller
  // must not use that array again. The bytes are not sent to a server.
  return getDocument({
    data,
    cMapUrl: `${assetBase}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${assetBase}standard_fonts/`,
    iccUrl: `${assetBase}iccs/`,
    wasmUrl: `${assetBase}wasm/`,
    disableRange: true,
    disableStream: true,
    disableAutoFetch: true,
  })
}

export async function releasePdf(loadingTask) {
  if (!loadingTask || loadingTask.destroyed) {
    return
  }

  try {
    await loadingTask.destroy()
  } catch {
    // The task can already be destroyed when a newer file replaces it.
  }
}

// Fits one page inside the frame. Width and height share one scale, so the
// page is not stretched. The canvas backing store can be sharper than the CSS
// size, up to twice the screen density.
export function renderPdfPage(page, canvas, cssWidth, cssHeight = 0) {
  const natural = page.getViewport({ scale: 1 })
  const safeWidth = Math.max(cssWidth, 1)
  let scale = safeWidth / natural.width
  if (cssHeight > 1 && natural.height > 0) {
    scale = Math.min(scale, cssHeight / natural.height)
  }
  const viewport = page.getViewport({ scale })
  const outputScale = Math.min(window.devicePixelRatio || 1, 2)

  canvas.width = Math.floor(viewport.width * outputScale)
  canvas.height = Math.floor(viewport.height * outputScale)
  canvas.style.width = `${Math.floor(viewport.width)}px`
  canvas.style.height = `${Math.floor(viewport.height)}px`

  const transform = outputScale === 1
    ? undefined
    : [outputScale, 0, 0, outputScale, 0, 0]

  return page.render({
    canvas,
    viewport,
    transform,
  })
}
