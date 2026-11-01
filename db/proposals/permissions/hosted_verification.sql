-- EXECUTED EVIDENCE: staging project kpatqovdotkkgvpvgccg only.
-- SQL role/claim contexts; not real JWT sessions. All mutations roll back.
begin;
set local statement_timeout='30s';
create temporary table permission_test_results(check_name text primary key, passed boolean not null);
grant select,insert on permission_test_results to authenticated,anon;
create function pg_temp.verify_permission(check_label text, assertion boolean) returns void
language plpgsql as $test$
begin
 if assertion is distinct from true then raise exception 'Verification failed: %',check_label; end if;
 insert into pg_temp.permission_test_results values(check_label,true);
end;
$test$;
do $test$
declare t text; r text; p text; c text;
begin
 foreach t in array array['user_profiles','user_roles','athletes','athlete_access','audit_events','guardian_consents','athlete_readiness'] loop
  perform pg_temp.verify_permission('rls_'||t,(select relrowsecurity from pg_class where oid=('public.'||t)::regclass));
  foreach r in array array['anon','authenticated'] loop
   foreach p in array array['TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] loop
    perform pg_temp.verify_permission(r||'_'||p||'_'||t,not has_table_privilege(r,'public.'||t,p));
   end loop;
  end loop;
 end loop;
 foreach c in array array['profile_complete','academics_complete','film_complete','recruiting_materials_complete','updated_at'] loop
  perform pg_temp.verify_permission('auth_update_allowed_'||c,has_column_privilege('authenticated','public.athlete_readiness',c,'UPDATE'));
 end loop;
 foreach c in array array['id','athlete_id','readiness_score'] loop
  perform pg_temp.verify_permission('auth_update_denied_'||c,not has_column_privilege('authenticated','public.athlete_readiness',c,'UPDATE'));
 end loop;
 perform pg_temp.verify_permission('future_postgres_table_defaults',not exists(
  select 1 from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a
  where d.defaclrole='postgres'::regrole and d.defaclnamespace='public'::regnamespace and d.defaclobjtype='r'
  and (a.grantee=0 or a.grantee in ('anon'::regrole,'authenticated'::regrole))
  and a.privilege_type in ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')));
end;
$test$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"7e5bcc5e-b167-43d8-8665-3f39a6a1f99e","role":"authenticated"}',true);
do $test$
declare changed integer;
begin
 perform pg_temp.verify_permission('athlete_a_athlete_count',(select count(*)=1 from public.athletes));
 perform pg_temp.verify_permission('athlete_a_athlete_a_scope',(select count(*)=1 from public.athletes where id='9d0d7e9c-05b3-4ea5-bdd9-82b761c2a22d'));
 perform pg_temp.verify_permission('athlete_a_athlete_b_scope',(select count(*)=0 from public.athletes where id='0784d468-02a1-4c54-b1c2-fce5444b6737'));
 perform pg_temp.verify_permission('athlete_a_readiness_count',(select count(*)=1 from public.athlete_readiness));
 perform pg_temp.verify_permission('athlete_a_consent_count',(select count(*)=2 from public.guardian_consents));
 begin
  perform public.assign_role('61f2c0c3-60e9-47d3-849f-9d092e6a6437','recruitment_coordinator');
  raise exception 'Role assignment unexpectedly permitted';
 exception when insufficient_privilege then perform pg_temp.verify_permission('athlete_a_rpc_denied',true);
 end;
 with modified as (update public.athlete_readiness set film_complete=not film_complete returning id) select count(*) into changed from modified;
 perform pg_temp.verify_permission('athlete_a_readiness_update_scope',changed=0);
end;
$test$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"61f2c0c3-60e9-47d3-849f-9d092e6a6437","role":"authenticated"}',true);
do $test$
declare changed integer;
begin
 perform pg_temp.verify_permission('athlete_b_athlete_count',(select count(*)=1 from public.athletes));
 perform pg_temp.verify_permission('athlete_b_athlete_a_scope',(select count(*)=0 from public.athletes where id='9d0d7e9c-05b3-4ea5-bdd9-82b761c2a22d'));
 perform pg_temp.verify_permission('athlete_b_athlete_b_scope',(select count(*)=1 from public.athletes where id='0784d468-02a1-4c54-b1c2-fce5444b6737'));
 perform pg_temp.verify_permission('athlete_b_readiness_count',(select count(*)=1 from public.athlete_readiness));
 perform pg_temp.verify_permission('athlete_b_consent_count',(select count(*)=0 from public.guardian_consents));
 begin
  perform public.assign_role('61f2c0c3-60e9-47d3-849f-9d092e6a6437','recruitment_coordinator');
  raise exception 'Role assignment unexpectedly permitted';
 exception when insufficient_privilege then perform pg_temp.verify_permission('athlete_b_rpc_denied',true);
 end;
 with modified as (update public.athlete_readiness set film_complete=not film_complete returning id) select count(*) into changed from modified;
 perform pg_temp.verify_permission('athlete_b_readiness_update_scope',changed=0);
end;
$test$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"32be8560-45c1-4b99-9ad1-1f4f55a5f2ec","role":"authenticated"}',true);
do $test$
declare changed integer;
begin
 perform pg_temp.verify_permission('guardian_active_athlete_count',(select count(*)=1 from public.athletes));
 perform pg_temp.verify_permission('guardian_active_athlete_a_scope',(select count(*)=1 from public.athletes where id='9d0d7e9c-05b3-4ea5-bdd9-82b761c2a22d'));
 perform pg_temp.verify_permission('guardian_active_athlete_b_scope',(select count(*)=0 from public.athletes where id='0784d468-02a1-4c54-b1c2-fce5444b6737'));
 perform pg_temp.verify_permission('guardian_active_readiness_count',(select count(*)=1 from public.athlete_readiness));
 perform pg_temp.verify_permission('guardian_active_consent_count',(select count(*)=2 from public.guardian_consents));
 begin
  perform public.assign_role('61f2c0c3-60e9-47d3-849f-9d092e6a6437','recruitment_coordinator');
  raise exception 'Role assignment unexpectedly permitted';
 exception when insufficient_privilege then perform pg_temp.verify_permission('guardian_active_rpc_denied',true);
 end;
 with modified as (update public.athlete_readiness set film_complete=not film_complete returning id) select count(*) into changed from modified;
 perform pg_temp.verify_permission('guardian_active_readiness_update_scope',changed=0);
