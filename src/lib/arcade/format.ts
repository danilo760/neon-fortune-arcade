const coinFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function formatCoins(value: number): string {
  return coinFormatter.format(Math.round(value));
}

export function formatMultiplier(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded.toFixed(rounded < 10 ? 2 : 1).replace(/\.0+$/, "")}x`;
}

export function formatTime(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return "";
  }
}
