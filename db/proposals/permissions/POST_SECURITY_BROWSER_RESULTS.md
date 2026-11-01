# Post-security staging browser checks — November 1, 2026

All four requested real staging sign-ins and the observed browser read flows passed after the database permission corrections and leaked-password protection were enabled. This supersedes the earlier fresh-browser-testing limitation in APPLIED_STAGING_RESULTS.md for the flows described below.

## Environment

- Protected preview: https://sriq360-staging-review-9dw5frxm8-chiynagranderson57-1786.vercel.app
- Application commit: 789808c8f2136ca5b6ea84229d120433fc2b3942 (account cache isolation).
- Staging database: kpatqovdotkkgvpvgccg, PostgreSQL 17.6.
- Permission migration: 20261101115539_sriq12_staging_permission_corrections.
- Leaked-password protection enabled through the staging Supabase Email provider settings.
- Final connected security-advisor result: lints = [], zero warnings.

## Real browser observations

The user entered credentials privately through browser authentication/manual handoff. No credential values, tokens, cookies or password hashes were inspected, printed or stored. Each account identity was confirmed through the signed-in Account page.

| Account | Observed result |
| --- | --- |
| sriq12-staging-athlete-a2@example.com | Athlete A profile, student_athlete role, associated consent records, and readiness score 0 loaded. |
| sriq12-staging-guardian-active@example.com | Linked Athlete A profile with parent_guardian role, permitted consent records, and readiness score 0 loaded. |
| sriq12-staging-guardian-revoked@example.com | Profile and readiness both displayed "No records are available to your account." Guardian page showed only its revoked consent record; the previous account's active consent was absent. |
| sriq12-staging-coordinator@example.com | Assigned Athlete A profile with recruitment_coordinator role, associated consent records, and readiness score 0 loaded. |

Accounts were signed out before switching, and the coordinator was signed out at the end. After Athlete A sign-out, revisiting Guardian showed the sign-in gate and no consent records. No previous-account data appeared in the sampled subsequent-account views.

## Evidence boundaries

These are actual browser sign-ins and UI read checks, separate from the earlier 116 hosted SQL-role authorization checks. The browser checks did not execute coordinator writes, invoke role-assignment RPCs, enumerate arbitrary athlete IDs, throttle network responses, or prove every timing/interleaving scenario. Denied writes, RPC permission revocation, and sensitive column restrictions were tested in the hosted SQL transaction with rollback. Existing CI live tests were not unskipped by this work.

The application source code, production database, production Auth settings and deployments were not changed by these checks. No PR was merged or approved. Existing production policy recursion and privilege findings, managed-role defaults, and database update review still require disposition before overall merge approval. AskNavaria360 remains part of the completion plan.
