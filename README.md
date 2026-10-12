# GestureSlide

Computer vision based hands-free presentation controller.

A college mini-project. Phase 4 shows a local PDF, a live camera preview, the gesture name MediaPipe returns, and page turns from thumb up and thumb down. OpenCV.js is still planned.

## Current status

Implemented:

- React page titled GestureSlide.
- Vite development server and production build.
- PDF upload in the browser with PDF.js (`pdfjs-dist` 6.4.299).
- Canvas rendering of the current page, with previous and next buttons.
- Page counter and disabled buttons on the first and last page.
- Arrow keys and Page Up / Page Down.
- Presentation mode through the browser Fullscreen API, when the browser allows it.
- Start camera and Stop camera, with a live preview from `getUserMedia`.
- MediaPipe `GestureRecognizer` in video mode, one hand, CPU delegate.
- The gesture category name and score on screen, including `None` when that is the name MediaPipe returns.
- A canvas overlay that draws the detected hand's landmarks and the package's hand connections.
- Thumb up and thumb down change the PDF page when the score is at least 0.70, the controller is armed, and 900 ms have passed.
- Open palm, or no hand, re-arms the next turn. Other gesture names are shown and do not move the page.
- A button pauses and resumes gesture navigation. Buttons and arrow keys still move the page.
- The screen is a compact workspace in midnight navy, cyan, and periwinkle. Open PDF uses the existing file input. On a wide screen the header, slides, camera, and controls share one viewport.

Not implemented:

- The OpenCV.js debug view.
- Deployment.

Not downloaded:

- `opencv.js`

Commands that were actually run are in [docs/test-log.md](docs/test-log.md). A browser check of a real PDF is listed there as not run. The design notes are in [docs/architecture.md](docs/architecture.md).

## Library roles

| Piece | Library | Role | Status |
| --- | --- | --- | --- |
| Page shell and page index | React | Shows the viewer and stores the current page number. | In use for the PDF viewer. |
| Dev server and production build | Vite | Serves the app and writes `dist`. | Used. See the test log. |
| Read and draw the PDF | PDF.js (`pdfjs-dist` 6.4.299) | Opens the file and paints one page on a canvas. | Installed and wired. |
| Camera preview | Browser `getUserMedia` | Opens the webcam after a click and shows it in a `<video>` element. | Wired. This session did not open a camera. |
| Hand shape recognition | MediaPipe Tasks Vision 1.1.0, `GestureRecognizer` | Reads the camera frame and returns a gesture name, a score, and hand landmarks. | Installed and wired. A live hand was not checked in a browser. |
| Classical image processing | OpenCV.js | Will build a separate debug view. | Planned. Script not downloaded. |
| One page change per gesture | Project code, `src/cv/gestureCommands.js` | Applies a 0.70 score check, a 900 ms cooldown, and a neutral-gesture gate. | Wired. The rule checks passed in Node. A live hand was not checked. |

PDF.js draws the page. It does not see the webcam. MediaPipe receives the original camera frame. OpenCV.js will later receive a copy for a debug view. The skin mask will not choose the next page.

## How a PDF is handled

1. You choose a file with the file input, or drop one on the viewer.
2. The browser reads the bytes with `file.arrayBuffer()`. Those bytes stay in the page. The app does not send them to a server.
3. If the name and type do not look like a PDF, the viewer shows “Please choose a PDF file.” and keeps the document that is already open.
4. PDF.js `getDocument()` parses the bytes in a worker from this same `pdfjs-dist` install.
5. `getPage()` and `render()` paint the current page onto the canvas. Page numbers start at 1.
6. Choosing another PDF destroys the previous PDF.js loading task before the new file is opened.

`scripts/copy-pdfjs-assets.mjs` copies the worker, character maps, standard fonts, ICC profiles, and WebAssembly decoders from the installed `pdfjs-dist` package into `public/pdfjs`. The viewer loads `pdf.worker.min.mjs` from that folder. It is not a CDN worker. The copy stays byte-for-byte identical to the package file. A direct Vite import was not used, because the dev server rewrites imported modules.

## Keyboard and presentation mode

These keys work when a PDF is open and focus is not in a text field, file input, select, or editable element:

| Key | Action |
| --- | --- |
| Right arrow or Page Down | Next page |
| Left arrow or Page Up | Previous page |

The viewer calls `preventDefault()` only for those keys, and only when a document is open. At the first or last page the key still does not leave the viewer, and the page number does not move past the ends.

