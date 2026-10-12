# Test log

This file records commands that were run in `the GestureSlide project folder`, and what they printed. A check is not a pass until a result is written under it.

Planned work is listed in [architecture.md](architecture.md). It is not treated as tested here.

The shell started in `a system directory outside the project`. Every command below changed to the Desktop project folder first and printed `CONFIRMED_DIR: the GestureSlide project folder` before doing anything else.

`npm` itself did not run. PowerShell blocked `npm.ps1` because script execution is disabled. The commands used `npm.cmd` instead. The execution policy was not changed.

Node was `v24.14.0`.

## Phase 0 — scaffold

### Install

Command:

```powershell
npm.cmd init -y
npm.cmd install react react-dom
npm.cmd install -D vite @vitejs/plugin-react
```

Result: exit code 0.

- `npm.cmd init -y` wrote `package.json`.
- `npm.cmd install react react-dom` added 3 packages and audited 4 packages. It reported 0 vulnerabilities.
- `npm.cmd install -D vite @vitejs/plugin-react` added 16 packages and audited 20 packages. It reported 0 vulnerabilities.

`package.json` was then edited by hand: `"type"` set to `"module"`, `"private"` set to `true`, version set to `0.1.0`, and the scripts set to `dev`, `build`, and `preview`. The `main` field that pointed at `vite.config.js` was removed. A follow-up install synced the lockfile:

```powershell
npm.cmd install
```

Result: exit code 0. npm reported `up to date, audited 20 packages` and 0 vulnerabilities.

Direct dependencies after that install (`npm.cmd ls --depth=0`):

| Package | Version | Role |
| --- | --- | --- |
| react | 19.3.0 | dependency |
| react-dom | 19.3.0 | dependency |
| vite | 8.3.4 | dev dependency |
| @vitejs/plugin-react | 6.1.2 | dev dependency |

`pdfjs-dist`, `@mediapipe/tasks-vision`, and OpenCV.js are not installed. No `.git` directory was created.

### Production build

Command:

```powershell
npm.cmd run build
```

Result: exit code 0. Vite `v8.3.4` transformed 16 modules and finished in 435 ms. Output:

| File | Size |
| --- | --- |
| `dist/index.html` | 0.39 kB |
| `dist/assets/index-CX8X9Azq.css` | 0.58 kB |
| `dist/assets/index-DJxd1Y5I.js` | 220.55 kB |

A text search of `dist/assets/index-DJxd1Y5I.js` found the shell copy `GestureSlide`, `Phase 0`, and `Not built yet`.

### Development server

Command:

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Result: the process stayed running. Vite printed `VITE v8.3.4 ready in 378 ms` and `Local: http://127.0.0.1:5173/`.

HTTP checks against that URL, all on 11 Oct 2026:

| Request | Status | What the body showed |
| --- | --- | --- |
| `GET /` | 200 | HTML title `GestureSlide`, `<div id="root">`, and `<script type="module" src="/src/main.jsx">`. Vite also injected the React refresh preamble. |
| `GET /src/App.jsx` | 200 | JavaScript compiled by `@vitejs/plugin-react`. The source text includes `Phase 0 — scaffold` and `GestureSlide`. |
| `GET /src/styles.css` | 200 | Vite returned the CSS as a JavaScript module that injects the stylesheet. |

No browser tool was available, so the page was not opened in a browser and the painted layout was not checked. These checks show that the server, the HTML shell, the JSX transform, and the CSS module respond. They do not show a screenshot of the rendered page.

The dev server was stopped after these checks.

## Phase 1 — PDF viewer

Date of these commands: 11 Oct 2026. The working directory was checked before each one and printed `CONFIRMED_DIR: the GestureSlide project folder`. `npm.cmd` was used again because PowerShell still blocks `npm.ps1`. Node was `v24.14.0`. No Git remote was configured. No personal PDF was opened.

There is no lint script and no project test script in `package.json`. None was run. The checks below are the commands that were run.

### Install

```powershell
npm.cmd view pdfjs-dist version
npm.cmd view pdfjs-dist@6.4.299 version
npm.cmd install pdfjs-dist@6.4.299
```

Both `npm view` commands printed `6.4.299`. That was the current stable version on the registry. The install added 3 packages, audited 23 packages, and reported 0 vulnerabilities.

