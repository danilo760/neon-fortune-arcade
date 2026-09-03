import type { ReactNode } from "react";

export type GoldenTigerSymbolId =
  | "wild"
  | "scatter"
  | "ingot"
  | "orange"
  | "fortuneBag"
  | "firecracker"
  | "jadeKnot"
  | "lantern"
  | "lion";

const shell = (children: ReactNode, glow: string, background: string) => (
  <div
    className="relative flex size-full items-center justify-center overflow-hidden rounded-[20%] border border-yellow-200/35 shadow-[inset_0_0_18px_rgba(255,255,255,.1),0_6px_14px_rgba(0,0,0,.45)]"
    style={{ background, boxShadow: `inset 0 0 18px rgba(255,255,255,.1), 0 0 18px ${glow}, 0 7px 14px rgba(0,0,0,.5)` }}
  >
    <div className="pointer-events-none absolute inset-[5%] rounded-[18%] border border-yellow-100/20" />
    <div className="pointer-events-none absolute left-[12%] top-[8%] h-[14%] w-[28%] rounded-full bg-white/25 blur-md" />
    {children}
  </div>
);

function TigerFace() {
  return (
    <svg viewBox="0 0 120 120" className="size-[88%] drop-shadow-[0_7px_6px_rgba(0,0,0,.45)]" aria-hidden="true">
      <defs>
        <radialGradient id="tigerFur" cx="50%" cy="38%" r="64%">
          <stop offset="0" stopColor="#ffd968" />
          <stop offset=".56" stopColor="#f69b21" />
          <stop offset="1" stopColor="#b4440d" />
        </radialGradient>
        <linearGradient id="tigerGold" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fff4a0" />
          <stop offset=".4" stopColor="#ffc62e" />
          <stop offset="1" stopColor="#a95400" />
        </linearGradient>
      </defs>
      <path d="M18 41 8 18l26 8M102 41l10-23-26 8" fill="url(#tigerFur)" stroke="#6b1c0b" strokeWidth="5" strokeLinejoin="round" />
      <ellipse cx="60" cy="62" rx="43" ry="46" fill="url(#tigerFur)" stroke="#6d230c" strokeWidth="5" />
      <ellipse cx="41" cy="60" rx="10" ry="14" fill="#fff9e8" />
      <ellipse cx="79" cy="60" rx="10" ry="14" fill="#fff9e8" />
      <circle cx="43" cy="62" r="5" fill="#26130d" />
      <circle cx="77" cy="62" r="5" fill="#26130d" />
      <path d="M51 73q9-8 18 0l-9 8Z" fill="#7c251f" />
      <ellipse cx="60" cy="86" rx="24" ry="18" fill="#fff1d1" />
      <path d="M50 87q10 12 20 0" fill="none" stroke="#6a1e18" strokeWidth="4" strokeLinecap="round" />
      <path d="M31 37 47 48M89 37 73 48M60 26v18M47 25l7 18M73 25l-7 18" stroke="#3f1b11" strokeWidth="6" strokeLinecap="round" />
      <path d="M34 79 18 75M36 87l-18 3M86 79l16-4M84 87l18 3" stroke="#59301e" strokeWidth="3" strokeLinecap="round" />
      <path d="M35 23q25-17 50 0l-7 15H42Z" fill="#d6201f" stroke="#74200e" strokeWidth="4" />
      <path d="M44 21h32l-7-13H51Z" fill="url(#tigerGold)" stroke="#8b5205" strokeWidth="3" />
      <circle cx="60" cy="18" r="5" fill="#27c891" stroke="#ffe27c" strokeWidth="2" />
    </svg>
  );
}

function Envelope() {
  return (
    <svg viewBox="0 0 120 120" className="size-[82%] drop-shadow-[0_8px_7px_rgba(0,0,0,.5)]" aria-hidden="true">
      <defs>
        <linearGradient id="envRed" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#ff5e3e" />
          <stop offset=".5" stopColor="#d71918" />
          <stop offset="1" stopColor="#7a0508" />
        </linearGradient>
      </defs>
      <path d="M22 23h76l-5 77H27Z" fill="url(#envRed)" stroke="#ffd25c" strokeWidth="5" />
      <path d="M23 27 60 57 98 27" fill="none" stroke="#ffdf72" strokeWidth="4" />
      <circle cx="60" cy="63" r="20" fill="#bf1111" stroke="#ffd25c" strokeWidth="4" />
      <path d="M49 53h22M49 62h22M53 48v31M67 48v31" stroke="#ffe06d" strokeWidth="4" strokeLinecap="round" />
      <path d="M30 35q7 5 12 0M78 35q6 5 12 0M34 87q7-5 12 0M76 87q7-5 12 0" fill="none" stroke="#ffcd4f" strokeWidth="3" />
    </svg>
  );
}

