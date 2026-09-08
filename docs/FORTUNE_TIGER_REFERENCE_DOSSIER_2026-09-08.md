# Fortune Tiger reference dossier — Golden Tiger rebuild

Date: 2026-09-08

Purpose: define the visual, motion, audio and interaction target for the Neon Fortune Arcade Golden Tiger before and during implementation. This document does **not** authorize copying PG SOFT assets, audio, branding or source code. The goal is equivalent clarity, rhythm and perceived quality with original art and sound.

## 1. Verified official reference

Primary sources:
- PG SOFT Fortune Tiger game information PDF: https://www.pgsoft.com/uploads/Games/Pdf/Fortune_Tiger_Gameinformation_EN.pdf
- PG SOFT launch article: https://www.pgsoft.com/news/88/
- PG SOFT official Fortune Tiger video: https://www.youtube.com/watch?v=EdBYVZRUtZY

Official facts from the PG SOFT game-information material:
- 3 reels × 3 rows.
- 5 fixed paylines.
- Standard spinning reels.
- Medium session volatility.
- RTP listed as 96.81% for the referenced configuration.
- Overall hit rate listed as 23.15%; main-game hit rate 22.16%; feature hit rate 0.99%.
- Advertised maximum win 2500× total bet.
- When all 9 reel positions participate in a win, the complete win is multiplied by ×10. This is not limited to the feature.
- Target display reference: 1080×2340, 19.5:9.
- Fortune Tiger Feature may trigger randomly while reels are spinning.
- During the feature one non-Wild symbol is selected. Feature reels contain only selected symbol, Wild or blank.
- Previously landed selected symbols/Wilds remain in place.
- If at least one additional eligible symbol lands, reels respin again.
- Feature ends when a respin lands no additional eligible symbol.

Official paytable hierarchy:
1. Wild — 250
2. Gold ingot — 100
3. Green/red ornament — 25
4. Red money bag — 10
5. Red envelopes — 8
6. Firecrackers — 5
7. Orange — 3

Official paylines:
1. middle horizontal
2. top horizontal
3. bottom horizontal
4. top-left → bottom-right
5. bottom-left → top-right

Only the highest win per line is paid; line wins proceed left-to-right from reel 1.

## 2. What the public sources do NOT disclose

The public PG material does not provide:
- exact base reel strips;
- exact symbol weights per reel;
- exact selected-symbol/Wild/blank feature weights;
- internal RNG implementation;
- exact frame-by-frame timing values for acceleration/deceleration.

Implementation rule: do not label guessed/calibrated values as PG values. Publicly verified rates/mechanics can be mirrored; undisclosed weights remain explicitly Neon Fortune calibration.

## 3. Visual composition target

Observed consistently in public gameplay/screenshots and the official video:

1. Portrait stage filling the phone height.
2. Character/temple scene in the upper visual third.
3. Tiger is a primary actor, not a decorative corner mascot.
4. Compact 3×3 grid dominates the middle of the screen.
5. Reels use warm cream/gold cells surrounded by red/gold framing.
6. A narrow message/win banner sits directly below the reels.
7. Balance / bet / win form a single compact information bar.
8. Main controls sit at the bottom: Turbo, decrease bet, large green Spin, increase bet, Auto.
9. Secondary menu is visually subordinate to Spin.
10. Feature stays in the same cabinet rather than navigating to a detached bonus screen.

Authorial Neon target: preserve this hierarchy while using original temple architecture, tiger design, symbols, lettering, colors, particles and sounds.

## 4. Motion choreography target

### Base spin

State sequence:
`idle → press → launch → continuous spin → reel 1 decel/land → reel 2 decel/land → optional anticipation → reel 3 decel/land → reveal → win/no-win → idle`

Required implementation behavior:
- Final result may be precomputed, but must remain visually hidden until the corresponding reel settles.
- Reels cannot be implemented as a linear infinite strip that simply disappears on stop.
- Each reel needs acceleration, sustained velocity, deceleration and deterministic snap to its final three symbols.
- Reel-stop impact must be physical but small; no constant screen shake.
- Anticipation is event-driven and should only appear when outcome context warrants it.
- Turbo shortens launch/sustain/deceleration but preserves stop order and readable landing impacts.

Provisional pacing budget for our implementation (not official PG numbers; validate against video/preview):
- normal launch + sustained motion: ~450–700 ms before first stop
- reel separation: ~140–220 ms
- anticipation extension: ~120–260 ms
- normal full spin target: ~900–1350 ms
- turbo full spin target: ~350–550 ms
- small win reveal: ~450–750 ms
- big/full-grid celebration: ~1500–2200 ms

## 5. Tiger acting system

Current project still has only two dedicated renders (`tiger-idle.webp`, `tiger-win.webp`). That is insufficient for the target.

Required original pose set:
1. `idle` — relaxed neutral pose
2. `blink` — subtle idle variation
3. `watch` — eyes/head toward reels during spin
4. `tense` — anticipation pose before final reel
5. `reveal` — surprise/impact reaction on result
6. `feature` — presents/points to selected feature symbol
7. `win` — clear celebration
8. `full` — strongest full-grid celebration

