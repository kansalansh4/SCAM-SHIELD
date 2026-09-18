# Release and operations checklist

All items below remain mandatory before public deployment. Lowest implementation priority does not mean optional launch work.

## Configure staging

1. Owner approves countries, suitable local help/reporting links, data region and monthly budget. US FTC links are labeled US-specific; do not assume the repository owner's location is the launch geography.
2. Create distinct dev/staging/production Firebase projects. Enable email/password Auth, minimum password length 12 and email enumeration protection. Configure authorized domains and custom email action links to `/auth/action`. Only fixed local routes are used after actions; arbitrary `continueUrl` is ignored.
3. Enable Firestore, Functions, Vision, billing and App Check (reCAPTCHA Enterprise). Supply public client config through build environment and explicitly match `FUNCTIONS_REGION` and `VITE_FUNCTIONS_REGION`. No debug App Check tokens in production.
4. Use runtime IAM identities and least privilege. Extraction requires Vision access; callables/workers require appropriate Firestore/Auth permissions. Separate extraction identity from other functions where practical. Review the Firebase default runtime identity before deploying; configuration in source is not proof of correct IAM.
5. Store a cryptographically random `PAYLOAD_HMAC_KEY` via `firebase functions:secrets:set PAYLOAD_HMAC_KEY --project <staging-project>`. The current fingerprint marker is `v1`; plan rotation with a retained previous key/version for the retry window or consciously invalidate pending retries with user-facing guidance. Never expose the key through Vite.
6. Initialize `runtimeConfig/service` with `enabled: true`, `ocrEnabled: true`, `dailyOcrCap: 100`, `quotaPolicyVersion: "quota-1.0"` through trusted administration. Missing/invalid policy blocks checks. Do not increase limits silently; reserve attempts, including provider failures.
7. Deploy rules/indexes/functions and a production build to the approved staging project:

```sh
npm ci
npm ci --prefix functions
npm run build
npx firebase deploy --only firestore,functions,hosting --project <staging-project>
```

Hosting predeploy rejects emulator builds, missing App Check config, and build/deployment project mismatches. Set `VITE_USE_EMULATORS=false` explicitly for staging/production and replace the local `.env.local` values with approved configuration before building. The CLI provides `GCLOUD_PROJECT` to predeploy hooks.

8. Test CSP against actual Auth/App Check/Functions domains before release. Replace the general `*.cloudfunctions.net` connection allowlist with exact deployed callable origins. If configured custom Functions endpoints require other origins, enumerate only those. Verify HTTPS, no framing, no-referrer and nosniff headers. Local Vite does not enforce Hosting headers.
9. Configure Cloud Logging retention to 30 days and exclusions/scrubbing; disable content capture in external telemetry. Verify provider processing/retention, infrastructure logs, backups and error handling match the privacy notice. Publish an owner-approved notice/contact only after this review.

## Acceptance evidence

- [ ] T01–T14, emulator isolation, malformed image, stale response, delete-during-request and auth action tests pass.
- [ ] Real email verification/reset/expired action links and App Check rejection tested on staging.
- [ ] Real Vision smoke on JPEG/PNG/WebP with no provider auto-retries; metadata removed; no content logs.
- [ ] Benchmark labels reviewed by two people: 80 positive / 80 benign / 40 ambiguous, plus 30 varied screenshots. Existing templated regression fixtures are not a held-out benchmark. Create independently labeled held-out examples before rule tuning/re-evaluation.
- [ ] ≥90% listed-pattern recall; ≤10% benign significant; 100% exact evidence; no fabricated sources/safe guarantees. ≥90% readable screenshot word recognition before editing.
- [ ] At least 4/5 moderated participants complete a check and explain the first action without help.
- [ ] Keyboard/screen-reader, 320px, 200% text zoom, 4.5:1 normal-text contrast, ≥16px body text and ≥44px controls checked; current/previous Safari iOS and Chrome Android, current desktop Chrome/Firefox/Safari/Edge covered.
- [ ] Valid staging text success ≥98%, readable OCR success ≥95%. At least 50 latency requests per path including cold starts; p95 text ≤3s and OCR ≤20s for ≤2 MiB. Use dedicated test accounts/time windows or an explicitly approved temporary staging quota policy; restore production values afterward.
- [ ] Five throttled mobile production-build measurements: median LCP ≤2.5s, CLS ≤0.1. These are targets, not claimed measurements.
- [ ] Service monthly valid-request success target 99.5%; no SLA claim.

## Monitoring and retention

Allowlist telemetry fields: request ID, function, status/error code, duration, rules version. Never log raw SDK exceptions, request bodies, images, email/password/action tokens, excerpts or URLs. Application logging uses this allowlist; inspect managed platform/provider logs separately.

Create metrics for request/error counts, p50/p95 duration, OCR timeout rate and cap rejections. Alert when server/provider errors exceed 5% over 15 minutes with at least 20 requests. Monitor deletion jobs older than 24h, and `operations/cleanup.completedAt` lag older than 24h, using external monitoring that still runs if the cleanup scheduler fails entirely. Worker logs alone cannot detect a scheduler that never fires.

Cleanup runs hourly: request eligibility is 47h after reservation and usage/global counters 6d23h, allowing one scheduled interval within the SDD's 48h/7d policy under healthy scheduling. TTL is backup. Scheduling outages can violate targets; alert and recover, do not promise guaranteed deletion deadlines. Completion fences expire after 7 days. Review TTL/index installation in the actual environment.

The extraction function caps maxInstances=3, concurrency=1 and 1GiB; other callables cap maxInstances=5, concurrency=4. Tune only after measuring. The OCR cap bounds provider attempts, not all infrastructure cost. Configure provider quotas and billing alerts. Estimate cost from current provider pricing and measured traffic; no cost forecast is claimed here.

## Incident response and rollback

1. OCR outage: set `ocrEnabled=false`, retain `enabled=true`. Text checks remain available; UI returns an unavailable error for extraction.
2. Whole-service incident: set `enabled=false`. Keep help/privacy routes online. Reservations fail closed if policy is unavailable.
3. Bad rule release: deploy the last tested artifact with its matching source catalog and `rulesVersion`. Preserve previous build/tag and lockfiles. Re-run text smoke tests; no migration of scan content exists.
4. Deletion failure: inspect content-free status/attempt count, correct IAM/service issues, allow the retry worker to resume. Never remove the deletion fence to re-enable a user. Retry cadence is 15min with capped exponential backoff.
5. Cleanup failure: restore scheduler/IAM, run the existing cleanup task, verify expired metadata has disappeared and alert has cleared. Do not rely solely on TTL.
6. Rehearse steps 1–5 on staging and attach evidence. Production owner signs scope, cloud, privacy, quality, cost and operations gates.

## Documentation sources checked during implementation

- [Firebase callable App Check enforcement](https://firebase.google.com/docs/app-check/cloud-functions)
- [Firebase Functions runtime configuration](https://firebase.google.com/docs/functions/manage-functions)
- [Firebase Authentication emulator](https://firebase.google.com/docs/emulator-suite/connect_auth)
- [Tailwind with Vite](https://tailwindcss.com/docs/installation/using-vite)

These support technical setup, not claims that this deployment has been verified.