function Ingot() {
  return (
    <svg viewBox="0 0 120 120" className="size-[86%] drop-shadow-[0_8px_7px_rgba(0,0,0,.45)]" aria-hidden="true">
      <defs>
        <linearGradient id="ingot" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#fff4a6" />
          <stop offset=".25" stopColor="#ffd343" />
          <stop offset=".58" stopColor="#e28a09" />
          <stop offset="1" stopColor="#8b3b00" />
        </linearGradient>
      </defs>
      <path d="M16 65q10-24 29-30 15-5 30 0 19 6 29 30l-10 29H26Z" fill="url(#ingot)" stroke="#fff0a0" strokeWidth="5" />
      <ellipse cx="60" cy="56" rx="27" ry="16" fill="#f8bf2b" stroke="#fff4b0" strokeWidth="4" />
      <ellipse cx="60" cy="56" rx="14" ry="8" fill="#ffe974" opacity=".9" />
    </svg>
  );
}

function Orange() {
  return (
    <svg viewBox="0 0 120 120" className="size-[83%] drop-shadow-[0_8px_7px_rgba(0,0,0,.45)]" aria-hidden="true">
      <defs>
        <radialGradient id="orangeFruit" cx="42%" cy="35%" r="65%">
          <stop stopColor="#ffd66b" />
          <stop offset=".45" stopColor="#ff971f" />
          <stop offset="1" stopColor="#c94b05" />
        </radialGradient>
      </defs>
      <circle cx="58" cy="69" r="34" fill="url(#orangeFruit)" stroke="#ffcb4a" strokeWidth="4" />
      <path d="M58 36q10-19 31-16-2 18-25 22" fill="#3bad4d" stroke="#155c26" strokeWidth="4" strokeLinejoin="round" />
      <path d="M59 40q-4-15 1-24" fill="none" stroke="#72510f" strokeWidth="5" strokeLinecap="round" />
      <circle cx="46" cy="56" r="8" fill="#fff0aa" opacity=".38" />
    </svg>
  );
}

