-- REVIEW ONLY. Not applied to production.
-- Exact intended connector destination: lqthjvzjkbwtggrhgpts.
-- Execution authorization, recovery readiness, runtime compatibility and actor workflow
-- must be approved separately. The opt-in GUC is an accident guard, NOT proof of
-- authorization or project identity. It is deliberately NOT set by this file.
-- Contains no production/staging user identifiers, passwords, or test fixtures.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $guard$
begin
 if current_setting('sriq.approved_project_ref',true) is distinct from 'lqthjvzjkbwtggrhgpts' then
  raise exception 'Production project opt-in missing; package is review-only by default';
 end if;
 if current_user<>'postgres' or current_setting('server_version_num')::int/10000<>17 then
  raise exception 'Expected PostgreSQL 17 postgres owner';
 end if;
 if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r')<>7 then raise exception 'Public table inventory drift'; end if;
 if (select jsonb_agg(to_jsonb(x) order by typname) from(select t.typname,array_agg(e.enumlabel order by e.enumsortorder) labels from pg_type t join pg_enum e on e.enumtypid=t.oid join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' group by t.typname)x) is distinct from '[{"labels":["student_athlete","parent_guardian","recruitment_coordinator"],"typname":"app_role"},{"labels":["student_athlete","parent_guardian","recruitment_coordinator"],"typname":"athlete_access_role"},{"labels":["active","archived"],"typname":"record_status"}]'::jsonb then raise exception 'Enum drift'; end if;
 if to_regprocedure('private.is_assigned_athlete_coordinator(uuid)') is not null then
  raise exception 'Helper already exists; already applied or baseline changed';
 end if;
 if to_regprocedure('private.has_athlete_access(uuid)') is null or pg_get_functiondef(to_regprocedure('private.has_athlete_access(uuid)')) is distinct from 'CREATE OR REPLACE FUNCTION private.has_athlete_access(p_athlete_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''''
AS $function$
  select exists (
    select 1 from public.athlete_access aa
    where aa.athlete_id = p_athlete_id
      and aa.user_id = auth.uid()
      and aa.status = ''active''
      and (
        aa.access_role <> ''parent_guardian''
        or exists (
          select 1 from public.guardian_consents gc
          where gc.athlete_id = p_athlete_id
            and gc.guardian_user_id = auth.uid()
            and gc.status = ''active''
            and gc.revoked_at is null
        )
      )
  );
$function$
' or (select array(select unnest(proacl::text[]) order by 1) from pg_proc where oid=to_regprocedure('private.has_athlete_access(uuid)')) is distinct from array['authenticated=X/postgres','postgres=X/postgres']::text[] then raise exception 'Function definition/ACL drift: has_athlete_access'; end if;
 if to_regprocedure('private.is_recruitment_coordinator()') is null or pg_get_functiondef(to_regprocedure('private.is_recruitment_coordinator()')) is distinct from 'CREATE OR REPLACE FUNCTION private.is_recruitment_coordinator()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''''
AS $function$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = ''recruitment_coordinator''
      and ur.status = ''active''
  );
$function$
' or (select array(select unnest(proacl::text[]) order by 1) from pg_proc where oid=to_regprocedure('private.is_recruitment_coordinator()')) is distinct from array['authenticated=X/postgres','postgres=X/postgres']::text[] then raise exception 'Function definition/ACL drift: is_recruitment_coordinator'; end if;
 if to_regprocedure('public.assign_role(uuid, app_role)') is null or pg_get_functiondef(to_regprocedure('public.assign_role(uuid, app_role)')) is distinct from 'CREATE OR REPLACE FUNCTION public.assign_role(p_user_id uuid, p_role app_role)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
begin
  if not private.is_recruitment_coordinator() then
    raise exception ''not_authorized''
      using detail = ''Only an active recruitment coordinator may assign roles.'';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception ''unknown_user'' using detail = ''No auth user with the given id.'';
  end if;

  insert into public.user_roles (user_id, role, status, created_by)
  values (p_user_id, p_role, ''active'', auth.uid())
  on conflict (user_id, role) do update
    set status = ''active'', updated_at = now();

  insert into public.audit_events
    (actor_user_id, event_type, entity_type, entity_id, action, source, metadata)
  values
    (auth.uid(), ''role.assigned'', ''user_role'', p_user_id::text, ''grant'', ''app'',
     jsonb_build_object(''role'', p_role, ''target_user_id'', p_user_id));

  return p_user_id;
end;
$function$
' or (select array(select unnest(proacl::text[]) order by 1) from pg_proc where oid=to_regprocedure('public.assign_role(uuid, app_role)')) is distinct from array['authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[] then raise exception 'Function definition/ACL drift: assign_role'; end if;
 if to_regprocedure('public.bootstrap_initial_coordinator(uuid)') is null or pg_get_functiondef(to_regprocedure('public.bootstrap_initial_coordinator(uuid)')) is distinct from 'CREATE OR REPLACE FUNCTION public.bootstrap_initial_coordinator(p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
declare
  v_existing int;
begin
  -- One-time guard: only permitted while NO active coordinator exists.
  select count(*) into v_existing
  from public.user_roles
  where role = ''recruitment_coordinator'' and status = ''active'';

  if v_existing > 0 then
    raise exception ''bootstrap_already_completed''
      using detail = ''An active recruitment coordinator already exists; use assign_role instead.'';
  end if;

  -- Target must be a real, existing auth user (identified by ID, not name).
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception ''unknown_user'' using detail = ''No auth user with the given id.'';
  end if;

  insert into public.user_roles (user_id, role, status, created_by)
  values (p_user_id, ''recruitment_coordinator'', ''active'', p_user_id)
  on conflict (user_id, role) do update
    set status = ''active'', updated_at = now();

  insert into public.audit_events
    (actor_user_id, event_type, entity_type, entity_id, action, source, metadata)
  values
    (p_user_id, ''role.bootstrapped'', ''user_role'', p_user_id::text, ''grant'', ''system'',
     jsonb_build_object(''role'', ''recruitment_coordinator'', ''reason'', ''initial_coordinator_bootstrap''));

  return p_user_id;
end;
$function$
' or (select array(select unnest(proacl::text[]) order by 1) from pg_proc where oid=to_regprocedure('public.bootstrap_initial_coordinator(uuid)')) is distinct from array['postgres=X/postgres','service_role=X/postgres']::text[] then raise exception 'Function definition/ACL drift: bootstrap_initial_coordinator'; end if;
 if to_regprocedure('public.handle_new_user()') is null or pg_get_functiondef(to_regprocedure('public.handle_new_user()')) is distinct from 'CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
begin
  insert into public.user_profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> ''full_name'', null)
  )
  on conflict (id) do nothing;
  return new;
