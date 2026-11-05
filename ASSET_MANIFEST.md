# HOC TAP QUEST — Asset Manifest

**Version:** 1.0  
**Scope:** Fantasy Game UI MVP  
**Status:** Planning / asset placeholders only  
**Target branch:** `feat/fantasy-game-assets-v1`

## 1. Purpose

This manifest defines the visual assets required to reproduce the approved HOC TAP QUEST fantasy-map reference across desktop and mobile. It is the inventory and acceptance checklist; it does not imply that listed artwork has already been created or licensed.

## 2. MVP inventory

| ID | Asset | MVP quantity | Format / implementation | Priority | Acceptance criteria |
|---|---|---:|---|---|---|
| BG-01 | Main floating-island fantasy map | 1 | WebP/PNG, landscape master | P0 | No baked-in UI, text, logo, nodes or character; readable map composition |
| BG-02 | Background / midground / foreground layers | 3 layers | WebP/PNG with transparency where needed | P1 | Independently positionable for restrained parallax |
| CH-01 | Main adventurer, full body | 1 | Transparent PNG/WebP | P0 | Consistent proportions, clean silhouette, usable at desktop/mobile sizes |
| CH-02 | Player avatar portrait | 1 | PNG/WebP | P0 | Same character design as CH-01; square crop safe |
| ND-01 | Chapter / boss node | 1 base | SVG or transparent PNG | P0 | Recognizable crown/chapter marker; supports locked, available and completed states |
| ND-02 | Quick challenge node | 1 base | SVG or transparent PNG | P0 | Lock and challenge variants can be composed without redrawing |
| ND-03 | Knowledge unlock node | 1 base | SVG or transparent PNG | P0 | Distinct from challenge and chapter nodes |
| ND-04 | Thinking / active quest node | 1 base | SVG or transparent PNG | P0 | Clear active state and readable at small sizes |
| PT-01 | Dotted quest route | 1 | SVG / PixiJS Graphics | P0 | Geometry independent from background and node artwork |
| IC-01 | XP, Gems, Trophy, Fire, Lock, Star, Compass | 7 | SVG / transparent PNG | P0 | Consistent visual family and legible at 24–64 px |
| IC-02 | Navigation: Home, Map, Book, Practice, Profile, Settings | 6 | SVG | P0 | Normal and selected states; selected state may be CSS |
| UI-01 | Chapter parchment banner | 1 | 9-slice PNG/SVG/CSS | P0 | Scales without stretching decorative corners |
| UI-02 | Dark fantasy panel / card | 1 base | CSS/SVG/9-slice | P0 | Supports variable content and responsive width |
| UI-03 | Primary quest button | 1 base | CSS/SVG | P0 | Default, hover, focus, pressed and disabled states |
| UI-04 | XP progress bar | 1 component | CSS/SVG | P0 | Dynamic fill and accessible text value |
| UI-05 | Player, daily quest and reward cards | 3 components | HTML/CSS | P0 | Text and numbers remain live data, not baked into images |
| FX-01 | Glow, pulse and sparkle | 3 effects | CSS/SVG/PixiJS | P1 | Respects reduced-motion preference |
| BD-01 | Logo / emblem | Existing asset or 1 approved source | SVG/PNG | P0 | Brand use approved; transparent background |
| BD-02 | Achievement badge starter set | 3 | SVG/transparent PNG | P1 | Consistent badge family |

## 3. Deferred assets

- Character walk / idle sprite sheets and expressive poses.
- Additional scenery, waterfalls, foliage, rocks and decorative props.
- Reward burst, level-up, unlock and treasure particle effects.
- Expanded achievement badge collection and seasonal variants.
- Additional chapter environments and biome themes.

Deferred items must not block the first responsive map prototype.

## 4. State model

Node state is data-driven: `locked`, `available`, `completed`. Prefer one reusable base texture with code-driven overlays, tint, opacity, glow and badges instead of exporting a separate full image for every state. State must also be conveyed semantically in the UI, not by color alone.

## 5. Responsive and technical rules

- Maintain one shared source asset set for desktop and mobile.
- Keep map art, characters, nodes, route, labels and UI as independent layers.
- Keep all text, XP, Gems, progress values and quest labels out of raster artwork.
- Prefer SVG for icons and route geometry; use WebP/PNG for painted scenery and character art.
- Use 9-slice or CSS layout for scalable panels and banners.
- Provide meaningful filenames, dimensions, source/license records and optimized file sizes.
- Avoid committing generated build output, duplicate exports or unapproved third-party artwork.

## 6. Completion tracking

An asset is **accepted** only when its source, author, license, dimensions, format, intended use and visual review status are recorded in `ASSET_LICENSES.md`. A placeholder folder or manifest row is not evidence that an asset exists.

| Milestone | Exit condition |
|---|---|
| MVP inventory | P0 rows reviewed and approved |
| Visual baseline | Main background, hero, nodes and route visually consistent |
| UI baseline | Banner, panels, button, progress and core icons usable |
| Responsive check | Same assets work at 390×844 and desktop viewport |
| License check | Every non-original asset has a verifiable compatible license |


## 7. A1 delivery — Main fantasy background

| ID | Path | Status | Notes |
|---|---|---|---|
| BG-01 | `frontend/public/assets/game/backgrounds/world/bg-world-main.svg` | `CREATED — VECTOR BASELINE` | Original 2560×1440 SVG; layered sky, moon, mountains, distant castle, floating islands, waterfalls, clouds and foreground. No UI, text, character or quest nodes. |

This is an original stylized vector baseline, not a painted/raster illustration. Review visual fidelity and responsive crops before treating it as final art direction. It can be rendered to WebP later using a free tool if a raster delivery is required.
