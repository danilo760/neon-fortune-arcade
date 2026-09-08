import { memo } from "react";

export type TigerReactionState = "idle" | "watch" | "reveal" | "coin" | "tense" | "win" | "full";

type Props = {
  reaction: TigerReactionState;
  featureActive: boolean;
  lockedCount: number;
};

/**
 * Lightweight SVG character rig for Golden Tiger.
 *
 * The mascot is intentionally original.  The groups below are split into
 * body/head/arms/tail/eyes so CSS can stage anticipation, follow-through and
 * reaction without replacing the character with a commercial sprite.
 */
export const GoldenTigerTigerStage = memo(function GoldenTigerTigerStage({
  reaction,
  featureActive,
  lockedCount,
}: Props) {
  return (
    <div
      className="gt-hw-tiger-stage"
      data-reaction={reaction}
      data-feature-active={featureActive ? "true" : "false"}
      aria-hidden
    >
      <div className="gt-hw-tiger-spotlight" />
      <div className="gt-hw-tiger-aura" />
      <div className="gt-hw-tiger-floor-shadow" />

      <div className="gt-hw-tiger-sparks">
        {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
      </div>

      <svg viewBox="0 0 210 164" className="gt-hw-tiger-art">
        <defs>
          <linearGradient id="gtTigerFurV4" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffd257" />
            <stop offset=".42" stopColor="#ef9c24" />
            <stop offset="1" stopColor="#b94f10" />
          </linearGradient>
          <linearGradient id="gtTigerGoldV4" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff1a4" />
            <stop offset=".45" stopColor="#f6c843" />
            <stop offset="1" stopColor="#a85c0b" />
          </linearGradient>
          <radialGradient id="gtTigerGemV4">
            <stop offset="0" stopColor="#ffb8b1" />
            <stop offset=".5" stopColor="#e83142" />
            <stop offset="1" stopColor="#8f0d1c" />
          </radialGradient>
        </defs>

        <g className="gt-hw-tiger-tail">
          <path
            d="M155 113c31 4 36 25 18 33-14 6-26-3-19-11 5-6 13 1 11 5"
            fill="none"
            stroke="url(#gtTigerFurV4)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <path d="M171 122c5 4 8 9 7 14" fill="none" stroke="#51230d" strokeWidth="4" strokeLinecap="round" />
        </g>

        <g className="gt-hw-tiger-body">
          <ellipse cx="105" cy="118" rx="46" ry="35" fill="url(#gtTigerFurV4)" stroke="#ffe6a0" strokeWidth="3" />
          <ellipse cx="105" cy="121" rx="25" ry="24" fill="#fff0c7" opacity=".95" />
          <path d="M89 107c9 6 23 6 32 0M84 118c12 6 30 6 42 0" fill="none" stroke="#5b270e" strokeWidth="4" strokeLinecap="round" opacity=".85" />
          <g className="gt-hw-tiger-medallion">
            <circle cx="105" cy="126" r="12" fill="url(#gtTigerGoldV4)" stroke="#fff1aa" strokeWidth="2.5" />
            <circle cx="105" cy="126" r="6.5" fill="url(#gtTigerGemV4)" stroke="#73111b" strokeWidth="2" />
          </g>
        </g>

        <g className="gt-hw-tiger-arm gt-hw-tiger-arm--left">
          <path d="M70 104c-18 6-25 20-17 31 6 9 20 4 23-7l6-21" fill="url(#gtTigerFurV4)" stroke="#ffe19a" strokeWidth="3" />
          <ellipse cx="57" cy="131" rx="12" ry="9" fill="#fff0c7" stroke="#e9a02a" strokeWidth="2" />
        </g>
        <g className="gt-hw-tiger-arm gt-hw-tiger-arm--right">
          <path d="M140 104c18 6 25 20 17 31-6 9-20 4-23-7l-6-21" fill="url(#gtTigerFurV4)" stroke="#ffe19a" strokeWidth="3" />
          <ellipse cx="153" cy="131" rx="12" ry="9" fill="#fff0c7" stroke="#e9a02a" strokeWidth="2" />
        </g>

        <g className="gt-hw-tiger-head">
          <path d="m63 49-20-28 34 9M147 49l20-28-34 9" fill="#b15b12" stroke="#ffd977" strokeWidth="3" />
          <path d="m60 44-10-14 18 6M150 44l10-14-18 6" fill="#cb2744" />

          <path d="M79 36 87 13l18 11 18-11 8 23Z" fill="url(#gtTigerGoldV4)" stroke="#fff1a2" strokeWidth="3" />
          <circle cx="105" cy="25" r="6" fill="url(#gtTigerGemV4)" stroke="#fff1a2" strokeWidth="2" />

          <ellipse cx="105" cy="76" rx="61" ry="49" fill="url(#gtTigerFurV4)" stroke="#ffe49a" strokeWidth="3" />
          <ellipse cx="76" cy="92" rx="24" ry="18" fill="#fff3d1" />
          <ellipse cx="134" cy="92" rx="24" ry="18" fill="#fff3d1" />

          <path d="M105 42v17M91 47h28M83 61l15-5M127 61l-15-5" stroke="#4a1c09" strokeWidth="4" strokeLinecap="round" />
          <path d="M54 72l14 3M52 84l15-1M156 72l-14 3M158 84l-15-1" stroke="#4a1c09" strokeWidth="3" strokeLinecap="round" />

          <g className="gt-hw-tiger-eye gt-hw-tiger-eye--left">
            <ellipse cx="84" cy="74" rx="10.5" ry="8.5" fill="#fff" stroke="#4a1c09" strokeWidth="2" />
            <circle className="gt-hw-tiger-pupil" cx="84" cy="76" r={reaction === "full" ? 6 : reaction === "tense" ? 5.5 : 4.7} fill={reaction === "idle" ? "#4a1c09" : "#b91523"} />
            <circle cx="81.5" cy="72.5" r="2" fill="#fff" />
            <ellipse className="gt-hw-tiger-lid gt-hw-tiger-lid--left" cx="84" cy="74" rx="11" ry="9" fill="#e89a22" stroke="#4a1c09" strokeWidth="1.5" />
          </g>
          <g className="gt-hw-tiger-eye gt-hw-tiger-eye--right">
            <ellipse cx="126" cy="74" rx="10.5" ry="8.5" fill="#fff" stroke="#4a1c09" strokeWidth="2" />
            <circle className="gt-hw-tiger-pupil" cx="126" cy="76" r={reaction === "full" ? 6 : reaction === "tense" ? 5.5 : 4.7} fill={reaction === "idle" ? "#4a1c09" : "#b91523"} />
            <circle cx="123.5" cy="72.5" r="2" fill="#fff" />
            <ellipse className="gt-hw-tiger-lid gt-hw-tiger-lid--right" cx="126" cy="74" rx="11" ry="9" fill="#e89a22" stroke="#4a1c09" strokeWidth="1.5" />
          </g>

          <path d="m99 89 6 7 6-7Z" fill="#b91523" />
          <path
            className="gt-hw-tiger-mouth"
            d={reaction === "coin" || reaction === "win" || reaction === "full" ? "M87 100q18 21 36 0" : reaction === "tense" ? "M91 102q14-4 28 0" : "M92 101q13 7 26 0"}
            fill="none"
            stroke="#4a1c09"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="M72 93 43 89M73 100l-28 8M138 93l29-4M137 100l28 8" stroke="#69401c" strokeWidth="2" />
        </g>

        <g className="gt-hw-tiger-coin-prop">
          <circle cx="105" cy="66" r="13" fill="url(#gtTigerGoldV4)" stroke="#fff4b5" strokeWidth="2" />
          <path d="M99 66h12M105 60v12" stroke="#8c4407" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      </svg>

      <div className="gt-hw-tiger-caption">
        <strong>{featureActive ? `${lockedCount}/9` : "3×3"}</strong>
        <span>{featureActive ? "MOEDAS TRAVADAS" : "5 LINHAS FIXAS"}</span>
      </div>
    </div>
  );
});
