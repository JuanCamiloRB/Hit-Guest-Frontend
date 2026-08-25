import { describe, it, expect } from "vitest"
import {
    validateUnitForm,
    toFieldErrorMap,
    UNIT_LIMITS,
    type UnitFormValues,
} from "./unit-form-validation"

/** Formulario que pasa todas las reglas — cada test rompe sólo lo que prueba. */
const valid: UnitFormValues = {
    name: "Apto 105 Insula",
    roomTypeId: 16,
    internalName: "INS_105",
    contactName: "Rodrigo Nuñez",
    contactEmail: "rodrigo@kunas.co",
    contactPhone: "+57366588595",
    price: "250000",
    extra: { maxOccupancy: 2, bedRoom: 1, bathRoom: 1 },
}

const fields = (form: UnitFormValues) => validateUnitForm(form).map((e) => e.field)

describe("validateUnitForm", () => {
    it("no reporta nada sobre un formulario completo y válido", () => {
        expect(validateUnitForm(valid)).toEqual([])
    })

    describe("correo de contacto — la UI lo marca requerido, nadie lo comprobaba", () => {
        it("exige el correo cuando está vacío", () => {
            // Es el campo que estaba al final del tab General, debajo del pliegue:
            // el PM enviaba sin verlo y el rechazo llegaba del backend.
            expect(fields({ ...valid, contactEmail: "" })).toContain("contactEmail")
            expect(fields({ ...valid, contactEmail: null })).toContain("contactEmail")
            expect(fields({ ...valid, contactEmail: "   " })).toContain("contactEmail")
        })

        it("rechaza el error de tipeo obvio", () => {
            expect(fields({ ...valid, contactEmail: "rodrigo" })).toContain("contactEmail")
            expect(fields({ ...valid, contactEmail: "rodrigo@kunas" })).toContain("contactEmail")
            expect(fields({ ...valid, contactEmail: "rodrigo @kunas.co" })).toContain("contactEmail")
        })

        it("no bloquea direcciones legítimas poco comunes", () => {
            // Una regex agresiva acá sólo consigue trabar a un PM con correo válido;
            // quien decide de verdad es el backend.
            expect(fields({ ...valid, contactEmail: "r.nuñez+reservas@sub.kunas.com.co" }))
                .not.toContain("contactEmail")
        })

        it("aplica el máximo de 60 del backend", () => {
            const local = "a".repeat(UNIT_LIMITS.contactEmail)
            expect(fields({ ...valid, contactEmail: `${local}@kunas.co` })).toContain("contactEmail")
        })
    })

    describe("nombre interno — el límite más estrecho y menos evidente", () => {
        it("rechaza más de 15 caracteres", () => {
            // "Apto 105 Insula" (15) pasa; un carácter más, no. Sin esta regla el
            // 422 no decía qué campo lo causaba.
            expect(fields({ ...valid, internalName: "A".repeat(UNIT_LIMITS.internalName) }))
                .not.toContain("internalName")
            expect(fields({ ...valid, internalName: "A".repeat(UNIT_LIMITS.internalName + 1) }))
                .toContain("internalName")
        })

        it("lo trata como opcional", () => {
            expect(fields({ ...valid, internalName: "" })).not.toContain("internalName")
        })
    })

    describe("nombre de la unidad", () => {
        it("mantiene el mínimo de 2 que ya exigía el modal", () => {
            expect(fields({ ...valid, name: "A" })).toContain("name")
            expect(fields({ ...valid, name: "  " })).toContain("name")
        })

        it("aplica el máximo de 120", () => {
            expect(fields({ ...valid, name: "A".repeat(121) })).toContain("name")
        })
    })

    describe("precio", () => {
        it("rechaza negativos en vez de convertirlos en 0 en silencio", () => {
            // `Number(price) || 0` publicaba la unidad sin precio y nadie se
            // enteraba hasta la primera reserva.
            expect(fields({ ...valid, price: "-1" })).toContain("price")
        })

        it("rechaza texto que no es número", () => {
            expect(fields({ ...valid, price: "doscientos mil" })).toContain("price")
        })

        it("acepta vacío (el precio no es obligatorio) y acepta 0", () => {
            expect(fields({ ...valid, price: "" })).not.toContain("price")
            expect(fields({ ...valid, price: "0" })).not.toContain("price")
            expect(fields({ ...valid, price: 250000 })).not.toContain("price")
        })
    })

    describe("categoría y capacidad", () => {
        it("exige una categoría real del catálogo", () => {
            expect(fields({ ...valid, roomTypeId: 0 })).toContain("roomTypeId")
            expect(fields({ ...valid, roomTypeId: 16 })).not.toContain("roomTypeId")
        })

        it("rechaza capacidades negativas, cero o decimales", () => {
            expect(fields({ ...valid, extra: { ...valid.extra, maxOccupancy: 0 } })).toContain("maxOccupancy")
            expect(fields({ ...valid, extra: { ...valid.extra, bedRoom: -1 } })).toContain("bedRoom")
            expect(fields({ ...valid, extra: { ...valid.extra, bathRoom: 1.5 } })).toContain("bathRoom")
        })

        it("ubica los errores de distribución en su pestaña", () => {
            expect(validateUnitForm({ ...valid, extra: { ...valid.extra, bedRoom: 0 } })[0].tab).toBe("rooms")
        })
    })

    it("reporta TODOS los errores, no sólo el primero", () => {
        // Mostrarlos de a uno obliga a guardar-corregir-guardar por cada campo.
        const errors = validateUnitForm({
            ...valid,
            name: "",
            internalName: "X".repeat(20),
            contactEmail: "",
        })
        expect(errors.map((e) => e.field).sort()).toEqual(["contactEmail", "internalName", "name"])
    })

    it("cada error sabe en qué pestaña vive", () => {
        expect(validateUnitForm({ ...valid, contactEmail: "" })[0].tab).toBe("general")
    })
})

describe("toFieldErrorMap", () => {
    it("indexa por campo para pintar el error bajo su input", () => {
        const map = toFieldErrorMap(validateUnitForm({ ...valid, contactEmail: "" }))
        expect(map.contactEmail).toMatch(/obligatorio/i)
        expect(map.name).toBeUndefined()
    })

    it("conserva el primer error de un mismo campo", () => {
        const map = toFieldErrorMap([
            { field: "contactEmail", message: "primero", tab: "general" },
            { field: "contactEmail", message: "segundo", tab: "general" },
        ])
        expect(map.contactEmail).toBe("primero")
    })

    it("devuelve un mapa vacío sin errores", () => {
        expect(toFieldErrorMap([])).toEqual({})
    })
})
