"use client"

import { useMemo, useState } from "react"
import { Loader2, Eye, FileText } from "lucide-react"
import { toast } from "sonner"
import { notifyError } from "@/lib/notify-error"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ApiError } from "@/types/api"
import { propertyDocumentService } from "../../services/property-document-service"
import {
    DOCUMENT_STATUS,
    documentTypeLabel,
    normalizeShortcodes,
    type DocumentType,
    type PropertyDocument,
} from "../../types/document"
import { DocumentEditor } from "./DocumentEditor"
import { DocumentPreviewModal } from "./DocumentPreviewModal"

interface DocumentFormModalProps {
    onClose: () => void
    propertyUuid: string
    types: DocumentType[]
    /** Existing document for edit mode; null for create. */
    document: PropertyDocument | null
    onSaved: (doc: PropertyDocument) => void
}

/**
 * Mounted only while open (parent guards with a `key`), so initial state is
 * derived directly from props — no open-sync effect needed.
 */
export function DocumentFormModal({
    onClose,
    propertyUuid,
    types,
    document,
    onSaved,
}: DocumentFormModalProps) {
    const isEdit = !!document

    const [typeId, setTypeId] = useState<number | null>(
        document ? document.documentType?.id ?? null : types[0]?.id ?? null,
    )
    const [statusId, setStatusId] = useState<number>(
        document?.statusRecord?.id ?? DOCUMENT_STATUS.ACTIVE,
    )
    const [content, setContent] = useState<string>(document?.content ?? "")
    const [saving, setSaving] = useState(false)
    const [fieldError, setFieldError] = useState<string | null>(null)
    const [previewOpen, setPreviewOpen] = useState(false)

    const selectedType = useMemo(
        () => types.find((t) => t.id === typeId) ?? null,
        [types, typeId],
    )
    const shortcodes = selectedType?.parameters?.shortcodes ?? []

    const handleSave = async () => {
        if (!typeId) {
            setFieldError("Selecciona un tipo de documento")
            return
        }
        setSaving(true)
        setFieldError(null)
        // Convert any human labels ({{ Nombre de la propiedad }}) back to real
        // shortcode keys ({{property_name}}) so the backend render can substitute them.
        const normalizedContent = normalizeShortcodes(content)
        try {
            const saved = isEdit
                ? await propertyDocumentService.update(propertyUuid, document!.uuid, {
                    statusRecordId: statusId,
                    content: normalizedContent,
                })
                : await propertyDocumentService.create(propertyUuid, {
                    propertyDocumentTypeId: typeId,
                    statusRecordId: statusId,
                    content: normalizedContent,
                })
            toast.success(isEdit ? "Documento actualizado" : "Documento creado")
            onSaved(saved)
            onClose()
        } catch (err) {
            if (err instanceof ApiError && err.status === 422) {
                const errors = err.errors
                const first = Array.isArray(errors)
                    ? errors.flatMap((e) => (typeof e === "string" ? [e] : Object.values(e).flat()))[0]
                    : undefined
                setFieldError(first || err.message || "Datos inválidos")
                toast.error("Revisa los campos del documento")
            } else if (err instanceof ApiError && err.status === 401) {
                notifyError(err, "No tienes permiso para realizar esta acción")
            } else {
                notifyError(err, "Error al guardar el documento")
            }
        } finally {
            setSaving(false)
        }
    }

    return (
        <>
            <Dialog open onOpenChange={(o) => !o && onClose()}>
                <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-[var(--color-brand-purple)]" />
                            {isEdit ? "Editar documento" : "Nuevo documento"}
                        </DialogTitle>
                        <DialogDescription>
                            Redacta el contenido usando las variables disponibles. Se reemplazarán con datos
                            reales de cada reserva al visualizar el documento.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 py-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                    Tipo de documento
                                </Label>
                                <Select
                                    value={typeId != null ? String(typeId) : ""}
                                    onValueChange={(v) => setTypeId(Number(v))}
                                    disabled={isEdit}
                                >
                                    <SelectTrigger className="bg-slate-50 border-slate-200">
                                        <SelectValue placeholder="Selecciona un tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {types.map((t) => (
                                            <SelectItem key={t.id} value={String(t.id)}>
                                                {documentTypeLabel(t)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {isEdit && (
                                    <p className="text-[11px] text-slate-400">
                                        El tipo no se puede cambiar después de crear el documento.
                                    </p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                    Estado
                                </Label>
                                <Select value={String(statusId)} onValueChange={(v) => setStatusId(Number(v))}>
                                    <SelectTrigger className="bg-slate-50 border-slate-200">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={String(DOCUMENT_STATUS.ACTIVE)}>Activo</SelectItem>
                                        <SelectItem value={String(DOCUMENT_STATUS.INACTIVE)}>Inactivo</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <DocumentEditor value={content} onChange={setContent} shortcodes={shortcodes} />

                        {fieldError && (
                            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                                {fieldError}
                            </p>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setPreviewOpen(true)}
                            className="gap-1.5"
                        >
                            <Eye size={15} />
                            Vista previa
                        </Button>
                        <div className="flex-1" />
                        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-[var(--color-brand-purple)] hover:bg-[var(--color-brand-purple)]/90 text-white font-bold"
                        >
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isEdit ? "Guardar cambios" : "Crear documento"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {previewOpen && (
                <DocumentPreviewModal
                    onClose={() => setPreviewOpen(false)}
                    propertyUuid={propertyUuid}
                    documentUuid={document?.uuid ?? null}
                    content={normalizeShortcodes(content)}
                    shortcodes={shortcodes}
                />
            )}
        </>
    )
}
