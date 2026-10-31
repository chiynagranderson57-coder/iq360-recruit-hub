-- STAGING REVIEW DRAFT ONLY. Target: kpatqovdotkkgvpvgccg.
-- Verify branch identity before execution. Does not create or modify Auth users.
-- Prerequisite: five confirmed synthetic Auth accounts provisioned through
-- supported Supabase Auth Admin API or the staging Auth dashboard.
-- No existing records are updated; repeated execution deliberately stops.
begin;
do $$
declare
  a uuid; b uuid; ga uuid; gr uuid; co uuid;
  athlete_a uuid; athlete_b uuid;
begin
  select id into a from auth.users where email='sriq12-staging-athlete-a@example.com' and email_confirmed_at is not null;
  select id into b from auth.users where email='sriq12-staging-athlete-b@example.com' and email_confirmed_at is not null;
  select id into ga from auth.users where email='sriq12-staging-guardian-active@example.com' and email_confirmed_at is not null;
  select id into gr from auth.users where email='sriq12-staging-guardian-revoked@example.com' and email_confirmed_at is not null;
  select id into co from auth.users where email='sriq12-staging-coordinator@example.com' and email_confirmed_at is not null;
  if a is null or b is null or ga is null or gr is null or co is null then
    raise exception 'Missing confirmed staging test accounts; no fixtures inserted';
  end if;
  if exists(select 1 from public.athlete_access where user_id in (a,b,ga,gr,co))
    or exists(select 1 from public.user_roles where user_id in (a,b,ga,gr,co))
    or exists(select 1 from public.guardian_consents where guardian_user_id in (ga,gr))
    or exists(select 1 from public.athletes where first_name='SRIQ12-STAGING') then
    raise exception 'Existing test setup detected; stop for review rather than overwrite';
  end if;
  insert into public.athletes(first_name,last_name,status,created_by)
    values ('SRIQ12-STAGING','Athlete A','active',co) returning id into athlete_a;
  insert into public.athletes(first_name,last_name,status,created_by)
    values ('SRIQ12-STAGING','Athlete B','active',co) returning id into athlete_b;
  insert into public.athlete_access(athlete_id,user_id,access_role,status,created_by) values
    (athlete_a,a,'student_athlete','active',co),
    (athlete_b,b,'student_athlete','active',co),
    (athlete_a,ga,'parent_guardian','active',co),
    (athlete_a,gr,'parent_guardian','active',co),
    (athlete_a,co,'recruitment_coordinator','active',co);
  -- The revoked guardian keeps an active link, isolating consent enforcement.
  insert into public.guardian_consents(athlete_id,guardian_user_id,status,revoked_at,created_by) values
    (athlete_a,ga,'active',null,co),
    (athlete_a,gr,'revoked',now(),co);
  insert into public.user_roles(user_id,role,status,created_by)
    values(co,'recruitment_coordinator','active',co);
  insert into public.athlete_readiness(athlete_id) values(athlete_a),(athlete_b);
end;
$$;
commit;