`package.json` was then pinned to `"pdfjs-dist": "6.4.299"` and given a `postinstall` script. A second install ran that script:

```powershell
npm.cmd install
```

Exit code 0. The script printed `Copied cmaps, standard_fonts, wasm, iccs from pdfjs-dist into public/pdfjs`. npm reported `up to date, audited 23 packages` and 0 vulnerabilities.

The worker was first imported with Vite’s `?url` suffix. In the dev server that file was rewritten and began with `import { injectQuery } from "/@vite/client"`. The copy script was then changed to also copy `pdf.worker.min.mjs` into `public/pdfjs`, and `GlobalWorkerOptions.workerSrc` was pointed at that static file. The script was run again and printed `Copied cmaps, standard_fonts, wasm, iccs and pdf.worker.min.mjs from pdfjs-dist into public/pdfjs`.

`npm.cmd ls --depth=0` printed:

| Package | Version |
| --- | --- |
| react | 19.3.0 |
| react-dom | 19.3.0 |
| pdfjs-dist | 6.4.299 |
| vite | 8.3.4 |
| @vitejs/plugin-react | 6.1.2 |

The copied asset folders contained 169 character-map files, 16 standard-font files, 13 wasm files, and 2 ICC files. The same counts were present under `dist/pdfjs` after the build.

### Library checks outside the browser

A temporary Node script, not part of the project, imported `src/cv/pdfFiles.js` and PDF.js.

File-type and message checks, all matched:

- `Deck.PDF` with an empty type is accepted.
- MIME `application/pdf` is accepted.
- `notes.txt` and `photo.png` are rejected.
- `PasswordException` maps to the password-protected message.
- `InvalidPDFException` maps to the unreadable-PDF message.
- `RenderingCancelledException` maps to an empty string.

A synthetic two-page PDF was built in that script. It is not a personal document.

The modern browser build (`pdfjs-dist/build/pdf.mjs`) is what the app uses. In Node, PDF.js printed `Warning: Please use the legacy build in Node.js environments.` Opening the synthetic PDF with that modern build failed: `UnknownErrorException` `hashOriginal.toHex is not a function`. The same Node process did reject four garbage bytes as `InvalidPDFException`.

The script was pointed at the legacy build (`pdfjs-dist/legacy/build/pdf.mjs` and its matching worker), which is the build PDF.js asks for in Node. That run printed `pdfjs version 6.4.299`, `PASS blank pdf pages` with `numPages` 2, and `PASS corrupt pdf name` with `InvalidPDFException`. Result: `9/9 passed`. The legacy build is not what the browser app loads.

This did not draw a page onto a canvas. No password-protected PDF was parsed. The password text was checked only by passing an error object with `name: 'PasswordException'`.

### Production build

```powershell
npm.cmd run build
```

The first build, while the worker was still a Vite `?url` import, exited 0. Vite `v8.3.4` transformed 22 modules in 582 ms and also emitted `dist/assets/pdf.worker.min-CjEcRF4W.mjs` at 1,264.34 kB. That file was 1,264,342 bytes, the same length as `node_modules/pdfjs-dist/build/pdf.worker.min.mjs`. Vite warned that some chunks are larger than 500 kB. The build still exited 0.

After the worker was switched to the static copy, the build was run again:

```powershell
npm.cmd run build
```

Exit code 0. Vite transformed 21 modules and finished in 833 ms. The same chunk-size warning was printed.

| File | Size |
| --- | --- |
| `dist/index.html` | 0.39 kB |
| `dist/assets/index-330tomBV.css` | 2.11 kB |
| `dist/assets/index-F1JH_UN3.js` | 657.62 kB |
| `dist/pdfjs/pdf.worker.min.mjs` | 1,264,342 bytes |

`node_modules/pdfjs-dist/build/pdf.worker.min.mjs`, `public/pdfjs/pdf.worker.min.mjs`, and `dist/pdfjs/pdf.worker.min.mjs` are all 1,264,342 bytes. Their SHA-256 hashes match: `9536359F1B8367850D485731CA1D5E45C159A7B7A0912325E539937AA21CEB18`.

### Development server

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

The process stayed running. Vite printed `VITE v8.3.4 ready in 529 ms` and `Local: http://127.0.0.1:5173/`. It also printed that it was re-optimizing dependencies because the lockfile changed.

HTTP checks, all status 200:

