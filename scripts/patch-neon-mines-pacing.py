from pathlib import Path
import re

path = Path('src/components/arcade/MinesGame.tsx')
text = path.read_text()

text = text.replace(
    'import { playSound } from "@/lib/arcade/sound";\n',
    'import {\n  MINES_PRESENTATION_TIMING,\n  minesPresentationDelay,\n  minesRiskLabel,\n  minesRiskLevel,\n} from "@/lib/arcade/minesPresentation";\nimport { playMinesSound } from "@/lib/arcade/minesSound";\n'
)
text = re.sub(r'\nfunction riskLabel\(mineCount: number\) \{.*?\n\}\n', '\n', text, flags=re.S)
text = text.replace('    playSound("minesMetal", soundEnabled);\n  }', '    playMinesSound("button", soundEnabled);\n  }', 1)

settle = '''  async function settleWin(safeCells: number) {
    if (settledRef.current || revealBusyRef.current) return;
    settledRef.current = true;
    revealBusyRef.current = true;
    roundActiveRef.current = false;
    setRevealPhase("cashout");

    const finalMultiplier = minesMultiplier(mineCount, safeCells);
    const payout = Math.round(bet * finalMultiplier);
    const reduceMotion = reducedMotion();
    playMinesSound("cashout", soundEnabled);

    await wait(minesPresentationDelay(MINES_PRESENTATION_TIMING.cashoutPress, reduceMotion));
    const countDuration = minesPresentationDelay(MINES_PRESENTATION_TIMING.cashoutCount, reduceMotion);
    setPossibleWinDuration(countDuration);
    setDisplayedPossibleWin(payout);
    await wait(countDuration);
    await wait(minesPresentationDelay(MINES_PRESENTATION_TIMING.cashoutSettle, reduceMotion));

    arcadeActions.credit(payout);
    arcadeActions.recordRound({
      slug: "neon-mines",
      gameName: "Neon Mines",
      bet,
      payout,
      multiplier: finalMultiplier,
      note: `${safeCells} casas seguras`,
    });
    setLastPayout(payout);
    setStatus("won");
    setRevealPhase("idle");
    revealBusyRef.current = false;
    playMinesSound("win", soundEnabled);
  }
'''
text, n = re.subn(r'  async function settleWin\(safeCells: number\) \{.*?\n  \}\n\n  async function revealCell', settle + '\n  async function revealCell', text, count=1, flags=re.S)
if n != 1:
    raise SystemExit('Could not replace settleWin')

reveal = '''  async function revealCell(index: number) {
    if (settledRef.current || !roundActiveRef.current || revealBusyRef.current) return;
    if (status !== "playing" || revealedRef.current.has(index)) return;

    const reduceMotion = reducedMotion();
    revealBusyRef.current = true;
    setOpeningIndex(index);
    setLastSafeReveal(null);
    setRevealPhase("press");
    playMinesSound("tilePress", soundEnabled);
    await wait(minesPresentationDelay(MINES_PRESENTATION_TIMING.press, reduceMotion));

    setRevealPhase("unlock");
    playMinesSound("unlock", soundEnabled);
    await wait(minesPresentationDelay(MINES_PRESENTATION_TIMING.unlock, reduceMotion));

    if (mineSet.has(index)) {
      setTriggeredMine(index);
      setRevealPhase("danger");
      playMinesSound("danger", soundEnabled);
      await wait(minesPresentationDelay(MINES_PRESENTATION_TIMING.danger, reduceMotion));

      settledRef.current = true;
      roundActiveRef.current = false;
      playMinesSound("mineArm", soundEnabled);
      setRevealPhase("explode");
      playMinesSound("explosion", soundEnabled);
      await wait(minesPresentationDelay(MINES_PRESENTATION_TIMING.explosion, reduceMotion));
      setStatus("lost");
      arcadeActions.recordRound({
        slug: "neon-mines",
        gameName: "Neon Mines",
        bet,
        payout: 0,
        multiplier: 0,
        note: "Mina encontrada",
      });
      await wait(minesPresentationDelay(MINES_PRESENTATION_TIMING.lostSettle, reduceMotion));
      setRevealPhase("idle");
      setOpeningIndex(null);
      revealBusyRef.current = false;
      return;
    }

    const next = new Set(revealedRef.current);
    next.add(index);
    revealedRef.current = next;
    setRevealed(next);
    setLastSafeReveal(index);
    setRevealPhase("gem");
    playMinesSound("gemReveal", soundEnabled, next.size);

    const targetPossible = Math.round(bet * minesMultiplier(mineCount, next.size));
    const countDuration = minesPresentationDelay(MINES_PRESENTATION_TIMING.possibleWinCount, reduceMotion);
    setPossibleWinDuration(countDuration);
    setDisplayedPossibleWin(targetPossible);
    if (next.size > 1) playMinesSound("multiplierRise", soundEnabled, next.size);

    await wait(minesPresentationDelay(MINES_PRESENTATION_TIMING.gemSettle, reduceMotion));
    setRevealPhase("idle");
    setOpeningIndex(null);
    revealBusyRef.current = false;

    if (next.size === 25 - mineCount) await settleWin(next.size);
  }
'''
text, n = re.subn(r'  async function revealCell\(index: number\) \{.*?\n  \}\n\n  const showMines', reveal + '\n  const showMines', text, count=1, flags=re.S)
if n != 1:
    raise SystemExit('Could not replace revealCell')

