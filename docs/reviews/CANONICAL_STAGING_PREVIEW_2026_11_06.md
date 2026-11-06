# Canonical SRIQ360 isolated staging preview — November 6, 2026

## Result

Prepared and deployed the canonical iq360-recruit-hub application with the existing stacked account-cache and database-permission corrections. No PR was merged, no production deployment was created, and no hosted database mutation was performed during this preparation.

- Repository: chiynagranderson57-coder/iq360-recruit-hub
- Isolated branch: review/canonical-staging-2026-11-06
- Tested/deployed application commit: 9479bc6e0eca0d2144471b4e0e61ddc5e642cec8
- Includes PR #2 cache isolation and PR #3 permission proposal, stacked above lovable-sync.
- Vercel team: team_pIXSBPMDLLrvovYDsok8RlkZ
- Vercel project: prj_ACjmUFLwUgBNpU3pRClxoANu3kFI (sriq360-staging-review)
- Deployment: dpl_8NY31FSAYFKJESp3uhrJUiU1dwou
- READY; preview target (API target null), not production.
- Immutable sign-in: https://sriq360-staging-review-no6sh311i-chiynagranderson57-1786.vercel.app/auth
- Existing generic staging alias was not reassigned; use the immutable link above.

## Verification

| Check | Result |
| --- | --- |
| Frozen install | bun 1.3.1 install --frozen-lockfile passed; committed dependency files unchanged |
| ESLint | Passed, zero errors and six existing React Refresh warnings |
| TypeScript | tsc --noEmit passed |
| Application tests | 34 passed, four real-database session tests skipped without synthetic credentials |
| Staging Vercel build | Local Vercel-preset build passed; hosted Git-source build READY |
| Staging Auth health | HTTP 200; declared staging matches kpatqovdotkkgvpvgccg |
| Local browser bundle secret scan | No sb_secret credential literals |
| Hosted browser Supabase chunk | HTTP 200; exact staging URL and expected public key present; no sb_secret credential literal |
| Hosted sign-in | HTTP 200, canonical Sports Recruit IQ360 form |
| Hosted /record, /guardian, /readiness | HTTP 200, sign-in prompt rendered while signed out |
| Isolated permission model | 114 assertions passed, PGlite 0.5.14 / PostgreSQL 18.6; no hosted connection |
| Source integrity | git diff empty for tracked files after checks; generated .vercel build directory untracked |

Public VITE staging configuration was verified from existing Preview environment variables. The sensitive server key was neither retrieved nor decrypted. No SQL proposal was reapplied. The permission model is an isolated regression model and does not establish current hosted ACL state or real JWT behavior.

## Limits and next gate

This canonical TanStack application differs from the older Next.js Command Center used for the recent role-assignment harness. Its tested session visibility must be established separately; earlier screenshots do not prove this frontend passes account switching or consent revocation behavior.

Next: one controlled sign-in session using an existing synthetic staging account, followed by athlete/guardian/coordinator/revoked-account visibility and account-switch checks. Keep user passwords private and do not reset them unnecessarily. Do not treat the skipped live tests as passing.

Many approved capability routes remain scaffolds or read-only panels. This preview preparation does not complete their workflows, validate AskNavaria, or authorize a production release. Existing historical role-test deployments are outside this new deployment and require their separate retirement review.

## Review links

- https://github.com/chiynagranderson57-coder/iq360-recruit-hub/pull/1
- https://github.com/chiynagranderson57-coder/iq360-recruit-hub/pull/2
- https://github.com/chiynagranderson57-coder/iq360-recruit-hub/pull/3
