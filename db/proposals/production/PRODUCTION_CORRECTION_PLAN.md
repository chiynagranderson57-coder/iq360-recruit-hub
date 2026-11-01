# SRIQ360 Phase 2 — production correction plan for review
Prepared November 1, 2026. **PLAN ONLY — nothing applied to production.**
Status: ready for review; not authorization to execute, merge, publish, upgrade, or deploy.

## Decision requested when this plan is reviewed

Approve the correction scope below as the basis for a production-specific execution package. Plan approval alone must not trigger execution. The guarded SQL, verified recovery point, compatibility review, and a specific production-change authorization must exist before execution. No approval is requested or implied by creating this document.

## Verified current state

| Surface | Observed state |
| --- | --- |
| Canonical production database | lqthjvzjkbwtggrhgpts; PostgreSQL 17.6; seven public tables owned by postgres, all with RLS enabled |
| Staging database | kpatqovdotkkgvpvgccg; tested corrections applied; final security advisor has zero warnings |
| Production advisor | Two warnings: signed-in execution of public.assign_role; leaked-password protection disabled |
| Production athlete_access SELECT | Existing policy queries athlete_access again, retaining the known recursion defect |
| Production readiness UPDATE | USING and WITH CHECK test a global coordinator role, without athlete-specific coordinator assignment |
| Production table privileges | anon, authenticated, and service_role each have SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, and MAINTAIN on all seven public tables |
| Production column grants | No explicit column grants observed |
| Production function ACLs | assign_role has authenticated and service_role EXECUTE; bootstrap and signup-trigger functions have service_role EXECUTE; these differ from staging |
| Production private schema | No USAGE for authenticated or anon; do not copy staging schema grants without proving need |
| Production defaults | postgres and managed supabase_admin defaults remain broad; postgres public function defaults also grant client EXECUTE |
| PR #1 | Open, unmerged; lovable-sync to main; head 033dc127a64b29cfc6bc093c1e031be5a553f5bd; CI run #10 success |
| PR #2 | Draft, unmerged; account cache correction to lovable-sync; head 789808c8f2136ca5b6ea84229d120433fc2b3942; CI run #11 success |
| CI test boundary | 34 unit tests passed for cache fix; four live database tests were skipped, not passed |
| Lovable project | a31643c5-8b7d-494c-bb54-740f76a83d78; unpublished; reported latest commit a0555288c2c434add134a2cd8bfabb67b947aa3f, different from reviewed PR heads |
| Backups/recovery | A currently usable production restore point has not been verified in this planning task |

Production was inspected through read-only SQL and security advisors. No production role impersonation, test write, password change, Auth setting change, or DDL was performed.

## Evidence already completed — do not restart

- Cache-isolation application fix: five new privacy regressions, 34 total unit tests, lint, type checking, build, and GitHub CI passed.
- Permission proposal: 114 isolated PostgreSQL checks passed.
- Staging application: migration 20261101115539_sriq12_staging_permission_corrections recorded; 116 hosted database checks passed, all test mutations rolled back.
- Staging leaked-password protection: enabled and independently verified by a clean security-advisor result.
- Real staging sessions after all security changes: Athlete A, active guardian, revoked guardian, and coordinator browser read flows passed. Signed-out/private views stayed hidden in the tested transitions.
- Revoked guardian saw no athlete profile or readiness, and only its own revoked consent history.
- These browser checks do not prove every timing scenario or arbitrary-ID API request. SQL role/claim-context tests are distinct from real JWT sessions.
- See [post-security browser evidence](../permissions/POST_SECURITY_BROWSER_RESULTS.md) and [hosted database evidence](../permissions/APPLIED_STAGING_RESULTS.md). Their older warning/browser-limit text is superseded by the later post-security evidence where stated.

## Proposed production corrections

### 1. Remove recursive access-policy evaluation

Create a bounded private.is_assigned_athlete_coordinator(uuid) lookup with the same tested predicate: current auth.uid(), matching athlete, recruitment_coordinator access_role, active link. The lookup may run as the existing owner only to avoid re-entering the same table policy. Pin an empty search_path and fully qualify referenced objects. Never accept a caller-supplied user ID.

Explicitly revoke inherited/default EXECUTE from PUBLIC, anon, and service_role on this new helper, then grant authenticated only. Production's broad function defaults make this explicit ACL step essential. Preserve the existing service_role ACLs on existing functions and tables.

