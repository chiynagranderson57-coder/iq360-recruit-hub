# Staging scope results — 2026-10-31

All five founder-created synthetic staging Auth accounts are confirmed. Applied approved staging_synthetic_fixtures.sql once on kpatqovdotkkgvpvgccg: two synthetic athletes, five access links, two consents, two readiness rows and one coordinator user role. Existing staging records preserved. No production writes.

Generated athlete A: 9d0d7e9c-05b3-4ea5-bdd9-82b761c2a22d. Athlete B: 0784d468-02a1-4c54-b1c2-fce5444b6737.

Thirty assertions passed across five authenticated SQL contexts using SET LOCAL ROLE authenticated and each actual staging account sub in request.jwt.claims. Six assertions each: A visibility, B visibility, readiness row count, access row discovery, own access row discovery and consent row count.

| Account | A | B | Readiness | Access | Own access | Consents |
|---|---|---|---|---|---|---|
| Athlete A |1|0|1|1|1|2|
| Athlete B |0|1|1|1|1|0|
| Active guardian |1|0|1|1|1|2|
| Revoked guardian |0|0|0|1|1|1|
| Coordinator |1|0|1|4|1|2|

Read-only verification transactions rolled back. Revoked guardian retains active access link but revoked consent and is denied athlete/readiness rows. Coordinator assigned to A only cannot see B. No recursion in tested paths.

These are database policy tests, NOT real password sign-ins, JWT/REST tests or browser integration tests. Passwords remain private. Remaining blockers: staging app preview and real sessions, app role mapping, revision synchronization and full security review (including previously documented existing grants and assign_role warning). No production application or PR #1 merge performed or authorized by these results.
