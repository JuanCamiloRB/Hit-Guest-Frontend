import { describe, expect, it } from "vitest"
import type { CheckinPortalResponse } from "../types/checkin"
import { resolveIdentifyResume } from "./identify-resume"

const base = "/checkin/airbnb/listing/HM123"
const portalWith = (currentStep: string | undefined) => ({
    registeredGuests: [{ uuid: "g-1", verification: currentStep ? { currentStep } : undefined }],
}) as unknown as Pick<CheckinPortalResponse, "registeredGuests">

describe("resolveIdentifyResume — el «Continuar» del hub retoma, no reinicia", () => {
    it("sin guest_uuid o sin portal no hay nada que reanudar", () => {
        expect(resolveIdentifyResume(portalWith("form"), undefined, base)).toBeNull()
        expect(resolveIdentifyResume(null, "g-1", base)).toBeNull()
    })

    it("OTP pendiente va al desafío, nunca al formulario que exige el token", () => {
        expect(resolveIdentifyResume(portalWith("contact_challenge"), "g-1", base))
            .toBe(`${base}/contact-challenge?guest_uuid=g-1`)
    })

    it("verificación en curso vuelve a /verify; formulario o completado, al formulario", () => {
        expect(resolveIdentifyResume(portalWith("verification"), "g-1", base)).toBe(`${base}/verify?guest_uuid=g-1`)
        expect(resolveIdentifyResume(portalWith("form"), "g-1", base)).toBe(`${base}/guest?guest_uuid=g-1`)
        expect(resolveIdentifyResume(portalWith(undefined), "g-1", base)).toBe(`${base}/guest?guest_uuid=g-1`)
    })
})