| Request | What was confirmed |
| --- | --- |
| `GET /` | HTML shell. |
| `GET /src/App.jsx` | Transformed module contains `Phase 1 — PDF viewer`, `GestureSlide`, and `PdfStage`. |
| `GET /src/components/PdfStage.jsx` | Module served. |
| `GET /src/cv/pdfController.js` | Sets `GlobalWorkerOptions.workerSrc` to `${assetBase}pdf.worker.min.mjs`. |
| `GET /pdfjs/pdf.worker.min.mjs` | Status 200, `Content-Length: 1264342`, matching the installed worker. The body is not rewritten with the Vite client import. |
| `GET /pdfjs/cmaps/78-EUC-H.bcmap` | Character map served from the copied assets. |
| `GET /pdfjs/standard_fonts/FoxitSerif.pfb` | Standard font served. |
| `GET /pdfjs/wasm/openjpeg.wasm` | WebAssembly decoder served. |
| `GET /pdfjs/iccs/CGATS001Compat-v2-micro.icc` | ICC profile served. |

No browser tool was available. A PDF was not selected in the page, the canvas was not painted, the buttons were not clicked, the arrow keys were not pressed, and fullscreen was not entered. Those items are not passes.

The dev server was still running at `http://127.0.0.1:5173/` when this log was written.

## Phase 2 — camera preview

Date of these commands: 11 Oct 2026. The working directory was checked and printed `CONFIRMED_DIR: the GestureSlide project folder`. No package was installed. MediaPipe and OpenCV.js were not added. `PdfStage.jsx` was not rewritten.

### Production build

```powershell
npm.cmd run build
```

The final run exited 0. Vite `v8.3.4` transformed 22 modules and finished in 980 ms. It warned that a chunk is larger than 500 kB. The build still exited 0.

| File | Size |
| --- | --- |
| `dist/index.html` | 0.39 kB |
| `dist/assets/index-MaWvNl9p.css` | 2.90 kB |
| `dist/assets/index-B-NseQ2Q.js` | 661.15 kB |

A text search of `dist/assets/index-B-NseQ2Q.js` found `Start camera`, `Stop camera`, `getUserMedia`, and `The preview stays in this browser`. It did not find `MediaRecorder`, `mediapipe`, or `opencv`.

### Development server

The Phase 1 dev server was still running at `http://127.0.0.1:5173/`. It was not started again. These requests all returned 200:

| Request | What was confirmed |
| --- | --- |
| `GET /` | HTML shell. |
| `GET /src/App.jsx` | Module contains `Phase 2 — camera preview`, and it renders both `PdfStage` and `CameraStage`. |
| `GET /src/components/PdfStage.jsx` | The PDF viewer module is still served. |
| `GET /src/components/CameraStage.jsx` | Module calls `getUserMedia` with `audio: false`, sets `video.muted = true` and `video.playsInline = true`, and includes Start camera and Stop camera. |

No browser tool was available. The camera permission prompt was not shown, a live picture was not seen, and Stop camera was not clicked. Those are not passes. PDF buttons, arrow keys, and presentation mode were not clicked again in a browser.

## Phase 3 — hand gesture recognition

Date of these commands: 11 Oct 2026. The working directory was checked and printed `CONFIRMED_DIR: the GestureSlide project folder`. `PdfStage.jsx` was not rewritten. OpenCV.js was not downloaded. No gesture changes the PDF page.

`@mediapipe/tasks-vision` 1.1.0 was already installed before these commands. `package.json` now pins that exact version. `npm.cmd ls --depth=0` after the successful install below shows:

| Package | Version |
| --- | --- |
| @mediapipe/tasks-vision | 1.1.0 |
| pdfjs-dist | 6.4.299 |
| react | 19.3.0 |
| react-dom | 19.3.0 |
| vite | 8.3.4 |
| @vitejs/plugin-react | 6.1.2 |

The installed `vision.d.ts` declares `GestureRecognizer.createFromOptions`, `recognizeForVideo(videoFrame, timestamp)`, `runningMode` `"IMAGE" \| "VIDEO"`, `delegate` `"CPU" \| "GPU"`, and `DrawingUtils.drawLandmarks` / `drawConnectors`. The code uses those signatures.

### Model download

```powershell
curl.exe -fL --retry 3 --retry-delay 2 -o public\models\gesture_recognizer.task https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task
```

