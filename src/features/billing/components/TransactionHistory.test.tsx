import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { CreditTransaction, TransactionsPage } from "../types"

const getTransactions = vi.fn()
vi.mock("../services/billing-service", () => ({
    billingService: { getTransactions: (...args: unknown[]) => getTransactions(...args) },
}))

import { TransactionHistory } from "./TransactionHistory"
import { useLanguageStore } from "@/store/useLanguageStore"

function tx(over: Partial<CreditTransaction>): CreditTransaction {
    return {
        uuid: over.uuid ?? "t1",
        type: "debit",
        amount: 1.5,
        balanceAfter: 8.5,
        description: "Verificación de identidad",
        source: "automation",
        paymentGateway: null,
        status: "completed",
        createdAt: "2026-07-10T14:32:15+00:00",
        ...over,
    }
}

function page(data: CreditTransaction[]): TransactionsPage {
    return { data, currentPage: 1, lastPage: 1, perPage: 20, total: data.length, from: 1, to: data.length }
}

describe("TransactionHistory — la etiqueta sale del código que manda el backend", () => {
    beforeEach(() => getTransactions.mockReset())

    it("traduce los códigos conocidos de tipo, origen y estado", async () => {
        getTransactions.mockResolvedValue(page([
            tx({ uuid: "a", type: "credit", source: "trial", status: "completed" }),
            tx({ uuid: "b", type: "debit", source: "automation_refund", status: "refunded" }),
        ]))
        render(<TransactionHistory />)

        expect(await screen.findByText("Crédito")).toBeInTheDocument()
        expect(screen.getByText("Débito")).toBeInTheDocument()
        expect(screen.getByText("Prueba")).toBeInTheDocument()
        expect(screen.getByText("Reembolso")).toBeInTheDocument()
        expect(screen.getByText("Completada")).toBeInTheDocument()
        expect(screen.getByText("Reembolsada")).toBeInTheDocument()
        expect(screen.queryByText(/Credit|Debit|Completed|Refunded/)).toBeNull()
    })

    it("un código desconocido se muestra tal cual, sin hacerse pasar por otro", async () => {
        getTransactions.mockResolvedValue(page([
            // `type` está tipado como cerrado, pero el JSON puede traer un valor nuevo.
            tx({ type: "adjustment" as CreditTransaction["type"], source: "partner", status: "pending" }),
        ]))
        render(<TransactionHistory />)

        expect(await screen.findByText("adjustment")).toBeInTheDocument()
        expect(screen.getByText("partner")).toBeInTheDocument()
        expect(screen.getByText("pending")).toBeInTheDocument()
        expect(screen.queryByText("Completada")).toBeNull()
    })

    it("«Reintentar» vuelve a pedir la misma página", async () => {
        getTransactions
            .mockRejectedValueOnce(new Error("500"))
            .mockResolvedValueOnce(page([tx({ type: "credit" })]))
        render(<TransactionHistory />)

        await userEvent.click(await screen.findByRole("button", { name: "Reintentar" }))

        expect(await screen.findByText("Crédito")).toBeInTheDocument()
        expect(getTransactions).toHaveBeenCalledTimes(2)
        expect(getTransactions).toHaveBeenLastCalledWith(1)
    })
})

describe("TransactionHistory — el inglés queda listo para cuando se habilite", () => {
    beforeEach(() => getTransactions.mockReset())
    // `setState` directo: `setLanguage` todavía rechaza "en" porque no está en
    // AVAILABLE_LANGUAGES. La prueba fija que, al habilitarlo, el texto ya existe.
    afterEach(() => useLanguageStore.setState({ language: "es" }))

    it("con idioma en, las mismas etiquetas salen del diccionario en inglés", async () => {
        useLanguageStore.setState({ language: "en" })
        // Dos páginas: con una sola no hay pie que traducir (la tabla no pagina lo que cabe).
        getTransactions.mockResolvedValue({ ...page([
            tx({ type: "credit", source: "automation_refund", status: "refunded" }),
        ]), lastPage: 2, total: 21 })
        render(<TransactionHistory />)

        expect(await screen.findByText("Credit")).toBeInTheDocument()
        expect(screen.getByText("Refund")).toBeInTheDocument()
        expect(screen.getByText("Refunded")).toBeInTheDocument()
        expect(screen.getByText("Showing 1–1 of 21")).toBeInTheDocument()
        expect(screen.getByText("Page 1 of 2")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /Next/ })).toBeInTheDocument()
        expect(screen.getByText("Transaction history")).toBeInTheDocument()
    })
})

describe("TransactionHistory — tabla compartida con paginación del servidor", () => {
    beforeEach(() => getTransactions.mockReset())

    it("Siguiente pide la página 2 y deja la 1 a la vista mientras llega (nunca vuelve al esqueleto)", async () => {
        let release!: (value: TransactionsPage) => void
        getTransactions
            .mockResolvedValueOnce({ ...page([tx({ uuid: "a", description: "Primera página" })]), lastPage: 2, total: 21 })
            .mockReturnValueOnce(new Promise<TransactionsPage>((resolve) => { release = resolve }))
        render(<TransactionHistory />)
        expect(await screen.findByText("Primera página")).toBeInTheDocument()
        expect(screen.getByText("Mostrando 1–1 de 21")).toBeInTheDocument()

        await userEvent.click(screen.getByRole("button", { name: /Siguiente/ }))
        expect(getTransactions).toHaveBeenLastCalledWith(2)
        expect(screen.getByText("Primera página")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /Siguiente/ })).toBeDisabled()
        expect(screen.getByText("Actualizando…")).toBeInTheDocument()

        release({ data: [tx({ uuid: "b", description: "Segunda página" })], currentPage: 2, lastPage: 2, perPage: 20, total: 21, from: 21, to: 21 })
        expect(await screen.findByText("Segunda página")).toBeInTheDocument()
        expect(screen.getByText("Mostrando 21–21 de 21")).toBeInTheDocument()
    })
})

describe("TransactionHistory — una página que no llegó (auditoría 2026-11-20)", () => {
    beforeEach(() => getTransactions.mockReset())

    it("si la página 2 falla, se sigue viendo la 1 con el aviso y «Siguiente» vuelve a pedirla", async () => {
        getTransactions
            .mockResolvedValueOnce({ ...page([tx({ uuid: "a", description: "Primera página" })]), lastPage: 2, total: 21 })
            .mockRejectedValueOnce(new Error("500"))
            .mockResolvedValueOnce({ data: [tx({ uuid: "b", description: "Segunda página" })], currentPage: 2, lastPage: 2, perPage: 20, total: 21, from: 21, to: 21 })
        render(<TransactionHistory />)
        await screen.findByText("Primera página")
        await userEvent.click(screen.getByRole("button", { name: /Siguiente/ }))
        expect(await screen.findByText("No se pudo cargar el historial.")).toBeInTheDocument()
        expect(screen.getByText("Primera página")).toBeInTheDocument()
        await userEvent.click(screen.getByRole("button", { name: /Siguiente/ }))
        expect(await screen.findByText("Segunda página")).toBeInTheDocument()
        expect(getTransactions).toHaveBeenCalledTimes(3)
    })

    it("con una sola página no hay pie: como en todas las tablas, no se pagina lo que cabe", async () => {
        getTransactions.mockResolvedValue(page([tx({})]))
        render(<TransactionHistory />)
        await screen.findByText("Débito")
        expect(screen.queryByRole("button", { name: /Siguiente/ })).toBeNull()
        expect(screen.queryByText(/Página/)).toBeNull()
    })
})
