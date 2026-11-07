-- REVIEW PROPOSAL ONLY. DO NOT APPLY TO ANY HOSTED DATABASE.
-- Requires explicit founder approval and independent connector destination verification.
-- The review_target GUC is only an accident guard, not proof of destination/approval.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $guard$
declare
  reviewed record;
begin
  if current_user <> 'postgres' then
    raise exception 'Review requires the existing postgres owner';
  end if;
  if current_setting('sriq.review_target', true) is distinct from 'lqthjvzjkbwtggrhgpts' then
    raise exception 'Explicit review target missing; no execution authorized';
  end if;
  if (select count(*) from pg_roles where rolname in ('anon','authenticated')
      and not rolsuper and not rolbypassrls and not rolcreaterole and not rolcreatedb
      and not rolcanlogin and not rolreplication and rolinherit) <> 2
    or exists(select 1 from pg_auth_members where member in
      (select oid from pg_roles where rolname in ('anon','authenticated'))) then
    raise exception 'Browser role attributes or memberships changed; re-review';
  end if;
  if (
    -- Scoped catalog fingerprint only; never reads application rows.
    with scoped as (
      select c.oid, c.relname
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r'
        and c.relname in ('user_profiles','user_roles','athletes','athlete_access',
          'audit_events','guardian_consents','athlete_readiness')
    )
    select md5(jsonb_build_object(
      'columns', (select jsonb_agg(jsonb_build_object(
        'table',s.relname,'position',a.attnum,'name',a.attname,
        'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,
        'generated',a.attgenerated,'identity',a.attidentity,
        'default',pg_get_expr(d.adbin,d.adrelid)) order by s.relname,a.attnum)
        from scoped s join pg_attribute a on a.attrelid=s.oid
        left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
        where a.attnum>0 and not a.attisdropped),
      'constraints', (select jsonb_agg(jsonb_build_object(
        'table',s.relname,'name',c.conname,'definition',pg_get_constraintdef(c.oid),
        'validated',c.convalidated,'deferrable',c.condeferrable,'deferred',c.condeferred)
        order by s.relname,c.conname)
        from scoped s join pg_constraint c on c.conrelid=s.oid),
      'triggers', (select jsonb_agg(jsonb_build_object(
        'table',s.relname,'name',t.tgname,'enabled',t.tgenabled,
        'definition',pg_get_triggerdef(t.oid),'function',pg_get_functiondef(t.tgfoid))
        order by s.relname,t.tgname)
        from scoped s join pg_trigger t on t.tgrelid=s.oid where not t.tgisinternal),
      'policies', (select jsonb_agg(jsonb_build_object(
        'table',s.relname,'name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,
        'roles',(select array_agg(case when r=0 then 'public' else pg_get_userbyid(r)::text end order by r)
          from unnest(p.polroles) r),
        'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid))
        order by s.relname,p.polname)
        from scoped s join pg_policy p on p.polrelid=s.oid),
      'enums', (select jsonb_agg(jsonb_build_object(
        'name',t.typname,'label',e.enumlabel,'order',e.enumsortorder)
        order by t.typname,e.enumsortorder)
        from pg_type t join pg_namespace n on n.oid=t.typnamespace
        join pg_enum e on e.enumtypid=t.oid where n.nspname='public'
        and t.oid in (select a.atttypid from scoped s join pg_attribute a on a.attrelid=s.oid
          where a.attnum>0 and not a.attisdropped))
    )::text) as structure_md5
  ) is distinct from '1f5ffd87499f4b0ffe0ad50334f15b59' then
    raise exception 'Catalog structure or policy changed; re-review';
  end if;
  if to_regprocedure('private.is_assigned_athlete_coordinator(uuid)') is not null then
    raise exception 'Unexpected existing assignment helper; re-review';
  end if;
  -- Reject ownership/ACL drift before the first correction. The private schema
  -- stays owner-only; policies bind helper OIDs without exposing direct lookup.
  if not exists(select 1 from pg_namespace where nspname='private'
      and pg_get_userbyid(nspowner)='postgres' and nspacl is null) then
    raise exception 'Schema ownership or ACL changed; re-review';
  end if;
  for reviewed in select unnest(array['user_profiles','user_roles','athletes',
      'athlete_access','audit_events','guardian_consents','athlete_readiness']) as name loop
    if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relname=reviewed.name and c.relkind='r'
        and pg_get_userbyid(c.relowner)='postgres' and c.relrowsecurity and not c.relforcerowsecurity
        and array(select x::text from unnest(c.relacl) x order by x::text)
          = array['anon=arwdDxtm/postgres','authenticated=arwdDxtm/postgres',
                  'postgres=arwdDxtm/postgres','service_role=arwdDxtm/postgres']) then
      raise exception 'Table ownership or ACL changed: %; re-review', reviewed.name;
    end if;
  end loop;
  for reviewed in select * from (values
    ('private.has_athlete_access(uuid)', 'dd33d4f598fa33dc15d88db239cfc9d9',
      array['authenticated=X/postgres','postgres=X/postgres']),
    ('private.is_recruitment_coordinator()', '1b20b570e1c9bfe7983fe9517ddd00af',
      array['authenticated=X/postgres','postgres=X/postgres']),
    ('public.assign_role(uuid,public.app_role)', '457928693eb8429541b7770bfe444e74',
      array['authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres'])
    ) expected(signature,definition_md5,acl) loop
    if not exists(select 1 from pg_proc p where p.oid=to_regprocedure(reviewed.signature)
        and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef
        and p.proconfig=array['search_path=""']::text[]
        and md5(pg_get_functiondef(p.oid))=reviewed.definition_md5
        and array(select x::text from unnest(p.proacl) x order by x::text)=reviewed.acl) then
      raise exception 'Function ownership, definition or ACL changed: %; re-review', reviewed.signature;
    end if;
  end loop;
  if not exists(select 1 from pg_default_acl d join pg_namespace n on n.oid=d.defaclnamespace
      where pg_get_userbyid(d.defaclrole)='postgres' and n.nspname='public'
      and d.defaclobjtype='r'
      and array(select x::text from unnest(d.defaclacl) x order by x::text)
        = array['anon=arwdDxtm/postgres','authenticated=arwdDxtm/postgres',
                'postgres=arwdDxtm/postgres','service_role=arwdDxtm/postgres'])
    or exists(select 1 from pg_default_acl where defaclrole='postgres'::regrole
      and defaclnamespace=0 and defaclobjtype='r') then
    raise exception 'Table default ACL changed; re-review';
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
    where attrelid in ('public.user_profiles'::regclass,'public.user_roles'::regclass,
      'public.athletes'::regclass,'public.athlete_access'::regclass,
      'public.audit_events'::regclass,'public.guardian_consents'::regclass,
      'public.athlete_readiness'::regclass) and attnum>0 and not attisdropped
      and attacl is not null
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
