from pathlib import Path

# Presentation-only patch. Do not touch goldenTigerMath.ts or its tests.

tsx = Path("src/components/arcade/GoldenTigerPremium.tsx")
text = tsx.read_text(encoding="utf-8")
replacements = {
    "const accelerationMs = turbo ? 72 + column * 8 : 150 + column * 16;": "const accelerationMs = turbo ? 90 + column * 10 : 260 + column * 24;",
    "const cruiseVelocity = itemHeight / (turbo ? 40 : 64);": "const cruiseVelocity = itemHeight / (turbo ? 58 : 105);",
    '<AnimatedWinCounter value={win} duration={reducedMotion() ? 0 : 620} />': '<AnimatedWinCounter value={win} duration={reducedMotion() ? 0 : turbo ? 520 : 900} />',
}
for old, new in replacements.items():
    if old not in text and new not in text:
        raise SystemExit(f"Expected GoldenTigerPremium.tsx fragment not found: {old}")
    text = text.replace(old, new, 1)
tsx.write_text(text, encoding="utf-8")

motion = Path("src/lib/arcade/goldenTigerMotion.ts")
text = motion.read_text(encoding="utf-8")
replacements = {
    "return turbo ? 180 : 700;": "return turbo ? 240 : 900;",
    "return turbo ? 125 + safeColumn * 15 : 450 + safeColumn * 55;": "return turbo ? 160 + safeColumn * 20 : 570 + safeColumn * 70;",
    "return turbo ? 50 + safeColumn * 7 : 165 + safeColumn * 20;": "return turbo ? 70 + safeColumn * 8 : 210 + safeColumn * 25;",
    "return turbo ? 130 : 500;": "return turbo ? 170 : 650;",
    "return turbo ? 42 : 105;": "return turbo ? 55 : 150;",
    "return turbo ? 72 + safe * 5 : 125 + safe * 10;": "return turbo ? 90 + safe * 7 : 165 + safe * 12;",
    "if (turbo) return hasWin ? 125 : 90;\n  return hasWin ? 340 : 210;": "if (turbo) return hasWin ? 180 : 130;\n  return hasWin ? 520 : 320;",
    "return turbo ? 140 : 380;": "return turbo ? 190 : 520;",
}
for old, new in replacements.items():
    if old not in text and new not in text:
        raise SystemExit(f"Expected goldenTigerMotion.ts fragment not found: {old}")
    text = text.replace(old, new, 1)
motion.write_text(text, encoding="utf-8")

timeline = Path("src/lib/arcade/goldenTigerWinTimeline.ts")
text = timeline.read_text(encoding="utf-8")
replacements = {
    "impactMs: 150,\n      revealMs: fullGrid ? 650 : 520,\n      celebrateMs: fullGrid ? 420 : 320,": "impactMs: 180,\n      revealMs: fullGrid ? 820 : 680,\n      celebrateMs: fullGrid ? 560 : 430,",
    "impactMs: 320,\n    revealMs: fullGrid ? 2100 : 1800,\n    celebrateMs: fullGrid ? 1100 : 850,": "impactMs: 380,\n    revealMs: fullGrid ? 2700 : 2300,\n    celebrateMs: fullGrid ? 1450 : 1150,",
    'if (kind === "simple-win") return 700;\n    if (kind === "return") return 550;\n    return 90;': 'if (kind === "simple-win") return 900;\n    if (kind === "return") return 720;\n    return 130;',
    'if (kind === "simple-win") return 1500;\n  if (kind === "return") return 1350;\n  return 240;': 'if (kind === "simple-win") return 1900;\n  if (kind === "return") return 1700;\n  return 320;',
}
for old, new in replacements.items():
    if old not in text and new not in text:
        raise SystemExit(f"Expected goldenTigerWinTimeline.ts fragment not found: {old}")
    text = text.replace(old, new, 1)
timeline.write_text(text, encoding="utf-8")

