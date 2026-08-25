import { useState } from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { TriggerConfigSection } from "./TriggerConfigSection"

function Harness({ initial = {}, providerSlug = "ttlock" }: {
    initial?: Record<string, unknown>
    providerSlug?: string
}) {
    const [params, setParams] = useState(initial)
    return <TriggerConfigSection params={params} setParams={setParams} providerSlug={providerSlug} />
}

describe("TriggerConfigSection — contrato backend", () => {
    it("no ofrece delay para triggers que el contrato declara sin delay", () => {
        render(<Harness initial={{ triggerTypes: ["on_checkin_completed"] }} />)

        expect(screen.queryByText("Espera")).not.toBeInTheDocument()
    })

    it("ofrece delay_minutes para on_physical_checkout", () => {
        render(<Harness initial={{ triggerTypes: ["on_physical_checkout"] }} />)

        expect(screen.getByText("Espera")).toBeInTheDocument()
    })

    it("no pide al PM un predecessor_automation_id interno que la API pública no expone", () => {
        render(<Harness />)

        expect(screen.getByRole("checkbox", { name: /Después de otra automatización/i })).toBeDisabled()
        expect(screen.getByText(/exige un ID interno que no expone/i)).toBeInTheDocument()
        expect(screen.queryByPlaceholderText("ID")).not.toBeInTheDocument()
    })

    it("fija SIRE en foreign_only y no permite seleccionar nacionales o todos", () => {
        render(<Harness providerSlug="sire_colombia" initial={{ guest_filter: "all" }} />)

        expect(screen.getByRole("button", { name: "Solo extranjeros" })).toBeDisabled()
        expect(screen.getByRole("button", { name: "Todos los huéspedes" })).toBeDisabled()
        expect(screen.getByText(/no reportar nacionales/i)).toBeInTheDocument()
    })
})