end;
$test$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"6d569ad6-9785-4bc1-bb5b-f5e1fdab247f","role":"authenticated"}',true);
do $test$
declare changed integer;
begin
 perform pg_temp.verify_permission('guardian_revoked_athlete_count',(select count(*)=0 from public.athletes));
 perform pg_temp.verify_permission('guardian_revoked_athlete_a_scope',(select count(*)=0 from public.athletes where id='9d0d7e9c-05b3-4ea5-bdd9-82b761c2a22d'));
 perform pg_temp.verify_permission('guardian_revoked_athlete_b_scope',(select count(*)=0 from public.athletes where id='0784d468-02a1-4c54-b1c2-fce5444b6737'));
 perform pg_temp.verify_permission('guardian_revoked_readiness_count',(select count(*)=0 from public.athlete_readiness));
 perform pg_temp.verify_permission('guardian_revoked_consent_count',(select count(*)=1 from public.guardian_consents));
 begin
  perform public.assign_role('61f2c0c3-60e9-47d3-849f-9d092e6a6437','recruitment_coordinator');
  raise exception 'Role assignment unexpectedly permitted';
 exception when insufficient_privilege then perform pg_temp.verify_permission('guardian_revoked_rpc_denied',true);
 end;
 with modified as (update public.athlete_readiness set film_complete=not film_complete returning id) select count(*) into changed from modified;
 perform pg_temp.verify_permission('guardian_revoked_readiness_update_scope',changed=0);
