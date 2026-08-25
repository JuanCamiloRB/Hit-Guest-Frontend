import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { WelcomeScreen } from "./WelcomeScreen"
import type { CheckinPortalResponse, RegisteredGuest } from "@/features/checkin/types/checkin"

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(),
}))

/**
 * Regression for the Didier report (20260805): the guest list rendered the name
 * side-by-side with the "Principal" badge and a "Continuar registro" button. At
 * 375px the row only has ~279px of usable width, so a 39-character name wrapped
 * one word per line (7 lines) with the button floating in the middle, and the
 * button duplicated the fixed bottom CTA (same href).
 */
const LONG_NAME = "Didier Alain Pascal Edmond"
const LONG_LASTNAME = "Van Den Hove"

const makePortal = (guests: RegisteredGuest[], totalGuestsAllowed = 2): CheckinPortalResponse => ({
    reservation: {
        uuid: "res-uuid",
        arrivalDate: "2026-08-10",
        departureDate: "2026-08-12",
        totalGuestsAllowed,
    },
    progress: {
        registered: guests.length,
        completed: guests.filter(g => g.isCompleted).length,
        isFullyCompleted: false,
    },
    registeredGuests: guests,
})

const mainGuest: RegisteredGuest = {
    uuid: "main-uuid",
    name: LONG_NAME,
    lastname: LONG_LASTNAME,
    isMain: true,
    isCompleted: false,
}

describe("WelcomeScreen guest list", () => {
    it("does not reconstruct full completion when the authoritative backend flag is false", () => {
        const completedMain: RegisteredGuest = { ...mainGuest, isCompleted: true }
        const portal = makePortal([completedMain], 1)
        portal.progress.completed = 1
        portal.progress.isFullyCompleted = false

        render(<WelcomeScreen portal={portal} basePath="/checkin/res-uuid" />)

        expect(screen.queryByRole("link", { name: /Ver Resumen de Check-in/i })).not.toBeInTheDocument()
        expect(screen.getByText("1/1 completados")).toBeInTheDocument()
    })

    it("renders the full long name in a single text node (no truncation, no per-word wrapping)", () => {
        render(<WelcomeScreen portal={makePortal([mainGuest])} basePath="/checkin/res-uuid" />)

        const name = screen.getByText(`${LONG_NAME} ${LONG_LASTNAME}`)
        expect(name).toBeInTheDocument()
        // The name owns the full row width: it must not be clipped by `truncate`.
        expect(name.className).not.toMatch(/\btruncate\b/)
        expect(name.className).toMatch(/break-words/)
    })

    it("does not duplicate the primary CTA inside the main guest row", () => {
        render(<WelcomeScreen portal={makePortal([mainGuest])} basePath="/checkin/res-uuid" />)

        expect(screen.queryByRole("link", { name: /Continuar registro/i })).not.toBeInTheDocument()
        // Single primary action: the fixed bottom CTA.
        const ctas = screen.getAllByRole("link", { name: /Continuar mi registro/i })
        expect(ctas).toHaveLength(1)
        expect(ctas[0]).toHaveAttribute("href", "/checkin/res-uuid/identify?guest_uuid=main-uuid")
    })

    it("shows the main guest state as a badge instead of a button", () => {
        render(<WelcomeScreen portal={makePortal([mainGuest])} basePath="/checkin/res-uuid" />)

        expect(screen.getByText("Principal")).toBeInTheDocument()
        expect(screen.getByText("Pendiente")).toBeInTheDocument()
    })

    it("locks secondary guests behind the main guest with a badge, not an action", () => {
        const secondary: RegisteredGuest = {
            uuid: "sec-uuid",
            name: "Ana",
            lastname: "García",
            isMain: false,
            isCompleted: false,
        }
        render(<WelcomeScreen portal={makePortal([mainGuest, secondary])} basePath="/checkin/res-uuid" />)

        expect(screen.getByText("Esperando al titular")).toBeInTheDocument()
        expect(screen.queryByRole("link", { name: /Registrar/i })).not.toBeInTheDocument()
    })

    it("renders the guest list as a named list — one item per guest and per empty slot", () => {
        // 1 known guest + 1 anonymous slot for a 2-guest reservation.
        render(<WelcomeScreen portal={makePortal([mainGuest], 2)} basePath="/checkin/res-uuid" />)

        // Scoped by accessible name: the "requisitos" box is also a <ul>, so an
        // unscoped listitem query would count its bullets too.
        const list = screen.getByRole("list", { name: "Huéspedes de la reserva" })
        expect(within(list).getAllByRole("listitem")).toHaveLength(2)
    })

    it("exposes register + share actions for secondaries once the main guest is done", () => {
        const completedMain: RegisteredGuest = { ...mainGuest, isCompleted: true }
        const secondary: RegisteredGuest = {
            uuid: "sec-uuid",
            name: "Ana",
            lastname: "García",
            isMain: false,
            isCompleted: false,
        }
        render(<WelcomeScreen portal={makePortal([completedMain, secondary])} basePath="/checkin/res-uuid" />)

        expect(screen.getByRole("link", { name: "Registrar" })).toHaveAttribute(
            "href",
            "/checkin/res-uuid/identify?guest_uuid=sec-uuid",
        )
        expect(screen.getByRole("button", { name: "Enviar link a Ana" })).toBeInTheDocument()
    })
})

