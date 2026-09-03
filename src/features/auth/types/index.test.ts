import { describe, expect, it } from "vitest"
import { registerSchema } from "./index"

const validRegistration = {
    person_type_id: "1",
    identificationTypeId: "3",
    identificationNumber: "P123456",
    companyName: "",
    name: "Ana",
    lastname: "Torres",
    email: "  ANA@EXAMPLE.COM ",
    phone: "+573001234567",
    country: "1",
    state: "Victoria",
    city: "Melbourne",
}

describe("registerSchema", () => {
    it("acepta ids de país de un dígito y normaliza el correo", () => {
        const result = registerSchema.parse(validRegistration)

        expect(result.country).toBe("1")
        expect(result.email).toBe("ana@example.com")
    })
})
