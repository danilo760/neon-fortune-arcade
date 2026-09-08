import { memo } from "react";
import type { GoldenTigerSymbolId } from "@/lib/arcade/goldenTigerMath";

type CompatibleSymbolId = GoldenTigerSymbolId | "bag";

type Props = {
  id: CompatibleSymbolId;
  isWinning?: boolean;
  isLocked?: boolean;
  className?: string;
};

export const GoldenTigerSymbol = memo(function GoldenTigerSymbol({
  id,
  isWinning = false,
  isLocked = false,
  className = "",
}: Props) {
  const symbol: GoldenTigerSymbolId = id === "bag" ? "fortuneBag" : id;

  return (
    <div
      className={`gt-hw-symbol ${isWinning ? "is-winning" : ""} ${isLocked ? "is-legacy-locked" : ""} ${className}`}
      data-symbol={symbol}
      aria-label={symbol}
    >
      {symbol === "wild" && (
        <svg viewBox="0 0 100 100" aria-hidden>
          <path d="M50 5 86 23 80 73 50 95 20 73 14 23Z" fill="#4b0908" stroke="#ffd86a" strokeWidth="3" />
          <path d="M29 31 40 17 50 27 60 17 71 31 65 55 50 65 35 55Z" fill="#f2a51f" stroke="#fff2a9" strokeWidth="2" />
          <path d="M50 28v15M41 35h18M36 46l10-4M64 46l-10-4" stroke="#4b1907" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="42" cy="42" rx="4" ry="3" fill="#fff" /><ellipse cx="58" cy="42" rx="4" ry="3" fill="#fff" />
          <circle cx="42" cy="42" r="2" fill="#9d1320" /><circle cx="58" cy="42" r="2" fill="#9d1320" />
          <path d="m46 51 4 5 4-5Z" fill="#9d1320" />
          <rect x="20" y="71" width="60" height="18" rx="6" fill="#8d0e0a" stroke="#ffd86a" strokeWidth="2" />
          <text x="50" y="84" textAnchor="middle" fill="#fff0a6" fontSize="12" fontWeight="900">WILD</text>
        </svg>
      )}

      {symbol === "lion" && (
        <svg viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="51" r="39" fill="#a5430d" stroke="#ffd86a" strokeWidth="3" />
          <path d="M23 44 13 31l18 2M77 44l10-13-18 2" fill="#ca6714" stroke="#ffd86a" strokeWidth="2" />
          <circle cx="50" cy="51" r="28" fill="#ed9a22" stroke="#fff0a6" strokeWidth="2" />
          <path d="M37 43q5-5 10 0M63 43q-5-5-10 0M45 54l5 5 5-5M38 64q12 10 24 0" stroke="#4c1c08" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M50 18 55 8l5 10 11-5-4 12H33l-4-12 11 5 5-10Z" fill="#ffd54f" stroke="#fff4b4" strokeWidth="2" />
        </svg>
      )}

      {symbol === "ingot" && (
        <svg viewBox="0 0 100 100" aria-hidden>
          <path d="M14 47q8 31 36 35 28-4 36-35-13 13-36 13T14 47Z" fill="#d99009" stroke="#fff1a3" strokeWidth="3" />
          <ellipse cx="50" cy="45" rx="35" ry="15" fill="#ffc92f" stroke="#fff4bc" strokeWidth="2" />
          <ellipse cx="50" cy="40" rx="18" ry="8" fill="#fff0a1" />
          <path d="M30 60q20 10 40 0" stroke="#8b4705" strokeWidth="3" fill="none" />
        </svg>
      )}

      {symbol === "fortuneBag" && (
        <svg viewBox="0 0 100 100" aria-hidden>
          <path d="M34 27q16 8 32 0l-7 12q20 17 15 40-24 15-48 0-5-23 15-40Z" fill="#c81d2c" stroke="#ffd86a" strokeWidth="3" />
          <path d="M34 29q16-11 32 0M31 38h38" stroke="#ffd86a" strokeWidth="5" strokeLinecap="round" />
          <circle cx="50" cy="62" r="15" fill="#f5b51b" stroke="#fff1a1" strokeWidth="2" />
          <path d="M42 62h16M50 54v16M44 56l12 12M56 56 44 68" stroke="#8d160f" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      )}

      {symbol === "firecracker" && (
        <svg viewBox="0 0 100 100" aria-hidden>
          <path d="M52 11q12 4 16 14" stroke="#ffd86a" strokeWidth="3" fill="none" />
          <path d="m70 19 4-9 4 9 9 2-8 5 2 9-7-6-8 6 3-9-8-5Z" fill="#ffe561" />
          <g transform="rotate(-12 50 52)"><rect x="31" y="26" width="38" height="17" rx="5" fill="#cf1628" stroke="#ffd86a" strokeWidth="2" /><rect x="31" y="46" width="38" height="17" rx="5" fill="#b70d1d" stroke="#ffd86a" strokeWidth="2" /><rect x="31" y="66" width="38" height="17" rx="5" fill="#cf1628" stroke="#ffd86a" strokeWidth="2" /><path d="M38 34h24M38 54h24M38 74h24" stroke="#fff1a3" strokeWidth="2" /></g>
        </svg>
      )}

      {symbol === "jade" && (
        <svg viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="52" r="37" fill="#159f82" stroke="#b7ffe7" strokeWidth="3" /><circle cx="50" cy="52" r="16" fill="#071a17" stroke="#8df6d5" strokeWidth="3" />
          <path d="M50 15v-9M45 10h10M27 37q23-15 46 0M27 67q23 15 46 0" stroke="#6ae7c0" strokeWidth="2" fill="none" /><path d="M45 9q5-6 10 0" stroke="#e22d38" strokeWidth="3" fill="none" />
        </svg>
      )}

      {symbol === "lantern" && (
        <svg viewBox="0 0 100 100" aria-hidden>
          <path d="M39 14h22v8H39zM37 78h26v8H37z" fill="#dfa516" stroke="#fff0a6" strokeWidth="2" /><path d="M38 22q-20 27 0 56h24q20-29 0-56Z" fill="#ce2549" stroke="#ffb6c6" strokeWidth="2" />
          <path d="M50 22v56M42 23q-9 27 0 54M58 23q9 27 0 54" stroke="#ff91ad" strokeWidth="2" fill="none" /><path d="M44 86v9M50 86v11M56 86v9" stroke="#f04343" strokeWidth="2" />
        </svg>
      )}

      {symbol === "orange" && (
        <svg viewBox="0 0 100 100" aria-hidden>
          <path d="M50 28q-4-15-19-12 4 12 19 12ZM50 28q5-15 19-12-3 12-19 12Z" fill="#2d9b45" stroke="#8af09a" strokeWidth="2" /><path d="M50 29V18" stroke="#6f4212" strokeWidth="4" strokeLinecap="round" />
          <circle cx="50" cy="58" r="34" fill="#ef7214" stroke="#ffd6a3" strokeWidth="3" /><ellipse cx="39" cy="46" rx="8" ry="5" fill="#fff" opacity=".3" transform="rotate(-25 39 46)" /><circle cx="62" cy="66" r="2" fill="#bc4608" /><circle cx="31" cy="62" r="2" fill="#bc4608" />
        </svg>
      )}
    </div>
  );
});