Change athlete_access_select_own to authenticated, allowing the caller's own link or an active coordinator assignment for that athlete. Preserve own-link visibility, including the link needed to explain a revoked guardian's status; actual athlete/readiness access must still enforce consent.

Do not alter the existing has_athlete_access consent predicate, disable RLS, use a service key in the client, or replace scoped checks with a global coordinator allowance. Do not assume private schema USAGE must be added: test the production-like policy expression first, because stored RLS expressions and direct schema calls differ.

### 2. Remove unnecessary table-wide capabilities

For exactly user_profiles, user_roles, athletes, athlete_access, audit_events, guardian_consents, and athlete_readiness, revoke TRUNCATE, REFERENCES, TRIGGER, and MAINTAIN from PUBLIC, anon, and authenticated.

Preserve existing service_role grants and current legitimate SELECT/INSERT/UPDATE/DELETE grants except for the specific readiness UPDATE restriction below. This avoids silently breaking profile self-service or audit-event submission. Continue enforcing those operations through their current RLS policies.

Remove the same four client capabilities from postgres-created future public-table defaults. Do not blindly copy staging ACLs: staging began with substantially fewer DML grants. Do not modify managed supabase_admin defaults in this correction; document their separate review requirement and explicitly review every newly created object's ACL.

Do not test hosted TRUNCATE. Verify effective privileges with catalog functions. These grants establish unnecessary database capability; this plan does not claim an arbitrary TRUNCATE HTTP endpoint exists.

### 3. Restrict readiness writes

Require BOTH an active global coordinator role and an active coordinator assignment to the exact athlete in USING and WITH CHECK.

Revoke table-level readiness UPDATE from PUBLIC, anon, and authenticated; grant authenticated UPDATE only on profile_complete, academics_complete, film_complete, recruiting_materials_complete, and updated_at. Keep existing SELECT policies and generated-score calculation. Prevent editing id, athlete_id, and readiness_score. Existing service_role UPDATE remains unchanged.

### 4. Restrict client role delegation

Revoke EXECUTE on public.assign_role(uuid, public.app_role) from PUBLIC, anon, and authenticated. Preserve its existing service_role/owner privileges, body, existing roles, and audit behavior.

**Intentional workflow change for review:** even coordinators would no longer grant roles through browser RPC. No current application consumer of this RPC was found at the reviewed code, but external/manual consumers have not been inventoried. Before execution, confirm the actual role-management operator and workflow. The existing function still requires a valid active coordinator actor; service_role possession alone does not make that guard succeed. Do not remove the guard or create an unrestricted replacement admin endpoint.

### 5. Enable production leaked-password protection

After separately verifying the dashboard's project reference is production, enable only Prevent use of leaked passwords in the Email provider settings. Record before/after state and confirm the advisor warning clears.

Do not change user passwords, email verification, providers, OTP settings, session lifetimes, minimum password length, or unrelated settings in this step. Do not test weak-password rejection by changing a production user's password. Existing passwords may surface a weak-password warning under stronger settings; a controlled test-account sign-in check and a recovery/support path are required.

## Required gates before executing any production change

| Gate | Required evidence |
| --- | --- |
| Production-specific SQL | Prepared against the refreshed production catalog, with explicit project selection, expected-policy/helper checks, no staging fixture markers, no hardcoded new generated row IDs, drift rejection, lock/statement timeouts, atomic execution, and effective-privilege assertions |
| Recovery | Confirm an accessible, current backup or supported restore point; record its timestamp, recovery scope, operator, and expected downtime. Capture pre-change policies, function definitions/ACLs, table/column/schema/default ACLs. A metadata snapshot alone is not a data backup. |
| Rehearsal | Run the exact production-adapted SQL against an isolated model of production's broad table/default/function grants and lack of private schema USAGE. Reuse existing tests; add only the production-specific cases. Preserve service privileges. |
| Role-delegation decision | Confirm loss of coordinator browser grants is intended and document a workable privileged role-management procedure preserving actor checks and auditing |
| Auth/operator readiness | Confirm the authorized operator can access the production Auth settings and approved synthetic accounts can be used for read-only smoke tests without password resets |
| Runtime inventory | Identify the actual deployed/serving application and production connection. Lovable is reported unpublished, so do not invent a live deployment or assume the reviewed GitHub head is serving users. |
| Synchronization | Resolve or explain Lovable's different commit; prove the eventual release artifact includes the cache fix and shared authentication/backend resolver |
| Authorization path | Current UI requests rely on database RLS. decideAthleteAccess and requireAppAuth exist but have no non-test consumers in the reviewed app. Reconcile the AGENTS server-enforcement rule before claiming full application authorization compliance; unit tests alone do not close this gap. |
| Explicit permission | Obtain approval of the final production-specific change package and execution scope. A merge, application deployment, engine upgrade, fixture creation, or recovery action requires its own applicable authorization. |

