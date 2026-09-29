# SRIQ360 Operations (SRIQ-1)

## Environment model

| Environment | Where it runs | Frontend | Backend (Supabase) | Status |
|---|---|---|---|---|
| Local development | Developer machine / Lovable sandbox (`bun run dev`) | localhost | `lqthjvzjkbwtggrhgpts` (publishable key) | Active |
| Preview (pre-release) | Lovable preview URL `id-preview--a31643c5-...lovable.app` | latest editor build | `lqthjvzjkbwtggrhgpts` | Active, not public |
| Staging | — | — | — | **Does not exist.** See blockers |
| Production | Lovable publish (not yet published) | — | `lqthjvzjkbwtggrhgpts` | **Not deployed** |

Preview is **not** isolated staging: it shares the canonical Supabase project. Only
synthetic data may be used there. A true staging tier needs a separate backend
(Supabase branch or project) — a founder decision with possible plan cost.

## Configuration and secrets

- Client config: only `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
  `VITE_LOG_LEVEL`, `VITE_FLAG_*`. See `.env.example`. These ship to browsers.
- Secrets (service-role / `sb_secret_` keys, DB passwords, E2E test passwords) live
  **only** in Lovable Project Settings → Secrets or GitHub Actions secrets. Never in
  the repo, `.env`, or any `VITE_` variable. Tests and CI fail if `sb_secret_` or
  `service_role` appears in `src/`, `.env`, or build output.

## CI

`.github/workflows/ci.yml` runs on push/PR to `main`: install (frozen lockfile), lint,
typecheck, tests, build, read-only Supabase auth health check, and a bundle secret scan.

## Feature flags

`src/lib/feature-flags.ts`. All flags default OFF; enable per environment with
`VITE_FLAG_<NAME>=true`. Flags never replace server-side authorization.

## Logging

`src/lib/logger.ts` emits JSON lines (`ts, level, scope, event, ...fields`) and
redacts credential and PII keys (email, names, tokens, passwords, DOB).

## Promotion

1. Change lands on `main` (Lovable editor or PR); CI must be green.
2. Verify on the Lovable preview with synthetic accounts only.
3. Database changes: apply to `lqthjvzjkbwtggrhgpts` by the founder in the Supabase
   SQL editor, then mirror the exact SQL in `db/migrations/`.
4. Production: founder clicks **Publish** in Lovable. The agent never publishes.

## Rollback

- App: Lovable version history → restore previous version, then re-publish; or
  `git revert` on `main` (never force-push — it rewrites Lovable history).
- Database: write a forward "down" migration, review, apply manually; migrations are
  never auto-reverted. Take a Supabase backup before any schema change.
- Feature: set the relevant `VITE_FLAG_*` to `false` and re-publish.

## Access and ownership inventory

| Asset | Identifier | Owner | Access control |
|---|---|---|---|
| Lovable project | `a31643c5-8b7d-494c-bb54-740f76a83d78` | BFM founder | Lovable workspace members |
| GitHub repo | `chiynagranderson57-coder/iq360-recruit-hub` (`main`) | chiynagranderson57-coder | GitHub collaborators |
| Supabase project | `lqthjvzjkbwtggrhgpts` | BFM founder | Supabase org members; RLS for app users |
| Secrets | Lovable Secrets / GitHub Actions secrets | BFM founder | Admins only |
| Publishing | Lovable Publish | BFM founder | Founder action only |

## Open SRIQ-1 blockers (founder action)

1. **Staging** — decide on a separate backend (Supabase branch/project) and a staging
   frontend; requires founder authorization and possibly a paid plan.
2. **CI activation** — confirm GitHub Actions is enabled on the repo and the workflow ran green.
3. **Branch protection** — require the CI check on `main` in GitHub settings.
