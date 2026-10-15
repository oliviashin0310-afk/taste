-- Works for both a new project and the older read-only restaurants table.
create table if not exists public.restaurants (
  id text primary key,
  source text not null default 'public',
  source_id text,
  name text not null default '',
  address text not null default '',
  category text not null default '',
  category_label text not null default '',
  neighborhood text not null default '',
  latitude double precision,
  longitude double precision,
  updated_at timestamptz not null default now()
);

alter table public.restaurants add column if not exists source text not null default 'public';
alter table public.restaurants add column if not exists source_id text;
alter table public.restaurants add column if not exists name text not null default '';
alter table public.restaurants add column if not exists address text not null default '';
alter table public.restaurants add column if not exists category text not null default '';
alter table public.restaurants add column if not exists category_label text not null default '';
alter table public.restaurants add column if not exists neighborhood text not null default '';
alter table public.restaurants add column if not exists latitude double precision;
alter table public.restaurants add column if not exists longitude double precision;
alter table public.restaurants add column if not exists updated_at timestamptz not null default now();

-- Preserve pre-existing rows by using their former primary key as the source ID.
update public.restaurants set source_id = id where source_id is null;
alter table public.restaurants alter column source_id set not null;

create unique index if not exists restaurants_source_source_id_key
  on public.restaurants (source, source_id);

alter table public.restaurants enable row level security;
drop policy if exists "Restaurants are readable by everyone" on public.restaurants;
drop policy if exists "restaurants_select_public" on public.restaurants;
drop policy if exists "restaurants_write_public" on public.restaurants;
revoke all on table public.restaurants from anon, authenticated;
grant select, insert, update on table public.restaurants to service_role;