The existing staging SQL contains staging-account guards and expects a helper already present there. It is not a production script. No runnable production migration or production change has been issued by this plan.

## Controlled execution sequence after those gates and authorization

1. Refresh identity, catalog snapshot and advisors. Stop if the expected production project, policies, ACLs or helper state differs from the reviewed package.
2. Apply only the approved database restrictions in one guarded transaction through the production connector. Check effective privileges and RLS before completion. On an error, roll back the whole transaction; do not continue statement-by-statement or use CASCADE.
3. Apply the approved leaked-password setting separately in the exact production dashboard. It is an Auth configuration action, not SQL, and cannot share the database transaction.
4. Read-only postchecks: no recursive policy; expected client capability denials; narrow readiness column grants; correct assigned-coordinator predicates; preserved service access, unrelated policies and function bodies; row counts/integrity compared to the pre-change snapshot; advisor results.
5. Use only approved production synthetic sessions for non-destructive read checks: athlete own/other scope, active guardian allowed, revoked guardian blocked, coordinator assigned scope, sign-out and account switching. Do not copy staging mutation/fixture SQL into production.
6. Pause for the release review. Only with separate authorization, integrate the cache fix into the intended application branch, rerun checks on the new exact head, and verify Lovable synchronization. Do not merge PR #1 based on the old green head or staging results alone.
7. Only after every required check/review passes and explicit merge authorization exists may PR #1 be considered for merge. Publishing/deployment remains a separate decision.

## Acceptance criteria and stopping conditions

The production correction is complete only when the approved changes are recorded, no account/data changes outside that scope occurred, the recursion defect is absent, effective permissions match the approved matrix, allowed/denied production synthetic reads pass, and both targeted advisor warnings clear or have a documented approved disposition.

Stop on baseline drift, unexpected data changes, loss of intended reads/writes, missing recovery readiness, wrong project, new advisor findings, or an unverified runtime. Do not broaden RLS or service-key access to make a test pass.

Database transaction failure: rollback without persisting partial changes. A later compatibility problem requires a reviewed targeted repair; do not automatically restore the recursive policy, broad role RPC, or unsafe client privileges. Restore from backup only for an actual recovery need with explicit authorization and an impact assessment. Keep the application release on hold while an unexpected authorization problem is investigated.

## Separate tracked items — no automatic changes

- PostgreSQL 17.6 security/minor-update review: vendor 17.11 notice needs assessment and a separate staged upgrade plan. Do not bundle an engine upgrade into this permission correction.
- Managed supabase_admin defaults and future-object creation practices need an explicit disposition.
- Full server-authorization architecture alignment and any supported role mapping need their own scoped correction if confirmed required. Do not silently rewrite application logic within the database patch.
- AskNavaria360 remains the Athlete Resource & Intelligence Assistant and stays in the completion plan; this security work adds no features.
- Overall security/merge approval remains **HOLD**. This plan is not a clean security sign-off.

## References

- [Staging evidence branch](https://github.com/chiynagranderson57-coder/iq360-recruit-hub/tree/sriq12/staging-permissions-applied-evidence)
- [PR #1](https://github.com/chiynagranderson57-coder/iq360-recruit-hub/pull/1)
- [PR #2 cache fix](https://github.com/chiynagranderson57-coder/iq360-recruit-hub/pull/2)
- [PR #3 permission proposal](https://github.com/chiynagranderson57-coder/iq360-recruit-hub/pull/3)
- [Privileged-function advisor remediation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Password-security remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- [PostgreSQL REVOKE](https://www.postgresql.org/docs/17/sql-revoke.html)
- [PostgreSQL 17.11 vendor notice](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes)
