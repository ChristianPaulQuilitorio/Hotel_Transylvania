-- Ratings table schema for Hotel Transylvania
-- Apply in Supabase SQL Editor (Project > SQL > New Query) or using migrations.

-- 1) Table
create table if not exists public.ratings (
  room_id int not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ratings_pk primary key (room_id, user_id)
);

-- 2) Updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_ratings_updated_at on public.ratings;
create trigger trg_ratings_updated_at
before update on public.ratings
for each row execute procedure public.set_updated_at();

-- 3) Helpful indexes
create index if not exists idx_ratings_room on public.ratings(room_id);
create index if not exists idx_ratings_user on public.ratings(user_id);
create index if not exists idx_ratings_rating on public.ratings(rating);

-- 4) Enable Row Level Security
alter table public.ratings enable row level security;

-- 5) Policies (Postgres doesn't support IF NOT EXISTS for CREATE POLICY)
-- Safe pattern: drop if exists, then create
drop policy if exists ratings_select_any on public.ratings;
create policy ratings_select_any
  on public.ratings for select
  using (true);

-- Only the logged-in user can insert their own rating
drop policy if exists ratings_insert_self on public.ratings;
create policy ratings_insert_self
  on public.ratings for insert
  with check (auth.uid() = user_id);

-- Only the owner can update their rating
drop policy if exists ratings_update_self on public.ratings;
create policy ratings_update_self
  on public.ratings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- (Optional) Allow users to delete their own rating
drop policy if exists ratings_delete_self on public.ratings;
create policy ratings_delete_self
  on public.ratings for delete
  using (auth.uid() = user_id);

-- 6) Aggregation view (optional but handy)
create or replace view public.ratings_summary as
  select room_id,
         avg(rating)::numeric(3,2) as avg_rating,
         count(*)::int as rating_count
  from public.ratings
  group by room_id;

-- Grant access to the view
grant select on public.ratings_summary to anon, authenticated;