text = text.replace(
    '          revealPhase === "cashout" && "mines-premium__cabinet--cashout",\n        )}\n      >',
    '          revealPhase === "cashout" && "mines-premium__cabinet--cashout",\n        )}\n        data-reveal-phase={revealPhase}\n        data-round-status={status}\n        data-risk-level={minesRiskLevel(mineCount)}\n      >'
)

replacements = {
    '<small>SAFE GEMS</small>': '<small>GEMAS SEGURAS</small>',
    '<span>remaining</span>': '<span>restantes</span>',
    '<small>CRYSTAL VAULT · PRIVATE ARCADE</small>': '<small>CRYSTAL VAULT · ARCADE PRIVADO</small>',
    '<small>NEXT WIN</small>': '<small>PRÓXIMO GANHO</small>',
    '<div><small>RISK</small><strong data-risk={riskLabel(mineCount)}>{riskLabel(mineCount)}</strong></div>': '<div><small>RISCO</small><strong data-risk={minesRiskLevel(mineCount)}>{minesRiskLabel(mineCount)}</strong></div>',
    '<div><small>CURRENT</small><strong>{formatMultiplier(status === "playing" ? multiplier : 1)}</strong></div>': '<div><small>MULTIPLICADOR</small><strong>{formatMultiplier(status === "playing" ? multiplier : 1)}</strong></div>',
    '<div><small>FOUND</small><strong>{revealed.size}</strong></div>': '<div><small>ENCONTRADAS</small><strong>{revealed.size}</strong></div>',
    '<small>POSSIBLE WIN</small>': '<small>GANHO POSSÍVEL</small>',
    '<span>{status === "playing" ? `${revealed.size} gem${revealed.size === 1 ? "" : "s"} secured` : "Open the crystal vault"}</span>': '<span>{status === "playing" ? `${revealed.size} ${revealed.size === 1 ? "gema garantida" : "gemas garantidas"}` : "Abra o cofre de cristal"}</span>',
    '<div><strong>Vault breached</strong><span>A mina explodiu. Somente a aposta fictícia desta rodada foi perdida.</span></div>': '<div><strong>COFRE VIOLADO</strong><span>A mina explodiu. Somente a aposta fictícia desta rodada foi perdida.</span></div>',
    '<div><strong>Crystal secured</strong><span>+ {formatCoins(lastPayout)} moedas fictícias</span></div>': '<div><strong>CRISTAL GARANTIDO</strong><span>+ {formatCoins(lastPayout)} moedas fictícias</span></div>',
    '<small>MINES / RISK</small>': '<small>MINAS / RISCO</small>',
    'aria-label={`Cash out por ${formatCoins(Math.round(bet * multiplier))}`}': 'aria-label={`Garantir ganho de ${formatCoins(Math.round(bet * multiplier))}`}',
    '<span>{revealPhase === "cashout" ? "SECURING" : "CASH OUT"}</span>': '<span>{revealPhase === "cashout" ? "GARANTINDO" : "GARANTIR"}</span>',
    '<span>OPEN VAULT</span>': '<span>ABRIR COFRE</span>',
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'Missing UI replacement: {old[:60]}')
    text = text.replace(old, new)

old_buttons = '''              {[1, 3, 5, 10].map((count) => (
                <Button key={count} size="sm" variant={mineCount === count ? "gold" : "outline"} disabled={status === "playing"} onClick={() => setMineCount(count)} aria-label={`${count} minas`} aria-pressed={mineCount === count}>{count}</Button>
              ))}'''
new_buttons = '''              {[1, 3, 5, 10].map((count) => {
                const label = minesRiskLabel(count);
                return (
                  <Button
                    key={count}
                    size="sm"
                    variant={mineCount === count ? "gold" : "outline"}
                    disabled={status === "playing"}
                    onClick={() => setMineCount(count)}
                    aria-label={`${count} minas, risco ${label.toLowerCase()}`}
                    aria-pressed={mineCount === count}
                  >
                    <strong>{count}</strong>
                    <span>{label}</span>
                  </Button>
                );
              })}'''
if old_buttons not in text:
    raise SystemExit('Missing risk button block')
text = text.replace(old_buttons, new_buttons)
path.write_text(text)

