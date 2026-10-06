-- IIT Transport: run this ONCE in Supabase > SQL Editor > New query > Run.
create table if not exists profiles(id uuid primary key references auth.users on delete cascade, name text not null, phone text, photo text, created_at timestamptz default now());
create table if not exists routes(id uuid primary key default gen_random_uuid(), owner_id uuid not null references profiles on delete cascade, name text not null, direction text not null check(direction in('to_iit','from_iit')), route_geojson jsonb not null, note text, created_at timestamptz default now());
create table if not exists rides(id uuid primary key default gen_random_uuid(), route_id uuid not null references routes on delete cascade, owner_id uuid not null references profiles on delete cascade, departure_time text not null, date date not null, days text[] default '{}', seats_total int not null check(seats_total between 1 and 8), seats_available int not null check(seats_available>=0), active boolean not null default true, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists requests(id uuid primary key default gen_random_uuid(), ride_id uuid not null references rides on delete cascade, user_id uuid not null references profiles on delete cascade, drop_lat double precision not null, drop_lng double precision not null, status text not null default 'pending' check(status in('pending','accepted','declined')), created_at timestamptz default now(), unique(ride_id,user_id));
create table if not exists messages(id uuid primary key default gen_random_uuid(), ride_id uuid not null references rides on delete cascade, user_id uuid references profiles on delete set null, text text not null check(length(text) between 1 and 500), created_at timestamptz default now());
create index if not exists messages_ride_idx on messages(ride_id,created_at);

-- new user -> profile (name/phone come from the sign-up form)
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into profiles(id,name,phone) values(new.id,coalesce(new.raw_user_meta_data->>'name','User'),new.raw_user_meta_data->>'phone'); return new; end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- helpers
create or replace function ride_open(p_date date,p_time text) returns boolean language sql stable as $$ select (p_date+p_time::time+interval '1 hour')>(now() at time zone 'Africa/Tunis') $$;
create or replace function is_member(p_ride uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from rides where id=p_ride and owner_id=auth.uid()) or exists(select 1 from requests where ride_id=p_ride and user_id=auth.uid() and status='accepted') $$;

-- row level security
alter table profiles enable row level security; alter table routes enable row level security; alter table rides enable row level security; alter table requests enable row level security; alter table messages enable row level security;
-- profiles: everyone sees name+photo only. The phone column is NOT readable directly.
revoke all on profiles from anon,authenticated;
grant select(id,name,photo,created_at) on profiles to anon,authenticated;
grant update(name,phone,photo) on profiles to authenticated;
drop policy if exists p_sel on profiles; create policy p_sel on profiles for select using(true);
drop policy if exists p_upd on profiles; create policy p_upd on profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
-- rides: public while open; owner and accepted riders always
drop policy if exists r_sel on rides; create policy r_sel on rides for select using((active and ride_open(date,departure_time)) or owner_id=auth.uid() or is_member(id));
drop policy if exists r_ins on rides; create policy r_ins on rides for insert to authenticated with check(owner_id=auth.uid() and seats_available=seats_total and exists(select 1 from routes where id=route_id and owner_id=auth.uid()));
drop policy if exists r_upd on rides; create policy r_upd on rides for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
drop policy if exists r_del on rides; create policy r_del on rides for delete to authenticated using(owner_id=auth.uid());
-- routes
drop policy if exists ro_sel on routes; create policy ro_sel on routes for select using(owner_id=auth.uid() or exists(select 1 from rides r where r.route_id=routes.id and ((r.active and ride_open(r.date,r.departure_time)) or is_member(r.id))));
drop policy if exists ro_ins on routes; create policy ro_ins on routes for insert to authenticated with check(owner_id=auth.uid());
drop policy if exists ro_del on routes; create policy ro_del on routes for delete to authenticated using(owner_id=auth.uid());
-- requests: read-only for clients (all changes go through the functions below)
drop policy if exists q_sel on requests; create policy q_sel on requests for select to authenticated using(user_id=auth.uid() or exists(select 1 from rides r where r.id=ride_id and r.owner_id=auth.uid()) or (status='accepted' and is_member(ride_id)));
-- chat: only the driver and accepted riders
drop policy if exists m_sel on messages; create policy m_sel on messages for select to authenticated using(is_member(ride_id));
drop policy if exists m_ins on messages; create policy m_ins on messages for insert to authenticated with check(user_id=auth.uid() and is_member(ride_id));

-- actions (atomic, so two people can never take the last seat)
create or replace function apply_ride(p_ride uuid,p_lat float8,p_lng float8) returns void language plpgsql security definer set search_path=public as $$
declare r rides; begin
 if auth.uid() is null then raise exception 'Please log in.'; end if;
 select * into r from rides where id=p_ride for update;
 if not found or not r.active or not ride_open(r.date,r.departure_time) then raise exception 'This ride is no longer available.'; end if;
 if r.owner_id=auth.uid() then raise exception 'This is your own ride.'; end if;
 if r.seats_available<1 then raise exception 'This ride is full.'; end if;
 if exists(select 1 from requests where ride_id=p_ride and user_id=auth.uid() and status<>'declined') then raise exception 'You already requested this ride.'; end if;
 delete from requests where ride_id=p_ride and user_id=auth.uid();
 insert into requests(ride_id,user_id,drop_lat,drop_lng) values(p_ride,auth.uid(),p_lat,p_lng); end $$;
create or replace function decide_request(p_req uuid,p_accept boolean) returns void language plpgsql security definer set search_path=public as $$
declare q requests; r rides; nm text; begin
 select * into q from requests where id=p_req for update; if not found then raise exception 'Request not found.'; end if;
 select * into r from rides where id=q.ride_id for update;
 if r.owner_id is distinct from auth.uid() then raise exception 'Not your ride.'; end if;
 if not p_accept then update requests set status='declined' where id=p_req; return; end if;
 if r.seats_available<1 then raise exception 'No seats left on this ride.'; end if;
 update requests set status='accepted' where id=p_req;
 update rides set seats_available=seats_available-1,updated_at=now() where id=r.id;
 delete from requests where user_id=q.user_id and status='pending' and id<>p_req; -- his other pending requests are removed
 select name into nm from profiles where id=q.user_id;
 insert into messages(ride_id,user_id,text) values(r.id,null,nm||' joined the ride'); end $$;
create or replace function cancel_request(p_ride uuid) returns void language plpgsql security definer set search_path=public as $$
declare q requests; nm text; begin
 select * into q from requests where ride_id=p_ride and user_id=auth.uid(); if not found then return; end if;
 delete from requests where id=q.id;
 if q.status='accepted' then
  update rides set seats_available=least(seats_total,seats_available+1),updated_at=now() where id=p_ride;
  select name into nm from profiles where id=auth.uid();
  insert into messages(ride_id,user_id,text) values(p_ride,null,nm||' left the ride'); end if; end $$;
create or replace function driver_phone(p_ride uuid) returns text language sql stable security definer set search_path=public as $$
 select p.phone from rides r join profiles p on p.id=r.owner_id where r.id=p_ride and auth.uid() is not null $$;
create or replace function my_profile() returns table(id uuid,name text,phone text,photo text) language sql stable security definer set search_path=public as $$
 select id,name,phone,photo from profiles where id=auth.uid() $$;
revoke all on function apply_ride,decide_request,cancel_request,driver_phone,my_profile from public,anon;
grant execute on function apply_ride,decide_request,cancel_request,driver_phone,my_profile,is_member to authenticated;
grant execute on function ride_open to anon,authenticated;
