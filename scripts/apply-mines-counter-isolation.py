from pathlib import Path

PATH = Path('src/components/arcade/MinesGame.tsx')
text = PATH.read_text()

text = text.replace(
'''async function countUp(from: number, to: number, duration: number, update: (value: number) => void) {
  if (to <= from || reducedMotion()) {
    update(to);
    return;
  }

  await new Promise<void>((resolve) => {
    const started = performance.now();
    const frame = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - (1 - progress) ** 3;
      update(Math.round(from + (to - from) * eased));
      if (progress < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
}

''',
'',
1,
)

text = text.replace(
'import { BetControls } from "./BetControls";\n',
'import { AnimatedWinCounter } from "./AnimatedWinCounter";\nimport { BetControls } from "./BetControls";\n',
1,
)

text = text.replace(
'  const [displayedPossibleWin, setDisplayedPossibleWin] = useState(0);\n',
'  const [displayedPossibleWin, setDisplayedPossibleWin] = useState(0);\n  const [possibleWinDuration, setPossibleWinDuration] = useState(0);\n',
1,
)
text = text.replace('  const displayedPossibleRef = useRef(0);\n', '', 1)

text = text.replace(
'''    displayedPossibleRef.current = bet;
    setDisplayedPossibleWin(bet);
''',
'''    setPossibleWinDuration(0);
    setDisplayedPossibleWin(bet);
''',
1,
)

old_cashout = '''    await wait(reducedMotion() ? 0 : 220);
    await countUp(displayedPossibleRef.current, payout, 420, (value) => {
      displayedPossibleRef.current = value;
      setDisplayedPossibleWin(value);
    });
    await wait(reducedMotion() ? 0 : 120);
'''
new_cashout = '''    await wait(reducedMotion() ? 0 : 220);
    const countDuration = reducedMotion() ? 0 : 420;
    setPossibleWinDuration(countDuration);
    setDisplayedPossibleWin(payout);
    await wait(countDuration);
    await wait(reducedMotion() ? 0 : 120);
'''
if old_cashout not in text:
    raise SystemExit('cashout count-up marker missing')
text = text.replace(old_cashout, new_cashout, 1)

old_reveal = '''    const targetPossible = Math.round(bet * minesMultiplier(mineCount, next.size));
    await countUp(displayedPossibleRef.current, targetPossible, 280, (value) => {
      displayedPossibleRef.current = value;
      setDisplayedPossibleWin(value);
    });
    await wait(reducedMotion() ? 0 : 90);
'''
new_reveal = '''    const targetPossible = Math.round(bet * minesMultiplier(mineCount, next.size));
    const countDuration = reducedMotion() ? 0 : 280;
    setPossibleWinDuration(countDuration);
    setDisplayedPossibleWin(targetPossible);
    await wait(countDuration);
    await wait(reducedMotion() ? 0 : 90);
'''
if old_reveal not in text:
    raise SystemExit('safe reveal count-up marker missing')
text = text.replace(old_reveal, new_reveal, 1)

old_render = '<strong>{formatCoins(possibleWin)}</strong>'
new_render = '<strong><AnimatedWinCounter value={possibleWin} duration={possibleWinDuration} /></strong>'
if old_render not in text:
    raise SystemExit('possible win render marker missing')
text = text.replace(old_render, new_render, 1)

PATH.write_text(text)

# Trigger validation after workflow registration.
