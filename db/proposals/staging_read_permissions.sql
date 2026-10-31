-- STAGING REVIEW DRAFT ONLY. Target: kpatqovdotkkgvpvgccg.
-- Verify target through the Supabase branch inventory before execution.
-- Existing RLS remains enabled and authoritative. No write privileges added.
begin;
do $$
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname in ('athlete_access','athletes','guardian_consents','athlete_readiness','user_roles')
      and not c.relrowsecurity
  ) then
    raise exception 'RLS must be enabled on every test table';
  end if;
end;
$$;
grant usage on schema public, private to authenticated;
grant select on public.athlete_access, public.athletes,
  public.guardian_consents, public.athlete_readiness, public.user_roles
to authenticated;
commit;
