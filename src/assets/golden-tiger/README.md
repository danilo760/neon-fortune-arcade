# Golden Tiger premium raster assets

`tiger-master-v2.png` is the identity anchor for the original Neon Fortune
mascot. It is stored as a clean-alpha working PNG so later poses can preserve
the same face, stripe map, crown, vest, medallion, proportions, materials, and
lighting.

`tiger-pose-atlas.webp` is the optimized, browser-decodable RGBA WebP consumed
by the live game.

The asset is 2048×1024, so every pose occupies one 512×512 cell.

Grid layout (4 columns × 2 rows):

1. idle
2. blink
3. watch
4. tense
5. reveal
6. feature
7. win
8. full-grid

Each cell is normalized to the same baseline and optical bounds. The atlas has
genuine transparency and contains no rasterized checkerboard, scene, text, or
cell background.

The source material is not PG SOFT artwork. Fortune Tiger is used only as an
interaction, density, and category-quality reference.

## Symbol family

`premium-symbol-atlas.webp` is a 1536×768 RGBA WebP atlas with eight 384×384
cells. The active order is:

1. orange
2. jade
3. lantern
4. firecracker
5. ingot
6. fortune bag
7. guardian token (the gameplay id remains `lion`)
8. Wild

The matching files under `symbols/` are individual validated exports from the
same cells. Material identity comes from the authored raster art; the UI adds
only restrained state accents. The Wild nameplate is deliberately blank in the
raster and receives exact `WILD` lettering from the React/CSS layer.