/**
 * Una reserva cerrada devuelve el portal COMPLETO pero con
 * `checkinAllowed: false`, y el backend rechaza con 422 todo lo que escriba.
 * El campo no se leía en ninguna parte, así que la pantalla seguía ofreciendo
 * acciones que terminaban en ese 422.
 */
describe("WelcomeScreen con el registro cerrado (checkinAllowed: false)", () => {
    const completedMain: RegisteredGuest = { ...mainGuest, isCompleted: true }
    const pendingSecondary: RegisteredGuest = {
        uuid: "sec-uuid",
        name: "Ana",
        lastname: "García",
        isMain: false,
        isCompleted: false,
    }

    const closedPortal = (): CheckinPortalResponse => {
        const portal = makePortal([completedMain, pendingSecondary])
        return { ...portal, reservation: { ...portal.reservation, checkinAllowed: false } }
    }

    it("no ofrece registrar ni compartir link", () => {
        render(<WelcomeScreen portal={closedPortal()} basePath="/checkin/res-uuid" />)

        expect(screen.queryByRole("link", { name: "Registrar" })).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: "Enviar link a Ana" })).not.toBeInTheDocument()
    })

    it("explica por qué, en vez de dejar que el huésped choque con el error", () => {
        render(<WelcomeScreen portal={closedPortal()} basePath="/checkin/res-uuid" />)

        expect(screen.getByText(/el registro en línea está cerrado/i)).toBeInTheDocument()
    })

    it("sigue mostrando la reserva: quien ya completó necesita sus documentos", () => {
        render(<WelcomeScreen portal={closedPortal()} basePath="/checkin/res-uuid" />)

        expect(screen.getByText(`${LONG_NAME} ${LONG_LASTNAME}`)).toBeInTheDocument()
        expect(screen.getByText("Ana García")).toBeInTheDocument()
    })

    it("un backend viejo que no manda el campo se sigue tratando como abierto", () => {
        // `checkinAllowed` es opcional en el contrato — ausente NO significa cerrado.
        render(<WelcomeScreen portal={makePortal([completedMain, pendingSecondary])} basePath="/checkin/res-uuid" />)

        expect(screen.getByRole("link", { name: "Registrar" })).toBeInTheDocument()
    })
})

/**
 * Firma externa (TuFirma): el titular ya envió su formulario y `/main/complete`
 * respondió `pending_signature`, pero `isCompleted` NO pasa a `true` hasta que
 * llega el webhook. El hub lo mostraba idéntico a alguien que no había empezado
 * —"Pendiente" + "Continuar mi registro"— y lo devolvía al formulario, cuya
 * pantalla de contrato ya no tenía sus datos (se borran del localStorage al
 * enviar). La acción que resuelve el check-in está en su correo, no acá.
 */
describe("WelcomeScreen — titular esperando la firma externa de TuFirma", () => {
    const awaitingSignature = (): CheckinPortalResponse => ({
        ...makePortal([mainGuest], 1),
        contract: {
            signingProvider: "tufirma",
            status: "pending",
            hasNativeSignature: false,
            signedAt: null,
            signedContractUrl: null,
        },
    })

    it("no lo invita a continuar un registro que ya envió", () => {
        render(<WelcomeScreen portal={awaitingSignature()} basePath="/checkin/res-uuid" />)

        expect(screen.queryByRole("link", { name: /Continuar mi registro/i })).not.toBeInTheDocument()
    })

    it("lo lleva al estado de su firma, no de vuelta al formulario", () => {
        render(<WelcomeScreen portal={awaitingSignature()} basePath="/checkin/res-uuid" />)

        const cta = screen.getByRole("link", { name: /Ver estado de mi firma/i })
        expect(cta).toHaveAttribute("href", "/checkin/res-uuid/contract?guest_uuid=main-uuid")
    })

    it("distingue 'falta firmar' de 'pendiente' en la fila del titular", () => {
        render(<WelcomeScreen portal={awaitingSignature()} basePath="/checkin/res-uuid" />)

        expect(screen.getByText("Falta firmar")).toBeInTheDocument()
        expect(screen.queryByText("Pendiente")).not.toBeInTheDocument()
    })

    it("con el proveedor nativo el estado `pending` NO es una espera del huésped", () => {
        // Con firma nativa no hay correo que abrir: `pending` es el backend
        // terminando. Mandarlo a "ver el estado de su firma" lo dejaría esperando
        // algo que nunca le va a llegar.
        const portal: CheckinPortalResponse = {
            ...makePortal([mainGuest], 1),
            contract: {
                signingProvider: "hitguest_signature",
                status: "pending",
                hasNativeSignature: false,
                signedAt: null,
                signedContractUrl: null,
            },
        }
        render(<WelcomeScreen portal={portal} basePath="/checkin/res-uuid" />)

        expect(screen.getByRole("link", { name: /Continuar mi registro/i })).toBeInTheDocument()
        expect(screen.queryByText("Falta firmar")).not.toBeInTheDocument()
    })

    it("sin contrato configurado el hub se comporta como siempre", () => {
        render(<WelcomeScreen portal={makePortal([mainGuest], 1)} basePath="/checkin/res-uuid" />)

        expect(screen.getByRole("link", { name: /Continuar mi registro/i })).toBeInTheDocument()
    })
})
