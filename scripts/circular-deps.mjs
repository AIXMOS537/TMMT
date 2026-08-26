#!/usr/bin/env node
/**
 * Circular-dependency walker for every .ts/.tsx file under src/.
 * Uses TypeScript already in node_modules — no extra packages.
 *
 *   node scripts/circular-deps.mjs
 *   node scripts/circular-deps.mjs --json
 *   node scripts/circular-deps.mjs --limit 15
 */
import { createRequire } from "module"
import { readdirSync, statSync } from "fs"
import { dirname, extname, join, relative, resolve, sep } from "path"
import { fileURLToPath } from "url"

const require = createRequire(import.meta.url)
const ts = require("typescript")

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const SRC = join(ROOT, "src")
const EXTS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx"]
const CYCLE_ENUM_CAP = 5000

const args = process.argv.slice(2)
const asJson = args.includes("--json")
const limitIdx = args.indexOf("--limit")
const printLimit = limitIdx >= 0 ? Number(args[limitIdx + 1]) || 15 : 15

function walkDir(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue
    const full = join(dir, ent.name)
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next") continue
      walkDir(full, out)
    } else if (ent.isFile()) {
      const ext = extname(ent.name)
      if ((ext === ".ts" || ext === ".tsx") && !ent.name.endsWith(".d.ts")) {
        out.push(full)
      }
    }
  }
  return out
}

function toPosix(p) {
  return p.split(sep).join("/")
}

function srcRel(abs) {
  return toPosix(relative(ROOT, abs))
}

function fileExists(p) {
  try {
    return statSync(p).isFile()
  } catch {
    return false
  }
}

function resolveImport(fromFile, specifier) {
  if (!specifier || specifier.startsWith("\0")) return null
  if (specifier.startsWith("http://") || specifier.startsWith("https://")) return null
  if (specifier.endsWith(".css") || specifier.endsWith(".json") || specifier.endsWith(".svg")) {
    return null
  }

  let target
  if (specifier.startsWith("@/")) {
    target = join(SRC, specifier.slice(2))
  } else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    target = resolve(dirname(fromFile), specifier)
  } else {
    return null
  }

  const candidates = []
  const ext = extname(target)
  if (EXTS.includes(ext)) {
    candidates.push(target)
    if (ext === ".js") candidates.push(target.slice(0, -3) + ".ts", target.slice(0, -3) + ".tsx")
    if (ext === ".jsx") candidates.push(target.slice(0, -4) + ".tsx")
  } else {
    for (const e of EXTS) candidates.push(target + e)
    for (const e of EXTS) candidates.push(join(target, "index" + e))
  }

  for (const c of candidates) {
    if (fileExists(c) && c.startsWith(SRC + sep)) return resolve(c)
  }
  return null
}

function extractSpecifiers(sourceText, fileName) {
  const kind = fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, kind)
  const specs = []

  function add(spec, typeOnly) {
    if (typeof spec === "string" && spec) specs.push({ spec, typeOnly: Boolean(typeOnly) })
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      add(node.moduleSpecifier.text, node.importClause?.isTypeOnly)
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      add(node.moduleSpecifier.text, node.isTypeOnly)
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      add(node.arguments[0].text, false)
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require" &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      add(node.arguments[0].text, false)
    }
    ts.forEachChild(node, visit)
  }

  visit(sf)
  return specs
}

function buildGraph(files) {
  const fileSet = new Set(files.map((f) => resolve(f)))
  const graph = new Map()
  const typeOnlyEdges = new Set()
  let unresolved = 0

  for (const file of fileSet) {
    graph.set(file, new Set())
  }

  const sourceCache = new Map()
  for (const file of fileSet) {
    const text = ts.sys.readFile(file)
    if (text == null) continue
    sourceCache.set(file, text)
    for (const { spec, typeOnly } of extractSpecifiers(text, file)) {
      const resolved = resolveImport(file, spec)
      if (!resolved) {
        if (spec.startsWith("@/") || spec.startsWith("./") || spec.startsWith("../")) unresolved += 1
        continue
      }
      if (!fileSet.has(resolved)) continue
      graph.get(file).add(resolved)
      if (typeOnly) typeOnlyEdges.add(`${file}=>${resolved}`)
    }
  }

  return { graph, typeOnlyEdges, unresolved }
}

function tarjanScc(graph) {
  let index = 0
  const indices = new Map()
  const lowlink = new Map()
  const onStack = new Set()
  const stack = []
  const sccs = []

  function strongconnect(v) {
    indices.set(v, index)
    lowlink.set(v, index)
    index += 1
    stack.push(v)
    onStack.add(v)

    for (const w of graph.get(v) || []) {
      if (!indices.has(w)) {
        strongconnect(w)
        lowlink.set(v, Math.min(lowlink.get(v), lowlink.get(w)))
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v), indices.get(w)))
      }
    }

    if (lowlink.get(v) === indices.get(v)) {
      const comp = []
      let w
      do {
        w = stack.pop()
        onStack.delete(w)
        comp.push(w)
      } while (w !== v)
      sccs.push(comp)
    }
  }

  for (const v of graph.keys()) {
    if (!indices.has(v)) strongconnect(v)
  }
  return sccs
}

function hasSelfLoop(graph, node) {
  return (graph.get(node) || new Set()).has(node)
}

function subgraph(graph, nodes) {
  const set = new Set(nodes)
  const g = new Map()
  for (const n of set) {
    const outs = new Set()
    for (const w of graph.get(n) || []) {
      if (set.has(w)) outs.add(w)
    }
    g.set(n, outs)
  }
  return g
}

