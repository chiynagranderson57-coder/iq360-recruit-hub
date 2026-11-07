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
)::text) as structure_md5;
