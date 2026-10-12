# GestureSlide architecture

Phases 0 through 4 are implemented. Later phases stay planned until their code exists and [test-log.md](test-log.md) records a run. The test log is the only record of what was executed.

## Implemented now

The browser loads `index.html`, which mounts `src/main.jsx`. That file renders `src/App.jsx`. The app is a single workspace: a slim header, `src/components/PdfStage.jsx`, and `src/components/CameraStage.jsx`. On a wide screen the PDF and camera sit side by side inside the viewport. Below 860 pixels of width, the camera panel stacks under the PDF and the page may scroll. The Open PDF buttons click the same file input that `PdfStage` owns.

`PdfStage` owns the file input, the page number, the canvas, the keyboard listener, and presentation mode. `src/cv/pdfController.js` talks to PDF.js. `src/cv/pdfFiles.js` checks the file type and turns PDF.js errors into short messages. `CameraStage` starts and stops the webcam and runs gesture recognition. `src/cv/gestureRecognizer.js` creates the MediaPipe recognizer, reads the category name, and draws landmarks. `src/cv/gestureCommands.js` decides whether that name may turn a page. `PdfStage` is the only component that changes the page number.

Vite compiles JSX with `@vitejs/plugin-react`. There is no client-side router.

### PDF path (implemented)

1. The user picks a local file. `File.arrayBuffer()` reads it in the browser. The bytes are copied into a `Uint8Array` and passed to PDF.js `getDocument()`. PDF.js may transfer that array to its worker. The bytes are not uploaded.
2. `GlobalWorkerOptions.workerSrc` points at `pdfjs/pdf.worker.min.mjs` under the site root. That file is a copy of `pdfjs-dist/build/pdf.worker.min.mjs` from version 6.4.299. No CDN worker is used. The dev server is not asked to bundle the worker, because bundling injected Vite’s client code into it.
3. `getDocument()` also receives local URLs for character maps, standard fonts, ICC profiles, and WebAssembly files under `public/pdfjs/`. `scripts/copy-pdfjs-assets.mjs` copies those folders, and the worker, out of the same installed package. Range requests and streaming are disabled because the whole file is already in memory.
4. PDF.js page numbers are 1-based. `getPage(pageNumber)` plus `render({ canvas, viewport })` paints one page. One scale fits the page inside the frame’s width and height, so the aspect ratio stays intact. The canvas backing store is at most twice the screen density.
5. React stores the page index. Previous and Next stop at page 1 and the last page, and those buttons are disabled there.
6. A generation counter ignores a load that finishes after a newer file was chosen or after the component unmounts. The previous `PDFDocumentLoadingTask.destroy()` runs before the new document is kept. An in-flight `render()` is cancelled. A cancelled render is not shown as an error.
7. Arrow keys and Page Up / Page Down call the same page changes when a document is open and the event target is not an input, textarea, select, or editable element. `preventDefault()` runs only in that case.
8. Presentation mode calls `requestFullscreen()` on the PDF viewer element. The toolbar is inside that element. The camera panel is outside it. Escape is left to the browser. A missing or rejected Fullscreen API shows a message and leaves the buttons usable.

PDF.js does not play animations stored inside a PDF. One PDF page is one slide. The render has no text-selection layer.

### Camera path (implemented)

1. Start camera calls `navigator.mediaDevices.getUserMedia()` with `audio: false` and a video constraint that prefers the user-facing camera. The call happens only after the click.
2. The stream is assigned to a `<video>` element. The element is muted, uses `playsInline`, and is flipped with CSS. The flip does not change the frames.
3. Stop camera, unmount, a newer request, or a failed start calls `stop()` on every track and clears `srcObject`.
4. A start that is already running, or a preview that is already live, does not open a second stream.
5. Permission denial, a missing device, a busy camera, a rejected constraint, and a page that is not localhost or HTTPS each get a short message.
6. The component does not use `MediaRecorder`, a canvas grab of the video for upload, or a network upload of frames.

A real webcam was not opened during the Phase 2 checks. See the test log. Phase 3 also did not open a camera.

### Gesture path (implemented)

