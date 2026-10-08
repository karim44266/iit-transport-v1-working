-- Push notifications: run ONCE in Supabase > SQL Editor.
create table if not exists push_subscriptions(id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles on delete cascade, endpoint text not null unique, p256dh text not null, auth_key text not null, created_at timestamptz default now());
alter table push_subscriptions enable row level security;
revoke all on push_subscriptions from anon,authenticated;   -- only the server function reads it
create or replace function save_push(p_endpoint text,p_p256dh text,p_auth text) returns void language plpgsql security definer set search_path=public as $$
begin if auth.uid() is null then raise exception 'Please log in.'; end if;
 delete from push_subscriptions where endpoint=p_endpoint;   -- a phone belongs to the last person who logged in on it
 insert into push_subscriptions(user_id,endpoint,p256dh,auth_key) values(auth.uid(),p_endpoint,p_p256dh,p_auth); end $$;
create or replace function forget_push(p_endpoint text) returns void language sql security definer set search_path=public as $$
 delete from push_subscriptions where endpoint=p_endpoint and user_id=auth.uid() $$;
revoke all on function save_push,forget_push from public,anon;
grant execute on function save_push,forget_push to authenticated;
