# Fortune Tiger verification pass — 2026-09-08

This pass re-checks the Golden Tiger reference dossier against current public material before and during implementation.

## Official PG SOFT facts re-verified

Primary sources:
- https://www.pgsoft.com/uploads/Games/Pdf/Fortune_Tiger_Gameinformation_EN.pdf (latest update shown by PG: 08/07/2025)
- https://www.pgsoft.com/news/88/
- https://www.youtube.com/watch?v=EdBYVZRUtZY (official PG SOFT channel)

Confirmed:
- 3 reels × 3 rows.
- 5 fixed paylines: middle, top, bottom and the two diagonals.
- Standard spinning reels.
- Wild substitutes for all symbols.
- Medium session volatility.
- RTP 96.81% in the published reference configuration.
- Overall hit rate 23.15%; main game 22.16%; Fortune Tiger Feature hit rate 0.99%.
- Advertised maximum win 2500× total bet.
- Optimal published display reference 1080×2340, required aspect ratio 19.5:9.
- Fortune Tiger Feature can trigger randomly while the reels are spinning.
- During the feature, one regular non-Wild symbol is selected.
- Feature reels contain only that selected symbol, Wild, or blank space.
- Previously appeared eligible symbols remain in position.
- If at least one additional eligible symbol appears, all reels respin again.
- If no additional eligible symbol appears, the feature ends and wins are paid.
- The ×10 rule is general: when all symbols on the reels are involved in a win, that win is multiplied by ×10. It is not exclusive to the feature.

Published symbol-payout hierarchy:
- Wild: 250
- Gold ingot: 100
- Green/red ornament: 25
- Red money bag: 10
- Red envelopes: 8
- Firecrackers: 5
- Orange: 3

## Important limit of the research

The public PG material verifies the rules above, but it does not publish enough information to reproduce PG SOFT's exact reel strips, symbol weights, per-cell feature probabilities, RNG implementation, or full internal math. Therefore the Neon Fortune project must not claim exact PG mathematical parity unless those inputs are independently available and licensed.

Implementation policy:
1. Reproduce the verified interaction model and presentation rhythm with original code/art/audio.
2. Keep deterministic accounting and precomputed outcomes.
3. Do not invent hidden PG probabilities and label them as official.
4. Any probability calibration not explicitly published by PG must be documented as Neon-original.

## Active implementation after verification

The cleanup/rebuild branch now implements the verified public feature model instead of the old coin Hold & Win:
- random feature trigger reference of 0.99%;
- one selected regular non-Wild symbol;
- selected symbol / Wild / blank-only feature grid;
- landed eligible symbols remain sticky;
- respin continues only when at least one new eligible symbol lands;
- first respin with no new eligible symbol ends the feature;
- full-screen ×10 is shared by base game and feature.

The internal feature landing chances remain explicitly Neon-original because PG does not publish those reel weights.

The old Hold & Win engine/test have been removed from this branch.

## Presentation progress

The base reel overlay no longer relies on a linear infinite CSS strip that disappears at stop. It now has sustained motion, per-reel braking, easing and deterministic snap to the precomputed final symbols.

## Remaining verification boundary

Visual similarity has **not** yet been validated in a real browser for this branch. Required sizes remain 360×800, 390×844 and 430×932. Character acting remains limited by only two real pose assets and is the next major presentation gap.
