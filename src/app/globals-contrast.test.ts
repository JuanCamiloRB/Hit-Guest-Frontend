import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Contraste de los pares semánticos de globals.css, en claro y en oscuro.
 * Lee el CSS real: si alguien cambia un token y rompe AA (4.5:1 para texto
 * normal), esto falla. Las marcas (--color-brand-*) no se miden aquí: son de
 * logo e ilustración, no de interacción.
 */
const css = readFileSync(join(__dirname, "globals.css"), "utf8")

function block(selector: string): Record<string, string> {
    const start = css.indexOf(`${selector} {`)
    if (start < 0) throw new Error(`no hay bloque ${selector}`)
    const body = css.slice(start, css.indexOf("\n}", start))
    const vars: Record<string, string> = {}
    for (const match of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[match[1]] = match[2].replace(/\/\*.*?\*\//g, "").trim()
    // Un alias (`--destructive: var(--danger)`) se mide con el valor al que apunta.
    const resolve = (value: string, depth = 0): string => {
        const ref = value.match(/^var\(--([\w-]+)\)$/)
        if (!ref || depth > 5) return value
        return resolve(vars[ref[1]] ?? value, depth + 1)
    }
    for (const key of Object.keys(vars)) vars[key] = resolve(vars[key])
    return vars
}

const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

/** Luminancia relativa de un hex o un oklch(L C h). */
function luminance(value: string): number {
    const hex = value.match(/^#([0-9a-f]{6})$/i)
    if (hex) {
        const [r, g, b] = [0, 2, 4].map((i) => linear(parseInt(hex[1].slice(i, i + 2), 16) / 255))
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const ok = value.match(/^oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)$/)
    if (!ok) throw new Error(`color no soportado en la prueba: ${value}`)
    const [L, C, H] = ok.slice(1).map(Number)
    const a = C * Math.cos((H * Math.PI) / 180)
    const b = C * Math.sin((H * Math.PI) / 180)
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
    const clamp = (v: number) => Math.min(1, Math.max(0, v))
    const R = clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)
    const G = clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)
    const B = clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
    return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
}

const light = block(":root")
const dark = { ...light, ...block(".dark") }
const WHITE = "#ffffff"

describe.each([
    ["claro", light],
    ["oscuro", dark],
])("tokens de interacción en tema %s pasan AA (4.5:1)", (_theme, t) => {
    it.each([
        ["botón principal", "primary", "primary-foreground"],
        ["botón principal en hover", "primary-hover", "primary-foreground"],
        ["botón secundario", "secondary", "secondary-foreground"],
        ["botón secundario en hover", "secondary-hover", "secondary-foreground"],
        ["enlace (primary como texto) sobre el fondo", "primary", "background"],
        ["enlace (primary como texto) sobre una card", "primary", "card"],
    ])("%s", (_name, fill, text) => {
        expect(contrast(t[fill], t[text])).toBeGreaterThanOrEqual(4.5)
    })

    it.each([
        ["botón destructivo (texto blanco)", "destructive"],
        ["botón destructivo en hover", "destructive-hover"],
    ])("%s", (_name, fill) => {
        expect(contrast(t[fill], WHITE)).toBeGreaterThanOrEqual(4.5)
    })
})

describe("tinta de estado en tema claro pasa AA (4.5:1) sobre su pastilla y sobre las superficies", () => {
    it.each(["success", "warning", "info", "danger"])("%s", (tone) => {
        for (const surface of [`${tone}-sunk`, "background", "card", "sunk"]) {
            expect(contrast(light[tone], light[surface]), `${tone} sobre ${surface}`).toBeGreaterThanOrEqual(4.5)
        }
    })
})

describe("FeedbackBanner en tema claro: título (tinta del tono) y cuerpo (ink-2) pasan AA sobre el fondo del tono", () => {
    it.each(["info", "success", "warning", "danger"])("%s", (tone) => {
        const surface = light[`${tone}-sunk`]
        expect(contrast(light[tone], surface), `título ${tone}`).toBeGreaterThanOrEqual(4.5)
        expect(contrast(light["ink-2"], surface), `cuerpo ${tone}`).toBeGreaterThanOrEqual(4.5)
    })
})

describe("indicador de foco (--ring sólido) en tema claro: 3:1 (WCAG 1.4.11)", () => {
    it.each(["background", "card", "sunk"])("sobre %s", (surface) => {
        expect(contrast(light.ring, light[surface])).toBeGreaterThanOrEqual(3)
    })
})

describe("tinta secundaria (ink-3) en tema claro pasa AA (4.5:1) sobre cada superficie", () => {
    it.each(["background", "card", "sunk", "neutral-sunk"])("sobre %s", (surface) => {
        expect(contrast(light["ink-3"], light[surface])).toBeGreaterThanOrEqual(4.5)
    })
})

describe.each([
    ["claro", light, ["background", "card", "sunk"]],
    ["oscuro", dark, ["background", "card"]],
] as const)("borde de campo (--input) y su hover en tema %s: 3:1 (WCAG 1.4.11)", (_theme, t, surfaces) => {
    it.each(surfaces)("sobre %s", (surface) => {
        expect(contrast(t.input, t[surface])).toBeGreaterThanOrEqual(3)
        expect(contrast(t["input-hover"], t[surface])).toBeGreaterThanOrEqual(3)
    })
})

/** `color` al `alpha` sobre `base` (dos hex), como lo pinta el navegador. */
function over(color: string, alpha: number, base: string): string {
    const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
    const [c, b] = [channels(color), channels(base)]
    return `#${c.map((v, i) => Math.round(alpha * v + (1 - alpha) * b[i]).toString(16).padStart(2, "0")).join("")}`
}

describe("saldo destacado: Button accent y Surface accent", () => {
    // El chip del header va sobre el fondo; su hover sube el tinte a primary/20.
    it.each([["en reposo", 0.1], ["en hover", 0.2]])("chip %s: cifra ink y «USD» ink-2 a 4.5:1", (_, alpha) => {
        const surface = over(light.primary, alpha as number, light.background)
        expect(contrast(light.ink, surface)).toBeGreaterThanOrEqual(4.5)
        expect(contrast(light["ink-2"], surface)).toBeGreaterThanOrEqual(4.5)
    })
    it("tarjeta del Tablero (primary/5 sobre el fondo): rótulo ink-3 y aviso warning a 4.5:1", () => {
        const surface = over(light.primary, 0.05, light.background)
        expect(contrast(light["ink-3"], surface)).toBeGreaterThanOrEqual(4.5)
        expect(contrast(light.warning, surface)).toBeGreaterThanOrEqual(4.5)
    })
})

describe("celda de dato (StatusTile data): morado claro con texto primary-hover", () => {
    // bg-primary/10 sobre la card, y sobre una fila en hover (hover:bg-primary/5 de TableRow).
    const resting = over(light.primary, 0.1, light.card)
    const hovered = over(light.primary, 0.1, over(light.primary, 0.05, light.card))
    it.each([["en reposo", resting], ["sobre una fila en hover", hovered]])("texto %s: AA 4.5:1", (_, surface) => {
        expect(contrast(light["primary-hover"], surface)).toBeGreaterThanOrEqual(4.5)
    })
    it("con primary no alcanzaría sobre la fila en hover (por eso primary-hover)", () => {
        expect(contrast(light.primary, hovered)).toBeLessThan(4.5)
    })
})

describe("tabla (diseño de Alojamientos 2026-11-24): encabezado, chips de conexión y de precio", () => {
    it("encabezado lavanda: texto ink y la columna ordenada en primary-hover a 4.5:1", () => {
        expect(contrast(light.ink, light["table-head"])).toBeGreaterThanOrEqual(4.5)
        expect(contrast(light["primary-hover"], light["table-head"])).toBeGreaterThanOrEqual(4.5)
    })
    it.each([["accent", "table-head-accent"], ["soft", "table-head-soft"]])("encabezado %s: texto primary-hover a 4.5:1 (primary no alcanza en accent)", (_, token) => {
        expect(contrast(light["primary-hover"], light[token])).toBeGreaterThanOrEqual(4.5)
    })
    it("en el morado fuerte, primary no llegaría (por eso primary-hover)", () => {
        expect(contrast(light.primary, light["table-head-accent"])).toBeLessThan(4.5)
    })
    const rowHover = over(light.primary, 0.05, light.card)
    it.each([["en reposo", light.card], ["sobre una fila en hover", rowHover]])("chip de conexión (secondary/10) %s: texto secondary-hover a 4.5:1", (_, base) => {
        expect(contrast(light["secondary-hover"], over(light.secondary, 0.1, base))).toBeGreaterThanOrEqual(4.5)
    })
    it("chip de precio en la fila en hover: blanco sobre primary-hover a 4.5:1", () => {
        expect(contrast(WHITE, light["primary-hover"])).toBeGreaterThanOrEqual(4.5)
    })
    it("Siguiente (outline-accent): primary-hover sobre el fondo y sobre su hover primary/10", () => {
        expect(contrast(light["primary-hover"], light.background)).toBeGreaterThanOrEqual(4.5)
        expect(contrast(light["primary-hover"], over(light.primary, 0.1, light.background))).toBeGreaterThanOrEqual(4.5)
    })
})

describe("borde de campo en tema claro: azul de marca, hover primary", () => {
    it("el borde del campo es el azul de marca (--color-brand-blue)", () => {
        expect(light.input.toLowerCase()).toBe("#5467fa")
        expect(css).toMatch(/--color-brand-blue:\s*#5467FA;/)
    })
    // El hover del campo (hover:border-primary) también es la señal del control.
    it.each(["background", "card", "sunk"])("hover primary sobre %s: 3:1", (surface) => {
        expect(contrast(light.primary, light[surface])).toBeGreaterThanOrEqual(3)
    })
})

describe("marca separada de la interacción", () => {
    it("los colores de marca no cambian", () => {
        expect(css).toMatch(/--color-brand-purple:\s*#9D4CF2;/)
        expect(css).toMatch(/--color-brand-blue:\s*#5467FA;/)
    })
})

describe("barra de ocupación por estado (TimelineBar tone): el texto a 4.5:1 en cada trazo y en su hover", () => {
    it.each([
        ["default y progress: ink sobre timeline-bar", "ink", "timeline-bar"],
        ["progress (raya) y hover: ink sobre timeline-bar-strong", "ink", "timeline-bar-strong"],
        ["past: success sobre success-sunk", "success", "success-sunk"],
        ["attention: ink sobre card", "ink", "card"],
        ["attention en hover: ink sobre table-head-soft", "ink", "table-head-soft"],
        ["unknown: ink-2 sobre sunk", "ink-2", "sunk"],
        ["unknown (trama) y hover: ink-2 sobre rule", "ink-2", "rule"],
    ])("%s", (_, fg, bg) => {
        expect(contrast(light[fg], light[bg])).toBeGreaterThanOrEqual(4.5)
    })
    it("el ícono de En progreso (primary-hover) se distingue del lila a 3:1 (no es texto)", () => {
        expect(contrast(light["primary-hover"], light["timeline-bar"])).toBeGreaterThanOrEqual(3)
        expect(contrast(light["primary-hover"], light["timeline-bar-strong"])).toBeGreaterThanOrEqual(3)
    })
    it("el lila de la barra no es el del encabezado ni el de la columna de hoy (se perdería)", () => {
        expect(light["timeline-bar"]).not.toBe(light["table-head-accent"])
    })
})
