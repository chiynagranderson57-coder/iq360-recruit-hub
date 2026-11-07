# Production security proposal — prepared, not applied

November 6, 2026. Review-only SQL, not an executable release migration. No hosted DDL/DML, Auth configuration, application deployment, or PR merge occurred in this preparation.

## Changes

- Add the private user-bound assignment helper before replacing the recursive athlete_access SELECT policy.
- Limit readiness completion writes to globally active coordinators assigned to that athlete, and deny identity/score edits.
- Remove unnecessary browser table-wide privileges and postgres future-table defaults.
- Deny browser role delegation through existing assign_role. No server administration endpoint or replacement role function is added.

Existing user/access/consent rows and existing function bodies are preserved in the model. The helper is deliberately private, authenticated-only, fixed-search-path SECURITY DEFINER so its narrow current-user lookup does not recurse through the same RLS policy.

SQL SHA256: dbe194948fc4f501e1c185f5f5351bcb3face7f3641409b8ab5ea2e84ad7e6c3.

## Verification

126 isolated PostgreSQL assertions passed using PGlite 0.5.14 / PostgreSQL 18.6. The harness reproduces the production access-policy recursion error (42P17) and global coordinator readiness gap before applying the proposal to its local synthetic model. It checks preserved reads, scoped access links, null user denial, revoked guardian denial, assigned/unassigned writes, column tampering denial, browser role delegation denial, unchanged existing functions/service table privileges/row counts, future defaults, and rollback on unexpected target/policy/column-grant drift.

Reproduce with a test-only dependency outside the app checkout:

```sh
npm install --prefix /tmp/sriq-canonical-permission-harness --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.5.14
SRIQ_PGLITE_MODULE=file:///tmp/sriq-canonical-permission-harness/node_modules/@electric-sql/pglite/dist/index.js node db/proposals/production-security/test_proposal.mjs
```

No application dependency or lockfile changed. No hosted TRUNCATE or write probe was performed.

## Evidence and limits

catalog-overlay.json contains freshly read production policies and three existing function definitions/ACLs. baseline.json combines this overlay with the earlier staging-derived schema model. Table ACLs, readiness columns and defaults were compared with the read-only production catalog during this preparation. This is NOT a complete production schema clone: remaining columns, constraints, triggers, owners, dependencies, schema exposure and managed defaults need a complete production baseline before release. Column nullability and application triggers are not modeled. Existing function ACL reconstruction is simplified in the inherited harness. Hosted PostgreSQL is 17.6; this test runs 18.6. Real JWT and network behavior are not covered by these SQL contexts. These limitations prevent an application approval request now.

The sriq.review_target custom setting is only an explicit accident guard. Anyone with SQL access could set it; it proves neither destination nor approval. Keep the proposal unexecutable by default. Verify the connector project independently immediately before any separately approved application.

## Required before production approval

1. Capture and compare the complete relevant production schema/ACL/owner/trigger/dependency baseline and strengthen drift guards accordingly.
2. Reproduce against the matching PostgreSQL major version and production-shaped schema; run a controlled staging rehearsal if the exact migration sequence has not been tested there.
3. Verify the helper's private-schema ACL and ownership on the hosted system. Review managed supabase_admin defaults separately rather than altering them blindly.
4. Generate a versioned migration through the Supabase CLI after current CLI help/version review; retain the SQL hash and attach reproducible evidence.
5. Verify a usable backup/recovery point and prepare the exact destination/impact/validation approval summary. Founder approval is required before application. No approval is being requested for this incomplete release package.
6. Handle leaked-password protection as a separate reviewed Auth configuration change. No password resets are needed for SQL preparation.

## Recovery

Pre-commit failures roll back the complete transaction. After commit, pause frontend release and prefer a reviewed forward correction. Never automatically restore recursive policies, broad readiness updates, or browser role delegation. Capture the prior definitions/ACLs for diagnosis; do not use CASCADE or overwrite newer policy changes.

Production has not been secured by merely saving this proposal. The main app remains unmerged and unlaunched. See docs/reviews/PRODUCTION_SECURITY_CORRECTION_PLAN_2026_11_06.md and CANONICAL_SESSION_RESULTS_2026_11_06.md for release gates and manual screenshot limits.

References reviewed: https://supabase.com/changelog.md (including CLI v3 local-default breaking change), https://supabase.com/docs/guides/database/postgres/row-level-security.md.
# November 7 validation update

See STRUCTURE_REVIEW_2026_11_07.md for the current limitations. The harness now overlays the captured production structure (58 columns, 26 constraints, four triggers), and all 126 assertions pass. PostgreSQL 17 validation and complete hosted dependency/ACL fidelity remain pending. Historical descriptions below refer to the earlier baseline model.

