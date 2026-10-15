create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
grant usage on schema extensions to service_role;

alter table public.restaurants
  add column if not exists location extensions.geography(Point, 4326);

create or replace function public.set_restaurant_location()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.latitude between -90 and 90
     and new.longitude between -180 and 180 then
    -- PostGIS point order is X=longitude, Y=latitude.
    new.location := extensions.st_setsrid(
      extensions.st_makepoint(new.longitude, new.latitude),
      4326
    )::extensions.geography;
  else
    new.location := null;
  end if;
  return new;
end;
$$;

drop trigger if exists restaurants_set_location on public.restaurants;
create trigger restaurants_set_location
before insert or update of latitude, longitude
on public.restaurants
for each row execute function public.set_restaurant_location();

update public.restaurants
set location = extensions.st_setsrid(
  extensions.st_makepoint(longitude, latitude),
  4326
)::extensions.geography
where latitude between -90 and 90
  and longitude between -180 and 180
  and location is null;

create index if not exists restaurants_location_gix
  on public.restaurants using gist (location)
  where location is not null;

create or replace function public.search_nearby_restaurants(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_meters double precision,
  p_query text default null,
  p_category text default null,
  p_limit integer default 100
)
returns table (
  id text,
  source text,
  source_id text,
  name text,
  address text,
  category text,
  category_label text,
  neighborhood text,
  latitude double precision,
  longitude double precision,
  updated_at timestamptz,
  distance_meters double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    r.id,
    r.source,
    r.source_id,
    r.name,
    r.address,
    r.category,
    r.category_label,
    r.neighborhood,
    r.latitude,
    r.longitude,
    r.updated_at,
    extensions.st_distance(
      r.location,
      extensions.st_setsrid(
        extensions.st_makepoint(p_longitude, p_latitude),
        4326
      )::extensions.geography
    ) as distance_meters
  from public.restaurants as r
  where r.location is not null
    and p_latitude between -90 and 90
    and p_longitude between -180 and 180
    and p_radius_meters in (500, 1000, 3000)
    and extensions.st_dwithin(
      r.location,
      extensions.st_setsrid(
        extensions.st_makepoint(p_longitude, p_latitude),
        4326
      )::extensions.geography,
      p_radius_meters
    )
    and (
      nullif(btrim(p_query), '') is null
      or r.name ilike '%' || btrim(p_query) || '%'
    )
    and (
      nullif(btrim(p_category), '') is null
      or r.category = btrim(p_category)
    )
  order by distance_meters asc, r.name asc
  limit greatest(1, least(coalesce(p_limit, 100), 100));
$$;

revoke all on function public.set_restaurant_location() from public, anon, authenticated;
revoke all on function public.search_nearby_restaurants(double precision, double precision, double precision, text, text, integer) from public, anon, authenticated;
grant execute on function public.search_nearby_restaurants(double precision, double precision, double precision, text, text, integer) to service_role;
