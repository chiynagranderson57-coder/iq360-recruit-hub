# Production security correction plan — November 6, 2026

Status: planning document only. No production SQL, configuration update, merge, or deployment is authorized by this document. It does not claim that a production-ready migration has been authored or tested.

## Finish line

A reviewed production-specific migration, reproduced against an isolated production-shaped schema, with expected access preserved and unauthorized writes denied; a documented recovery path; explicit founder approval before production application; and post-application verification before releasing the canonical frontend. Do not label the full product complete when this foundation milestone finishes.

## Verified destination and differences

Canonical product repository: chiynagranderson57-coder/iq360-recruit-hub.
Production database: lqthjvzjkbwtggrhgpts.
Staging database: kpatqovdotkkgvpvgccg.
Existing review branch: review/canonical-staging-2026-11-06.
Canonical preview source: 9479bc6e0eca0d2144471b4e0e61ddc5e642cec8.

The preceding session-results report records screen evidence and production policies. This follow-up read-only inspection confirms:
- Production lacks private.is_assigned_athlete_coordinator(uuid).
- Staging has that helper: an authenticated-user-bound active coordinator access-link lookup with an empty search_path. It is private and SECURITY DEFINER to avoid athlete_access policy recursion.
- Existing private.has_athlete_access and private.is_recruitment_coordinator definitions match across these inspected environments.
- Existing public.assign_role definitions match, but browser execution is denied in staging and allowed in production.
- Production lacks public.assign_role_from_server; staging has a SECURITY INVOKER version restricted separately by grants.
- Staging-only SQL explicitly assumes the helper already exists and requires staging synthetic account markers. It cannot be reused as a production migration.

## Minimum correction package

| Item | Required proposal | Preserve |
| --- | --- | --- |
| Recursive athlete_access SELECT | Add the reviewed private active-assignment lookup, explicitly restrict its privileges and pin search_path; replace the self-referencing policy predicate with own-user OR assigned-coordinator lookup | Existing active assignment requirement and own-access-row visibility |
| Readiness UPDATE | Require global active coordinator AND active athlete-specific coordinator assignment in USING and WITH CHECK | SELECT access and database-generated score |
| Readiness columns | Inspect effective table and column grants, then allow only completion flags and updated_at | Prevent id, athlete_id, readiness_score changes |
| Excess browser privileges | Snapshot and remove unnecessary TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on the seven reviewed public tables and postgres-owned future-table defaults | Required SELECT and legitimate application privileges |
| Browser role assignment | Revoke browser/PUBLIC execution on existing assign_role without changing current role rows | Existing audited privileged administration remains controlled |
| Password protection | Prepare a separate exact Auth configuration change and verification after current setting/plan support review | No password resets or credential collection |

Do not automatically introduce the staging server role-assignment function into production. The canonical review frontend has no role-management consumer. Keeping browser delegation disabled is the smaller correction; deploying an administrator endpoint would require its own reviewed server authentication, actor derivation, role restrictions, audit atomicity, and least-privilege grants. The Next.js staging harness is not a canonical production feature.

## Preparation steps AI can complete

1. Export a narrow catalog baseline: relevant policy definitions, helper definitions/owners/configuration/ACLs, table and column grants, default privileges, schema exposure, readiness generated expression/triggers, and row-count invariants. Avoid copying private athlete records or Auth secrets.
2. Inspect all existing policy/function consumers and dependencies before replacement. Recheck current official Supabase documentation/changelog before implementation.
3. Generate the migration file using the Supabase CLI migration command, rather than inventing a timestamp. Keep it only on an isolated review branch.
4. Write a single-transaction production-specific proposal with lock/statement timeouts and exact catalog preconditions. An unexpected policy, helper, column grant, owner, or destination must stop the change. Verify the connector project independently; a SQL comment or account marker is not proof of destination.
5. Reconstruct the inspected production schema in an isolated harness and reproduce recursion and overbroad updates before applying the proposed correction there.
6. Validate legitimate reads, revoked guardian denial, cross-athlete denial, global-but-unassigned coordinator denial, assigned coordinator completion updates, identity/score tampering denial, browser role-grant denial, and unchanged account/access/consent rows. Include null/unauthenticated contexts and missing/drifted baseline failure cases.
7. Keep existing staged cache-isolation regressions and app lint/typecheck/test/build/bundle checks passing. Use safe synthetic session automation where possible; do not ask the founder to disclose passwords.
8. Prepare recovery instructions and a concrete approval summary naming the exact migration hash, destination, behavior changes, validation evidence, and impact.

## Controlled production application — requires approval

No action in this section has been performed.

- Verify a usable current backup/recovery point and baseline before approval.
- Confirm the exact production project and approved artifact hash immediately before execution.
- Apply database corrections as their own controlled change. Do not simultaneously merge all frontend PRs or promote a preview.
- Verify effective ACLs, helper placement, policy definitions, unchanged row invariants, and security advisors. Never test TRUNCATE on hosted data.
- Verify legitimate and denied sessions with approved synthetic production accounts only if separately authorized and available. Staging screenshots cannot stand in for production verification.
- Require the reviewed canonical application source and environment configuration to pass all release gates before founder-approved frontend release.

## Recovery

A pre-commit failure must roll back the whole transaction. After commit, prefer a reviewed forward fix that retains denied unsafe privileges. Do not automatically restore recursive policies, broad readiness permissions, or browser role delegation. If legitimate access breaks, pause the frontend release and investigate from the captured baseline. Do not use DROP ... CASCADE or overwrite unrelated policy changes.

## Open limits

The manual screenshots are settled UI observations, not complete network, race, or cross-athlete tests. Guardian readiness was not captured. Existing credential-dependent CI tests remain skipped in their last recorded run. Historical Next.js test deployments require separate retirement review. Hosted database-version and managed-role-default review remain separate from this minimal correction. No implementation test is claimed for this new plan.

References:
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/database/functions
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
