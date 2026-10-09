# drainer

Küchenwetter: a private radio for one kitchen, over 3D scans of its dish drainer
(Site-responsive Sound, UdK Berlin, 2026). Live at https://nithinsmk.github.io/kuechenwetter/ (GitHub Pages, built from `main`).
`index.html` is the station; `label.html` is the printable QR label; `viewer.html` and
`compare.html` are the earlier scan tools.

## The radio

- Everyone hears the same song at the same moment. The day's order is a shuffle seeded with the
  Berlin date, built from every track added before that midnight, and looped all day.
- Five weather names are claimed per visit (Supabase Realtime presence); the sixth visitor waits.
- Requests go into a table nobody can read back except the keeper.
- Backend: Supabase. `supabase/setup.sql` makes the tables, rules and the `radio` audio folder.
  Secrets live in `.env` (not in git); `config.js` holds only the public address and publishable key.

## The keeper desk

Run `python3 desk/server.py` and open http://localhost:8772/desk/ (local only; it holds the secret key).

## The keeper's command line

```
python3 radio/keeper.py requests
python3 radio/keeper.py add radio-inbox/song.mp3 --artist "…" --title "…"        # airs from next midnight
python3 radio/keeper.py add radio-inbox/song.mp3 --artist "…" --title "…" --today
python3 radio/keeper.py add-mix radio-inbox/mixtape --title "…"                   # files named "01 Artist - Song.mp3", played in order
python3 radio/keeper.py today <track id>                                          # an added track, on air now
python3 radio/keeper.py done <request id>
python3 radio/keeper.py tracks
```

Every song goes up as a 128 kbps MP3, converted by `keeper.py` with ffmpeg (`brew install ffmpeg`), so MP3, FLAC, WAV, M4A, OGG and AIFF can all be handed in. At 128 kbps the free plan's 5 GB of streaming is about 90 hours of listening a month, all listeners together.

## Scans for the radio

`scans/series.json` lists the scans the radio shows, with where to point the camera. Each is a
Polycam Splat PLY converted to `.spz` and turned upright:

```
npx @playcanvas/splat-transform in.ply -r 180,0,0 --spz-version 3 out.spz
```

## Run it on your Mac

```
python3 -m http.server 8770 --directory ~/drainer
```

Then open http://localhost:8770.

## Add a scan

1. In Polycam: open the scan → Export → **GLB**.
2. Put the file in `scans/`.
3. Add its file name to `scans/scans.json`, e.g. `["2026-09-28.glb", "2026-09-30.glb"]`. The list shows in that order.

To just look at an export without adding it, drag the `.glb` onto the open page.

`scans/test-shape.glb` is a stand-in until real scans arrive.

## Link to one scan

Add its name after `#`: `http://localhost:8770/#2026-09-28`.

## Versions

Every working prototype is tagged in git and listed in `CHANGELOG.md`.
To look at an older one: `git checkout v0.1`. To come back: `git checkout main`.

## Compare mesh and splat

`http://localhost:8770/compare.html` shows a GLTF mesh and a Splat PLY side by side.
Each side lists your scans of that kind. Drop other exports onto it: a `.glb` (or a `.gltf` together with its `.bin` and textures) and a `.ply`.
