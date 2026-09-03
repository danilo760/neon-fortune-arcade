import { useId } from "react";

export type GoldenTigerSymbolId =
  | "tiger"
  | "ingot"
  | "envelope"
  | "orange"
  | "moneybag"
  | "firecrackers"
  | "jade"
  | "lantern";

type Props = {
  id: GoldenTigerSymbolId;
  compact?: boolean;
};

export function GoldenTigerSymbolArtV3({ id, compact = false }: Props) {
  const uid = useId().replace(/:/g, "");
  const sizeClass = compact ? "size-[92%]" : "size-full";

  return (
    <div className={`relative flex size-full items-center justify-center overflow-hidden rounded-[18%] ${symbolBackground(id)}`}>
      <div className="absolute inset-[4.5%] rounded-[18%] border border-yellow-200/25 shadow-[inset_0_0_18px_rgba(255,231,151,.18)]" />
      <div className="absolute left-[9%] top-[7%] h-[20%] w-[30%] rounded-full bg-white/25 blur-xl" />
      <svg viewBox="0 0 100 100" className={`${sizeClass} drop-shadow-[0_8px_8px_rgba(0,0,0,.45)]`} aria-hidden="true">
        <defs>
          <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff7b0" />
            <stop offset="0.28" stopColor="#ffd24b" />
            <stop offset="0.62" stopColor="#e08a0c" />
            <stop offset="1" stopColor="#8d3d03" />
          </linearGradient>
          <linearGradient id={`${uid}-red`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff6b45" />
            <stop offset="0.45" stopColor="#e4251e" />
            <stop offset="1" stopColor="#840b0b" />
          </linearGradient>
          <linearGradient id={`${uid}-jade`} x1="0" y1="0" x2="0.9" y2="1">
            <stop offset="0" stopColor="#aaffd5" />
            <stop offset="0.3" stopColor="#28d786" />
            <stop offset="0.7" stopColor="#07804d" />
            <stop offset="1" stopColor="#02442e" />
          </linearGradient>
          <radialGradient id={`${uid}-orange`} cx="35%" cy="26%" r="72%">
            <stop offset="0" stopColor="#fff49f" />
            <stop offset="0.22" stopColor="#ffcd38" />
            <stop offset="0.62" stopColor="#f06a0a" />
            <stop offset="1" stopColor="#a82a00" />
          </radialGradient>
        </defs>
        {renderSymbol(id, uid)}
      </svg>
    </div>
  );
}

function symbolBackground(id: GoldenTigerSymbolId) {
  if (id === "envelope") return "bg-[radial-gradient(circle_at_50%_30%,#8c1911,#560806_72%,#2b0202)]";
  if (id === "jade") return "bg-[radial-gradient(circle_at_50%_28%,#154f37,#062f24_68%,#01150f)]";
  if (id === "orange") return "bg-[radial-gradient(circle_at_50%_25%,#79310b,#431507_72%,#240603)]";
  return "bg-[radial-gradient(circle_at_50%_30%,#89190e,#580904_70%,#2a0201)]";
}

function renderSymbol(id: GoldenTigerSymbolId, uid: string) {
  switch (id) {
    case "tiger":
      return (
        <g>
          <circle cx="50" cy="52" r="38" fill="#f59a22" stroke={`url(#${uid}-gold)`} strokeWidth="4" />
          <path d="M22 31 13 18l18 5M78 31 87 18l-18 5" fill="#f3a230" stroke="#7c2b0c" strokeWidth="4" strokeLinejoin="round" />
          <path d="M24 54c0-21 11-34 26-34s26 13 26 34c0 17-11 28-26 28S24 71 24 54Z" fill="#ffc45b" />
          <path d="M32 57c5-10 13-14 18-14s13 4 18 14c1 12-6 20-18 20s-19-8-18-20Z" fill="#fff0cf" />
          <ellipse cx="37" cy="48" rx="6.5" ry="8" fill="#2b120a" />
          <ellipse cx="63" cy="48" rx="6.5" ry="8" fill="#2b120a" />
          <circle cx="39" cy="45" r="2.5" fill="white" />
          <circle cx="65" cy="45" r="2.5" fill="white" />
          <path d="M46 57c2-3 6-3 8 0-1 4-3 6-4 6s-3-2-4-6Z" fill="#7c241d" />
          <path d="M43 66c5 4 9 4 14 0" fill="none" stroke="#8e2e24" strokeWidth="3" strokeLinecap="round" />
          <path d="M36 25 43 35M50 22v13M64 25 57 35M27 41l10 4M73 41l-10 4" stroke="#4d1b0a" strokeWidth="5" strokeLinecap="round" />
          <circle cx="18" cy="18" r="7" fill="#b61714" stroke={`url(#${uid}-gold)`} strokeWidth="3" />
          <path d="M13 17h10M18 12v11" stroke="#ffd86c" strokeWidth="2" />
        </g>
      );
    case "ingot":
      return (
        <g>
          <ellipse cx="50" cy="73" rx="32" ry="8" fill="#6f2600" opacity=".55" />
          <path d="M18 48c10 5 17 2 21-9h22c4 11 11 14 21 9l-8 27H26L18 48Z" fill={`url(#${uid}-gold)`} stroke="#fff0a0" strokeWidth="3" strokeLinejoin="round" />
          <ellipse cx="50" cy="46" rx="18" ry="10" fill="#ffd95a" stroke="#fff4ac" strokeWidth="3" />
          <ellipse cx="50" cy="47" rx="10" ry="5" fill="#c97909" opacity=".7" />
          <path d="M28 59c9 5 35 5 44 0" fill="none" stroke="#fff1a1" strokeWidth="2" opacity=".7" />
          <path d="M48 55h4v12h-4zM44 59h12v4H44z" fill="#a34b04" opacity=".9" />
        </g>
      );
    case "envelope":
      return (
        <g>
          <g transform="rotate(-9 39 49)">
            <rect x="18" y="26" width="45" height="55" rx="6" fill="#9a0d0b" stroke="#ffcb43" strokeWidth="3" />
          </g>
          <g transform="rotate(7 60 49)">
            <rect x="39" y="21" width="43" height="57" rx="6" fill={`url(#${uid}-red)`} stroke="#ffe06c" strokeWidth="3.3" />
            <path d="M42 31 60 45 79 31" fill="none" stroke="#ffcf50" strokeWidth="2.4" />
            <circle cx="60.5" cy="54" r="12" fill="#f7bc29" stroke="#fff0a0" strokeWidth="2" />
            <text x="60.5" y="60" textAnchor="middle" fontSize="18" fontWeight="900" fill="#ad140f">福</text>
          </g>
          <path d="M70 20c7 4 11 9 14 16" fill="none" stroke="#ffe36b" strokeWidth="3" strokeLinecap="round" />
          <circle cx="84" cy="37" r="3" fill="#ffe878" />
        </g>
      );
    case "orange":
      return (
        <g>
          <circle cx="48" cy="58" r="28" fill={`url(#${uid}-orange)`} stroke="#ffdc61" strokeWidth="3" />
          <circle cx="39" cy="48" r="7" fill="#fff2a1" opacity=".55" />
          <path d="M47 30c2-9 8-15 14-18" fill="none" stroke="#2f7d29" strokeWidth="5" strokeLinecap="round" />
          <path d="M58 18c12-6 20-2 24 5-9 5-18 5-24-5Z" fill="#43a640" stroke="#b7e879" strokeWidth="2" />
          <path d="M67 22c8 1 12 5 14 9-8 3-15 1-20-5" fill="#2e8b35" />
        </g>
      );
    case "moneybag":
      return (
        <g>
          <path d="M38 27c4 4 20 4 24 0l7 10c-6 4-32 4-38 0l7-10Z" fill="#7f130d" stroke="#ffcf4d" strokeWidth="3" />
          <path d="M27 43c4-9 42-9 46 0l7 30c-8 13-52 13-60 0l7-30Z" fill={`url(#${uid}-red)`} stroke="#ffca48" strokeWidth="3.5" />
          <path d="M25 45c14 7 36 7 50 0" fill="none" stroke="#ffdf71" strokeWidth="2.5" />
          <circle cx="50" cy="61" r="14" fill={`url(#${uid}-gold)`} stroke="#fff1a6" strokeWidth="2.3" />
          <path d="M45 53h10v16H45zM40 58h20v6H40z" fill="#9c3e04" />
          <path d="M69 35c7 1 11 4 14 8" fill="none" stroke="#ffdf65" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case "firecrackers":
      return (
        <g>
          <path d="M50 18c-2 10-7 17-14 23" fill="none" stroke="#e9bc45" strokeWidth="4" strokeLinecap="round" />
          <g transform="rotate(-13 37 52)">
            <rect x="23" y="31" width="19" height="42" rx="6" fill={`url(#${uid}-jade)`} stroke="#f6c749" strokeWidth="3" />
            <path d="M27 42h11M27 57h11" stroke="#e8c05b" strokeWidth="2" />
          </g>
          <g transform="rotate(12 60 54)">
            <rect x="49" y="33" width="20" height="43" rx="6" fill={`url(#${uid}-jade)`} stroke="#f6c749" strokeWidth="3" />
            <path d="M53 45h12M53 60h12" stroke="#e8c05b" strokeWidth="2" />
          </g>
          <path d="M26 75c8 9 14 8 22 2M55 78c7 7 13 6 20 0" fill="none" stroke="#d82b20" strokeWidth="5" strokeLinecap="round" />
          <circle cx="77" cy="24" r="5" fill="#ffda54" />
          <path d="M77 13v6M77 29v7M66 24h6M82 24h7" stroke="#ffec8a" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );
    case "jade":
      return (
        <g>
          <circle cx="50" cy="48" r="29" fill={`url(#${uid}-jade)`} stroke="#bfffdc" strokeWidth="3" />
          <circle cx="50" cy="48" r="16" fill="#064b37" stroke="#76efb0" strokeWidth="3" />
          <path d="M50 24c7 8 13 12 21 15-7 5-12 11-15 19-7-5-12-5-20 0-2-8-6-14-12-19 8-3 14-7 26-15Z" fill="none" stroke="#b9ffd6" strokeWidth="2.5" opacity=".7" />
          <path d="M50 65c-4 8-10 13-18 18M50 65c4 8 10 13 18 18" fill="none" stroke="#d42c23" strokeWidth="4" strokeLinecap="round" />
          <circle cx="32" cy="83" r="4" fill="#ffd34f" />
          <circle cx="68" cy="83" r="4" fill="#ffd34f" />
        </g>
      );
    case "lantern":
      return (
        <g>
          <path d="M35 22h30M39 18h22" stroke="#ffd45d" strokeWidth="4" strokeLinecap="round" />
          <path d="M28 35c7-10 37-10 44 0l-5 34c-9 9-25 9-34 0l-5-34Z" fill={`url(#${uid}-red)`} stroke="#ffd45d" strokeWidth="3.5" />
          <path d="M39 31c-3 12-3 29 0 42M50 29v47M61 31c3 12 3 29 0 42" fill="none" stroke="#ffca48" strokeWidth="2" opacity=".8" />
          <circle cx="50" cy="52" r="10" fill="#f1ac20" opacity=".9" />
          <path d="M47 47h6v12h-6zM43 50h14v6H43z" fill="#a52a10" />
          <path d="M50 76v12M44 84h12" stroke="#ffd45d" strokeWidth="3" strokeLinecap="round" />
          <path d="M46 88 42 95M50 88v7M54 88l4 7" stroke="#d93025" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );
  }
}
