# HOC TAP QUEST — Asset QA Matrix

**Reference concept:** `Giao diện Học Tập Quest fantasy neon.png` (canonical desktop + mobile reference)  
**Inventory branch:** `staging` at `8fd0b46a5cb7c57dde50943099cba10e63010dd0`  
**Matrix branch:** `feat/fantasy-neon-alignment-v1`  
**Scope:** inventory and evidence tracking only; no asset is deleted or rewritten by this document.

## 1. Acceptance rules

- A file's presence in Git does not prove visual suitability, alpha transparency, license compatibility or responsive fit.
- `PASS` requires inspected binary metadata and visual review against the canonical concept.
- `PENDING` means the property has not been verified in this QA pass.
- `BLOCKED` means the required source, permission or evidence is unavailable.
- This matrix does not authorize replacing source art. Existing asset files remain untouched.

## 2. Tracked binary assets

| Path | Size | Intended role | Transparency / visual status | Concept fit | QA |
|---|---:|---|---|---|---|
| `frontend/public/assets/game/backgrounds/world/world_final.jpg` | 576,984 B | Composite concept screenshot; not a standalone background | Binary visual / alpha inspection pending | Compare to canonical concept | PENDING |
| `frontend/public/assets/incoming/bg-world-main.webp` | 478,442 B | Desktop world background | Binary visual / alpha inspection pending | Compare to canonical concept | PENDING |
| `frontend/public/assets/incoming/bg_mobile_9x16.webp` | 562,948 B | Mobile world background | Binary visual / alpha inspection pending | Compare to canonical concept | PENDING |
| `frontend/public/assets/incoming/cup_thu_thach.png` | 1,160,562 B | Daily challenge cup | Binary visual / alpha inspection pending | Compare to canonical concept | PENDING |
| `frontend/public/assets/incoming/kim_cuong_gems.png` | 991,743 B | Gems icon | Prior visual inspection observed solid magenta background; alpha channel not confirmed | Compare to canonical concept | PENDING |
| `frontend/public/assets/incoming/nhan_vat_dong_hanh.png` | 857,379 B | Chiến companion character | Prior visual inspection observed solid magenta background; alpha channel not confirmed | Compare to canonical concept | PENDING |
| `frontend/public/assets/incoming/node_dang_mo.png` | 2,005,939 B | Available quest node | Binary visual / alpha inspection pending | Compare to canonical concept | PENDING |
| `frontend/public/assets/incoming/node_hoan_thanh_vuong_mien.png` | 1,537,465 B | Completed crown node | Binary visual / alpha inspection pending | Compare to canonical concept | PENDING |
| `frontend/public/assets/incoming/node_khoa.png` | 1,028,389 B | Locked quest node | Prior visual inspection observed solid magenta background; alpha channel not confirmed | Compare to canonical concept | PENDING |
| `frontend/public/assets/incoming/nut_bat_dau.png` | 468,287 B | Primary quest action artwork | Prior visual inspection observed solid magenta background; alpha channel not confirmed | Compare to canonical concept | PENDING |
| `frontend/public/assets/incoming/the_xp_18.png` | 420,645 B | XP icon | Binary visual / alpha inspection pending | Compare to canonical concept | PENDING |

## 3. Placeholder-only directories

The following paths contain only `.gitkeep`; they are directory placeholders, not accepted artwork.

- `frontend/public/assets/game/backgrounds/decorations/.gitkeep`
- `frontend/public/assets/game/backgrounds/layers/.gitkeep`
- `frontend/public/assets/game/backgrounds/world/.gitkeep`
- `frontend/public/assets/game/badges/.gitkeep`
- `frontend/public/assets/game/branding/emblem/.gitkeep`
- `frontend/public/assets/game/branding/favicon/.gitkeep`
- `frontend/public/assets/game/branding/logo/.gitkeep`
- `frontend/public/assets/game/characters/avatars/.gitkeep`
- `frontend/public/assets/game/characters/hero/actions/.gitkeep`
- `frontend/public/assets/game/characters/hero/idle/.gitkeep`
- `frontend/public/assets/game/characters/hero/walk/.gitkeep`
- `frontend/public/assets/game/effects/animations/.gitkeep`
- `frontend/public/assets/game/effects/glow/.gitkeep`
- `frontend/public/assets/game/effects/particles/.gitkeep`
- `frontend/public/assets/game/icons/achievements/.gitkeep`
- `frontend/public/assets/game/icons/navigation/.gitkeep`
- `frontend/public/assets/game/icons/rewards/.gitkeep`
- `frontend/public/assets/game/nodes/boss/.gitkeep`
- `frontend/public/assets/game/nodes/challenge/.gitkeep`
- `frontend/public/assets/game/nodes/chapter/.gitkeep`
- `frontend/public/assets/game/nodes/unlock/.gitkeep`
- `frontend/public/assets/game/paths/.gitkeep`
- `frontend/public/assets/game/ui/banners/.gitkeep`
- `frontend/public/assets/game/ui/buttons/.gitkeep`
- `frontend/public/assets/game/ui/navigation/.gitkeep`
- `frontend/public/assets/game/ui/panels/.gitkeep`
- `frontend/public/assets/game/ui/progress/.gitkeep`

## 4. Code usage observed on staging

| UI element | Current implementation | QA note |
|---|---|---|
| Desktop/mobile map | `bg-world-main.webp`, `bg_mobile_9x16.webp` | Separate responsive backgrounds exist |
| Quest nodes | CSS medallions / glyphs | Keep status semantics separate from boss identity |
| Companion | `nhan_vat_dong_hanh.png` | Position and visual edge require review |
| XP | `the_xp_18.png` | Display value from current XP state |
| Gems | UI icon plus hard-coded `120` in prior UI | Display as unavailable until a verified data source exists |
| Daily challenge | `cup_thu_thach.png` | Existing daily quest state remains unchanged |
| Chapter banner | CSS | Rebuilt as responsive parchment; text stays live |
| Quest route | SVG in `App.tsx` | Geometry remains independent; style uses gold/orange dotted line |

## 5. Required follow-up evidence

| Test ID | Check | Evidence required | Status |
|---|---|---|---|
| AST-01 | File existence and byte size | Git tree metadata | PASS |
| AST-02 | Image dimensions and color mode | Binary metadata report | PENDING |
| AST-03 | Alpha channel and transparent edge | Alpha histogram / checkerboard preview | PENDING |
| AST-04 | Magenta-background detection | Mask/edge preview and visual review | PENDING |
| AST-05 | Desktop/mobile crop | Screenshots at 1365×900 and 390×844 | PENDING |
| AST-06 | License and provenance | Completed `ASSET_LICENSES.md` rows | PENDING |
| VIS-01 | Canonical concept fidelity | Side-by-side screenshot review | PENDING |

## 6. Scope guard

No binary asset is modified by this change. No third-party asset is added. No image is marked `VERIFIED` by assumption. The canonical comparison target remains `Giao diện Học Tập Quest fantasy neon.png`.
