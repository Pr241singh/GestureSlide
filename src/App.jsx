import { useCallback, useRef, useState } from 'react'
import CameraStage from './components/CameraStage.jsx'
import PdfStage from './components/PdfStage.jsx'

// Phase 4 lets Thumb_Up and Thumb_Down change the PDF page.
// The camera does not draw the PDF, and the PDF viewer does not read the camera.
export default function App() {
  const navigationRef = useRef(null)
  const fileInputRef = useRef(null)
  const [pageInfo, setPageInfo] = useState({
    pageNumber: 1,
    pageCount: 0,
    ready: false,
    fileName: '',
  })

  const rememberPage = useCallback((info) => {
    setPageInfo((current) => {
      if (
        current.pageNumber === info.pageNumber
        && current.pageCount === info.pageCount
        && current.ready === info.ready
        && current.fileName === info.fileName
      ) {
        return current
      }
      return info
    })
  }, [])

  function openPdfPicker() {
    fileInputRef.current?.click()
  }

  const fileLabel = pageInfo.fileName || 'No PDF loaded'

  return (
    <div className="app">
      <a className="skip-link" href="#workspace">Skip to workspace</a>
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true" />
          <h1 className="brand-name">GestureSlide</h1>
          <p className="brand-descriptor">PDF presentation</p>
        </div>
        <p className="nav-file" title={pageInfo.fileName || undefined}>{fileLabel}</p>
        <button
          type="button"
          className="btn-primary"
          onClick={openPdfPicker}
          aria-describedby="privacy-note"
        >
          Open PDF
        </button>
      </header>
      <main className="shell">
        <div className="workspace" id="workspace" tabIndex={-1}>
          <PdfStage
            navigationRef={navigationRef}
            onPageInfo={rememberPage}
            fileInputRef={fileInputRef}
          />
          <CameraStage navigationRef={navigationRef} />
        </div>
      </main>
    </div>
  )
}
