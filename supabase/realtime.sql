-- Instant chat + notifications: run ONCE in Supabase > SQL Editor (safe to run again).
do $$ begin alter publication supabase_realtime add table messages; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table requests; exception when duplicate_object then null; end $$;
