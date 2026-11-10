import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "./dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogTitle,
} from "./alert-dialog"
import { Sheet, SheetContent, SheetTitle } from "./sheet"

describe("Dialog", () => {
    it("cerrar se llama «Cerrar», tiene área táctil de 36 px y la X es decorativa", async () => {
        render(<Dialog open><DialogContent><DialogTitle>Editar</DialogTitle><DialogDescription>Detalle</DialogDescription></DialogContent></Dialog>)
        const close = await screen.findByRole("button", { name: "Cerrar" })
        expect(close).toHaveClass("size-9")
        expect(close.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
        expect(screen.getByText("Detalle")).toHaveClass("text-ink-2")
    })

    it("la superficie es la de Card con elevación alta, y en móvil tiene alto máximo con scroll", async () => {
        render(<Dialog open><DialogContent><DialogTitle>Editar</DialogTitle></DialogContent></Dialog>)
        const content = await screen.findByRole("dialog")
        expect(content).toHaveClass("bg-card", "text-ink", "border-rule", "rounded-xl", "shadow-lg", "max-h-[calc(100dvh-2rem)]", "overflow-y-auto")
        expect(content).not.toHaveClass("shadow-sm")
    })

    it("con la X, el título reserva su espacio; sin la X, no", async () => {
        const { rerender } = render(<Dialog open><DialogContent><DialogTitle>Un título largo</DialogTitle></DialogContent></Dialog>)
        expect(await screen.findByRole("dialog")).toHaveClass("[&_[data-slot=dialog-title]]:px-8")
        rerender(<Dialog open><DialogContent showCloseButton={false}><DialogTitle>Un título largo</DialogTitle></DialogContent></Dialog>)
        expect(screen.getByRole("dialog")).not.toHaveClass("[&_[data-slot=dialog-title]]:px-8")
    })

    it("un consumidor con su propio alto lo sobrescribe", async () => {
        render(<Dialog open><DialogContent className="max-h-[90vh]"><DialogTitle>Editar</DialogTitle></DialogContent></Dialog>)
        const content = await screen.findByRole("dialog")
        expect(content).toHaveClass("max-h-[90vh]")
        expect(content).not.toHaveClass("max-h-[calc(100dvh-2rem)]")
    })

    it("un layout propio con overflow-hidden (cuerpo con scroll interno) gana sobre el scroll por defecto", async () => {
        render(<Dialog open><DialogContent className="flex flex-col overflow-hidden p-0"><DialogTitle>Unidad</DialogTitle></DialogContent></Dialog>)
        const content = await screen.findByRole("dialog")
        expect(content).toHaveClass("overflow-hidden", "p-0")
        expect(content).not.toHaveClass("overflow-y-auto")
        expect(content).not.toHaveClass("p-6")
    })

    it("el botón de cerrar del pie también dice «Cerrar»", async () => {
        render(<Dialog open><DialogContent showCloseButton={false}><DialogTitle>Editar</DialogTitle><DialogFooter showCloseButton /></DialogContent></Dialog>)
        expect(await screen.findByRole("button", { name: "Cerrar" })).toBeInTheDocument()
    })

    it("el Sheet también se cierra con «Cerrar»", async () => {
        render(<Sheet open><SheetContent><SheetTitle>Usuarios</SheetTitle></SheetContent></Sheet>)
        expect(await screen.findByRole("button", { name: "Cerrar" })).toHaveClass("size-9")
    })
})

function AsyncConfirm({ onConfirm }: { onConfirm: () => Promise<void> }) {
    const [open, setOpen] = useState(true)
    const [pending, setPending] = useState(false)
    return (
        <AlertDialog open={open} onOpenChange={(next) => { if (!next && !pending) setOpen(false) }}>
            <AlertDialogContent>
                <AlertDialogTitle>¿Eliminar?</AlertDialogTitle>
                <AlertDialogDescription>Se elimina.</AlertDialogDescription>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        keepOpen
                        pending={pending}
                        pendingLabel="Eliminando…"
                        onClick={async () => {
                            setPending(true)
                            try { await onConfirm(); setOpen(false) } catch { /* queda abierto */ } finally { setPending(false) }
                        }}
                    >
                        Eliminar
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

describe("AlertDialogAction — acciones asíncronas", () => {
    it("keepOpen: el clic no cierra; en curso dice «Eliminando…», queda ocupada, se anuncia y no se repite", async () => {
        let finish!: () => void
        const onConfirm = vi.fn(() => new Promise<void>((resolve) => { finish = resolve }))
        const user = userEvent.setup()
        render(<AsyncConfirm onConfirm={onConfirm} />)

        await user.click(await screen.findByRole("button", { name: "Eliminar" }))
        const action = screen.getByRole("button", { name: "Eliminando…" })
        // Ocupada (aria-disabled), sin `disabled`: conserva el foco.
        expect(action).toHaveAttribute("aria-busy", "true")
        expect(action).toHaveAttribute("aria-disabled", "true")
        expect(action).not.toHaveAttribute("disabled")
        expect(action).toHaveFocus()
        expect(screen.getByRole("status")).toHaveTextContent("Eliminando…")
        expect(screen.getByRole("alertdialog")).toBeInTheDocument()
        await user.click(action)
        expect(onConfirm).toHaveBeenCalledTimes(1)

        finish()
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
    })

    it("si falla, el diálogo sigue abierto y la acción vuelve a estar disponible", async () => {
        const user = userEvent.setup()
        render(<AsyncConfirm onConfirm={() => Promise.reject(new Error("500"))} />)
        await user.click(await screen.findByRole("button", { name: "Eliminar" }))
        await waitFor(() => expect(screen.getByRole("button", { name: "Eliminar" })).toBeEnabled())
        expect(screen.getByRole("alertdialog")).toBeInTheDocument()
        expect(screen.getByRole("status")).toHaveTextContent("")
    })

    it("sin keepOpen se comporta como siempre: el clic cierra", async () => {
        function Simple() {
            const [open, setOpen] = useState(true)
            return (
                <AlertDialog open={open} onOpenChange={setOpen}>
                    <AlertDialogContent>
                        <AlertDialogTitle>¿Seguro?</AlertDialogTitle>
                        <AlertDialogDescription>Algo.</AlertDialogDescription>
                        <AlertDialogFooter><AlertDialogAction>Continuar</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )
        }
        const user = userEvent.setup()
        render(<Simple />)
        await user.click(await screen.findByRole("button", { name: "Continuar" }))
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
        expect(screen.queryByRole("status")).toBeNull()
    })

    it("pending sin keepOpen también se marca ocupada y muestra su texto (sin región de estado)", async () => {
        render(
            <AlertDialog open>
                <AlertDialogContent>
                    <AlertDialogTitle>¿Seguro?</AlertDialogTitle>
                    <AlertDialogDescription>Algo.</AlertDialogDescription>
                    <AlertDialogFooter><AlertDialogAction pending pendingLabel="Guardando…">Guardar</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>,
        )
        const busy = await screen.findByRole("button", { name: "Guardando…" })
        expect(busy).toHaveAttribute("aria-busy", "true")
        expect(screen.queryByRole("status")).toBeNull()
        // Ocupada: un clic no la repite ni cierra el diálogo.
        fireEvent.click(busy)
        expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    })

    it("AlertDialogContent usa la misma superficie de modal", async () => {
        render(
            <AlertDialog open>
                <AlertDialogContent>
                    <AlertDialogTitle>¿Seguro?</AlertDialogTitle>
                    <AlertDialogDescription>Algo.</AlertDialogDescription>
                </AlertDialogContent>
            </AlertDialog>,
        )
        const content = await screen.findByRole("alertdialog")
        expect(content).toHaveClass("bg-card", "border-rule", "rounded-xl", "shadow-lg", "overflow-y-auto")
        expect(screen.getByText("Algo.")).toHaveClass("text-ink-2")
    })

    it("aria-disabled explícito también bloquea: no ejecuta la acción ni cierra", async () => {
        const onClick = vi.fn()
        const user = userEvent.setup()
        render(
            <AlertDialog open>
                <AlertDialogContent>
                    <AlertDialogTitle>¿Seguro?</AlertDialogTitle>
                    <AlertDialogDescription>Algo.</AlertDialogDescription>
                    <AlertDialogFooter><AlertDialogAction aria-disabled onClick={onClick}>Continuar</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>,
        )
        const action = await screen.findByRole("button", { name: "Continuar" })
        expect(action).toHaveAttribute("aria-disabled", "true")
        await user.click(action)
        action.focus()
        await user.keyboard("{Enter}")
        expect(onClick).not.toHaveBeenCalled()
        expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    })
})

