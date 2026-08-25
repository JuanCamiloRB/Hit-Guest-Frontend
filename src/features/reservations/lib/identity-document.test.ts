import { describe, it, expect } from "vitest"
import {
    EMPTY_IDENTITY_DOCUMENT,
    hasIdentityImages,
    mergeIdentityDocuments,
    readIdentityDocument,
    readIdentityOrigin,
    resolveDocumentUrl,
    type GuestIdentityDocument,
} from "./identity-document"

const STORAGE = "https://guest.hit.tools/storage/"

/**
 * Las combinaciones de `describe("combinaciones reales")` NO son inventadas: son
 * las observadas en `guest.hit.tools` el 2026-08-18 recorriendo las reservas de
 * la cuenta con el token del PM. Si el backend cambia el contrato, esto es lo
 * que lo detecta.
 */

describe("readIdentityOrigin", () => {
    it("distingue los tres estados, sin colapsar null en false", () => {
        expect(readIdentityOrigin(true)).toBe("otra-estancia")
        expect(readIdentityOrigin(false)).toBe("esta-estancia")
        // El caso que motiva la función: el backend dice "no puedo saberlo".
        // Leerlo como "de esta reserva" sería afirmar algo que él no afirma.
        expect(readIdentityOrigin(null)).toBe("desconocido")
        expect(readIdentityOrigin(undefined)).toBe("desconocido")
    })
})

describe("readIdentityDocument — combinaciones reales de producción", () => {
    it("huésped recurrente por OTP: la foto es de Didit y de otra estancia", () => {
        const doc = readIdentityDocument({
            identityDocument: {
                images: { front: "https://api/front", back: null },
                source: "guest",
                method: "otp",
                capturedBy: "didit",
                capturedAt: "2026-07-02 14:31:08",
                inheritedFromAnotherReservation: true,
            },
        }, STORAGE)

        // `method` y `capturedBy` NO son redundantes: así superó identidad ahora
        // vs. así se tomó la foto que se está viendo.
        expect(doc.method).toBe("otp")
        expect(doc.capturedBy).toBe("didit")
        expect(doc.origin).toBe("otra-estancia")
        expect(doc.back).toBeNull()
        expect(hasIdentityImages(doc)).toBe(true)
    })

    it("verificado por Didit en esta reserva, con frente y reverso", () => {
        const doc = readIdentityDocument({
            identityDocument: {
                images: { front: "https://api/front", back: "https://api/back" },
                method: "didit",
                capturedBy: "didit",
                inheritedFromAnotherReservation: false,
            },
        }, STORAGE)

        expect(doc.origin).toBe("esta-estancia")
        expect(doc.back).toBe("https://api/back")
    })

    it("verificación antigua sin correlación: origen desconocido y sin método", () => {
        const doc = readIdentityDocument({
            identityDocument: {
                images: { front: "https://api/front", back: "https://api/back" },
                method: null,
                capturedBy: null,
                capturedAt: null,
                inheritedFromAnotherReservation: null,
            },
        }, STORAGE)

        expect(doc.origin).toBe("desconocido")
        expect(doc.method).toBeNull()
        // Sin fecha no se renderiza fecha; nadie debe inventar un fallback.
        expect(doc.capturedAt).toBeNull()
        // Pero el backend SÍ respondió: no es lo mismo que no haber preguntado.
        expect(doc.isReported).toBe(true)
    })

    it("verificado por Didit pero sin imágenes: reportado y vacío a la vez", () => {
        const doc = readIdentityDocument({
            identityDocument: {
                images: { front: null, back: null },
                source: "none",
                method: "didit",
                capturedBy: "didit",
                capturedAt: "2026-08-14 08:35:01",
                inheritedFromAnotherReservation: true,
            },
        }, STORAGE)

        // Verificado y aun así sin imágenes: estado vacío legítimo, no un error.
        expect(hasIdentityImages(doc)).toBe(false)
        expect(doc.isReported).toBe(true)
        expect(doc.method).toBe("didit")
    })
})

