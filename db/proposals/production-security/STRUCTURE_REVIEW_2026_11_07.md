# Production structure review — 2026-11-07

Status: isolated validation improved; production application remains unapproved.

Read-only production catalog inspection captured 58 columns across the seven scoped public tables, 26 constraints, and four noninternal update triggers. No application rows or credentials were retrieved. No hosted mutation was executed.

The previous harness inherited staging column definitions, omitted NOT NULL constraints and update triggers, and substituted a score expression. The harness now uses the captured production column definitions (including nullability and exact generated expression), all 26 captured constraints, and the four timestamp triggers with their shared function definition. Foreign keys are installed after referenced primary/unique constraints.

Validation: all 126 existing isolated assertions pass with this stronger structure model. This retains the before/after recursion and unassigned readiness-write checks, browser permission denials, role RPC restrictions, drift guards, and unchanged function/data-count checks. These are existing assertions rerun against a more accurate model, not 126 new tests.

Production reports PostgreSQL 17.6; this run used PostgreSQL 18.6 via PGlite 0.5.14. Matching PostgreSQL 17 validation is still required. This snapshot covers the seven scoped application tables only, not a full hosted database clone. Managed auth internals, real JWT authentication, complete schema/function ACL and ownership fidelity, and all dependent objects are not reproduced. The earlier baseline.json still supplies policy/function/ACL modeling; production-structure-2026-11-07.json overrides its columns and constraints for the harness and supplies triggers.

Reproduce from this directory's repository root:

```sh
SRIQ_PGLITE_MODULE=file:///tmp/sriq-canonical-permission-harness/node_modules/@electric-sql/pglite/dist/index.js node db/proposals/production-security/test_proposal.mjs
```

The dependency is test-only and must be installed separately at that location. No application dependency or lockfile was modified. proposal.sql is unchanged. No deployment, merge, formal migration, or production correction occurred.