Result: exit code 0. curl printed `100 8177k` received and the script printed `DOWNLOAD_OK`.

That URL is the Gesture Recognizer example in the README of the installed `@mediapipe/tasks-vision` 1.1.0 package (`author: mediapipe@google.com`).

A range request of bytes 0–31 to the same URL returned HTTP 206, `Content-Type: application/octet-stream`, `x-goog-stored-content-length: 8373440`, and `x-goog-hash: md5=Tb9IXEcyB2URAKGJU0PzWg==`. The first bytes were `00 00 50 4B`.

The saved file:

| Check | Result |
| --- | --- |
| Size | 8,373,440 bytes |
| MD5, base64 | `Tb9IXEcyB2URAKGJU0PzWg==` (matches the Google header) |
| SHA-256 | `97952348cf6a6a4915c2ea1496b4b37ebabc50cbbf80571435643c455f2b0482` |
| First bytes | `00 00 50 4B`, same as the range response. Not HTML. |
| `tar -tf` | `hand_landmarker.task` and `hand_gesture_recognizer.task` |
| Plain strings in the file | `None`, `Closed_Fist`, `Open_Palm`, `Pointing_Up`, `Thumb_Down`, `Thumb_Up`, `Victory`, `ILoveYou` |
| Plain string `Unknown` | Not found |

`dist/models/gesture_recognizer.task` after the build below was byte-for-byte the same file.

### Wasm copy

The first `npm.cmd install` after adding the copy script exited 1. `postinstall` copied the PDF.js assets, then `scripts/copy-mediapipe-assets.mjs` threw `ERR_PACKAGE_PATH_NOT_EXPORTED` because `@mediapipe/tasks-vision` does not export `./package.json`. The script was changed to copy the six wasm files through their package exports. The install was run again:

```powershell
npm.cmd install
```

Result: exit code 0. It printed `up to date, audited 24 packages` and `found 0 vulnerabilities`. The postinstall log listed all six copies:

- `vision_wasm_internal.js`
- `vision_wasm_internal.wasm`
- `vision_wasm_nosimd_internal.js`
- `vision_wasm_nosimd_internal.wasm`
- `vision_wasm_module_internal.js`
- `vision_wasm_module_internal.wasm`

SHA-256 of each file matched `node_modules/@mediapipe/tasks-vision/wasm` and `dist/mediapipe` after the build. Sizes: internal js 335,393; internal wasm 12,997,248; nosimd js 335,196; nosimd wasm 12,168,316; module js 335,431; module wasm 12,997,272.

The app calls `FilesetResolver.forVisionTasks(basePath)` with no second argument. In this package that requests `vision_wasm_internal` when SIMD is present and `vision_wasm_nosimd_internal` otherwise. The module pair is copied and is not requested by the app.

### Production build

```powershell
npm.cmd run build
```

Result: exit code 0. Vite `v8.3.4` transformed 24 modules and finished in 1.36 s. It warned that a chunk is larger than 500 kB. The build still exited 0.

| File | Size |
| --- | --- |
| `dist/index.html` | 0.39 kB |
| `dist/assets/index-9XRkHOYC.css` | 3.14 kB |
| `dist/assets/vision_bundle-B98kuiHF.js` | 154.27 kB |
| `dist/assets/index-D1AR44ti.js` | 666.20 kB |

A text search of `dist/assets/index-D1AR44ti.js` found `recognizeForVideo`, `gesture_recognizer.task`, `CPU`, `numHands`, and the sentence that a gesture does not change the page. It did not find `MediaRecorder` or `opencv`. `dist/assets/vision_bundle-B98kuiHF.js` also contains `recognizeForVideo`.

### Development server

The Phase 1 dev server was still running at `http://127.0.0.1:5173/`. It was not started again.