Presentation mode calls `requestFullscreen()` on the PDF viewer. Escape is the browser’s own way out. The page buttons stay on screen. The camera panel stays outside that fullscreen view. If fullscreen is missing or the browser rejects it, a message is shown and the buttons still work.

## Camera preview

Start camera asks the browser for video only. The microphone is not requested. Stop camera, leaving the page, or replacing the stream stops every track from that stream. A second click on Start camera does nothing while a start is already in progress or the preview is live.

The preview is flipped with CSS so it looks like a mirror. That flip is only on screen. MediaPipe reads the original frame. The landmark canvas uses the same mirror and the same `object-fit: cover`, and its bitmap is the video frame, so the drawing stays on the hand in the preview.

The app does not record the video or upload camera frames or PDF bytes. The only sentence on screen about that is “Your PDF and camera feed stay on this device.” Syne and Inter are requested from Google Fonts. If that request fails, the page uses Segoe UI or another system sans-serif.

If you deny permission, no camera is found, the camera is busy, or the page is not on localhost or HTTPS, the panel shows a short message. The PDF controls stay available.

## Gesture recognition

After the preview starts, the page loads one `GestureRecognizer` from `@mediapipe/tasks-vision` 1.1.0. The mode is `VIDEO`, `numHands` is 1, and the delegate is `CPU`. `recognizeForVideo(video, timestamp)` is the call from this package version. The timestamp is milliseconds and it increases on every call.

A `requestAnimationFrame` loop runs while the camera is on. Recognition runs only when about 66 ms have passed since the last call. Stop camera, or leaving the page, cancels that loop and calls `close()` on the recognizer.

The label on screen is the `categoryName` MediaPipe returns, with the score beside it, when a category is present. The built-in names in the installed type declarations are `None`, `Closed_Fist`, `Open_Palm`, `Pointing_Up`, `Thumb_Down`, `Thumb_Up`, `Victory`, and `ILoveYou`. The screen shows whatever name comes back. While the camera is on and no hand is in frame, the readout says “Waiting for hand.”

## Gesture navigation

`src/cv/gestureCommands.js` is the only place that decides a page turn. The camera calls it with the latest `categoryName` and score. The PDF viewer is the only place that changes the page number. Buttons, arrow keys, and an accepted gesture all use that same page move.

| Input | Result |
| --- | --- |
| `Thumb_Up` with score at least 0.70, while armed | Next page |
| `Thumb_Down` with score at least 0.70, while armed | Previous page |
| `Open_Palm`, or no hand | Neutral. Arms the next command. |
| Score below 0.70 | No page turn. The arm stays as it was. |
| Closed fist, pointing up, victory, I love you, `None` | Shown only. They do not arm the next turn. |
| Held thumb after a turn | No extra turn, including after 900 ms, until neutral happens again. |
| Pause Gesture Control, or stop the camera | Status becomes Gesture control paused. A thumb that is already up does not turn a page when control returns, until neutral happens again. |

The camera panel shows Gesture control active, Waiting for neutral, or Gesture control paused. A turn that changes the page outlines the PDF frame. The first and last pages do not move past the ends. Pause Gesture Control leaves the camera and the on-screen buttons working.

`npm.cmd run test:gestures` runs these rules in Node. It does not open a camera.

The model file is `public/models/gesture_recognizer.task`. It was downloaded from the Gesture Recognizer URL in the installed package README:

`https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task`

`scripts/copy-mediapipe-assets.mjs` copies the six wasm files exported by the same installed package into `public/mediapipe`. `FilesetResolver.forVisionTasks()` loads `vision_wasm_internal.js` when SIMD is available, and `vision_wasm_nosimd_internal.js` otherwise. The files are not renamed. If the model or those wasm files fail to load, the preview can stay on and the panel shows an error.

## How to run

Install dependencies, then start the dev server from the project folder:

```powershell
npm.cmd install
npm.cmd run dev
```

On Windows, if PowerShell blocks `npm.ps1`, call `npm.cmd` instead. `npm.cmd install` runs `scripts/copy-pdfjs-assets.mjs` and `scripts/copy-mediapipe-assets.mjs`. Open the local URL Vite prints. The camera works on that localhost address, or on HTTPS. It does not work from a plain `file://` page.

Check the gesture rules, then build the static site:

```powershell
npm.cmd run test:gestures
npm.cmd run build
```

`npm.cmd run test:gestures` checks the page-turn rules in Node. It does not open a browser or a camera. `npm.cmd run build` writes `dist`, including `dist/pdfjs`, `dist/mediapipe`, and `dist/models`, using paths relative to the site root (`/pdfjs/`, `/mediapipe/`, `/models/`). The app does not call the Vite dev server from the production bundle.

