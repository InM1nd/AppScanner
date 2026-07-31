# §G

Private production-ready Vienna rental decision tool: safe ingestion, correct cost/score, reliable jobs/Telegram, usable desktop/mobile UI.

# §C

- Single owner; Clerk email allowlist in production; local APP_USER_EMAIL fallback.
- Next.js 16 App Router, React 19, Prisma 7/PostgreSQL, Base UI, Inngest.
- No fabricated facts. UNKNOWN stays null/UNKNOWN. importMethod truthful.
- PostgreSQL + Inngest only; no Redis/custom queue/Sentry.
- WCAG AA. Desktop primary; full mobile.

# §I

- I.auth: Clerk session protects pages/actions/user APIs; production job work only signed Inngest.
- I.score: ScoreResult totalScore 0..100 + dataCompleteness 0..100 + exclusion reason + category reasons/confidence.
- I.cost: monthlyLikelyTotal = all-in recurring known/estimated facts; housing subtotal and unknown fields remain visible.
- I.commute: mock source explicit and capped at 50% commute weight.
- I.notify: strong match requires score>=70, completeness>=70, not excluded; digest 08:00 Europe/Vienna.
- I.refresh: source disappearance changes availability, never deletes listing.

# §V

- V1: Persisted listing importMethod and every money confidence/amount pair remain truthful and valid.
- V2: Only recompute entry point writes derived cost/score; persisted cost + score update atomically or remain recoverable.
- V3: Score always 0..100; weights sum 100; hard requirement confirmed violation excludes; UNKNOWN lowers completeness only.
- V4: Mock commute never contributes more than 50% commute category; stale/invalid routes contribute zero.
- V5: User-controlled URL fetch cannot reach private/local networks; redirects revalidated; response bounded.
- V6: Refresh never deletes listing and never overwrites confirmed/manual data with UNKNOWN/null.
- V7: Same normalized canonical URL/source id creates at most one primary listing; duplicate clusters remain transitive.
- V8: Notification dedupe precedes outbound send; actionable triggers only; digest one per Vienna day.
- V9: Production pages/actions require owner auth; direct production job routes cannot execute work.
- V10: E2E only runs against database ending `_e2e`.
- V11: Mobile 320/390px has no horizontal overflow; core flows keyboard accessible and WCAG AA.

# §T

id|status|goal|cites
T1|x|foundation: git/CI/test DB/design context|V10,V11
T2|x|security: auth/job perimeter/safe fetch/env|V5,V9
T3|x|data safety: availability + sparse refresh|V2,V6
T4|x|domain: score/cost/commute/profile contracts|V1,V2,V3,V4
T5|x|duplicates + atomic persistence|V2,V7
T6|x|jobs/providers: durable bounded Inngest + health|V5,V6,V7
T7|x|Telegram actionable triggers/dedupe/reminders/digest|V8
T8|x|UX/UI: decision strip + dashboard/list/mobile/detail/import/compare/settings|V3,V4,V11
T9|>|full verification complete; external production handoff pending credentials|V1,V2,V3,V4,V5,V6,V7,V8,V9,V10,V11

# §B

id|date|cause|fix
