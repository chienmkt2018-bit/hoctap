# HOC TAP QUEST — Asset Style Guide

**Version:** 1.0  
**Visual direction:** Fantasy adventure, polished game interface, purple–cyan–gold palette  
**Reference:** User-provided HOC TAP QUEST desktop/mobile concept image

## 1. Art direction

Create a welcoming fantasy learning world: magical floating islands, distant castles, layered mountains, luminous paths and a friendly young adventurer. The result should feel like a polished adventure game, not a pixel-art interface and not a generic admin dashboard.

Visual hierarchy:
1. The map and active quest are the primary focus.
2. The player character anchors the map and gives it personality.
3. Locked and completed nodes communicate progression.
4. Panels and navigation support the experience without covering the map.

## 2. Color tokens

Use these as initial design tokens. They are implementation targets, not color values sampled from the reference artwork.

| Token | Hex | Intended use |
|---|---|---|
| `--quest-bg` | `#09091F` | Outer application background |
| `--quest-surface` | `#19113D` | Main panels and sidebar |
| `--quest-surface-raised` | `#2B185B` | Raised cards |
| `--quest-purple` | `#8B45E8` | Primary magical accent |
| `--quest-violet` | `#B58AFF` | Highlight and secondary glow |
| `--quest-cyan` | `#18DDF5` | Selected and active navigation |
| `--quest-gold` | `#FFC52E` | Rewards, XP and primary actions |
| `--quest-orange` | `#FF8B24` | Warm action accent |
| `--quest-text` | `#FFF8FF` | Main text |
| `--quest-muted` | `#C9BCEB` | Secondary text |

Use glow selectively. Do not apply strong bloom to every icon, label or panel.

## 3. Shape, material and depth

- **World:** painted fantasy landscape with atmospheric depth and layered silhouettes.
- **Parchment:** warm parchment, rolled ends, restrained edge shading; no baked-in chapter title or count.
- **Panels:** deep violet surfaces, subtle gradients, thin violet borders and controlled inner highlights.
- **Primary actions:** warm gold/orange, strong contrast, clear pressed and focus states.
- **Active navigation:** cyan border or glow with a distinct selected indicator.
- **Nodes:** circular or emblem-based silhouettes with consistent outer ring, icon scale and label spacing.
- **Corners:** use a consistent radius family; reserve ornate treatments for major game elements.

Avoid excessive bevels, random glow colors, inconsistent border thickness and decorative noise that harms readability.

## 4. Character consistency

The map character and profile avatar must represent the same character. Maintain the same hair shape/color, face, clothing palette, backpack and proportions across all poses. Keep the full-body silhouette readable against bright and dark scenery. Character artwork must have a clean transparent edge when supplied as a standalone asset.

## 5. Node states and semantics

| State | Visual treatment | Meaning |
|---|---|---|
| Locked | Muted artwork, lock overlay, reduced glow | Not currently available |
| Available | Full color, clear active ring, restrained pulse | Can be selected |
| Completed | Completion mark / trophy treatment | Already completed |

Do not communicate state only through hue. Include a lock/check icon, accessible label and appropriate disabled semantics in the UI. Avoid continuous animation on locked nodes.

## 6. Typography and content

- Use a legible rounded sans-serif for Vietnamese UI; choose a font with complete Vietnamese diacritic coverage and a compatible open license.
- Use heavier weights for chapter titles, quest names and primary actions.
- Keep small labels readable on a 390 px mobile viewport.
- Render all labels, numbers, XP, Gems and progress dynamically as text; never bake changing content into images.
- Check line wrapping and diacritics at narrow widths.

## 7. Composition and responsive behavior

- Desktop: sidebar on the left, map as the dominant center canvas, player/status information in compact overlays.
- Mobile: portrait map composition, compact top profile area and bottom navigation; avoid shrinking the desktop layout proportionally.
- Keep important nodes and character inside a safe composition area so responsive cropping does not hide them.
- Reposition or scale map elements from normalized coordinates; do not rely on one fixed pixel layout.
- Keep UI overlays clear of primary quest nodes and labels.

## 8. Motion principles

Motion should communicate state and reward:
- Available node: slow, subtle pulse.
- Route: occasional moving highlight, not a permanently fast animation.
- Reward: brief sparkle/burst on an explicit success event.
- Character: optional idle motion; walking only when movement is meaningful.
- Buttons: short hover/press feedback.

Respect `prefers-reduced-motion`: remove or substantially reduce nonessential movement, particles and pulsing. Never make essential information depend on animation.

## 9. Asset export rules

- Painted environment: WebP preferred for delivery; retain editable/original source where available.
- Transparent character and painted props: WebP with alpha or PNG.
- Icons and paths: SVG preferred.
- Scalable frames: CSS/SVG or 9-slice raster.
- Sprite sheets: consistent frame dimensions, documented frame order, transparent background and metadata.
- Use lowercase kebab-case filenames and stable IDs, e.g. `bg-world-main.webp`, `character-hero-idle.png`, `node-challenge-base.svg`.
- No text, watermarks, UI mockups or unwanted background baked into standalone assets.

## 10. Review checklist

- Matches the fantasy purple/cyan/gold direction.
- Character identity is consistent.
- Silhouette and details remain legible at target size.
- Transparent edges are clean.
- No baked-in dynamic text or UI.
- Correct dimensions, format and optimized size.
- Vietnamese typography is legible where applicable.
- Reduced-motion and state semantics are supported by implementation.
- Source and license are documented.
