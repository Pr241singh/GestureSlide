// Focused checks for the gesture command rules. No test framework.
import assert from 'node:assert/strict'
import {
  COOLDOWN_MS,
  MIN_CONFIDENCE,
  createCommandState,
  movePage,
  stepCommand,
} from '../src/cv/gestureCommands.js'

let passed = 0

function check(name, fn) {
  fn()
  passed += 1
  console.log(`PASS ${name}`)
}

function sample(overrides) {
  return {
    enabled: true,
    handPresent: true,
    categoryName: '',
    score: null,
    now: 10_000,
    ...overrides,
  }
}

function arm(state, now = 10_000) {
  return stepCommand(state, sample({ categoryName: 'Open_Palm', score: 0.99, now })).state
}

check('constants are the viva values', () => {
  assert.equal(MIN_CONFIDENCE, 0.7)
  assert.equal(COOLDOWN_MS, 900)
})

check('a fresh controller ignores Thumb_Up until neutral', () => {
  const state = Object.freeze(createCommandState())
  const decision = stepCommand(state, sample({ categoryName: 'Thumb_Up', score: 0.95 }))
  assert.equal(decision.action, null)
  assert.equal(decision.status, 'waiting')
  assert.equal(decision.state.armed, false)
  assert.equal(state.armed, false)
})

check('Open_Palm then Thumb_Up at 0.70 moves next once', () => {
  let state = arm(createCommandState(), 1000)
  const first = stepCommand(state, sample({ categoryName: 'Thumb_Up', score: 0.7, now: 1000 }))
  assert.equal(first.action, 'next')
  assert.equal(first.status, 'waiting')
  assert.equal(first.state.lastAction, 'next')

  const held = stepCommand(first.state, sample({ categoryName: 'Thumb_Up', score: 0.99, now: 1000 + COOLDOWN_MS }))
  assert.equal(held.action, null)
  assert.equal(held.state.armed, false)
})

check('a held Thumb_Up cannot fire again after the cooldown', () => {
  let state = arm(createCommandState())
  state = stepCommand(state, sample({ categoryName: 'Thumb_Up', score: 0.91, now: 2000 })).state
  const later = stepCommand(state, sample({ categoryName: 'Thumb_Up', score: 0.91, now: 2000 + COOLDOWN_MS + 50 }))
  assert.equal(later.action, null)
  assert.equal(later.status, 'waiting')
})

check('Open_Palm re-arms, then Thumb_Down moves previous once', () => {
  let state = arm(createCommandState(), 1000)
  state = stepCommand(state, sample({ categoryName: 'Thumb_Up', score: 0.9, now: 1000 })).state
  const neutral = stepCommand(state, sample({ categoryName: 'Open_Palm', score: 0.4, now: 1000 + COOLDOWN_MS }))
  assert.equal(neutral.action, null)
  assert.equal(neutral.status, 'active')

  const down = stepCommand(neutral.state, sample({
    categoryName: 'Thumb_Down',
    score: 0.92,
    now: 1000 + COOLDOWN_MS,
  }))
  assert.equal(down.action, 'previous')
  const repeat = stepCommand(down.state, sample({
    categoryName: 'Thumb_Down',
    score: 0.92,
    now: 1000 + COOLDOWN_MS + 20,
  }))
  assert.equal(repeat.action, null)
})

check('no hand re-arms the next command', () => {
  let state = arm(createCommandState(), 500)
  state = stepCommand(state, sample({ categoryName: 'Thumb_Down', score: 0.88, now: 500 })).state
  const gone = stepCommand(state, sample({
    handPresent: false,
    categoryName: '',
    score: null,
    now: 500 + COOLDOWN_MS,
  }))
  assert.equal(gone.status, 'active')
  const next = stepCommand(gone.state, sample({ categoryName: 'Thumb_Up', score: 0.8, now: 500 + COOLDOWN_MS }))
  assert.equal(next.action, 'next')
})

check('confidence below 0.70 does not turn a page or drop the arm', () => {
  const armed = arm(createCommandState())
  const low = stepCommand(armed, sample({ categoryName: 'Thumb_Up', score: 0.699 }))
  assert.equal(low.action, null)
  assert.equal(low.state.armed, true)
  assert.equal(low.status, 'active')
})

