-- ===== stopmenu · стоп-лист платформасы =====
-- Supabase Dashboard → SQL Editor → New query → осы файлды қойып, Run басыңыз.
-- Бір Supabase жобасы барлық клиент сайттарына ортақ.

create table if not exists public.sites (
  slug        text primary key check (slug ~ '^[a-z0-9-]{2,40}$'),
  name        text not null,
  site_url    text,          -- https://otdoner.vercel.app
  menu_url    text,          -- https://otdoner.vercel.app/js/data.js
  created_at  timestamptz not null default now()
);

create table if not exists public.site_members (
  site_slug   text not null references public.sites(slug) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (site_slug, user_id)
);

create table if not exists public.stop_items (
  site_slug   text not null references public.sites(slug) on delete cascade,
  item_id     text not null check (char_length(item_id) between 1 and 80),
  stopped_at  timestamptz not null default now(),
  stopped_by  uuid references auth.users(id),
  primary key (site_slug, item_id)
);

-- Қолданушы сол сайттың мүшесі ме? (RLS ішінде рекурсия болмас үшін security definer)
create or replace function public.is_site_member(p_slug text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.site_members m
    where m.site_slug = p_slug and m.user_id = auth.uid()
  );
$$;

alter table public.sites        enable row level security;
alter table public.site_members enable row level security;
alter table public.stop_items   enable row level security;

drop policy if exists "sites read own"    on public.sites;
drop policy if exists "members read own"  on public.site_members;
drop policy if exists "stop read all"     on public.stop_items;
drop policy if exists "stop insert own"   on public.stop_items;
drop policy if exists "stop delete own"   on public.stop_items;

-- Клиент тек өзі тіркелген сайтты көреді
create policy "sites read own" on public.sites
  for select to authenticated
  using (public.is_site_member(slug));

create policy "members read own" on public.site_members
  for select to authenticated
  using (user_id = auth.uid());

-- Стоп-лист: оқу — барлығына ашық (сайт оны көрсетеді), жазу — тек өз сайтына
create policy "stop read all" on public.stop_items
  for select to anon, authenticated
  using (true);

create policy "stop insert own" on public.stop_items
  for insert to authenticated
  with check (public.is_site_member(site_slug) and stopped_by = auth.uid());

create policy "stop delete own" on public.stop_items
  for delete to authenticated
  using (public.is_site_member(site_slug));

grant select on public.sites, public.site_members to authenticated;
grant select on public.stop_items to anon, authenticated;
grant insert, delete on public.stop_items to authenticated;

-- ===== Жаңа клиент қосу =====
-- 1) Сайтты тіркеу:
-- insert into public.sites (slug, name, site_url, menu_url) values
--   ('otdoner', 'ОТ ДОНЕР', 'https://otdoner.vercel.app', 'https://otdoner.vercel.app/js/data.js')
--   on conflict (slug) do nothing;
--
-- 2) Dashboard → Authentication → Users → Add user: клиенттің email + құпиясөзі
--    («Auto Confirm User» қосулы болсын).
--
-- 3) Клиентті сайтқа байлау:
-- insert into public.site_members (site_slug, user_id)
--   select 'otdoner', id from auth.users where email = 'client@example.com'
--   on conflict do nothing;
