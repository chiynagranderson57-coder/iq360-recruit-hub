# Staging permission verification — November 1, 2026

**Applied to staging only; 116 hosted database checks passed, zero failed.**

## Applied change

- Project: `kpatqovdotkkgvpvgccg`, confirmed through the connected project's
  branch inventory as non-default `staging`. Canonical production is separate.
- Reviewed source: commit `9479bc6e0eca0d2144471b4e0e61ddc5e642cec8`,
  db/proposals/permissions/staging_permissions.sql. The original prepared-source
  comments are historical; this result records its subsequent staging application.
- Recorded migration: `20261101115539_sriq12_staging_permission_corrections`.
- Before application: live policies, table ACLs and function definitions/ACLs
  matched the reviewed baseline. Script environment/drift guards also passed.
- PostgreSQL version: hosted 17.6. No engine upgrade was attempted.

## Hosted verification

The [executed SQL](./hosted_verification.sql) used PostgreSQL `SET LOCAL ROLE`
and transaction-local claim contexts against existing synthetic users. These
are database-role authorization tests, not freshly authenticated JWT sessions.
The entire verification transaction ended in ROLLBACK.

| Check group                                                    | Result                                                            |
| -------------------------------------------------------------- | ----------------------------------------------------------------- |
| Seven tables × two client roles × four excessive privileges    | All 56 effective privileges denied                                |
| Row-level security                                             | Enabled on all seven public tables                                |
| Completion flags and updated_at                                | Authenticated column grants retained; RLS still restricts writers |
| Readiness id, athlete_id, generated score                      | Sensitive edits denied                                            |
| Athlete A / athlete B                                          | Each sees its own athlete and readiness; other athlete denied     |
| Active guardian                                                | Linked athlete, readiness and permitted consent history readable  |
| Revoked guardian                                               | No athlete or readiness; only its own revoked consent history     |
| Assigned coordinator                                           | Assigned athlete and readiness readable; readiness update allowed |
| Coordinator with a temporary read-only link to another athlete | SELECT allowed; UPDATE denied without coordinator assignment      |
| Archived coordinator assignment                                | UPDATE denied                                                     |
| Browser role assignment, including coordinator                 | RPC execution denied                                              |
| Anonymous requests                                             | Athlete SELECT, readiness UPDATE, role-assignment RPC denied      |
| Future public tables created by postgres                       | Removed privileges absent from default ACL                        |

Seven existing function bodies and all unrelated policies are unchanged.
Existing service_role table ACLs are unchanged; no new elevated access was granted.
The function-executable Supabase advisor warning disappeared after revocation.

## Rollback and record-integrity verification

| Record set             | Before | After verification rollback |
| ---------------------- | -----: | --------------------------: |
| Auth users             |      6 |                           6 |
| Global role rows       |      1 |                           1 |
| Athlete access links   |      5 |                           5 |
| Guardian consents      |      2 |                           2 |
| Athlete readiness rows |      2 |                           2 |

The readiness-row fingerprint matched before and after the verification
transaction. The coordinator's original active assignment was restored by
rollback, and the temporary read-only link was absent afterward. No hosted
TRUNCATE operation was attempted. No password changes or real-user data tests
were performed. No application code or deployment was changed by this task.

## Remaining limits and security items

- The earlier real browser tests passed before these database changes; fresh
  password/JWT session testing was not repeated in this step. SQL-context
  checks must not be presented as successful real-JWT tests or unskipped CI.
- [Leaked-password protection remains disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
  This separate Auth setting was not changed by SQL.
- Managed supabase_admin defaults remain outside this change. Objects created
  by that role still need an explicit privilege review.
- The previously noted PostgreSQL security update review remains separate.
- No production changes were made, and no PR was merged. Production's policy
  recursion and prior security findings remain unresolved. Overall pre-merge
  security approval remains on hold. AskNavaria360 remains in the completion plan.
