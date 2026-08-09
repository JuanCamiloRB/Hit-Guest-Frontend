import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { Sidebar } from "./Sidebar"

const mockUser = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }))
const mockPathname = vi.hoisted(() => ({ current: "/dashboard" }))

vi.mock("next/navigation", () => ({
    usePathname: () => mockPathname.current,
}))

vi.mock("@/features/auth/hooks/use-auth", () => ({
    useAuth: () => ({ user: mockUser.current, logout: vi.fn() }),
}))

beforeEach(() => {
    mockUser.current = { firstName: "Juan Camilo Rodriguez", isAccountOwner: true }
    mockPathname.current = "/dashboard"
})

describe("Sidebar", () => {
    // El color no se lee: sin aria-current, quien usa lector de pantalla no
    // tiene forma de saber en qué sección está.
    it("marca la sección actual con aria-current", () => {
        mockPathname.current = "/dashboard/reservations"
        render(<Sidebar />)

        expect(screen.getByRole("link", { name: "Operaciones" })).toHaveAttribute("aria-current", "page")
        expect(screen.getByRole("link", { name: "Tablero" })).not.toHaveAttribute("aria-current")
    })

    it("no marca Tablero como activo en una subruta del dashboard", () => {
        mockPathname.current = "/dashboard/properties"
        render(<Sidebar />)

        expect(screen.getByRole("link", { name: "Tablero" })).not.toHaveAttribute("aria-current")
        expect(screen.getByRole("link", { name: "Propiedades" })).toHaveAttribute("aria-current", "page")
    })

    it("agrupa la navegación en landmarks con nombre", () => {
        render(<Sidebar />)
        expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBeInTheDocument()
        expect(screen.getByRole("navigation", { name: "Sistema" })).toBeInTheDocument()
    })

    // Antes: "MENÚ PRINCIPAL" en una pastilla morada, el mismo color que el
    // ítem activo, compitiendo con lo único que sí se puede pulsar.
    it("ya no rotula el grupo principal con un texto redundante", () => {
        render(<Sidebar />)
        expect(screen.queryByText(/menú principal/i)).toBeNull()
    })

    describe("iniciales del perfil", () => {
        it("toma las dos primeras iniciales del nombre", () => {
            render(<Sidebar />)
            expect(screen.getByText("JC")).toBeInTheDocument()
        })

        // `"Juan  Camilo".split(' ')` da ["Juan","","Camilo"] y `""[0]` es
        // undefined, así que el avatar mostraba "JundefinedC".
        it("no se rompe con espacios dobles en el nombre", () => {
            mockUser.current = { firstName: "Juan  Camilo Rodriguez" }
            render(<Sidebar />)

            expect(screen.getByText("JC")).toBeInTheDocument()
            expect(screen.queryByText(/undefined/)).toBeNull()
        })

        it("cae a un nombre de marca cuando no hay usuario", () => {
            mockUser.current = null
            render(<Sidebar />)
            expect(screen.getByText("HIT Guest")).toBeInTheDocument()
        })
    })

    it("deja leer el nombre completo aunque se corte en pantalla", () => {
        render(<Sidebar />)
        const trigger = screen.getByRole("button", { name: /Juan Camilo Rodriguez/ })
        expect(trigger).toHaveAttribute("title", "Juan Camilo Rodriguez")
    })

    it("muestra el rol verificable del usuario", () => {
        render(<Sidebar />)
        expect(screen.getByText("Dueño de la cuenta")).toBeInTheDocument()
    })

    it("cae al correo cuando la persona no es dueña de la cuenta", () => {
        mockUser.current = { firstName: "Ana Torres", email: "ana@hit.tools" }
        render(<Sidebar />)

        expect(screen.getByText("ana@hit.tools")).toBeInTheDocument()
        expect(screen.queryByText("Dueño de la cuenta")).toBeNull()
    })

    it("lista las cuatro secciones del producto", () => {
        render(<Sidebar />)
        const principal = screen.getByRole("navigation", { name: "Navegación principal" })
        const labels = within(principal).getAllByRole("link").map((l) => l.textContent)

        expect(labels).toEqual(["Tablero", "Operaciones", "Propiedades"])
        expect(
            within(screen.getByRole("navigation", { name: "Sistema" })).getByRole("link"),
        ).toHaveTextContent("Configuración")
    })
})
