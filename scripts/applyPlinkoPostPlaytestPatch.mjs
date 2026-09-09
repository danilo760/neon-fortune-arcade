import { readFile, writeFile } from "node:fs/promises";

const path = "src/components/arcade/PlinkoReference.tsx";
let source = await readFile(path, "utf8");

function replaceOnce(before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing Plinko patch anchor: ${label}`);
  source = source.replace(before, after);
}

replaceOnce(
`function stepDuration(step: number, rows: number) {
  const progress = step / Math.max(1, rows - 1);
  return 82 - Math.round(progress * 24);
}`,
`function stepDuration(step: number, rows: number) {
  const progress = step / Math.max(1, rows - 1);
  return 64 - Math.round(progress * 20);
}`,
"step duration",
);

replaceOnce("  let at = 72;", "  let at = 58;", "motion lead-in");
replaceOnce("  const duration = Math.max(1, at + 84);", "  const duration = Math.max(1, at + 64);", "bucket tail");

replaceOnce(
`  const inFlight = Math.max(0, launched - settled);

  function clearAutoTimer() {`,
`  const inFlight = Math.max(0, launched - settled);
  const flightLabel = !busy
    ? "PRONTO PARA CAIR"
    : portalPhase === "charging"
      ? "PREPARANDO QUEDA"
      : portalPhase === "launching" && inFlight === 0 && launched === 0
        ? "LANÇANDO BOLAS"
        : inFlight === 0 && launched > 0 && settled >= launched
          ? "CONCLUINDO RODADA"
          : \`${"${inFlight}"} EM QUEDA\`;
  const dropDetail = !busy
    ? formatCoins(runCost)
    : portalPhase === "charging"
      ? "carregando portal"
      : portalPhase === "launching" && inFlight === 0 && launched === 0
        ? \`${"${ballsPerRun}"} na fila\`
        : inFlight === 0 && launched > 0 && settled >= launched
          ? \`${"${settled}"}/${"${ballsPerRun}"} concluídas\`
          : \`${"${inFlight}"} em queda\`;
  const dropActionLabel = !busy
    ? \`SOLTAR ×${"${ballsPerRun}"}\`
    : portalPhase === "charging"
      ? "PREPARANDO"
      : inFlight === 0 && launched > 0 && settled >= launched
        ? "CONCLUINDO"
        : "EM QUEDA";

  function clearAutoTimer() {`,
"derived run labels",
);

replaceOnce("    await wait(180);", "    await wait(130);", "portal charge");
replaceOnce("    await wait(100);", "    await wait(70);", "portal launch");
replaceOnce(
"    const stagger = ballsPerRun >= 10 ? 88 : ballsPerRun >= 5 ? 108 : 136;",
"    const stagger = ballsPerRun >= 10 ? 72 : ballsPerRun >= 5 ? 92 : 118;",
"multiball stagger",
);
replaceOnce("      await wait(850);", "      await wait(650);", "big win hold");
replaceOnce("      await wait(460);", "      await wait(280);", "normal settle hold");
replaceOnce("    if (autoRef.current) scheduleAuto(240);", "    if (autoRef.current) scheduleAuto(180);", "auto cadence");

replaceOnce(
`          <span>{busy ? \`${"${inFlight}"} EM QUEDA\` : "PRONTO PARA CAIR"}</span>`,
`          <span>{flightLabel}</span>`,
"top status label",
);
replaceOnce(
`          aria-label={busy ? "Bolas em queda" : \`Soltar ${"${ballsPerRun}"} bolas por ${"${formatCoins(runCost)}"}\`}`,
`          aria-label={busy ? flightLabel : \`Soltar ${"${ballsPerRun}"} bolas por ${"${formatCoins(runCost)}"}\`}`,
"drop aria label",
);
replaceOnce(
`          <strong>{busy ? "EM QUEDA" : \`SOLTAR ×${"${ballsPerRun}"}\`}</strong>
          <small>{busy ? \`${"${inFlight}"} em queda\` : formatCoins(runCost)}</small>`,
`          <strong>{dropActionLabel}</strong>
          <small>{dropDetail}</small>`,
"drop button status",
);

await writeFile(path, source);
console.log("Plinko post-playtest source patch applied");
