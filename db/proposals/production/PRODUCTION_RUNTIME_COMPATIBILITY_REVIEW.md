# Production runtime compatibility review

Reviewed November 1, 2026. Result: **HOLD — source review and isolated query checks complete; full application compatibility is not approved.**

## Verified artifact and scope

GitHub access is restored for the private repository `chiynagranderson57-coder/-recruiting-command-center`. Reviewed the exact deployed commit `3ebe5088dcef984dfb4a411f4247242a4085a5c5`. Vercel readback still associates production alias https://recruiting-command-center-foundatio-chi.vercel.app with `dpl_6EAa94Wnc2M9Wp5TujNvwE3GFn15` and that commit.

Enumerated the complete, non-truncated repository tree and read all 65 relevant non-UI source/config/test files. No AGENTS.md exists in that commit's tree. Reviewed database queries, RPCs, auth/session helpers, routes, UI consumers and operator script. No production database writes, environment changes, application deployment, merge, role provisioning or credential access occurred. Review evidence is saved only on this separate branch.

## Query and workflow findings

| Production source | Database operation | Compatibility with proposed SQL |
| --- | --- | --- |
| lib/auth/authorization.ts getAuthContext | user_profiles self SELECT; active user_roles SELECT | Exact SQL projection/filter shapes pass in isolation for seven synthetic actor contexts. |
| app/(app)/athletes/page.tsx | Active athletes SELECT, ordered by last_name | Exact projection/filter/order passes permitted and denied scopes, including revoked guardian and global coordinator without assignment. |
| lib/auth/actions.ts and lib/audit.ts | Service-role audit_events INSERT during sign-out | Exact insert column shape succeeds in isolation. Actual server secret availability and browser sign-out are not retested. |
| lib/auth/roles.ts assignRole | Request-scoped authenticated assign_role RPC | **Incompatible by design:** proposed SQL revokes authenticated EXECUTE, including calls made from this server helper using the caller's JWT. Isolated call returns permission denied. Function is server-only but not a server action; no non-test UI/route consumer exists in this deployed tree. Do not call this a currently broken live button. |
| scripts/bootstrap-coordinator.ts / bootstrapInitialCoordinator | Service-role bootstrap_initial_coordinator RPC | Existing function/ACL retained by the original 305 checks. Operator command not executed; it is intended only for the initial coordinator. |
| lib/auth/authorization.ts canAccessAthlete | athlete_access SELECT access_role, filtered only by athlete_id/status, then maybeSingle | **Unsafe semantics if wired into a workflow.** Revoked guardian can still see its own active access link, so helper can return true despite athletes RLS denying profile data. Coordinator can see five access rows and maybeSingle would return an error, so helper returns false. No non-test consumer exists in this deployed tree. |

The revoked guardian test fixture has active athlete_access but revoked guardian consent, deliberately modeling why consent must be checked. Its athlete profile remains blocked by database RLS. Coordinator access-row cardinality alone demonstrates the maybeSingle mismatch; the local SQL test does not emulate PostgREST errors.

Other main navigation pages are foundation placeholders or static displays; settings fields are disabled and Add athlete is disabled. No readiness update, guardian-consent mutation or role-assignment page exists in this deployed commit. The Next.js source has no React Query guardian cache or explicit shared data cache found in the newer Lovable app. This observation does **not** establish browser account-switch safety for this older application.

## Isolation evidence

Re-ran the pinned production SQL rehearsal against its recorded metadata baseline: **305 assertions PASS**.
Extended the same disposable PostgreSQL model with exact deployed query shapes and a role-RPC denial reproduction: **328 assertions PASS total**, including the original 305 and 23 added checks. Passing means expected results/denials were reproduced, not that every workflow is compatible.

Reproduction: use the pinned PGlite dependency and set SRIQ_PGLITE_MODULE as described in SQL_PACKAGE_REVIEW.md, then run test_runtime_compatibility.mjs next to baseline.json and production_permissions.sql from commit 4ed9f197c008a874cab88346969f2cc947da42e7. The harness has no hosted connection or production credentials.

Engine: PGlite 0.3.14 / PostgreSQL 17.5 WASM; previously recorded hosted production is PostgreSQL 17.6. Synthetic auth.uid claims model database roles, not real JWT sessions. No fresh production-catalog snapshot was taken during this source retry. This is not an end-to-end test or a clean security sign-off.

## Required disposition before rollout

1. Prepare a reviewed replacement/disposition for authenticated role delegation. Preserve the intended actor authorization and atomic audit trail; do not simply restore broad authenticated EXECUTE or switch to a service key without preserving actor checks.
2. Correct or explicitly retire the unused canAccessAthlete helper before enabling any consumer; include revoked-consent denial and coordinator multi-link tests.
3. Test this exact Next.js application in an isolated staging environment, including actual sessions and account switching. Prior Lovable/Vite staging verification cannot be reused as evidence for a different app.
4. Keep the existing production plan's recovery, metadata-drift, Lovable synchronization, server-authorization and explicit execution-authorization gates in force. No production SQL, deployment, merge or access hold is authorized by this review.

Next scoped preparation: design the role-delegation compatibility correction and its tests without changing the live application.
