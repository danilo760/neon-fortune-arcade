# Neon Fortune Arcade — production benchmark (2026-09-08)

This benchmark compares the active Neon renderers with current public category references. It is a production-quality comparison, not a claim that Neon copies or exactly matches proprietary math, reel strips, art, audio or hidden implementation details.

## Public references

- PG SOFT — Fortune Tiger game information: https://www.pgsoft.com/uploads/Games/Pdf/Fortune_Tiger_Gameinformation_EN.pdf
- PG SOFT — Fortune Tiger launch / presentation: https://www.pgsoft.com/pt/news/88/
- PG SOFT — official Fortune Tiger video: https://www.youtube.com/watch?v=EdBYVZRUtZY
- Pragmatic Play — Gates of Olympus 1000: https://www.pragmaticplay.com/br/jogos/gates-of-olympus-1000/
- Pragmatic Play — official Gates of Olympus 1000 video: https://www.youtube.com/watch?v=K7k5Wi0hBdY
- Pragmatic Play — Sweet Bonanza 2500: https://www.pragmaticplay.com/br/jogos/sweet-bonanza-2500/
- Pragmatic Play — official Sweet Bonanza 2500 trailer: https://www.youtube.com/watch?v=oJH_Ot14PSw
- Stake Originals — Mines: https://stake.com/pt/casino/games/mines
- Stake Originals — Plinko: https://stake.com/pt/casino/games/plinko

## Evaluation criteria

1. Theme / hero character and symbol material quality.
2. Motion language and state transitions.
3. Audio hierarchy, responsiveness and musical identity.
4. Win readability and feature staging.
5. Mobile composition and input clarity.
6. Functional breadth appropriate to the category.

Scores below are qualitative production-readiness scores, not mathematical or regulatory ratings.

| Neon game | Reference used | Current level | Main strengths | Remaining gap | Score |
| --- | --- | --- | --- | --- | ---: |
| Golden Tiger | Fortune Tiger | Close | Public 3×3 / 5-line structure, 0.99% feature reference, sticky selected-symbol feature, full-grid ×10, deterministic reel braking, 8 tiger states, dedicated feature/win cues, 360/390/430 composition guards | Character motion is still pose/state based rather than a fully authored animation rig; ambience is procedural rather than a composed studio soundtrack | 8.4/10 |
| Olympus Storm | Gates of Olympus 1000 | Strong original interpretation | 6×5 active renderer, cascades/clusters, Storm Level, feature buy/free-spins flow, authored guardian, vector symbols, storm-impact state, mobile QA | Hero illustration and symbol material depth remain below top commercial illustrated assets; musical bed is less authored | 8.0/10 |
| Candy Cascade | Sweet Bonanza 2500 | Strong original interpretation | 6×5, cascades, Sugar Bomb, persistent Sugar Meter, feature/retrigger, authored Sugar Sprite, strong mobile hierarchy and readable symbols | Candy material/character animation has fewer bespoke frames and less rendered depth than top commercial art; soundtrack remains procedural | 8.2/10 |
| Neon Mines | Stake Mines | Strong / more themed | 5×5, risk-dependent multipliers, staged gem/mine reveal, cashout, dedicated danger/explosion/cashout audio, authored crystal-vault visual system | Reference offers 1–24 mines, Autobet and random-tile helpers; Neon exposes 1/3/5/10 and prioritises authored staging instead | 8.3/10 |
| Neon Plinko | Stake Plinko | Strong | Real path animation, bucket settlement before presentation, generated peg field, per-peg spatial audio, multiball 1/3/5/10, Auto Drop, 12/14/16-row presentation | Reference exposes four risk levels and a wider row range; Neon currently exposes three risks and fewer row presets | 8.5/10 |

## What is already at commercial-quality structure

- Every active game has a dedicated renderer and scoped presentation layer.
- Every game has a production build + mobile smoke workflow; Golden, Olympus and Candy additionally validate stateful slot presentation.
- Mobile layouts are explicitly tested at 360×800, 390×844 and 430×932 where applicable.
- Game outcomes remain precomputed and presentation does not decide payouts after animation.
- Audio uses a single WebAudio graph with semantic buses, compression, ducking, reverb and spatial placement instead of unrelated per-component beeps.
- The active lobby no longer uses old game screenshots as presentation cards.

## Largest remaining production gap

The main gap to PG/Pragmatic-level polish is no longer core mechanics or layout. It is authored media density:

1. **Character animation** — more continuous acting between idle, anticipation, feature and win states instead of mostly state/pose swaps.
2. **Composed music** — original looped/adaptive tracks with stems and transitions instead of only a procedural harmonic bed.
3. **Rendered symbol art** — more hand-authored material/detail and per-symbol secondary animation on the three slot games.
4. **Instant-game breadth** — optional extra Mines/Plinko risk/configuration controls if product scope requires parity with category leaders.

## Merge recommendation

The current branch is technically suitable for a merge candidate once CI is green on the final head, but it should not be marketed internally as exact PG/Pragmatic visual parity. A fair description is **professional authored arcade with close structural pacing and remaining studio-asset/audio headroom**.

For the next quality tier, prioritise one original media pass (character rigs + composed music) over adding more CSS overlays. That work will create a larger perceptual improvement than another generic glow/polish pass.
