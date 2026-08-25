"use client"

import Link from "next/link"
import { FileText, KeyRound, LockKeyhole, MapPinned } from "lucide-react"
import type { CheckinPortalResponse, PortalDocument } from "@/features/checkin/types/checkin"
import { SmartlockCodes } from "./SmartlockCodes"

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
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${unlocked ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                        {unlocked ? <MapPinned size={21} /> : <LockKeyhole size={21} />}
                    </span>
                    <div>
                        <h2 id="access-instructions-title" className="font-bold text-slate-900">
                            Instrucciones de acceso
                        </h2>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                            {unlocked
                                ? "Consúltalas cuando quieras volviendo a abrir este mismo link."
                                : "Estarán disponibles aquí cuando todos los huéspedes terminen su registro."}
                        </p>
                    </div>
                </div>

                {unlocked && (
                    <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                        {instructions.map((document) => (
                            <Link
                                key={document.uuid}
                                href={`/checkin/${portal.reservation.uuid}/documents/${document.uuid}`}
                                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 transition-colors hover:border-brand-purple/20 hover:bg-brand-purple/5"
                            >
                                <span className="flex min-w-0 items-center gap-3">
                                    <FileText size={17} className="shrink-0 text-brand-purple" />
                                    <span className="truncate text-sm font-semibold text-slate-700">
                                        {document.type || "Instrucciones"}
                                    </span>
                                </span>
                                <span className="shrink-0 text-xs font-bold text-brand-purple">Ver</span>
                            </Link>
                        ))}

                        {!hasAccessContent && (
                            <div className="flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-3 text-amber-800">
                                <KeyRound size={17} className="mt-0.5 shrink-0" />
                                <p className="text-xs leading-relaxed">
                                    El alojamiento todavía no ha publicado instrucciones o códigos para esta reserva.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {unlocked && codes.length > 0 && <SmartlockCodes codes={codes} />}
        </section>
    )
}
