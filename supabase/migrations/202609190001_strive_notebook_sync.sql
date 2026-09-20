create table if not exists public.notebooks (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  color text not null default '#476f66',
  data jsonb not null,
  client_updated_at bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notebooks_user_id_idx on public.notebooks(user_id);

create table if not exists public.workspace_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tabs jsonb not null default '[]'::jsonb,
  client_updated_at bigint not null,
  updated_at timestamptz not null default now()
);

alter table public.notebooks enable row level security;
alter table public.workspace_preferences enable row level security;

revoke all on table public.notebooks from anon, authenticated;
revoke all on table public.workspace_preferences from anon, authenticated;
grant select, insert, update, delete on table public.notebooks to authenticated;
grant select, insert, update, delete on table public.workspace_preferences to authenticated;

create policy "Users select their notebooks"
on public.notebooks for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users insert their notebooks"
on public.notebooks for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users update their notebooks"
on public.notebooks for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users delete their notebooks"
on public.notebooks for delete to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users select their workspace preferences"
on public.workspace_preferences for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users insert their workspace preferences"
on public.workspace_preferences for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users update their workspace preferences"
on public.workspace_preferences for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users delete their workspace preferences"
on public.workspace_preferences for delete to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notebooks_set_updated_at on public.notebooks;
create trigger notebooks_set_updated_at
before update on public.notebooks
for each row execute function public.set_updated_at();

drop trigger if exists workspace_preferences_set_updated_at on public.workspace_preferences;
create trigger workspace_preferences_set_updated_at
before update on public.workspace_preferences
for each row execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notebooks'
  ) then
    alter publication supabase_realtime add table public.notebooks;
  end if;
end
$$;