p = Path('src/components/arcade/MinesOrchestration.css')
css = p.read_text()
for old, new in {
    'animation: mines-plate-press .1s ease-out both;': 'animation: mines-plate-press .06s ease-out both;',
    'animation: mines-lock-turn .18s ease-in both;': 'animation: mines-lock-turn .1s ease-in both;',
    'animation: mines-crack-open .22s ease-out both;': 'animation: mines-crack-open .12s ease-out both;',
    'animation: mines-gem-rise .28s cubic-bezier(.18,.85,.24,1.12) both;': 'animation: mines-gem-rise .2s cubic-bezier(.18,.85,.24,1.12) both;',
    'animation: mines-red-underlight .16s ease-out both;': 'animation: mines-red-underlight .1s ease-out both;',
    'animation: mines-local-blast .36s ease-out both;': 'animation: mines-local-blast .22s ease-out both;',
    'animation: mines-vault-dim .28s ease-out both;': 'animation: mines-vault-dim .2s ease-out both;',
    'animation: mines-cash-converge-left .52s ease-in both;': 'animation: mines-cash-converge-left .34s ease-in both;',
    'animation: mines-cash-converge-right .52s ease-in both;': 'animation: mines-cash-converge-right .34s ease-in both;',
    'animation: mines-cash-lock .46s ease-out both !important;': 'animation: mines-cash-lock .32s ease-out both !important;',
}.items():
    if old not in css:
        raise SystemExit(f'Missing orchestration CSS: {old}')
    css = css.replace(old, new)
p.write_text(css)

p = Path('src/components/arcade/MinesInteraction.css')
css = p.read_text()
css = css.replace('animation: mines-safe-reveal .3s cubic-bezier(.18,.85,.26,1.12) both;', 'animation: mines-safe-reveal .2s cubic-bezier(.18,.85,.26,1.12) both;')
css = css.replace('animation: mines-trigger-impact .34s cubic-bezier(.18,.82,.25,1.08) both;', 'animation: mines-trigger-impact .24s cubic-bezier(.18,.82,.25,1.08) both;')
css = css.replace('animation: mines-cashout-ready .26s ease-out both;', 'animation: mines-cashout-ready .2s ease-out both;')
css += '''\n\n.mines-premium__tile--fresh-gem::after {\n  content: ""; position: absolute; inset: 10%; pointer-events: none; border-radius: 45%;\n  background: radial-gradient(circle at 45% 35%, rgba(236,255,249,.82), rgba(116,255,207,.18) 25%, transparent 58%);\n  opacity: 0; animation: mines-gem-glint .2s ease-out both;\n}\n@keyframes mines-gem-glint {\n  0% { opacity: 0; transform: scale(.72); }\n  42% { opacity: .78; transform: scale(1.04); }\n  100% { opacity: 0; transform: scale(1.18); }\n}\n@media (prefers-reduced-motion: reduce) { .mines-premium__tile--fresh-gem::after { animation: none !important; display: none; } }\n'''
p.write_text(css)

p = Path('src/components/arcade/MinesPremium.css')
css = p.read_text()
css = css.replace('.mines-premium__telemetry strong[data-risk="HIGH"],\n.mines-premium__telemetry strong[data-risk="EXTREME"] { color: #ffd45b; }\n.mines-premium__telemetry strong[data-risk="EXTREME"] { text-shadow: 0 0 9px rgba(255,93,85,.55); color: #ff766d; }', '.mines-premium__telemetry strong[data-risk="high"],\n.mines-premium__telemetry strong[data-risk="extreme"] { color: #ffd45b; }\n.mines-premium__telemetry strong[data-risk="extreme"] { text-shadow: 0 0 9px rgba(255,93,85,.55); color: #ff766d; }')
css = css.replace('animation: mines-cashout-confirm .4s cubic-bezier(.18,.9,.25,1.15) both;', 'animation: mines-cashout-confirm .3s cubic-bezier(.18,.9,.25,1.15) both;')
css += '''\n\n.mines-premium__cabinet[data-risk-level="low"] .mines-premium__aurora::before { opacity: .58; }\n.mines-premium__cabinet[data-risk-level="high"] .mines-premium__aurora::before { opacity: .82; }\n.mines-premium__cabinet[data-risk-level="extreme"] .mines-premium__aurora::before { opacity: .92; }\n.mines-premium__cabinet[data-risk-level="extreme"] .mines-premium__grid-frame {\n  border-color: rgba(255,164,107,.5);\n  box-shadow: inset 0 0 0 3px rgba(62,38,0,.5), inset 0 0 28px rgba(0,0,0,.68), 0 14px 36px rgba(0,0,0,.4), 0 0 18px rgba(255,71,82,.1);\n}\n.mines-premium__selector > div button { display: grid; min-height: 2.45rem; place-items: center; gap: .02rem; padding-inline: .35rem; }\n.mines-premium__selector > div button strong { font-size: .72rem; line-height: 1; }\n.mines-premium__selector > div button span { font-size: .34rem; line-height: 1; letter-spacing: .05em; opacity: .62; }\n.mines-premium__selector > div button[aria-pressed="true"] span { opacity: .9; }\n@media (max-width: 390px) { .mines-premium__selector > div button span { font-size: .31rem; } }\n'''
p.write_text(css)
