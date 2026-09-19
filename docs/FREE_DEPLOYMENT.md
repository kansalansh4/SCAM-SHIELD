# Browser-based free version

The owner selected this architecture to avoid billing and server credentials. Vercel Hobby serves the static site; Firebase Spark provides email/password Authentication. Both deterministic message checking and Tesseract.js screenshot OCR run in the browser. No Cloud Functions, Cloud Vision, Firestore data operations, scheduled workers, service-account keys or backend secrets are required by this version. Vercel Hobby is for personal/non-commercial use; provider free quotas still apply.

## Explicit changes from the original SDD

- Verified sign-in remains a UI prerequisite, but local analysis is not a security boundary: someone can run the public rule engine without signing in. Server-enforced daily quotas and App Check attestation are removed. No paid provider or private analysis endpoint needs quota protection.
- Messages, screenshots, extracted text and reports remain on the device. No scan data or scan metadata is sent to Firestore or a checking API. Firebase still receives account/authentication traffic; Vercel serves the app, worker, WASM and English model assets.
- Account deletion uses Firebase's authenticated client delete operation with recent password reauthentication. This version creates no Firestore profile, usage, request or deletion-job records, so no scheduled cleanup/TTL is required. Any records from a separately used legacy backend would need separate administrator cleanup; this deployment has not run that backend.
- OCR is device-dependent, requires an initial model download and has no server-enforced daily cap. Users review extracted text before checking. English text only. Local rules cannot prove authenticity.
- No claims of server-side enforcement, independently validated accuracy or complete SDD release acceptance are made.

## Production build

The registered public Firebase web identifiers are checked into `src/services/public-config.js`; these are not server credentials. Browser mode is the production default. To override the public configuration, set `VITE_BACKEND=browser`, `VITE_USE_EMULATORS=false` and real `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_APP_ID` from the Firebase web app. App Check and Functions region are unused by this mode. Add the Vercel hostname to Firebase Auth authorized domains and enable email/password sign-in. Use the existing Firebase verification/reset email handlers or configure the app's `/auth/action` route explicitly.

Run `npm ci`, `npm run build`, `npm run lint`, `npm test`. The build copies local OCR assets into `dist/ocr`; it does not upload user images. `vercel.json` includes SPA fallback and CSP allowances for same-origin worker/WASM. Keep Firestore rules deny-all; the free frontend never reads or writes that database.

Legacy Firebase Functions code and emulator tests remain for reference, but are not deployed for the free version. The manually triggered Firebase workflow is a separate legacy deployment path and must not be used for this browser release.

References: https://vercel.com/docs/plans/hobby, https://firebase.google.com/pricing, https://github.com/naptha/tesseract.js