/**
 * Unique simple cycles in a (usually small) SCC.
 * Start-node canonicalization avoids reporting rotations of the same cycle.
 */
function enumerateCycles(graph, cap) {
  const starts = [...graph.keys()].sort()
  const cycles = []
  let capped = false

  function dfs(start, current, path, used) {
    if (capped) return
    for (const next of graph.get(current) || []) {
      if (next === start && path.length >= 1) {
        cycles.push([...path])
        if (cycles.length >= cap) capped = true
        continue
      }
      if (used.has(next)) continue
      if (next < start) continue
      used.add(next)
      path.push(next)
      dfs(start, next, path, used)
      path.pop()
      used.delete(next)
      if (capped) return
    }
  }

  for (const start of starts) {
    if (capped) break
    dfs(start, start, [start], new Set([start]))
  }
  return { cycles, capped }
}

function cycleKey(nodes) {
  const rels = nodes.map(srcRel)
  const rotated = []
  let min = 0
  for (let i = 1; i < rels.length; i++) {
    if (rels[i] < rels[min]) min = i
  }
  for (let i = 0; i < rels.length; i++) rotated.push(rels[(min + i) % rels.length])
  return rotated.join(" -> ")
}

function main() {
  const files = walkDir(SRC).sort()
  const { graph, typeOnlyEdges, unresolved } = buildGraph(files)
  const sccs = tarjanScc(graph)
  const cyclicSccs = sccs.filter((c) => c.length > 1 || (c.length === 1 && hasSelfLoop(graph, c[0])))

  const allCycles = []
  let enumCapped = false
  for (const comp of cyclicSccs) {
    const g = subgraph(graph, comp)
    const { cycles, capped } = enumerateCycles(g, CYCLE_ENUM_CAP - allCycles.length)
    if (capped) enumCapped = true
    for (const cyc of cycles) allCycles.push(cyc)
    if (allCycles.length >= CYCLE_ENUM_CAP) {
      enumCapped = true
      break
    }
  }

  const unique = new Map()
  for (const cyc of allCycles) {
    const key = cycleKey(cyc)
    if (!unique.has(key)) unique.set(key, cyc)
  }
  const uniqueCycles = [...unique.values()].sort((a, b) => b.length - a.length || cycleKey(a).localeCompare(cycleKey(b)))

  const edgeCount = [...graph.values()].reduce((n, s) => n + s.size, 0)
  const fanIn = new Map()
  const fanOut = new Map()
  for (const [from, tos] of graph) {
    fanOut.set(from, tos.size)
    if (!fanIn.has(from)) fanIn.set(from, 0)
    for (const to of tos) fanIn.set(to, (fanIn.get(to) || 0) + 1)
  }
  const topFanIn = [...fanIn.entries()]
    .sort((a, b) => b[1] - a[1] || srcRel(a[0]).localeCompare(srcRel(b[0])))
    .slice(0, 10)
    .map(([file, n]) => ({ file: srcRel(file), fanIn: n }))
  const topFanOut = [...fanOut.entries()]
    .sort((a, b) => b[1] - a[1] || srcRel(a[0]).localeCompare(srcRel(b[0])))
    .slice(0, 10)
    .map(([file, n]) => ({ file: srcRel(file), fanOut: n }))

  const payload = {
    scannedFiles: files.length,
    resolvedEdges: edgeCount,
    unresolvedLocalImports: unresolved,
    typeOnlyEdges: typeOnlyEdges.size,
    cyclicSccCount: cyclicSccs.length,
    cycleCount: uniqueCycles.length,
    cycleEnumCapped: enumCapped,
    cycleEnumCap: CYCLE_ENUM_CAP,
    topFanIn,
    topFanOut,
    sccs: cyclicSccs
      .map((c) => ({
        size: c.length,
        files: c.map(srcRel).sort(),
      }))
      .sort((a, b) => b.size - a.size),
    cycles: uniqueCycles.map((c) => c.map(srcRel)),
  }

  if (asJson) {
    process.stdout.write(JSON.stringify(payload, null, 2) + "\n")
    return
  }

  console.log(`Scanned: ${payload.scannedFiles} files under src/`)
  console.log(`Resolved import edges: ${payload.resolvedEdges}`)
  console.log(`Unresolved local/alias imports: ${payload.unresolvedLocalImports}`)
  console.log(`Type-only edges: ${payload.typeOnlyEdges}`)
  console.log(`Cyclic SCCs: ${payload.cyclicSccCount}`)
  console.log(`Simple cycles: ${payload.cycleCount}${enumCapped ? ` (capped at ${CYCLE_ENUM_CAP})` : ""}`)
  console.log("")
  if (uniqueCycles.length === 0) {
    console.log("No circular dependencies.")
  } else {
    const shown = uniqueCycles.slice(0, printLimit)
    shown.forEach((cyc, i) => {
      const path = [...cyc.map(srcRel), srcRel(cyc[0])].join(" -> ")
      console.log(`${i + 1}. [${cyc.length} files] ${path}`)
    })
    if (uniqueCycles.length > printLimit) {
      console.log(`… ${uniqueCycles.length - printLimit} more cycles`)
    }
  }
  console.log("")
  console.log("Top fan-in (imported by most files):")
  for (const row of topFanIn) console.log(`  ${row.fanIn}\t${row.file}`)
}

main()
