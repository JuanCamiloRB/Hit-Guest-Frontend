#!/usr/bin/env node

/**
 * Gate incremental del sistema visual de HitGuest.
 *
 * El baseline registra deuda heredada por archivo y regla. El check permite que
 * esa deuda disminuya, pero falla si aumenta. Cuando la migración termine, el
 * baseline queda vacío y las mismas reglas pasan a ser absolutas sin cambiar el
 * flujo de CI.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const srcRoot = join(root, "src")
const baselinePath = join(root, "scripts", "design-system-baseline.json")
const writeBaseline = process.argv.includes("--write-baseline")

const PALETTE = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose"

const rules = [
    {
        id: "tailwind-palette-color",
        description: "usa un color de paleta en vez de un token semántico",
        pattern: new RegExp(`\\b(?:text|bg|border|ring|outline|fill|stroke|shadow)-(?:${PALETTE})-(?:50|100|200|300|400|500|600|700|800|900|950)(?:/[0-9]+)?`, "g"),
    },
    {
        id: "arbitrary-color",
        description: "usa un color arbitrario en una utilidad Tailwind",
        pattern: /\b(?:text|bg|border|ring|outline|fill|stroke|shadow)-\[(?:#|rgb|rgba|hsl|hsla|oklch|var\()[^\]]+\]/g,
    },
    {
        id: "raw-color-literal",
        description: "inyecta un color hexadecimal directamente en código de interfaz",
        pattern: /#[0-9a-fA-F]{3,8}\b/g,
    },
    {
        id: "arbitrary-type-size",
        description: "usa un tamaño tipográfico fuera de la escala",
        pattern: /\btext-\[(?!#|rgb|hsl|oklch|var\()[^\]]+\]/g,
    },
    {
        id: "arbitrary-radius",
        description: "usa un radio fuera de la escala",
        pattern: /\brounded-\[(?!inherit\])[^\]]+\]/g,
    },
    {
        id: "arbitrary-shadow",
        description: "usa una sombra fuera de la escala",
        pattern: /\bshadow-\[[^\]]+\]/g,
    },
    {
        id: "gradient",
        description: "usa un gradiente fuera del lenguaje visual",
        pattern: /\bbg-gradient-[\w-]+/g,
    },
    {
        // El morado y el azul de marca son para logo e ilustración. Como texto o
        // como relleno de un control con texto no llegan a AA (brand-purple con
        // blanco da 4,42:1): la interacción va con primary / secondary.
        id: "brand-color-interaction",
        description: "usa un color de marca como interacción; la interacción va con primary o secondary",
        pattern: /(?<![\w-])(?:text|bg|border|ring|outline|fill|stroke|decoration|divide)-brand-(?:purple|blue)(?:\/[0-9]+)?(?![\w-])/g,
        ignore: (path) => path === "src/components/ui/Logo.tsx" || path.startsWith("src/components/brand/"),
    },
    {
        id: "arbitrary-font",
        description: "usa una fuente fuera de los tokens tipográficos",
        pattern: /\bfont-\[[^\]]+\]/g,
    },
    {
        id: "native-control",
        description: "crea un control nativo fuera de components/ui",
        pattern: /<(?:button|input|textarea|select)\b/g,
        input: "elements",
        ignore: (path) => path.startsWith("src/components/ui/") || path.endsWith(".test.tsx"),
    },
    {
        id: "native-label",
        description: "crea un label local en vez de la primitiva Label",
        pattern: /<label\b/g,
        input: "elements",
        ignore: (path) => path.startsWith("src/components/ui/") || path.endsWith(".test.tsx"),
    },
    {
        id: "nonstandard-icon-library",
        description: "importa iconos fuera de lucide-react o las primitivas de marca",
        pattern: /^(?:react-icons|@heroicons|phosphor-react|@mui\/icons-material)/g,
        input: "imports",
    },
]

function filesUnder(dir) {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name)
        return statSync(path).isDirectory() ? filesUnder(path) : [path]
    })
}

function inspect() {
    const result = {}
    const files = filesUnder(srcRoot).filter(
        // Fuera: pruebas y las copias de Finder («Archivo 2.tsx»), que .gitignore
        // ya excluye y no son código del proyecto.
        (path) => /\.(?:ts|tsx)$/.test(path) && !/\.(?:test|spec)\.(?:ts|tsx)$/.test(path) && !/ \d+\.(?:ts|tsx)$/.test(path),
    )
    for (const absolute of files) {
        const path = relative(root, absolute).replaceAll("\\", "/")
        const source = readFileSync(absolute, "utf8")
        const sourceFile = ts.createSourceFile(
            path,
            source,
            ts.ScriptTarget.Latest,
            true,
            path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        )
        const strings = []
        const elements = []
        const imports = []

        function visit(node) {
            if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
                strings.push(node.text)
            }
            // Los trozos fijos de un template con variables (`text-x ${y}`) también
            // son clases: sin esto se escapaban del control.
            if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
                strings.push(node.text)
            }
            if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
                const tag = node.tagName.getText(sourceFile)
                if (/^[a-z]/.test(tag)) elements.push(`<${tag}`)
            }
            if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
                imports.push(node.moduleSpecifier.text)
            }
            ts.forEachChild(node, visit)
        }
        visit(sourceFile)
        const inputs = {
            strings: strings.join("\n"),
            elements: elements.join("\n"),
            imports: imports.join("\n"),
        }
        for (const rule of rules) {
            if (rule.ignore?.(path)) continue
            const matches = inputs[rule.input ?? "strings"].match(rule.pattern) ?? []
            if (matches.length === 0) continue
            result[path] ??= {}
            result[path][rule.id] = matches.reduce((counts, match) => {
                counts[match] = (counts[match] ?? 0) + 1
                return counts
            }, {})
        }
    }
    return result
}

function totals(inventory) {
    const result = Object.fromEntries(rules.map((rule) => [rule.id, 0]))
    for (const file of Object.values(inventory)) {
        for (const [rule, matches] of Object.entries(file)) {
            result[rule] += Object.values(matches).reduce((sum, count) => sum + count, 0)
        }
    }
    return result
}

const current = inspect()

if (writeBaseline) {
    writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`)
    console.log(`design-system: baseline actualizado (${Object.keys(current).length} archivos).`)
    process.exit(0)
}

let baseline
try {
    baseline = JSON.parse(readFileSync(baselinePath, "utf8"))
} catch {
    console.error("design-system: falta scripts/design-system-baseline.json; créalo con --write-baseline.")
    process.exit(1)
}

const regressions = []
for (const [path, findings] of Object.entries(current)) {
    for (const [rule, matches] of Object.entries(findings)) {
        for (const [match, count] of Object.entries(matches)) {
            const before = baseline[path]?.[rule]?.[match] ?? 0
            if (count > before) regressions.push({ path, rule, match, before, count })
        }
    }
}

const currentTotals = totals(current)
const baselineTotals = totals(baseline)
const remaining = Object.values(currentTotals).reduce((sum, count) => sum + count, 0)
const removed = Object.keys(currentTotals).reduce(
    (sum, rule) => sum + Math.max(0, baselineTotals[rule] - currentTotals[rule]),
    0,
)

console.log(`design-system: ${remaining} usos heredados en ${Object.keys(current).length} archivos; ${removed} eliminados desde la línea base.`)

if (regressions.length === 0) process.exit(0)

console.error("Deuda visual nueva (no permitida):")
for (const item of regressions) {
    const description = rules.find((rule) => rule.id === item.rule)?.description ?? item.rule
    console.error(`  ${item.path}: ${item.rule} ${item.before} → ${item.count} · ${JSON.stringify(item.match)} (${description})`)
}
console.error("Usa tokens/primitivas existentes; no actualices el baseline para ocultar una regresión.")
process.exit(1)