css = Path("src/components/arcade/GoldenTigerPremium.css")
marker = "GOLDEN TIGER — REFERENCE CONTROL DECK + READABLE PACING PASS"
text = css.read_text(encoding="utf-8")
if marker not in text:
    text += r'''

/* ============================================================================
   GOLDEN TIGER — REFERENCE CONTROL DECK + READABLE PACING PASS
   Visual control hierarchy based on the user's reference capture:
   info strip above, then one physical row: Turbo | − | Spin | + | Auto.
   The Bonus action remains available as the compact center button in the HUD.
   No math/RNG/RTP/settlement rules are changed here.
   ============================================================================ */

.gt-hw-page .gt-premium-machine .gt-hw-hud {
  grid-template-columns: minmax(0, 1fr) 64px minmax(0, 1fr) !important;
  min-height: 44px !important;
  border-radius: 18px !important;
  overflow: visible !important;
  background: linear-gradient(180deg, rgba(80, 10, 8, .96), rgba(37, 3, 4, .98)) !important;
  border-color: rgba(229, 176, 68, .5) !important;
  box-shadow: inset 0 1px 0 rgba(255, 235, 166, .12), inset 0 -5px 10px rgba(0, 0, 0, .25), 0 4px 9px rgba(0, 0, 0, .26) !important;
}
.gt-hw-page .gt-premium-machine .gt-hw-hud > div:first-child { grid-column: 1 !important; border-right: 1px solid rgba(221, 169, 71, .24) !important; }
.gt-hw-page .gt-premium-machine .gt-hw-hud > div:last-child { grid-column: 3 !important; border-left: 1px solid rgba(221, 169, 71, .24) !important; border-right: 0 !important; }
.gt-hw-page .gt-premium-machine .gt-hw-hud span { font-size: 6px !important; letter-spacing: .16em !important; color: rgba(245, 201, 112, .72) !important; }
.gt-hw-page .gt-premium-machine .gt-hw-hud strong { font-size: 13px !important; color: #ffe38c !important; text-shadow: 0 0 8px rgba(255, 187, 54, .25) !important; }

.gt-hw-page .gt-premium-machine .gt-hw-controls.gt-commercial-console {
  position: relative !important;
  display: grid !important;
  grid-template-columns: 50px 48px 84px 48px 50px !important;
  grid-template-rows: 70px !important;
  justify-content: center !important;
  align-items: center !important;
  gap: 7px !important;
  width: 100% !important;
  padding: 5px 8px 8px !important;
  border: 0 !important;
  border-top: 1px solid rgba(231, 181, 75, .48) !important;
  border-radius: 0 0 20px 20px !important;
  background: radial-gradient(ellipse at 50% -18%, rgba(255, 208, 93, .11), transparent 46%), linear-gradient(180deg, rgba(106, 15, 10, .985), rgba(48, 4, 5, .995)) !important;
  box-shadow: inset 0 2px 0 rgba(255, 229, 151, .08), inset 0 -11px 17px rgba(18, 0, 1, .36), 0 8px 15px rgba(0, 0, 0, .28) !important;
}
.gt-hw-page .gt-premium-machine .gt-hw-main-controls,
.gt-hw-page .gt-premium-machine .gt-premium-secondary { display: contents !important; }

.gt-hw-page .gt-premium-machine .gt-hw-main-controls > button:not(.gt-hw-spin) {
  width: 48px !important; height: 48px !important; min-width: 48px !important; min-height: 48px !important; padding: 0 !important;
  border: 1px solid rgba(223, 170, 67, .56) !important; border-radius: 50% !important;
  background: radial-gradient(circle at 40% 30%, rgba(151, 35, 24, .7), transparent 30%), linear-gradient(180deg, #78150e 0%, #4c0807 58%, #2a0204 100%) !important;
  color: #f6d374 !important; font-size: 28px !important; font-weight: 700 !important;
  box-shadow: inset 0 2px 0 rgba(255, 230, 157, .10), inset 0 -6px 9px rgba(0, 0, 0, .26), 0 4px 0 #250203, 0 7px 11px rgba(0, 0, 0, .32) !important;
}
.gt-hw-page .gt-premium-machine .gt-hw-main-controls > button:first-child { grid-column: 2 !important; grid-row: 1 !important; }
.gt-hw-page .gt-premium-machine .gt-hw-main-controls > button:last-child { grid-column: 4 !important; grid-row: 1 !important; }
.gt-hw-page .gt-premium-machine .gt-hw-spin {
  grid-column: 3 !important; grid-row: 1 !important; width: 84px !important; height: 84px !important; max-width: none !important; justify-self: center !important;
  border: 4px solid #eec54d !important;
  background: radial-gradient(circle at 36% 27%, rgba(233,255,235,.75) 0 3%, transparent 8%), radial-gradient(circle at 50% 43%, #36d391 0 34%, #12a777 53%, #08785e 73%, #03463a 100%) !important;
  box-shadow: inset 0 3px 0 rgba(225,255,232,.42), inset 0 -9px 12px rgba(0,48,39,.48), 0 0 0 4px #84280b, 0 4px 0 #451007, 0 9px 15px rgba(0,0,0,.44), 0 0 16px rgba(47,218,150,.23) !important;
}

.gt-hw-page .gt-premium-machine .gt-premium-secondary > button {
  width: 50px !important; height: 50px !important; min-width: 50px !important; min-height: 50px !important; padding: 0 !important;
  border: 1px solid rgba(218, 161, 61, .42) !important; border-radius: 50% !important;
  background: linear-gradient(180deg, #77140e, #3d0506) !important; color: #f1cb70 !important;
  box-shadow: inset 0 1px 0 rgba(255, 230, 157, .10), inset 0 -6px 9px rgba(0,0,0,.25), 0 4px 0 #260203, 0 7px 11px rgba(0,0,0,.28) !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-secondary > button > span { display: none !important; }
.gt-hw-page .gt-premium-machine .gt-premium-secondary > button > svg { width: 21px !important; height: 21px !important; }
.gt-hw-page .gt-premium-machine .gt-premium-secondary > button > strong { font-size: 17px !important; line-height: 1 !important; color: currentColor !important; }
.gt-hw-page .gt-premium-machine .gt-premium-secondary > button:nth-child(1) { grid-column: 1 !important; grid-row: 1 !important; }
.gt-hw-page .gt-premium-machine .gt-premium-secondary > button:nth-child(1).is-active {
  color: #fff0a0 !important; border-color: rgba(255, 224, 122, .82) !important;
  background: radial-gradient(circle at 50% 40%, #a52913, #5a0907 68%) !important;
  box-shadow: inset 0 0 12px rgba(255,190,55,.18), 0 0 0 2px rgba(255,194,68,.14), 0 0 12px rgba(255,167,38,.24) !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-secondary > button:nth-child(2) {
  position: absolute !important; z-index: 8 !important; left: 50% !important; top: -43px !important;
  width: 48px !important; height: 34px !important; min-width: 48px !important; min-height: 34px !important;
  transform: translateX(-50%) !important; border-radius: 999px !important;
  background: linear-gradient(180deg, #59100d, #2c0304) !important;
  box-shadow: inset 0 1px 0 rgba(255, 229, 153, .12), 0 2px 5px rgba(0,0,0,.36) !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-secondary > button:nth-child(2) svg { width: 18px !important; height: 18px !important; }
.gt-hw-page .gt-premium-machine .gt-premium-secondary > button:nth-child(3) { grid-column: 5 !important; grid-row: 1 !important; }
.gt-hw-page .gt-premium-machine .gt-hw-main-controls > button:not(.gt-hw-spin):not(:disabled):active,
.gt-hw-page .gt-premium-machine .gt-premium-secondary > button:not(:disabled):active {
  transform: translateY(3px) scale(.96) !important;
  box-shadow: inset 0 5px 8px rgba(0,0,0,.28), 0 1px 0 #260203, 0 3px 5px rgba(0,0,0,.28) !important;
}
.gt-hw-page .gt-premium-machine .gt-premium-secondary > button:nth-child(2):not(:disabled):active { transform: translateX(-50%) translateY(2px) scale(.96) !important; }

@media (max-width: 390px) {
  .gt-hw-page .gt-premium-machine .gt-hw-controls.gt-commercial-console { grid-template-columns: 45px 43px 76px 43px 45px !important; grid-template-rows: 64px !important; gap: 5px !important; padding-inline: 5px !important; }
  .gt-hw-page .gt-premium-machine .gt-hw-main-controls > button:not(.gt-hw-spin) { width: 43px !important; height: 43px !important; min-width: 43px !important; min-height: 43px !important; }
  .gt-hw-page .gt-premium-machine .gt-hw-spin { width: 76px !important; height: 76px !important; }
  .gt-hw-page .gt-premium-machine .gt-premium-secondary > button:not(:nth-child(2)) { width: 45px !important; height: 45px !important; min-width: 45px !important; min-height: 45px !important; }
}
'''
    css.write_text(text, encoding="utf-8")
