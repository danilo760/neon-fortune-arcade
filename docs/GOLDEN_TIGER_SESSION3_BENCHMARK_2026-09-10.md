# Golden Tiger — Session 3 V2 benchmark and feel target

Date: 2026-09-10
Initial branch HEAD: `9ee6225ec8b8b34d7ddccd70815df1366fbf5733`
Branch: `feat/golden-tiger-audiovisual`

## Source boundary

Primary public references:

- PG SOFT official Fortune Tiger game-information PDF: `https://www.pgsoft.com/uploads/Games/Pdf/Fortune_Tiger_Gameinformation_EN.pdf`
- PG SOFT official launch article: `https://www.pgsoft.com/news/88/`
- PG SOFT official Fortune Tiger video: `https://www.youtube.com/watch?v=EdBYVZRUtZY`

Verified public facts remain the same: 3×3 reels, five fixed paylines, random Fortune Tiger Feature, selected-symbol/Wild/blank sticky respins, and ×10 when all nine positions participate in a win. Public PG material does **not** disclose exact animation-frame timings or proprietary reel strips.

Timing bands below are therefore **observational/perceptual benchmark ranges**, not claimed PG implementation constants. Session 3 intentionally does not copy them blindly: the user reported the current Neon spin as too rushed, so the Neon target gives the eye more time to read mass and reel order while preserving the same commercial hierarchy.

## Reference / current / Session 3 target

| Criterion | Fortune Tiger reference | Neon before Session 3 | Session 3 target |
|---|---|---|---|
| 1. Normal spin duration | compact commercial spin; observed feel ~1.0–1.4 s before result staging | ~1.73 s without anticipation; ~2.0 s with it, but stops read rushed | ~2.19 s without anticipation; ~2.55 s with anticipation, plus explicit reveal beat |
| 2. Turbo duration | materially faster but still shows ordered reel stops; observational ~0.35–0.55 s | ~0.36 s without anticipation; ~0.41 s with it | ~0.62 s without anticipation; ~0.71 s with it |
| 3. Column separation | clearly sequential, roughly a short visual beat between columns | 86/100/114 ms post-land pause | 120/138/156 ms normal; 36/42/48 ms Turbo |
| 4. Anticipation | short suspense hold before final outcome when context warrants | 280 ms normal / 44 ms Turbo | 360 ms normal / 90 ms Turbo |
| 5. Last reel → result | perceptible micro-pause; result does not pop on the same instant | 110–180 ms base reveal; 55 ms Turbo | 155–245 ms normal; 64–82 ms Turbo |
| 6. Small win | compact; quickly acknowledges and returns control | short return/simple-win path | keep compact; clearer symbol emphasis without takeover |
| 7. Larger win | staged impact → amount → celebration | three-beat path exists for big/mega/super | preserve three beats, strengthen audio/actor cohesion rather than extending endlessly |
| 8. Character idle | continuous subtle life, not constant large bob | pose plus several competing rig/sprite bob animations | artwork-led breathing, blink and tiny center-of-mass change only |
| 9. Character during spin | visibly watches the reels | `watch` pose but whole rig oscillates | `watch` pose with restrained sprite movement; no generic whole-rig rocking |
| 10. Character win reaction | proportional to reward | normal and cinematic states are separated, but hard atlas cuts remain | short pose overlap; normal win never promotes to full-grid acting |
| 11. Special-event reaction | tension and presentation tied to feature beat | feature pose exists; transitions snap | overlap + feature lighting; selected symbol remains the focus |
| 12. Apparent symbol size | large silhouettes optimized for phone | premium atlas is readable but can be over-filtered by legacy rules | keep optical size; reduce competing glow/filter during motion |
| 13. Mascot/reel proportion | mascot is a hero above a dominant compact 3×3 | composition is already close but motion makes mascot feel detached | keep proportions; visually anchor mascot to cabinet platform and event timing |
| 14. Main Spin position | centered, largest action in bottom console | centered but still inherits web-button language | physical 72 px mobile control, depressed/active/disabled states |
| 15. HUD contrast | compact information; does not compete with reels | multiple dark/gold surfaces remain card-like | flatter information band; lower label contrast; numbers readable |
| 16. Particle intensity | low in base state, rises for reward | several layered particle/glow systems | base particles off; reward density capped; symbols remain readable |
| 17. Music rhythm | cheerful, light, loop-friendly Asian-fantasy feel | procedural tonal ambience only when commissioned files absent | original 120-BPM pentatonic festival loop + procedural safety fallback |
| 18. Reel-stop impact | transient coincides with visible settle | audio event fires after brake while static-cell land animation can start at brake start | delay visual land impulse to deterministic brake completion; progressive stop samples |
| 19. Mobile behavior | portrait-first; reel cabinet and Spin dominate | passed prior static composition QA, but clipping has regressed in animation historically | preserve safe rows; avoid filtered moving tracks; validate mid-animation at 360/390/430 |
| 20. Interface density | compact, game-like, few competing surfaces | feature-buy and helper/status layers add density | Spin/reels/mascot dominant; bonus buy remains explicitly secondary Neon product |

## Session 3 feel decisions

1. **Do not speed-match the reference blindly.** The current user-facing problem is lack of weight, so normal mode becomes intentionally slower and more legible than the earlier provisional dossier target.
2. **Keep Turbo choreographed.** Turbo retains launch, three brakes, three lands, anticipation when applicable, and result reveal.
3. **Move visual impact to the land beat.** The prior CSS could begin its static-cell impact while the live overlay was still braking. Session 3 delays that impact to the deterministic brake finish so audio/visual feedback converge.
4. **Remove moving-track blur pressure.** The transformed reel strip remains transform-only; motion depth comes from static shade/streak layers.
5. **Treat the tiger as one actor.** Adjacent atlas poses overlap for ~90–220 ms depending on event significance. CSS no longer rocks the whole rig as a substitute for acting.
6. **Use original audio only.** New loop/SFX are authored for Neon and contain no PG audio samples.
7. **Preserve math.** No paytable, RNG, feature probability, 31× buy multiplier, settlement, or accounting changes are part of this pass.

## Known benchmark limitation

The official public material verifies mechanics, layout direction and qualitative audio/visual intent, but does not publish proprietary frame timing. The official video was used as a visual/feel reference; exact frame-step extraction is not represented as an official PG measurement. All numeric timing values in the Session 3 target are Neon calibration values and must be judged again against real-browser captures.
