import { act } from "@testing-library/react"
import { startOfMonth } from "date-fns"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MonthSelector } from "./MonthSelector"

const noop = () => {}
const selector = () => <MonthSelector value={startOfMonth(new Date())} onChange={noop} />

describe("MonthSelector — el HTML estático no fija el mes del build", () => {
    afterEach(() => {
        vi.useRealTimers()
        document.body.innerHTML = ""
    })

    it("un despliegue de noviembre abierto en diciembre hidrata sin error y muestra diciembre", async () => {
        vi.useFakeTimers({ toFake: ["Date"] })

        // Build: `/dashboard` es una ruta estática, su HTML sale con esta fecha.
        vi.setSystemTime(new Date(2026, 10, 20))
        const html = renderToString(selector())
        expect(html).not.toContain("noviembre")

        // Navegador: otro mes.
        vi.setSystemTime(new Date(2026, 11, 3))
        const container = document.createElement("div")
        container.innerHTML = html
        document.body.appendChild(container)
        const onRecoverableError = vi.fn()
        await act(async () => {
            hydrateRoot(container, selector(), { onRecoverableError })
        })

        expect(onRecoverableError).not.toHaveBeenCalled()
        expect(container).toHaveTextContent("diciembre 2026")
        expect(container.querySelector('[aria-label="Mes siguiente"]')).toBeDisabled()
    })
})
