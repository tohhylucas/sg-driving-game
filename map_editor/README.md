# SG Driving Map Editor

Standalone browser tool for tracing a satellite or orthophoto image into a
game-previewable `mapData.json`.

The editor is intentionally 2D. It stores editable geometry in image pixels,
then exports world coordinates in meters using the calibrated scale and origin.
The game can preview exported road paths, line markings, symbols, scenery, and
raised kerbs with
`?mapData=/maps/file-name.json`. The default game URL still uses the fixed
training route.

## What You Need

- Node dependencies installed in the repo.
- A PNG, JPEG, or WebP map image. A satellite crop, orthophoto, or simple test
  drawing works.
- At least one known real-world distance in the image for calibration.
  A Singapore lane width is commonly around `3.5` meters.

## 1. Start the Editor

From `map_editor/`:

```powershell
npm install
npm run dev
```

Open the Vite URL, normally:

```text
http://127.0.0.1:5173/
```

## 2. Create a New Map

1. Click `Image` and choose your source image.
2. Edit `Map name` if needed. This becomes `meta.name` in the export.
3. Enter `Known distance (m)`.
4. Click `Calibrate Scale`.
5. Click the first point of the known distance on the canvas.
6. Click the second point. The `Map Panel` should show the new `m/px` scale.
7. Click `Set Origin`.
8. Click the image point that should become world origin `(0, 0)`.

Coordinate rules after export:

- `+X` is right on the image.
- `+Y` is up.
- `-Z` is down-screen from the chosen origin.
- A car driving forward moves toward `-Z`.
- Singapore keep-left defaults still matter when placing a first usable route.

## 3. Trace Road Paths

1. Click `Draw Road Path`.
2. Click ordered points along the road center path.
3. For a curved segment, click the next road point first, then `Ctrl`-click to
   place or move the curve pivot for the latest segment.
4. Press `Enter` to finish the road path.
5. Open `Map Panel`.
6. Select the road path and set:
   - `Lanes on path`
   - `Lane width (m)`
   - `Center marking`
   - `Left edge marking`
   - `Right edge marking`
   - `One-way`

Use one road path per continuous logical centerline. For a loop, click enough
points around the loop and click the start point again as the final point.

## 4. Add Markings and Symbols

1. Choose a symbol type from the symbol dropdown.
2. Click `Place Symbol`.
3. Click-drag from the symbol center.
4. Drag direction sets rotation.
5. Drag distance sets size.
6. Release to place the symbol.

Current game preview support:

- Road surfaces render from road paths.
- Center, left-edge, and right-edge markings render from road path metadata.
- `paintedLines` render, including editable give-way line markings.
- Exported decals and symbols render as road markings.

## 5. Add Scenery and Kerbs

Trees and grass are visual-only scenery. They add 3D vertical reference points
to the game preview and do not affect driving, scoring, or rules.

1. Choose `tree` or `grass` from the scenery dropdown.
2. Click `Place Scenery`.
3. Click-drag from the scenery center.
4. Drag direction sets rotation.
5. Drag distance sets size.
6. Release to place the scenery item.

Kerbs are traced as polylines, similar to road paths, but they export as raised
black-and-white kerb bricks in the game preview.

1. Click `Draw Kerb Line`.
2. Click ordered points along the road edge or kerb edge.
3. Press `Enter` to finish the kerb line.
4. Use `Select/Edit`, `Erase`, or `Delete` to remove a kerb line if needed.

## 6. Fix Mistakes

- `Ctrl+Z`: undo the last edit.
- `Erase`: click an item to remove it.
- `Delete`: remove the selected item.
- `Q` / `E`: rotate a selected symbol or give-way line.
- `Escape`: cancel the current road or kerb draft, or clear selection.
- Hold `Space` and drag: pan.
- Mouse wheel: zoom.
- `Rotate -15`, `Map rotation`, `Rotate +15`, `Reset Rotation`: rotate the view
  while keeping canvas clicks mapped to the image.

The `Shortcuts` button shows the main controls inside the editor.

## 7. Export the Map

1. Click `Export JSON`.
2. Save the downloaded file as a clear name, for example:

```text
my-test-map.json
```

`Export JSON` automatically finishes the active road or kerb draft if it has at
least two points.

## 8. Reopen or Continue a Map

1. Open the editor.
2. Optional: upload the same source image first.
3. Click `Import JSON`.
4. Choose the previously exported `mapData.json`.

If the current image has the same dimensions as the imported map, it stays
behind the imported geometry. If dimensions differ, the geometry imports
without a background image.

Older exports with ordered nodes but no edges are recovered as one editable
road path.

## 9. Preview the Map in the Game

1. Copy the exported JSON into the root app's public map folder:

```powershell
New-Item -ItemType Directory -Force ..\public\maps | Out-Null
Copy-Item .\path\to\my-test-map.json ..\public\maps\my-test-map.json
```

If you are already at the repo root, use:

```powershell
New-Item -ItemType Directory -Force public\maps | Out-Null
Copy-Item .\path\to\my-test-map.json public\maps\my-test-map.json
```

