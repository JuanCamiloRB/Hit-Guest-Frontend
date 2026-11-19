import { describe, expect, it, vi } from "vitest"
import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Reservation } from "@/types"
import type { AutomationStatusItem } from "@/features/properties/types/automation"
import { DataTable } from "@/components/shared/data-table"
import { readCheckinLinkDelivery } from "../lib/checkin-link-delivery-status"
import { readDigitalContract } from "../lib/automation-cells"

globalThis.ResizeObserver = globalThis.ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} }
const media = vi.hoisted(() => ({ small: false, listUsageRecords: vi.fn() }))
vi.mock("@/hooks/useMediaQuery", () => ({ SMALL_SCREEN_QUERY: "(max-width: 767px)", useMediaQuery: () => media.small }))
vi.mock("@/features/properties/services/automation-service", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/features/properties/services/automation-service")>()
    return { ...actual, automationService: { ...actual.automationService, listUsageRecords: media.listUsageRecords } }
})
import { resetLinkAttemptsMemory } from "../hooks/useLinkAttempts"

import { getColumns, ReservationMobileRow } from "./columns"

const statusItem = (providerSlug: string, automationName: string, status: AutomationStatusItem["status"], extra: Partial<AutomationStatusItem> = {}) => ({
    automationUuid: `${providerSlug}-${automationName}`, automationName, providerSlug, status,
    lastError: null, lastRunAt: null, usageRecordId: null, contractPdfPath: null, wasSuccessful: status === "completed",
    lastSuccessAt: null, requiresCheckin: null, redispatchRequiresCheckin: null, canManualDispatch: false,
    isPerGuest: false, guests: [], reservationCheckinCompleted: false, mainGuestCheckinCompleted: false,
    canDispatch: false, canRedispatch: false, ...extra,
}) as AutomationStatusItem

const ROW: Reservation = {
    id: "r1",
    guestName: "Laura Méndez",
    propertyId: "p1",
    propertyName: "Casa Mar",
    unitId: "u1",
    unitName: "Penthouse (PH-1)",
    checkIn: new Date(2026, 10, 19),
    checkOut: new Date(2026, 10, 22),
    nights: 3,
    status: "CONFIRMED",
    source: "Airbnb",
    sourceSlug: "airbnb",
    totalPrice: 0,
    totalGuests: 2,
    completedGuests: 1,
    isCheckinCompleted: false,
    automationStatus: { link: "none", checkin: "none", contract: "none", code: "none", tra: "none", sireIn: "none", sireOut: "none" },
    automationItems: [
        statusItem("whatsapp_checkin_link", "Check-in Link Delivery", "completed"),
        statusItem("textract", "Identity Verification - Main Guest", "completed"),
        statusItem("hitguest_signature", "Digital Signature for Contract", "completed"),
        statusItem("tra_colombia", "TRA Colombia", "failed", { lastRunAt: "2026-11-18 10:42:00", lastError: "El RNT no coincide con la propiedad" }),
        statusItem("sire_colombia", "SIRE Colombia — Check-in", "not_started"),
    ],
    checkinLinkDelivery: readCheckinLinkDelivery({
        checkinLinkSentAt: "2026-11-18T15:42:00Z", mailDeliveryStatus: "delivered",
        checkinLinkWhatsappSentAt: "2026-11-18T15:42:00Z", whatsappDeliveryStatus: "read",
    }),
    digitalContract: readDigitalContract({ digitalContract: { provider: "hitguest", status: "completed", signedAt: "2026-11-18 11:05:00", contractType: "agreement_only" } }),
}

const renderTable = (rows: Reservation[] = [ROW]) => render(<DataTable columns={getColumns()} data={rows} />)

