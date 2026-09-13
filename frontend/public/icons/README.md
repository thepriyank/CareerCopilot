# App icons — JobMagnate mark

Real brand assets, sourced 2026-09-11 from the Claude Design canvas
**"NowMagnate Logo System"** (the shared brand system across NowMagnate /
JobMagnate / YouMagnate — "Upright interlock" style: one fixed black `M`,
each product's initial letter locked in front of it in its own shade).
JobMagnate's is a green `J` interlocked with a black `M`, chartreuse-teal
hue (~145°).

## Files

| File | Size | Purpose |
|---|---|---|
| `icon-512.png` | 512×512, transparent→white bg, RGBA | `any` — Android/Chrome install, splash |
| `icon-maskable-512.png` | 512×512, opaque white, full-bleed | `maskable` — Android adaptive icon (mark kept inside the safe zone; see below) |
| `apple-touch-icon.png` | 180×180, opaque white, RGB | iOS "Add to Home Screen" |
| `logo-mark.png` | 460×139, transparent | Compact inline mark for in-app UI (e.g. the sidebar logo badge) — **not** referenced by the manifest, only by app components |

All four are derived from one exported source
(`JobMagnate-icon-512.png`, captured directly from the design canvas) via
a local Pillow script: the JM glyph was extracted by its own pixel colors
(ignoring the canvas's white tile and border), then re-composited onto
purpose-built canvases — plain edge-to-edge square for `icon-512`/
`apple-touch-icon`, and scaled down further for `icon-maskable-512` so it
sits well inside the ~66% safe-zone circle every Android mask shape
guarantees.

## Exact colors (from the design canvas)

- J green: `#5bb661`
- M black: `#12110f`
- Tile / background: `#ffffff`

## Regenerating

If the mark changes (new export from the design canvas, or a size is
missing — e.g. a 192×192 wasn't produced since Android/Chrome scale a
512 icon down fine), redo the same extract-and-recompose step with
Pillow: threshold the source image by proximity to the two brand colors
above (with an alpha check) to get the tight glyph crop, then paste it
onto new canvases at whatever size/safe-zone-fraction is needed. No
proprietary tooling required — Pillow only.

## Maskable safe zone (for reference)

Android crops `icon-maskable-512.png` to a circle / squircle / rounded
square depending on the device launcher. Keep all meaningful content
within the center ~66–80% of the canvas (a circle of radius ~170–205px
on this 512px canvas) — `icon-maskable-512.png` already does this with
margin to spare.
