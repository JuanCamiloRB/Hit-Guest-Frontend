import { describe, it, expect } from "vitest"
import { resolveGuaranteePreview } from "./system-document-service"

const ES = {
    guarantee_mechanism: "Tarjeta en Garantía",
    guarantee_amount: "1000",
    guarantee_release_hours: "48",
    damage_catalog_url: "https://drive.google.com/file/d/abc/view?usp=sharing",
}

describe("resolveGuaranteePreview — solo las variables de la garantía (Ricardo, 2026-10-29)", () => {
    it("resuelve las cuatro con los valores de la DB", () => {
        const { html, missing } = resolveGuaranteePreview(
            "<p>Mecanismo: {{guarantee_mechanism}}</p><p>Monto: {{guarantee_amount}} USD</p><p>Horas: {{guarantee_release_hours}} h</p>",
            ES,
        )
        expect(html).toBe("<p>Mecanismo: Tarjeta en Garantía</p><p>Monto: 1000 USD</p><p>Horas: 48 h</p>")
        expect(missing).toEqual([])
    })

    it("no toca las variables de cada reserva: las resuelve HitGuest en el PDF", () => {
        const { html, missing } = resolveGuaranteePreview("<p>{{guest_first_name}} · {{guarantee_amount}}</p>", ES)
        expect(html).toBe("<p>{{guest_first_name}} · 1000</p>")
        expect(missing).toEqual([])
    })

    it("tolera espacios dentro de las llaves", () => {
        expect(resolveGuaranteePreview("{{ guarantee_amount }}", ES).html).toBe("1000")
    })

    it("lo que falta queda como token y se informa", () => {
        const { html, missing } = resolveGuaranteePreview("{{guarantee_amount}} {{guarantee_release_hours}}", { guarantee_amount: "1000", guarantee_release_hours: "" })
        expect(html).toBe("1000 {{guarantee_release_hours}}")
        expect(missing).toEqual(["guarantee_release_hours"])
    })

    it("sin `extra` del idioma, todas las de la garantía faltan", () => {
        expect(resolveGuaranteePreview("{{guarantee_mechanism}}", undefined).missing).toEqual(["guarantee_mechanism"])
    })

    it("escapa los valores antes de meterlos en el HTML", () => {
        expect(resolveGuaranteePreview("{{guarantee_mechanism}}", { guarantee_mechanism: `<b>"x"</b>` }).html)
            .toBe("&lt;b&gt;&quot;x&quot;&lt;/b&gt;")
    })

    it("el enlace del catálogo queda con la URL de la DB; una que no es http(s) no se usa", () => {
        expect(resolveGuaranteePreview(`<a href="{{damage_catalog_url}}">Ver catálogo</a>`, ES).html)
            .toBe(`<a href="https://drive.google.com/file/d/abc/view?usp=sharing">Ver catálogo</a>`)
        expect(resolveGuaranteePreview(`<a href="{{damage_catalog_url}}">x</a>`, { damage_catalog_url: "javascript:alert(1)" }).missing)
            .toEqual(["damage_catalog_url"])
    })
})
