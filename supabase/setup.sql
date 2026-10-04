-- Küchenwetter setup. Paste all of this into Supabase → SQL Editor and press Run.
-- Safe to run more than once.
--
-- It makes:
--   requests  the song box: anyone can drop a request in, nobody can read them back
--   tracks    what the radio plays: anyone can read the list, only the keeper adds to it
--   radio     the storage folder for the audio files

-- The song box -------------------------------------------------------------

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  song text not null check (char_length(trim(song)) between 1 and 200),
  created_at timestamptz not null default now(),
  done_at timestamptz
);

alter table public.requests enable row level security;

grant insert on public.requests to anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'requests'
                   and policyname = 'anyone can drop a request in the box') then
    create policy "anyone can drop a request in the box" on public.requests
      for insert to anon, authenticated
      with check (done_at is null);
  end if;
end $$;

-- What the radio plays -----------------------------------------------------
-- A long file (like the mixtape) can be split into parts; parts of the same
-- artist + title always play back to back, in order.

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  artist text not null,
  title text not null,
  part smallint not null default 1,
  file text not null unique,          -- file name inside the "radio" storage folder
  seconds numeric not null check (seconds > 0),
  added_at timestamptz not null default now()
);

alter table public.tracks enable row level security;

grant select on public.tracks to anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'tracks'
                   and policyname = 'anyone can read the track list') then
    create policy "anyone can read the track list" on public.tracks
      for select to anon, authenticated
      using (true);
  end if;
end $$;

-- The audio folder ---------------------------------------------------------
-- Files can be played by their address, but nobody can list or upload.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('radio', 'radio', true, 52428800,
        array['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/x-m4a', 'audio/ogg', 'audio/wav'])
on conflict (id) do nothing;

select 'Küchenwetter is ready' as result;
