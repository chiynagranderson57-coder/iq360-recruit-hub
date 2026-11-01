# SRIQ-1.2 staging permission corrections — prepared, not applied

Prepared November 1, 2026 against read-only metadata from staging project
`kpatqovdotkkgvpvgccg`, the non-default branch of canonical project
`lqthjvzjkbwtggrhgpts`. No hosted permissions, policies, account rows,
passwords, configuration, deployments, or production data were changed by this
preparation. Do not run this proposal against production or merge any PR.

## Changes proposed

| Area                                     | Proposed behavior                                                                                                                                                     |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Seven existing public tables             | Remove TRUNCATE, REFERENCES, TRIGGER, and MAINTAIN from PUBLIC, anon, and authenticated. Existing SELECT access remains.                                              |
| Future public tables created by postgres | Remove the same default client grants so these capabilities are not silently restored.                                                                                |
| Readiness updates                        | Require both an active global coordinator role and an active coordinator assignment to the specific athlete, in USING and WITH CHECK.                                 |
| Readiness columns                        | Allow updates to the four completion flags and updated_at; prevent changes to id, athlete_id, and the generated score.                                                |
| Role delegation                          | Revoke browser EXECUTE on public.assign_role, including for coordinators. Leave existing roles, function body, audit behavior, and privileged owner access unchanged. |

The role-delegation restriction is an intentional workflow change for review:
the existing function allows any active coordinator to assign any app role.
No application consumer of that RPC exists at the reviewed commit. This proposal
does not supply a replacement administrator interface, enable an administrative
API, or grant service_role new access. Role changes would require an explicitly
reviewed privileged operation with the existing function's coordinator context
and audit requirements. Existing sign-ins do not require this RPC.

## Validation completed

**114 isolated PostgreSQL assertions passed**, using PGlite 0.5.14 / PostgreSQL
18.6. The harness has no hosted connection or networking. It reconstructs the
observed enums, relevant columns/defaults, constraints, functions, policies,
and ACLs from baseline.json and uses only synthetic rows. Column nullability
and application triggers are not modeled; this is an authorization test model,
not a full database backup. Staging is PostgreSQL 17.6, so hosted application
and database checks remain necessary after staging application.

Coverage includes:

- Reproduces the original update gap with a coordinator that also holds a
  non-coordinator read link to an unassigned athlete; denies that update after
  correction. An assigned coordinator can still update completion flags, and
  the database computes the score.
- Athlete, active guardian, revoked guardian, and assignment-only coordinator
  read scopes remain intact; none gains coordinator write access.
- All 56 effective table/client/capability combinations are denied, as are
  sensitive readiness column updates and browser role-assignment calls.
- Future postgres-created tables do not regain the removed default grants.
- All seven function definitions and existing service_role table privileges
  are unchanged; role, access-link, and consent row counts stay unchanged.
- Missing staging markers, unexpected UPDATE policies, and existing column
  grants stop the transaction before changing permissions.

The readiness mutation tests run inside local transactions and roll back.
No hosted TRUNCATE probe was executed. PostgreSQL privilege assertions are
used instead; this review does not claim a TRUNCATE HTTP endpoint exists.
These isolated tests use SQL role/claim contexts, not real JWT sessions.

The earlier staging browser checks at commit
`789808c8f2136ca5b6ea84229d120433fc2b3942` confirmed Athlete A, active guardian,
revoked guardian, coordinator, sign-out, and the tested account-switch flow.
Those checks happened before this proposal and do not validate these unapplied
database corrections. The existing live CI tests remain skipped without
synthetic credentials.

## Reproduce the isolated test

Install the test-only dependency outside the app checkout; do not change the
application package.json or frozen lockfile:

```sh
npm install --prefix /tmp/sriq-permission-harness --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.5.14
SRIQ_PGLITE_MODULE=file:///tmp/sriq-permission-harness/node_modules/@electric-sql/pglite/dist/index.js node db/proposals/permissions/test_permissions.mjs
```

## Staging application and recovery requirements

1. Verify the Supabase connector destination is exactly the non-default
   staging project `kpatqovdotkkgvpvgccg`; refresh the metadata snapshot and
   confirm it still matches. Synthetic account markers are only an additional
   accident guard, not cryptographic proof of the project.
2. Run the entire staging_permissions.sql transaction as the existing postgres
   owner. There is no automatic migration hook. The policy drift check makes
   a second application stop for re-review.
3. If any statement or effective-privilege assertion fails, roll back the
   transaction. Do not continue statement-by-statement or use CASCADE.
4. Recheck ACLs, column privileges, RLS, default grants, and advisors. Repeat
   real-session browser checks and staging-only coordinator mutation/denial
   tests with rollback before considering the correction verified.
5. For recovery after a committed change, capture the current state and use
   baseline.json to prepare a reviewed inverse change. The old grants and
   broad UPDATE policy are unsafe, so no automatic permissive rollback is
   provided. Do not restore them reflexively or overwrite later policy edits.

## Remaining review items

- Supabase-managed supabase_admin defaults are separate and remain unchanged;
  future objects created by that role require their own explicit grant review.
- Supabase's leaked-password protection warning is an Auth configuration
  setting; SQL permission changes do not enable it. It remains unresolved.
- The catalog reports PostgreSQL 17.6. The vendor's 17.11 security/minor
  release notice needs a separate controlled upgrade review; no upgrade is
  attempted by this permission proposal.
- Production's recursive athlete_access policy and other production findings
  remain untouched. Passing these isolated tests does not authorize merging.
- AskNavaria360 remains in the completion plan; this work adds no features.

## References

- [PostgreSQL 17 REVOKE](https://www.postgresql.org/docs/17/sql-revoke.html)
- [PostgreSQL row security and table-wide privileges](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase privileged-function advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- [PostgreSQL 17.11 Supabase release notice](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes)
