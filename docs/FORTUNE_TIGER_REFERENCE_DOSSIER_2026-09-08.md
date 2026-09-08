# Fortune Tiger reference dossier — Golden Tiger rebuild

Date: 2026-09-08

Purpose: define the visual, motion, audio and interaction target for the Neon Fortune Arcade Golden Tiger before implementation. This document does **not** authorize copying PG SOFT assets, audio, branding or source code. The goal is equivalent clarity, rhythm and perceived quality with original art and sound.

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
- Full-screen winning participation applies ×10.
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

## 2. Visual composition target

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

## 3. Motion choreography target

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

## 4. Tiger acting system

Current project has only two dedicated renders (`tiger-idle.webp`, `tiger-win.webp`). That is insufficient for the target.

Required original pose set:
1. `idle` — relaxed neutral pose
2. `blink` — subtle idle variation
3. `watch` — eyes/head toward reels during spin
4. `tense` — anticipation pose before final reel
5. `reveal` — surprise/impact reaction on result
6. `feature` — presents/points to selected feature symbol or reward object
7. `win` — clear celebration
8. `full` — strongest full-grid celebration

Implementation rule: state changes choose real pose artwork first; CSS motion only supplies micro-movement (breathing, lean, recoil, scale), never substitutes for missing acting poses.

## 5. Symbol-art checklist

Use original art while preserving instant value hierarchy.

Needed assets:
- Wild Tiger symbol — strongest frame, highest contrast, character face readable at small size
- high-value gold/wealth symbol
- high-mid jade/ornament symbol
- red fortune bag / charm family
- envelope/card family
- firecracker family
- orange/fruit low symbol
- optional eighth internal symbol only if current Neon math remains unchanged

Every symbol requires:
- transparent WebP
- consistent optical bounding box
- no baked cell background
- readable silhouette at ~80–110 px
- dedicated win glow/outline supplied by UI, not baked into source art

## 6. Feature presentation target

Two possible implementation paths must remain explicit.

### A. Presentation parity, current Neon math preserved
Keep current Golden Tiger Hold & Win math (3 respins/reset, coin values, feature buy) and borrow only Fortune Tiger presentation principles:
- locked symbols remain visibly stationary
- only unlocked cells animate
- every new lock produces a short impact and resets the visible counter
- near-finish state raises music/ambience energy
- full grid ×10 is the climax

### B. Mechanical parity with Fortune Tiger
Requires a deliberate future math change:
- random feature trigger during spin
- choose one non-Wild regular symbol
- feature pool becomes chosen symbol + Wild + blank
- newly landed eligible symbols remain sticky
- continue while at least one new eligible symbol lands
- stop immediately on a respin with no new eligible symbol
- full-screen winning participation applies ×10

Do not mix A and B accidentally. Current implementation is path A until a separate math decision is made.

## 7. Audio direction

Official marketing explicitly describes cheerful background music. Public gameplay shows a layered event-driven presentation.

Original Neon audio should use these semantic cues:
- `tigerAmbience` / music bed: cheerful, light, culturally inspired without sampling PG audio
- `spinLaunch`: short mechanical whoosh
- `reelLoop`: low-level rolling texture
- `reelBrake1/2/3`: descending stop texture with spatial pan
- `reelLand1/2/3`: short physical contact/transient
- `anticipationRise`: musical tension ramp
- `symbolWin`: bright compact chime
- `wildLand`: stronger character accent
- `featureTrigger`: unmistakable tonal identity
- `featureRespin`: shorter rolling cue than base spin
- `featureLock`: metallic/gold lock accent
- `featureMiss`: low-energy closure
- `bigWin`: musical escalation
- `fullGrid`: strongest reward cue

Mixer rules:
- one ambience/music bed
- dedicated UI/game/impact/reward buses
- large rewards duck reel/ambience briefly
- avoid constant loudness and repeated identical high-frequency transients on phone speakers
- sound must be synchronized with DOM/animation state, not delayed until accounting settles

Current procedural sound engine already exposes Tiger-specific cues and bus/ducking infrastructure, so it can be refined rather than replaced wholesale.

## 8. HUD/control behavior

Reference interaction model to reproduce with original styling:
- Spin is dominant and centered.
- Turbo visible at lower-left.
- Bet − and + flank Spin.
- Auto visible at lower-right.
- Balance / Bet / Win appear directly above the control row.
- During Auto, remaining-spin count should replace/augment the Auto state clearly.
- Tapping Spin while reels are spinning may act as stop/fast-stop only if deterministic presentation remains consistent.
- Sound/menu/paytable/history remain secondary and should not compete visually with Spin.

## 9. Current project gap analysis

Current `GoldenTigerReference.tsx` already provides:
- 3×3 grid
- five fixed paylines
- sequential column stop state
- anticipation state
- Turbo and Auto
- feature animation states
- Tiger-specific sound cue calls
- win tiers and full-grid presentation
- fictional balance/history integration

Current gaps versus target:
1. Reel overlay uses linear infinite CSS motion and disappears as columns stop; it needs true deceleration/snap.
2. Character has only two real poses for seven reaction states.
3. Old Tiger rig selectors remain in `GoldenTigerReference.css` alongside the newer pose system.
4. Feature mechanics differ from official Fortune Tiger; keep this difference explicit until math is intentionally changed.
5. Current procedural ambience is a tonal bed, not a composed cheerful music loop; decide whether to keep procedural music or add original authored music assets.
6. Visual QA still requires real browser checks at 360×800, 390×844 and 430×932.

## 10. Implementation order

1. Freeze current math decision (presentation parity vs mechanical parity).
2. Build deterministic reel animation controller with acceleration/deceleration/snap.
3. Create/import the 8 original Tiger poses.
4. Remove obsolete Tiger CSS rig after pose migration.
5. Rebuild cabinet proportions from mobile reference hierarchy.
6. Normalize symbol optical sizes and value hierarchy.
7. Synchronize reel land, tiger reaction and audio cues to one state machine.
8. Rework feature visual flow using the chosen mechanics path.
9. Tune win hierarchy: small / nice / big / full-grid.
10. Validate normal, Turbo, Auto, exit-during-spin and reduced-motion.
11. Run tests, typecheck, production build.
12. Perform visual QA at 360×800, 390×844, 430×932 before merge.

## 11. Definition of done

Golden Tiger is not considered complete until:
- no result pops into view without a reel landing transition
- all three reels visibly decelerate
- character state is readable without relying on generic bouncing
- audio lands on the same frame/beat as reel/symbol impacts
- feature state is visually obvious without reading helper text
- no duplicated HUD, CSS rig or hidden bitmap text exists
- controls remain usable at 360 px width
- normal/Turbo/Auto all terminate safely
- reduced-motion path remains functional
- tests, TypeScript and production build pass
- real browser screenshots have been reviewed at the three required mobile sizes
