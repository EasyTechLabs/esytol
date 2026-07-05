# Brand Assets — Esytol

Status of the site's visual brand assets after ESYTOL-GROWTH-002.

## Implemented (real, generated from the brand mark)

| Asset              | Source                       | Notes                                                                                                             |
| ------------------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Header/footer logo | `components/layout/Logo.tsx` | Inline SVG brand mark ("E" on brand-blue rounded square)                                                          |
| Favicon (SVG)      | `app/icon.svg`               | Next serves as `<link rel="icon" type="image/svg+xml">`; crisp at any size                                        |
| OG / social image  | `app/og/[slug]/route.tsx`    | **Dynamic, branded** OG per calculator (`/og/<slug>`) and site default (`/og/site`) via `next/og` — no static PNG |

The former `public/og-default.png` is **superseded** by the generated OG images
and is no longer referenced.

## Must be supplied by design (cannot be authored faithfully in code)

These are binary raster assets that require real design tooling for quality; the
current files are **functional placeholders**. Replacing them is a design task,
not an engineering one — do **not** invent brand art in code.

| Asset            | File                         | Required spec                                                               |
| ---------------- | ---------------------------- | --------------------------------------------------------------------------- |
| Legacy favicon   | `app/favicon.ico`            | Multi-size `.ico` (16, 32, 48 px) matching the brand mark, for old browsers |
| PWA icon (small) | `public/icon-192.png`        | 192×192 PNG, **maskable** safe-zone (brand mark centered, ~80% keyline)     |
| PWA icon (large) | `public/icon-512.png`        | 512×512 PNG, maskable; used for install prompts / splash                    |
| Apple touch icon | `app/apple-icon.png` _(add)_ | 180×180 PNG, non-transparent background                                     |

Keep the palette consistent with the mark: primary `#2563eb` (brand-600),
background `#ffffff` / `#f9fafb`, text `#111827`. When the final files are ready,
drop them in at the paths above (and add `app/apple-icon.png`); no code change is
needed beyond that.