end;
$function$
' or (select array(select unnest(proacl::text[]) order by 1) from pg_proc where oid=to_regprocedure('public.handle_new_user()')) is distinct from array['postgres=X/postgres','service_role=X/postgres']::text[] then raise exception 'Function definition/ACL drift: handle_new_user'; end if;
 if to_regprocedure('public.set_updated_at()') is null or pg_get_functiondef(to_regprocedure('public.set_updated_at()')) is distinct from 'CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
' or (select array(select unnest(proacl::text[]) order by 1) from pg_proc where oid=to_regprocedure('public.set_updated_at()')) is distinct from array['=X/postgres','anon=X/postgres','authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[] then raise exception 'Function definition/ACL drift: set_updated_at'; end if;
 if (select jsonb_agg(to_jsonb(p) order by p.tablename,p.policyname) from pg_policies p where schemaname='public') is distinct from '[{"cmd":"SELECT","qual":"((auth.uid() = user_id) OR (EXISTS ( SELECT 1\n   FROM athlete_access mine\n  WHERE ((mine.athlete_id = athlete_access.athlete_id) AND (mine.user_id = auth.uid()) AND (mine.access_role = ''recruitment_coordinator''::athlete_access_role) AND (mine.status = ''active''::record_status)))))","roles":["public"],"tablename":"athlete_access","permissive":"PERMISSIVE","policyname":"athlete_access_select_own","schemaname":"public","with_check":null},{"cmd":"SELECT","qual":"private.has_athlete_access(athlete_id)","roles":["authenticated"],"tablename":"athlete_readiness","permissive":"PERMISSIVE","policyname":"athlete_readiness_select_scoped","schemaname":"public","with_check":null},{"cmd":"UPDATE","qual":"private.is_recruitment_coordinator()","roles":["authenticated"],"tablename":"athlete_readiness","permissive":"PERMISSIVE","policyname":"athlete_readiness_update_coordinator","schemaname":"public","with_check":"private.is_recruitment_coordinator()"},{"cmd":"SELECT","qual":"private.has_athlete_access(id)","roles":["public"],"tablename":"athletes","permissive":"PERMISSIVE","policyname":"athletes_select_scoped","schemaname":"public","with_check":null},{"cmd":"UPDATE","qual":"(EXISTS ( SELECT 1\n   FROM athlete_access aa\n  WHERE ((aa.athlete_id = athletes.id) AND (aa.user_id = auth.uid()) AND (aa.access_role = ''recruitment_coordinator''::athlete_access_role) AND (aa.status = ''active''::record_status))))","roles":["public"],"tablename":"athletes","permissive":"PERMISSIVE","policyname":"athletes_update_scoped","schemaname":"public","with_check":"(EXISTS ( SELECT 1\n   FROM athlete_access aa\n  WHERE ((aa.athlete_id = athletes.id) AND (aa.user_id = auth.uid()) AND (aa.access_role = ''recruitment_coordinator''::athlete_access_role) AND (aa.status = ''active''::record_status))))"},{"cmd":"INSERT","qual":null,"roles":["public"],"tablename":"audit_events","permissive":"PERMISSIVE","policyname":"audit_events_insert_self","schemaname":"public","with_check":"(auth.uid() = actor_user_id)"},{"cmd":"SELECT","qual":"((auth.uid() = actor_user_id) OR ((athlete_id IS NOT NULL) AND private.has_athlete_access(athlete_id)))","roles":["public"],"tablename":"audit_events","permissive":"PERMISSIVE","policyname":"audit_events_select_scoped","schemaname":"public","with_check":null},{"cmd":"SELECT","qual":"((guardian_user_id = ( SELECT auth.uid() AS uid)) OR private.has_athlete_access(athlete_id))","roles":["authenticated"],"tablename":"guardian_consents","permissive":"PERMISSIVE","policyname":"guardian_consents_select_scoped","schemaname":"public","with_check":null},{"cmd":"INSERT","qual":null,"roles":["public"],"tablename":"user_profiles","permissive":"PERMISSIVE","policyname":"user_profiles_insert_own","schemaname":"public","with_check":"(auth.uid() = id)"},{"cmd":"SELECT","qual":"(auth.uid() = id)","roles":["public"],"tablename":"user_profiles","permissive":"PERMISSIVE","policyname":"user_profiles_select_own","schemaname":"public","with_check":null},{"cmd":"UPDATE","qual":"(auth.uid() = id)","roles":["public"],"tablename":"user_profiles","permissive":"PERMISSIVE","policyname":"user_profiles_update_own","schemaname":"public","with_check":"(auth.uid() = id)"},{"cmd":"SELECT","qual":"((auth.uid() = user_id) OR private.is_recruitment_coordinator())","roles":["public"],"tablename":"user_roles","permissive":"PERMISSIVE","policyname":"user_roles_select_own","schemaname":"public","with_check":null}]'::jsonb then raise exception 'Public policy drift'; end if;
 if (select jsonb_build_object('owner',pg_get_userbyid(c.relowner),'acl',array(select unnest(c.relacl::text[]) order by 1),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid),'acl',a.attacl) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)) from pg_class c where c.oid=to_regclass('public.athlete_access')) is distinct from '{"owner":"postgres","acl":["anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","postgres=arwdDxtm/postgres","service_role=arwdDxtm/postgres"],"rls":true,"force_rls":false,"columns":[{"acl":null,"name":"id","type":"uuid","default":"gen_random_uuid()","notnull":true,"generated":""},{"acl":null,"name":"athlete_id","type":"uuid","default":null,"notnull":true,"generated":""},{"acl":null,"name":"user_id","type":"uuid","default":null,"notnull":true,"generated":""},{"acl":null,"name":"access_role","type":"athlete_access_role","default":null,"notnull":true,"generated":""},{"acl":null,"name":"status","type":"record_status","default":"''active''::record_status","notnull":true,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","default":"now()","notnull":true,"generated":""},{"acl":null,"name":"updated_at","type":"timestamp with time zone","default":"now()","notnull":true,"generated":""},{"acl":null,"name":"created_by","type":"uuid","default":null,"notnull":false,"generated":""}]}'::jsonb then raise exception 'Table definition/ACL drift: athlete_access'; end if;
 if (select jsonb_build_object('owner',pg_get_userbyid(c.relowner),'acl',array(select unnest(c.relacl::text[]) order by 1),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid),'acl',a.attacl) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)) from pg_class c where c.oid=to_regclass('public.athlete_readiness')) is distinct from '{"owner":"postgres","acl":["anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","postgres=arwdDxtm/postgres","service_role=arwdDxtm/postgres"],"rls":true,"force_rls":false,"columns":[{"acl":null,"name":"id","type":"uuid","default":"gen_random_uuid()","notnull":true,"generated":""},{"acl":null,"name":"athlete_id","type":"uuid","default":null,"notnull":true,"generated":""},{"acl":null,"name":"profile_complete","type":"boolean","default":"false","notnull":true,"generated":""},{"acl":null,"name":"academics_complete","type":"boolean","default":"false","notnull":true,"generated":""},{"acl":null,"name":"film_complete","type":"boolean","default":"false","notnull":true,"generated":""},{"acl":null,"name":"recruiting_materials_complete","type":"boolean","default":"false","notnull":true,"generated":""},{"acl":null,"name":"readiness_score","type":"integer","default":"(((\nCASE\n    WHEN profile_complete THEN 25\n    ELSE 0\nEND +\nCASE\n    WHEN academics_complete THEN 25\n    ELSE 0\nEND) +\nCASE\n    WHEN film_complete THEN 25\n    ELSE 0\nEND) +\nCASE\n    WHEN recruiting_materials_complete THEN 25\n    ELSE 0\nEND)","notnull":false,"generated":"s"},{"acl":null,"name":"updated_at","type":"timestamp with time zone","default":"now()","notnull":true,"generated":""}]}'::jsonb then raise exception 'Table definition/ACL drift: athlete_readiness'; end if;
 if (select jsonb_build_object('owner',pg_get_userbyid(c.relowner),'acl',array(select unnest(c.relacl::text[]) order by 1),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid),'acl',a.attacl) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)) from pg_class c where c.oid=to_regclass('public.athletes')) is distinct from '{"owner":"postgres","acl":["anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","postgres=arwdDxtm/postgres","service_role=arwdDxtm/postgres"],"rls":true,"force_rls":false,"columns":[{"acl":null,"name":"id","type":"uuid","default":"gen_random_uuid()","notnull":true,"generated":""},{"acl":null,"name":"first_name","type":"text","default":null,"notnull":true,"generated":""},{"acl":null,"name":"last_name","type":"text","default":null,"notnull":true,"generated":""},{"acl":null,"name":"sport","type":"text","default":null,"notnull":false,"generated":""},{"acl":null,"name":"graduation_year","type":"integer","default":null,"notnull":false,"generated":""},{"acl":null,"name":"status","type":"record_status","default":"''active''::record_status","notnull":true,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","default":"now()","notnull":true,"generated":""},{"acl":null,"name":"updated_at","type":"timestamp with time zone","default":"now()","notnull":true,"generated":""},{"acl":null,"name":"created_by","type":"uuid","default":null,"notnull":false,"generated":""}]}'::jsonb then raise exception 'Table definition/ACL drift: athletes'; end if;
 if (select jsonb_build_object('owner',pg_get_userbyid(c.relowner),'acl',array(select unnest(c.relacl::text[]) order by 1),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid),'acl',a.attacl) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)) from pg_class c where c.oid=to_regclass('public.audit_events')) is distinct from '{"owner":"postgres","acl":["anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","postgres=arwdDxtm/postgres","service_role=arwdDxtm/postgres"],"rls":true,"force_rls":false,"columns":[{"acl":null,"name":"id","type":"uuid","default":"gen_random_uuid()","notnull":true,"generated":""},{"acl":null,"name":"actor_user_id","type":"uuid","default":null,"notnull":false,"generated":""},{"acl":null,"name":"athlete_id","type":"uuid","default":null,"notnull":false,"generated":""},{"acl":null,"name":"event_type","type":"text","default":null,"notnull":true,"generated":""},{"acl":null,"name":"entity_type","type":"text","default":null,"notnull":false,"generated":""},{"acl":null,"name":"entity_id","type":"text","default":null,"notnull":false,"generated":""},{"acl":null,"name":"action","type":"text","default":null,"notnull":true,"generated":""},{"acl":null,"name":"source","type":"text","default":"''app''::text","notnull":true,"generated":""},{"acl":null,"name":"correlation_id","type":"text","default":null,"notnull":false,"generated":""},{"acl":null,"name":"metadata","type":"jsonb","default":"''{}''::jsonb","notnull":true,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","default":"now()","notnull":true,"generated":""}]}'::jsonb then raise exception 'Table definition/ACL drift: audit_events'; end if;
 if (select jsonb_build_object('owner',pg_get_userbyid(c.relowner),'acl',array(select unnest(c.relacl::text[]) order by 1),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid),'acl',a.attacl) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)) from pg_class c where c.oid=to_regclass('public.guardian_consents')) is distinct from '{"owner":"postgres","acl":["anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","postgres=arwdDxtm/postgres","service_role=arwdDxtm/postgres"],"rls":true,"force_rls":false,"columns":[{"acl":null,"name":"id","type":"uuid","default":"gen_random_uuid()","notnull":true,"generated":""},{"acl":null,"name":"athlete_id","type":"uuid","default":null,"notnull":true,"generated":""},{"acl":null,"name":"guardian_user_id","type":"uuid","default":null,"notnull":true,"generated":""},{"acl":null,"name":"status","type":"text","default":"''active''::text","notnull":true,"generated":""},{"acl":null,"name":"granted_at","type":"timestamp with time zone","default":"now()","notnull":true,"generated":""},{"acl":null,"name":"revoked_at","type":"timestamp with time zone","default":null,"notnull":false,"generated":""},{"acl":null,"name":"created_by","type":"uuid","default":null,"notnull":false,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","default":"now()","notnull":true,"generated":""},{"acl":null,"name":"updated_at","type":"timestamp with time zone","default":"now()","notnull":true,"generated":""}]}'::jsonb then raise exception 'Table definition/ACL drift: guardian_consents'; end if;
 if (select jsonb_build_object('owner',pg_get_userbyid(c.relowner),'acl',array(select unnest(c.relacl::text[]) order by 1),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid),'acl',a.attacl) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)) from pg_class c where c.oid=to_regclass('public.user_profiles')) is distinct from '{"owner":"postgres","acl":["anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","postgres=arwdDxtm/postgres","service_role=arwdDxtm/postgres"],"rls":true,"force_rls":false,"columns":[{"acl":null,"name":"id","type":"uuid","default":null,"notnull":true,"generated":""},{"acl":null,"name":"email","type":"text","default":null,"notnull":false,"generated":""},{"acl":null,"name":"full_name","type":"text","default":null,"notnull":false,"generated":""},{"acl":null,"name":"status","type":"record_status","default":"''active''::record_status","notnull":true,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","default":"now()","notnull":true,"generated":""},{"acl":null,"name":"updated_at","type":"timestamp with time zone","default":"now()","notnull":true,"generated":""}]}'::jsonb then raise exception 'Table definition/ACL drift: user_profiles'; end if;
 if (select jsonb_build_object('owner',pg_get_userbyid(c.relowner),'acl',array(select unnest(c.relacl::text[]) order by 1),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid),'acl',a.attacl) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)) from pg_class c where c.oid=to_regclass('public.user_roles')) is distinct from '{"owner":"postgres","acl":["anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","postgres=arwdDxtm/postgres","service_role=arwdDxtm/postgres"],"rls":true,"force_rls":false,"columns":[{"acl":null,"name":"id","type":"uuid","default":"gen_random_uuid()","notnull":true,"generated":""},{"acl":null,"name":"user_id","type":"uuid","default":null,"notnull":true,"generated":""},{"acl":null,"name":"role","type":"app_role","default":null,"notnull":true,"generated":""},{"acl":null,"name":"status","type":"record_status","default":"''active''::record_status","notnull":true,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","default":"now()","notnull":true,"generated":""},{"acl":null,"name":"updated_at","type":"timestamp with time zone","default":"now()","notnull":true,"generated":""},{"acl":null,"name":"created_by","type":"uuid","default":null,"notnull":false,"generated":""}]}'::jsonb then raise exception 'Table definition/ACL drift: user_roles'; end if;
 if (select jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),'schema',n.nspname,'type',d.defaclobjtype,'acl',array(select unnest(d.defaclacl::text[]) order by 1)) order by pg_get_userbyid(d.defaclrole),n.nspname,d.defaclobjtype) from pg_default_acl d join pg_namespace n on n.oid=d.defaclnamespace where n.nspname in('public','private')) is distinct from '[{"acl":["anon=rwU/postgres","authenticated=rwU/postgres","postgres=rwU/postgres","service_role=rwU/postgres"],"type":"S","owner":"postgres","schema":"public"},{"acl":["anon=X/postgres","authenticated=X/postgres","postgres=X/postgres","service_role=X/postgres"],"type":"f","owner":"postgres","schema":"public"},{"acl":["anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","postgres=arwdDxtm/postgres","service_role=arwdDxtm/postgres"],"type":"r","owner":"postgres","schema":"public"},{"acl":["anon=rwU/supabase_admin","authenticated=rwU/supabase_admin","postgres=rwU/supabase_admin","service_role=rwU/supabase_admin"],"type":"S","owner":"supabase_admin","schema":"public"},{"acl":["anon=X/supabase_admin","authenticated=X/supabase_admin","postgres=X/supabase_admin","service_role=X/supabase_admin"],"type":"f","owner":"supabase_admin","schema":"public"},{"acl":["anon=arwdDxtm/supabase_admin","authenticated=arwdDxtm/supabase_admin","postgres=arwdDxtm/supabase_admin","service_role=arwdDxtm/supabase_admin"],"type":"r","owner":"supabase_admin","schema":"public"}]'::jsonb then raise exception 'Default ACL drift'; end if;
 if (select jsonb_agg(jsonb_build_object('name',n.nspname,'acl',case when n.nspacl is null then null else array(select unnest(n.nspacl::text[]) order by 1) end,'owner',pg_get_userbyid(n.nspowner)) order by n.nspname) from pg_namespace n where n.nspname in('public','private')) is distinct from '[{"acl":null,"name":"private","owner":"postgres"},{"acl":["=U/pg_database_owner","anon=U/pg_database_owner","authenticated=U/pg_database_owner","pg_database_owner=UC/pg_database_owner","postgres=U/pg_database_owner","service_role=U/pg_database_owner"],"name":"public","owner":"pg_database_owner"}]'::jsonb then raise exception 'Schema ACL drift'; end if;
 if exists(select 1 from pg_auth_members where member in ('anon'::regrole,'authenticated'::regrole,'service_role'::regrole)) then raise exception 'Unexpected inherited client/service role membership'; end if;
 if (select jsonb_agg(jsonb_build_object('table',c.relname,'name',co.conname,'definition',pg_get_constraintdef(co.oid)) order by c.relname,co.conname) from pg_constraint co join pg_class c on c.oid=co.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public') is distinct from '[{"name":"athlete_access_athlete_id_fkey","table":"athlete_access","definition":"FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE"},{"name":"athlete_access_athlete_id_user_id_key","table":"athlete_access","definition":"UNIQUE (athlete_id, user_id)"},{"name":"athlete_access_created_by_fkey","table":"athlete_access","definition":"FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL"},{"name":"athlete_access_pkey","table":"athlete_access","definition":"PRIMARY KEY (id)"},{"name":"athlete_access_user_id_fkey","table":"athlete_access","definition":"FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE"},{"name":"athlete_readiness_athlete_id_fkey","table":"athlete_readiness","definition":"FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE"},{"name":"athlete_readiness_athlete_id_key","table":"athlete_readiness","definition":"UNIQUE (athlete_id)"},{"name":"athlete_readiness_pkey","table":"athlete_readiness","definition":"PRIMARY KEY (id)"},{"name":"athletes_created_by_fkey","table":"athletes","definition":"FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL"},{"name":"athletes_graduation_year_check","table":"athletes","definition":"CHECK (((graduation_year IS NULL) OR ((graduation_year >= 1990) AND (graduation_year <= 2100))))"},{"name":"athletes_pkey","table":"athletes","definition":"PRIMARY KEY (id)"},{"name":"audit_events_actor_user_id_fkey","table":"audit_events","definition":"FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL"},{"name":"audit_events_athlete_id_fkey","table":"audit_events","definition":"FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE SET NULL"},{"name":"audit_events_pkey","table":"audit_events","definition":"PRIMARY KEY (id)"},{"name":"guardian_consents_athlete_id_fkey","table":"guardian_consents","definition":"FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE"},{"name":"guardian_consents_athlete_id_guardian_user_id_key","table":"guardian_consents","definition":"UNIQUE (athlete_id, guardian_user_id)"},{"name":"guardian_consents_created_by_fkey","table":"guardian_consents","definition":"FOREIGN KEY (created_by) REFERENCES auth.users(id)"},{"name":"guardian_consents_guardian_user_id_fkey","table":"guardian_consents","definition":"FOREIGN KEY (guardian_user_id) REFERENCES auth.users(id) ON DELETE CASCADE"},{"name":"guardian_consents_pkey","table":"guardian_consents","definition":"PRIMARY KEY (id)"},{"name":"guardian_consents_status_check","table":"guardian_consents","definition":"CHECK ((status = ANY (ARRAY[''active''::text, ''revoked''::text])))"},{"name":"user_profiles_id_fkey","table":"user_profiles","definition":"FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE"},{"name":"user_profiles_pkey","table":"user_profiles","definition":"PRIMARY KEY (id)"},{"name":"user_roles_created_by_fkey","table":"user_roles","definition":"FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL"},{"name":"user_roles_pkey","table":"user_roles","definition":"PRIMARY KEY (id)"},{"name":"user_roles_user_id_fkey","table":"user_roles","definition":"FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE"},{"name":"user_roles_user_id_role_key","table":"user_roles","definition":"UNIQUE (user_id, role)"}]'::jsonb then raise exception 'Constraint drift'; end if;
 if (select jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'definition',pg_get_triggerdef(t.oid)) order by c.relname,t.tgname) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal) is distinct from '[{"name":"trg_athlete_access_updated_at","table":"athlete_access","definition":"CREATE TRIGGER trg_athlete_access_updated_at BEFORE UPDATE ON public.athlete_access FOR EACH ROW EXECUTE FUNCTION set_updated_at()"},{"name":"trg_athletes_updated_at","table":"athletes","definition":"CREATE TRIGGER trg_athletes_updated_at BEFORE UPDATE ON public.athletes FOR EACH ROW EXECUTE FUNCTION set_updated_at()"},{"name":"trg_user_profiles_updated_at","table":"user_profiles","definition":"CREATE TRIGGER trg_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at()"},{"name":"trg_user_roles_updated_at","table":"user_roles","definition":"CREATE TRIGGER trg_user_roles_updated_at BEFORE UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION set_updated_at()"}]'::jsonb then raise exception 'Trigger drift'; end if;
