import { afterEach, describe, expect, it, vi } from "vitest"
import { act, render, waitFor } from "@testing-library/react"
import { toast } from "sonner"
import { Toaster } from "./sonner"

describe("Toaster", () => {
    afterEach(() => vi.unstubAllGlobals())

    it("se queda en claro aunque el sistema operativo esté en oscuro", async () => {
        // HitGuest solo soporta tema claro: un SO oscuro no debe oscurecer los toasts.
        vi.stubGlobal("matchMedia", (query: string) => ({
            matches: query.includes("dark"),
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }))
        render(<Toaster />)
        await act(async () => { toast("Guardado") })

        await waitFor(() => expect(document.querySelector("[data-sonner-toaster]")).not.toBeNull())
        expect(document.querySelector("[data-sonner-toaster]")).toHaveAttribute("data-sonner-theme", "light")
    })
})