end;
$test$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"535b00f8-40da-4c69-9832-962dbf745df6","role":"authenticated"}',true);
do $test$
declare changed integer;
begin
 perform pg_temp.verify_permission('coordinator_athlete_count',(select count(*)=1 from public.athletes));
 perform pg_temp.verify_permission('coordinator_athlete_a_scope',(select count(*)=1 from public.athletes where id='9d0d7e9c-05b3-4ea5-bdd9-82b761c2a22d'));
 perform pg_temp.verify_permission('coordinator_athlete_b_scope',(select count(*)=0 from public.athletes where id='0784d468-02a1-4c54-b1c2-fce5444b6737'));
 perform pg_temp.verify_permission('coordinator_readiness_count',(select count(*)=1 from public.athlete_readiness));
 perform pg_temp.verify_permission('coordinator_consent_count',(select count(*)=2 from public.guardian_consents));
 begin
  perform public.assign_role('61f2c0c3-60e9-47d3-849f-9d092e6a6437','recruitment_coordinator');
  raise exception 'Role assignment unexpectedly permitted';
 exception when insufficient_privilege then perform pg_temp.verify_permission('coordinator_rpc_denied',true);
 end;
 with modified as (update public.athlete_readiness set film_complete=not film_complete returning id) select count(*) into changed from modified;
 perform pg_temp.verify_permission('coordinator_readiness_update_scope',changed=1);
end;
$test$;
reset role;
-- Temporary read-only link makes the coordinator able to SELECT B without a coordinator assignment.
insert into public.athlete_access(athlete_id,user_id,access_role,status)
values('0784d468-02a1-4c54-b1c2-fce5444b6737','535b00f8-40da-4c69-9832-962dbf745df6','student_athlete','active');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"535b00f8-40da-4c69-9832-962dbf745df6","role":"authenticated"}',true);
do $test$
declare changed integer; col text; code text;
begin
 perform pg_temp.verify_permission('coordinator_can_select_read_link_b',(select count(*)=1 from public.athlete_readiness where athlete_id='0784d468-02a1-4c54-b1c2-fce5444b6737'));
 with modified as(update public.athlete_readiness set film_complete=not film_complete where athlete_id='0784d468-02a1-4c54-b1c2-fce5444b6737' returning id) select count(*) into changed from modified;
 perform pg_temp.verify_permission('coordinator_cannot_update_read_link_b',changed=0);
 foreach col in array array['id','athlete_id','readiness_score'] loop
  begin
   execute format('update public.athlete_readiness set %I=%I where athlete_id=%L',col,col,'9d0d7e9c-05b3-4ea5-bdd9-82b761c2a22d');
   raise exception 'Sensitive column update unexpectedly permitted: %',col;
  exception when insufficient_privilege or generated_always then
   perform pg_temp.verify_permission('coordinator_sensitive_column_denied_'||col,true);
  end;
 end loop;
end;
$test$;
reset role;
update public.athlete_access set status='archived'
where athlete_id='9d0d7e9c-05b3-4ea5-bdd9-82b761c2a22d' and user_id='535b00f8-40da-4c69-9832-962dbf745df6' and access_role='recruitment_coordinator';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"535b00f8-40da-4c69-9832-962dbf745df6","role":"authenticated"}',true);
do $test$
declare changed integer;
begin
 with modified as(update public.athlete_readiness set film_complete=not film_complete where athlete_id='9d0d7e9c-05b3-4ea5-bdd9-82b761c2a22d' returning id) select count(*) into changed from modified;
 perform pg_temp.verify_permission('archived_assignment_update_denied',changed=0);
end;
$test$;
reset role;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $test$
begin
 begin
  perform count(*) from public.athletes;
  raise exception 'Anon read unexpectedly permitted';
 exception when insufficient_privilege then perform pg_temp.verify_permission('anon_read_denied',true);
 end;
 begin
  update public.athlete_readiness set film_complete=true;
  raise exception 'Anon update unexpectedly permitted';
 exception when insufficient_privilege then perform pg_temp.verify_permission('anon_update_denied',true);
 end;
 begin
  perform public.assign_role('61f2c0c3-60e9-47d3-849f-9d092e6a6437','recruitment_coordinator');
  raise exception 'Anon role grant unexpectedly permitted';
 exception when insufficient_privilege then perform pg_temp.verify_permission('anon_rpc_denied',true);
 end;
end;
$test$;
reset role;
select jsonb_build_object('passed',count(*),'failed',count(*) filter(where not passed),'checks',jsonb_agg(check_name order by check_name)) verification
from permission_test_results;
rollback;
