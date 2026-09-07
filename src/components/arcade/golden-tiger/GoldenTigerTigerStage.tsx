import React, { memo, useEffect, useState } from "react";

export type TigerReactionState =
  | "idle"
  | "blink"
  | "spin_watch"
  | "anticipation"
  | "lock"
  | "small_win"
  | "big_win"
  | "full_grid"
  | "loss";

interface TigerStageProps {
  reaction: TigerReactionState;
  respinActive: boolean;
  lockedCount: number;
}

export const GoldenTigerTigerStage = memo(function GoldenTigerTigerStage({
  reaction,
  respinActive,
  lockedCount,
}: TigerStageProps) {
  const [blink, setBlink] = useState(false);

  // Ciclo natural de piscar no estado idle
  useEffect(() => {
    if (reaction !== "idle") return;
    const interval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 160);
    }, 3800);
    return () => clearInterval(interval);
  }, [reaction]);

  const isExcited =
    reaction === "anticipation" ||
    reaction === "lock" ||
    reaction === "big_win" ||
    reaction === "full_grid";

  const isCelebrating =
    reaction === "small_win" ||
    reaction === "big_win" ||
    reaction === "full_grid";

  return (
    <div className="relative w-full h-[150px] flex flex-col items-center justify-end overflow-hidden select-none">
      {/* Halo de fundo / Aura mística */}
      <div
        className={`absolute inset-x-[15%] top-2 bottom-4 rounded-full blur-xl transition-all duration-500 pointer-events-none ${
          reaction === "full_grid"
            ? "bg-yellow-400/45 scale-125"
            : respinActive
            ? "bg-amber-500/35 scale-110"
            : isCelebrating
            ? "bg-emerald-500/25"
            : "bg-red-700/20"
        }`}
      />

      {/* Partículas de moedas em vitórias comemorativas */}
      {isCelebrating && (
        <div className="absolute inset-0 pointer-events-none flex justify-around items-end overflow-hidden">
          <span className="text-yellow-300 text-base animate-bounce [animation-delay:0ms]">🪙</span>
          <span className="text-yellow-300 text-lg animate-bounce [animation-delay:150ms]">✨</span>
          <span className="text-yellow-300 text-sm animate-bounce [animation-delay:300ms]">🪙</span>
          <span className="text-yellow-300 text-xl animate-bounce [animation-delay:100ms]">⭐</span>
          <span className="text-yellow-300 text-base animate-bounce [animation-delay:250ms]">🪙</span>
        </div>
      )}

      {/* Ilustração SVG do Mascote Tigre */}
      <div
        className={`relative z-10 w-[130px] h-[115px] transition-transform duration-300 ${
          reaction === "full_grid"
            ? "scale-115 -translate-y-2"
            : isExcited
            ? "scale-105 -translate-y-1"
            : reaction === "spin_watch"
            ? "translate-y-0.5"
            : ""
        }`}
      >
        <svg viewBox="0 0 130 115" className="size-full filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
          <defs>
            <linearGradient id="tigerBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="30%" stopColor="#f59e0b" />
              <stop offset="70%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#78350f" />
            </linearGradient>
            <linearGradient id="crownGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fffbeb" />
              <stop offset="50%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
          </defs>

          {/* Orelhas com interior rosa neon */}
          <polygon points="32,28 48,15 50,38" fill="#b45309" />
          <polygon points="36,26 46,18 47,34" fill="#ff0055" />
          <polygon points="98,28 82,15 80,38" fill="#b45309" />
          <polygon points="94,26 84,18 83,34" fill="#ff0055" />

          {/* Cabeça do Tigre */}
          <ellipse cx="65" cy="56" rx="42" ry="34" fill="url(#tigerBodyGrad)" stroke="#fef08a" strokeWidth="1.5" />

          {/* Bochechas brancas orientais */}
          <ellipse cx="44" cy="65" rx="16" ry="12" fill="#fffbeb" opacity="0.95" />
          <ellipse cx="86" cy="65" rx="16" ry="12" fill="#fffbeb" opacity="0.95" />

          {/* Coroa Imperial com Rubi Central */}
          <path d="M48 24 L54 10 L65 18 L76 10 L82 24 Z" fill="url(#crownGrad)" stroke="#fef08a" strokeWidth="1" />
          <circle cx="65" cy="19" r="3.5" fill="#ef4444" stroke="#fef08a" strokeWidth="1" />

          {/* Listras do Tigre */}
          <path d="M65 30 L65 42 M56 34 L74 34 M52 45 L58 43 M78 45 L72 43" stroke="#451a03" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M28 50 L36 53 M26 58 L35 59" stroke="#451a03" strokeWidth="2" strokeLinecap="round" />
          <path d="M102 50 L94 53 M104 58 L95 59" stroke="#451a03" strokeWidth="2" strokeLinecap="round" />

          {/* Olhos (com animação de olhar/piscar/foco) */}
          <g>
            {/* Esquerdo */}
            {blink ? (
              <line x1="44" y1="52" x2="56" y2="52" stroke="#451a03" strokeWidth="3" strokeLinecap="round" />
            ) : (
              <>
                <ellipse cx="50" cy="51" rx="6.5" ry="5.5" fill="#ffffff" stroke="#451a03" strokeWidth="1.5" />
                <ellipse
                  cx={reaction === "spin_watch" ? "50" : reaction === "lock" ? "51" : "50"}
                  cy={reaction === "spin_watch" ? "53" : "51"}
                  rx={isExcited ? "4" : "3"}
                  ry={isExcited ? "4.5" : "3.5"}
                  fill={isExcited ? "#dc2626" : "#451a03"}
                />
                <circle cx="48.5" cy="49.5" r="1.5" fill="#ffffff" />
              </>
            )}

            {/* Direito */}
            {blink ? (
              <line x1="74" y1="52" x2="86" y2="52" stroke="#451a03" strokeWidth="3" strokeLinecap="round" />
            ) : (
              <>
                <ellipse cx="80" cy="51" rx="6.5" ry="5.5" fill="#ffffff" stroke="#451a03" strokeWidth="1.5" />
                <ellipse
                  cx={reaction === "spin_watch" ? "80" : reaction === "lock" ? "79" : "80"}
                  cy={reaction === "spin_watch" ? "53" : "51"}
                  rx={isExcited ? "4" : "3"}
                  ry={isExcited ? "4.5" : "3.5"}
                  fill={isExcited ? "#dc2626" : "#451a03"}
                />
                <circle cx="78.5" cy="49.5" r="1.5" fill="#ffffff" />
              </>
            )}
          </g>

          {/* Focinho e Bigodes */}
          <polygon points="62,60 68,60 65,65" fill="#dc2626" />
          <path d="M65 65 Q58 72 50 68 M65 65 Q72 72 80 68" stroke="#451a03" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          {/* Bigodes */}
          <line x1="38" y1="66" x2="22" y2="64" stroke="#78350f" strokeWidth="1.2" />
          <line x1="38" y1="70" x2="24" y2="73" stroke="#78350f" strokeWidth="1.2" />
          <line x1="92" y1="66" x2="108" y2="64" stroke="#78350f" strokeWidth="1.2" />
          <line x1="92" y1="70" x2="106" y2="73" stroke="#78350f" strokeWidth="1.2" />

          {/* Boca (Sorriso ou Rugido em Bônus) */}
          {isExcited ? (
            <path d="M56 70 Q65 82 74 70 Z" fill="#991b1b" stroke="#fef08a" strokeWidth="1" />
          ) : (
            <circle cx="65" cy="71" r="1.5" fill="#991b1b" />
          )}

          {/* Patas segurando o topo do gabinete */}
          <ellipse cx="38" cy="98" rx="14" ry="9" fill="url(#tigerBodyGrad)" stroke="#fef08a" strokeWidth="1" />
          <ellipse cx="92" cy="98" rx="14" ry="9" fill="url(#tigerBodyGrad)" stroke="#fef08a" strokeWidth="1" />
          <circle cx="34" cy="100" r="2" fill="#78350f" />
          <circle cx="38" cy="101" r="2" fill="#78350f" />
          <circle cx="42" cy="100" r="2" fill="#78350f" />
          <circle cx="88" cy="100" r="2" fill="#78350f" />
          <circle cx="92" cy="101" r="2" fill="#78350f" />
          <circle cx="96" cy="100" r="2" fill="#78350f" />
        </svg>
      </div>

      {/* Banner de status / Balão temático sob o tigre */}
      <div className="relative z-20 -mt-1 px-4 py-1 rounded-full border border-yellow-400/80 bg-gradient-to-r from-red-950 via-amber-950 to-red-950 shadow-[0_0_12px_rgba(251,191,36,0.35)] flex items-center gap-2">
        <span className="size-2 rounded-full bg-yellow-400 animate-ping" />
        <p className="text-[10px] font-black uppercase tracking-wider text-amber-200">
          {reaction === "full_grid"
            ? "💥 TELA CHEIA · MULTIPLICADOR x10! 💥"
            : respinActive
            ? `TIGRE DA SORTE · ${lockedCount}/9 TRAVADOS`
            : reaction === "big_win"
            ? "GRANDE VITÓRIA!"
            : reaction === "anticipation"
            ? "ATENÇÃO... VEM PRÊMIO!"
            : reaction === "spin_watch"
            ? "ROLANDO OS ROLOS..."
            : "3×3 · 5 LINHAS FIXAS · TIGRE DA SORTE"}
        </p>
      </div>
    </div>
  );
});
