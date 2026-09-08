# Fortune Tiger verification pass — 2026-09-08

This pass re-checks the Golden Tiger reference dossier against current public material before implementation.

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
- The ×10 rule is general: when all symbols on the reels are involved in a win, that win is multiplied by ×10. It should not be documented as exclusive to a Hold & Win or coin feature.

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

## Implementation continuation authorized by this verification

First engineering step: replace the current CSS-only infinite reel overlay/disappear stop with a deterministic reel presentation that has sustained motion, per-reel braking, easing and a final snap matching the already precomputed symbols. This changes presentation only and does not change payout math.
