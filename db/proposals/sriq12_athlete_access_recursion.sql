-- REVIEW DRAFT ONLY. Not applied to any hosted database.
-- Preserve own-row visibility and athlete-specific active coordinator visibility.
-- Run as the existing table owner after review; apply this transaction atomically.
begin;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'athlete_access'
      and policyname = 'athlete_access_select_own' and cmd = 'SELECT'
      and qual like '%FROM athlete_access mine%'
  ) then
    raise exception 'Expected recursive policy missing or changed; stop and re-review';
  end if;
end;
$$;

-- This bounded internal lookup intentionally runs as the table owner to avoid
-- re-entering the same policy. The caller cannot supply another user identity.
-- It returns only a boolean for the current caller and the requested athlete.
create function private.is_assigned_athlete_coordinator(p_athlete_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.athlete_access mine
    where mine.athlete_id = p_athlete_id
      and mine.user_id = auth.uid()
      and mine.access_role = 'recruitment_coordinator'
      and mine.status = 'active'
  );
$$;

revoke all on function private.is_assigned_athlete_coordinator(uuid) from public;
revoke all on function private.is_assigned_athlete_coordinator(uuid) from anon;
grant execute on function private.is_assigned_athlete_coordinator(uuid) to authenticated;

alter policy athlete_access_select_own on public.athlete_access
to authenticated
using (
  (select auth.uid()) = user_id
  or private.is_assigned_athlete_coordinator(athlete_id)
);

commit;
