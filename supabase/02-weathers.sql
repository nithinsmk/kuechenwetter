-- Küchenwetter: weather playlists. Paste into Supabase → SQL Editor and press Run.
-- Safe to run more than once.
--
-- Each request can suggest a weather, and each song can belong to one.
-- Songs with no weather belong to نظيفة and play between the weathers.

alter table public.requests add column if not exists weather text;
alter table public.tracks add column if not exists weather text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'requests_weather_check') then
    alter table public.requests add constraint requests_weather_check check (weather in
      ('fog_before_dawn', 'clearing_by_noon', 'showers_late_afternoon', 'humid_at_dusk', 'rain_after_midnight'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tracks_weather_check') then
    alter table public.tracks add constraint tracks_weather_check check (weather in
      ('fog_before_dawn', 'clearing_by_noon', 'showers_late_afternoon', 'humid_at_dusk', 'rain_after_midnight'));
  end if;
end $$;

notify pgrst, 'reload schema';

select 'weather playlists are ready' as result;
