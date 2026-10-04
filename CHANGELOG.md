# Versions

Each working prototype is a git tag. Newest first.

| Version | Date | What it does |
| --- | --- | --- |
| v0.7 | 2026-10-04 | Songs can go on air the same day without breaking sync: `keeper.py today ID` (or `add … --today`) pings every open radio, which reloads the song list at once. |
| v0.6 | 2026-10-04 | Published at https://nithinsmk.github.io/kuechenwetter/ (repo nithinsmk/kuechenwetter, commits under GitHub's private email). Adds `label.html`, a printable QR label ("work in progress") pointing to it. |
| v0.5 | 2026-10-04 | Küchenwetter, the radio. `index.html` is now the station: one shuffled broadcast in sync for everyone (reshuffled at Berlin midnight), five weather names claimed per session (the sixth waits outside), an anonymous request box, and the scans swaying behind it (25.09 and 28.09 as compact .spz). About box with Nazif Limpio Saaf and the works. Backend on Supabase (`supabase/setup.sql`); `radio/keeper.py` uploads songs and reads requests. The old viewer is `viewer.html`. |
| v0.4 | 2026-09-29 | Removes the 25 Sep mesh from the scan list; only splats are shown. |
| v0.3 | 2026-09-29 | Your real scans: 25 Sep (a mesh and two splats) and 28 Sep (a splat). The viewer now opens splats (.ply/.spz) as well as meshes. Polycam splats are turned upright automatically, and the camera frames the dense core, not the room-sized shell around it. The compare page lists your scans on each side instead of the public samples. Code shared in `scan.js`. Scan files are kept out of git. |
| v0.2 | 2026-09-28 | Adds `compare.html`: mesh (GLTF) and splat (Splat PLY) side by side, each turnable, with public samples. "Show triangles" reveals the mesh's structure; "flip" turns an upside-down splat. Drop your own exports onto it. The main viewer is unchanged. |
| v0.1 | 2026-09-28 | Opens a 3D scan (GLB) in the browser. Drag to turn, scroll or pinch to zoom, right-drag or two fingers to move, reset view. Lists scans from `scans/scans.json`; `#name` in the URL opens one. Drop a `.glb` on the page to view it without adding it. Works on phones. |