check('other labels do not navigate or re-arm', () => {
  const names = ['Closed_Fist', 'Pointing_Up', 'Victory', 'ILoveYou', 'None']
  for (const categoryName of names) {
    const armed = arm(createCommandState())
    const shown = stepCommand(armed, sample({ categoryName, score: 0.99 }))
    assert.equal(shown.action, null, categoryName)
    assert.equal(shown.state.armed, true, categoryName)

    let used = stepCommand(armed, sample({ categoryName: 'Thumb_Up', score: 0.9, now: 3000 })).state
    const other = stepCommand(used, sample({ categoryName, score: 0.99, now: 3000 + COOLDOWN_MS }))
    assert.equal(other.action, null, categoryName)
    assert.equal(other.state.armed, false, categoryName)
  }
})

check('cooldown blocks a new command until 900 ms, even after neutral', () => {
  let state = arm(createCommandState(), 1000)
  state = stepCommand(state, sample({ categoryName: 'Thumb_Up', score: 0.9, now: 1000 })).state
  state = stepCommand(state, sample({ handPresent: false, now: 1000 + 100 })).state
  const early = stepCommand(state, sample({ categoryName: 'Thumb_Down', score: 0.95, now: 1000 + COOLDOWN_MS - 1 }))
  assert.equal(early.action, null)
  assert.equal(early.state.armed, false)

  const rearmed = stepCommand(early.state, sample({
    handPresent: false,
    now: 1000 + COOLDOWN_MS,
  }))
  assert.equal(rearmed.status, 'active')
  const accepted = stepCommand(rearmed.state, sample({
    categoryName: 'Thumb_Down',
    score: 0.95,
    now: 1000 + COOLDOWN_MS,
  }))
  assert.equal(accepted.action, 'previous')
})

check('pausing clears a pending arm and does not keep a stale command', () => {
  const armed = arm(createCommandState(), 4000)
  const paused = stepCommand(armed, sample({ enabled: false, categoryName: 'Thumb_Up', score: 0.99, now: 4500 }))
  assert.equal(paused.action, null)
  assert.equal(paused.status, 'paused')
  assert.equal(paused.state.armed, false)
  assert.equal(paused.state.lastAcceptedAt, null)

  const resumed = stepCommand(paused.state, sample({ categoryName: 'Thumb_Up', score: 0.99, now: 4600 }))
  assert.equal(resumed.action, null)

  const ready = stepCommand(resumed.state, sample({ handPresent: false, now: 4700 }))
  const fired = stepCommand(ready.state, sample({ categoryName: 'Thumb_Up', score: 0.93, now: 4700 }))
  assert.equal(fired.action, 'next')
})

check('pause keeps the last accepted action name', () => {
  let state = arm(createCommandState(), 100)
  state = stepCommand(state, sample({ categoryName: 'Thumb_Down', score: 0.8, now: 100 })).state
  const paused = stepCommand(state, sample({ enabled: false, now: 200 }))
  assert.equal(paused.state.lastAction, 'previous')
  assert.equal(paused.action, null)
})

check('page moves stay inside 1..pageCount', () => {
  assert.deepEqual(movePage(1, 4, 'previous'), {
    pageNumber: 1,
    pageCount: 4,
    changed: false,
    reason: 'at-start',
  })
  assert.deepEqual(movePage(4, 4, 'next'), {
    pageNumber: 4,
    pageCount: 4,
    changed: false,
    reason: 'at-end',
  })
  assert.deepEqual(movePage(2, 4, 'next'), {
    pageNumber: 3,
    pageCount: 4,
    changed: true,
    reason: 'next',
  })
  assert.deepEqual(movePage(2, 4, 'previous'), {
    pageNumber: 1,
    pageCount: 4,
    changed: true,
    reason: 'previous',
  })
  assert.equal(movePage(1, 0, 'next').reason, 'no-document')
  assert.equal(movePage(1, 0, 'next').changed, false)
  assert.equal(movePage(8, 3, 'previous').pageNumber, 2)
})

console.log(`OK ${passed} checks`)