1. After `video.play()` succeeds, one `GestureRecognizer` is created. A start that is already loading waits for that creation. It does not create a second recognizer.
2. `FilesetResolver.forVisionTasks()` is called with the site path `mediapipe` and without the module flag. In package 1.1.0 that loads `vision_wasm_internal.js` when WebAssembly SIMD works, and `vision_wasm_nosimd_internal.js` otherwise. `scripts/copy-mediapipe-assets.mjs` copies those files, plus the module pair, from the installed package exports. The names are unchanged.
3. `createFromOptions()` uses `runningMode: "VIDEO"`, `numHands: 1`, and `baseOptions.delegate: "CPU"`. The model path is `models/gesture_recognizer.task` under the site root.
4. One `requestAnimationFrame` loop calls `recognizeForVideo(video, timestamp)`. The installed signature takes the frame and a timestamp in milliseconds. The loop skips the call until about 66 ms have passed. The timestamp still increases on every call that does run.
5. The first hand’s top `categoryName` and `score` are shown. `None` is shown when that is the returned name. An empty landmark list is shown as “No hand detected.”
6. `DrawingUtils` draws `GestureRecognizer.HAND_CONNECTIONS` and the landmark points. The canvas bitmap is `videoWidth` by `videoHeight`. Normalized `x` and `y` are multiplied by that bitmap size inside `DrawingUtils`. The canvas CSS matches the video: `object-fit: cover` and `scaleX(-1)`. The mirror is display-only. MediaPipe still reads the unmirrored frame.
7. Stop camera and unmount cancel the animation frame and call `recognizer.close()`. A load that finishes after stop or unmount is closed and is not stored.
8. A model or wasm load error, or a thrown recognition call, leaves the camera preview up and shows a gesture error. PDF buttons and keys stay usable.
9. Each recognition sample is passed to `stepCommand()`. The sample carries `categoryName`, `score`, whether a hand is present, whether navigation is switched on, and `performance.now()`.
10. An accepted `next` or `previous` calls the PDF navigation ref. That ref uses `movePage()` and the same page state as the buttons and arrow keys. The camera never touches the PDF canvas.

The model file is the float16 Gesture Recognizer file from `storage.googleapis.com/mediapipe-models`, the URL printed in the installed package README. Its check is in the test log. A live label, a live landmark overlay, and a live page turn were not seen.

### Command rules (implemented)

`stepCommand()` returns a new state. It does not mutate the previous one.

1. If navigation is switched off, or the caller marks the sample disabled, the status is `paused`, the arm is cleared, and the cooldown clock is cleared. The last action name is kept for the panel. Stopping the camera uses this path, so a thumb that was in view cannot fire on the next start.
2. `Open_Palm`, or no hand, sets the arm. The score of `Open_Palm` is not checked. `None` and the other non-thumb names do not set the arm.
3. `Thumb_Up` maps to next and `Thumb_Down` maps to previous. The action is accepted only when the score is at least 0.70, the arm is set, and at least 900 ms have passed since the last accepted action.
4. A thumb at or above 0.70 that is not accepted clears the arm. The hand must be neutral again. A score below 0.70 does not turn a page and does not clear the arm.
5. After an accept, the status is `waiting` until both the arm and the cooldown are satisfied. Then the status is `active`.
6. `movePage()` clamps the page to `1..pageCount`. A command on the first or last page reports `at-start` or `at-end` and leaves the number where it is.

The panel shows Gesture control active, Waiting for neutral, or Gesture control paused. Those words follow the same three states. Pause Gesture Control calls the paused path and leaves recognition running. The page frame gets an outline only when a gesture actually changes the page.

`node scripts/test-gesture-commands.mjs` checks these rules. It does not start the camera.

## Target pipeline

Step 6 below is not built.

1. PDF upload and drawing. Implemented in Phase 1.
2. Camera preview. Implemented in Phase 2.
3. One `requestAnimationFrame` loop reads the `<video>` element. Implemented in Phase 3.
4. MediaPipe `GestureRecognizer.recognizeForVideo()` runs in `VIDEO` mode on the original camera frame. Implemented in Phase 3. The result has, for the one requested hand, handedness, gesture categories, image landmarks, and world landmarks. Image `x` and `y` are normalized to 0–1. This task’s hand landmarks are the 21 points of the hand. The overlay draws the points that come back and shows that count.
5. Project code accepts at most one navigation command, then React changes the same page index the buttons use. Implemented in Phase 4.
6. On a slower timer, OpenCV.js will build a debug mask from a copy of the frame. Every `cv.Mat` must be released with `mat.delete()`.

## Who does what

| Step | Owner | State |
| --- | --- | --- |
| Draw the PDF page | PDF.js (`pdfjs-dist` 6.4.299) | Implemented. Canvas only. |
| Decide the page number from buttons, keys, and accepted gestures | React, in `PdfStage`, using `movePage()` | Implemented. |
| Show the webcam | Browser `getUserMedia`, in `CameraStage` | Implemented. |
| Find the hand and name the gesture | MediaPipe Tasks Vision 1.1.0, `GestureRecognizer` | Implemented. The task resizes, rotates, and normalizes its own input. |
| Ignore a held gesture | `src/cv/gestureCommands.js` | Implemented. Score at least 0.70, neutral gate, and a 900 ms cooldown. |
| Skin-color mask and contour | OpenCV.js | Planned. Debug view only. |

