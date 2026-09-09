# Golden Tiger — premium art bible

Date: 2026-09-09

Scope: Session 1 — mascot, symbol family, and their first in-game integration.

Reference: PG SOFT's official Fortune Tiger game page and game-information PDF, used only as a commercial category benchmark. All Neon artwork must remain original.

## 1. Creative north star

**Original oriental fantasy at a nocturnal prosperity festival.** The experience should feel warm, abundant, tactile, and theatrical: deep lacquer red, rich warm gold, polished jade, lantern light, burgundy-brown shadows, and restrained sparks.

This is a category change, not another glow pass. Perceived quality must come from authored form, materials, lighting, expression, and composition before CSS effects are added.

## 2. Benchmark matrix

| Criterion | Official category reference | Current Neon asset | Gap | Required action |
| --- | --- | --- | --- | --- |
| Mascot | Large 3D character acts above and into the reel composition | Eight frontal, near-identical cutout poses | Weak acting, limited depth, sticker silhouette | Establish one original master identity, then derive readable poses with body turns, hands, gaze, and foreshortening |
| Fur and face | Rounded volume, soft fur breakup, expressive brows/muzzle | Smooth vector-like gradients and hard contour | Material reads as clipart | Add fur volume, muzzle softness, whisker detail, facial planes, and convincing shadow transitions |
| Costume and gold | Cloth, polished trim, and accessories react differently to light | Red/gold surfaces share the same glossy treatment | Materials collapse into one finish | Separate silk/lacquer, embroidered cloth, polished gold, gemstone, and fur responses |
| Symbols | Compact silhouettes with distinct materials and immediate value hierarchy | Source images contain dark plaques, horizontal export bars, and baked halos | Assets do not sit naturally inside reel cells | Rebuild eight clean-alpha symbols with matched camera/light and material-specific rendering |
| Atlas integrity | Clean, production-ready raster sprites | Symbol atlas does not decode in the local image inspector; tiger cells contain checker residue | Pipeline is not shippable | Rebuild from validated RGBA masters; verify decode, alpha, bounds, and sprite coordinates |
| Character/reels | Character is visually connected to the cabinet and reacts to play | Mascot reads as a centered picture placed above UI | Stage lacks ownership of reels | Use overlapping silhouette, gaze, hands/props, cast light, and contact shadow to bind the stage to the cabinet |
| Mobile density | Portrait frame is continuously composed with a dominant middle grid | Good base palette, but hero area has dead air around a compact cutout | Weak vertical energy | Fill the upper stage with character gesture and light while preserving reel and control readability |

## 3. Palette and lighting

Core palette:

- deep red: `#5A0908` to `#8F1510`
- lacquer highlight: `#D8331E`
- warm gold midtone: `#E7A72C`
- gold highlight: `#FFE39A`
- gold shadow: `#8A4B09`
- jade midtone: `#20A66A`
- jade light: `#7CE0A5`
- jade shadow: `#075A3B`
- burgundy-brown shadow: `#2B0505` / `#3B160A`

Lighting recipe:

- key: warm gold-orange from upper front/side;
- rim: warm yellow, narrow and deliberate;
- fill: dim red bounce from the cabinet/festival environment;
- shadows: burgundy-brown, never neutral gray;
- brightest accents: eyes, crown jewel, polished gold edges, and Wild hierarchy only.

Avoid uniform glow. Light must describe the underlying form and surface.

## 4. Master Tiger identity lock

The master is an original, friendly, rounded premium tiger in high-detail 2.5D illustration. It must remain recognizable across every pose through these invariants:

- broad rounded head; short soft muzzle; small rounded ears;
- amber-brown eyes with warm catchlights and expressive dark brows;
- symmetrical forehead trident stripe plus stable cheek and forearm stripe map;
- saturated orange fur, cream muzzle/chest/paws, dark chocolate stripes;
- small gold crown with one central deep-red gemstone;
- deep-red festival vest/collar with gold embroidery and piping;
- circular gold prosperity medallion with a square center opening, no letters;
- compact plush torso, large paws, short legs, thick ringed tail;
- three-quarter camera language preferred over flat front view;
- same warm key, yellow rim, burgundy shadow, and lens perspective in every pose.

Required pose read:

