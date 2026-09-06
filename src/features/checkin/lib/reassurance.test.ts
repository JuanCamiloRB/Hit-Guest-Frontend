import { describe, expect, it } from "vitest"
import { CARD_WAIT_SCRIPT, DIDIT_WAIT_SCRIPT, phraseForElapsed } from "./reassurance"

describe("phraseForElapsed", () => {
    it("elige el tramo alcanzado, con bordes exactos", () => {
        expect(phraseForElapsed(0, DIDIT_WAIT_SCRIPT)).toMatch(/Conectando/)
        expect(phraseForElapsed(7, DIDIT_WAIT_SCRIPT)).toMatch(/Conectando/)
        expect(phraseForElapsed(8, DIDIT_WAIT_SCRIPT)).toMatch(/analizando tu captura/)
        expect(phraseForElapsed(600, DIDIT_WAIT_SCRIPT)).toMatch(/avanzas automáticamente/)
    })

    it("ninguna frase promete cuánto falta", () => {
        // «Ya falta poco» sería mentir: la ventana de espera la decide el
        // backend. La regla se afirma para que un copy futuro no la rompa.
        for (const { text } of [...DIDIT_WAIT_SCRIPT, ...CARD_WAIT_SCRIPT]) {
            expect(text).not.toMatch(/falta poco|casi listo|un momento más y/i)
        }
    })

    it("un guion vacío no revienta", () => {
        expect(phraseForElapsed(10, [])).toBe("")
    })
})
