import { useEffect, useRef, useState } from 'react'
import { createCommandState, stepCommand } from '../cv/gestureCommands.js'
import {
  createGestureRecognizer,
  gestureLoadErrorMessage,
  gestureRuntimeErrorMessage,
  paintHand,
  readGesture,
} from '../cv/gestureRecognizer.js'

// Shows the webcam in this page. Frames are not recorded or sent anywhere.
// Accepted thumb gestures call the PDF viewer's navigation ref. This file does not draw the PDF.

// Most animation frames are skipped. About 15 recognitions per second.
const RECOGNITION_GAP_MS = 66

const GESTURE_OFF = { status: 'off', name: '', score: null, count: 0 }

function describeApplied(action, applied) {
  const direction = action === 'next' ? 'Next slide' : 'Previous slide'
  if (!applied || applied.reason === 'no-document') {
    return 'No PDF loaded'
  }
  if (applied.reason === 'at-end') {
    return 'Last slide'
  }
  if (applied.reason === 'at-start') {
    return 'First slide'
  }
  if (applied.changed) {
    return direction
  }
  return direction
}

function stopTracks(stream) {
  if (!stream) {
    return
  }

  for (const track of stream.getTracks()) {
    track.stop()
  }
}

function closeRecognizer(recognizer) {
  if (!recognizer) {
    return
  }

  try {
    recognizer.close()
  } catch {
    // Already closed, or the runtime was torn down with the page.
  }
}

function cameraErrorMessage(error) {
  const name = error?.name

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'The browser blocked the camera. Allow camera access for this site, then press Start camera again.'
  }

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera was found on this computer.'
  }

  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'The camera is busy or could not be opened. Close other programs that are using it, then try again.'
  }

  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return 'This camera cannot use the requested video settings.'
  }

  if (name === 'SecurityError' || name === 'NotSupportedError') {
    return 'Camera access needs localhost or HTTPS. This page cannot open the camera.'
  }

  if (name === 'AbortError') {
    return 'The camera request was cancelled.'
  }

  return 'The camera could not be started.'
}

