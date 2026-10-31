# Staging setup for founder review

Status: prepared, not applied. Existing staging only: `kpatqovdotkkgvpvgccg`.
Never use the production project `lqthjvzjkbwtggrhgpts` for this setup.

## Requested scope

1. Verify the target still maps to the existing staging branch. Capture current
   policies, grants, helper definitions and a manifest of generated fixture IDs.
2. Give authenticated SELECT on the five existing app read tables and USAGE
   on the existing public/private schemas using `staging_read_permissions.sql`.
   Keep RLS enabled. No anonymous, write, service-role or public-schema CREATE
   privilege is granted. Review all private helper EXECUTE privileges first.
3. Provision five synthetic, confirmed staging Auth accounts with unique random
   passwords through supported Auth Admin createUser or the staging dashboard.
   Never clone production users, passwords, sessions or athlete data. The
   connected Supabase tools do not expose Auth-admin account creation; use the
   existing authenticated staging dashboard if no admin API executor is available.
   Do not place privileged API keys or passwords in GitHub, reports or chat.
4. Apply the separately reviewed recursion repair to staging only.
5. Load `staging_synthetic_fixtures.sql`. It requires exact confirmed staging
   test emails, generates athlete IDs, and aborts on an existing setup. Preserve
   the one pre-existing staging athlete and all unrelated accounts/records.
6. Run real password sign-ins against the staging issuer, close only test-created
   sessions afterward, and test browser behavior using an explicit staging build.

Account emails are explicitly listed in the fixture SQL. They represent athlete
A, athlete B, active guardian, revoked guardian and coordinator. Example.com is
not a deliverable inbox: create these as confirmed test users; do not send invitations.

## Expected access checks

| Session | Synthetic athlete A | Synthetic athlete B |
| --- | --- | --- |
| Athlete A | Allowed | Denied |
| Athlete B | Denied | Allowed |
| Active guardian | Allowed | Denied |
| Revoked guardian | Denied | Denied |
| Coordinator assigned only to A | Allowed | Denied |
| Signed out | Denied | Denied |

Also test access-row discovery without recursion, consent/readiness SELECTs,
no self-assignment and no new write authority. Access-row visibility and
athlete-data visibility differ: a revoked guardian can see their own status
but must not see the athlete or readiness data. Preserve this distinction.

## Rollback and finish line

Capture the exact initial grants, then restore that snapshot if needed; do not
blanket-revoke privileges that existed before setup. The recursion proposal's
README contains its policy rollback, which intentionally restores the known
bug. Cleanup is a separate reviewed action using the recorded fixture IDs and
verified staging account identities; never bulk-delete users or athletes.

This setup is complete only when real staging session checks pass, browser
behavior is verified and the security review is recorded. The known app role
mapping findings remain separate work; do not claim the app is complete from
database tests alone. Production application and PR #1 merge remain on hold.

Preparation validation: target schema and constraints inspected read-only.
Permissions SQL validated inside a rolled-back staging transaction. Fixture
SQL's missing-account guard validated with no retained data changes. Positive
fixture creation and real sessions remain pending account provisioning.