end;
$guard$;

-- Bounded lookup avoids querying the RLS-protected table recursively as caller.
create function private.is_assigned_athlete_coordinator(p_athlete_id uuid)
returns boolean language sql stable security definer set search_path=''
as $lookup$
 select auth.uid() is not null and exists (
  select 1 from public.athlete_access mine
  where mine.athlete_id=p_athlete_id and mine.user_id=auth.uid()
   and mine.access_role='recruitment_coordinator' and mine.status='active'
 );
$lookup$;
alter function private.is_assigned_athlete_coordinator(uuid) owner to postgres;
-- Production function defaults grant these roles EXECUTE: override explicitly.
revoke all on function private.is_assigned_athlete_coordinator(uuid)
from public,anon,authenticated,service_role;
grant execute on function private.is_assigned_athlete_coordinator(uuid) to authenticated;
-- No new private-schema USAGE grant is needed for stored RLS expressions.
alter policy athlete_access_select_own on public.athlete_access to authenticated
using ((select auth.uid())=user_id or private.is_assigned_athlete_coordinator(athlete_id));

revoke truncate,references,trigger,maintain on table
 public.user_profiles,public.user_roles,public.athletes,public.athlete_access,
 public.audit_events,public.guardian_consents,public.athlete_readiness
from public,anon,authenticated;
alter default privileges for role postgres in schema public
revoke truncate,references,trigger,maintain on tables from public,anon,authenticated;

