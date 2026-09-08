import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const PUBLIC = join(ROOT, "public");
const SCRIPTS = join(ROOT, "scripts");
const IGNORED_DIRS = new Set([".git", "node_modules", "dist", ".output", ".vinxi", ".turbo"]);
const CODE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".css"]);
const ASSET_EXTS = new Set([".webp", ".png", ".jpg", ".jpeg", ".svg", ".gif", ".ico", ".avif", ".wav", ".mp3", ".ogg"]);
const RESOLVE_EXTS = ["", ".ts", ".tsx", ".js", ".jsx", ".css", ".json", ".webp", ".png", ".jpg", ".jpeg", ".svg", ".gif", ".ico", ".avif", ".wav", ".mp3", ".ogg"];

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (IGNORED_DIRS.has(name)) continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function rel(file: string) {
  return relative(ROOT, file).replaceAll("\\", "/");
}

function stripQuery(spec: string) {
  return spec.split(/[?#]/, 1)[0] ?? spec;
}

function tryResolve(base: string): string | null {
  for (const ext of RESOLVE_EXTS) {
    const candidate = base + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) return resolve(candidate);
  }
  if (existsSync(base) && statSync(base).isDirectory()) {
    for (const ext of RESOLVE_EXTS.slice(1)) {
      const candidate = join(base, `index${ext}`);
      if (existsSync(candidate) && statSync(candidate).isFile()) return resolve(candidate);
    }
  }
  return null;
}

function resolveSpec(fromFile: string, rawSpec: string): string | null {
  const spec = stripQuery(rawSpec);
  if (spec.startsWith("@/")) return tryResolve(join(SRC, spec.slice(2)));
  if (spec.startsWith(".")) return tryResolve(resolve(dirname(fromFile), spec));
  if (spec.startsWith("/")) return tryResolve(join(PUBLIC, spec.slice(1)));
  return null;
}

function importSpecs(file: string, content: string): string[] {
  const specs = new Set<string>();
  const patterns = [
    /(?:import|export)\s+(?:[^"']*?\sfrom\s*)?["']([^"']+)["']/g,
    /import\(\s*["']([^"']+)["']\s*\)/g,
    /require\(\s*["']([^"']+)["']\s*\)/g,
  ];
  if (extname(file) === ".css") {
    patterns.push(/@import\s+(?:url\()?\s*["']([^"']+)["']/g);
    patterns.push(/url\(\s*["']?([^"')]+)["']?\s*\)/g);
  }
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) if (match[1]) specs.add(match[1]);
  }
  return [...specs];
}

const allFiles = walk(ROOT);
const srcFiles = allFiles.filter((file) => file.startsWith(SRC));
const srcCode = srcFiles.filter((file) => CODE_EXTS.has(extname(file)));
const testFiles = srcCode.filter((file) => /\.test\.[tj]sx?$/.test(file));
const scriptFiles = walk(SCRIPTS).filter((file) => CODE_EXTS.has(extname(file)));
const configCode = allFiles.filter((file) => dirname(file) === ROOT && CODE_EXTS.has(extname(file)));

const deps = new Map<string, Set<string>>();
const packageImports = new Set<string>();
const unresolvedLocal: Array<{ from: string; spec: string }> = [];

for (const file of [...srcCode, ...scriptFiles, ...configCode]) {
  const content = readFileSync(file, "utf8");
  const targets = new Set<string>();
  for (const spec of importSpecs(file, content)) {
    const resolved = resolveSpec(file, spec);
    if (resolved) targets.add(resolved);
    else if (spec.startsWith(".") || spec.startsWith("@/") || spec.startsWith("/")) {
      if (!spec.startsWith("/favicon") && !spec.startsWith("/robots")) unresolvedLocal.push({ from: rel(file), spec });
    } else {
      const clean = stripQuery(spec);
      const pkg = clean.startsWith("@") ? clean.split("/").slice(0, 2).join("/") : clean.split("/")[0];
      if (pkg) packageImports.add(pkg);
    }
  }
  deps.set(resolve(file), targets);
}

function reachableFrom(roots: string[]) {
  const seen = new Set<string>();
  const stack = roots.map(resolve).filter(existsSync);
  while (stack.length) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const dep of deps.get(file) ?? []) if (!seen.has(dep)) stack.push(dep);
  }
  return seen;
}

const runtimeRoots = [
  join(SRC, "start.ts"),
  join(SRC, "server.ts"),
  join(SRC, "router.tsx"),
  join(SRC, "routeTree.gen.ts"),
  ...srcCode.filter((file) => rel(file).startsWith("src/routes/") && !/\.test\./.test(file)),
];
const runtimeReach = reachableFrom(runtimeRoots);
const allReach = reachableFrom([...runtimeRoots, ...testFiles, ...scriptFiles, ...configCode]);