function FortuneBag() {
  return (
    <svg viewBox="0 0 120 120" className="size-[84%] drop-shadow-[0_8px_7px_rgba(0,0,0,.5)]" aria-hidden="true">
      <defs>
        <linearGradient id="bagGold" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fff39b" />
          <stop offset=".4" stopColor="#ffc530" />
          <stop offset="1" stopColor="#b85b08" />
        </linearGradient>
      </defs>
      <path d="M39 31q21-12 42 0l-8 13q19 11 18 35-1 25-31 28Q30 104 29 79q-1-24 18-35Z" fill="url(#bagGold)" stroke="#7d2c05" strokeWidth="5" />
      <path d="M38 42q22 9 44 0" fill="none" stroke="#d51b1b" strokeWidth="8" strokeLinecap="round" />
      <circle cx="60" cy="72" r="18" fill="#d21b18" stroke="#ffe06d" strokeWidth="4" />
      <path d="M51 62h18M51 71h18M55 57v30M65 57v30" stroke="#ffe06d" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function Firecracker() {
  return (
    <svg viewBox="0 0 120 120" className="size-[86%] drop-shadow-[0_8px_7px_rgba(0,0,0,.5)]" aria-hidden="true">
      <g transform="rotate(-12 60 60)">
        <rect x="28" y="38" width="25" height="62" rx="6" fill="#1f8a48" stroke="#ffe05c" strokeWidth="4" />
        <rect x="67" y="28" width="25" height="62" rx="6" fill="#269b54" stroke="#ffe05c" strokeWidth="4" />
        <path d="M40 38q18-24 39-10" fill="none" stroke="#db1d1d" strokeWidth="6" strokeLinecap="round" />
        <path d="M34 55h13M34 70h13M73 45h13M73 60h13" stroke="#ffc72d" strokeWidth="4" />
        <path d="M40 99q-8 8-13 15M80 89q6 12 2 24" fill="none" stroke="#db1d1d" strokeWidth="5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function JadeKnot() {
  return (
    <svg viewBox="0 0 120 120" className="size-[82%] drop-shadow-[0_8px_7px_rgba(0,0,0,.45)]" aria-hidden="true">
      <defs>
        <linearGradient id="jade" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#b6ffd0" />
          <stop offset=".45" stopColor="#31d67a" />
          <stop offset="1" stopColor="#057241" />
        </linearGradient>
      </defs>
      <path d="M60 19c14 0 18 11 13 21 13-4 22 6 18 19 12 5 12 19 1 25-2 13-15 17-25 10-9 12-24 8-27-4-14 2-22-10-16-22-10-8-4-22 8-24-1-14 13-22 24-14 1-7 3-11 4-11Z" fill="url(#jade)" stroke="#d9ffdf" strokeWidth="4" />
      <circle cx="60" cy="58" r="18" fill="#0a8e54" stroke="#a9ffd1" strokeWidth="4" />
      <path d="M60 78v25M53 101l7 12 7-12" fill="none" stroke="#d51b1b" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function Lantern() {
  return (
    <svg viewBox="0 0 120 120" className="size-[82%] drop-shadow-[0_8px_7px_rgba(0,0,0,.5)]" aria-hidden="true">
      <defs>
        <radialGradient id="lanternRed" cx="50%" cy="34%" r="66%">
          <stop stopColor="#ff7a62" />
          <stop offset=".48" stopColor="#d7191c" />
          <stop offset="1" stopColor="#7b0309" />
        </radialGradient>
      </defs>
      <path d="M39 28h42M34 39h52M39 91h42" stroke="#ffd956" strokeWidth="6" strokeLinecap="round" />
      <path d="M38 39q22-15 44 0 12 23 0 52-22 15-44 0-12-29 0-52Z" fill="url(#lanternRed)" stroke="#ffdd68" strokeWidth="4" />
      <path d="M50 43q-8 23 0 44M70 43q8 23 0 44" fill="none" stroke="#ffb333" strokeWidth="3" />
      <path d="M60 91v22M50 108h20" stroke="#d51b1b" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function Lion() {
  return (
    <svg viewBox="0 0 120 120" className="size-[88%] drop-shadow-[0_8px_7px_rgba(0,0,0,.5)]" aria-hidden="true">
      <path d="M18 58q0-34 42-39 42 5 42 39 0 37-42 47Q18 95 18 58Z" fill="#f4f0dc" stroke="#7d216b" strokeWidth="6" />
      <path d="M21 45q15-25 39-26 24 1 39 26l-15 7-9-13-15 8-15-8-9 13Z" fill="#b52a9d" stroke="#ffe065" strokeWidth="4" />
      <circle cx="42" cy="63" r="10" fill="#28c6df" stroke="#4b1765" strokeWidth="4" />
      <circle cx="78" cy="63" r="10" fill="#28c6df" stroke="#4b1765" strokeWidth="4" />
      <circle cx="42" cy="63" r="4" fill="#130d21" />
      <circle cx="78" cy="63" r="4" fill="#130d21" />
      <path d="M48 78q12-9 24 0-3 16-12 16t-12-16Z" fill="#e83a3a" stroke="#7a1726" strokeWidth="4" />
      <path d="M34 88q26 17 52 0" fill="none" stroke="#7d216b" strokeWidth="5" strokeLinecap="round" />
      <circle cx="60" cy="28" r="7" fill="#ffdb4d" stroke="#a25500" strokeWidth="3" />
    </svg>
  );
}

export function GoldenTigerSymbol({ id }: { id: GoldenTigerSymbolId }) {
  if (id === "wild") {
    return shell(
      <div className="relative flex size-full items-center justify-center">
        <TigerFace />
        <span className="absolute bottom-[4%] rounded-md bg-[#b41210]/90 px-2 py-0.5 font-serif text-[clamp(.55rem,2.8vw,.85rem)] font-black tracking-wide text-yellow-200 shadow-[0_2px_0_#5f0808]">WILD</span>
      </div>,
      "rgba(255,205,50,.65)",
      "radial-gradient(circle at 50% 28%,#ffe680,#ed8d16 45%,#8a1707 78%,#3e0203)",
    );
  }
  if (id === "scatter") return shell(<Envelope />, "rgba(255,66,66,.75)", "radial-gradient(circle at 50% 30%,#ff7755,#c81317 56%,#5b0207)");
  if (id === "ingot") return shell(<Ingot />, "rgba(255,210,65,.58)", "radial-gradient(circle at 50% 28%,#ffe886,#bf5d09 60%,#4a1000)");
  if (id === "orange") return shell(<Orange />, "rgba(255,142,35,.5)", "radial-gradient(circle at 50% 30%,#ffcb56,#a92e08 66%,#3c0500)");
  if (id === "fortuneBag") return shell(<FortuneBag />, "rgba(255,180,35,.55)", "radial-gradient(circle at 50% 30%,#ffdf6d,#b2280e 64%,#4a0503)");
  if (id === "firecracker") return shell(<Firecracker />, "rgba(55,218,113,.45)", "radial-gradient(circle at 50% 30%,#4fd087,#74320a 64%,#2b0903)");
  if (id === "jadeKnot") return shell(<JadeKnot />, "rgba(61,244,151,.5)", "radial-gradient(circle at 50% 30%,#78f3ad,#156339 62%,#062219)");
  if (id === "lantern") return shell(<Lantern />, "rgba(255,62,45,.52)", "radial-gradient(circle at 50% 30%,#ff7458,#9d0f19 62%,#3a0205)");
  return shell(<Lion />, "rgba(214,78,255,.5)", "radial-gradient(circle at 50% 30%,#f07fff,#651784 60%,#23022f)");
}
