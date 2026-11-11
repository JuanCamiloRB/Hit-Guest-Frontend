"use client"

import Link from "next/link"
import { FileText, KeyRound, LockKeyhole, MapPinned } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import type { CheckinPortalResponse, PortalDocument } from "@/features/checkin/types/checkin"
import { SmartlockCodes } from "./SmartlockCodes"
import { Heading } from "@/components/ui/heading"
import { Surface } from "@/components/ui/card"
import { IconBadge } from "@/components/ui/icon-badge"

interface AccessInstructionsPanelProps {
    portal: CheckinPortalResponse
    unlocked: boolean
}

const ACCESS_DOCUMENT_TYPES = new Set([
    "instructions",
    "instruction",
    "instrucciones",
    "access instructions",
    "arrival instructions",
    "instrucciones de acceso",
    "instrucciones de llegada",
])

export function isAccessInstructionDocument(document: PortalDocument): boolean {
    // `documents` is supplied at runtime by the portal. A legacy/mixed record
    // without `type` must be ignored, not crash the entire success screen after
    // the guest has already signed and completed the check-in.
    if (typeof document.type !== "string") return false
    return ACCESS_DOCUMENT_TYPES.has(document.type.trim().toLowerCase())
}

/**
 * Persistent post-check-in module. It only renders data already authorized by
 * the check-in portal: active instruction documents and, when backend exposes
 * them after full completion, reservation smart-lock codes.
 */
export function AccessInstructionsPanel({ portal, unlocked }: AccessInstructionsPanelProps) {
    const instructions = (portal.documents ?? []).filter(isAccessInstructionDocument)
    const codes = portal.smartlockCodes ?? []
    const hasAccessContent = instructions.length > 0 || codes.length > 0

    return (
        <section aria-labelledby="access-instructions-title" className="w-full max-w-sm space-y-4 text-left">
            <Surface className="p-5">
                <div className="flex items-start gap-3">
                    <IconBadge icon={unlocked ? MapPinned : LockKeyhole} tone={unlocked ? "success" : "neutral"} size="md" shape="square" />
                    <div>
                        <Heading level={2} size="section" id="access-instructions-title">
                            Instrucciones de acceso
                        </Heading>
                        <p className="mt-1 text-xs leading-relaxed text-ink-3">
                            {unlocked
                                ? "Consúltalas cuando quieras volviendo a abrir este mismo link."
                                : "Estarán disponibles aquí cuando todos los huéspedes terminen su registro."}
                        </p>
                    </div>
                </div>

                {unlocked && (
                    <div className="mt-4 space-y-2 border-t border-rule pt-4">
                        {instructions.map((document) => (
                            <Link
                                key={document.uuid}
                                href={`/checkin/${portal.reservation.uuid}/documents/${document.uuid}`}
                                className="flex items-center justify-between gap-3 rounded-xl border border-rule bg-sunk/50 px-4 py-3 transition-colors hover:border-primary/20 hover:bg-primary/5"
                            >
                                <span className="flex min-w-0 items-center gap-3">
                                    <Icon icon={FileText} className="text-primary" />
                                    <span className="truncate text-sm font-semibold text-ink-2">
                                        {document.type || "Instrucciones"}
                                    </span>
                                </span>
                                <span className="shrink-0 text-xs font-bold text-primary">Ver</span>
                            </Link>
                        ))}

                        {!hasAccessContent && (
                            <div className="flex items-start gap-3 rounded-xl bg-warning-sunk px-4 py-3 text-warning">
                                <Icon icon={KeyRound} className="mt-0.5" />
                                <p className="text-xs leading-relaxed">
                                    El alojamiento todavía no ha publicado instrucciones o códigos para esta reserva.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </Surface>

            {unlocked && codes.length > 0 && <SmartlockCodes codes={codes} />}
        </section>
    )
}
