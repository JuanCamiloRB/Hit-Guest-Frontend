import { describe, expect, it } from "vitest"
import { ApiError } from "@/types/api"
import { canUploadWaivedDocuments, describeWaiverUploadError } from "./waiver-document-upload"

const err = (status: number, body: Record<string, unknown>) => new ApiError(status, { message: "x", ...body } as never)

describe("canUploadWaivedDocuments", () => {
    it("solo con una exoneración activa", () => {
        expect(canUploadWaivedDocuments({ identityWaiver: { uuid: "w-1" } })).toBe(true)
        expect(canUploadWaivedDocuments({ identityWaiver: null })).toBe(false)
    })
})

describe("describeWaiverUploadError — cada error del contrato en su lugar", () => {
    it("validación por campo, en camelCase o snake_case", () => {
        expect(describeWaiverUploadError(err(422, { errors: { backImage: ["Falta el reverso."] } }))).toMatchObject({ back: "Falta el reverso.", front: null, refresh: false })
        expect(describeWaiverUploadError(err(422, { errors: { front_image: ["Formato inválido."] } }))).toMatchObject({ front: "Formato inválido." })
    })

    it("DOCUMENT_NOT_DETECTED marca la cara que falló", () => {
        expect(describeWaiverUploadError(err(422, { success: false, errorType: "DOCUMENT_NOT_DETECTED", failedFields: ["back"], message: "No hay documento." })))
            .toEqual({ front: null, back: "No hay documento.", form: null, refresh: false })
    })

    it("duplicado y servicio caído van como error general; el segundo aclara que las fotos siguen", () => {
        expect(describeWaiverUploadError(err(422, { success: false, errorType: "DUPLICATE_DOCUMENT", message: "Ya está cargada." })).form).toBe("Ya está cargada.")
        expect(describeWaiverUploadError(err(422, { success: false, errorType: "SERVICE_UNAVAILABLE", message: "No se pudo guardar." })).form)
            .toMatch(/No se pudo guardar\. Las fotos anteriores/)
    })

    it("422 con solo mensaje (exoneración revocada) y 404 (huésped fuera) piden refrescar", () => {
        expect(describeWaiverUploadError(err(422, { message: "No hay exoneración activa." }))).toMatchObject({ form: "No hay exoneración activa.", refresh: true })
        expect(describeWaiverUploadError(err(404, { message: "No está en la reserva." }))).toMatchObject({ refresh: true })
    })

    it("403 muestra el mensaje del backend sin refrescar", () => {
        expect(describeWaiverUploadError(err(403, { message: "No puedes editar esta reserva." }))).toEqual({
            front: null, back: null, form: "No puedes editar esta reserva.", refresh: false,
        })
    })
})
