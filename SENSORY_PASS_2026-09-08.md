# Audio & Motion Sensory Pass — 2026-09-08

This pass focuses on presentation only. It intentionally leaves RNG, payout tables,
wallet state and round-plan mathematics unchanged.

## What changed

### Shared audio (`src/lib/arcade/sound.ts`)
- Added semantic Web Audio buses: `ui`, `game`, `impact`, `reward`.
- Added a gentle master dynamics compressor for layered cues.
- Added short ducking so impacts/rewards have headroom without making every cue louder.
- Added a short, generated stereo convolution reverb only on reward/impact buses.
- Added optional `pan` and `intensity` per sound event while keeping existing calls valid.
- Preserved one `AudioContext`, no autoplay, no remote/commercial samples.
- Plinko cached peg/launch/bucket cues remain cached and voice-gated.

### Golden Tiger
- Kept math/game phases unchanged.
- Added semantic intensity to symbol lock, premium impact and full-grid events.
- Added calm idle breathing for the mascot.
- Added grid impact on coin lock, feature-intro aura and more readable winning-symbol motion.
- Preserved `prefers-reduced-motion`.

### Olympus Storm
- Added intensity shaping as cascades/multipliers escalate.
- Implemented the per-cell `fall-*` and `refill-*` classes that the TSX already calculated.
- Winning cells now visibly clear before gravity; surviving cells fall by the calculated row distance.
- New symbols refill from above with weight/settle rather than appearing in place.
- Added a restrained storm aftershock and Zeus afterglow.

### Candy Cascade
- Added intensity shaping by cascade index and bomb multiplier.
- Implemented the per-cell `fall-*` and `refill-*` classes that the TSX already calculated.
- Candy clear/fall/refill uses squash/stretch and elastic settle, intentionally different from Olympus.
- Landing now uses a small column wave rather than one rigid grid motion.

### Plinko
- Peg sounds now follow the ball horizontally with subtle stereo pan.
- Peg intensity increases slightly down the board without changing outcome information.
- Added squash/stretch at peg impacts and a short bucket settle tail.
- Removed celebratory `win` audio on partial returns: only payout > stake gets the extra win layer.
- Result generation still happens before presentation.

### Mines
- Gem cue intensity scales gently with the safe-reveal sequence.
- Explosion/cashout get controlled priority in the shared mixer.
- Added cabinet/grid reactions for safe reveal, danger, explosion and cashout.
- Kept reveal timing constants and math unchanged.

## Validation performed

- `sound.ts`, `audioEventGate.ts` and `minesSound.ts` compile with the global TypeScript compiler.
- All changed TS/TSX files pass TypeScript `transpileModule` syntax diagnostics.
- Changed CSS files have balanced braces/parentheses.
- Olympus/Candy `fall-1..5` and `refill-1..5` classes are all now implemented.
- A full Vite build was **not** run because the supplied ZIP does not include `node_modules`.

## Files changed

- `src/lib/arcade/sound.ts`
- `src/lib/arcade/minesSound.ts`
- `src/components/arcade/GoldenTigerReference.tsx`
- `src/components/arcade/GoldenTigerReference.css`
- `src/components/arcade/OlympusStormReference.tsx`
- `src/components/arcade/OlympusStormOrchestration.css`
- `src/components/arcade/CandyCascadeHQ.tsx`
- `src/components/arcade/CandyCascadeOrchestration.css`
- `src/components/arcade/PlinkoReference.tsx`
- `src/components/arcade/MinesOrchestration.css`
