create table if not exists public.guardian_consents (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  guardian_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','revoked')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, guardian_user_id)
);
alter table public.guardian_consents enable row level security;
create index if not exists guardian_consents_guardian_idx on public.guardian_consents(guardian_user_id, athlete_id, status);
create index if not exists guardian_consents_athlete_idx on public.guardian_consents(athlete_id, status);

create table if not exists public.athlete_readiness (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null unique references public.athletes(id) on delete cascade,
  profile_complete boolean not null default false,
  academics_complete boolean not null default false,
  film_complete boolean not null default false,
  recruiting_materials_complete boolean not null default false,
  readiness_score integer generated always as (
    (case when profile_complete then 25 else 0 end) +
    (case when academics_complete then 25 else 0 end) +
    (case when film_complete then 25 else 0 end) +
    (case when recruiting_materials_complete then 25 else 0 end)
  ) stored,
  updated_at timestamptz not null default now()
);
alter table public.athlete_readiness enable row level security;

create or replace function private.has_athlete_access(p_athlete_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.athlete_access aa
    where aa.athlete_id = p_athlete_id
      and aa.user_id = auth.uid()
      and aa.status = 'active'
      and (
        aa.access_role <> 'parent_guardian'
        or exists (
          select 1 from public.guardian_consents gc
          where gc.athlete_id = p_athlete_id
            and gc.guardian_user_id = auth.uid()
            and gc.status = 'active'
            and gc.revoked_at is null
        )
      )
  );
$$;

drop policy if exists guardian_consents_select_scoped on public.guardian_consents;
create policy guardian_consents_select_scoped on public.guardian_consents
for select to authenticated
using (guardian_user_id = (select auth.uid()) or private.has_athlete_access(athlete_id));

drop policy if exists athlete_readiness_select_scoped on public.athlete_readiness;
create policy athlete_readiness_select_scoped on public.athlete_readiness
for select to authenticated using (private.has_athlete_access(athlete_id));

drop policy if exists athlete_readiness_update_coordinator on public.athlete_readiness;
create policy athlete_readiness_update_coordinator on public.athlete_readiness
for update to authenticated
using (private.is_recruitment_coordinator())
with check (private.is_recruitment_coordinator());

grant select on public.guardian_consents, public.athlete_readiness to authenticated;
grant update on public.athlete_readiness to authenticated;
