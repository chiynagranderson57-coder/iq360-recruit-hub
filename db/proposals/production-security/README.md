# Production security correction — review candidate, not applied

Latest review: [RELEASE_REVIEW_2026_11_07.md](RELEASE_REVIEW_2026_11_07.md).

All 163 isolated checks pass on native PostgreSQL 17.6 as a non-superuser postgres owner, and on PGlite 0.3.14 / PostgreSQL 17.5. Production reports 17.6. The catalog-only production preflight passes inside a read-only transaction. No hosted correction, Auth change, deployment, migration-history change, or merge has occurred.

## Candidate behavior

- Replace recursive athlete-access lookup with a private, user-bound active-assignment helper.
- Require an active global coordinator role AND an active athlete-specific coordinator assignment for readiness writes.
- Restrict readiness updates to completion flags and updated_at; preserve generated score and identity columns.
- Remove unnecessary browser TRUNCATE, REFERENCES, TRIGGER and MAINTAIN privileges, including postgres future-table defaults.
- Deny browser role delegation through existing assign_role, preserving its body, owner and service-role grant.

Private schema usage remains owner-only. Authenticated function EXECUTE lets bound policies use the helper; a direct client lookup of the private function remains denied. No server administration endpoint is introduced.

## Files and integrity

proposal.sql and release-candidate/20261107100941_production_security_correction.sql are byte-identical. The candidate filename was generated with Supabase CLI 3.0.0 after reviewing current help. It is deliberately outside active migration directories.

SQL SHA256: e119877e16f2021e4ac3bca2b72063befe815a026f2d66be1db07130c664331c.

review-manifest-2026-11-07.json records artifact hashes and the hosted read-only preflight. preflight.sql contains only the opening catalog guard in a read-only transaction; it does not apply the correction. structure_fingerprint.sql fingerprints scoped columns, constraints, triggers, policies and enums without reading application rows.

## Reproduce the isolated checks

```sh
npm install --prefix /tmp/sriq-pg17-validation --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.3.14
SRIQ_PGLITE_MODULE=file:///tmp/sriq-pg17-validation/node_modules/@electric-sql/pglite/dist/index.js node db/proposals/production-security/test_proposal.mjs
```

Native PostgreSQL 17.6 reproduction is documented in the latest review. No application dependency or lockfile changed.

## Remaining release gates

1. Verify private is excluded from hosted Data API exposure; SQL-session and role/database settings did not reveal authoritative exposed-schema configuration.
2. Verify a usable current backup/recovery point. CLI backup read needs authentication; the dashboard is at sign-in.
3. Complete controlled real-JWT session verification and canonical frontend release checks. SQL claim simulation and historical screenshots are not substitutes.
4. Review managed supabase_admin defaults separately. They remain unchanged; broad managed defaults remain a residual issue for future objects.
5. Review leaked-password protection separately. The production advisor still reports it disabled, and still reports authenticated EXECUTE on public.assign_role because this correction has not been applied.
6. Assemble the exact destination, hash, impact and recovery approval summary. Explicit founder approval is required before production application; no application approval is requested for this incomplete package.

Historical structure and PG17 reviews retain earlier counts, hashes and modeling limitations. This README and RELEASE_REVIEW_2026_11_07.md describe the current candidate.

## Recovery

Pre-commit failures roll back the whole transaction. After commit, pause frontend release and prefer a reviewed forward correction. Do not automatically restore recursive policies, broad readiness updates or browser role delegation. Do not use CASCADE or overwrite newer changes. Verify a usable recovery point before any application approval.
