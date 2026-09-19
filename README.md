# Free browser-based release

Live site: https://scam-shield-wine-nine.vercel.app

Message analysis and screenshot OCR run on your device; Firebase Spark handles email/password sign-in. No billing account or service-account key is required. See [free deployment guide](docs/FREE_DEPLOYMENT.md) for architecture changes and limits. The sections below also retain the original Firebase server implementation for reference.

# Scam Shield

A mobile-friendly English warning-sign checker for suspicious messages and screenshots. React + Vite + Tailwind, Firebase Authentication/Firestore/Functions/Hosting, and Google Cloud Vision. Analysis uses deterministic `rules-1.0`; it does not verify senders or establish that a message is safe.

- [Prioritized P1–P3 implementation plan](docs/IMPLEMENTATION_PLAN.md): tasks, dependencies, effort, scope and acceptance.
- [Delivery and verification record](docs/DELIVERY.md): what was implemented, tested and still needs external verification.
- [Release and operations runbook](docs/RELEASE.md): cloud setup, privacy gates, costs and rollback.

## Local setup

Use Node.js 22 and Java 21 for the Firebase Emulator Suite. No real Firebase project or OCR credentials are needed locally.

```sh
npm ci
npm ci --prefix functions
cp .env.example .env.local
npm run prepare:functions
npm run emulators
```

In a second terminal:

```sh
npm run seed:emulators
npm run dev
```

Open the Vite URL, create an account, and use the verification action link printed by the Auth emulator (also available in its local UI at http://127.0.0.1:4000). Then select “I have verified my email.” The local project ID `demo-scam-shield` is explicitly emulator-only, not a real deployment identifier.

Local screenshot extraction intentionally returns the fixed fixture `Urgent: send your OTP immediately.` after validating the image. A visible development notice explains this. It is not OCR accuracy testing. Cloud deployments always use Vision; the mock/App Check bypass is restricted to Functions emulator + `demo-` project IDs.

The public UI also renders without `.env.local`, but checking/sign-in remain unavailable until configured. Results are produced by server callables, never a browser mock engine.

## Checks

```sh
npm run lint
npm test
npm run test:rules
npm run test:integration
npx playwright install chromium
npm run test:e2e
npm run test:e2e:full
npm run benchmark
npm run build
```

`test:integration` starts Auth/Firestore emulators and verifies denial of client database access, quota concurrency, idempotency, lifecycle fencing and cleanup. E2E public tests run a local Vite server. Run `npm run test:e2e:full` for signup, verification, text/OCR and deletion through the full emulator stack. It starts its own emulators; stop any existing ones first. Benchmarks are synthetic developer regression data; human-reviewed release evidence remains mandatory.

Required scripts are in the root package. `scripts/sync-shared.mjs` copies the single source-of-truth `shared/` directory into the deployable Functions bundle; generated copies are ignored. Run it before emulator startup or direct server tests after shared edits. Firebase predeploy also runs it.

## Architecture

```text
src/app/             routes, auth lifecycle and providers
src/features/        authentication, message/OCR flow and account deletion
src/services/        Firebase SDK and callable transport
src/styles/          Tailwind and responsive component styles
shared/              strict schemas, sources, action policy and version IDs
functions/src/       trusted callables, quotas, pure rule engine, OCR, workers
scripts/             emulator seed, reproducible fixtures and benchmark
 tests/              rule, component, image, integration and browser checks
```

Callables: `ensureProfile`, `analyzeMessage`, `extractScreenshot`, `deleteAccount`. Every production callable requires verified Firebase Auth and App Check. Client Firestore access is denied. Quotas reserve attempts transactionally: 20 text/day, 5 OCR/day, 3 combined/minute, one OCR in flight; the default global OCR cap is 100/day. Missing policy fails closed. Runtime policies live at `runtimeConfig/service`.

Messages, screenshots, OCR text and reports are never saved to the database, object storage or telemetry. Request metadata contains a keyed HMAC, not content; secrets belong in Secret Manager. Clearing, switching accounts, sign-out, mode changes and unmount invalidate in-flight responses. Analysis links stay inert; only reviewed catalog links are clickable.

Deletion requires reauthentication within 5 minutes. A transactional fence blocks new work; a retryable worker removes child metadata/profile/Auth. A content-free completion fence remains 7 days. An hourly cleanup job plus TTL backup manages metadata expiry. Cloud outages can delay cleanup; monitoring is a release requirement.

## Environment inventory

| Name                                                                                                     | Location                    | Purpose                                                                                               |
| -------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `VITE_USE_EMULATORS`                                                                                     | client                      | `true` only for local emulators                                                                       |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_APP_ID` | client                      | Firebase public web configuration; never service credentials                                          |
| `VITE_FUNCTIONS_REGION`                                                                                  | client                      | Match the explicitly selected Functions region                                                        |
| `VITE_APPCHECK_SITE_KEY`                                                                                 | client                      | reCAPTCHA Enterprise site key for App Check                                                           |
| `FUNCTIONS_REGION`                                                                                       | Functions parameter         | Owner-approved cloud region; local default us-central1 is not production approval                     |
| `PAYLOAD_HMAC_KEY`                                                                                       | Secret Manager              | Random server-only HMAC key; rotating it requires a documented key-version strategy                   |
| `OCR_PROVIDER`                                                                                           | local Functions environment | Default mock only for demo emulator; `vision` opts into real OCR locally with separately supplied ADC |
| `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`                                                 | test/CLI                    | Set by Emulator Suite; never deploy these                                                             |

Do not commit `.env.local`, service-account JSON, tokens, passwords or submitted user content. No Firebase Storage, LLM, URL crawler, history, billing UI or social login is included.

## Deployment boundary

This repository contains deployment configuration but does not provision or publish a cloud project. The owner must supply separate projects, region, billing/IAM, App Check, email templates/action URLs, processor review, geography, budget, monitoring and release acceptance. See [RELEASE.md](docs/RELEASE.md) before any `firebase deploy`.

The emulator startup script creates ignored local Functions region and dummy-secret files if missing. These are demo-only defaults; it never supplies production credentials.

## Deployment workflow

[Deploy to Firebase](.github/workflows/deploy.yml) is a manual GitHub Actions workflow with staging/production environments. It verifies the application before deployment and requires real Firebase configuration. See [GitHub deployment setup](docs/DEPLOYMENT.md). The existence of the workflow does not mean a live deployment has succeeded.
