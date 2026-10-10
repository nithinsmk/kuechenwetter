-- The listening log. Paste all of this into Supabase → SQL Editor and press Run.
-- Safe to run more than once.
--
-- Each open radio adds a few rows: one when it opens ('visit'), one a minute while music
-- plays ('listen', with the seconds), and the taps it saw ('tap', what was tapped and how
-- many times). The device is a random id the browser makes up and keeps; nothing personal.
-- Visitors can only add rows, never read them: the keeper desk reads them with the secret key.

create table if not exists public.listen_log (
  id bigint generated always as identity primary key,
  device text not null check (length(device) between 8 and 64),
  kind text not null check (kind in ('visit', 'listen', 'tap')),
  what text check (length(what) <= 60),
  amount integer not null default 1 check (amount between 0 and 3600),
  created_at timestamptz not null default now()
);

create index if not exists listen_log_created_at on public.listen_log (created_at);

alter table public.listen_log enable row level security;

revoke select on public.listen_log from anon, authenticated;
grant insert on public.listen_log to anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'listen_log'
                   and policyname = 'radios can add to the log') then
    create policy "radios can add to the log" on public.listen_log
      for insert to anon, authenticated
      with check (created_at > now() - interval '1 minute');
  end if;
end $$;

notify pgrst, 'reload schema';
