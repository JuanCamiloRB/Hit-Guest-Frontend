import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { tokens } from "./design-tokens"

const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf8")
const root = css.slice(css.indexOf(":root {"), css.indexOf("\n}", css.indexOf(":root {")))
const value = (name: string) => root.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toUpperCase()

describe("design-tokens: el espejo en JS coincide con globals.css", () => {
    it.each([
        ["ink", "ink"],
        ["ink3", "ink-3"],
        ["danger", "danger"],
    ] as const)("%s = --%s", (key, cssName) => {
        expect(tokens[key].toUpperCase()).toBe(value(cssName))
    })
})
