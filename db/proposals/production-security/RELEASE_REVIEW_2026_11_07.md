# Production security candidate review — November 7, 2026

Status: isolated preparation advanced; production application remains blocked by release gates.

## Completed

- Saved prior PostgreSQL 17 evidence and the production ACL snapshot to the existing GitHub review branch at commit 4937e3c5365fb63a4b6f7c57daa1ecb0bfcd33f7, following explicit founder authorization to share the snapshot with this repository.
- Replaced inherited staging-shaped table grants with fresh production table ACLs. The earlier baseline had narrower DML grants than production, despite earlier documentation suggesting a comparison was sufficient. The current harness models the complete captured table grants.
- Preserved production's owner-only private schema ACL instead of granting client schema usage. Bound policy references still work; direct private function lookup is denied.
- Reconstructed and verified service-role function privileges, including EXECUTE on public.assign_role. Existing function bodies remain unchanged.
- Added preconditions for schema/table/function owners and ACLs, exact existing function definitions/configuration, browser-role attributes/memberships, postgres table defaults and unexpected column grants. A catalog fingerprint also detects scoped column, constraint, enum, trigger and policy drift.
- All 163 checks pass on native PostgreSQL 17.6 and PGlite PostgreSQL 17.5: 37 more assertions than the earlier 126-check harness, with a more faithful permission model and additional failure/rollback cases.
- Native tests execute as non-superuser postgres with BYPASSRLS. Client/service role flags and memberships match the inspected subset; full Supabase managed role infrastructure is not cloned.
- The final opening guard passes against production in a read-only transaction: PASS, postgres, server 17.6, transaction_read_only=on. No correction SQL was executed there.
- Reviewed the current Supabase changelog, CLI v3 breaking change, API security and RLS documentation. Verified CLI 3.0.0/help and used migration new locally to generate the candidate filename. No migration was applied or registered.

## Candidate and evidence

release-candidate/20261107100941_production_security_correction.sql is byte-identical to proposal.sql and remains outside active migration directories.

SQL SHA256: e119877e16f2021e4ac3bca2b72063befe815a026f2d66be1db07130c664331c.

Native result: native17-result-2026-11-07.json. PGlite result: pg17-acl-result-2026-11-07.json. Artifact hashes and preflight outcome: review-manifest-2026-11-07.json.

Guarded fingerprint 1f5ffd87499f4b0ffe0ad50334f15b59 matches the seven scoped production tables and isolated model. It covers the captured 58 columns, 26 constraints and four triggers plus relevant policies and enums. MD5 detects accidental catalog drift; the candidate artifact is bound with SHA256. Neither a hash nor the review_target setting proves destination or approval.

Application source, dependencies and lockfiles were untouched. Changed test-file syntax, formatting and whitespace checks passed alongside both database runtimes. Full frontend lint/typecheck/build and credential-dependent real-JWT tests were not rerun in this database-only review.

## Native reproduction

On Linux x64, install test-only packages outside the checkout:

```sh
npm install --prefix /tmp/sriq-native-pg17 --ignore-scripts --no-audit --no-fund @embedded-postgres/linux-x64@17.6.0-beta.15 pg@8.16.3
```

Restore shared-library symlinks from the registry binary package's own map:

```python
import json, os
from pathlib import Path
root = Path('/tmp/sriq-native-pg17/node_modules/@embedded-postgres/linux-x64')
for item in json.loads((root / 'native/pg-symlinks.json').read_text()):
    source = (root / item['source']).resolve()
    target = root / item['target']
    assert source.is_relative_to(root) and target.is_relative_to(root)
    if not target.exists():
        target.symlink_to(os.path.relpath(source, target.parent))
```

From the repository root:

```sh
SRIQ_PGLITE_MODULE="file://$PWD/db/proposals/production-security/native_pg17_adapter.mjs" \
SRIQ_PG17_BIN_DIR=/tmp/sriq-native-pg17/node_modules/@embedded-postgres/linux-x64/native/bin \
SRIQ_PG_MODULE=file:///tmp/sriq-native-pg17/node_modules/pg/lib/index.js \
node db/proposals/production-security/test_proposal.mjs
```

The adapter creates disposable local clusters with generated local-only passwords, listens only on 127.0.0.1, verifies engine 17.6 and non-superuser execution, and shuts clusters down after testing. It accepts no hosted connection URL or production credential. Its PGlite-compatible class name lets the same assertion suite run across both engines.

## Hosted review and remaining gates

The staging branch kpatqovdotkkgvpvgccg is present, ACTIVE_HEALTHY and queryable on PostgreSQL 17.6; its assignment helper already exists. Do not blindly apply the production-specific candidate there because staging already differs. Native tests reconstruct production's pre-correction state and rehearse the complete transaction and failure cases.

Production anon/authenticated roles have no inherited memberships and no superuser/BYPASSRLS/role-creation/database-creation/login capabilities. service_role retains BYPASSRLS and no inherited memberships. This models the inspected subset, not the full managed platform.

Canonical source inspection found no application RPC call to assign_role or the new private helper; the application uses RLS-backed data queries. Recorded dependencies are scoped SELECT/UPDATE policies using existing helpers. String-bodied SQL/PLpgSQL and application consumers require source inspection too; pg_depend is not a complete inventory by itself.

API exposure remains unverified: session settings and pg_db_role_setting did not reveal pgrst.db_schemas or db_extra_search_path. Absence does not prove private is excluded. The Supabase connector lacks API configuration/backup methods; CLI backup listing returned AccessTokenRequiredError; the dashboard requires sign-in. No backup or exposure conclusion is claimed.

Production advisors still report authenticated SECURITY DEFINER execution on public.assign_role and disabled leaked-password protection. The candidate addresses the first only when approved and applied. Password protection remains a separate configuration review. Captured supabase_admin defaults remain unchanged and require separate disposition for future-object exposure.

Before approval: verify authoritative API exposure and a usable recovery point; complete controlled real-JWT and frontend release checks; resolve/disposition managed defaults and the separate password-protection setting; then present the exact destination, hash, behavior changes and recovery package. No production application, merge, release, credential reset or Auth configuration change has occurred.

References reviewed:

- https://supabase.com/changelog.md
- https://supabase.com/changelog/supabase-cli-v3
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