| Request | Status | What was confirmed |
| --- | --- | --- |
| `GET /` | 200 | HTML shell, `Content-Length: 570`. |
| `GET /src/App.jsx` | 200 | Contains `Phase 3` and the sentence that gestures do not change the page. |
| `GET /src/components/PdfStage.jsx` | 200 | Still contains `requestFullscreen`. |
| `GET /src/components/CameraStage.jsx` | 200 | Contains `recognizeForVideo`, `RECOGNITION_GAP_MS`, `getUserMedia`, and `audio: false`. It does not contain `setPage` or `pageNumber`. |
| `GET /models/gesture_recognizer.task` | 200 | `Content-Length: 8373440`. `Content-Type` was empty. A range request returned 206 for bytes 0–3 of that same length. |
| `GET /mediapipe/vision_wasm_internal.js` | 200 | `text/javascript`, length 335,393. |
| `GET /mediapipe/vision_wasm_internal.wasm` | 200 | `application/wasm`, length 12,997,248. |
| `GET /mediapipe/vision_wasm_nosimd_internal.js` | 200 | `text/javascript`, length 335,196. |
| `GET /mediapipe/vision_wasm_nosimd_internal.wasm` | 200 | `application/wasm`, length 12,168,316. |
| `GET /mediapipe/vision_wasm_module_internal.js` | 200 | `text/javascript`, length 335,431. |
| `GET /mediapipe/vision_wasm_module_internal.wasm` | 200 | `application/wasm`, length 12,997,272. |

No browser tool was available. The camera was not started. A gesture name was not seen. Landmarks were not seen on a hand. Those are not passes. PDF buttons, arrow keys, and presentation mode were not clicked again in a browser.

## Phase 4 — gesture-controlled page turns

Date of these commands: 11 Oct 2026. The working directory was checked and printed `CONFIRMED_DIR: the GestureSlide project folder`. OpenCV.js was not downloaded. No package was installed. The PDF viewer, camera preview, and MediaPipe model were kept. `src/cv/gestureCommands.js` decides a turn. `PdfStage` still owns the page number.

### Command checks

```powershell
npm.cmd run test:gestures
```

Result: exit code 0. The script printed `OK 12 checks`. Each line began with `PASS`:

- constants are the viva values
- a fresh controller ignores Thumb_Up until neutral
- Open_Palm then Thumb_Up at 0.70 moves next once
- a held Thumb_Up cannot fire again after the cooldown
- Open_Palm re-arms, then Thumb_Down moves previous once
- no hand re-arms the next command
- confidence below 0.70 does not turn a page or drop the arm
- other labels do not navigate or re-arm
- cooldown blocks a new command until 900 ms, even after neutral
- pausing clears a pending arm and does not keep a stale command
- pause keeps the last accepted action name
- page moves stay inside 1..pageCount

The script imports `src/cv/gestureCommands.js` and uses Node `assert`. It does not open a browser or a camera. A score of 0.699 produced no action. A score of 0.70 produced one next action after `Open_Palm`. A second `Thumb_Up` after 900 ms produced no action until neutral happened again. `movePage(1, 4, 'previous')` stayed on page 1. `movePage(4, 4, 'next')` stayed on page 4.

### Production build

```powershell
npm.cmd run build
```

Result: exit code 0. Vite `v8.3.4` transformed 25 modules and finished in 1.41 s. It warned that a chunk is larger than 500 kB. The build still exited 0.

| File | Size |
| --- | --- |
| `dist/index.html` | 0.39 kB |
| `dist/assets/index-DRxTT2vR.css` | 3.64 kB |
| `dist/assets/vision_bundle-CnR0BGV9.js` | 154.27 kB |
| `dist/assets/index-D2r5iGm0.js` | 670.57 kB |

A text search of `dist/assets/index-D2r5iGm0.js` found `Pause gesture navigation`, `Thumb_Up`, `Open_Palm`, `Waiting for neutral`, and `No PDF is open`. It did not find `opencv` or `MediaRecorder`.

No browser tool was available. The camera was not started. A thumb was not seen turning a page. Buttons and arrow keys were not clicked in a browser. Those are not passes.

## Interface — Dipa Poros restyle

Date of these commands: 11 Oct 2026. The working directory was checked and printed `CONFIRMED_DIR: the GestureSlide project folder`. No package was installed. Gesture command rules were not edited. The screen copy, layout, and colors were changed. `src/cv/gestureCommands.js` was not part of that edit.

### Command checks

```powershell
npm.cmd run test:gestures
```

Result: exit code 0. The script printed `OK 12 checks`. The same twelve `PASS` lines as Phase 4 printed again. This run does not open a browser.

### Production build

```powershell
npm.cmd run build
```

Result: exit code 0. Vite `v8.3.4` transformed 25 modules and finished in 1.66 s. It warned that a chunk is larger than 500 kB. The build still exited 0.

