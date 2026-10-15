-- Community features: member profiles, favorites, moderated reviews, reports, and photos.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_community_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_community on auth.users;
create trigger on_auth_user_created_community
  after insert on auth.users
  for each row execute function public.handle_new_community_user();

insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

create or replace function public.is_community_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function public.is_community_admin() from public;
grant execute on function public.is_community_admin() to anon, authenticated;

create table if not exists public.restaurant_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_key text not null,
  restaurant_name text not null,
  restaurant_address text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, restaurant_key)
);

create index if not exists restaurant_favorites_user_created_idx
  on public.restaurant_favorites (user_id, created_at desc);

create table if not exists public.restaurant_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_key text not null,
  restaurant_name text not null,
  content text not null check (char_length(content) between 5 and 2000),
  photo_urls text[] not null default '{}',
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'visible', 'rejected')),
  moderated_by uuid references auth.users(id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_reviews_max_photos check (cardinality(photo_urls) <= 3)
);

create index if not exists restaurant_reviews_restaurant_status_created_idx
  on public.restaurant_reviews (restaurant_key, moderation_status, created_at desc);
create index if not exists restaurant_reviews_user_created_idx
  on public.restaurant_reviews (user_id, created_at desc);
create index if not exists restaurant_reviews_photo_paths_gin_idx
  on public.restaurant_reviews using gin (photo_urls);

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('review', 'restaurant')),
  target_id text not null,
  reason text not null check (reason in ('허위 정보', '욕설·혐오', '광고·스팸', '개인정보', '기타')),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  handled_by uuid references auth.users(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists community_reports_status_created_idx
  on public.community_reports (status, created_at desc);

alter table public.profiles enable row level security;
alter table public.restaurant_favorites enable row level security;
alter table public.restaurant_reviews enable row level security;
alter table public.community_reports enable row level security;

revoke all on public.profiles, public.restaurant_favorites, public.restaurant_reviews, public.community_reports from anon;
grant select on public.profiles to authenticated;
grant select, insert, delete on public.restaurant_favorites to authenticated;
grant select on public.restaurant_reviews to anon;
grant select, insert, update, delete on public.restaurant_reviews to authenticated;
grant select, insert, update on public.community_reports to authenticated;

drop policy if exists "profiles_read_self_or_admin" on public.profiles;
create policy "profiles_read_self_or_admin" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select public.is_community_admin()));

drop policy if exists "favorites_read_own" on public.restaurant_favorites;
create policy "favorites_read_own" on public.restaurant_favorites
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "favorites_insert_own" on public.restaurant_favorites;
create policy "favorites_insert_own" on public.restaurant_favorites
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "favorites_delete_own" on public.restaurant_favorites;
create policy "favorites_delete_own" on public.restaurant_favorites
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "reviews_read_visible_or_own_or_admin" on public.restaurant_reviews;
create policy "reviews_read_visible_or_own_or_admin" on public.restaurant_reviews
  for select to anon, authenticated using (
    moderation_status = 'visible'
    or user_id = (select auth.uid())
    or (select public.is_community_admin())
  );
drop policy if exists "reviews_insert_own_pending" on public.restaurant_reviews;
create policy "reviews_insert_own_pending" on public.restaurant_reviews
  for insert to authenticated with check (
    user_id = (select auth.uid()) and moderation_status = 'pending'
    and moderated_by is null and moderated_at is null
  );
drop policy if exists "reviews_update_own_pending" on public.restaurant_reviews;
create policy "reviews_update_own_pending" on public.restaurant_reviews
  for update to authenticated using (user_id = (select auth.uid()) and moderation_status = 'pending')
  with check (user_id = (select auth.uid()) and moderation_status = 'pending' and moderated_by is null and moderated_at is null);
drop policy if exists "reviews_delete_own_pending" on public.restaurant_reviews;
create policy "reviews_delete_own_pending" on public.restaurant_reviews
  for delete to authenticated using (user_id = (select auth.uid()) and moderation_status = 'pending');
drop policy if exists "reviews_admin_moderate" on public.restaurant_reviews;
create policy "reviews_admin_moderate" on public.restaurant_reviews
  for update to authenticated using ((select public.is_community_admin()))
  with check ((select public.is_community_admin()));

drop policy if exists "reports_insert_own" on public.community_reports;
create policy "reports_insert_own" on public.community_reports
  for insert to authenticated with check (reporter_id = (select auth.uid()) and status = 'pending' and handled_by is null and handled_at is null);
drop policy if exists "reports_read_own_or_admin" on public.community_reports;
create policy "reports_read_own_or_admin" on public.community_reports
  for select to authenticated using (reporter_id = (select auth.uid()) or (select public.is_community_admin()));
drop policy if exists "reports_admin_update" on public.community_reports;
create policy "reports_admin_update" on public.community_reports
  for update to authenticated using ((select public.is_community_admin()))
  with check ((select public.is_community_admin()));

-- Private photo storage. Signed reads are allowed for the owner, admins, and photos on approved reviews.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-review-photos', 'community-review-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "review_photos_public_read" on storage.objects;
drop policy if exists "review_photos_read_author_or_visible_or_admin" on storage.objects;
create policy "review_photos_read_author_or_visible_or_admin" on storage.objects
  for select to anon, authenticated using (
    bucket_id = 'community-review-photos'
    and (
      (select auth.uid())::text = (storage.foldername(name))[1]
      or (select public.is_community_admin())
      or exists (
        select 1 from public.restaurant_reviews
        where restaurant_reviews.moderation_status = 'visible'
          and restaurant_reviews.photo_urls @> array[storage.objects.name]
      )
    )
  );
drop policy if exists "review_photos_upload_own_folder" on storage.objects;
create policy "review_photos_upload_own_folder" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'community-review-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists "review_photos_delete_own_folder" on storage.objects;
create policy "review_photos_delete_own_folder" on storage.objects
  for delete to authenticated using (
    bucket_id = 'community-review-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
