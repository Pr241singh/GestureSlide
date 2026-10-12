// MediaPipe names the hand shape and returns landmarks for one hand.
// Nothing in this file changes the PDF page. Frames are not uploaded.

const WASM_BASE = `${import.meta.env.BASE_URL}mediapipe`
const MODEL_PATH = `${import.meta.env.BASE_URL}models/gesture_recognizer.task`

// Filled by the dynamic import below. The PDF page does not need this library
// until the camera is started.
let visionApi = null

export async function createGestureRecognizer() {
  visionApi = await import('@mediapipe/tasks-vision')
  const { FilesetResolver, GestureRecognizer } = visionApi

  // useModule stays false. This package then loads vision_wasm_internal.js,
  // or vision_wasm_nosimd_internal.js when SIMD is missing, as a classic script.
  // Those files are the copies from the installed package. They are not renamed.
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE)
  return GestureRecognizer.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: MODEL_PATH,
      delegate: 'CPU',
    },
    runningMode: 'VIDEO',
    numHands: 1,
  })
}

function errorDetail(error) {
  if (!error) {
    return ''
  }
  if (typeof Event !== 'undefined' && error instanceof Event) {
    return 'A MediaPipe script failed to load.'
  }
  if (typeof error.message === 'string' && error.message) {
    return error.message
  }
  return String(error)
}

export function gestureLoadErrorMessage(error) {
  const detail = errorDetail(error)
  const missingFile = /wasm|fetch|404|not found|network|model|task|script|file/i.test(detail)
  if (missingFile || detail === 'A MediaPipe script failed to load.') {
    return 'The gesture model or the MediaPipe WebAssembly files could not be loaded. The camera preview can stay on, but no gesture name is available.'
  }
  return 'The gesture recognizer could not be started. The camera preview can stay on.'
}

export function gestureRuntimeErrorMessage() {
  return 'Gesture recognition stopped on this camera session. The preview is still on. Press Stop camera, then Start camera, to try again.'
}

// Reads the first hand only. numHands is 1, so later hands are ignored.
// categoryName is returned as MediaPipe spelled it, including "None".
export function readGesture(result) {
  const landmarks = result?.landmarks?.[0] ?? null
  const category = result?.gestures?.[0]?.[0] ?? null
  const count = landmarks?.length ?? 0

  if (!landmarks || count === 0) {
    return { status: 'no-hand', name: '', score: null, count: 0, landmarks: null }
  }

  if (!category || !category.categoryName) {
    return { status: 'no-category', name: '', score: null, count, landmarks }
  }

  const score = typeof category.score === 'number' ? category.score : null
  return {
    status: 'gesture',
    name: category.categoryName,
    score,
    count,
    landmarks,
  }
}

// Landmarks are 0–1 in the camera frame, not in the CSS box.
// The canvas bitmap is the video frame. The same object-fit and mirror as the
// video then crop and flip the drawing to match the preview.
export function paintHand(canvas, video, landmarks) {
  if (!canvas) {
    return
  }

  const width = video?.videoWidth ?? 0
  const height = video?.videoHeight ?? 0
  if (width > 0 && height > 0 && (canvas.width !== width || canvas.height !== height)) {
    canvas.width = width
    canvas.height = height
  }

  const context = canvas.getContext('2d')
  if (!context) {
    return
  }

  context.clearRect(0, 0, canvas.width, canvas.height)
  if (!landmarks || landmarks.length === 0 || !visionApi) {
    return
  }

  const { DrawingUtils, GestureRecognizer } = visionApi
  const drawing = new DrawingUtils(context)
  drawing.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, {
    color: '#f8fafc',
    lineWidth: 3,
  })
  drawing.drawLandmarks(landmarks, {
    color: '#ea580c',
    fillColor: '#ea580c',
    lineWidth: 1,
    radius: 4,
  })
}
