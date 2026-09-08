# Sensory Pass 2 — 2026-09-08

This pass responds to the recorded Render session (`bandicam 2026-09-07 22-21-20-643.mp4`) and focuses on presentation only.

## Scope

No RNG, payout table, balance accounting, feature-buy price, or result generation was changed.

### Shared audio engine
- Added a fifth `ambience` bus to the existing procedural Web Audio mixer.
- Added low-level, original procedural ambience themes for Tiger, Olympus, Candy, Mines, and Plinko.
- Ambience is requested by the mounted game and only becomes audible after an existing user-triggered sound has opened/resumed Web Audio; it does not introduce forced autoplay.
- Large impact/reward cues now duck both gameplay and ambience buses briefly.
- Added bounded per-event pitch variation to support progressive Candy cascades and Mines crystal sequences.
- Preserved the existing compressor, accent reverb, voice gate, intensity, and stereo-pan behavior.

### Golden Tiger
- Mounted Tiger ambience and phase-driven ambience energy.
- Added real SVG eyelid/blink behavior instead of only moving the whole mascot.
- Added a readable win/full-grid aura ring and stronger distinction between watch / feature / miss states.

### Olympus Storm
- Mounted Olympus ambience and phase-driven storm energy.
- Added a darker charge phase so Zeus/lightning becomes the focal point.
- Added a sharper bolt snap, grid impact bloom, and short sky reaction.
- Existing cascade fall/refill math and animations were preserved.

### Candy Cascade
- Mounted Candy ambience and phase-driven energy.
- Cascade pop/break/streak cues now rise slightly in pitch with cascade depth.
- Added per-column timing offsets to collapse/refill so the grid does not move as one rigid block.
- Added a lightweight bomb ripple and calm idle grid breathing.

### Neon Plinko
- Mounted a very low electronic ambience.
- Existing stereo peg panning and compositor-driven ball motion were preserved.
- Increased ball-first luminance, idle-ball pulse, impact readability, and subtle board response.

### Neon Mines
- Mounted a very low subterranean/electronic ambience.
- Crystal reveal pitch now climbs slightly with a safe sequence.
- Added restrained idle grid life.
- Triggered mine keeps visual priority while secondary mines are dimmed during the explosion.

## Validation performed here
- TypeScript parser: all 8 changed TS/TSX implementation files parse successfully.
- Isolated TypeScript compile: `sound.ts`, `audioEventGate.ts`, and `minesSound.ts` compile with TypeScript 5.8.3.
- CSS structure: all 5 changed CSS files have balanced braces and parentheses.
- No full Vite/Render build was claimed in this environment because the uploaded archive does not include `node_modules`; Render remains the authoritative integration build.

## Follow-up
After this version is deployed to Render, record another session with audio. Compare the new recording against the first one before increasing effect density further. The target is continuity + hierarchy, not constant celebration.
