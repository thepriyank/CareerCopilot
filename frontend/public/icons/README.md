# App icons — drop-in slot

The PWA currently ships **placeholder** icons (`icon.svg`,
`icon-maskable.svg` — a plain teal "J"). Replace them with the real brand
assets when the logo is designed. Nothing else about the PWA needs to
change to swap these in.

## Files to provide

| File | Size | Format | Purpose | Referenced by |
|---|---|---|---|---|
| `icon-192.png` | 192×192 | PNG (opaque) | Android home screen, older Chrome | `src/app/manifest.ts` |
| `icon-512.png` | 512×512 | PNG (opaque) | Android splash, install dialog | `src/app/manifest.ts` |
| `icon-maskable-512.png` | 512×512 | PNG (opaque) | Adaptive icon (Android) | `src/app/manifest.ts` |
| `apple-touch-icon.png` | 180×180 | PNG (opaque, no transparency) | iOS "Add to Home Screen" | `src/app/layout.tsx` (`icons.apple`) |
| `favicon.ico` *(optional)* | 16/32/48 multi-res | ICO | Browser tab | drop at `src/app/favicon.ico` |

## Maskable safe zone

`icon-maskable-512.png` gets cropped by the OS to a circle / squircle /
rounded square depending on the device. Keep all meaningful content
(logo mark, letterforms) **inside the center 80%** — i.e. within a circle
of radius ~205px centered on the 512px canvas. The background must fill
the entire canvas edge to edge (no transparent margin, no pre-rounded
corners — the OS adds those).

`icon-192.png` / `icon-512.png` are **not** masked — they can use the
final rounded-square shape directly, with a little padding.

## Swapping them in

1. Drop the PNG files into this directory (`frontend/public/icons/`).
2. In `src/app/manifest.ts`: uncomment the PNG block in the `icons`
   array and delete the two SVG placeholder entries.
3. In `src/app/layout.tsx`: the `icons.apple` entry already points at
   `/icons/apple-touch-icon.png` — it just starts resolving once the
   file exists.
4. Delete `icon.svg` and `icon-maskable.svg`.
5. `npm run build` and re-verify the install (see `docs/pwa.md`).

Placeholder color is `#12A29B` (an approximation of the app's
`--accent` teal) — the real assets set their own colors.
