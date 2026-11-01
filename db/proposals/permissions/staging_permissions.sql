-- PREPARED PROPOSAL ONLY: not applied to staging or production.
-- Connector destination MUST be kpatqovdotkkgvpvgccg, the non-default staging branch.
-- This marker check is an additional accident guard, not independent proof of origin.
-- Run the complete transaction as postgres, after verifying the connector destination.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $guard$
begin
  if current_user <> 'postgres' then
    raise exception 'Review requires the existing postgres owner';
  end if;
  if not exists (
    select 1 from auth.users
    where id = '7e5bcc5e-b167-43d8-8665-3f39a6a1f99e'
      and email = 'sriq12-staging-athlete-a2@example.com'
  ) or not exists (
    select 1 from auth.users
    where id = '535b00f8-40da-4c69-9832-962dbf745df6'
      and email = 'sriq12-staging-coordinator@example.com'
  ) then
    raise exception 'Staging test-account markers missing; do not run on production';
  end if;
  if to_regprocedure('private.is_assigned_athlete_coordinator(uuid)') is null then
    raise exception 'Previously verified staging recursion fix is required';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public'
      and tablename = 'athlete_readiness' and cmd in ('UPDATE', 'ALL')) <> 1
     or not exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'athlete_readiness'
         and policyname = 'athlete_readiness_update_coordinator'
         and cmd = 'UPDATE' and roles = array['authenticated']::name[]
         and qual = 'private.is_recruitment_coordinator()'
         and with_check = 'private.is_recruitment_coordinator()'
     ) then
    raise exception 'Readiness policy changed or proposal already applied; re-review';
  end if;
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.athlete_readiness'::regclass and attacl is not null
  ) then
    raise exception 'Unexpected column grants; re-review before restricting updates';
  end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
        and c.relname in ('user_profiles','user_roles','athletes','athlete_access',
          'audit_events','guardian_consents','athlete_readiness')) <> 7 then
    raise exception 'Expected RLS-protected tables missing or changed';
  end if;
end;
$guard$;

-- These table-wide capabilities are not needed for browser application queries.
-- Never exercise TRUNCATE as a verification probe on a hosted database.
revoke truncate, references, trigger, maintain on table
  public.user_profiles, public.user_roles, public.athletes, public.athlete_access,
  public.audit_events, public.guardian_consents, public.athlete_readiness
from public, anon, authenticated;

-- Prevent the same grants recurring for future public tables created by postgres.
-- Managed supabase_admin defaults are separate and intentionally not modified here.
alter default privileges for role postgres in schema public
revoke truncate, references, trigger, maintain on tables from public, anon, authenticated;

-- Keep the current global coordinator requirement AND require an active assignment.
alter policy athlete_readiness_update_coordinator on public.athlete_readiness
to authenticated
using (
  private.is_recruitment_coordinator()
  and private.is_assigned_athlete_coordinator(athlete_id)
)
with check (
  private.is_recruitment_coordinator()
  and private.is_assigned_athlete_coordinator(athlete_id)
);

-- Preserve readiness updates while preventing record reassignment and score tampering.
revoke update on table public.athlete_readiness from public, anon, authenticated;
grant update (profile_complete, academics_complete, film_complete,
  recruiting_materials_complete, updated_at)
on public.athlete_readiness to authenticated;

-- Proposed intentional restriction: browser sessions, including coordinators,
-- cannot grant roles. Existing role rows and function body are untouched.
-- Administrative role management remains a privileged, reviewed operation;
-- this proposal does not create an admin endpoint or grant service_role access.
revoke execute on function public.assign_role(uuid, public.app_role)
from public, anon, authenticated;

do $verify$
declare
  table_name text;
  client_role text;
  capability text;
begin
  foreach table_name in array array['user_profiles','user_roles','athletes',
    'athlete_access','audit_events','guardian_consents','athlete_readiness'] loop
    foreach client_role in array array['anon','authenticated'] loop
      foreach capability in array array['TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] loop
        if has_table_privilege(client_role, 'public.' || table_name, capability) then
          raise exception 'Unexpected effective privilege: % % %', client_role, capability, table_name;
        end if;
      end loop;
    end loop;
  end loop;
  if has_column_privilege('authenticated','public.athlete_readiness','athlete_id','UPDATE')
    or has_column_privilege('authenticated','public.athlete_readiness','id','UPDATE')
    or has_column_privilege('authenticated','public.athlete_readiness','readiness_score','UPDATE')
    or has_function_privilege('authenticated','public.assign_role(uuid,public.app_role)','EXECUTE')
    or has_function_privilege('anon','public.assign_role(uuid,public.app_role)','EXECUTE') then
    raise exception 'Sensitive update or role-assignment permission still effective';
  end if;
end;
$verify$;
commit;