export default function CameraStage({ navigationRef }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const startingRef = useRef(false)
  const requestId = useRef(0)
  const aliveRef = useRef(true)
  const sessionRef = useRef(0)
  const recognizerRef = useRef(null)
  const loadingRef = useRef(null)
  const rafRef = useRef(0)
  const lastInferAtRef = useRef(0)
  const lastTimestampRef = useRef(0)
  const gestureKeyRef = useRef('')
  const onFrameRef = useRef(() => {})
  const controllerRef = useRef(createCommandState())
  const navEnabledRef = useRef(true)
  const commandNoteRef = useRef('None yet.')
  const bannerTimerRef = useRef(0)

  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [gestureView, setGestureView] = useState(GESTURE_OFF)
  const [gestureError, setGestureError] = useState('')
  const [navEnabled, setNavEnabled] = useState(true)
  const [commandStatus, setCommandStatus] = useState('paused')
  const [lastActionText, setLastActionText] = useState('None yet.')
  const [banner, setBanner] = useState('')

  function clearOverlay() {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const context = canvas.getContext('2d')
    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height)
    }
  }

  function pauseCommands() {
    const decision = stepCommand(controllerRef.current, {
      enabled: false,
      handPresent: false,
      categoryName: '',
      score: null,
      now: performance.now(),
    })
    controllerRef.current = decision.state
    if (aliveRef.current) {
      setCommandStatus('paused')
    }
  }

  function stopRecognition() {
    sessionRef.current += 1
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    const recognizer = recognizerRef.current
    recognizerRef.current = null
    closeRecognizer(recognizer)
    lastInferAtRef.current = 0
    lastTimestampRef.current = 0
    gestureKeyRef.current = ''
    pauseCommands()
    clearOverlay()
    window.clearTimeout(bannerTimerRef.current)
    if (aliveRef.current) {
      setGestureView(GESTURE_OFF)
      setGestureError('')
      setBanner('')
    }
  }

  function failRecognition() {
    sessionRef.current += 1
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    const recognizer = recognizerRef.current
    recognizerRef.current = null
    closeRecognizer(recognizer)
    pauseCommands()
    clearOverlay()
    if (aliveRef.current) {
      setGestureView({ status: 'error', name: '', score: null, count: 0 })
      setGestureError(gestureRuntimeErrorMessage())
    }
  }

  function recognizeFrame() {
    const video = videoRef.current
    const canvas = canvasRef.current
    const recognizer = recognizerRef.current
    if (!video || !canvas || !recognizer || video.paused) {
      return
    }
    if (video.readyState < 2 || video.videoWidth === 0) {
      return
    }

    const now = performance.now()
    if (now - lastInferAtRef.current < RECOGNITION_GAP_MS) {
      return
    }

    // recognizeForVideo requires a timestamp in milliseconds that increases.
    let timestamp = Math.round(now)
    if (timestamp <= lastTimestampRef.current) {
      timestamp = lastTimestampRef.current + 1
    }
    lastInferAtRef.current = now
    lastTimestampRef.current = timestamp

    let result
    try {
      result = recognizer.recognizeForVideo(video, timestamp)
    } catch {
      failRecognition()
      return
    }

    const reading = readGesture(result)
    paintHand(canvas, video, reading.landmarks)

    const handPresent = reading.status === 'gesture' || reading.status === 'no-category'
    const decision = stepCommand(controllerRef.current, {
      enabled: navEnabledRef.current,
      handPresent,
      categoryName: reading.name,
      score: reading.score,
      now,
    })
    controllerRef.current = decision.state

    if (decision.action) {
      const applied = navigationRef?.current?.apply(decision.action)
      const text = describeApplied(decision.action, applied)
      commandNoteRef.current = text
      setLastActionText(text)
      setBanner(text)
      window.clearTimeout(bannerTimerRef.current)
      bannerTimerRef.current = window.setTimeout(() => {
        if (aliveRef.current) {
          setBanner('')
        }
      }, 1200)
    }

    const scoreText = reading.score == null ? '' : reading.score.toFixed(3)
    const key = `${reading.status}|${reading.name}|${scoreText}|${reading.count}|${decision.status}|${commandNoteRef.current}`
    if (gestureKeyRef.current === key) {
      return
    }
    gestureKeyRef.current = key
    setCommandStatus(decision.status)
    setGestureView({
      status: reading.status,
      name: reading.name,
      score: reading.score,
      count: reading.count,
    })
  }

  onFrameRef.current = recognizeFrame

  function startLoop(token) {
    if (rafRef.current) {
      return
    }

    const step = () => {
      if (!aliveRef.current || token !== sessionRef.current || !recognizerRef.current) {
        rafRef.current = 0
        return
      }
      rafRef.current = requestAnimationFrame(step)
      onFrameRef.current()
    }

    rafRef.current = requestAnimationFrame(step)
  }

  async function loadRecognizer(token) {
    if (recognizerRef.current) {
      return recognizerRef.current
    }

    if (!loadingRef.current) {
      const pending = createGestureRecognizer()
        .then((recognizer) => {
          if (!aliveRef.current || token !== sessionRef.current) {
            closeRecognizer(recognizer)
            return null
          }
          recognizerRef.current = recognizer
          return recognizer
        })
        .finally(() => {
          if (loadingRef.current === pending) {
            loadingRef.current = null
          }
        })
      loadingRef.current = pending
    }

    const recognizer = await loadingRef.current
    if (!recognizer && aliveRef.current && token === sessionRef.current) {
      return loadRecognizer(token)
    }
    return recognizer
  }

  async function startRecognition(request) {
    const token = sessionRef.current
    if (aliveRef.current) {
      setGestureError('')
      setGestureView({ status: 'loading', name: '', score: null, count: 0 })
    }

    try {
      const recognizer = await loadRecognizer(token)
      if (!recognizer) {
        return
      }
      if (!aliveRef.current || token !== sessionRef.current || request !== requestId.current) {
        return
      }
      setGestureView({ status: 'ready', name: '', score: null, count: 0 })
      startLoop(token)
    } catch (loadError) {
      if (!aliveRef.current || token !== sessionRef.current || request !== requestId.current) {
        return
      }
      setGestureView({ status: 'error', name: '', score: null, count: 0 })
      setGestureError(gestureLoadErrorMessage(loadError))
    }
  }

  function releaseStream(stream) {
    if (streamRef.current === stream) {
      streamRef.current = null
    }

    const video = videoRef.current
    if (video && video.srcObject === stream) {
      video.pause()
      video.srcObject = null
    }

    stopTracks(stream)
  }

  function stopCamera() {
    requestId.current += 1
    startingRef.current = false
    stopRecognition()
    const stream = streamRef.current
    streamRef.current = null
    const video = videoRef.current
    if (video) {
      video.pause()
      video.srcObject = null
    }
    stopTracks(stream)
    if (aliveRef.current) {
      setStatus('idle')
      setError('')
    }
  }

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      requestId.current += 1
      startingRef.current = false
      stopRecognition()
      const stream = streamRef.current
      streamRef.current = null
      const video = videoRef.current
      if (video) {
        video.pause()
        video.srcObject = null
      }
      stopTracks(stream)
    }
  }, [])

  async function startCamera() {
    if (startingRef.current || streamRef.current) {
      return
    }

    const request = ++requestId.current
    startingRef.current = true
    setStatus('starting')
    setError('')

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        const unsupported = new Error('Camera API missing')
        unsupported.name = 'NotSupportedError'
        throw unsupported
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'user' } },
      })

      if (!aliveRef.current || request !== requestId.current) {
        stopTracks(stream)
        return
      }

      const previous = streamRef.current
      if (previous && previous !== stream) {
        releaseStream(previous)
      }

      streamRef.current = stream
      for (const track of stream.getTracks()) {
        track.addEventListener('ended', () => {
          if (streamRef.current !== stream) {
            return
          }
          stopCamera()
          if (aliveRef.current) {
            setError('The camera turned off.')
          }
        })
      }

      const video = videoRef.current
      if (!video) {
        releaseStream(stream)
        throw new Error('The camera preview is not on the page.')
      }

      video.muted = true
      video.playsInline = true
      video.srcObject = stream
      await video.play()

      if (!aliveRef.current || request !== requestId.current || streamRef.current !== stream) {
        releaseStream(stream)
        return
      }

      setStatus('live')
      void startRecognition(request)
    } catch (cameraError) {
      if (!aliveRef.current || request !== requestId.current) {
        return
      }
      const stream = streamRef.current
      streamRef.current = null
      const video = videoRef.current
      if (video) {
        video.pause()
        video.srcObject = null
      }
      stopTracks(stream)
      stopRecognition()
      setStatus('error')
      setError(cameraErrorMessage(cameraError))
    } finally {
      if (request === requestId.current) {
        startingRef.current = false
      }
    }
  }

  const isLive = status === 'live'
  const isStarting = status === 'starting'
  let previewText = 'Camera off'
  if (isStarting) {
    previewText = 'Starting camera'
  } else if (status === 'error') {
    previewText = 'Camera off'
  }

  let cameraLabel = 'Camera off'
  let cameraClass = 'chip chip-off'
  if (isStarting) {
    cameraLabel = 'Starting camera'
    cameraClass = 'chip chip-wait'
  } else if (isLive) {
    cameraLabel = 'Camera active'
    cameraClass = 'chip chip-live'
  }

  let gestureName = ''
  if (gestureView.status === 'loading') {
    gestureName = 'Loading recognizer'
  } else if (gestureView.status === 'error') {
    gestureName = 'Recognition stopped'
  } else if (gestureView.status === 'ready' || gestureView.status === 'no-hand') {
    gestureName = 'Waiting for hand'
  } else if (gestureView.status === 'no-category') {
    gestureName = 'Hand found'
  } else if (gestureView.status === 'gesture') {
    gestureName = gestureView.name
  }

  const showScore = gestureView.status === 'gesture' && gestureView.score != null
  const showCount = gestureView.status === 'gesture' || gestureView.status === 'no-category' || gestureView.status === 'no-hand'

  let navigationLabel = 'Gesture control paused'
  let navigationClass = 'chip chip-off'
  if (isLive && navEnabled) {
    if (commandStatus === 'active') {
      navigationLabel = 'Gesture control active'
      navigationClass = 'chip chip-live'
    } else {
      navigationLabel = 'Waiting for neutral'
      navigationClass = 'chip chip-wait'
    }
  }

  function toggleNavigation() {
    const next = !navEnabledRef.current
    navEnabledRef.current = next
    setNavEnabled(next)
    if (!next) {
      pauseCommands()
      return
    }
    if (streamRef.current) {
      setCommandStatus('waiting')
    }
  }

  const showGesture = gestureName !== ''
  const showLastAction = lastActionText !== 'None yet.'

  return (
    <section className="camera" aria-label="Gesture control">
      <div className="side-head">
        <h2>Gesture Control</h2>
        <div className="chips" aria-live="polite">
          <span className={cameraClass}>{cameraLabel}</span>
          <span className={navigationClass}>{navigationLabel}</span>
        </div>
      </div>
      <div className="camera-frame">
        <video
          ref={videoRef}
          className="camera-video"
          muted
          playsInline
          autoPlay
          aria-label="Live camera preview"
          aria-hidden={isLive ? undefined : true}
        />
        <canvas
          ref={canvasRef}
          className="camera-overlay"
          aria-hidden="true"
        />
        {!isLive && (
          <p className="camera-message">{previewText}</p>
        )}
      </div>
      <p className="meta">Mirrored preview. Recognition uses the original frame.</p>
      <div className="camera-actions">
        <button type="button" onClick={startCamera} disabled={isStarting || isLive}>
          Start Camera
        </button>
        <button type="button" onClick={stopCamera} disabled={!isStarting && !isLive}>
          Stop Camera
        </button>
      </div>
      {showGesture && (
        <p className="gesture-readout" aria-live="polite">
          <span>{gestureName}</span>
          {showScore && (
            <span className="gesture-score"> {gestureView.score.toFixed(3)}</span>
          )}
          {showCount && gestureView.count > 0 && (
            <span className="gesture-count"> {gestureView.count} pts</span>
          )}
        </p>
      )}
      {showLastAction && (
        <p className="last-action">Last: {lastActionText}</p>
      )}
      <button
        type="button"
        className="pause-button"
        onClick={toggleNavigation}
        aria-pressed={navEnabled}
      >
        {navEnabled ? 'Pause Gesture Control' : 'Resume Gesture Control'}
      </button>
      {banner && (
        <p className="turn-banner" role="status">{banner}</p>
      )}
      <ul className="legend">
        <li><span>Thumbs up</span> Next slide</li>
        <li><span>Thumbs down</span> Previous slide</li>
        <li><span>Open palm or no hand</span> Re-arms the next turn</li>
      </ul>
      <p className="keys">← → or Page Up / Page Down</p>
      <p className="privacy" id="privacy-note">Your PDF and camera feed stay on this device.</p>
      {error && (
        <p className="error" role="alert">{error}</p>
      )}
      {gestureError && (
        <p className="error" role="alert">{gestureError}</p>
      )}
    </section>
  )
}
