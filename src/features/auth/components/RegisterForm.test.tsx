import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { RegisterForm } from "./RegisterForm"

const mocks = vi.hoisted(() => ({
    isSuccess: true,
}))

vi.mock("../hooks/use-register", () => ({
    useRegister: () => ({
        form: {},
        isLoading: false,
        isSuccess: mocks.isSuccess,
        registeredEmail: "persona@example.com",
        onRegister: vi.fn(),
        honeypotProps: {},
    }),
}))

vi.mock("@/features/auth/services/catalog-service", () => ({
    catalogService: {
        getPersonTypes: vi.fn().mockResolvedValue([]),
        getIdentificationTypes: vi.fn().mockResolvedValue([]),
        getCountries: vi.fn().mockResolvedValue([]),
    },
}))

beforeEach(() => {
    vi.clearAllMocks()
    mocks.isSuccess = true
})

describe("RegisterForm — cuenta creada", () => {
    /**
     * El alta no emite ningún código: el correo que llega es el de bienvenida.
     * Pedir un OTP acá encerraba al usuario esperando algo que nunca llega, con
     * la cuenta ya creada.
     */
    it("no pide ningún código: el registro no emite OTP", () => {
        render(<RegisterForm />)

        expect(screen.queryByLabelText(/código/i)).toBeNull()
        expect(screen.queryByRole("button", { name: /reenviar/i })).toBeNull()
        expect(screen.queryByRole("button", { name: /activar cuenta/i })).toBeNull()
    })

    it("cierra el alta con la bienvenida y una salida al login", () => {
        render(<RegisterForm />)

        expect(screen.getByRole("heading", { name: "¡Bienvenido a HIT Guest!" })).toHaveFocus()
        expect(screen.getByText("persona@example.com")).toBeInTheDocument()
        expect(screen.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", "/login")
    })

    /**
     * Dónde se emite el código es justo lo que la pantalla anterior hacía creer
     * mal, así que la corrección se afirma en un test.
     */
    it("dice que el código llega al iniciar sesión, no al registrarse", () => {
        render(<RegisterForm />)

        expect(screen.getByText(/Al iniciar sesión te enviaremos un código/i)).toBeInTheDocument()
    })
})
