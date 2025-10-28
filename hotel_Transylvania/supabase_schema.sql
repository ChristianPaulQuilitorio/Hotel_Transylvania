-- Supabase SQL schema for Hotel Transylvania app
-- Paste the contents into Supabase SQL editor (SQL > New query) and run.
-- This creates a profiles table linked to auth.users and example domain tables.

-- 1) Profiles table: stores public profile data linked to auth.users
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text not null unique,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- 2) Rooms table for the app (matches the Angular app expectations)
-- If you previously created a different rooms table, you can drop it first:
-- drop table if exists public.rooms cascade;
create table if not exists public.rooms (
  id int primary key,
  name text not null,
  image text,
  description text,
  short text,
  capacity int not null default 1,
  status text not null default 'available' check (status in ('available','booked')),
  booked_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Enable RLS and basic policies
alter table public.rooms enable row level security;
-- Drop existing policies if they exist (for idempotency on older Postgres)
drop policy if exists "rooms_readable_by_all" on public.rooms;
drop policy if exists "rooms_book_available" on public.rooms;
drop policy if exists "rooms_cancel_own" on public.rooms;
-- Anyone can read rooms (you can restrict to authenticated() if you prefer)
create policy "rooms_readable_by_all" on public.rooms
  for select using (true);
-- Authenticated users can book an available room
create policy "rooms_book_available" on public.rooms
  for update using (auth.uid() is not null and status = 'available')
  with check (status = 'booked' and booked_by = auth.uid());
-- Authenticated users can cancel their own booking
create policy "rooms_cancel_own" on public.rooms
  for update using (auth.uid() = booked_by)
  with check (status = 'available' and booked_by is null);

-- Optional seed data (run once)
insert into public.rooms (id, name, image, description, short, capacity, status, booked_by)
values
  (1, 'Deluxe King', 'assets/rooms/bed1.jpg', 'A spacious deluxe room with a comfortable king-sized bed, modern amenities, and a city view.', 'Spacious room with king bed', 2, 'available', null),
  (2, 'Twin Suite', 'assets/rooms/bed2.jpg', 'A cozy suite featuring two twin beds, perfect for friends or colleagues traveling together.', 'Two beds perfect for friends', 2, 'available', null),
  (3, 'Family Room', 'assets/rooms/bed3.jpg', 'An ideal room for families with additional space and extra bedding available upon request.', 'Ideal for families', 4, 'available', null),
  (4, 'Queen Standard', 'assets/rooms/bed4.jpg', 'A comfortable queen room with all essentials for a pleasant stay at a great rate.', 'Comfortable and affordable', 2, 'available', null),
  (5, 'Executive Suite', 'assets/rooms/bed5.jpg', 'Premium suite with a separate living area, workspace, and luxury amenities.', 'Premium experience', 3, 'available', null)
on conflict (id) do nothing;

-- 3) Customers table (optional duplicate of profiles for non-auth customers)
create table if not exists public.customers (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete set null,
  name text,
  email text,
  phone text,
  notes text,
  created_at timestamptz default now()
);

-- 4) Bookings table: links customers/profiles to rooms
create table if not exists public.bookings (
  id uuid default gen_random_uuid() primary key,
  room_id int references public.rooms(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  checkin_date date not null,
  checkout_date date not null,
  guests int default 1,
  total_amount numeric(10,2) default 0,
  status text default 'booked', -- e.g., booked, cancelled, checked_in, checked_out
  created_at timestamptz default now()
);

-- Indexes for fast lookups
create index if not exists idx_bookings_room on public.bookings(room_id);
create index if not exists idx_bookings_profile on public.bookings(profile_id);
-- Optional helpful index
create index if not exists idx_rooms_status on public.rooms(status);

-- Enable RLS and strict policies for bookings so only owners can manage their rows
alter table public.bookings enable row level security;
-- Drop existing policies if they exist (idempotent re-run)
drop policy if exists "bookings_select_own" on public.bookings;
drop policy if exists "bookings_insert_own" on public.bookings;
drop policy if exists "bookings_update_own" on public.bookings;
-- Users can view only their own bookings (needed for RETURNING on insert/update)
create policy "bookings_select_own" on public.bookings
  for select using (auth.uid() = profile_id);
-- Users can create bookings only for themselves
create policy "bookings_insert_own" on public.bookings
  for insert with check (auth.uid() = profile_id);
-- Users can update only their own bookings (e.g., set status='cancelled')
create policy "bookings_update_own" on public.bookings
  for update using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- 5) Chat logs table for observability (optional)
create table if not exists public.chat_logs (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete set null,
  question text not null,
  answer text not null,
  is_fallback boolean default false,
  intent text,
  created_at timestamptz default now()
);

alter table public.chat_logs enable row level security;
drop policy if exists "chatlogs_select_own" on public.chat_logs;
drop policy if exists "chatlogs_insert" on public.chat_logs;
-- Owners can read their own logs
create policy "chatlogs_select_own" on public.chat_logs
  for select using (auth.uid() = profile_id);
-- Allow inserts by authenticated users; also allow anonymous inserts when profile_id is null
create policy "chatlogs_insert" on public.chat_logs
  for insert with check ((auth.uid() = profile_id) or (profile_id is null));

-- 6) Availability RPCs (SECURITY DEFINER) for safe cross-user checks
-- Function: is_room_available(room_id int, on_date date) -> boolean
drop function if exists public.is_room_available(int, date);
create function public.is_room_available(room_id int, on_date date)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1 from public.bookings b
    where b.room_id = room_id
      and b.status = 'booked'
      and b.checkin_date <= on_date
      and b.checkout_date > on_date
  );
$$;

-- Function: available_rooms_on(on_date date) -> setof int
drop function if exists public.available_rooms_on(date);
create function public.available_rooms_on(on_date date)
returns setof int
language sql
security definer
set search_path = public, pg_temp
as $$
  select r.id
  from public.rooms r
  where not exists (
    select 1 from public.bookings b
    where b.room_id = r.id
      and b.status = 'booked'
      and b.checkin_date <= on_date
      and b.checkout_date > on_date
  )
  order by r.id;
$$;

grant execute on function public.is_room_available(int, date) to authenticated;
grant execute on function public.available_rooms_on(date) to authenticated;

-- NOTE: Supabase sets up auth.users automatically. Use policies to control row-level security (RLS).
-- Example: allow authenticated users to select their own profile (uncomment and adapt before enabling RLS)
-- alter table public.profiles enable row level security;
-- create policy "Profiles are visible to owner" on public.profiles
--   for select using (auth.uid() = id);

-- Optional sample seed data (uncomment to insert):
-- insert into public.rooms (room_number, room_type, description, price, capacity) values
-- ('101','Single','Cozy single room',49.99,1),
-- ('102','Double','Comfortable double room',79.99,2);

-- End of schema