describe("readIdentityDocument — precedencia de fuentes", () => {
    it("la clave nueva gana sobre la legacy cuando llegan las dos (ESTE ERA EL BUG)", () => {
        const doc = readIdentityDocument({
            identityDocument: {
                images: { front: "https://api/nueva-front", back: null },
                method: "textract-ocr",
            },
            reservationSpecificData: {
                documentImages: { front: "https://api/legacy-front", back: "https://api/legacy-back" },
            },
        }, STORAGE)

        expect(doc.front).toBe("https://api/nueva-front")
        // Frente y reverso salen del MISMO nivel: no se completa el reverso
        // faltante con el de la fuente legacy, que puede ser de otra captura.
        expect(doc.back).toBeNull()
    })

    it("sin la clave nueva sigue leyendo la legacy (no rompe reservas viejas)", () => {
        const doc = readIdentityDocument({
            reservationSpecificData: {
                documentImages: { front: "https://api/legacy-front", back: null },
            },
        }, STORAGE)

        expect(doc.front).toBe("https://api/legacy-front")
        // No hubo objeto `identityDocument`: no se puede afirmar metadata.
        expect(doc.isReported).toBe(false)
        expect(doc.origin).toBe("desconocido")
    })

    it("cae a pivot.extra y a la forma del portal", () => {
        expect(readIdentityDocument(
            { pivot: { extra: { document_images: { front: "docs/a.jpg" } } } },
            STORAGE,
        ).front).toBe(`${STORAGE}docs/a.jpg`)

        expect(readIdentityDocument(
            { documentImage1: "https://api/portal-front" },
            STORAGE,
        ).front).toBe("https://api/portal-front")
    })

    it("usa la clave nueva para la metadata aunque las imágenes vengan de la legacy", () => {
        const doc = readIdentityDocument({
            identityDocument: {
                images: { front: null, back: null },
                method: "didit",
                inheritedFromAnotherReservation: true,
            },
            reservationSpecificData: {
                documentImages: { front: "https://api/legacy-front" },
            },
        }, STORAGE)

        expect(doc.front).toBe("https://api/legacy-front")
        expect(doc.method).toBe("didit")
        expect(doc.origin).toBe("otra-estancia")
    })
})

describe("resolveDocumentUrl", () => {
    it("deja intacta la URL absoluta y prefija la ruta relativa", () => {
        expect(resolveDocumentUrl("https://api/x.jpg", STORAGE)).toBe("https://api/x.jpg")
        expect(resolveDocumentUrl("identity/x.jpg", STORAGE)).toBe(`${STORAGE}identity/x.jpg`)
    })

    it("no fabrica una URL desde vacío o desde un valor que no es texto", () => {
        expect(resolveDocumentUrl(null, STORAGE)).toBeNull()
        expect(resolveDocumentUrl("   ", STORAGE)).toBeNull()
        expect(resolveDocumentUrl(42, STORAGE)).toBeNull()
    })
})

describe("readIdentityDocument — tolerancia al contrato", () => {
    it("devuelve el vacío cuando no viene nada", () => {
        expect(readIdentityDocument(undefined, STORAGE)).toEqual(EMPTY_IDENTITY_DOCUMENT)
        expect(readIdentityDocument({}, STORAGE).isReported).toBe(false)
    })

    it("acepta snake_case en la metadata", () => {
        const doc = readIdentityDocument({
            identityDocument: {
                images: { front: "https://api/front" },
                captured_by: "textract-ocr",
                captured_at: "2026-08-01 10:00:00",
                inherited_from_another_reservation: true,
            },
        }, STORAGE)

        expect(doc.capturedBy).toBe("textract-ocr")
        expect(doc.capturedAt).toBe("2026-08-01 10:00:00")
        expect(doc.origin).toBe("otra-estancia")
    })

    it("descarta un método desconocido en vez de pintarlo crudo en la UI", () => {
        const doc = readIdentityDocument(
            { identityDocument: { images: {}, method: "proveedor_nuevo" } },
            STORAGE,
        )
        expect(doc.method).toBeNull()
        // Pero el backend respondió, así que eso no se pierde.
        expect(doc.isReported).toBe(true)
    })
})

describe("mergeIdentityDocuments", () => {
    const withImages: GuestIdentityDocument = {
        ...EMPTY_IDENTITY_DOCUMENT,
        front: "https://api/front",
        back: "https://api/back",
        method: "didit",
        isReported: true,
    }
    const reportedEmpty: GuestIdentityDocument = {
        ...EMPTY_IDENTITY_DOCUMENT,
        method: "didit",
        isReported: true,
    }

    it("gana el que tiene imágenes, entero", () => {
        const merged = mergeIdentityDocuments(reportedEmpty, { ...EMPTY_IDENTITY_DOCUMENT, front: "https://api/portal" })
        expect(merged.front).toBe("https://api/portal")
        // Entero: no se le injerta el `method` del otro, porque las imágenes y la
        // metadata tienen que describir la MISMA captura.
        expect(merged.method).toBeNull()
    })

    it("con ambos vacíos conserva el que sí fue reportado por el backend", () => {
        expect(mergeIdentityDocuments(reportedEmpty, EMPTY_IDENTITY_DOCUMENT).isReported).toBe(true)
    })

    it("tolera que falte cualquiera de los dos", () => {
        expect(mergeIdentityDocuments(undefined, withImages)).toBe(withImages)
        expect(mergeIdentityDocuments(withImages, undefined)).toBe(withImages)
        expect(mergeIdentityDocuments(undefined, undefined)).toEqual(EMPTY_IDENTITY_DOCUMENT)
    })
})
