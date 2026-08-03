"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { notifyError } from "@/lib/notify-error"

interface Props {
    trigger: React.ReactNode
    /** Removes the integration; rejects on failure. */
    onConfirm: () => Promise<void>
}

/** Confirmation before removing the Kunas integration link. */
export function KunasDisconnectDialog({ trigger, onConfirm }: Props) {
    const [open, setOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    async function handleConfirm() {
        setIsDeleting(true)
        try {
            await onConfirm()
            toast.success("Integración desconectada")
            setOpen(false)
        } catch (error) {
            notifyError(error, "No se pudo desconectar la integración")
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>¿Desconectar KunasPMS?</DialogTitle>
                    <DialogDescription>
                        Se eliminará el vínculo con tu cuenta de KunasPMS. Las propiedades y
                        reservas ya importadas <strong>no se eliminan</strong> — solo se corta la
                        sincronización.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isDeleting}>
                        Cancelar
                    </Button>
                    <Button variant="destructive" onClick={handleConfirm} disabled={isDeleting} className="gap-2">
                        {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                        Desconectar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
