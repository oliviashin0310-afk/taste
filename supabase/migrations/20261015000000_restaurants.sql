create table if not exists public.restaurants (
  id text primary key,
  source text not null,
  source_id text not null,
  name text not null,
  address text not null default '',
  category text not null default '',
  category_label text not null default '',
  neighborhood text not null default '',
  latitude double precision,
  longitude double precision,
  updated_at timestamptz not null default now(),
  constraint restaurants_source_source_id_key unique (source, source_id)
);

alter table public.restaurants enable row level security;

revoke all on table public.restaurants from anon, authenticated;
grant select, insert, update on table public.restaurants to service_role;
