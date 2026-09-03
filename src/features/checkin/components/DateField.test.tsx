import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { DateField } from "./DateField"

/** Arnés controlado: el mismo patrón padre-hijo que usan los formularios reales. */
function Harness({ initial = "", max }: { initial?: string; max?: string }) {
    const [value, setValue] = useState(initial)
    return (
        <>
            <DateField label="Fecha de nacimiento" required value={value} onChange={setValue} max={max} />
            <output data-testid="emitted">{value}</output>
        </>
    )
}

describe("DateField", () => {
    it("teclear 5 12 1983 compone 1983-12-05 con auto-avance y auto-cero", async () => {
        const user = userEvent.setup()
        render(<Harness />)

        // Todo se escribe de corrido sobre el primer campo: el foco avanza solo.
        await user.click(screen.getByRole("textbox", { name: /Día/ }))
        await user.keyboard("5121983")

        expect(screen.getByRole("textbox", { name: /Día/ })).toHaveValue("05")
        expect(screen.getByRole("textbox", { name: /Mes/ })).toHaveValue("12")
        expect(screen.getByRole("textbox", { name: /Año/ })).toHaveValue("1983")
        expect(screen.getByTestId("emitted")).toHaveTextContent("1983-12-05")
    })

    it("una fecha imposible avisa y emite vacío — nunca una fecha 'corregida'", async () => {
        const user = userEvent.setup()
        render(<Harness />)

        await user.click(screen.getByRole("textbox", { name: /Día/ }))
        await user.keyboard("30021990")

        expect(screen.getByRole("alert")).toHaveTextContent(/no existe/)
        expect(screen.getByTestId("emitted")).toHaveTextContent("")
    })

    it("hidrata desde el prefill del OCR sin que el huésped toque nada", () => {
        render(<Harness initial="1983-08-05" />)

        expect(screen.getByRole("textbox", { name: /Día/ })).toHaveValue("05")
        expect(screen.getByRole("textbox", { name: /Mes/ })).toHaveValue("08")
        expect(screen.getByRole("textbox", { name: /Año/ })).toHaveValue("1983")
    })

    it("respeta el tope de fecha no futura que ya tenía nacimiento", async () => {
        const user = userEvent.setup()
        render(<Harness max="2026-09-04" />)

        await user.click(screen.getByRole("textbox", { name: /Día/ }))
        await user.keyboard("01012030")

        expect(screen.getByRole("alert")).toHaveTextContent(/futura/)
        expect(screen.getByTestId("emitted")).toHaveTextContent("")
    })

    it("borrar en un segmento vacío devuelve el foco al anterior", async () => {
        const user = userEvent.setup()
        render(<Harness />)

        await user.click(screen.getByRole("textbox", { name: /Día/ }))
        await user.keyboard("512")
        // Estamos en Año (vacío): un backspace debe volver a Mes.
        await user.keyboard("{Backspace}")
        expect(screen.getByRole("textbox", { name: /Mes/ })).toHaveFocus()
    })
})

describe("DateField — sin regresión del contrato", () => {
    it("emite exactamente el formato del input nativo que reemplaza", async () => {
        const onChange = vi.fn()
        const user = userEvent.setup()
        render(<DateField label="Vencimiento del Documento" value="" onChange={onChange} />)

        await user.click(screen.getByRole("textbox", { name: /Día/ }))
        await user.keyboard("28092028")

        expect(onChange).toHaveBeenLastCalledWith("2028-09-28")
    })
})
