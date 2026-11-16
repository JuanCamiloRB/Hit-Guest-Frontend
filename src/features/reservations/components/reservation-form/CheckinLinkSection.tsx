"use client"

import { useFormContext } from "react-hook-form"
import { Info, Send } from "lucide-react"
import { FormField, FormItem } from "@/components/ui/form"
import { Icon } from "@/components/ui/icon"
import { Note } from "@/components/ui/note"
import { SwitchField } from "@/components/ui/switch-field"
import { FormSection } from "./FormSection"
import type { ReservationFormInput } from "./payload"

/**
 * El interruptor «Enviar link después de crear». En edición se sigue viendo
 * (no se quita ningún campo) pero deshabilitado y apagado, con la razón:
 * guardar cambios nunca envió el link (antes se mostraba activo y no hacía nada).
 */
export function CheckinLinkSection({ mode }: { mode: "create" | "edit" }) {
    const form = useFormContext<ReservationFormInput>()
    const email = form.watch("emailGuest")
    const sendLinkNow = form.watch("sendLinkNow")

    if (mode === "edit") {
        return (
            <FormSection title="Envío del link">
                <Note as="div" tone="neutral" density="default">
                    <SwitchField
                        variant="plain"
                        label={<><Icon icon={Send} className="text-ink-3" />Enviar link después de guardar</>}
                        description={<span className="inline-flex items-start gap-1.5"><Icon icon={Info} size="sm" className="mt-0.5 text-ink-4" />Guardar cambios no vuelve a enviar el link. Se reenvía desde la ficha de la reserva.</span>}
                        checked={false}
                        disabled
                    />
                </Note>
            </FormSection>
        )
    }

    return (
        <FormSection title="Envío del link">
            <Note as="div" tone={sendLinkNow ? "accent" : "neutral"} density="default">
                <FormField
                    control={form.control}
                    name="sendLinkNow"
                    render={({ field }) => (
                        <FormItem>
                            <SwitchField
                                variant="plain"
                                label={<><Icon icon={Send} className={sendLinkNow ? "text-primary" : "text-ink-3"} />Enviar link después de crear</>}
                                description={sendLinkNow
                                    ? <>Lo recibe <span className="font-medium text-ink">{email || "el correo del huésped"}</span> en cuanto se cree la reserva.</>
                                    : "Podrás enviarlo después desde la ficha de la reserva."}
                                checked={field.value ?? false}
                                onCheckedChange={field.onChange}
                            />
                        </FormItem>
                    )}
                />
            </Note>
        </FormSection>
    )
}
