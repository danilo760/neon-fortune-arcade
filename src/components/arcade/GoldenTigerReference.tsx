import { Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronDown, Info, Minus, Plus, RotateCw, Square, Volume2, VolumeX, Zap, Repeat2 } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AnimatedWinCounter } from "./AnimatedWinCounter";
import { formatCoins } from "@/lib/arcade/format";
import { GOLDEN_TIGER_PAYLINES, goldenTigerWinTier, planGoldenTigerRound, type GoldenTigerRoundPlan, type GoldenTigerSymbolId } from "@/lib/arcade/goldenTigerMath";
import { playSound, type SoundName } from "@/lib/arcade/sound";
import { arcadeActions, hydrateFromStorage, useArcade } from "@/lib/arcade/store";
import "./GoldenTigerReference.css";

const BETS = [10, 50, 100, 200, 500, 1_000, 5_000, 10_000] as const;
const SYMBOLS: GoldenTigerSymbolId[] = ["ingot", "orange", "fortuneBag", "jade", "wild", "firecracker", "lantern", "lion", "scatter"];
const LABELS: Record<GoldenTigerSymbolId, string> = { ingot: "Lingote de ouro", orange: "Mandarinas", fortuneBag: "Bolsa da fortuna", jade: "Talismã de jade", wild: "Tigre Wild", firecracker: "Fogos da sorte", lantern: "Lanterna", lion: "Leão dourado", scatter: "Envelope" };
const INITIAL_GRID: GoldenTigerSymbolId[] = ["ingot", "orange", "fortuneBag", "jade", "wild", "firecracker", "lantern", "lion", "orange"];
const STRIP = [...SYMBOLS, ...SYMBOLS];
type Phase = "idle" | "spinning" | "respin" | "landing" | "win";
type PendingRound = { plan: GoldenTigerRoundPlan; bet: number };

const SymbolArt = memo(function SymbolArt({ symbol }: { symbol: GoldenTigerSymbolId }) {
  const index = SYMBOLS.indexOf(symbol);
  return <span className="tiger-symbol" role="img" aria-label={LABELS[symbol]} style={{ backgroundPosition: `${(index % 3) * 50}% ${Math.floor(index / 3) * 50}%` }}>
    {symbol === "wild" && <b className="tiger-wild">WILD</b>}
  </span>;
});

function hasReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function GoldenTigerReference() {
  const balance = useArcade(state => state.balance);
  const soundEnabled = useArcade(state => state.soundEnabled);
  const [bet, setBet] = useState<number>(200);
  const [grid, setGrid] = useState(INITIAL_GRID);
  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState(false);
  const [stopped, setStopped] = useState(3);
  const [landing, setLanding] = useState(-1);
  const [locked, setLocked] = useState<Set<number>>(new Set());
  const [winning, setWinning] = useState<Set<number>>(new Set());
  const [win, setWin] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fullGrid, setFullGrid] = useState(false);
  const [respins, setRespins] = useState(0);
  const [turbo, setTurbo] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const [autoRounds, setAutoRounds] = useState(10);
  const [modal, setModal] = useState<"rules" | "auto" | "bet" | null>(null);
  const [assetReady, setAssetReady] = useState(false);
  const [assetError, setAssetError] = useState(false);
  const [assetAttempt, setAssetAttempt] = useState(0);
  const [message, setMessage] = useState("");
  const [reducedMotion, setReducedMotion] = useState(false);
  const busyRef = useRef(false);
  const autoRef = useRef(false);
  const stopRef = useRef(false);
  const soundRef = useRef(soundEnabled);
  const pendingRef = useRef<PendingRound | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  soundRef.current = soundEnabled;

  const settle = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    const { result, respins: steps } = pending.plan;
    if (result.payout > 0) arcadeActions.credit(result.payout);
    arcadeActions.recordRound({ slug: "golden-tiger", gameName: "Golden Tiger", bet: pending.bet,
      payout: result.payout, multiplier: result.payout / pending.bet,
      note: `${steps.length ? `${steps.length} RESPINS · ` : ""}${result.lines} linha(s)${result.isFullGrid ? " · GRADE CHEIA ×10" : ""}` });
  }, []);

  useEffect(() => {
    hydrateFromStorage();
    const controller = new AbortController();
    abortRef.current = controller;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => { stopRef.current = true; controller.abort(); settle(); media.removeEventListener("change", sync); };
  }, [settle]);

  useEffect(() => {
    let active = true;
    setAssetError(false);
    setAssetReady(false);
    const images = ["/images/golden-tiger/garden.webp", "/images/golden-tiger/symbols.webp"].map(src => {
      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("asset"));
        img.src = src;
      });
    });
    void Promise.all(images).then(() => { if (active) setAssetReady(true); }).catch(() => { if (active) setAssetError(true); });
    return () => { active = false; };
  }, [assetAttempt]);

  const pause = useCallback((ms: number) => new Promise<void>((resolve, reject) => {
    const signal = abortRef.current?.signal;
    if (signal?.aborted) { reject(new DOMException("Cancelled", "AbortError")); return; }
    const timer = window.setTimeout(() => { signal?.removeEventListener("abort", cancel); resolve(); }, hasReducedMotion() ? 0 : ms);
    function cancel() { window.clearTimeout(timer); signal?.removeEventListener("abort", cancel); reject(new DOMException("Cancelled", "AbortError")); }
    signal?.addEventListener("abort", cancel, { once: true });
  }), []);
  const sound = useCallback((name: SoundName) => playSound(name, soundRef.current), []);

  const spin = useCallback(async (automatic = false): Promise<boolean> => {
    if (busyRef.current || (!automatic && autoRef.current) || modal || !assetReady || abortRef.current?.signal.aborted) return false;
    busyRef.current = true;
    try {
      // Plan first: animation and sound cannot change the result already chosen.
      const plan = planGoldenTigerRound(bet);
      if (!arcadeActions.placeBet(bet)) { setMessage("Saldo insuficiente. Recarregue moedas grátis no lobby."); sound("tigerMiss"); return false; }
      pendingRef.current = { plan, bet };
      setBusy(true); setMessage(""); setPhase("spinning"); setStopped(0); setLanding(-1);
      setLocked(new Set()); setWinning(new Set()); setWin(0); setDuration(0); setFullGrid(false); setRespins(0);
      sound("tigerSpin");
      await pause(turbo ? 140 : 440);
      for (let column = 0; column < 3; column++) {
        setGrid(current => current.map((symbol, index) => index % 3 === column ? plan.initialGrid[index]! : symbol));
        setStopped(column + 1); setLanding(column); sound("tigerReelStop");
        await pause(turbo ? 65 : 165);
      }
      setLanding(-1);
      if (plan.initialRespin) {
        setLocked(new Set(plan.initialRespin.locked)); setRespins(plan.initialRespin.spinsLeft); setPhase("respin");
        sound("tigerRespin"); await pause(turbo ? 230 : 680);
        for (const step of plan.respins) {
          setPhase("spinning"); setStopped(0); sound("tigerSpin"); await pause(turbo ? 140 : 380);
          setGrid(step.grid); setStopped(3); setPhase("landing");
          setLocked(new Set(step.state.locked)); setRespins(step.state.spinsLeft);
          sound(step.addedLocks > 0 ? "tigerLock" : "tigerReelStop"); await pause(turbo ? 170 : 460);
        }
      }
      settle();
      const { result } = plan;
      setRespins(0); setWinning(new Set(result.winning)); setFullGrid(result.isFullGrid && result.payout > 0);
      const tier = goldenTigerWinTier(result.payout, bet);
      const countDuration = hasReducedMotion() || turbo ? 0 : tier === "mega" || tier === "big" ? 1100 : 460;
      setDuration(countDuration); setWin(result.payout); setPhase(result.payout > 0 ? "win" : "idle");
      sound(result.isFullGrid && result.payout > 0 ? "tigerFullGrid" : tier === "big" || tier === "mega" ? "bigWin" : result.payout > 0 ? "win" : "tigerMiss");
      await pause(result.payout > 0 ? countDuration + (tier === "big" || tier === "mega" ? 550 : 200) : 100);
      return true;
    } catch (error) {
      settle();
      if (!abortRef.current?.signal.aborted) setMessage("A apresentação foi interrompida. O resultado foi registrado.");
      return false;
    } finally {
      busyRef.current = false;
      if (!abortRef.current?.signal.aborted) { setBusy(false); setStopped(3); setLanding(-1); setRespins(0); }
    }
  }, [assetReady, bet, modal, pause, settle, sound, turbo]);

  const startAuto = useCallback(async () => {
    if (autoRef.current || busyRef.current) return;
    autoRef.current = true; stopRef.current = false;
    try {
      for (let left = autoRounds; left > 0; left--) {
        if (stopRef.current || abortRef.current?.signal.aborted) break;
        setAutoLeft(left);
        if (!await spin(true)) break;
        await pause(turbo ? 100 : 260);
      }
    } catch { /* Leaving the game stops future automatic bets. */ }
    finally { autoRef.current = false; if (!abortRef.current?.signal.aborted) setAutoLeft(0); }
  }, [autoRounds, pause, spin, turbo]);

  // Start only after the modal has closed, so spin never captures a stale open dialog.
  const queuedAuto = useRef(false);
  useEffect(() => {
    if (!modal && queuedAuto.current) { queuedAuto.current = false; void startAuto(); }
  }, [modal, startAuto]);

  const configurationLocked = busy || autoLeft > 0;
  const insufficient = bet > balance;
  const changeBet = (direction: -1 | 1) => {
    if (busyRef.current || autoRef.current) return;
    const index = BETS.findIndex(value => value === bet);
    setBet(BETS[Math.max(0, Math.min(BETS.length - 1, index + direction))]!); sound("click");
  };
  const tier = goldenTigerWinTier(win, bet);
  const bigWin = phase === "win" && (tier === "big" || tier === "mega");
  const lineWins = phase === "win" ? GOLDEN_TIGER_PAYLINES.filter(line => {
    const target = line.map(index => grid[index]).find(symbol => symbol !== "wild") ?? "wild";
    return target !== "scatter" && line.every(index => grid[index] === target || grid[index] === "wild");
  }) : [];
  const status = message || (respins > 0 ? `${locked.size}/9 símbolos travados · ${respins} respins` : fullGrid ? "GRADE COMPLETA · GANHO ×10" : phase === "spinning" ? "A sorte está girando" : win > 0 ? `${lineWins.length} ${lineWins.length === 1 ? "linha premiada" : "linhas premiadas"}` : "5 linhas · Respins da sorte · ×10");

  return (
    <main className="tiger-page">
      <section className="tiger-cabinet" aria-label="Golden Tiger" data-phase={phase} data-full-grid={fullGrid || undefined}>
        <header className="tiger-hero">
          <nav className="tiger-topbar" aria-label="Navegação do jogo">
            <Link to="/" className="tiger-icon-button" aria-label="Voltar ao lobby"><ArrowLeft size={20} /></Link>
            <span>NEON FORTUNE</span>
            <button type="button" className="tiger-icon-button" onClick={() => arcadeActions.toggleSound()} aria-label={soundEnabled ? "Desativar som" : "Ativar som"} aria-pressed={soundEnabled}>{soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}</button>
          </nav>
          <div className="tiger-title"><span>GOLDEN</span><h1>TIGER</h1></div>
          <div className="tiger-feature-seal"><strong>×10</strong><span>GRADE CHEIA</span></div>
        </header>

        <div className="tiger-reel-frame">
          <div className="tiger-frame-heading"><span /> <b>RESPINS DA SORTE</b> <span /></div>
          <div className="tiger-reels" role="group" aria-label="Grade de três linhas e três colunas" aria-busy={busy}>
            {grid.map((symbol, index) => {
              const column = index % 3;
              const moving = column >= stopped && !locked.has(index);
              return <div key={index} className={`tiger-cell${locked.has(index) ? " is-locked" : ""}${winning.has(index) ? " is-winning" : ""}${winning.size > 0 && !winning.has(index) ? " is-dim" : ""}${landing === column ? " is-landing" : ""}`}>
                <SymbolArt symbol={symbol} />
                {locked.has(index) && <span className="tiger-lock-label">TRAVADO</span>}
                {moving && !reducedMotion && <div className="tiger-drum" aria-hidden><div className="tiger-drum-track" style={{ "--reel-time": turbo ? "190ms" : "370ms", "--reel-offset": `${-column * 60}ms` } as CSSProperties}>{STRIP.map((id, i) => <div key={i}><SymbolArt symbol={id} /></div>)}</div></div>}
              </div>;
            })}
            {lineWins.length > 0 && <svg className="tiger-paylines" viewBox="0 0 300 300" preserveAspectRatio="none" aria-hidden>{lineWins.map((line, i) => <polyline key={i} points={line.map(index => `${(index % 3) * 100 + 50},${Math.floor(index / 3) * 100 + 50}`).join(" ")} />)}</svg>}
          </div>
          <div className="tiger-status" role="status">{status}</div>
        </div>

        <div className={`tiger-win-meter${bigWin ? " is-big" : ""}`} aria-live="polite" aria-atomic="true">
          <span>{fullGrid ? "FORTUNA COMPLETA" : bigWin ? (tier === "mega" ? "MEGA WIN" : "BIG WIN") : "ÚLTIMO GANHO"}</span>
          <strong><AnimatedWinCounter value={win} duration={duration} /></strong>
          {fullGrid && <b className="tiger-win-factor">×10</b>}
        </div>
        <div className="tiger-wallet-row">
          <div className="tiger-wallet"><span>SALDO</span><strong>{formatCoins(balance)}</strong></div>
          <div className="tiger-bet"><button type="button" onClick={() => changeBet(-1)} disabled={configurationLocked || bet === BETS[0]} aria-label="Diminuir aposta"><Minus size={17} /></button><button type="button" className="tiger-bet-value" disabled={configurationLocked} onClick={() => setModal("bet")} aria-label={`Selecionar aposta, atual ${formatCoins(bet)}`}><span>APOSTA <ChevronDown size={10} /></span><strong>{formatCoins(bet)}</strong></button><button type="button" onClick={() => changeBet(1)} disabled={configurationLocked || bet === BETS[BETS.length - 1]} aria-label="Aumentar aposta"><Plus size={17} /></button></div>
        </div>
        <div className="tiger-controls">
          <button type="button" className={`tiger-side-control${turbo ? " is-active" : ""}`} disabled={configurationLocked} aria-label="Alternar turbo" aria-pressed={turbo} onClick={() => { setTurbo(!turbo); sound("click"); }}><Zap size={22} /><span>TURBO</span></button>
          <button type="button" className="tiger-spin" disabled={configurationLocked || insufficient || !assetReady || !!modal} onClick={() => void spin()} aria-label="Girar Golden Tiger" aria-busy={busy}><RotateCw size={48} strokeWidth={2.8} /><span>GIRAR</span></button>
          <button type="button" className={`tiger-side-control${autoLeft > 0 ? " is-active" : ""}`} disabled={autoLeft === 0 && (busy || insufficient || !assetReady)} aria-label={autoLeft > 0 ? "Parar auto play" : "Configurar auto play"} onClick={() => { if (autoLeft > 0) { stopRef.current = true; setMessage("Auto play encerrará após esta rodada."); } else setModal("auto"); }}>{autoLeft > 0 ? <Square size={22} fill="currentColor" /> : <Repeat2 size={25} />}<span>{autoLeft > 0 ? `PARAR · ${autoLeft}` : "AUTO"}</span></button>
        </div>
        <footer className="tiger-footer"><button type="button" onClick={() => setModal("rules")} aria-label="Regras do Golden Tiger"><Info size={18} /></button><span>MOEDAS FICTÍCIAS · SEM VALOR REAL</span><button type="button" disabled={configurationLocked} onClick={() => { const value = [...BETS].reverse().find(amount => amount <= balance); if (value !== undefined) setBet(value); }} aria-label="Aposta máxima">MAX</button></footer>
        {insufficient && !busy && <p className="tiger-error">Saldo insuficiente. <Link to="/">Recarregue no lobby</Link></p>}
        {!assetReady && <div className="tiger-loading" role="status"><strong>GOLDEN TIGER</strong><span>{assetError ? "Não foi possível carregar a arte." : "Preparando sua máquina…"}</span>{assetError && <button type="button" onClick={() => setAssetAttempt(attempt => attempt + 1)}>Tentar novamente</button>}<Link to="/">Voltar ao lobby</Link></div>}
      </section>
      <Dialog open={modal !== null} onOpenChange={open => { if (!open) setModal(null); }}>
        <DialogContent className="tiger-dialog">
          <DialogTitle>{modal === "rules" ? "Como jogar" : modal === "auto" ? "Auto play" : "Sua aposta"}</DialogTitle>
          <DialogDescription>{modal === "rules" ? "Golden Tiger · 3×3 · 5 linhas" : modal === "auto" ? "Escolha quantas rodadas deseja jogar. Você pode parar após a rodada em andamento." : "Valores em moedas fictícias por rodada."}</DialogDescription>
          {modal === "rules" && <div className="tiger-rules"><p>Combine 3 símbolos em uma das 3 linhas horizontais ou 2 diagonais. O tigre Wild substitui os símbolos comuns.</p><p><b>Respins da sorte:</b> o recurso pode ser ativado aleatoriamente. Um símbolo é escolhido; ele e os Wilds ficam travados. Você recebe 3 respins. Cada nova trava restaura os 3.</p><p><b>Grade completa ×10:</b> nove símbolos iguais, incluindo Wilds, multiplicam o ganho das linhas por dez. O pagamento usa apenas a grade final, uma vez por rodada.</p><p>Os envelopes não pagam e não ativam Free Spins. Este jogo usa apenas moedas fictícias.</p></div>}
          {modal === "auto" && <><div className="tiger-options">{[10, 25, 50, 100].map(rounds => <button type="button" key={rounds} aria-pressed={autoRounds === rounds} onClick={() => setAutoRounds(rounds)}>{rounds}</button>)}</div><p className="tiger-dialog-cost">{formatCoins(bet)} moedas por rodada</p><button type="button" className="tiger-dialog-primary" disabled={configurationLocked || insufficient} onClick={() => { queuedAuto.current = true; setModal(null); }}>INICIAR {autoRounds} RODADAS</button></>}
          {modal === "bet" && <div className="tiger-options tiger-options-bets">{BETS.map(value => <button type="button" key={value} aria-pressed={value === bet} disabled={value > balance || configurationLocked} onClick={() => { setBet(value); setModal(null); sound("click"); }}>{formatCoins(value)}</button>)}</div>}
        </DialogContent>
      </Dialog>
    </main>
  );
}