describe("Operaciones — celdas de automatización", () => {
    it("encabezados agrupados: «Automatizaciones» sobre 4 columnas y «Reportes» sobre 4 (con el PDF)", () => {
        renderTable()
        expect(screen.getByRole("columnheader", { name: "Automatizaciones" })).toHaveAttribute("colspan", "4")
        expect(screen.getByRole("columnheader", { name: "Reportes" })).toHaveAttribute("colspan", "4")
    })

    it("cada celda dice su estado en el nombre accesible, con la marca de forma del tono", () => {
        renderTable()
        expect(screen.getByRole("button", { name: "Link: enviado por WhatsApp y correo" })).toHaveAttribute("data-tone", "success")
        expect(screen.getByRole("button", { name: "Check-in: 1 de 2 huéspedes completaron el check-in" })).toHaveAttribute("data-tone", "warning")
        expect(screen.getByRole("button", { name: "Contrato: firmado" })).toHaveAttribute("data-tone", "success")
        expect(screen.getByRole("button", { name: "TRA: falló" })).toHaveAttribute("data-tone", "danger")
        // Configurada pero sin correr: no es «—».
        expect(screen.getByRole("button", { name: "SIRE in: todavía no corre" })).toHaveAttribute("data-tone", "idle")
        // No configuradas: «—», sin detalle que abrir.
        expect(screen.getByRole("button", { name: "Acceso: no configurado" })).toBeDisabled()
        expect(screen.getByRole("button", { name: "SIRE out: no configurado" })).toBeDisabled()
        expect(screen.getByRole("button", { name: "PDF: no configurado" })).toBeDisabled()
    })

    it("el contador va en la celda y el link muestra sus canales en lugar del ícono", () => {
        renderTable()
        expect(screen.getByRole("button", { name: /^Check-in:/ })).toHaveTextContent("1/2")
        const link = screen.getByRole("button", { name: /^Link:/ })
        expect([...link.querySelectorAll('[data-slot="delivery-channel"]')].map((n) => n.getAttribute("data-channel"))).toEqual(["whatsapp", "email"])
    })

    it("el detalle abre al enfocar con teclado y dice qué se firmó, con quién y cuándo", async () => {
        const user = userEvent.setup()
        renderTable()
        const contract = screen.getByRole("button", { name: "Contrato: firmado" })
        await act(async () => { contract.focus() })
        expect(await screen.findByText("Contrato de alquiler · firmado · 18 nov, 11:05")).toBeInTheDocument()
        expect(screen.getByText("Firma nativa de HitGuest")).toBeInTheDocument()
        await user.keyboard("{Escape}")
        expect(screen.queryByText("Firma nativa de HitGuest")).toBeNull()
    })

    it("el detalle de un fallo dice cuándo y por qué", async () => {
        renderTable()
        await act(async () => { screen.getByRole("button", { name: "TRA: falló" }).focus() })
        expect(await screen.findByText("Falló · 18 nov, 10:42: El RNT no coincide con la propiedad")).toBeInTheDocument()
    })

    it("la columna del huésped queda fija al desplazar la tabla", () => {
        renderTable()
        expect(screen.getByRole("columnheader", { name: /Huésped/ })).toHaveClass("sticky", "left-0")
        expect(screen.getByRole("link", { name: "Laura Méndez" }).closest("td")).toHaveClass("sticky", "left-0")
    })

    it("todas las celdas miden lo mismo (el ancho ya no depende del texto)", () => {
        renderTable()
        const tiles = document.querySelectorAll('[data-slot="status-tile"]')
        expect(tiles).toHaveLength(8)
        tiles.forEach((tile) => expect(tile).toHaveClass("w-16", "h-8"))
    })

    it("móvil: la fila apilada lleva las ocho celdas con su nombre escrito debajo", () => {
        render(<ReservationMobileRow reservation={ROW} />)
        const list = screen.getByRole("list", { name: "Automatizaciones y reportes" })
        const items = within(list).getAllByRole("listitem")
        expect(items.map((li) => li.textContent?.trim())).toEqual(expect.arrayContaining(["Link", "SIRE out", "PDF"]))
        expect(items).toHaveLength(8)
        expect(screen.getByRole("link", { name: "Laura Méndez" })).toHaveAttribute("href", "/dashboard/reservations/r1")
        expect(screen.getByRole("button", { name: "Acciones de la reserva de Laura Méndez" })).toBeInTheDocument()
        // El logo es decorativo: el nombre del canal va al lado; sin canal, se dice.
        expect(screen.getByText("Airbnb")).toBeInTheDocument()
    })

    it("móvil sin canal: «Origen no informado», como en escritorio", () => {
        render(<ReservationMobileRow reservation={{ ...ROW, source: null, sourceSlug: null }} />)
        expect(screen.getByText("Origen no informado")).toBeInTheDocument()
    })

    it("DataTable en móvil usa la fila apilada cuando se le pasa", async () => {
        media.small = true
        render(<DataTable columns={getColumns()} data={[ROW]} renderMobileRow={(r) => <ReservationMobileRow reservation={r} />} />)
        await act(async () => {})
        expect(screen.queryByRole("table")).toBeNull()
        expect(screen.getByRole("list", { name: "Automatizaciones y reportes" })).toBeInTheDocument()
        media.small = false
    })
})