const runtimeCandidates = srcCode
  .filter((file) => !/\.test\.[tj]sx?$/.test(file))
  .filter((file) => !runtimeReach.has(resolve(file)))
  .map(rel)
  .sort();
const fullyUnreachable = srcCode.filter((file) => !allReach.has(resolve(file))).map(rel).sort();

const assetFiles = srcFiles.filter((file) => ASSET_EXTS.has(extname(file).toLowerCase()));
const referencedAssets = new Set<string>();
for (const file of allReach) {
  for (const dep of deps.get(file) ?? []) if (ASSET_EXTS.has(extname(dep).toLowerCase())) referencedAssets.add(resolve(dep));
}
const orphanAssets = assetFiles.filter((file) => !referencedAssets.has(resolve(file))).map(rel).sort();

const publicAssets = walk(PUBLIC).filter((file) => ASSET_EXTS.has(extname(file).toLowerCase()));
const allText = allFiles
  .filter((file) => [".ts", ".tsx", ".js", ".jsx", ".css", ".md", ".html", ".json"].includes(extname(file)))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");
const unreferencedPublic = publicAssets
  .filter((file) => !["public/favicon.ico"].includes(rel(file)))
  .filter((file) => !allText.includes(`/${rel(file).slice("public/".length)}`) && !allText.includes(rel(file).slice("public/".length)))
  .map(rel)
  .sort();

const contentGroups = new Map<string, string[]>();
for (const file of [...assetFiles, ...publicAssets]) {
  const hash = createHash("sha256").update(readFileSync(file)).digest("hex");
  const group = contentGroups.get(hash) ?? [];
  group.push(rel(file));
  contentGroups.set(hash, group);
}
const duplicateAssets = [...contentGroups.values()].filter((group) => group.length > 1).sort((a, b) => b.length - a.length);

const cssFiles = srcCode.filter((file) => extname(file) === ".css" && runtimeReach.has(resolve(file)));
const selectorOwners = new Map<string, Set<string>>();
for (const file of cssFiles) {
  const content = readFileSync(file, "utf8");
  for (const match of content.matchAll(/\.([A-Za-z_][\w-]*)/g)) {
    const klass = match[1];
    const owners = selectorOwners.get(klass) ?? new Set<string>();
    owners.add(rel(file));
    selectorOwners.set(klass, owners);
  }
}
const crossFileCss = [...selectorOwners.entries()]
  .filter(([, owners]) => owners.size > 1)
  .map(([klass, owners]) => ({ className: klass, files: [...owners].sort() }))
  .filter(({ className }) => /^(gt-|olympus|cc-|mines|plinko|arcade|fortune)/.test(className))
  .sort((a, b) => b.files.length - a.files.length || a.className.localeCompare(b.className));

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { dependencies?: Record<string, string> };
const unusedDependencies = Object.keys(pkg.dependencies ?? {}).filter((name) => !packageImports.has(name)).sort();

console.log("=== REPOSITORY SWEEP ===");
console.log(`src files: ${srcFiles.length}`);
console.log(`src code/css: ${srcCode.length}`);
console.log(`runtime reachable: ${[...runtimeReach].filter((file) => file.startsWith(SRC)).length}`);
console.log(`tests: ${testFiles.length}`);
console.log(`assets: ${assetFiles.length}`);
console.log("\n--- RUNTIME UNREACHABLE CODE/CSS ---");
console.log(runtimeCandidates.length ? runtimeCandidates.join("\n") : "none");
console.log("\n--- FULLY UNREACHABLE CODE/CSS (even tests/scripts/configs) ---");
console.log(fullyUnreachable.length ? fullyUnreachable.join("\n") : "none");
console.log("\n--- ORPHAN SRC ASSETS ---");
console.log(orphanAssets.length ? orphanAssets.join("\n") : "none");
console.log("\n--- UNREFERENCED PUBLIC ASSETS ---");
console.log(unreferencedPublic.length ? unreferencedPublic.join("\n") : "none");
console.log("\n--- DUPLICATE ASSET CONTENT ---");
console.log(duplicateAssets.length ? duplicateAssets.map((group) => group.join(" | ")).join("\n") : "none");
console.log("\n--- CROSS-FILE GAME CSS CLASSES (review candidates) ---");
console.log(crossFileCss.length ? crossFileCss.slice(0, 120).map((item) => `${item.className}: ${item.files.join(" | ")}`).join("\n") : "none");
console.log("\n--- UNRESOLVED LOCAL IMPORT/URL CANDIDATES ---");
console.log(unresolvedLocal.length ? unresolvedLocal.map((item) => `${item.from} -> ${item.spec}`).join("\n") : "none");
console.log("\n--- DEPENDENCIES WITH NO DIRECT IMPORT FOUND (review candidates) ---");
console.log(unusedDependencies.length ? unusedDependencies.join("\n") : "none");
console.log("=== END SWEEP ===");
