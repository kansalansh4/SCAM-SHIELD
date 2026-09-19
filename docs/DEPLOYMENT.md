# Deployment: Vercel frontend and Firebase backend

Repository: https://github.com/kansalansh4/SCAM-SHIELD

The complete application is on `main`. The owner selected Vercel for frontend hosting. `vercel.json` configures the Vite build, SPA route fallback and security headers. Firebase remains the authentication, database, callable-function and OCR backend; moving frontend hosting does not resolve its pending setup. A Vercel deployment without cloud configuration displays the existing setup-pending state; login and checks are unavailable. `.github/workflows/deploy.yml` provides a manually triggered staging/production deployment. A live URL is not available until Firebase access and project configuration are supplied and deployment succeeds.

## First deployment prerequisites

1. Sign in to Firebase CLI with the Google account that owns the project. Select a project, web app and region. Enable Firebase Auth email/password, Firestore, Functions, Vision and App Check. Functions/Vision require appropriate billing and enabled APIs.
2. Configure the server secret `PAYLOAD_HMAC_KEY`, the runtime service policy, Auth/email/password policy, App Check, IAM and privacy settings described in RELEASE.md.
3. For local deployment, supply real public Firebase web config in the build environment, `VITE_USE_EMULATORS=false`, and matching `FUNCTIONS_REGION`/`VITE_FUNCTIONS_REGION`. Install from lockfiles, build and deploy to the explicit project ID. Hosting predeploy rejects demo/unconfigured and mismatched-project builds.

## GitHub Actions configuration

Create GitHub environments `staging` and `production`, each pointing to its own Firebase project. Define these environment variables:

- `FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_APP_ID`
- `FUNCTIONS_REGION`
- `VITE_APPCHECK_SITE_KEY`
- `WORKLOAD_IDENTITY_PROVIDER`
- `FIREBASE_DEPLOY_SERVICE_ACCOUNT`

Set up Google Workload Identity Federation for this repository, limited to the intended branch/environment, and grant the deploy identity only the permissions needed to deploy Firebase Hosting, Firestore rules/indexes and Functions, access deployment secrets and act as the runtime identity. Do not upload service-account JSON to the repository. The action obtains short-lived credentials; runtime functions use their own Google service identity.

Go to Actions → Deploy to Firebase → Run workflow and choose the configured environment. Verification runs first; deployment fails clearly if required configuration is missing. No deployment is triggered merely by pushing code. Choose environment protection rules appropriate to your release process.

Local emulator `.env.local` and `.secret.local` files are explicitly excluded from the Functions upload. Generated CI credentials are ignored by Git. The deployment job uses a fresh checkout so emulator tests cannot leave configuration in the cloud artifact.

## Current status

Code pushed; deployment workflow prepared. Firebase authentication is complete. The owner selected Mumbai (`asia-south1`) for the backend and database. The Google Cloud project `scam-shield-kansalansh4` now exists and appears in the signed-in account’s available-project list (verified 2026-09-19). Enabling Firebase on it returns HTTP 403 PERMISSION_DENIED; the Firebase project list is still empty. The owner must resolve Firebase project setup/access in the console before billing and deployment configuration can continue. Real Vision, production App Check, billing/IAM, provider/privacy review and the release acceptance in RELEASE.md have not been verified. Do not present an unconfigured frontend as a functioning public checker.

References: [Firebase CLI CI authentication](https://firebase.google.com/docs/cli#cli-ci-systems) and [Google GitHub authentication action](https://github.com/google-github-actions/auth).

## Vercel setup

Import `kansalansh4/SCAM-SHIELD`, select Vite, repository root `.`, Node.js 22.x, and deploy `main`. Build/install/output settings are checked in. Never set `VITE_USE_EMULATORS=true` on Vercel.

For a functional deployment, set the public variables from `.env.example` to the real Firebase web app, `VITE_USE_EMULATORS=false`, and `VITE_FUNCTIONS_REGION=asia-south1`. Register the final Vercel hostname in Firebase Auth authorized domains and the reCAPTCHA Enterprise/App Check site. Configure email action URLs for that hostname. Deploy Firebase backend resources separately with `--only firestore,functions` after cloud access and billing are resolved. Rebuild Vercel after changing Vite variables, since they are embedded at build time. Never put backend secrets or service-account credentials in VITE variables.

Source: [Vercel Vite deployment and SPA routing](https://vercel.com/docs/frameworks/frontend/vite).
