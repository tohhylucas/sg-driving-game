# SG Driving Map Editor

Standalone, ad-hoc browser tool for tracing a satellite or orthophoto PNG into a
semantic road map for the Three.js driving game.

The editor is intentionally 2D. It exports `mapData.json`; the game can then use
that JSON to build Three.js road meshes, markings, and decals.

## Run

From this folder:

```powershell
npm install
npm run dev
```

Vite prints the local URL, normally `http://127.0.0.1:5173/`.

## Verify

```powershell
npm test
npm run build
```

## Workflow

1. Upload a satellite PNG, JPEG, or WebP from the top toolbar.
2. To continue previous work, choose the previously exported `mapData.json` from
   the JSON file picker. If the currently loaded image has the same dimensions
   as the imported map, it stays behind the imported geometry; otherwise the
   map imports without a background image.
3. Enter the known distance in meters, then use `Calibrate Scale` and click two
   points on the image. The editor draws the first point, preview line, and
   final measured pair. A Singapore lane width is commonly around `3.5` meters
   when a lane is the known reference.
4. Use `Set Origin` to place the game-world origin on the image. If you skip this,
   the origin defaults to the image center.
5. Use `Rotate -15`, `Map rotation`, `Rotate +15`, or `Reset Rotation` to rotate
   the map view while tracing. Clicks, zoom, and canvas editing stay aligned to
   the rotated view.
6. Use `Draw Road Path` to click ordered points along each road center path.
   This defines road topology and lane metadata, not every visible painted
   lane line. After two road points exist, `Ctrl`-click to place a curve pivot
   for the latest segment between those two points. Press `Enter` to finish the
   road. `Export JSON` also finishes the active road path automatically when it
   has at least two points.
7. Use `Select/Edit` to select a road, line marking, node, or symbol.
   Road path lane count, lane width, one-way status, and marking metadata can
   be edited in the `Selected Road Path` controls. With a road path selected,
   `Ctrl`-click near a segment to add or move that segment's curve pivot.
8. Use `Erase` and click an item to remove it directly. This is useful for
   removing unwanted line markings or symbols.
9. Choose a symbol type, use `Place Symbol`, then click-drag on the map. The
   first click sets the symbol center, the drag direction sets rotation, the
   drag distance from center sets size, and releasing the mouse places the final
   symbol. `give_way_line` creates an editable line segment in `paintedLines`,
   so it can meet other road linework.
10. Calibration updates the pixel-to-meter scale immediately, so symbol previews
   resize to real-world meter sizes as soon as the scale is set. The
   `Symbol size (m)` field shows the current placement size and can still set a
   precise fallback size before dragging.
11. Select a symbol or give-way line and press `Q` / `E` to rotate it.
12. Use `Export JSON` to download `mapData.json`.

Canvas controls:

- Hold `Space` and drag to pan.
- Use the mouse wheel to zoom.
- Press `Ctrl+Z` to undo the last edit.
- Press `Delete` to remove the selected road, node, detected line, or symbol.
- `Ctrl`-click while drawing a road path to curve the latest road segment.
- `Ctrl`-click a selected road path segment to add or move its curve pivot.
- Press `Q` / `E` to rotate the selected symbol or selected give-way line.
- Press `Escape` to cancel the current road draft or clear selection.

The `Map Panel` button opens the `Map Status` and selected-item drawer. It shows
the calibrated scale, origin, item counts, current symbol size, and selected
road path or symbol metadata without permanently consuming canvas width. Road
paths also show lane-count badges directly on the canvas.

The `Shortcuts` button in the right-side nav opens a compact reminder for the
keyboard and mouse controls that matter while tracing.

## Export Contract

The export type lives in `src/schema.ts`.

Coordinates are already in meters and follow the game convention:

- `+X` is right.
- `+Y` is up.
- `-Z` is down-screen from the chosen image origin.

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
  "paintedLines": []
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

`decals` are exported as world-space road markings:

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

## Notes

- The editor uses exported `mapData.json` as its ad-hoc save format. Import that
  JSON later to continue editing.
- Older JSON files that contain ordered road points but no road-path edges are
  imported as a single editable road path so the visible line is restored.
- The game-side Three.js builder is not wired in this folder. Import the
  `MapData` contract from `src/schema.ts` or copy it into a future shared map
  module when the runtime starts consuming exported maps.
