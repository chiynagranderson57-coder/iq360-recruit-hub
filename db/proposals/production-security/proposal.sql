-- REVIEW PROPOSAL ONLY. DO NOT APPLY TO ANY HOSTED DATABASE.
-- Requires explicit founder approval and independent connector destination verification.
-- The review_target GUC is only an accident guard, not proof of destination/approval.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $guard$
begin
  if current_user <> 'postgres' then
    raise exception 'Review requires the existing postgres owner';
  end if;
  if current_setting('sriq.review_target', true) is distinct from 'lqthjvzjkbwtggrhgpts' then
    raise exception 'Explicit review target missing; no execution authorized';
  end if;
  if to_regprocedure('private.is_assigned_athlete_coordinator(uuid)') is not null then
    raise exception 'Unexpected existing assignment helper; re-review';
  end if;
  if (select count(*) from pg_policies where schemaname='public' and tablename='athlete_access') <> 1
    or not exists(select 1 from pg_policies where schemaname='public' and tablename='athlete_access'
    and policyname='athlete_access_select_own' and cmd='SELECT'
    and roles=array['public']::name[] and qual = '((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM athlete_access mine
  WHERE ((mine.athlete_id = athlete_access.athlete_id) AND (mine.user_id = auth.uid()) AND (mine.access_role = ''recruitment_coordinator''::athlete_access_role) AND (mine.status = ''active''::record_status)))))') then
    raise exception 'Access policy changed; re-review';
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

-- Private, user-bound lookup avoids recursive evaluation of athlete_access RLS.
create function private.is_assigned_athlete_coordinator(p_athlete_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists (
 select 1 from public.athlete_access mine where mine.athlete_id=p_athlete_id
 and mine.user_id=auth.uid() and mine.access_role='recruitment_coordinator'
 and mine.status='active');
$$;
revoke all on function private.is_assigned_athlete_coordinator(uuid) from public,anon,authenticated,service_role;
grant execute on function private.is_assigned_athlete_coordinator(uuid) to authenticated;
alter policy athlete_access_select_own on public.athlete_access to authenticated
using ((select auth.uid()) = user_id or private.is_assigned_athlete_coordinator(athlete_id));

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
