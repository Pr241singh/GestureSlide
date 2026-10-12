// Decides when a MediaPipe label may turn a PDF page.
// This file does not open the camera or draw the page.
//
// Rules, in order:
// 1. Navigation must be switched on. Otherwise the status is paused and nothing is armed.
// 2. Open_Palm, or no hand, is neutral. Neutral arms the next command.
// 3. Thumb_Up or Thumb_Down turns a page only when the score is at least 0.70,
//    the controller is armed, and 900 ms have passed since the last accepted command.
// 4. A confident thumb that is not accepted (held pose, or still in the cooldown)
//    removes the arm. The hand must go neutral again. A held pose cannot repeat.
// 5. Any other label is shown by the caller and does not turn a page or change the arm.

export const MIN_CONFIDENCE = 0.7
export const COOLDOWN_MS = 900

export function createCommandState() {
  return {
    armed: false,
    lastAcceptedAt: null,
    lastAction: null,
  }
}

function copyState(state) {
  return {
    armed: state.armed,
    lastAcceptedAt: state.lastAcceptedAt,
    lastAction: state.lastAction,
  }
}

export function stepCommand(state, sample) {
  const next = copyState(state)

  if (!sample.enabled) {
    next.armed = false
    next.lastAcceptedAt = null
    return { state: next, action: null, status: 'paused' }
  }

  const categoryName = sample.categoryName || ''
  const neutral = !sample.handPresent || categoryName === 'Open_Palm'
  let command = null
  if (categoryName === 'Thumb_Up') {
    command = 'next'
  } else if (categoryName === 'Thumb_Down') {
    command = 'previous'
  }

  let action = null
  if (neutral) {
    next.armed = true
  } else if (command && typeof sample.score === 'number' && sample.score >= MIN_CONFIDENCE) {
    const cooled = next.lastAcceptedAt == null || sample.now - next.lastAcceptedAt >= COOLDOWN_MS
    if (next.armed && cooled) {
      action = command
      next.armed = false
      next.lastAcceptedAt = sample.now
      next.lastAction = command
    } else {
      next.armed = false
    }
  }

  const cooledNow = next.lastAcceptedAt == null || sample.now - next.lastAcceptedAt >= COOLDOWN_MS
  const status = next.armed && cooledNow ? 'active' : 'waiting'
  return { state: next, action, status }
}

// Keeps a page inside 1..pageCount. A command on the first or last page does not move.
export function movePage(pageNumber, pageCount, action) {
  const count = Number.isInteger(pageCount) && pageCount > 0 ? pageCount : 0
  const current = Number.isInteger(pageNumber) ? pageNumber : 1
  if (count < 1) {
    return { pageNumber: current, pageCount: 0, changed: false, reason: 'no-document' }
  }

  const bounded = Math.min(count, Math.max(1, current))
  if (action !== 'next' && action !== 'previous') {
    return { pageNumber: bounded, pageCount: count, changed: false, reason: 'none' }
  }

  const next = action === 'next' ? Math.min(count, bounded + 1) : Math.max(1, bounded - 1)
  if (next === bounded) {
    return {
      pageNumber: bounded,
      pageCount: count,
      changed: false,
      reason: action === 'next' ? 'at-end' : 'at-start',
    }
  }

  return { pageNumber: next, pageCount: count, changed: true, reason: action }
}