`public/pdfjs` and `public/mediapipe` are generated by that install step and are listed in `.gitignore`. `public/models/gesture_recognizer.task` is a required file and is not ignored. Do not skip install scripts (`npm install --ignore-scripts`), or the PDF worker and MediaPipe wasm files will be missing from the build.

Preview the build locally with `npm.cmd run preview`. Deployment is not set up. There is no Git remote in this audit.

## Manual checks still to do in a browser

These were not run in a browser during implementation. Use your own sample PDF. Do not use this list as a record of passes.

- Upload a normal PDF. Page 1 appears, and the counter shows the real page count.
- Choose a non-PDF, such as a `.png` or `.txt`. The message says to choose a PDF. An already open PDF stays open.
- On page 1, Previous is disabled. On the last page, Next is disabled.
- Previous and Next each move one page, and the canvas updates.
- Right arrow and Page Down move forward. Left arrow and Page Up move back. They stop at the ends.
- Tab to the file input and press an arrow key. The page does not change while that input is focused.
- Presentation mode fills the screen, the buttons remain usable, and Escape leaves it.
- Open a second PDF. It starts at page 1, and the first document is gone.
- Open a damaged file, or a non-PDF renamed to `.pdf`. The viewer reports that it is not a readable PDF.
- If you have a password-protected PDF, the viewer reports that it cannot open protected files.
- A larger file shows “Opening PDF…” before the first page appears.
- Press Start camera and allow the prompt. A live picture appears, and it looks mirrored.
- Press Stop camera. The picture goes away and the camera light turns off.
- Press Start camera again after stopping. A second preview does not stay open beside the first.
- Block the camera permission. The panel explains that the browser blocked it, and the PDF controls still work.
- If you can, try a computer with no camera, or a camera already used by another app, and read the message.
- Make the window narrow. The camera panel moves under the PDF instead of sitting beside it.
- Press Start Camera and hold a hand in view. The panel shows the MediaPipe category name and a score. With no hand, it says “Waiting for hand.”
- Try an open palm, a fist, thumbs up, thumbs down, pointing up, victory, and the I-love-you sign. The label should change. Every pose will not be classified correctly.
- The landmark lines sit on the hand in the mirrored preview, including after the window is resized.
- Press Stop camera. The drawing and the gesture name clear, and the camera light turns off.
- Press Start camera again. Only one preview and one recognizer are running.
- With a PDF open and the camera on, show an open palm until the status says Gesture control active. Thumbs up moves one page forward. Holding thumbs up does not keep turning pages.
- Return to an open palm, or move the hand out of view, then thumbs down moves one page back.
- A weak pose whose score stays below 0.70 does not turn the page.
- On the first page, thumbs down does not go to page 0. On the last page, thumbs up does not go past the end.
- Press Pause Gesture Control. Thumbs up no longer turns the page. Previous, Next, and the arrow keys still do.
- Press Stop camera while a thumb is up. Start the camera again. That held thumb does not immediately turn a page.
- While a gesture name is showing, Previous, Next, and the arrow keys still change the page.
- If `public/models/gesture_recognizer.task` or `public/mediapipe` is missing, the preview can remain and an error explains that recognition is unavailable.

## Limits

- One PDF page is one slide. Animations inside the PDF are not played.
- The page is a canvas. Text on the slide cannot be selected.
- Password-protected PDFs are rejected. No password prompt is shown.
- Some unusual fonts or images can still fail if the copied `public/pdfjs` files are missing. Run `node scripts/copy-pdfjs-assets.mjs` to restore them.
- The production build warns that the main JavaScript chunk is larger than 500 kB. That size is PDF.js. MediaPipe’s task code is a separate chunk.
- Vite’s `base` is `/`. A host that serves the site from a subpath needs that setting changed before the build. This audit did not change it and did not deploy.
- `public/pdfjs` and `public/mediapipe` are not stored in git. They are copied from the installed packages during `npm install`.
- Fullscreen depends on the browser. It is optional.
- The camera preview was not started on a real webcam in this session. Allow or deny the prompt yourself before treating that path as checked.
- Gesture names, the landmark overlay, and gesture page turns were not watched on a live hand. The Node checks do not prove that a pose is classified correctly.
- `None` does not re-arm the controller. An open palm or an empty frame does.
- Recognition uses one hand and the CPU delegate. It runs about 15 times a second.
