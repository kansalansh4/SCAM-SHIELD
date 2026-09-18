# Delivery record — 18 September 2026

## Outcome

The previously empty repository now contains the prioritized implementation plan and an implemented, locally verified MVP. No out-of-scope features were added. Production has not been deployed. Cloud configuration, real Vision validation and independent release acceptance remain outstanding; the SDD's page-14 release gates are not satisfied by local tests.

## Stage completion

| Stage / priority          | Delivered files and behavior                                                                                                     | Verification and next gate                                                                                                                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation / P1           | `package.json`, lockfiles, Vite/Tailwind, `src/app/`, shared contracts, deny-all rules, CI, environment examples                 | Node 22 production build and lint pass. Firebase chunk split for caching. Hosting predeploy rejects emulator/unconfigured or wrong-project builds.                                                                          |
| Identity / P1             | `src/features/Auth.jsx`, `AuthContext.jsx`, server identity checks, profile lifecycle                                            | Browser signup, email-verification refresh, sign-out and reauthentication pass against emulators. Real email delivery/action-template and production App Check enforcement require staging.                                 |
| Text / P1                 | `functions/src/analysis/engine.js`, shared catalog/contracts, checker/report UI, transactional reservations                      | R01–R08 and exact UTF-16 spans, text boundaries, context order, escaped rendering, stale-result clearing and concurrent quota checks pass. R08 quotes only the structural host/property, avoiding private paths/query data. |
| Privacy and deletion / P1 | Server-only metadata store, active-account/deletion fences, deletion worker, hourly cleanup, client memory lifecycle             | Delete-during-request, orphan prevention, batch deletion, cleanup and live browser account deletion pass. Cloud scheduler/TTL/log retention/alerts need deployment verification.                                            |
| Screenshot / P2           | Signature/decoder/size validation, pixel re-encoding, Vision adapter, local preview, editable OCR and explicit confirmation      | JPEG/PNG/WebP validation and mock OCR browser journey pass. Actual Vision recognition and timeout behavior remain staging gates. Mock result is visibly labeled in local mode.                                              |
| Hardening / P1–P3         | App Check configuration, quotas/caps, max instances, CSP/headers, runtime kill switches, CI and patched production packages      | Security tests pass; production dependency audits report zero findings. Review actual IAM, CSP endpoints, cloud logs and cost controls before launch.                                                                       |
| Release preparation / P3  | `IMPLEMENTATION_PLAN.md`, `RELEASE.md`, 200 regression fixtures, 30 synthetic screenshots, benchmark results, setup instructions | Developer regression matches expectations. Two reviewers, held-out data, real OCR, moderated usability, full browser/accessibility and cloud performance evidence are still required.                                       |

## Executed verification

Final application checks used Node 22.23.2 and Java 21.0.12.1 on macOS. Earlier development also used the bundled Node 24 runtime; the final emulator/browser pass used the deployment-target Node 22.

- ESLint: passed.
- Vite production build: passed. Local build uses explicit emulator settings and must not be deployed; Hosting predeploy blocks it.
- Vitest unit/component/image/schema suite: **58 passed**.
- Auth/Firestore integration suite: **13 passed**. Tests include client database denial, concurrent limits, duplicate IDs, failed OCR accounting, global cap, UTC rollover, stale leases, isolated users, missing-policy failure, account deletion and retention cleanup.
- Playwright with installed Google Chrome: **8 passed**, including three authenticated emulator journeys and five public/mobile/privacy journeys. Layout tests cover 320px and 200% root text size. Desktop and mobile screenshots were visually inspected.
- Live callable smoke: all four callables reject unauthenticated requests.
- Synthetic benchmark: **200 fixtures**, no expected-output mismatches, 88 validated spans, 100% listed-pattern recall on templated positives and 10% benign-significant rate. Eight benign security-advice examples intentionally expose the negation limitation. These are regression measurements, not independently validated release metrics or real-world detection accuracy.
- 30 reproducible synthetic screenshot files and ground-truth manifest supplied. Real-provider word recognition has **not** been measured.
- npm production audit: **0 vulnerabilities** for root production dependencies and **0** for Functions dependencies. A scoped `gaxios@6 → uuid 11.1.1` override addresses a transitive advisory; SDK loading and emulator flows were rechecked.
- Full development audit: **9 moderate findings**, zero high/critical at the recorded check. They affect the Firebase CLI/test tooling dependency graph, including OpenTelemetry/csv/stream/uuid/Vitest tooling. Do not expose development/test servers publicly; recheck upstream updates before release. No force downgrade of the Firebase CLI was applied.

No automated evidence is claimed for Safari/Firefox/Edge, screen-reader testing, measured color contrast, five moderated participants, real email delivery, real Vision, cloud latency/reliability, billing, scheduler execution, IAM, or rollback rehearsal. See RELEASE.md for exact gates and accountable owners.

## Explicit design decisions

- Added optional `incomplete` input flag because the SDD requires incomplete-text handling but did not include a field in its API schema. Default false; true produces insufficient information.
- Kept R07's literal overlapping “remote access” condition and documented the false-positive risk.
- Made metadata cleanup hourly with early eligibility to reconcile the 48-hour policy with periodic cleanup. Scheduling outages remain an operational risk.
- Kept a content-free deletion completion fence for 7 days to block late requests. No user content is retained.
- Added a deployment configuration guard so an emulator build cannot accidentally become the public site.

## Outstanding inputs and acceptance

Owner decisions: launch countries, cloud region, project IDs, billing budget, privacy contact/processor review, IAM/App Check configuration and authorization for production deployment. QA/product: two benchmark reviewers, held-out validation, moderated usability and full browser/accessibility acceptance. Technical owner: real OCR smoke, staging performance, cloud monitoring, TTL/cleanup/deletion retry and rollback rehearsal.

This is an implemented local MVP with release preparation, not a production-ready certification. P3 release sign-off is intentionally pending these external inputs.