The canned categories in the installed type declarations are `None`, `Closed_Fist`, `Open_Palm`, `Pointing_Up`, `Thumb_Down`, `Thumb_Up`, `Victory`, and `ILoveYou`. The downloaded model file contains those names as plain text. `Unknown` was not found as a plain string in that file. The screen prints the `categoryName` from the result. Only `Thumb_Up` and `Thumb_Down` can change the page, and only through the rules above.

There is no built-in swipe. A swipe would be a separate rule on the wrist landmark over time. It is outside version 1.

Gesture controls in this phase:

| Input | Result |
| --- | --- |
| Thumb up, score at least 0.70, armed, cooldown finished | Next page |
| Thumb down, score at least 0.70, armed, cooldown finished | Previous page |
| Open palm, or no hand | Neutral. Arms the next command. |
| Closed fist, pointing up, victory, ILoveYou, None | Shown on screen only |
| On-screen buttons and arrow keys | Change the page without the gesture gate |
| Pause gesture navigation | Camera stays on. Gestures do not change the page. |

The front camera image is mirrored. Paging uses the gesture name, so the mirror does not change which way the page moves.

## Packages and assets

Installed:

- `pdfjs-dist` 6.4.299, pinned exactly so the worker and the copied asset folders stay on one version.
- `@mediapipe/tasks-vision` 1.1.0, pinned exactly so the JavaScript task code and the copied wasm files stay on one version.

Downloaded from the official MediaPipe model bucket, and checked against that response:

- `public/models/gesture_recognizer.task`

Still planned. Not installed and not downloaded:

- `public/opencv/opencv.js`, the official OpenCV 4.13.0 browser build

## Privacy

The PDF is read with the File API and parsed in the browser. Project code does not upload it. The worker, fonts, character maps, PDF.js WebAssembly files, the gesture model, and the MediaPipe WebAssembly files are application files served by Vite. Loading them is not an upload of the PDF or of the camera. Camera frames stay in the `<video>` element. The recognizer reads that element in the page. Project code does not record the video or send the frames.

## Folder map

```text
GestureSlide/
  index.html
  package.json
  package-lock.json
  vite.config.js
  README.md
  scripts/copy-pdfjs-assets.mjs
  scripts/copy-mediapipe-assets.mjs
  scripts/test-gesture-commands.mjs
  docs/architecture.md
  docs/test-log.md
  src/main.jsx
  src/App.jsx
  src/styles.css
  src/components/PdfStage.jsx
  src/components/CameraStage.jsx
  src/cv/pdfController.js
  src/cv/pdfFiles.js
  src/cv/gestureRecognizer.js
  src/cv/gestureCommands.js
  public/pdfjs/          generated by the PDF.js copy script
  public/mediapipe/      generated by the MediaPipe copy script
  public/models/gesture_recognizer.task
```

`public/pdfjs` and `public/mediapipe` are generated. Both are listed in `.gitignore`. `npm.cmd install` recreates them. The gesture model is downloaded once and kept in `public/models`.

Planned files that were not created:

```text
src/components/StatusBar.jsx
src/cv/opencvPipeline.js
public/opencv/opencv.js
```

## Later phases

| Phase | Work | State |
| --- | --- | --- |
| 0 | React + Vite shell | Implemented. Results are in the test log. |
| 1 | PDF upload, one page on a canvas, next, previous, end stops, arrow keys, presentation mode | Implemented. Automated checks are in the test log. A real PDF was not opened in a browser. |
| 2 | Start and stop the camera preview | Implemented. Build and dev-server checks are in the test log. A real webcam was not opened. |
| 3 | Load the recognizer, show the label and score, draw the hand landmarks | Implemented. Build and asset checks are in the test log. A live hand was not watched. |
| 4 | Connect thumb up and thumb down to the page index | Implemented. Node checks are in the test log. A live page turn was not watched. |
| 5 | OpenCV.js debug mask on its own canvas | Planned |
| 6 | Submission notes and manual Vercel steps | Planned |

Skin-color thresholding fails for some skin tones and some lighting. That limit will be written up when the OpenCV view exists. The MediaPipe label is the control signal. The OpenCV mask, when it exists, will stay a debug view.
