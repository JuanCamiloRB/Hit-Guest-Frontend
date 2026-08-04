import { describe, expect, it } from "vitest"
import { isAccessInstructionDocument } from "./AccessInstructionsPanel"
import type { PortalDocument } from "../types/checkin"

function document(type: string): PortalDocument {
    return { uuid: type, type, renderUrl: "/render", pdfUrl: "/pdf" }
}

describe("isAccessInstructionDocument", () => {
    it.each(["Instructions", "Instrucciones", "Access Instructions", "Instrucciones de llegada"])(
        "recognizes %s as access content",
        (type) => expect(isAccessInstructionDocument(document(type))).toBe(true),
    )

    it.each(["Agreement", "Rules", "Privacy Policy"])(
        "does not expose %s as access instructions",
        (type) => expect(isAccessInstructionDocument(document(type))).toBe(false),
    )
})
