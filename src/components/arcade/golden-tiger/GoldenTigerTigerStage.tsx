import { memo } from "react";

export type TigerReactionState = "idle" | "watch" | "coin" | "tense" | "win" | "full";

type Props = {
  reaction: TigerReactionState;
  featureActive: boolean;
  lockedCount: number;
};

export const GoldenTigerTigerStage = memo(function GoldenTigerTigerStage({
  reaction,
  featureActive,
  lockedCount,
}: Props) {
  return (
    <div className="gt-hw-tiger-stage" data-reaction={reaction} aria-hidden>
      <div className="gt-hw-tiger-aura" />
      <div className="gt-hw-tiger-sparks">
        {Array.from({ length: 9 }, (_, index) => <i key={index} />)}
      </div>
      <svg viewBox="0 0 180 145" className="gt-hw-tiger-art">
        <path d="m46 47-20-26 32 9M134 47l20-26-32 9" fill="#b15b12" stroke="#ffd977" strokeWidth="3" />
        <path d="m43 42-10-14 18 6M137 42l10-14-18 6" fill="#cb2744" />
        <path d="M66 35 73 13l17 11 17-11 7 22Z" fill="#f4bd25" stroke="#fff1a2" strokeWidth="3" />
        <circle cx="90" cy="25" r="5" fill="#d42031" stroke="#fff1a2" strokeWidth="2" />
        <ellipse cx="90" cy="76" rx="60" ry="50" fill="#e89a22" stroke="#ffe49a" strokeWidth="3" />
        <ellipse cx="61" cy="91" rx="23" ry="18" fill="#fff3d1" />
        <ellipse cx="119" cy="91" rx="23" ry="18" fill="#fff3d1" />
        <path d="M90 42v17M76 47h28M68 61l15-5M112 61l-15-5" stroke="#4a1c09" strokeWidth="4" strokeLinecap="round" />
        <path d="M39 72l14 3M37 84l15-1M141 72l-14 3M143 84l-15-1" stroke="#4a1c09" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="69" cy="73" rx="10" ry="8" fill="#fff" stroke="#4a1c09" strokeWidth="2" />
        <ellipse cx="111" cy="73" rx="10" ry="8" fill="#fff" stroke="#4a1c09" strokeWidth="2" />
        <circle cx="69" cy="75" r={reaction === "full" ? 6 : 4.5} fill={reaction === "idle" ? "#4a1c09" : "#b91523"} />
        <circle cx="111" cy="75" r={reaction === "full" ? 6 : 4.5} fill={reaction === "idle" ? "#4a1c09" : "#b91523"} />
        <circle cx="67" cy="72" r="2" fill="#fff" /><circle cx="109" cy="72" r="2" fill="#fff" />
        <path d="m84 88 6 7 6-7Z" fill="#b91523" />
        <path d={reaction === "coin" || reaction === "win" || reaction === "full" ? "M74 99q16 20 32 0" : "M78 101q12 7 24 0"} fill="none" stroke="#4a1c09" strokeWidth="3" strokeLinecap="round" />
        <path d="M57 92 29 88M58 99l-27 7M123 92l28-4M122 99l27 7" stroke="#69401c" strokeWidth="2" />
        <ellipse cx="56" cy="128" rx="22" ry="13" fill="#e69a22" stroke="#ffe49a" strokeWidth="2" />
        <ellipse cx="124" cy="128" rx="22" ry="13" fill="#e69a22" stroke="#ffe49a" strokeWidth="2" />
      </svg>
      <div className="gt-hw-tiger-caption">
        <strong>{featureActive ? `${lockedCount}/9` : "3×3"}</strong>
        <span>{featureActive ? "MOEDAS TRAVADAS" : "5 LINHAS FIXAS"}</span>
      </div>
    </div>
  );
});
