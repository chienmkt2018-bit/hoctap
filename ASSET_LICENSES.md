# HOC TAP QUEST — Asset Sources and License Register

**Version:** 1.0  
**Policy:** Free-to-use tools and assets only; license verification required before inclusion.

## 1. Non-negotiable rules

1. Do not purchase assets, subscriptions, stock packs or paid plugins for this work.
2. Free download does not automatically mean commercial use or redistribution is permitted.
3. Record source URL, creator, exact license/version, retrieval date, modifications and intended use for every third-party asset.
4. Verify the asset-specific license before download or commit.
5. Do not commit assets with unclear ownership, incompatible terms or uncertain redistribution rights.
6. Do not copy artwork from reference images, search previews, games or websites without explicit permission for the intended use.
7. Prefer original artwork and permissively licensed resources; retain provenance evidence where practical.
8. This register is a tracking document, not legal advice.

## 2. Sources to evaluate (not blanket approvals)

| Source | Terms to check | Required verification |
|---|---|---|
| Kenney | Exact pack license; many packs are CC0 | Confirm pack page and license |
| OpenGameArt | Varies by asset | Check creator, license and attribution |
| Wikimedia Commons | Varies by file | Check file page and reuse conditions |
| Google Fonts | Exact family license, commonly OFL or Apache | Check family license |
| Heroicons / Lucide | MIT; verify current repository license | Preserve required notices |
| Project-original SVG/CSS | Created for this repository | Record author and source |

## 3. Asset register

| Asset ID / path | Creator | Source URL | Exact license + version | Retrieved | Changes | Attribution | Status |
|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | Not yet populated |

Allowed status values: `PENDING`, `VERIFIED`, `REJECTED`, `REPLACED`.

## 4. Attribution and notices

- Include attribution exactly as required by the license.
- Preserve copyright, license and notice files supplied with packs.
- For CC-BY assets, record creator, title, source, license link and modifications.
- Review share-alike or GPL obligations before distribution.
- Do not remove watermarks or attribution metadata.
- Keep relevant notices alongside the assets or in `public/assets/game/THIRD_PARTY_NOTICES.md`.

## 5. Original and AI-assisted artwork

- Record tool/service, operator, creation date and applicable terms.
- Use only a free-access workflow that permits the intended use; verify terms at creation time.
- Do not assume generated artwork is exclusive, copyrightable or automatically free of third-party rights.
- Do not request imitation of a living artist or reproduction of copyrighted game artwork.
- Keep prompts and source references where useful.

## 6. Free-tool policy

Before adding an external tool, library, font, asset pack or service, verify that no payment or subscription is required for the planned use, its license permits intended distribution, and it introduces no unapproved recurring hosted cost.

## 7. Release gate

An asset cannot be marked `VERIFIED` until its source and exact license have been checked. `PENDING` and `REJECTED` assets must not ship. Reviewers must be able to trace each third-party asset to its source and license record.


## 8. A1 project-original asset record

| Asset path | Creator/source | License status | Notes |
|---|---|---|---|
| `frontend/public/assets/game/backgrounds/world/bg-world-main.svg` | Original SVG authored for HOC TAP QUEST in this repository; no third-party image/font/texture imported | `PROJECT-ORIGINAL — verify repository ownership policy before external redistribution` | Created 2026-11-05. SVG source committed directly to GitHub. No external asset attribution required based on the authored source. |

This record describes the provenance of the authored SVG; it is not a legal determination of copyright ownership.
