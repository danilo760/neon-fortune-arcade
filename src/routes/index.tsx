import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Clock3,
  Crown,
  Gamepad2,
  Heart,
  History,
  Home,
  Search,
  Sparkles,
  Trophy,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { BalanceDisplay } from "@/components/arcade/BalanceDisplay";
import { FictionalNotice } from "@/components/arcade/FictionalNotice";
import { GameArtwork, TigerCubMascot } from "@/components/arcade/GameArtwork";
import { GameCard } from "@/components/arcade/GameCard";
import { SoundToggle } from "@/components/arcade/SoundToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORY_LABELS, GAMES, type GameCategory } from "@/lib/arcade/catalog";
import { formatCoins, formatMultiplier, formatTime } from "@/lib/arcade/format";
import { arcadeActions, hydrateFromStorage, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Index });

type Filter = "featured" | "all" | "favorites" | GameCategory;

function Index() {
  const [filter, setFilter] = useState<Filter>("featured");
  const [search, setSearch] = useState("");
  const favorites = useArcade((state) => state.favorites);
  const history = useArcade((state) => state.history);
  const totalSpins = useArcade((state) => state.totalSpins);
  const bestWin = useArcade((state) => state.bestWin);

  useEffect(() => hydrateFromStorage(), []);

  const visibleGames = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return GAMES.filter((game) => {
      const matchesSearch = !query || `${game.name} ${game.tagline}`.toLocaleLowerCase("pt-BR").includes(query);
      const matchesFilter =
        filter === "all" ||
        (filter === "featured" && game.featured) ||
        (filter === "favorites" && favorites.includes(game.slug)) ||
        game.category === filter;
      return matchesSearch && matchesFilter;
    });
  }, [favorites, filter, search]);

  const filters: { id: Filter; label: string }[] = [
    { id: "featured", label: "Destaques" },
    { id: "all", label: "Todos" },
    { id: "slots", label: CATEGORY_LABELS.slots },
    { id: "arcade", label: CATEGORY_LABELS.arcade },
    { id: "mesa", label: CATEGORY_LABELS.mesa },
    { id: "favorites", label: "Favoritos" },
  ];

  const goldenTiger = GAMES[0];

  return (
    <div id="top" className="arcade-lobby min-h-screen pb-24 lg:pb-10">
      <header className="arcade-header sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2.5 sm:px-6">
          <Link to="/" className="flex min-w-0 flex-1 items-center gap-2.5" aria-label="Neon Fortune Arcade, início">
            <span className="arcade-logo-mark" aria-hidden><Crown className="size-5" /></span>
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-black tracking-wide text-gold-gradient sm:text-xl">NEON FORTUNE</p>
              <p className="-mt-0.5 hidden text-[0.58rem] font-bold uppercase tracking-[0.32em] text-amber-100/55 sm:block">Private Arcade</p>
            </div>
          </Link>
          <SoundToggle />
          <BalanceDisplay compact className="max-w-[13rem]" />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-6">
        <FictionalNotice className="mb-3 sm:hidden" />

        <section className="fortune-hero" aria-labelledby="hero-title">
          <div className="fortune-hero__lantern fortune-hero__lantern--left" aria-hidden />
          <div className="fortune-hero__lantern fortune-hero__lantern--right" aria-hidden />
          <div className="fortune-hero__copy">
            <span className="fortune-kicker"><Sparkles className="size-3.5" /> 5 jogos disponíveis</span>
            <p className="fortune-hero__eyebrow">PRIVATE ARCADE</p>
            <h1 id="hero-title" className="fortune-hero__title">GOLDEN <span>TIGER</span></h1>
            <p className="fortune-hero__subtitle">Um salão privado com slots e arcades originais, efeitos premium e apenas moedas fictícias.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="lg" variant="gold" className="fortune-play min-h-12 rounded-xl px-6 font-black">
                <Link to="/game/$slug" params={{ slug: "golden-tiger" }}>
                  <Gamepad2 className="size-5" aria-hidden /> JOGAR AGORA
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="min-h-12 rounded-xl border-amber-300/25 bg-black/25 text-amber-50 hover:bg-white/10"
                onClick={() => document.querySelector("#catalogo")?.scrollIntoView({ behavior: "smooth" })}
              >
                Ver jogos
              </Button>
            </div>
          </div>
          <div className="fortune-hero__mascot" aria-hidden>
            <div className="fortune-hero__coin-cloud" />
            <TigerCubMascot className="w-full" />
          </div>
        </section>

        <section className="jackpot-strip" aria-label="Jackpots fictícios decorativos">
          <div className="jackpot-strip__grand"><small>GRAND JACKPOT</small><strong>1.250.000</strong></div>
          <div><small>MAJOR</small><strong>125.000</strong></div>
          <div><small>MINOR</small><strong>25.000</strong></div>
          <div><small>MINI</small><strong>5.000</strong></div>
        </section>

        <section id="catalogo" className="scroll-mt-24 pt-6" aria-labelledby="catalog-title">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300/75">Seu salão privado</p>
              <h2 id="catalog-title" className="font-display text-2xl font-black text-white sm:text-3xl">Escolha seu jogo</h2>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-amber-100/50" aria-hidden />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar jogo..."
                className="h-11 rounded-xl border-amber-300/15 bg-black/35 pl-9 text-white placeholder:text-white/35"
                aria-label="Buscar jogo"
              />
            </div>
          </div>

          <div className="scroll-hide mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Categorias de jogos">
            {filters.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant={filter === item.id ? "gold" : "outline"}
                className="min-h-10 shrink-0 rounded-full border-amber-300/15 bg-black/30 px-4"
                role="tab"
                aria-selected={filter === item.id}
                onClick={() => setFilter(item.id)}
              >
                {item.id === "favorites" && <Heart className="size-4" aria-hidden />}
                {item.label}
              </Button>
            ))}
          </div>

          {filter === "featured" && !search && (
            <div className="featured-showcase mb-4">
              <div className="featured-showcase__art"><GameArtwork game={goldenTiger} /></div>
              <div className="featured-showcase__copy">
                <span>HOT • SLOT 3×3</span>
                <h3>Golden Tiger</h3>
                <p>Tigre filhote, ouro, jade, giros grátis e multiplicadores em uma máquina feita para parecer um jogo completo.</p>
                <Button asChild variant="gold" className="rounded-xl font-black"><Link to="/game/$slug" params={{ slug: goldenTiger.slug }}>Abrir jogo</Link></Button>
              </div>
            </div>
          )}

          {visibleGames.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {visibleGames.map((game) => <GameCard key={game.slug} game={game} />)}
            </div>
          ) : (
            <div className="rounded-3xl surface-panel p-8 text-center">
              <Heart className="mx-auto size-9 text-muted-foreground" aria-hidden />
              <h3 className="mt-3 font-display text-lg font-bold">Nenhum jogo encontrado</h3>
              <p className="mt-1 text-sm text-muted-foreground">Tente outra busca ou favorite um jogo no catálogo.</p>
              <Button className="mt-4" variant="gold" onClick={() => { setSearch(""); setFilter("all"); }}>Mostrar todos</Button>
            </div>
          )}
        </section>

        <section id="historico" className="scroll-mt-24 pt-9" aria-labelledby="history-title">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/75">Somente neste navegador</p>
              <h2 id="history-title" className="font-display text-2xl font-black">Últimas partidas</h2>
            </div>
            {history.length > 0 && <Button size="sm" variant="ghost" onClick={() => arcadeActions.clearHistory()}>Limpar</Button>}
          </div>
          <div className="overflow-hidden rounded-3xl surface-panel">
            {history.length === 0 ? (
              <div className="p-8 text-center">
                <History className="mx-auto size-9 text-muted-foreground" aria-hidden />
                <p className="mt-3 font-semibold">Seu histórico aparecerá aqui</p>
                <p className="text-sm text-muted-foreground">Faça uma jogada fictícia para começar.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {history.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{entry.gameName}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="size-3" aria-hidden /> {formatTime(entry.at)} · aposta {formatCoins(entry.bet)}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn("font-display font-bold tabular-nums", entry.payout > 0 ? "text-jade" : "text-muted-foreground")}>{entry.payout > 0 ? "+" : ""}{formatCoins(entry.payout)}</p>
                      <p className="text-xs text-muted-foreground">{formatMultiplier(entry.multiplier)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section id="perfil" className="scroll-mt-24 pt-9" aria-labelledby="profile-title">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/75">Progresso local</p>
            <h2 id="profile-title" className="font-display text-2xl font-black">Meu perfil arcade</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard icon={<Gamepad2 />} label="Partidas" value={formatCoins(totalSpins)} />
            <StatCard icon={<Trophy />} label="Melhor ganho" value={formatCoins(bestWin)} />
            <StatCard icon={<Heart />} label="Favoritos" value={formatCoins(favorites.length)} />
          </div>
          <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-border/70 bg-ink/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-semibold">Dados salvos neste navegador</p><p className="text-sm text-muted-foreground">O Supabase fica preparado para login e sincronização futura.</p></div>
            <Button variant="outline" onClick={() => { if (window.confirm("Zerar saldo, favoritos e histórico local?")) arcadeActions.resetAll(); }}>Zerar progresso</Button>
          </div>
        </section>
      </main>

      <nav className="arcade-bottom-nav fixed inset-x-3 bottom-3 z-50 grid grid-cols-5 p-1.5 lg:hidden" aria-label="Navegação principal">
        <NavItem icon={<Home />} label="Início" href="#top" />
        <NavItem icon={<Gamepad2 />} label="Jogos" href="#catalogo" />
        <button type="button" className="arcade-nav-item" onClick={() => { setFilter("favorites"); document.querySelector("#catalogo")?.scrollIntoView({ behavior: "smooth" }); }}><Heart className="size-5" aria-hidden />Favoritos</button>
        <NavItem icon={<History />} label="Histórico" href="#historico" />
        <NavItem icon={<UserRound />} label="Perfil" href="#perfil" />
      </nav>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-2xl surface-panel p-4"><span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary [&>svg]:size-5">{icon}</span><div><p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p><p className="font-display text-xl font-black text-foreground">{value}</p></div></div>;
}

function NavItem({ icon, label, href }: { icon: ReactNode; label: string; href: string }) {
  return <a href={href} className="arcade-nav-item">{icon}{label}</a>;
}
