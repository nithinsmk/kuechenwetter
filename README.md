# drainer

A web page for viewing the 3D scans of the kitchen drainer (Site-responsive Sound, UdK Berlin, 2026).

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
