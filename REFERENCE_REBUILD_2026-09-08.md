# Reference Rebuild + Cleanup — 2026-09-08

This pass starts from the ZIP received after the first Render deployment and the user's Fortune Tiger reference clip.

## What was measured from the supplied Fortune Tiger reference clip

The supplied clip is 33.09 s, 720×1280, 30 fps, with stereo AAC audio at 44.1 kHz.

A 100 ms window analysis of the clip's audio found approximately 99.7% of windows above -45 dBFS. This is a property of the supplied recording (which may include capture/voice processing), not a claim about the original game's master files. The useful design implication is continuity: the reference does not feel like long dead silence punctuated by isolated beeps.

A sampled 8-color k-means palette from the supplied recording was dominated by warm red/brown/gold families. Approximate cluster centers included:
- #B62D22 (deep warm red)
- #761B0F (dark red/brown)
- #CC7935 (orange-gold)
- #EFBC44 (bright gold)
- #E0BA8D (warm cream)

These measurements support the existing Golden Tiger cabinet direction, but the mascot and event staging were the main visual gap.

## New Golden Tiger implementation

- Replaced the weak hand-built SVG mascot used at the top of the live game with an original transparent raster mascot generated specifically for this project.
- The source asset is `src/assets/golden-tiger/golden-tiger-mascot.webp`.
- The mascot is rendered as overlapping clipped head/body layers so head motion and body follow-through can be staged independently without a skeletal-animation dependency.
- Added independent idle breathing, head drift, reel-watch motion, reveal pop, coin reaction, tense motion, win bounce, full-grid hover, eye flashes, crown flare, and coin prop.
- Increased the mascot stage from 104 px to 128 px on normal-height screens, with a compact layout for short screens.
- Existing reel landing, reveal, win tiers, ambience, and result math were preserved.

## Duplicate / legacy cleanup

Removed exact duplicates, broken assets, and superseded implementations:
- duplicate/broken Golden Tiger `hero.webp` and `symbols.webp` copies
- unused Golden Tiger Base64 reference/cabinet chunk sets
- superseded Golden Tiger engine/config/audio/motion implementation under `src/lib/arcade/golden-tiger`
- superseded Golden Tiger HUD/ReelGrid/WinOverlay components
- unused generic `SlotGame`, `slot-engine`, `PaytableModal`, `SlotSymbolArt`, `WinOverlay`
- unused older `PlinkoGame`
- unused Candy Base64/chunk/reference artifacts; kept only `reference.webp` and `reference-hd.webp`
- Olympus reference chunks were reconstructed into one real `reference.webp`; runtime Base64 decoding was removed
- old pass-by-pass markdown files were consolidated into this document

After cleanup there are no byte-identical duplicate files in the project tree.

## Reference model for the five games

### Golden Tiger / Fortune Tiger family
- Character-first staging.
- Simple 3×3 read.
- Red/gold/cream hierarchy.
- Reel stops are discrete physical events.
- Character reacts to anticipation/result instead of decorating the header.
- Reward intensity scales with actual net outcome.

### Olympus / Gates family
- Character outside the grid acts as the source of special events.
- Charge → strike → impact → resolve must read as one coherent event.
- Heavy rather than elastic motion.
- Thunder/electricity should sit on top of an ambience/music bed, not emerge from dead silence.

### Candy / Sweet Bonanza family
- Material response matters: squash/stretch, bounce, pop, refill.
- Bright multi-color objects need visual air around them.
- Cascade audio should progress subtly rather than replay one identical sound.
- Bomb/multiplier events need one clear focal point.

### Plinko
- Trajectory is the narrative.
- Peg collisions benefit from tight audiovisual synchronization and restrained spatial audio.
- The ball must be the brightest/highest-priority moving object.
- Final bucket impact should close the sequence with a distinct cue.

### Mines
- Each tile is a microinteraction: press → reveal → safe/mine → continuation/cashout.
- The triggered mine should dominate the end-state; secondary mine reveals are subordinate.
- Low-level ambience can remove dead silence without obscuring crystal/explosion/cashout cues.

## Research used for this pass

1. Carter, J. T. (2022). *A conceptual framework of game feel: An evolutionary approach*. Queensland University of Technology. https://eprints.qut.edu.au/227919/
2. Aho, J. (2018). *Rewarding players with audiovisual cues: giving feedback through visual effects*. Theseus. https://www.theseus.fi/handle/10024/158551
3. Johnston, A. et al. (2024). *Audio's impact on immersive experience in extended reality and digital games: a systematic review*. Journal of the Audio Engineering Society. https://opus.lib.uts.edu.au/rest/bitstreams/e42813c0-d987-4d9f-9a28-e0ece2c41daa/retrieve
4. Duarte, A. E. L. (2020). *Algorithmic interactive music generation in videogames: A modular design for adaptive automatic music scoring*. SoundEffects. https://www.soundeffects.dk/article/view/118245
5. Plut, C. (2022). *Application and evaluation of affective adaptive generative music for video games*. Simon Fraser University. https://summit.sfu.ca/item/35366
6. Gasselseder, H. P. (2015). *Re-sequencing the Ludic Orchestra: Evaluating the Immersive Effects of Dynamic Music and Situational Context in Video Games*. Springer. https://link.springer.com/chapter/10.1007/978-3-319-20886-2_43
7. Dix, A. et al. (2023). *The role of audiovisual feedback delays and bimodal congruency for visuomotor performance in human-machine interaction*. ACM. https://dl.acm.org/doi/abs/10.1145/3577190.3614111
8. Dixon, M. J. et al. (2014). *The impact of sound in modern multiline video slot machine play*. Journal of Gambling Studies. https://link.springer.com/article/10.1007/s10899-013-9391-8
9. Scarfe, M. L., Stange, M., & Dixon, M. J. (2021). *Measuring gamblers' behaviour to show that negative sounds can reveal the true nature of losses disguised as wins in multiline slot machines*. Journal of Gambling Studies. https://link.springer.com/article/10.1007/s10899-020-09976-9
10. Clark, L., Lawrence, A. J., Astley-Jones, F., & Gray, N. (2009). *Gambling near-misses enhance motivation to gamble and recruit win-related brain circuitry*. Neuron, 61(3), 481–490. https://doi.org/10.1016/j.neuron.2008.12.031

## Validation performed

- Local import audit: no missing relative or `@/` imports after deletions.
- TypeScript syntax/transpile audit over all `.ts` and `.tsx`: 0 syntax diagnostics.
- CSS brace/parenthesis structure audit: no unbalanced files.
- Exact SHA-256 duplicate scan: 0 duplicate file groups after cleanup.
- Nitro Render configuration remains `preset: "node-server"` in `vite.config.ts`.
- No RNG, payout table, wallet/accounting, or result-generation code was changed in this pass.

A full Vite integration build still belongs on Render or a checkout with dependencies installed.
