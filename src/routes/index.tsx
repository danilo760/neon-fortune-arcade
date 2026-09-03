import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Clock3,
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
import { GameCard } from "@/components/arcade/GameCard";
import { SoundToggle } from "@/components/arcade/SoundToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORY_LABELS, GAMES, type GameCategory } from "@/lib/arcade/catalog";
import { formatCoins, formatMultiplier, formatTime } from "@/lib/arcade/format";
import { arcadeActions, hydrateFromStorage, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Index,
});

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
      const matchesSearch =
        !query || `${game.name} ${game.tagline}`.toLocaleLowerCase("pt-BR").includes(query);
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

  return (
    <div id="top" className="min-h-screen pb-24 lg:pb-10">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-3 sm:px-6">
          <Link
            to="/"
            className="flex min-w-0 flex-1 items-center gap-2"
            aria-label="Lucky Neon Arcade, início"
          >
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold text-xl shadow-lg"
              aria-hidden
            >
              ♛
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-black text-gold-gradient sm:text-lg">
                Lucky Neon Arcade
              </p>
              <p className="hidden text-[0.58rem] font-bold uppercase tracking-[0.2em] text-muted-foreground sm:block">
                Arcade privado single-player
              </p>
            </div>
          </Link>
          <SoundToggle />
          <BalanceDisplay compact className="max-w-[13rem]" />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
        <FictionalNotice className="mb-4 sm:hidden" />

        <section
          className="relative isolate overflow-hidden rounded-3xl border border-primary/25 bg-royal px-5 py-7 shadow-2xl sm:px-9 sm:py-10"
          aria-labelledby="hero-title"
        >
          <div
            className="pointer-events-none absolute -right-8 -top-12 text-[10rem] opacity-20 blur-[1px] motion-safe:animate-[float-slow_4s_ease-in-out_infinite] sm:right-8 sm:text-[13rem]"
            aria-hidden
          >
            🐅
          </div>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,oklch(0.88_0.15_88/0.24),transparent_34%)]" />
          <div className="relative max-w-2xl">
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-ink/45 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-primary">
              <Sparkles className="size-3.5" aria-hidden /> 5 jogos já disponíveis
            </span>
            <h1
              id="hero-title"
              className="mt-3 max-w-xl font-display text-3xl font-black leading-tight text-white sm:text-5xl"
            >
              Sua noite de sorte começa <span className="text-gold-gradient">agora</span>
            </h1>
            <p className="mt-3 max-w-lg text-sm text-white/75 sm:text-base">
              Slots, minas e Plinko originais para brincar sozinho. Sem depósitos, saques ou prêmios
              reais.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild size="lg" variant="gold" className="min-h-12 rounded-xl font-black">
                <Link to="/game/$slug" params={{ slug: "golden-tiger" }}>
                  <Gamepad2 className="size-5" aria-hidden /> Jogar Golden Tiger
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="min-h-12 rounded-xl border-white/25 bg-black/15 text-white hover:bg-white/10"
                onClick={() =>
                  document.querySelector("#catalogo")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Ver catálogo
              </Button>
            </div>
          </div>
        </section>

        <section id="catalogo" className="scroll-mt-24 pt-7" aria-labelledby="catalog-title">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/75">
                Escolha seu jogo
              </p>
              <h2
                id="catalog-title"
                className="font-display text-2xl font-black text-foreground sm:text-3xl"
              >
                Salão de jogos
              </h2>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar jogo..."
                className="h-11 rounded-xl border-border/80 bg-ink/70 pl-9"
                aria-label="Buscar jogo"
              />
            </div>
          </div>

          <div
            className="scroll-hide mb-4 flex gap-2 overflow-x-auto pb-1"
            role="tablist"
            aria-label="Categorias de jogos"
          >
            {filters.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant={filter === item.id ? "gold" : "outline"}
                className="min-h-10 shrink-0 rounded-full px-4"
                role="tab"
                aria-selected={filter === item.id}
                onClick={() => setFilter(item.id)}
              >
                {item.id === "favorites" && <Heart className="size-4" aria-hidden />}
                {item.label}
              </Button>
            ))}
          </div>

          {visibleGames.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {visibleGames.map((game) => (
                <GameCard key={game.slug} game={game} />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl surface-panel p-8 text-center">
              <Heart className="mx-auto size-9 text-muted-foreground" aria-hidden />
              <h3 className="mt-3 font-display text-lg font-bold">Nenhum jogo encontrado</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Tente outra busca ou favorite um jogo no catálogo.
              </p>
              <Button
                className="mt-4"
                variant="gold"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
              >
                Mostrar todos
              </Button>
            </div>
          )}
        </section>

        <section id="historico" className="scroll-mt-24 pt-9" aria-labelledby="history-title">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/75">
                Somente neste navegador
              </p>
              <h2 id="history-title" className="font-display text-2xl font-black">
                Últimas partidas
              </h2>
            </div>
            {history.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => arcadeActions.clearHistory()}>
                Limpar
              </Button>
            )}
          </div>
          <div className="overflow-hidden rounded-3xl surface-panel">
            {history.length === 0 ? (
              <div className="p-8 text-center">
                <History className="mx-auto size-9 text-muted-foreground" aria-hidden />
                <p className="mt-3 font-semibold">Seu histórico aparecerá aqui</p>
                <p className="text-sm text-muted-foreground">
                  Faça uma jogada fictícia para começar.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {history.slice(0, 8).map((entry) => (
                  <div
                    key={entry.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{entry.gameName}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock3 className="size-3" aria-hidden /> {formatTime(entry.at)} · aposta{" "}
                        {formatCoins(entry.bet)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          "font-display font-bold tabular-nums",
                          entry.payout > 0 ? "text-jade" : "text-muted-foreground",
                        )}
                      >
                        {entry.payout > 0 ? "+" : ""}
                        {formatCoins(entry.payout)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatMultiplier(entry.multiplier)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section id="perfil" className="scroll-mt-24 pt-9" aria-labelledby="profile-title">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/75">
              Progresso local
            </p>
            <h2 id="profile-title" className="font-display text-2xl font-black">
              Meu perfil arcade
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard icon={<Gamepad2 />} label="Partidas" value={formatCoins(totalSpins)} />
            <StatCard icon={<Trophy />} label="Melhor ganho" value={formatCoins(bestWin)} />
            <StatCard icon={<Heart />} label="Favoritos" value={formatCoins(favorites.length)} />
          </div>
          <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-border/70 bg-ink/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Dados salvos neste navegador</p>
              <p className="text-sm text-muted-foreground">
                O Supabase será usado depois para login e sincronização opcional entre dispositivos.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                if (window.confirm("Zerar saldo, favoritos e histórico local?")) {
                  arcadeActions.resetAll();
                }
              }}
            >
              Zerar progresso
            </Button>
          </div>
        </section>
      </main>

      <nav
        className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-5 rounded-2xl border border-border/80 bg-ink/95 p-1.5 shadow-2xl backdrop-blur-xl lg:hidden"
        aria-label="Navegação principal"
      >
        <NavItem icon={<Home />} label="Início" href="#top" />
        <NavItem icon={<Gamepad2 />} label="Jogos" href="#catalogo" />
        <button
          type="button"
          className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[0.65rem] font-semibold text-muted-foreground"
          onClick={() => {
            setFilter("favorites");
            document.querySelector("#catalogo")?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <Heart className="size-5" aria-hidden />
          Favoritos
        </button>
        <NavItem icon={<History />} label="Histórico" href="#historico" />
        <NavItem icon={<UserRound />} label="Perfil" href="#perfil" />
      </nav>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl surface-panel p-4">
      <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary [&>svg]:size-5">
        {icon}
      </span>
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="font-display text-xl font-black text-foreground">{value}</p>
      </div>
    </div>
  );
}

function NavItem({ icon, label, href }: { icon: ReactNode; label: string; href: string }) {
  return (
    <a
      href={href}
      className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[0.65rem] font-semibold text-muted-foreground hover:bg-secondary hover:text-primary [&>svg]:size-5"
    >
      {icon}
      {label}
    </a>
  );
}
