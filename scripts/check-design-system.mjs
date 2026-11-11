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

/**
 * Únicos lugares donde un color escrito es legítimo, y por qué:
 * - components/brand: el color oficial de marcas ajenas (Airbnb, Booking…),
 *   que no es un token de HitGuest.
 * - lib/design-tokens.ts: espejo JS de globals.css para lo que no lee CSS
 *   (Stripe); su prueba falla si se desalinea.
 */
const UI_ONLY = (path) => path.startsWith("src/components/ui/") || path.startsWith("src/components/brand/")
const COLOR_EXCEPTIONS = (path) => path.startsWith("src/components/brand/") || path === "src/lib/design-tokens.ts"

const rules = [
    {
        id: "tailwind-palette-color",
        description: "usa un color de paleta en vez de un token semántico",
        pattern: new RegExp(`\\b(?:text|bg|border|ring|outline|fill|stroke|shadow)-(?:${PALETTE})-(?:950|900|800|700|600|500|400|300|200|100|50)(?:/[0-9]+)?(?![\\w-])`, "g"),
        ignore: COLOR_EXCEPTIONS,
    },
    {
        id: "arbitrary-color",
        description: "usa un color arbitrario en una utilidad Tailwind",
        pattern: /\b(?:text|bg|border|ring|outline|fill|stroke|shadow)-\[(?:#|rgb|rgba|hsl|hsla|oklch|var\()[^\]]+\]/g,
        ignore: COLOR_EXCEPTIONS,
    },
    {
        id: "raw-color-literal",
        description: "inyecta un color hexadecimal directamente en código de interfaz",
        pattern: /#[0-9a-fA-F]{3,8}\b/g,
        ignore: COLOR_EXCEPTIONS,
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
        // Una tinta con opacidad (`text-ink/60`) cae por debajo de AA según el
        // fondo: el texto usa el paso de la escala (ink-2, ink-3) a opacidad
        // completa. `text-white/N` sobre superficies oscuras sí se permite.
        id: "text-token-opacity",
        description: "baja la opacidad de una tinta; usa el paso de la escala (ink-2, ink-3)",
        pattern: /(?<![\w-])(?:text|placeholder)-(?:ink(?:-[234])?|muted-foreground|foreground|primary|secondary|success|warning|danger|info|brand-navy)\/[0-9]+(?![\w-])/g,
    },
    {
        id: "color-function-literal",
        description: "escribe un color con rgb()/hsl()/oklch() en código de interfaz",
        pattern: /\b(?:rgba?|hsla?|oklch)\(/g,
        ignore: COLOR_EXCEPTIONS,
    },
    {
        // `style={{ color: … }}` y similares esquivan las clases: el estilo
        // visual va en clases con tokens. Se permiten medidas dinámicas
        // (width, height, transform) y patrones decorativos (backgroundImage).
        id: "inline-visual-style",
        description: "pone color, tipografía, radio o sombra en `style` en vez de clases con tokens",
        pattern: /\b(?:color|backgroundColor|background|borderColor|fontSize|fontWeight|fontFamily|lineHeight|letterSpacing|borderRadius|boxShadow)\b/g,
        input: "styles",
        ignore: COLOR_EXCEPTIONS,
    },
    {
        // Cuatro radios (decisión 2026-11-11): md controles, lg avisos y piezas
        // dentro de tarjetas, xl tarjetas/tablas/diálogos, full pastillas y
        // avatares; xs para microcontroles. Sin `rounded` suelto, sm, 2xl, 3xl.
        id: "radius-scale",
        description: "usa un radio fuera de la escala (xs, md, lg, xl, full)",
        pattern: /(?<![\w-])rounded(?:-[trblse]{1,2})?(?:-(?:sm|2xl|3xl|4xl))?(?![\w-])/g,
        ignore: UI_ONLY,
    },
    {
        id: "shadow-scale",
        description: "usa una sombra alta fuera de un overlay (lg, xl, 2xl)",
        pattern: /(?<![\w-])shadow-(?:lg|xl|2xl)(?![\w/-])/g,
        ignore: UI_ONLY,
    },
    {
        id: "arbitrary-length",
        description: "usa una medida en px/rem fuera de la escala de espaciado (`w-45`, no `w-[180px]`)",
        pattern: /-\[[0-9.]+(?:px|rem|em)\]/g,
        ignore: UI_ONLY,
    },
    {
        id: "font-weight-scale",
        description: "usa un peso fuera de la escala (medium, semibold, bold)",
        pattern: /(?<![\w-])font-(?:black|extrabold|thin|extralight|light)(?![\w-])/g,
        ignore: UI_ONLY,
    },
    {
        // La interfaz va en caso de oración. Las mayúsculas solo existen en la
        // primitiva Overline (rótulos de grupo de navegación).
        id: "uppercase-text",
        description: "pone texto en mayúsculas; usa caso de oración o la primitiva Overline",
        // El tracking de la escala sí se permite (dígitos de un código de acceso).
        pattern: /(?<![\w-])(?:uppercase|tracking-\[[^\]]+\])(?![\w-])/g,
        ignore: UI_ONLY,
    },
    {
        // Fondo, borde, radio, sombra, anillo y foco de un campo son de la
        // primitiva (borde 3:1, hover y foco comunes). Desde la pantalla solo
        // layout: alto de densidad, ancho, relleno para un ícono.
        id: "primitive-override",
        description: "pisa la apariencia de un campo (Input, Textarea, SelectTrigger, PhoneInputField); solo se permite layout",
        pattern: /(?<![\w-])(?:[a-z-]+:)*(?:bg|border|rounded|shadow|ring|outline)(?:-[\w/\[\].%-]+)?(?![\w-])/g,
        input: "fieldClasses",
        // Las primitivas que componen otras (PhoneInputField sobre Input) sí ajustan.
        ignore: (path) => path.startsWith("src/components/ui/"),
    },
    {
        // Un ícono se pinta con la primitiva Icon (escala de tamaños, trazo y
        // aria-hidden comunes): `<Icon icon={Mail} />`, nunca `<Mail />`.
        id: "icon-direct",
        description: "pinta un ícono de lucide directamente; usa <Icon icon={…} size=…>",
        pattern: /^.+$/gm,
        input: "lucideElements",
        ignore: UI_ONLY,
    },
    {
        // El tamaño de un ícono es su `size` (xs…4xl), no una clase.
        id: "icon-size-override",
        description: "da tamaño a un Icon con clases; usa la prop size de la escala",
        pattern: /(?<![\w-])(?:[a-z-]+:)*(?:h|w|size|min-h|min-w|max-h|max-w)-[\w.\[\]/-]+(?![\w-])/g,
        input: "iconClasses",
        ignore: UI_ONLY,
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
        const styles = []
        const fieldClasses = []
        const lucideElements = []
        const iconClasses = []
        const lucideNames = new Set()
        for (const statement of sourceFile.statements) {
            if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)
                && statement.moduleSpecifier.text === "lucide-react") {
                const bindings = statement.importClause?.namedBindings
                if (bindings && ts.isNamedImports(bindings)) for (const el of bindings.elements) lucideNames.add(el.name.text)
            }
        }
        const classTexts = (node) => {
            const texts = []
            for (const attr of node.attributes.properties) {
                if (!ts.isJsxAttribute(attr) || attr.name.getText(sourceFile) !== "className" || !attr.initializer) continue
                const init = attr.initializer
                if (ts.isStringLiteral(init)) texts.push(init.text)
                else if (ts.isJsxExpression(init) && init.expression) {
                    // Todos los literales del `className`, también dentro de cn(…) y ternarios.
                    const collect = (n) => {
                        if (ts.isStringLiteralLike(n) || ts.isNoSubstitutionTemplateLiteral(n)) texts.push(n.text)
                        else if (ts.isTemplateExpression(n)) texts.push(n.head.text, ...n.templateSpans.map((sp) => sp.literal.text))
                        ts.forEachChild(n, collect)
                    }
                    collect(init.expression)
                }
            }
            return texts
        }

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
            // `className` de los campos: su apariencia es de la primitiva.
            if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
                && /^(?:Input|Textarea|SelectTrigger|PhoneInputField)$/.test(node.tagName.getText(sourceFile))) {
                for (const attr of node.attributes.properties) {
                    if (!ts.isJsxAttribute(attr) || attr.name.getText(sourceFile) !== "className" || !attr.initializer) continue
                    const init = attr.initializer
                    if (ts.isStringLiteral(init)) fieldClasses.push(init.text)
                    else if (ts.isJsxExpression(init) && init.expression) {
                        const e = init.expression
                        if (ts.isStringLiteralLike(e) || ts.isNoSubstitutionTemplateLiteral(e)) fieldClasses.push(e.text)
                        else if (ts.isTemplateExpression(e)) fieldClasses.push(e.head.text, ...e.templateSpans.map((sp) => sp.literal.text))
                    }
                }
            }
            if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
                const tag = node.tagName.getText(sourceFile)
                // Un componente de lucide importado, o uno elegido por dato (`<item.icon />`).
                if (lucideNames.has(tag) || /\.icon$/i.test(tag)) lucideElements.push(`<${tag}>`)
                if (tag === "Icon") iconClasses.push(...classTexts(node))
            }
            // Claves de los objetos en `style={{…}}`.
            if (ts.isJsxAttribute(node) && node.name.getText(sourceFile) === "style" && node.initializer
                && ts.isJsxExpression(node.initializer) && node.initializer.expression
                && ts.isObjectLiteralExpression(node.initializer.expression)) {
                for (const prop of node.initializer.expression.properties) {
                    if (prop.name) styles.push(prop.name.getText(sourceFile).replace(/^["']|["']$/g, ""))
                }
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
            styles: styles.join("\n"),
            fieldClasses: fieldClasses.join("\n"),
            lucideElements: lucideElements.join("\n"),
            iconClasses: iconClasses.join("\n"),
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