describe("Operaciones — el detalle del Link dice por dónde salió y por qué no salió por los otros canales", () => {
    const linkRecord = (channel: "whatsapp" | "ota_inbox" | null, payload: Record<string, unknown> | null, status: "completed" | "failed" = "completed") => ({
        id: 1, status, triggeredBy: null, automationUuid: "whatsapp_checkin_link-Check-in Link Delivery", automationName: "Check-in Link Delivery",
        providerSlug: "whatsapp_checkin_link", guestUuid: null, billable: false, unitCost: null, lastError: null,
        responsePayload: payload, channel, createdAt: "2026-11-18 10:40:00", updatedAt: "2026-11-18 10:40:00",
    })

    it("correo y OTA enviados, WhatsApp saltado: el detalle lo dice con el motivo (pedido al abrir, una sola vez, filtrado por la automatización)", async () => {
        resetLinkAttemptsMemory()
        media.listUsageRecords.mockReset().mockResolvedValue([linkRecord("whatsapp", { skipped: true, reason: "no_whatsapp_phone" })])
        const row: Reservation = {
            ...ROW,
            checkinLinkDelivery: readCheckinLinkDelivery({
                checkinLinkSentAt: "2026-11-18T15:42:00Z", checkinLinkSentTo: "laura@correo.com", mailDeliveryStatus: "delivered",
                checkinLinkOtaSentAt: "2026-11-18T15:42:00Z", checkinLinkOtaVia: "calry",
            }),
        }
        renderTable([row])
        // Nada se pide sin abrir el detalle.
        expect(media.listUsageRecords).not.toHaveBeenCalled()
        const link = screen.getByRole("button", { name: /^Link:/ })
        await act(async () => { link.focus() })
        expect(await screen.findByText("WhatsApp · no se envió · 18 nov, 10:40: la reserva no tiene un teléfono utilizable")).toBeInTheDocument()
        expect(screen.getByText("Correo · entregado · 18 nov, 10:42 · a laura@correo.com")).toBeInTheDocument()
        expect(screen.getByText("Mensaje en la OTA · publicado · 18 nov, 10:42 · vía Calry")).toBeInTheDocument()
        expect(media.listUsageRecords).toHaveBeenCalledTimes(1)
        expect(media.listUsageRecords.mock.calls[0][0]).toBe("r1")
        expect(media.listUsageRecords.mock.calls[0][1]).toBe("whatsapp_checkin_link-Check-in Link Delivery")
        // Cerrar y volver a abrir: no se vuelve a pedir.
        await act(async () => { link.blur() })
        await act(async () => { link.focus() })
        await screen.findByText(/WhatsApp · no se envió/)
        expect(media.listUsageRecords).toHaveBeenCalledTimes(1)
    })

    it("si el historial no responde, se dice que puede faltar algún canal (sin inventarlo)", async () => {
        resetLinkAttemptsMemory()
        media.listUsageRecords.mockReset().mockRejectedValue(new Error("503"))
        renderTable([ROW])
        await act(async () => { screen.getByRole("button", { name: /^Link:/ }).focus() })
        expect(await screen.findByText("No se pudo leer el historial de envíos: puede haber canales que no aparecen aquí.")).toBeInTheDocument()
    })

    it("sin automatización de envío no se pide nada: la reserva envía solo por correo y se dice", async () => {
        resetLinkAttemptsMemory()
        media.listUsageRecords.mockReset()
        renderTable([{ ...ROW, automationItems: ROW.automationItems!.filter((i) => i.providerSlug !== "whatsapp_checkin_link"), checkinLinkDelivery: readCheckinLinkDelivery({ checkinLinkSentAt: "2026-11-18T15:42:00Z" }) }])
        await act(async () => { screen.getByRole("button", { name: /^Link:/ }).focus() })
        expect(await screen.findByText("Esta reserva envía el link solo por correo: no tiene WhatsApp ni OTA activos")).toBeInTheDocument()
        expect(media.listUsageRecords).not.toHaveBeenCalled()
    })
})

describe("Operaciones — ancho: columnas que la cuenta usa y celdas compactas", () => {
    it("getColumns con cellKeys oculta las columnas que nadie usa y no dibuja un grupo vacío", () => {
        render(<DataTable columns={getColumns({ cellKeys: ["link", "checkin", "contract"] })} data={[ROW]} />)
        expect(screen.getByRole("columnheader", { name: "Automatizaciones" })).toHaveAttribute("colspan", "3")
        expect(screen.queryByRole("columnheader", { name: "Reportes" })).toBeNull()
        expect(screen.queryByRole("button", { name: /^TRA:/ })).toBeNull()
        expect(document.querySelectorAll('[data-slot="status-tile"]')).toHaveLength(3)
    })

    it("un contador de cuatro caracteres o más («0/13») va sin el ícono para caber en 64 px; «1/2» lo lleva", () => {
        const { unmount } = render(<DataTable columns={getColumns()} data={[{ ...ROW, completedGuests: 0, totalGuests: 13 }]} />)
        const tile = screen.getByRole("button", { name: /^Check-in:/ })
        expect(tile).toHaveTextContent("0/13")
        expect(tile.querySelector(".lucide-users")).toBeNull()
        unmount()
        renderTable()
        expect(screen.getByRole("button", { name: /^Check-in:/ }).querySelector(".lucide-users")).not.toBeNull()
    })

    it("Acciones solo ocupa su botón: el encabezado es para lectores de pantalla", () => {
        renderTable()
        const header = screen.getByRole("columnheader", { name: "Acciones" })
        expect(header.querySelector(".sr-only")).toHaveTextContent("Acciones")
    })

    it("una verificación de identidad fallida pone Check-in en rojo (decisión 2026-11-19)", () => {
        const items = [...ROW.automationItems!.filter((i) => i.providerSlug !== "textract"), statusItem("didit", "Identity Verification - Main Guest", "failed")]
        renderTable([{ ...ROW, automationItems: items }])
        expect(screen.getByRole("button", { name: "Check-in: 1 de 2 huéspedes completaron el check-in; una verificación de identidad falló" })).toHaveAttribute("data-tone", "danger")
    })
})
