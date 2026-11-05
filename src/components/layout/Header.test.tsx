import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { Header } from "./Header"

const languages = vi.hoisted(() => ({ available: ["es"] as string[] }))

vi.mock("@/lib/i18n/dictionaries", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/i18n/dictionaries")>()
    return {
        ...actual,
        get AVAILABLE_LANGUAGES() { return languages.available },
    }
})
vi.mock("next/navigation", () => ({
    usePathname: () => "/dashboard",
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
vi.mock("@/features/auth/hooks/use-auth", () => ({
    useAuth: () => ({ user: { firstName: "Camila", isAccountOwner: true }, logout: vi.fn(), isInSupportSession: false }),
}))
vi.mock("@/features/billing/components/BalanceWidget", () => ({ BalanceWidget: () => null }))
vi.mock("@/features/support/hooks/useIsSupportAgentOnly", () => ({ useIsSupportAgentOnly: () => false }))

describe("Header — selector de idioma", () => {
    beforeEach(() => {
        languages.available = ["es"]
    })

    it("con un solo idioma disponible no ofrece selector (ni un «English» deshabilitado)", () => {
        render(<Header />)
        expect(screen.queryByRole("button", { name: "Idioma de la interfaz" })).toBeNull()
        expect(screen.queryByText(/English/)).toBeNull()
        expect(screen.queryByText("Próximamente")).toBeNull()
    })

    it("con un segundo idioma, el selector vuelve solo y lista los disponibles", async () => {
        languages.available = ["es", "en"]
        render(<Header />)
        const trigger = screen.getByRole("button", { name: "Idioma de la interfaz" })
        fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
        expect(await screen.findByRole("menuitem", { name: "Español (ES)" })).toBeInTheDocument()
        expect(screen.getByRole("menuitem", { name: "English (EN)" })).toBeInTheDocument()
    })
})
