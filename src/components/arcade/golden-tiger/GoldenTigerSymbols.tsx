import React, { memo } from "react";
import type { GoldenTigerSymbolId } from "@/lib/arcade/golden-tiger/goldenTigerConfig";

interface SymbolProps {
  id: GoldenTigerSymbolId;
  isWinning?: boolean;
  isLocked?: boolean;
  className?: string;
}

export const GoldenTigerSymbol = memo(function GoldenTigerSymbol({
  id,
  isWinning = false,
  isLocked = false,
  className = "",
}: SymbolProps) {
  return (
    <div
      className={`relative flex items-center justify-center size-full select-none ${className} ${
        isWinning ? "animate-pulse" : ""
      }`}
    >
      {id === "wild" && (
        <svg viewBox="0 0 100 100" className="size-[85%] drop-shadow-[0_0_12px_#ffd700]">
          <defs>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fff275" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
            <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ff0055" />
              <stop offset="100%" stopColor="#880020" />
            </radialGradient>
          </defs>
          {/* Fundo de escudo / medalha imperial */}
          <path d="M50 5 L88 22 L82 72 L50 95 L18 72 L12 22 Z" fill="#3b070d" stroke="url(#goldGrad)" strokeWidth="3" />
          {/* Cabeça do Tigre estilizada */}
          <path d="M30 30 L40 18 L50 26 L60 18 L70 30 L65 52 L50 62 L35 52 Z" fill="url(#goldGrad)" />
          {/* Orelhas */}
          <polygon points="25,25 35,28 30,38" fill="#ff0055" />
          <polygon points="75,25 65,28 70,38" fill="#ff0055" />
          {/* Listras */}
          <path d="M50 28 L50 42 M42 34 L58 34 M38 46 L45 44 M62 46 L55 44" stroke="#4a0404" strokeWidth="2.5" strokeLinecap="round" />
          {/* Olhos luminosos */}
          <ellipse cx="42" cy="40" rx="3.5" ry="2.5" fill="url(#eyeGlow)" />
          <ellipse cx="58" cy="40" rx="3.5" ry="2.5" fill="url(#eyeGlow)" />
          {/* Focinho e Presas */}
          <polygon points="46,48 54,48 50,54" fill="#ff0055" />
          <polygon points="43,52 46,52 44.5,58" fill="#ffffff" />
          <polygon points="57,52 54,52 55.5,58" fill="#ffffff" />
          {/* Texto "WILD" */}
          <rect x="22" y="70" width="56" height="18" rx="4" fill="#b91c1c" stroke="#fef08a" strokeWidth="1.5" />
          <text x="50" y="83.5" textAnchor="middle" fill="#fef08a" fontSize="11" fontWeight="900" letterSpacing="1">WILD</text>
        </svg>
      )}

      {id === "ingot" && (
        <svg viewBox="0 0 100 100" className="size-[82%] drop-shadow-[0_0_10px_#facc15]">
          <defs>
            <linearGradient id="ingotGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fffbeb" />
              <stop offset="35%" stopColor="#fde047" />
              <stop offset="70%" stopColor="#ca8a04" />
              <stop offset="100%" stopColor="#713f12" />
            </linearGradient>
          </defs>
          {/* Yuanbao / Lingote Tradicional */}
          <ellipse cx="50" cy="45" rx="38" ry="16" fill="#ca8a04" />
          <ellipse cx="50" cy="42" rx="32" ry="12" fill="#fef08a" />
          <path d="M12 45 C15 75, 85 75, 88 45 C80 62, 20 62, 12 45 Z" fill="url(#ingotGrad)" stroke="#fef08a" strokeWidth="1.5" />
          <ellipse cx="50" cy="38" rx="16" ry="7" fill="url(#ingotGrad)" />
          <circle cx="50" cy="54" r="5" fill="#ca8a04" />
          <path d="M47 54 L53 54 M50 51 L50 57" stroke="#fef08a" strokeWidth="1.5" />
        </svg>
      )}

      {id === "jade" && (
        <svg viewBox="0 0 100 100" className="size-[80%] drop-shadow-[0_0_10px_#2dd4bf]">
          <defs>
            <radialGradient id="jadeGrad" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#99f6e4" />
              <stop offset="50%" stopColor="#14b8a6" />
              <stop offset="85%" stopColor="#0f766e" />
              <stop offset="100%" stopColor="#042f2e" />
            </radialGradient>
          </defs>
          {/* Amuleto de Jade circular (Bi Disc) */}
          <circle cx="50" cy="50" r="36" fill="url(#jadeGrad)" stroke="#ccfbf1" strokeWidth="2.5" />
          <circle cx="50" cy="50" r="14" fill="#240003" stroke="#ccfbf1" strokeWidth="2" />
          {/* Gravuras e laço vermelho */}
          <path d="M50 14 L50 5 M45 10 L55 10" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" />
          <path d="M30 40 C35 30, 65 30, 70 40" stroke="#5eead4" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
          <path d="M30 60 C35 70, 65 70, 70 60" stroke="#5eead4" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
        </svg>
      )}

      {id === "bag" && (
        <svg viewBox="0 0 100 100" className="size-[80%] drop-shadow-[0_0_10px_#f43f5e]">
          <defs>
            <linearGradient id="bagGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fb7185" />
              <stop offset="45%" stopColor="#e11d48" />
              <stop offset="100%" stopColor="#881337" />
            </linearGradient>
          </defs>
          {/* Bolsa vermelha da fortuna */}
          <path d="M30 32 Q50 36 70 32 Q82 65 70 85 Q50 92 30 85 Q18 65 30 32 Z" fill="url(#bagGrad)" stroke="#fecdd3" strokeWidth="2" />
          {/* Amarra dourada e boca franzida */}
          <ellipse cx="50" cy="32" rx="20" ry="7" fill="#fbbf24" stroke="#78350f" strokeWidth="1" />
          <path d="M28 26 Q50 18 72 26 Q60 33 50 33 Q40 33 28 26 Z" fill="#e11d48" />
          {/* Ideograma de prosperidade */}
          <circle cx="50" cy="62" r="12" fill="#fbbf24" />
          <text x="50" y="67" textAnchor="middle" fill="#881337" fontSize="13" fontWeight="900">福</text>
        </svg>
      )}

      {id === "firecracker" && (
        <svg viewBox="0 0 100 100" className="size-[80%] drop-shadow-[0_0_10px_#fb923c]">
          {/* Rolo de fogos neon */}
          <g transform="rotate(-15 50 50)">
            {/* Cordão central */}
            <path d="M50 12 L50 88" stroke="#ca8a04" strokeWidth="2" strokeDasharray="2 2" />
            {/* Cilindros de fogos */}
            <rect x="36" y="22" width="28" height="15" rx="3" fill="#dc2626" stroke="#fef08a" strokeWidth="1.5" />
            <rect x="36" y="42" width="28" height="15" rx="3" fill="#dc2626" stroke="#fef08a" strokeWidth="1.5" />
            <rect x="36" y="62" width="28" height="15" rx="3" fill="#dc2626" stroke="#fef08a" strokeWidth="1.5" />
            {/* Detalhes dourados */}
            <line x1="36" y1="28" x2="64" y2="28" stroke="#fef08a" strokeWidth="2" />
            <line x1="36" y1="48" x2="64" y2="48" stroke="#fef08a" strokeWidth="2" />
            <line x1="36" y1="68" x2="64" y2="68" stroke="#fef08a" strokeWidth="2" />
            {/* Faíscas */}
            <polygon points="50,6 52,11 57,10 53,14 55,19 50,15 45,19 47,14 43,10 48,11" fill="#facc15" />
          </g>
        </svg>
      )}

      {id === "lantern" && (
        <svg viewBox="0 0 100 100" className="size-[80%] drop-shadow-[0_0_10px_#ec4899]">
          <defs>
            <radialGradient id="lanternGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fbcfe8" />
              <stop offset="50%" stopColor="#db2777" />
              <stop offset="100%" stopColor="#831843" />
            </radialGradient>
          </defs>
          {/* Cúpula superior e base */}
          <rect x="36" y="16" width="28" height="6" rx="2" fill="#ca8a04" stroke="#fef08a" strokeWidth="1" />
          <rect x="36" y="78" width="28" height="6" rx="2" fill="#ca8a04" stroke="#fef08a" strokeWidth="1" />
          {/* Corpo oval da lanterna */}
          <path d="M38 22 C20 38, 20 62, 38 78 L62 78 C80 62, 80 38, 62 22 Z" fill="url(#lanternGlow)" stroke="#fef08a" strokeWidth="1.5" />
          {/* Nervuras verticais */}
          <path d="M50 22 L50 78 M42 22 C34 38, 34 62, 42 78 M58 22 C66 38, 66 62, 58 78" stroke="#fbcfe8" strokeWidth="1.5" fill="none" opacity="0.6" />
          {/* Franjas inferiores */}
          <path d="M44 84 L44 94 M50 84 L50 97 M56 84 L56 94" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}

      {id === "orange" && (
        <svg viewBox="0 0 100 100" className="size-[80%] drop-shadow-[0_0_10px_#f97316]">
          <defs>
            <radialGradient id="orangeGrad" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#fed7aa" />
              <stop offset="45%" stopColor="#f97316" />
              <stop offset="85%" stopColor="#c2410c" />
              <stop offset="100%" stopColor="#7c2d12" />
            </radialGradient>
          </defs>
          {/* Folhinhas no topo */}
          <path d="M50 28 C45 15, 30 18, 32 28 Z" fill="#16a34a" stroke="#86efac" strokeWidth="1" />
          <path d="M50 28 C55 15, 70 18, 68 28 Z" fill="#15803d" stroke="#86efac" strokeWidth="1" />
          {/* Caule */}
          <path d="M50 28 L50 20" stroke="#713f12" strokeWidth="3" strokeLinecap="round" />
          {/* Corpo da tangerina */}
          <ellipse cx="50" cy="58" rx="36" ry="32" fill="url(#orangeGrad)" stroke="#ffedd5" strokeWidth="1.5" />
          {/* Brilho suave */}
          <ellipse cx="40" cy="46" rx="8" ry="5" fill="#ffffff" opacity="0.35" transform="rotate(-20 40 46)" />
        </svg>
      )}

      {/* Moldura de travamento dourada quando travado no Lucky Tiger Respin */}
      {isLocked && (
        <div
          className="absolute inset-0 rounded-xl border-2 border-yellow-300 bg-yellow-400/10 shadow-[0_0_15px_rgba(255,215,0,0.6)] pointer-events-none animate-pulse"
          aria-hidden="true"
        >
          <span className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-yellow-400 border border-yellow-100 flex items-center justify-center text-[8px] font-black text-amber-950">
            ★
          </span>
        </div>
      )}
    </div>
  );
});
