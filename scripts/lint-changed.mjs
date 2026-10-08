#!/usr/bin/env node
/**
 * ESLint sobre lo que esta rama aportó. Solo `.ts`/`.tsx`. Tres modos:
 *
 *  - `--no-regressions` (lo que corre `npm run verify`): los archivos NUEVOS
 *    tienen que quedar en cero errores, y cada archivo MODIFICADO no puede
 *    tener más errores que en la base. Es el único modo que sirve de gate: un
 *    archivo modificado arrastra deuda previa (`any` en servicios) y exigirle
 *    cero haría fallar el gate siempre — y un gate que siempre falla se ignora —;
 *    pero no mirarlo (lo que hacía `--new-only`) dejaba pasar errores nuevos en
 *    archivos existentes.
 *  - `--new-only`: solo archivos nuevos, en cero.
 *  - sin bandera: nuevos + modificados en cero (informativo: reporta la deuda
 *    previa de cada archivo tocado).
 *
 * La comparación es por CONTEO de errores por archivo: mover un error de lugar
 * dentro del mismo archivo no cuenta como regresión. Los warnings no cuentan.
 *
 * La base NO es HEAD: tras un `git add` o un commit, los archivos nuevos dejan
 * de ser «untracked» y HEAD ya los contiene, así que el gate quedaba vacío. Se
 * usa el merge-base con el upstream de la rama (`@{upstream}`), o `LINT_BASE`,
 * o la primera que exista de `origin/main`, `main`, `master`; si ninguna existe
 * —por ejemplo en la propia rama principal— cae a HEAD y lo dice.
 */
import { execFileSync } from "node:child_process"
import { ESLint } from "eslint"

const args = new Set(process.argv.slice(2))
const mode = args.has("--no-regressions") ? "no-regressions" : args.has("--new-only") ? "new-only" : "all"

function git(gitArgs, { allowFail = false, raw = false } = {}) {
    try {
        const out = execFileSync("git", gitArgs, {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
            maxBuffer: 64 * 1024 * 1024,
        })
        return raw ? out : out.split("\n").map((l) => l.trim()).filter(Boolean)
    } catch (error) {
        if (allowFail) return null
        throw error
    }
}

function resolveBase() {
    // Primero el upstream de la rama actual: «lo que esta rama aportó desde el
    // último push» sobrevive a `git add` y a los commits, y no arrastra la
    // deuda de una base lejana (`origin/develop` está a cientos de archivos de
    // `features/dashboard`, la rama de integración real de este repo).
    const candidates = process.env.LINT_BASE
        ? [process.env.LINT_BASE]
        : ["@{upstream}", "origin/main", "main", "master"]
    for (const ref of candidates) {
        const base = git(["merge-base", ref, "HEAD"], { allowFail: true })
        if (base && base[0]) return { ref, base: base[0] }
    }
    return { ref: "HEAD", base: "HEAD" }
}

const isLintable = (file) => /\.(ts|tsx)$/.test(file)
const { ref, base } = resolveBase()

const untracked = git(["ls-files", "--others", "--exclude-standard"]).filter(isLintable)
const added = git(["diff", "--name-only", "--diff-filter=A", base]).filter(isLintable)
const newFiles = [...new Set([...untracked, ...added])]

/** Modificados (y renombrados/copiados) con la ruta que tenían en la base. */
const modified = mode === "new-only"
    ? []
    : git(["diff", "--name-status", "--diff-filter=CMR", base])
        .map((line) => line.split("\t"))
        .map(([status, from, to]) => (status.startsWith("M") ? { path: from, basePath: from } : { path: to, basePath: from }))
        .filter(({ path }) => isLintable(path) && !newFiles.includes(path))

const files = [...newFiles, ...modified.map((m) => m.path)]
if (files.length === 0) {
    console.log(`lint-changed: sin archivos que revisar respecto a ${ref}.` + (ref === "HEAD" ? " (sin rama principal para comparar)" : ""))
    process.exit(0)
}

const eslint = new ESLint()
const results = await eslint.lintFiles(files)
const byPath = new Map(results.map((r) => [r.filePath, r]))
const resultFor = (file) => byPath.get(new URL(file, `file://${process.cwd()}/`).pathname)
const errorsOf = (file) => resultFor(file)?.errorCount ?? 0

const failing = []
const reportLines = []

for (const file of newFiles) {
    if (errorsOf(file) > 0) failing.push(file)
}

if (mode === "no-regressions") {
    for (const { path, basePath } of modified) {
        const now = errorsOf(path)
        if (now === 0) continue
        const baseText = git(["show", `${base}:${basePath}`], { allowFail: true, raw: true })
        const [baseResult] = baseText == null ? [] : await eslint.lintText(baseText, { filePath: path })
        const before = baseResult?.errorCount ?? 0
        if (now > before) {
            failing.push(path)
            reportLines.push(`  ${path}: ${before} → ${now} errores`)
        }
    }
} else {
    for (const { path } of modified) if (errorsOf(path) > 0) failing.push(path)
}

const label = {
    "no-regressions": `${newFiles.length} nuevo(s) en cero y ${modified.length} modificado(s) sin errores nuevos`,
    "new-only": `${newFiles.length} archivo(s) nuevo(s)`,
    all: `${files.length} archivo(s) cambiado(s)`,
}[mode]
console.log(`lint-changed: ${label}, respecto a ${ref}`)

if (failing.length === 0) process.exit(0)

const formatter = await eslint.loadFormatter("stylish")
console.log(await formatter.format(failing.map(resultFor).filter(Boolean)))
if (reportLines.length > 0) {
    console.log("Archivos modificados con más errores que en la base:")
    console.log(reportLines.join("\n"))
}
process.exit(1)
