import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { CreditTransaction, TransactionsPage } from "../types"

const getTransactions = vi.fn()
vi.mock("../services/billing-service", () => ({
    billingService: { getTransactions: (...args: unknown[]) => getTransactions(...args) },
}))

import { TransactionHistory } from "./TransactionHistory"

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