2. Start the game from the repo root:

```powershell
npm install
npm run dev -- --host 127.0.0.1
```

If the editor is still running on `5173`, Vite may choose another port for the
game. Use the game URL printed by the root `npm run dev` command.

3. Open the game with a root-relative `mapData` URL. Replace the host and port
   with the game URL Vite printed:

```text
http://127.0.0.1:5173/?mapData=/maps/my-test-map.json
```

The query string must start with `/maps/...`. Non-root-relative paths are
rejected.

4. Confirm the preview:
   - The fixed training route is replaced by your map.
   - The car still starts at the normal Singapore keep-left spawn.
   - Road surfaces, supported line markings, road symbols, scenery, and raised
     kerbs render.
   - The default URL without `?mapData=...` still loads the fixed training
     route.

## 10. Browser Diagnostic Check

In dev mode, open the browser console on the game preview page and run:

```js
window.__SG_DRIVING_GAME_DEV__.readDiagnostics().previewMap
```

Expected shape:

```js
{
  name: "My Test Map",
  nodeCount: 33,
  edgeCount: 1,
  renderedRoadSegmentCount: 32,
  sceneryCount: 2,
  kerbLineCount: 1
}
```

Counts depend on your map. `renderedRoadSegmentCount` is usually one less than
the node count for a simple closed loop with the first point repeated at the
end.

## 11. Run Verification

From `map_editor/`:

```powershell
npm test
npm run build
```

From the repo root:

```powershell
npm test
npm run build
```

Manual browser checks:

1. Editor opens with no console errors.
2. Source image uploads.
3. Calibration changes `m/px`.
4. Road path can be drawn and selected.
5. `Export JSON` downloads a file.
6. `Import JSON` restores the same road path, scale, origin, and map name.
7. Game preview URL loads without runtime errors.
8. Game diagnostics show the expected `previewMap`, including scenery and kerb
   counts when used.

## Troubleshooting

- Blank game page: check that the JSON file is under `public/maps/`.
- `Unable to load mapData`: check the URL is root-relative, such as
  `?mapData=/maps/my-test-map.json`.
- Unsupported coordinate system: export again from this editor so
  `meta.coordinateSystem` is
  `+X right, +Y up, -Z down-screen from origin`.
- Road appears offset: reopen in the editor and check `Origin`.
- Road appears too large or too small: recalibrate scale and export again.
- Missing scenery or kerbs in game preview: check that the JSON contains
  `scenery` and `kerbLines` arrays and that you opened the game with the
  `?mapData=/maps/...` URL.

## Export Contract

The export type lives in `src/schema.ts`.

Top-level shape:

```json
{
  "version": 1,
  "meta": {
    "name": "Singapore Practice Map",
    "imageWidthPx": 2048,
    "imageHeightPx": 1536,
    "metersPerPixel": 0.05,
    "originPx": 1024,
    "originPy": 768,
    "coordinateSystem": "+X right, +Y up, -Z down-screen from origin"
  },
  "nodes": [],
  "edges": [],
  "decals": [],
  "paintedLines": [],
  "scenery": [],
  "kerbLines": []
}
```

`edges` reference ordered node ids and carry lane metadata:

```json
{
  "id": "e3",
  "nodeIds": ["n1", "n2", "n3"],
  "lanes": 2,
  "laneWidthM": 3.5,
  "oneway": false,
  "markings": {
    "center": "dashed_white",
    "leftEdge": "solid_white",
    "rightEdge": "solid_white"
  },
  "curveControls": [
    {
      "fromNodeId": "n1",
      "toNodeId": "n2",
      "control": { "xM": 5, "yM": 0, "zM": -4 }
    }
  ]
}
```

`decals` are exported as world-space road symbols:

```json
{
  "id": "d4",
  "type": "arrow_straight",
  "xM": 12,
  "yM": 0,
  "zM": -18,
  "rotationDeg": 0,
  "scaleM": 2
}
```

`paintedLines` are exported as editable line-marking polylines:

```json
{
  "id": "l5",
  "style": "solid_white",
  "widthM": 0.15,
  "points": [
    { "id": "l5-p1", "xM": 0, "yM": 0, "zM": 0 },
    { "id": "l5-p2", "xM": 0, "yM": 0, "zM": -10 }
  ]
}
```

Give-way lines use the same export shape with `"style": "give_way_line"`.

`scenery` entries are exported as world-space visual objects:

```json
{
  "id": "s6",
  "type": "tree",
  "xM": -7.5,
  "yM": 0,
  "zM": -12,
  "rotationDeg": 25,
  "scaleM": 5
}
```

`kerbLines` are exported as raised black-and-white kerb polylines:

```json
{
  "id": "k7",
  "widthM": 0.35,
  "heightM": 0.18,
  "points": [
    { "id": "k7-p1", "xM": -5.25, "yM": 0, "zM": 0 },
    { "id": "k7-p2", "xM": -5.25, "yM": 0, "zM": -10 }
  ]
}
```
