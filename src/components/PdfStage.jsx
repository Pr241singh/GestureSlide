import { useEffect, useRef, useState } from 'react'
import { movePage } from '../cv/gestureCommands.js'
import { isPdfFile, pdfErrorMessage } from '../cv/pdfFiles.js'
import { openPdf, releasePdf, renderPdfPage } from '../cv/pdfController.js'

function isTypingTarget(target) {
  if (!(target instanceof Element)) {
    return false
  }

  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true
  }

  return target.isContentEditable
}

export default function PdfStage({ navigationRef, onPageInfo, fileInputRef }) {
  const viewerRef = useRef(null)
  const frameRef = useRef(null)
  const canvasRef = useRef(null)
  const pdfRef = useRef(null)
  const loadingTaskRef = useRef(null)
  const renderTaskRef = useRef(null)
  const openGeneration = useRef(0)
  const pageCountRef = useRef(0)
  const pageNumberRef = useRef(1)
  const statusRef = useRef('empty')
  const goByRef = useRef(() => movePage(1, 0, 'next'))
  const flashTimerRef = useRef(0)

  const [status, setStatus] = useState('empty')
  const [fileName, setFileName] = useState('')
  const [pageNumber, setPageNumber] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [docVersion, setDocVersion] = useState(0)
  const [stageBox, setStageBox] = useState({ width: 0, height: 0 })
  const [fileError, setFileError] = useState('')
  const [renderError, setRenderError] = useState('')
  const [notice, setNotice] = useState('')
  const [isPresenting, setIsPresenting] = useState(false)
  const [pageFlash, setPageFlash] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragDepth = useRef(0)

  statusRef.current = status
  pageCountRef.current = pageCount
  pageNumberRef.current = pageNumber

  function goBy(action, fromGesture) {
    const count = pageCountRef.current
    const current = pageNumberRef.current
    if (statusRef.current !== 'ready' || count < 1) {
      return movePage(current, 0, action)
    }

    const moved = movePage(current, count, action)
    if (moved.changed) {
      pageNumberRef.current = moved.pageNumber
      setPageNumber(moved.pageNumber)
      if (fromGesture) {
        setPageFlash(true)
        window.clearTimeout(flashTimerRef.current)
        flashTimerRef.current = window.setTimeout(() => setPageFlash(false), 700)
      }
    }
    return moved
  }

  goByRef.current = goBy

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) {
      return undefined
    }

    const observer = new ResizeObserver((entries) => {
      const next = {
        width: Math.floor(entries[0].contentRect.width),
        height: Math.floor(entries[0].contentRect.height),
      }
      setStageBox((current) => (
        current.width === next.width && current.height === next.height ? current : next
      ))
    })
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    function onFullscreenChange() {
      const viewer = viewerRef.current
      setIsPresenting(Boolean(viewer) && document.fullscreenElement === viewer)
    }

    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  useEffect(() => {
    return () => {
      openGeneration.current += 1
      window.clearTimeout(flashTimerRef.current)
      renderTaskRef.current?.cancel()
      renderTaskRef.current = null
      const loadingTask = loadingTaskRef.current
      loadingTaskRef.current = null
      pdfRef.current = null
      releasePdf(loadingTask)
    }
  }, [])

  useEffect(() => {
    if (!navigationRef) {
      return undefined
    }

    navigationRef.current = {
      apply(action) {
        return goByRef.current(action, true)
      },
    }

    return () => {
      navigationRef.current = null
    }
  }, [navigationRef])

  useEffect(() => {
    if (!onPageInfo) {
      return
    }

    onPageInfo({
      pageNumber,
      pageCount,
      ready: status === 'ready' && pageCount > 0,
      fileName,
    })
  }, [onPageInfo, pageNumber, pageCount, status, fileName])

  useEffect(() => {
    const pdf = pdfRef.current
    const canvas = canvasRef.current
    if (status !== 'ready' || !pdf || !canvas || stageBox.width < 2 || stageBox.height < 2) {
      return undefined
    }

    let cancelled = false
    const pageToDraw = pageNumber

    async function draw() {
      let page = null
      try {
        page = await pdf.getPage(pageToDraw)
        if (cancelled || pdfRef.current !== pdf) {
          return
        }

        const renderTask = renderPdfPage(page, canvas, stageBox.width, stageBox.height)
        renderTaskRef.current = renderTask
        await renderTask.promise
        if (renderTaskRef.current === renderTask) {
          renderTaskRef.current = null
        }
        if (!cancelled && pdfRef.current === pdf) {
          setRenderError('')
        }
      } catch (error) {
        const stale = cancelled || pdfRef.current !== pdf
        if (stale || error?.name === 'RenderingCancelledException') {
          return
        }
        setRenderError('Could not draw this page.')
      } finally {
        try {
          page?.cleanup()
        } catch {
          // The document may already have been released.
        }
      }
    }

    draw()

    return () => {
      cancelled = true
      const renderTask = renderTaskRef.current
      renderTaskRef.current = null
      renderTask?.cancel()
    }
  }, [status, pageNumber, docVersion, stageBox])

  useEffect(() => {
    function onKeyDown(event) {
      if (statusRef.current !== 'ready' || pageCountRef.current < 1) {
        return
      }
      if (event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) {
        return
      }

      if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault()
        goByRef.current('next', false)
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault()
        goByRef.current('previous', false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  async function acceptFile(file) {
    if (!isPdfFile(file)) {
      setFileError('Please choose a PDF file.')
      return
    }

    const generation = ++openGeneration.current
    setStatus('loading')
    setFileError('')
    setRenderError('')
    setNotice('')
    setFileName(file.name)

    renderTaskRef.current?.cancel()
    renderTaskRef.current = null
    const previousTask = loadingTaskRef.current
    loadingTaskRef.current = null
    pdfRef.current = null
    setDocVersion((current) => current + 1)
    await releasePdf(previousTask)
    if (generation !== openGeneration.current) {
      return
    }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      if (generation !== openGeneration.current) {
        return
      }

      const loadingTask = openPdf(bytes)
      loadingTaskRef.current = loadingTask
      const pdf = await loadingTask.promise
      if (generation !== openGeneration.current) {
        await releasePdf(loadingTask)
        return
      }

      if (!Number.isInteger(pdf.numPages) || pdf.numPages < 1) {
        await releasePdf(loadingTask)
        loadingTaskRef.current = null
        throw new Error('This PDF has no pages.')
      }

      pdfRef.current = pdf
      setPageCount(pdf.numPages)
      setPageNumber(1)
      setStatus('ready')
      setDocVersion((current) => current + 1)
    } catch (error) {
      if (generation !== openGeneration.current) {
        return
      }
      pdfRef.current = null
      if (loadingTaskRef.current) {
        await releasePdf(loadingTaskRef.current)
        loadingTaskRef.current = null
      }
      setPageCount(0)
      setPageNumber(1)
      setStatus('error')
      setFileError(pdfErrorMessage(error))
    }
  }

  function onFileChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) {
      acceptFile(file)
    }
  }

  function onDragEnter(event) {
    event.preventDefault()
    dragDepth.current += 1
    setIsDragging(true)
  }

  function onDragLeave(event) {
    event.preventDefault()
    dragDepth.current -= 1
    if (dragDepth.current <= 0) {
      dragDepth.current = 0
      setIsDragging(false)
    }
  }

  function onDrop(event) {
    event.preventDefault()
    dragDepth.current = 0
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) {
      acceptFile(file)
    }
  }

  function openPicker() {
    fileInputRef?.current?.click()
  }

  function showPrevious() {
    goBy('previous', false)
  }

  function showNext() {
    goBy('next', false)
  }

  async function togglePresentation() {
    const viewer = viewerRef.current
    if (!viewer || typeof viewer.requestFullscreen !== 'function' || !document.fullscreenEnabled) {
      setNotice('This browser cannot enter presentation mode. Page buttons and arrow keys still work.')
      return
    }

    try {
      if (document.fullscreenElement === viewer) {
        await document.exitFullscreen()
      } else {
        await viewer.requestFullscreen()
      }
      setNotice('')
    } catch {
      setNotice('The browser refused to enter presentation mode. You can keep using the page buttons.')
    }
  }

  const hasDocument = status === 'ready' && pageCount > 0
  const atFirstPage = pageNumber <= 1
  const atLastPage = pageCount === 0 || pageNumber >= pageCount

  return (
    <section
      className={isDragging ? 'viewer is-dragover' : 'viewer'}
      ref={viewerRef}
      aria-label="PDF presentation"
      onDragEnter={onDragEnter}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <h2 className="sr-only">Presentation</h2>
      <input
        ref={fileInputRef}
        id="pdf-file"
        className="file-input"
        type="file"
        accept=".pdf,application/pdf"
        aria-label="Open PDF"
        tabIndex={-1}
        onChange={onFileChange}
      />

      <div className="toolbar">
        <p className="doc-name" title={fileName || undefined}>
          {fileName || 'No PDF loaded'}
        </p>
        <p className="counter" aria-live="polite">
          {hasDocument ? `${pageNumber} / ${pageCount}` : '—'}
        </p>
        <div className="toolbar-actions">
          <button type="button" onClick={showPrevious} disabled={!hasDocument || atFirstPage}>
            Previous
          </button>
          <button type="button" onClick={showNext} disabled={!hasDocument || atLastPage}>
            Next
          </button>
          <button
            type="button"
            onClick={togglePresentation}
            aria-pressed={isPresenting}
            disabled={!hasDocument && !isPresenting}
          >
            {isPresenting ? 'Exit' : 'Present'}
          </button>
        </div>
      </div>

      <div className={pageFlash ? 'page-frame page-flash' : 'page-frame'} ref={frameRef}>
        {status === 'loading' && <p className="stage-message">Opening PDF…</p>}
        {status === 'empty' && (
          <div className="empty-state">
            <span className="empty-mark" aria-hidden="true" />
            <h3>Ready when you are</h3>
            <p>Open a PDF to begin</p>
            <button type="button" className="btn-primary" onClick={openPicker}>
              Open PDF
            </button>
            <p className="drop-hint">Drop a PDF here</p>
          </div>
        )}
        {status === 'error' && (
          <p className="stage-message">This file could not be opened.</p>
        )}
        {status === 'ready' && (
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`Slide ${pageNumber} of ${pageCount}`}
          />
        )}
      </div>

      {fileError && (
        <p className="error" role="alert">{fileError}</p>
      )}
      {renderError && (
        <p className="error" role="alert">{renderError}</p>
      )}
      {notice && (
        <p className="notice" role="status">{notice}</p>
      )}
    </section>
  )
}