| File | Size |
| --- | --- |
| `dist/index.html` | 0.75 kB |
| `dist/assets/index-Bi-HorwQ.css` | 7.74 kB |
| `dist/assets/vision_bundle-CBFaqrYo.js` | 154.27 kB |
| `dist/assets/index-C_D4b9ie.js` | 672.37 kB |

A text search of `dist/assets/index-C_D4b9ie.js` found `Your slides`, `Open a PDF`, `HANDS-FREE`, `Pause gesture navigation`, `Thumb_Up`, `Open_Palm`, and `Waiting for neutral`. It did not find `opencv` or `MediaRecorder`.

No browser was used. The new layout, colors, file button, camera, and a gesture page turn were not watched. Those are not passes.

## Interface — one-screen workspace

Date of these commands: 11 Oct 2026. The working directory was checked and printed `CONFIRMED_DIR: the GestureSlide project folder`. No package was installed. Gesture command rules were not edited. The hero was removed. The header, slides, and camera are laid out to share one wide viewport. A PDF page is scaled to the frame’s width and height with one scale.

### Command checks

`npm.cmd run test:gestures` exited 0 and printed `OK 12 checks`, with the same twelve `PASS` lines as Phase 4. This run does not open a browser.

### Production build

```powershell
npm.cmd run build
```

Result: exit code 0. Vite `v8.3.4` transformed 25 modules and finished in 1.92 s. It warned that a chunk is larger than 500 kB. The build still exited 0.

| File | Size |
| --- | --- |
| `dist/index.html` | 0.75 kB |
| `dist/assets/index-s3b_PaSJ.css` | 7.97 kB |
| `dist/assets/vision_bundle-vFwTSmkr.js` | 154.27 kB |
| `dist/assets/index-DQBrUuCu.js` | 671.08 kB |

A text search of `dist/assets/index-DQBrUuCu.js` found `Ready when you are`, `Open PDF`, `Gesture Control`, `Waiting for neutral`, `Thumb_Up`, `Open_Palm`, and `Your PDF and camera feed stay on this device.` It did not find `opencv`, `MediaRecorder`, or `Your slides`.

No browser was opened. Fit on a 1366×768 or 1440×900 viewport was not measured. A PDF, the camera, and a gesture page turn were not watched. Those are not passes.

## Phase 6 — pre-deployment audit

Date of these commands: 11 Oct 2026. The working directory was checked and printed `CONFIRMED_DIR: project folder`. No package was installed. Git was not initialized. Nothing was pushed or deployed. Gesture command rules and the UI were not edited.

```powershell
npm.cmd run test:gestures
npm.cmd run build
```

`npm.cmd run test:gestures` exited 0 and printed `OK 12 checks`, with the same twelve `PASS` lines as Phase 4. It did not open a browser.

`npm.cmd run build` exited 0. Vite `v8.3.4` transformed 25 modules and finished in 1.42 s. It warned that a chunk is larger than 500 kB. The build still exited 0.

| File | Size |
| --- | --- |
| `dist/index.html` | 0.75 kB |
| `dist/assets/index-s3b_PaSJ.css` | 7.97 kB |
| `dist/assets/vision_bundle-vFwTSmkr.js` | 154.27 kB |
| `dist/assets/index-DQBrUuCu.js` | 671.08 kB |

The built script uses `/pdfjs/`, `/mediapipe`, and `/models/gesture_recognizer.task`. Those folders are present under `dist`. The bundle does not contain this computer’s user-folder path or `127.0.0.1`. The word `localhost` appears only in the camera error message. No browser was opened, and the built site was not deployed.

## Not tested

- Manual browser use of a real PDF, including navigation, fullscreen, and a second file.
- A real password-protected PDF.
- Canvas rendering of a PDF page in a browser.
- Webcam permission, a live preview, stopping the camera, and a missing or busy camera.
- A live MediaPipe label, score, and landmark overlay, including the mirrored preview.
- A live thumb-up or thumb-down page turn, the neutral re-arm, the cooldown, and the end pages.
- Pause gesture navigation, then confirm the buttons and arrow keys still move the page.
- Stop, then Start, confirming that a held thumb does not fire a stale command.
- A missing model or wasm file in the browser.
- OpenCV.js. That phase is not in this tree.