alter policy athlete_readiness_update_coordinator on public.athlete_readiness
to authenticated
using(private.is_recruitment_coordinator() and private.is_assigned_athlete_coordinator(athlete_id))
with check(private.is_recruitment_coordinator() and private.is_assigned_athlete_coordinator(athlete_id));
revoke update on table public.athlete_readiness from public,anon,authenticated;
grant update(profile_complete,academics_complete,film_complete,recruiting_materials_complete,updated_at)
on public.athlete_readiness to authenticated;

-- Intentional reviewed workflow change: browser coordinators cannot grant roles.
-- Existing service_role/owner execution, function body and actor guard are preserved.
revoke execute on function public.assign_role(uuid,public.app_role) from public,anon,authenticated;

do $verify$
declare t text; r text; p text; c text;
begin
 foreach t in array array['user_profiles','user_roles','athletes','athlete_access','audit_events','guardian_consents','athlete_readiness'] loop
  if not (select relrowsecurity from pg_class where oid=('public.'||t)::regclass) then raise exception 'RLS unexpectedly disabled'; end if;
  foreach r in array array['anon','authenticated'] loop
   foreach p in array array['TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] loop
    if has_table_privilege(r,'public.'||t,p) then raise exception 'Residual dangerous client capability'; end if;
   end loop;
  end loop;
  foreach p in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] loop
   if not has_table_privilege('service_role','public.'||t,p) then raise exception 'Existing service capability lost'; end if;
  end loop;
 end loop;
 foreach c in array array['id','athlete_id','readiness_score'] loop
  if has_column_privilege('authenticated','public.athlete_readiness',c,'UPDATE') then raise exception 'Sensitive column still writable'; end if;
 end loop;
 foreach c in array array['profile_complete','academics_complete','film_complete','recruiting_materials_complete','updated_at'] loop
  if not has_column_privilege('authenticated','public.athlete_readiness',c,'UPDATE') then raise exception 'Intended completion column grant missing'; end if;
 end loop;
 if has_function_privilege('authenticated','public.assign_role(uuid,public.app_role)','EXECUTE')
  or has_function_privilege('anon','public.assign_role(uuid,public.app_role)','EXECUTE')
  or not has_function_privilege('service_role','public.assign_role(uuid,public.app_role)','EXECUTE') then raise exception 'Role-assignment ACL mismatch'; end if;
 if has_function_privilege('anon','private.is_assigned_athlete_coordinator(uuid)','EXECUTE')
  or has_function_privilege('service_role','private.is_assigned_athlete_coordinator(uuid)','EXECUTE')
  or not has_function_privilege('authenticated','private.is_assigned_athlete_coordinator(uuid)','EXECUTE') then raise exception 'Helper ACL mismatch'; end if;
 if has_schema_privilege('anon','private','USAGE') or has_schema_privilege('authenticated','private','USAGE') then raise exception 'Private schema unexpectedly exposed'; end if;
end;
$verify$;
commit;
