# Canonical migrations (project `lqthjvzjkbwtggrhgpts`)

Source-control mirror of migrations applied directly to the canonical external
Supabase project. Never re-applied from this repository. (Kept outside
`supabase/migrations/` because that path is reserved by the Lovable tooling.)

## sriq26_guardian_consent_readiness_rls — applied externally, SQL mirror pending

Applied by BFM to `lqthjvzjkbwtggrhgpts`. The exact SQL has not been supplied
to this repo; add it verbatim as `sriq26_guardian_consent_readiness_rls.sql`
rather than reconstructing it.

Reported changes: `public.guardian_consents` (RLS), `public.athlete_readiness`
(RLS), `private.has_athlete_access` updated so `parent_guardian` access needs an
active non-revoked consent, scoped SELECT policies on the new tables.

Columns observed read-only by the app:
- guardian_consents: id, athlete_id, guardian_user_id, status, granted_at, revoked_at, created_by, created_at, updated_at
- athlete_readiness: id, athlete_id, readiness_score, updated_at
