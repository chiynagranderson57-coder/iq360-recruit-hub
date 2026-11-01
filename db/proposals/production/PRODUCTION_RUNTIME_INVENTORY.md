# Production application inventory — SRIQ360 Phase 2

Verified November 1, 2026. Read-only application, hosting, repository, and database-log inspection. No database correction, production deployment, promotion, merge, or application configuration change performed.

## Identified production consumer

| Item | Verified value |
| --- | --- |
| Hosting project | Vercel `recruiting-command-center-foundation-rf` |
| Project ID | `prj_zl1QlJWk3wqJzAOMTCsk2JMFAr4M` |
| Production alias | https://recruiting-command-center-foundatio-chi.vercel.app |
| Deployment | `dpl_6EAa94Wnc2M9Wp5TujNvwE3GFn15`, READY, target production |
| Immutable deployment hostname | `recruiting-command-center-foundation-l9a3nohur.vercel.app` |
| Source repository (deployment metadata) | `chiynagranderson57-coder/-recruiting-command-center` |
| Source branch and commit | `main`, `3ebe5088dcef984dfb4a411f4247242a4085a5c5` |
| Framework | Next.js |
| Rendered title | Recruiting Command Center |
| Backend | `https://lqthjvzjkbwtggrhgpts.supabase.co` |

Evidence:
- Vercel project/deployment/domain records associate the production alias with the READY production deployment above.
- HTTP GET of the production alias and /auth/login returned 200 and the Recruiting Command Center page.
- The served login page includes /_next/static/immutable/chunks/36iise74bi0-s.js. A read-only GET of this deployed JavaScript returned 200 and contains the exact canonical production Supabase URL above.
- The project's NEXT_PUBLIC_SUPABASE_URL independently matches that URL, with production in its configured targets. Only this public backend URL was decrypted; no server credentials were read.
- Homepage states foundation build. Its security marketing text is not evidence of effective authorization.
- Hosting protection is enabled for all except custom domains. These response checks used the connected account's authorized fetch capability, which can create/reuse temporary share access. They do not establish anonymous public accessibility.
- Source repository fetch at the deployment commit returned 404 through the GitHub connector. Deployed artifact identity/backend are verified; source-level compatibility is not yet reviewed.

## Other applications distinguished

| Application | Finding |
| --- | --- |
| Lovable IQ360 Recruit Hub, project a31643c5-8b7d-494c-bb54-740f76a83d78 | Control plane reports is_published=false, no published URL, preview https://id-preview--a31643c5-8b7d-494c-bb54-740f76a83d78.lovable.app, latest editor commit a0555288c2c434add134a2cd8bfabb67b947aa3f. Repository operations notes describe this preview as production-database-bound. This is not the Vercel production application identified above. |
| Vercel sriq360-staging-review | Latest READY deployment dpl_Fw7t1hdd1o4tvshbDzHNjiEoy3YR is preview (target null), source iq360-recruit-hub commit 789808c8f2136ca5b6ea84229d120433fc2b3942. Its only production-target attempt was CANCELED. Existing staging evidence establishes the isolated staging backend. |
| Vercel recruiting-command-center-foundation | Separate READY production deployment dpl_CELpaZFDzMro17y3x7z5WbRxooXT. Alias https://recruiting-command-center-foundatio.vercel.app renders Performance Command / Recruiting Success Program. Current public backend configuration points to htjyocqrflbzbkomjaco, a different database. Do not confuse it with the canonical production consumer. |

Scope: all three projects returned by the connected Vercel team's project inventory, the known Lovable project, and iq360-recruit-hub repository records. Other accounts or unconnected hosts are not excluded. Production edge logs for the default last-24-hour window contained five requests with no origin/referer, so those logs cannot establish browser usage volume.

## Rollout implication

HOLD production correction and merge. Production database changes may affect the existing Next.js application from -recruiting-command-center as well as the production-bound Lovable preview. Successful iq360-recruit-hub CI and staging sessions do not validate the existing Next.js application.

Next required review: obtain read access to the deployed source (or inspect sufficient deployed behavior without writes), inventory its queries/RPC calls against the proposed permission changes, and test that application against an isolated database matching the production correction. Do not substitute publishing the Lovable application for compatibility verification. AskNavaria360 remains in the wider completion plan; this inventory does not verify it.
