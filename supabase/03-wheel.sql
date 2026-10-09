-- The duty wheel. Paste all of this into Supabase → SQL Editor and press Run.
-- Safe to run more than once.
--
-- Who has which duty is worked out from the calendar (wheel.js), so nothing needs
-- turning by hand. This table only remembers clips moved to "done" and back, which is
-- also the log under the big wheel. Anyone with the link can read it and add a move;
-- nobody can change or delete one, so the log stays honest.

create table if not exists public.wheel_moves (
  id uuid primary key default gen_random_uuid(),
  period integer not null check (period between 0 and 10000),
  clip text not null check (clip in ('P', 'A', 'S', 'E', 'F', 'N')),
  done boolean not null,
  created_at timestamptz not null default now()
);

alter table public.wheel_moves enable row level security;

grant select, insert on public.wheel_moves to anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'wheel_moves'
                   and policyname = 'anyone can read the wheel') then
    create policy "anyone can read the wheel" on public.wheel_moves
      for select to anon, authenticated
      using (true);
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'wheel_moves'
                   and policyname = 'anyone can move a clip') then
    create policy "anyone can move a clip" on public.wheel_moves
      for insert to anon, authenticated
      with check (created_at > now() - interval '1 minute');
  end if;
end $$;

notify pgrst, 'reload schema';