| Pose | Acting direction |
| --- | --- |
| idle | relaxed three-quarter stance, confident friendly smile, one paw grounded near the cabinet |
| blink | idle continuity frame; eyelids are the primary change |
| watch | head, eyes, and near paw pull toward the reels |
| tense | lowered center of gravity, focused eyes, compressed shoulders/paws |
| reveal | open expression and outward presenting gesture toward the result |
| feature | clearly presents a neutral gold/jade prosperity token; no text |
| win | broad celebratory gesture with readable asymmetric body action |
| full-grid | strongest pose, lifted paws, larger arc of motion and premium gold energy |

Optional only after the identity is stable: anticipation, sticky-hit, big-win.

Reject a pose if head shape, eye design, stripe map, crown, vest, medallion, proportions, camera, or lighting makes it look like a different character.

## 5. Symbol family

All symbols use the same three-quarter product-render camera, warm upper-left key, fine yellow rim, burgundy contact shadow, and clean alpha. Optical size is normalized at reel scale, but silhouette and material response stay distinct.

| Symbol | Material read | Hierarchy cue |
| --- | --- | --- |
| orange | dimpled peel, juicy volume, waxy leaf | simple round low-value silhouette |
| jade | polished semi-translucent carved stone | cool internal scatter against warm family |
| lantern | red lacquered silk/paper with internal light | warm translucent glow, visible ribs |
| firecracker | rolled red paper, gold caps, braided fuse | clustered diagonal silhouette, small spark only at fuse |
| ingot | dense polished gold with embossed relief | broad clean specular and deep reflected shadow |
| fortune bag | gathered red textile, gold embroidery, braided cord | soft folds and stitched detail, no generated writing |
| guardian/token | carved jade and gold architectural medallion | crisp relief and weight; no mascot face reuse |
| Wild | master tiger portrait integrated into the richest gold/red frame | largest contrast, sharpest face, strongest rim; exact `WILD` text may remain UI-authored rather than baked |

No shared generic plaque, halo, or gloss overlay may be baked over all eight forms. No Chinese characters or other generated text is permitted inside source imagery.

## 6. Raster production contract

- Use lossless working PNG with genuine alpha; export optimized WebP for the app.
- No checkerboard pixels, random backgrounds, export bars, watermarks, or baked reel-cell frame.
- Keep edge colors premultiplied cleanly to avoid light or dark halos.
- Normalize transparent padding and optical center per cell.
- Mascot atlas: 4 columns × 2 rows, one pose per equal cell, consistent baseline and safe padding.
- Symbol atlas: 4 columns × 2 rows, one symbol per equal cell, consistent bounds and no cross-cell bleed.
- Validate every final file by decoding it, checking RGBA/alpha extrema, checking visible bounds, and rendering atlas cells individually.
- Keep source and exported dimensions proportional to actual mobile display needs; do not ship oversized art merely to hide weak crops.

## 7. In-game integration rules

- Integrate assets into `GoldenTigerTigerStage.tsx`, `GoldenTigerSymbols.tsx`, and the active Golden presentation CSS.
- The tiger must overlap/connect with the cabinet through pose, contact shadow, and matched light, without covering reel information.
- UI glow and win animation may accent authored art but must not supply missing volume or material.
- Preserve 3×3, five fixed paylines, Turbo, Auto, Fortune Feature, sticky respins, full-grid ×10, balance/history, settlement, and the current 31× Bonus Buy cost.
- Do not touch Olympus, Candy, Mines, Plinko, math, audio, or Session 2 motion scope.

## 8. Acceptance gate for Session 1

The session passes only when:

1. all eight mandatory Tiger poses preserve one identity and read distinctly at mobile size;
2. all eight symbols decode, have true alpha, contain no export artifacts, and show materially different surfaces;
3. the active game imports the new atlases and renders every atlas cell at the correct position;
4. the character and symbols create an obvious visual category shift without a screenshot-as-background shortcut;
5. typecheck and production build pass;
6. idle/spin visual QA passes at 360×800, 390×844, 430×932, plus desktop inspection;
7. the branch remains isolated, unmerged, and unpublished.

## 9. Source boundary

Reference sources:

- https://www.pgsoft.com/games/110/
- https://www.pgsoft.com/uploads/Games/Pdf/Fortune_Tiger_Gameinformation_EN.pdf

Use them to study density, hierarchy, acting, materials, lighting, and mobile composition only. Do not copy PG SOFT assets, mascot design, symbol design, typography, audio, reel strips, private math, or frame-by-frame animation.