Implementation rule: state changes choose real pose artwork first; CSS motion only supplies micro-movement, never substitutes for missing acting poses.

## 6. Symbol-art checklist

Use original art while preserving instant value hierarchy.

Needed assets:
- Wild Tiger symbol — strongest frame, highest contrast, character face readable at small size
- high-value gold/wealth symbol
- high-mid jade/ornament symbol
- red fortune bag / charm family
- envelope/card family
- firecracker family
- orange/fruit low symbol
- optional eighth internal symbol only if current Neon math requires it

Every symbol requires:
- transparent WebP
- consistent optical bounding box
- no baked cell background
- readable silhouette at ~80–110 px
- dedicated win glow/outline supplied by UI, not baked into source art

## 7. Feature implementation — active path

The old coin Hold & Win path has been retired on the cleanup/rebuild branch.

Active mechanic:
- random feature trigger during a paid base spin;
- trigger reference rate: 0.99%, because this is published in PG material;
- choose one non-Wild regular symbol;
- feature cells contain only selected symbol, Wild or blank;
- landed selected symbols/Wilds stay sticky;
- another respin occurs only when at least one new eligible symbol lands;
- first respin with no new eligible symbol ends the feature;
- all 9 positions participating in a win apply ×10.

Calibration boundary:
- selected-symbol and Wild landing chances inside the feature are Neon Fortune calibration values;
- they must remain named/documented as our values because PG does not publish its internal strip weights.

## 8. Audio direction

Official marketing explicitly describes cheerful background music. Public gameplay shows a layered event-driven presentation.

Original Neon audio should use these semantic cues:
- ambience/music bed: cheerful and light without sampling PG audio
- spin launch
- reel rolling texture
- three distinct reel brake/land accents
- anticipation rise
- compact symbol win
- Wild land accent
- feature trigger identity
- feature respin
- sticky-symbol lock
- feature miss closure
- big win
- full-grid reward

Mixer rules:
- one ambience/music bed
- dedicated UI/game/impact/reward buses
- large rewards duck reel/ambience briefly
- avoid constant loudness and repeated identical high-frequency transients on phone speakers
- sound must be synchronized with animation state, not delayed until accounting settles

Current procedural sound engine already exposes Tiger-specific cues and bus/ducking infrastructure, so it can be refined rather than replaced wholesale.

## 9. HUD/control behavior

Reference interaction model to reproduce with original styling:
- Spin is dominant and centered.
- Turbo visible and easy to reach.
- Bet − and + flank Spin.
- Auto remains visible.
- Balance / Bet / Win appear directly above the control row.
- During Auto, remaining-spin count is explicit.
- Sound/menu/paytable/history remain secondary and should not compete visually with Spin.
- No feature-buy control is required for Fortune-style parity; the feature is random in the verified reference.

## 10. Current project status

Already implemented on the rebuild branch:
- deterministic 3×3 result generation;
- five fixed paylines;
- full-screen ×10 applied to base wins;
- true reel braking/snap controller instead of removing an infinite overlay;
- sequential reel land timing and audio;
- published 0.99% feature trigger reference;
- selected-symbol/Wild/blank sticky-respin engine;
- first miss ends the feature;
- old Hold & Win engine/test removed;
- Turbo and Auto preserved;
- fictional balance/history integration preserved.

Remaining gaps:
1. Character still has only two real poses for seven reaction states.
2. Old Tiger rig selectors remain in `GoldenTigerReference.css` alongside the newer pose system.
3. Current procedural ambience is a tonal bed, not a composed cheerful music loop.
4. Visual QA still requires real browser checks at 360×800, 390×844 and 430×932.
5. Feature calibration is ours and must be tuned from simulation/QA rather than presented as PG internal math.

## 11. Implementation order from here

1. Validate current feature migration with tests, typecheck and production build.
2. Create/import the 8 original Tiger poses.
3. Remove obsolete Tiger CSS rig after pose migration.
4. Rebuild cabinet proportions from mobile reference hierarchy.
5. Normalize symbol optical sizes and value hierarchy.
6. Synchronize reel land, tiger reaction and audio cues to one state machine.
7. Tune feature presentation and Neon calibration.
8. Tune win hierarchy: small / nice / big / full-grid.
9. Validate normal, Turbo, Auto, exit-during-spin and reduced-motion.
10. Perform browser visual QA at 360×800, 390×844, 430×932 before merge.

## 12. Definition of done

Golden Tiger is not considered complete until:
- no result pops into view without a reel landing transition
- all three reels visibly decelerate
- Fortune Feature uses only selected symbol/Wild/blank and sticky symbols remain still
- feature ends on the first respin without a new eligible symbol
- character state is readable without relying on generic bouncing
- audio lands on the same frame/beat as reel/symbol impacts
- feature state is visually obvious without reading helper text
- no duplicated Hold & Win engine, HUD or CSS rig remains
- controls remain usable at 360 px width
- normal/Turbo/Auto all terminate safely
- reduced-motion path remains functional
- tests, TypeScript and production build pass
- real browser screenshots have been reviewed at the three required mobile sizes
