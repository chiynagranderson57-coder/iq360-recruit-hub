# SRIQ-1.2: athlete_access recursion repair — review draft

Prepared 2026-10-31 against PR #1 head `033dc127a64b29cfc6bc093c1e031be5a553f5bd`.
No hosted schema changes have been applied. This proposal is not an automatic migration.

## Cause and proposed behavior

The live `athlete_access_select_own` SELECT policy queries `athlete_access`
inside its own predicate. PostgreSQL reports `42P17` before returning access
rows, including when the app filters for the signed-in user's own rows.

The proposed SQL moves only the existing athlete-specific active coordinator
lookup into a private, bounded SECURITY DEFINER function. This privilege is
intentional for this internal lookup: the owner must inspect the assignment
table without re-entering its SELECT policy. The function accepts an athlete
ID, never a caller-supplied user ID, checks `auth.uid()`, uses an empty search
path and qualified table names, and exposes only a boolean. PUBLIC and anon
execution are revoked; only authenticated receives EXECUTE. Execute as the
existing table owner, never as a client role. Verify private is not an exposed
API schema and inspect ownership and grants before hosted application.

Own access-row visibility is preserved, including revoked status rows. Those
rows do not confer athlete-data access: existing consent/status enforcement
in `private.has_athlete_access` is unchanged. Coordinator visibility remains
limited to athletes with an active coordinator assignment. No global
coordinator authority, assignment, write permission, authentication setting,
or application logic is added. Anonymous access is explicitly excluded.

## Validation completed

Isolated PGlite 0.5.13 / PostgreSQL 18.6, synthetic fixtures only: **21 assertions passed**.
Reproduced the original 42P17 before applying the draft to that isolated instance.
Validated athlete, active/revoked guardian, active/revoked assigned coordinator,
unrelated athlete, unassigned coordinator, null identity and anonymous visibility.
Validated helper caller/assignment/status restrictions, anonymous helper denial,
blocked self-assignment, no UPDATE/DELETE authority, unchanged fixtures, and a
repeat-application guard. No network or hosted credentials are used by the test.

Run after installing a pinned `@electric-sql/pglite` separately:

```sh
node db/proposals/test_athlete_access_recursion.mjs file:///absolute/path/to/node_modules/@electric-sql/pglite/dist/index.js
```

## Remaining gates

- Review the exact target schema, helper ownership, RLS flags, schema exposure and grants.
- Test on the existing staging project using its PostgreSQL version and original policy dependencies.
- Recheck real athlete data, consent/readiness reads and negative access cases with approved test sessions.
- Complete the signed-in browser test against the intended GitHub application head.
- Review rollback and obtain founder approval before any production application.

The existing coordinator account has a global user role but no athlete-specific
assignment. This proposal intentionally does not grant it athlete access.
Also, the reviewed app's role mapping does not include database role
`student_athlete` or `recruitment_coordinator`; browser completion may still be
blocked after the database recursion is resolved. These are separate findings,
not silently included in this repair. PR #1 must remain unmerged until resolved.

## References

- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/local-development/testing/pgtap-extended

## Rollback

Rollback restores the former SELECT policy and therefore restores its known
recursion error. It is a recovery option, not a working access policy. Run only
after reviewing the deployed state and confirming no additional dependencies
on the helper. Do not use CASCADE.

```sql
begin;
alter policy athlete_access_select_own on public.athlete_access
to public
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.athlete_access mine
    where mine.athlete_id = athlete_access.athlete_id
      and mine.user_id = auth.uid()
      and mine.access_role = 'recruitment_coordinator'
      and mine.status = 'active'
  )
);
drop function private.is_assigned_athlete_coordinator(uuid);
commit;
```
