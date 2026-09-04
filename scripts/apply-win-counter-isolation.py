from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def patch_golden() -> None:
    path = Path("src/components/arcade/GoldenTigerReference.tsx")
    text = path.read_text()
    text = replace_once(
        text,
        'import { ArrowLeft, Volume2, VolumeX } from "lucide-react";\n',
        'import { ArrowLeft, Volume2, VolumeX } from "lucide-react";\n\nimport { AnimatedWinCounter } from "./AnimatedWinCounter";\n',
        "golden import",
    )
    text = replace_once(
        text,
        '  const [win, setWin] = useState(0);\n',
        '  const [win, setWin] = useState(0);\n  const [winDuration, setWinDuration] = useState(0);\n',
        "golden state",
    )
    text = replace_once(text, '  const winFrameRef = useRef<number | null>(null);\n', '', "golden frame ref")
    text = replace_once(
        text,
        '      if (winFrameRef.current !== null) window.cancelAnimationFrame(winFrameRef.current);\n',
        '',
        "golden frame cleanup",
    )
    start = text.index("  const animateWin = useCallback(")
    end = text.index("  const spinRound = useCallback(", start)
    text = text[:start] + text[end:]
    text = replace_once(
        text,
        '      setWinTier("none");\n      setWin(0);\n',
        '      setWinTier("none");\n      setWinDuration(0);\n      setWin(0);\n',
        "golden reset",
    )
    text = replace_once(
        text,
        '      if (result.bonusAward > 0) {\n        setWin(result.payout);\n',
        '      if (result.bonusAward > 0) {\n        setWinDuration(0);\n        setWin(result.payout);\n',
        "golden bonus target",
    )
    text = replace_once(
        text,
        '        setWinTier(tier);\n        setPhase(tierPhase(tier));\n        await animateWin(result.payout, tier);\n        playSound(\n',
        '        setWinTier(tier);\n        setPhase(tierPhase(tier));\n        const duration = tier === "small" ? 320 : tier === "nice" ? 620 : tier === "big" ? 980 : 1_350;\n        const animatedDuration = result.payout > 0 && !reducedMotion && tier !== "none" ? duration : 0;\n        setWinDuration(animatedDuration);\n        setWin(result.payout);\n        if (animatedDuration > 0) await wait(animatedDuration);\n        playSound(\n',
        "golden count target",
    )
    text = replace_once(
        text,
        '    [animateWin, bet, soundEnabled, turbo],\n',
        '    [bet, reducedMotion, soundEnabled, turbo],\n',
        "golden deps",
    )
    count = text.count('{formatCoins(win)}')
    if count != 2:
        raise SystemExit(f"golden render: expected two win displays, found {count}")
    text = text.replace('{formatCoins(win)}', '<AnimatedWinCounter value={win} duration={winDuration} />')
    path.write_text(text)


def patch_olympus() -> None:
    path = Path("src/components/arcade/OlympusStormReference.tsx")
    text = path.read_text()
    text = replace_once(
        text,
        'import { Link } from "@tanstack/react-router";\n',
        'import { Link } from "@tanstack/react-router";\n\nimport { AnimatedWinCounter } from "./AnimatedWinCounter";\n',
        "olympus import",
    )
    start = text.index("function motionReduced()")
    end = text.index("function useReferenceBlob()", start)
    text = text[:start] + text[end:]
    text = replace_once(
        text,
        '  const [win, setWin] = useState(0);\n',
        '  const [win, setWin] = useState(0);\n  const [winDuration, setWinDuration] = useState(0);\n',
        "olympus state",
    )
    text = replace_once(
        text,
        '    setClusterCount(0);\n    setWin(0);\n',
        '    setClusterCount(0);\n    setWinDuration(0);\n    setWin(0);\n',
        "olympus reset",
    )
    old = '''      const targetTotal = displayedTotal + cascade.payout;\n      await countUp(\n        displayedTotal,\n        targetTotal,\n        turbo ? 140 : cascade.multiplier > 1 ? 620 : 360,\n        setWin,\n      );\n      displayedTotal = targetTotal;\n'''
    new = '''      const targetTotal = displayedTotal + cascade.payout;\n      const winDuration = turbo ? 140 : cascade.multiplier > 1 ? 620 : 360;\n      setWinDuration(winDuration);\n      setWin(targetTotal);\n      await wait(winDuration);\n      displayedTotal = targetTotal;\n'''
    text = replace_once(text, old, new, "olympus count target")
    text = replace_once(
        text,
        '{formatCoins(win)}',
        '<AnimatedWinCounter value={win} duration={winDuration} />',
        "olympus render",
    )
    path.write_text(text)


def patch_candy() -> None:
    path = Path("src/components/arcade/CandyCascadeHQ.tsx")
    text = path.read_text()
    text = replace_once(
        text,
        'import { Link } from "@tanstack/react-router";\n',
        'import { Link } from "@tanstack/react-router";\n\nimport { AnimatedWinCounter } from "./AnimatedWinCounter";\n',
        "candy import",
    )
    start = text.index("function reducedMotion()")
    end = text.index("function CandySymbol", start)
    text = text[:start] + text[end:]
    text = replace_once(
        text,
        '  const [win, setWin] = useState(0);\n',
        '  const [win, setWin] = useState(0);\n  const [winDuration, setWinDuration] = useState(0);\n',
        "candy state",
    )
    text = replace_once(
        text,
        '    setActiveBomb(null);\n    setWin(0);\n',
        '    setActiveBomb(null);\n    setWinDuration(0);\n    setWin(0);\n',
        "candy reset",
    )
    text = replace_once(
        text,
        '      const target = displayed + cascade.payout;\n      await countUp(displayed, target, turbo ? 120 : 340, setWin);\n      displayed = target;\n',
        '      const target = displayed + cascade.payout;\n      const winDuration = turbo ? 120 : 340;\n      setWinDuration(winDuration);\n      setWin(target);\n      await wait(winDuration);\n      displayed = target;\n',
        "candy count target",
    )
    text = replace_once(
        text,
        '{formatCoins(win)}',
        '<AnimatedWinCounter value={win} duration={winDuration} />',
        "candy render",
    )
    path.write_text(text)


patch_golden()
patch_olympus()
patch_candy()
