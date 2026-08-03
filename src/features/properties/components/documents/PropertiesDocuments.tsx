"use client"

import { useCallback, useEffect, useState } from "react"
import { useFormContext } from "react-hook-form"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
    FileText,
    Plus,
    Loader2,
    Pencil,
    Trash2,
    RotateCcw,
    Info,
    Filter,
    Eye,
} from "lucide-react"
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { notifyError } from "@/lib/notify-error"
import { cn } from "@/lib/utils"
import { ApiError } from "@/types/api"
import { propertyDocumentService } from "../../services/property-document-service"
import {
    AGREEMENT_DOCUMENT_TYPE_ID,
    DOCUMENT_STATUS,
    documentTypeLabel,
    type DocumentType,
    type PropertyDocument,
} from "../../types/document"
import { DocumentFormModal } from "./DocumentFormModal"
import { DocumentPreviewModal } from "./DocumentPreviewModal"
import { ContractRoutingSection } from "../contracts/ContractRoutingSection"

export function PropertiesDocuments() {
    const { watch } = useFormContext()
    const propertyUuid: string | undefined = watch("uuid")

    const [types, setTypes] = useState<DocumentType[]>([])
    const [documents, setDocuments] = useState<PropertyDocument[]>([])
    const [loading, setLoading] = useState(false)
    const [typeFilter, setTypeFilter] = useState<string>("ALL")

    const [formOpen, setFormOpen] = useState(false)
    const [editing, setEditing] = useState<PropertyDocument | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<PropertyDocument | null>(null)
    const [deleting, setDeleting] = useState(false)
    const [previewDoc, setPreviewDoc] = useState<PropertyDocument | null>(null)

    // Load document types once.
    useEffect(() => {
        propertyDocumentService.getTypes().then(setTypes).catch(() => setTypes([]))
    }, [])

    // Agreement (type 92) is now owned end-to-end by ContractRoutingSection —
    // its create/update/delete lifecycle must stay in lockstep with the Digital
    // Contract automation's by_source (backend plan §1.4), which this generic
    // form has no notion of. Excluded from the filter, the list and "Nuevo
    // documento" so there is exactly one place that manages it, not two racing.
    const manageableTypes = types.filter((t) => t.id !== AGREEMENT_DOCUMENT_TYPE_ID)
    const visibleDocuments = documents.filter((d) => d.documentType?.id !== AGREEMENT_DOCUMENT_TYPE_ID)

    const loadDocuments = useCallback(async () => {
        if (!propertyUuid) return
        setLoading(true)
        try {
            const { items } = await propertyDocumentService.list(propertyUuid, {
                propertyDocumentTypeId:
                    typeFilter !== "ALL" ? Number(typeFilter) : undefined,
                perPage: 50,
            })
            setDocuments(items)
        } finally {
            setLoading(false)
        }
    }, [propertyUuid, typeFilter])

    useEffect(() => {
        loadDocuments()
    }, [loadDocuments])

    const handleSaved = (saved: PropertyDocument) => {
        setDocuments((prev) => {
            const exists = prev.some((d) => d.uuid === saved.uuid)
            return exists ? prev.map((d) => (d.uuid === saved.uuid ? saved : d)) : [saved, ...prev]
        })
    }

    const handleDelete = async () => {
        if (!deleteTarget || !propertyUuid) return
        setDeleting(true)
        try {
            await propertyDocumentService.remove(propertyUuid, deleteTarget.uuid)
            toast.success("Documento eliminado")
            // Reflect soft-delete locally
            setDocuments((prev) =>
                prev.map((d) =>
                    d.uuid === deleteTarget.uuid
                        ? { ...d, deletedAt: new Date().toISOString() }
                        : d,
                ),
            )
            setDeleteTarget(null)
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                notifyError(err, "No tienes permiso para eliminar documentos")
            } else {
                notifyError(err, "Error al eliminar el documento")
            }
        } finally {
            setDeleting(false)
        }
    }

    const handleRestore = async (doc: PropertyDocument) => {
        if (!propertyUuid) return
        try {
            const restored = await propertyDocumentService.restore(propertyUuid, doc.uuid)
            toast.success("Documento restaurado")
            setDocuments((prev) => prev.map((d) => (d.uuid === doc.uuid ? restored : d)))
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                notifyError(err, "No tienes permiso para restaurar documentos")
            } else {
                notifyError(err, "Error al restaurar el documento")
            }
        }
    }

    const openCreate = () => {
        setEditing(null)
        setFormOpen(true)
    }
    const openEdit = (doc: PropertyDocument) => {
        setEditing(doc)
        setFormOpen(true)
    }

    return (
        <div className="space-y-6">
            <Card className="border-none shadow-none bg-transparent">
                <CardHeader className="px-0 pt-0">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <div className="p-2 bg-[var(--color-brand-purple)]/10 rounded-lg">
                                    <FileText className="h-5 w-5 text-[var(--color-brand-purple)]" />
                                </div>
                                <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
                                    Documentos
                                </CardTitle>
                            </div>
                            <CardDescription className="text-base text-slate-500">
                                Contratos, reglamentos, instrucciones y políticas con variables que se
                                completan automáticamente por reserva.
                            </CardDescription>
                        </div>
                        {propertyUuid && (
                            <Button
                                type="button"
                                onClick={openCreate}
                                className="bg-[var(--color-brand-purple)] hover:bg-[var(--color-brand-purple)]/90 text-white font-bold gap-1.5"
                            >
                                <Plus size={16} /> Nuevo documento
                            </Button>
                        )}
                    </div>
                </CardHeader>
            </Card>

            {!propertyUuid ? (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                    <Info size={18} className="text-amber-500 shrink-0" />
                    <p className="text-sm text-amber-700">
                        Guarda la propiedad primero para gestionar sus documentos.
                    </p>
                </div>
            ) : (
                <>
                    <ContractRoutingSection propertyUuid={propertyUuid} />

                    {/* Filter */}
                    {manageableTypes.length > 0 && (
                        <div className="flex items-center gap-2">
                            <Filter size={15} className="text-slate-400" />
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="h-9 w-56 text-sm bg-white border-slate-200">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Todos los tipos</SelectItem>
                                    {manageableTypes.map((t) => (
                                        <SelectItem key={t.id} value={String(t.id)}>
                                            {documentTypeLabel(t)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center py-12 gap-3 text-slate-400">
                            <Loader2 size={22} className="animate-spin" />
                            <span className="text-sm">Cargando documentos...</span>
                        </div>
                    ) : visibleDocuments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 py-14 text-center">
                            <div className="rounded-full bg-slate-50 p-3 text-slate-300">
                                <FileText size={24} />
                            </div>
                            <p className="text-sm text-slate-500">
                                Aún no hay documentos para esta propiedad.
                            </p>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={openCreate}
                                className="mt-2 gap-1.5"
                            >
                                <Plus size={15} /> Crear el primero
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {visibleDocuments.map((doc) => {
                                const isDeleted = !!doc.deletedAt
                                const isActive = doc.statusRecord?.id === DOCUMENT_STATUS.ACTIVE
                                return (
                                    <div
                                        key={doc.uuid}
                                        className={cn(
                                            "flex items-center justify-between gap-4 rounded-xl border p-4 transition-all",
                                            isDeleted
                                                ? "border-slate-200 bg-slate-50/60 opacity-70"
                                                : "border-slate-200 bg-white hover:shadow-sm",
                                        )}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="p-2.5 bg-slate-50 rounded-xl text-[var(--color-brand-purple)] shrink-0">
                                                <FileText size={18} />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="font-bold text-slate-800 truncate">
                                                        {documentTypeLabel(doc.documentType)}
                                                    </h4>
                                                    {isDeleted ? (
                                                        <Badge variant="outline" className="h-5 text-[10px] uppercase font-bold bg-slate-100 text-slate-500 border-slate-200">
                                                            Eliminado
                                                        </Badge>
                                                    ) : (
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                "h-5 text-[10px] uppercase font-bold",
                                                                isActive
                                                                    ? "bg-green-50 text-green-600 border-green-200"
                                                                    : "bg-slate-100 text-slate-500 border-slate-200",
                                                            )}
                                                        >
                                                            {isActive ? "Activo" : "Inactivo"}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    Actualizado{" "}
                                                    {doc.updatedAt
                                                        ? format(new Date(doc.updatedAt), "d MMM yyyy, HH:mm", { locale: es })
                                                        : "—"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {isDeleted ? (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleRestore(doc)}
                                                    className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                                >
                                                    <RotateCcw size={14} /> Restaurar
                                                </Button>
                                            ) : (
                                                <>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setPreviewDoc(doc)}
                                                        className="gap-1.5 text-[var(--color-brand-purple)]"
                                                    >
                                                        <Eye size={14} />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => openEdit(doc)}
                                                        className="gap-1.5 text-slate-600"
                                                    >
                                                        <Pencil size={14} /> Editar
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setDeleteTarget(doc)}
                                                        className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50"
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </>
            )}

            {/* Create / Edit modal — keyed so state initializes fresh per target */}
            {propertyUuid && formOpen && (
                <DocumentFormModal
                    key={editing?.uuid ?? "new"}
                    onClose={() => setFormOpen(false)}
                    propertyUuid={propertyUuid}
                    types={manageableTypes}
                    document={editing}
                    onSaved={handleSaved}
                />
            )}

            {/* Delete confirmation */}
            <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>¿Eliminar documento?</DialogTitle>
                        <DialogDescription>
                            El documento{" "}
                            <span className="font-semibold">
                                {deleteTarget ? documentTypeLabel(deleteTarget.documentType) : ""}
                            </span>{" "}
                            se eliminará. Podrás restaurarlo después si lo necesitas.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                            Cancelar
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Eliminar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Quick preview from list */}
            {previewDoc && propertyUuid && (
                <DocumentPreviewModal
                    onClose={() => setPreviewDoc(null)}
                    propertyUuid={propertyUuid}
                    documentUuid={previewDoc.uuid}
                    content={previewDoc.content ?? ""}
                    shortcodes={previewDoc.documentType?.parameters?.shortcodes ?? []}
                />
            )}
        </div>
    )
}
