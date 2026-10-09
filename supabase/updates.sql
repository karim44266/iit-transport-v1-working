-- Run ONCE in Supabase > SQL Editor (safe to run again).
-- 1) A driver can read the phone number of riders who requested HIS ride (nobody else can).
create or replace function ride_rider_phones(p_ride uuid) returns table(user_id uuid, phone text) language sql stable security definer set search_path=public as $$
 select q.user_id, p.phone from requests q join profiles p on p.id=q.user_id
 where q.ride_id=p_ride and exists(select 1 from rides r where r.id=p_ride and r.owner_id=auth.uid()) $$;
-- 2) Rides you offered that left more than 24h ago are deleted (with their requests and chat).
create or replace function cleanup_expired() returns void language sql security definer set search_path=public as $$
 delete from rides where owner_id=auth.uid() and (date+departure_time::time)<((now() at time zone 'Africa/Tunis')-interval '1 day') $$;
revoke all on function ride_rider_phones,cleanup_expired from public,anon;
grant execute on function ride_rider_phones,cleanup_expired to authenticated;
