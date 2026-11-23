"use client"

import { Button } from "@/components/ui/button"
import { DEFAULT_CANCELLATION_POLICY, DEFAULT_LISTING_THUMBNAIL_URL } from "../lib/property-defaults"
import { createListingWithOverrideDrafts } from "../lib/property-save"
import { Note } from "@/components/ui/note"
import { Surface } from "@/components/ui/card"
import { SectionCard } from "@/components/ui/section-card"
import { CheckboxCard } from "@/components/ui/checkbox-card"
import { NumberStepper } from "@/components/ui/number-stepper"
import { MoneyField } from "@/components/ui/money-field"
import { hasAmountSeparator, parseAmountText } from "@/lib/amount-text"
import { formatMoney } from "@/lib/money"
import { CatalogError } from "@/components/shared/catalog-error"
import { RequiredMark } from "@/components/shared/required-mark"
import {
    Dialog,
    DialogContent,
    DialogBody,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { DataTable } from "@/components/shared/data-table"
import { ActionsHeader, RowActionsMenu } from "@/components/shared/table-cells"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import type { ColumnDef } from "@tanstack/react-table"
import { listingColumns, ListingMobileRow, toListingTableRow, type ListingTableRow } from "./listing-columns"
import { Plus, Trash2, Edit2, Settings2, Zap, Info, KeyRound } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { useFormContext, useFieldArray } from "react-hook-form"
import { useSearchParams } from "next/navigation"
import { useCallback, useMemo, useState, useEffect, useRef } from "react"
import { SwitchField } from "@/components/ui/switch-field"
import { toast } from "sonner"
import { notifyError } from "@/lib/notify-error"
import { catalogService, CatalogOption } from "@/features/auth/services/catalog-service"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { listingsService } from "../services/listings-service"
import { automationService } from "../services/automation-service"
import { getOverrideFieldSchema } from "../data/automation-definitions"
import { LISTING_CREDENTIALS_COPY, findCredentialSibling, listingCredentialSummary, readCredentialsScope } from "../lib/credentials-scope"
import { type PropertyAutomation, type ListingAutomationOverride } from "../types/automation"
import { AutomationOverrideModal } from "./automations/AutomationOverrideModal"
import { useIdentityProviderCatalog } from "../hooks/useIdentityProviderCatalog"
import { identityOverrideSummary, isIdentityPropertyAutomation } from "../lib/identity-listing-override"
import { Badge } from "@/components/ui/badge"
import { StatusPill } from "@/components/ui/status-pill"
import { CredentialsRejectedNotice } from "@/components/shared/credentials-rejected-notice"
import { ExternalPmsIdsField } from "./ExternalPmsIdsField"
import {
    hasIncompleteExternalPmsId,
    normalizeExternalPmsIds,
    readExternalPmsIds,
    readExternalPmsConnections,
    readExternalIdentifierServerErrors,
    sameExternalPmsIds,
} from "../lib/external-pms-ids"
import { ApiError } from "@/types/api"
import {
    validateUnitForm,
    toFieldErrorMap,
    UNIT_LIMITS,
    type UnitFormTab,
} from "../lib/unit-form-validation"
import { toAmenityIds, toListingPayload } from "../lib/listing-payload"
import { RECORD_STATUS, readRecordStatus } from "../lib/record-status"
import { readInactiveResourceError } from "@/lib/inactive-resource"
import { automationDisplay } from "../lib/automation-display"
import { DeactivationConfirmDialog } from "./DeactivationConfirmDialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { buttonVariants } from "@/components/ui/button"
import type { ExternalPmsId } from "../types"
import { invalidatePropertiesCaches, toListing } from "../lib/properties-cache"
import { readDeclaredCapacity, type DeclaredCapacity } from "../lib/declared-capacity"
import { FeedbackBanner } from "@/components/ui/feedback-banner"
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import { FieldError, FieldHint } from "@/components/ui/form"

const defaultUnit = {
    name: "",
    internalName: "",
    roomTypeId: 0,
    thumbnailUrl: DEFAULT_LISTING_THUMBNAIL_URL,
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    statusRecordId: 6,
    isActive: true,
    externalPmsIds: [] as ExternalPmsId[],
    extra: {
        currency: "COP",
        picturesUrl: [],
        bedRoom: 1,
        bathRoom: 1,
        rooms: 1,
        maxOccupancy: 2,
        minNights: 1,
        maxNights: 30,
        checkIn: "15:00",
        checkOut: "11:00",
        wifiDetails: { network: "", password: "" },
        amenities: [] as number[],
        cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
        inheritAmenities: true,
        inheritWifi: true,
        inheritSchedule: true,
        inheritPolicies: true,
    },
    price: "",
}

/** A draft override is worth persisting only if it changes something vs. inheriting. */
/**
 * POST de un override borrador después de crear la unidad. `providerId` solo
 * viaja con 6: junto a 7 el backend responde 422 (contrato 2026-10-14).
 */
export function draftOverrideCreatePayload(d: ListingAutomationOverride, listingUuid: string) {
    return {
        listingUuid,
        propertyAutomationUuid: d.propertyAutomationUuid,
        statusRecordId: d.statusRecordId,
        parameters: d.parameters,
        ...(d.providerId != null && d.isActive ? { providerId: d.providerId } : {}),
    }
}

export function isMeaningfulOverride(o: ListingAutomationOverride): boolean {
    if (!o.isActive) return true
    // Identidad: un nivel propio (Avanzada/Esencial) es configuración real.
    if (o.providerId != null) return true
    const params = o.parameters ?? {}
    return Object.values(params).some(v => v !== "" && v !== null && v !== undefined)
}

/** La lista fija que ya existía para cuando el catálogo de monedas viene vacío. */
const FALLBACK_CURRENCIES = [
    { value: "ARS", label: "ARS - Argentine peso" },
    { value: "CAD", label: "CAD - Canadian dollar" },
    { value: "CLP", label: "CLP - Chilean peso" },
    { value: "COP", label: "COP - Colombian peso" },
    { value: "USD", label: "USD - United States dollar" },
    { value: "EUR", label: "EUR - Euro" },
    { value: "MXN", label: "MXN - Mexican peso" },
]

/** Nombre para mostrar de un alojamiento: nombre, si no su número interno. */
function unitDisplayName(unit: { name?: string; internalName?: string; internal_name?: string }, fallback: string): string {
    return unit.name || unit.internalName || unit.internal_name || fallback
}

const UNITS_LABEL = { singular: "alojamiento", plural: "alojamientos" }

/**
 * Una fila del editor como fila de la tabla compartida. Los valores salen del
 * mismo lector que la pestaña Alojamientos (`toListing`): sin «0 huéspedes» ni
 * «$0» inventados. La capacidad sale de `declaredCapacity` (lo que dijo la
 * respuesta), NO de `extra`, que el formulario rellena con 2/1/1; una fila
 * nueva todavía sin guardar no lo trae y usa lo que escribió el PM. Dos datos
 * son del formulario y mandan sobre la respuesta: `isActive` (el interruptor
 * del diálogo) y `externalPmsIds` (lo que se va a guardar); el nombre de cada
 * origen se toma de `pmsIdentifiers` cuando vino.
 */
function toUnitRow(field: Record<string, unknown> & { id: string }, index: number): ListingTableRow {
    const listing = toListing(field, index)
    const named = readExternalPmsConnections(field)
    const formIds = Array.isArray(field.externalPmsIds) ? readExternalPmsConnections({ externalPmsIds: field.externalPmsIds }) : null
    const names = new Map((named ?? []).map((c) => [c.sourcePmsId, c.sourceName]))
    const connections = formIds ? formIds.map((c) => ({ ...c, sourceName: names.get(c.sourcePmsId) ?? null })) : named
    const declared = (field.declaredCapacity as DeclaredCapacity | undefined) ?? readDeclaredCapacity(field)
    return {
        ...toListingTableRow(listing, { propertyName: null, href: null }),
        ...declared,
        // El uuid cuando existe: `update()` de useFieldArray le da a la fila
        // editada un id nuevo, y con él la tabla perdía la página en la que estaba.
        id: typeof field.uuid === "string" && field.uuid ? field.uuid : field.id,
        status: field.isActive === false ? "INACTIVE" : field.isActive === true ? "ACTIVE" : listing.status,
        connections,
    }
}
const unitRowId = (row: ListingTableRow) => row.id

export function PropertiesUnits() {
    const { control, watch } = useFormContext()
    // uuid is injected by the edit page — undefined for new properties
    const propertyUuid: string | undefined = watch("uuid")
    // Bajo una propiedad inactiva no se activa ni se crea activo un alojamiento
    // (contrato 2026-10-27 §2.2: 422 PROPERTY_INACTIVE). Desactivar sí se puede.
    const propertyInactive = !!propertyUuid && readRecordStatus({ statusRecordId: watch("statusRecordId") }) === "inactive"

    const { fields, append, remove, update } = useFieldArray({
        control,
        name: "units",
    })

    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingIndex, setEditingIndex] = useState<number | null>(null)
    const [unitForm, setUnitForm] = useState({ ...defaultUnit })
    const unitPriceText = String(unitForm.price ?? "")
    const unitPriceValue = parseAmountText(unitPriceText)
    const unitPriceInterpreted = unitPriceValue !== null && hasAmountSeparator(unitPriceText) ? formatMoney(unitPriceValue, unitForm.extra.currency ?? "COP") : null
    const [roomTypes, setRoomTypes] = useState<CatalogOption[]>([])
    const [currencies, setCurrencies] = useState<CatalogOption[]>([])
    /** `null` = cargando; `[]` puede ser catálogo vacío o fallo (ver flag). */
    const [amenityOptions, setAmenityOptions] = useState<CatalogOption[] | null>(null)
    const [amenityCatalogFailed, setAmenityCatalogFailed] = useState(false)
    const [roomTypesLoading, setRoomTypesLoading] = useState(true)
    // Persiste durante el reintento, para que el aviso diga «Reintentando…» en vez de desaparecer.
    const [roomTypesFailed, setRoomTypesFailed] = useState(false)
    const [isSavingUnit, setIsSavingUnit] = useState(false)
    const saveLockRef = useRef(false)
    /** Turno de la última carga de automatizaciones/overrides del diálogo: solo esa escribe. */
    const overridesRequestRef = useRef(0)
    // Cada guardado de un override de la unidad: una relectura vieja no pisa uno más nuevo.
    const overrideSaveSeqRef = useRef(0)

    // ── Automations overrides state ──────────────────────────────────────────
    // Active property-level automations of the parent property
    const [propertyAutomations, setPropertyAutomations] = useState<PropertyAutomation[]>([])
    // Avanzada/Esencial para el resumen de identidad; solo se pide si hay slots de identidad.
    const identityCatalog = useIdentityProviderCatalog(propertyAutomations.some(isIdentityPropertyAutomation))
    // Current listing's overrides map: automationUuid → override (uuid="" = unsaved draft)
    const [listingOverrides, setListingOverrides] = useState<Record<string, ListingAutomationOverride>>({})
    const [overridesLoading, setOverridesLoading] = useState(false)
    // Automation whose override modal is currently open
    const [editingOverrideAutomation, setEditingOverrideAutomation] = useState<PropertyAutomation | null>(null)

    // This dialog has no zod resolver, so incomplete external-id rows are marked
    // only once the PM actually tries to save — flagging a row they just added
    // and haven't filled in yet would be nagging, not helping.
    const [showExternalPmsIdErrors, setShowExternalPmsIdErrors] = useState(false)

    // Errores de campo del intento de guardado, indexados por campo. Se limpian
    // al reabrir el diálogo — no al teclear: un error que desaparece mientras el
    // PM corrige OTRO campo hace parecer que ya está resuelto.
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

    // Snapshot de los identificadores al abrir el diálogo: decide si la sección
    // se editó (contrato 2026-08-23: la clave solo viaja si cambió — `[]` borra
    // todas las filas y la clave omitida no toca nada).
    const initialExternalPmsIdsRef = useRef<ExternalPmsId[]>([])
    // Errores 422 del backend atribuidos a filas de identificadores (las claves
    // llegan como `externalIdentifiers.N.campo`). Se limpian al editar la
    // sección o reabrir el diálogo.
    const [serverIdentifierErrors, setServerIdentifierErrors] = useState<
        Record<number, { sourcePmsId?: string; externalId?: string }>
    >({})

    // Las pestañas pasan a ser controladas para poder ABRIR la que tiene el
    // error. Antes eran `defaultValue="general"` y el aviso de identificación
    // externa decía "Revisa la pestaña General" — un rodeo de texto para algo
    // que la UI puede hacer sola.
    const [activeTab, setActiveTab] = useState<UnitFormTab | "automations">("general")
    // Errores por fila: los de completitud local y los que el backend atribuyó
    // (422) conviven — el mensaje del servidor llega ya localizado y manda.
    const hasServerIdentifierErrors = Object.keys(serverIdentifierErrors).length > 0
    const externalPmsIdRowErrors = showExternalPmsIdErrors || hasServerIdentifierErrors
        ? (unitForm.externalPmsIds ?? []).map((row, index) => ({
            sourcePmsId: (showExternalPmsIdErrors && !row.sourcePmsId ? "Selecciona el origen" : undefined)
                ?? serverIdentifierErrors[index]?.sourcePmsId,
            externalId: (showExternalPmsIdErrors && !String(row.externalId ?? "").trim() ? "Ingresa el ID externo" : undefined)
                ?? serverIdentifierErrors[index]?.externalId,
        }))
        : undefined

    // Con «Reintentar» junto al campo: antes, un catálogo caído obligaba a
    // recargar la página. `mountedRef` como el `active` del resto del repo
    // (ContractRoutingSection, GuaranteePreview): salir de la propiedad antes
    // de que responda no escribe estado sobre un componente desmontado.
    const mountedRef = useRef(true)
    useEffect(() => {
        mountedRef.current = true
        return () => { mountedRef.current = false }
    }, [])
    // Cadena `.then()` a propósito: `react-hooks/set-state-in-effect` sigue las
    // llamadas a funciones locales y solo acepta setState dentro de callbacks.
    const fetchRoomTypes = useCallback(() =>
        Promise.all([catalogService.getRoomTypes(), catalogService.getCurrencies()])
            .then(([rooms, curr]) => {
                if (!mountedRef.current) return
                setRoomTypes(rooms)
                setRoomTypesFailed(rooms.length === 0)
                if (curr.length > 0) setCurrencies(curr)
            })
            .catch((error) => {
                console.error("[PropertiesUnits] Error fetching room types:", error)
                if (!mountedRef.current) return
                setRoomTypes([])
                setRoomTypesFailed(true)
            })
            .finally(() => {
                if (mountedRef.current) setRoomTypesLoading(false)
            }), [])
    useEffect(() => { void fetchRoomTypes() }, [fetchRoomTypes])
    const loadRoomTypes = () => {
        setRoomTypesLoading(true)
        void fetchRoomTypes()
    }

    // Aparte del Promise.all de arriba a propósito: si amenidades falla, el
    // resto del formulario de unidades sigue funcionando.
    useEffect(() => {
        let active = true
        catalogService.getAmenities()
            .then((amenities) => { if (active) setAmenityOptions(amenities) })
            .catch((error) => {
                console.error("[PropertiesUnits] catálogo de amenidades:", error)
                if (active) {
                    setAmenityOptions([])
                    setAmenityCatalogFailed(true)
                }
            })
        return () => { active = false }
    }, [])

    const handleOpenAddDialog = () => {
        setUnitForm(propertyInactive
            ? { ...defaultUnit, isActive: false, statusRecordId: RECORD_STATUS.INACTIVE }
            : { ...defaultUnit })
        setEditingIndex(null)
        setListingOverrides({})
        setShowExternalPmsIdErrors(false)
        setFieldErrors({})
        initialExternalPmsIdsRef.current = []
        setServerIdentifierErrors({})
        setActiveTab("general")
        setPropertyAutomations([])
        saveLockRef.current = false
        setIsSavingUnit(false)
        // New listing under an existing property: load automations so the user can
        // configure override drafts that get created right after the listing is saved.
        if (propertyUuid) {
            setOverridesLoading(true)
            const request = ++overridesRequestRef.current
            // Con el provider: su `name` (editable en la DB) es lo que se muestra,
            // nunca el slug (Ricardo, 2026-10-29).
            automationService.listGlobal({ propertyUuid, includeProvider: true })
                .then(automations => {
                    if (request !== overridesRequestRef.current) return
                    setPropertyAutomations(automations.filter(a => a.isActive || isIdentityPropertyAutomation(a)))
                })
                .catch(() => {
                    if (request === overridesRequestRef.current) setPropertyAutomations([])
                })
                .finally(() => {
                    if (request === overridesRequestRef.current) setOverridesLoading(false)
                })
        }
        setIsDialogOpen(true)
    }

    const handleOpenEditDialog = (index: number) => {
        const raw = fields[index] as any
        // Normalize: API returns nested objects; flatten to camelCase for the form
        const normalized = {
            ...raw,
            internalName:  raw.internalName  || raw.internal_name  || "",
            // API returns roomType: { id, name } — flatten to roomTypeId
            roomTypeId:    raw.roomType?.id  || raw.roomTypeId    || raw.room_type_id    || 0,
            // API returns contact: { name, email, phone } — flatten
            contactName:   raw.contact?.name  || raw.contactName   || raw.contact_name   || "",
            contactEmail:  raw.contact?.email || raw.contactEmail  || raw.contact_email  || "",
            contactPhone:  raw.contact?.phone || raw.contactPhone  || raw.contact_phone  || "",
            description:   raw.description   || "",
            thumbnailUrl:  raw.thumbnailUrl  || raw.thumbnail_url  || "",
            price:         raw.extra?.startPrice || raw.extra?.price || raw.price || raw.total_price || raw.start_price || "",
            // API returns statusRecord: { id } — determine isActive
            isActive:      raw.isActive ?? (raw.statusRecord?.id === 6 || raw.statusRecordId === 6 || raw.status_record_id === 6) ?? true,
            statusRecordId: raw.statusRecord?.id || raw.statusRecordId || raw.status_record_id || 6,
            externalPmsIds: normalizeExternalPmsIds(raw),
            extra: {
                ...defaultUnit.extra,
                ...(raw.extra || {}),
                // Ids SIEMPRE (el GET los devuelve como objetos {id, name} — el
                // round-trip sin normalizar mandaba esos objetos al PUT, reporte
                // de backend 2026-09-06). Y la herencia se decide por contenido:
                // el backend agrega `amenities: []` aunque nunca se configuró,
                // así que `=== undefined` daba override fantasma en toda unidad.
                amenities: toAmenityIds(raw.extra?.amenities),
                inheritAmenities: toAmenityIds(raw.extra?.amenities).length === 0,
                currency: raw.extra?.currency || "COP",
                // Ensure wifi nulls become empty strings for controlled inputs
                wifiDetails: {
                    network:  raw.extra?.wifiDetails?.network  ?? "",
                    password: raw.extra?.wifiDetails?.password ?? "",
                },
            },
        }
        setUnitForm(normalized)
        setEditingIndex(index)
        setListingOverrides({})
        setShowExternalPmsIdErrors(false)
        setFieldErrors({})
        initialExternalPmsIdsRef.current = normalized.externalPmsIds ?? []
        setServerIdentifierErrors({})
        setActiveTab("general")
        saveLockRef.current = false
        setIsSavingUnit(false)

        // Load property automations and listing overrides for existing listings
        if (propertyUuid && raw.uuid) {
            setOverridesLoading(true)
            // Solo la carga del ÚLTIMO diálogo abierto escribe: abrir A, cancelar
            // y abrir B no puede dejar en B los overrides de A (y editarlos
            // escribiría sobre A).
            const request = ++overridesRequestRef.current
            Promise.all([
                automationService.listGlobal({ propertyUuid, includeProvider: true }),
                automationService.listListingOverrides(raw.uuid),
            ]).then(([automations, overrides]) => {
                if (request !== overridesRequestRef.current) return
                setPropertyAutomations(automations.filter(a => a.isActive || isIdentityPropertyAutomation(a)))

                // Build overrides map keyed by property automation uuid
                const map: Record<string, ListingAutomationOverride> = {}
                for (const o of overrides) {
                    map[o.propertyAutomationUuid] = o
                }
                setListingOverrides(map)
            }).catch(() => {
                if (request === overridesRequestRef.current) setPropertyAutomations([])
            }).finally(() => {
                if (request === overridesRequestRef.current) setOverridesLoading(false)
            })
        } else {
            // También invalida una carga anterior en vuelo: no puede escribir aquí.
            overridesRequestRef.current += 1
            setPropertyAutomations([])
        }

        setIsDialogOpen(true)
    }

    // Guardado en espera de que el PM confirme que desactiva la unidad.
    const [confirmingUnitDeactivation, setConfirmingUnitDeactivation] = useState(false)

    const handleSaveUnit = async (options: { deactivationConfirmed?: boolean } = {}) => {
        if (saveLockRef.current) return
        // Este diálogo no tiene resolver de zod (el formulario de propiedad sí),
        // así que las reglas se aplican acá. Antes sólo se comprobaba el nombre:
        // todo lo demás —incluido el correo que la UI marca con asterisco— viajaba
        // al backend y volvía como 422 crudo, con el PM sin saber qué campo era.
        const errors = validateUnitForm(unitForm)
        if (errors.length > 0) {
            setFieldErrors(toFieldErrorMap(errors))
            // Abrir la pestaña del primer error: el correo vive al final del tab
            // General y es justo el que el PM no ve antes de pulsar guardar.
            setActiveTab(errors[0].tab)
            window.setTimeout(() => document.getElementById(errors[0].field)?.focus(), 0)
            toast.error(
                errors.length === 1 ? "Falta un dato del alojamiento" : `Faltan ${errors.length} datos del alojamiento`,
                { description: errors[0].message },
            )
            return
        }
        setFieldErrors({})

        // The property form gets this from zod; this dialog has no resolver, so the
        // same rule is enforced here rather than letting a half-filled row 422.
        if (hasIncompleteExternalPmsId(unitForm.externalPmsIds)) {
            setShowExternalPmsIdErrors(true)
            setActiveTab("general")
            toast.error("Identificación externa incompleta", {
                description: "Cada origen necesita su ID externo, o quita la fila.",
            })
            return
        }

        // Pasar una unidad YA guardada de activa a inactiva detiene las
        // automatizaciones de sus reservas: se confirma antes de escribir. Una
        // unidad nueva no tiene reservas, y reactivar no pregunta.
        const original = editingIndex !== null ? (fields[editingIndex] as Record<string, unknown> | undefined) : undefined
        const wasActive = !!original && typeof original.uuid === "string" && original.uuid !== ""
            && original.isActive !== false && readRecordStatus(original) !== "inactive"
        if (wasActive && unitForm.isActive === false && !options.deactivationConfirmed) {
            setConfirmingUnitDeactivation(true)
            return
        }

        saveLockRef.current = true
        setIsSavingUnit(true)

        // ── Existing property: persist via API immediately ──
        if (propertyUuid) {
            try {
                const unitPrice = (parseAmountText(String(unitForm.price ?? "")) ?? 0)
                // Dirty-gating del contrato 2026-08-23: `externalPmsIds` solo
                // viaja si la sección cambió respecto a lo cargado — `[]` borra
                // todas las filas y la clave omitida no toca nada.
                const identifiersDirty = !sameExternalPmsIds(
                    initialExternalPmsIdsRef.current,
                    unitForm.externalPmsIds,
                )
                const payload = toListingPayload(
                    propertyUuid,
                    identifiersDirty ? unitForm : { ...unitForm, externalPmsIds: undefined },
                )

                // UPDATE also needs price at top-level (PUT /listings accepts it; POST does not)
                const updatePayload = { ...payload, price: unitPrice, start_price: unitPrice }

                if (editingIndex !== null && (unitForm as any).uuid) {
                    // UPDATE existing listing — use updatePayload which includes root-level price (PUT accepts it)
                    const updated = await listingsService.update((unitForm as any).uuid, updatePayload as any)
                    invalidatePropertiesCaches()
                    const apiData = updated?.data ?? updated ?? {}
                    // Rebuild local state: price comes from extra.startPrice
                    const refreshed = {
                        ...unitForm,
                        ...apiData,
                        roomTypeId:    apiData.roomType?.id    || unitForm.roomTypeId,
                        contactName:   apiData.contact?.name   || unitForm.contactName,
                        contactEmail:  apiData.contact?.email  || unitForm.contactEmail,
                        contactPhone:  apiData.contact?.phone  || unitForm.contactPhone,
                        isActive:      apiData.statusRecord ? apiData.statusRecord.id === 6 : unitForm.isActive,
                        // Rehidratar SIEMPRE desde la respuesta (contrato
                        // 2026-08-23: `update` carga la relación y los `id` de
                        // las filas —nuevos o recreados por cambio de source—
                        // solo existen allí; el próximo guardado sin ellos es un
                        // 422). `null` = la respuesta no trajo la clave: se
                        // conserva lo local en vez de inventar un vacío.
                        externalPmsIds: readExternalPmsIds(apiData) ?? unitForm.externalPmsIds,
                        // Lo que la respuesta declara ahora (la tabla lo muestra).
                        declaredCapacity: readDeclaredCapacity(apiData),
                        // Restore price checking root and extra
                        price:         apiData.price || apiData.startPrice || apiData.start_price || apiData.extra?.price || apiData.extra?.startPrice || unitForm.price,
                        extra: {
                            ...unitForm.extra,
                            ...(apiData.extra || {}),
                            startPrice: (parseAmountText(String(unitForm.price ?? "")) ?? 0),
                            price: (parseAmountText(String(unitForm.price ?? "")) ?? 0),
                            currency:   apiData.extra?.currency || unitForm.extra.currency,
                        },
                    }
                    update(editingIndex, refreshed)
                    toast.success("Alojamiento actualizado")
                } else {
                    // CREATE new listing. La secuencia alojamiento → overrides (en
                    // borrador, solo con propiedad existente) está fijada en `property-save.ts`.
                    const drafts = Object.values(listingOverrides).filter(o => !o.uuid && isMeaningfulOverride(o))
                    const { failedOverrides } = await createListingWithOverrideDrafts({
                        payload,
                        drafts,
                        createListing: (p) => listingsService.create(p),
                        onListingCreated: (apiData, listingUuid) => {
                            invalidatePropertiesCaches()
                            const savedUnit = {
                                ...unitForm,
                                uuid: listingUuid,
                                // Los `id` de las filas recién creadas vienen en la
                                // respuesta del POST; sin rehidratarlos, editar sin
                                // recargar la página fallaría con 422 (contrato §1).
                                externalPmsIds: readExternalPmsIds(apiData) ?? unitForm.externalPmsIds,
                                declaredCapacity: readDeclaredCapacity(apiData),
                                // Restore price checking root and extra
                                price: apiData.price || apiData.startPrice || apiData.start_price || apiData.extra?.price || apiData.extra?.startPrice || unitForm.price,
                                extra: {
                                    ...unitForm.extra,
                                    ...(apiData.extra || {}),
                                    startPrice: (parseAmountText(String(unitForm.price ?? "")) ?? 0),
                                    price: (parseAmountText(String(unitForm.price ?? "")) ?? 0),
                                    currency:   apiData.extra?.currency || unitForm.extra.currency,
                                },
                            }
                            append(savedUnit)
                        },
                        createOverride: (d, listingUuid) => automationService.createListingOverride(draftOverrideCreatePayload(d, listingUuid)),
                    })
                    if (drafts.length > 0) {
                        if (failedOverrides.length > 0) {
                            toast.warning("Alojamiento creado, pero algunos overrides fallaron", {
                                description: `No se configuraron: ${failedOverrides.join(", ")}. Edita el alojamiento para reintentar.`,
                            })
                        } else {
                            toast.success("Alojamiento y overrides creados")
                        }
                    } else {
                        toast.success("Alojamiento creado")
                    }
                }
            } catch (err) {
                console.error("[PropertiesUnits] Error saving listing:", err)
                // 422 de identificadores: atribuir cada error a su fila (las
                // claves llegan como `externalIdentifiers.N.campo`); el mensaje
                // ya viene localizado y se muestra tal cual. Un error de `id`
                // (fila obsoleta) se ancla al campo visible de la fila.
                const identifierErrors = err instanceof ApiError
                    ? readExternalIdentifierServerErrors(err.errors)
                    : []
                if (identifierErrors.length > 0) {
                    const byRow: Record<number, { sourcePmsId?: string; externalId?: string }> = {}
                    for (const serverError of identifierErrors) {
                        const slot = serverError.field === "sourcePmsId" ? "sourcePmsId" : "externalId"
                        byRow[serverError.index] = { ...byRow[serverError.index], [slot]: serverError.message }
                    }
                    setServerIdentifierErrors(byRow)
                    setActiveTab("general")
                    toast.error("Revisa la identificación externa", {
                        description: identifierErrors[0].message,
                    })
                } else {
                    // La propiedad se desactivó mientras se editaba (422
                    // PROPERTY_INACTIVE): el mensaje del backend lo explica tal cual.
                    const inactive = readInactiveResourceError(err)
                    if (inactive) toast.error("No se pudo guardar el alojamiento", { description: inactive.message })
                    else notifyError(err, "No se pudo guardar el alojamiento. Intenta de nuevo o guarda la propiedad completa.")
                }
                saveLockRef.current = false
                setIsSavingUnit(false)
                return
            }
        } else {
            // ── New property: keep in local form state, will be saved with the property ──
            if (editingIndex !== null) {
                update(editingIndex, unitForm)
            } else {
                append(unitForm)
            }
        }

        saveLockRef.current = false
        setIsSavingUnit(false)
        closeDialog()
    }

    // Un alojamiento ya guardado se borra en el backend: antes ocurría al
    // primer clic en la papelera. Ahora se confirma, y mientras se borra no se
    // puede cerrar ni volver a pulsar. Una fila sin guardar solo sale del
    // formulario, sin preguntar: no hay nada que borrar en el backend.
    const [unitToDelete, setUnitToDelete] = useState<{ uuid: string; name: string; isActive: boolean } | null>(null)
    const [isDeletingUnit, setIsDeletingUnit] = useState(false)
    // Candado síncrono contra el doble clic (el estado llega un render tarde).
    const deleteLockRef = useRef(false)

    const handleRemoveUnit = (index: number) => {
        const unit = fields[index] as any
        if (propertyUuid && unit.uuid) {
            setUnitToDelete({ uuid: unit.uuid, name: unitDisplayName(unit, "este alojamiento"), isActive: unit.isActive !== false })
            return
        }
        remove(index)
    }

    const confirmRemoveUnit = async () => {
        if (!unitToDelete || deleteLockRef.current) return
        deleteLockRef.current = true
        setIsDeletingUnit(true)
        try {
            await listingsService.delete(unitToDelete.uuid)
            invalidatePropertiesCaches()
            // Por uuid, no por la posición de cuando se abrió el diálogo.
            const index = fields.findIndex((f) => (f as { uuid?: string }).uuid === unitToDelete.uuid)
            if (index >= 0) remove(index)
            toast.success("Alojamiento eliminado")
            setUnitToDelete(null)
        } catch (err) {
            // El diálogo sigue abierto: se puede reintentar o cancelar.
            console.error("[PropertiesUnits] Error deleting listing:", err)
            notifyError(err, "No pudimos eliminar el alojamiento")
        } finally {
            deleteLockRef.current = false
            setIsDeletingUnit(false)
        }
    }

    // Llegar con `?unit=<uuid>` (desde la lista de alojamientos) abre ese
    // alojamiento una sola vez, cuando sus filas ya están en el formulario.
    const searchParams = useSearchParams()
    const requestedUnit = searchParams?.get("unit") ?? null
    const openedFromQueryRef = useRef<string | null>(null)
    /**
     * Al cerrar, la URL deja de decir que hay un alojamiento abierto: se quita
     * solo `unit` (queda `tab=units`), sin una entrada más en el historial. El
     * `state` va en `null` A PROPÓSITO: el App Router parchea `replaceState` y,
     * si recibe su propio `history.state` (`__NA`), lo toma por una llamada
     * interna y NO actualiza `useSearchParams`; con `null` copia su árbol y sí.
     */
    const clearUnitParam = () => {
        if (typeof window === "undefined") return
        const url = new URL(window.location.href)
        if (!url.searchParams.has("unit")) return
        url.searchParams.delete("unit")
        window.history.replaceState(null, "", url.toString())
    }
    /** Cerrar desde cualquier camino (Cancelar, guardado, X/Escape) con la URL al día. */
    const closeDialog = () => {
        setIsDialogOpen(false)
        clearUnitParam()
    }
    useEffect(() => {
        // Sin `unit` en la URL se vuelve a poder abrir por URL (p. ej. «atrás» del navegador).
        if (!requestedUnit) {
            openedFromQueryRef.current = null
            return
        }
        if (openedFromQueryRef.current === requestedUnit) return
        const index = fields.findIndex((f) => (f as { uuid?: string }).uuid === requestedUnit)
        if (index < 0) return
        // En el siguiente tick, como el clic en «Editar»: abrir en el acto desde el
        // efecto sería un setState síncrono (react-hooks/set-state-in-effect).
        const timer = setTimeout(() => {
            openedFromQueryRef.current = requestedUnit
            handleOpenEditDialog(index)
        }, 0)
        return () => clearTimeout(timer)
        // `handleOpenEditDialog` se rehace en cada render; lo que decide es `requestedUnit` + `fields`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requestedUnit, fields])

    // La tabla: mismas columnas que la pestaña Alojamientos de Propiedades, sin
    // la columna Propiedad; el nombre abre la edición y el menú «⋮» edita o
    // elimina. La fila se ubica por su id de `useFieldArray`, no por posición
    // de cuando se pintó.
    const unitRows = useMemo(
        () => fields.map((field, index) => toUnitRow(field as unknown as Record<string, unknown> & { id: string }, index)),
        [fields],
    )
    // Las columnas tienen que ser ESTABLES: TanStack monta cada celda como un
    // componente, y una función de celda nueva en cada render es otro
    // componente: React remontaba la celda y el clic en el nombre caía sobre un
    // botón que ya no existía. Los manejadores cambian en cada render, así que
    // las columnas los leen de una ref.
    const rowHandlersRef = useRef<{ open: (row: ListingTableRow) => void; remove: (row: ListingTableRow) => void }>({ open: () => {}, remove: () => {} })
    useEffect(() => {
        const indexOfRow = (row: ListingTableRow) => fields.findIndex((field) => (field as { uuid?: string }).uuid === row.id || field.id === row.id)
        rowHandlersRef.current = {
            open: (row) => {
                const index = indexOfRow(row)
                if (index >= 0) handleOpenEditDialog(index)
            },
            remove: (row) => {
                const index = indexOfRow(row)
                if (index >= 0) handleRemoveUnit(index)
            },
        }
    })
    const { unitColumns, renderUnitMobileRow } = useMemo(() => {
        const open = (row: ListingTableRow) => rowHandlersRef.current.open(row)
        const actions = (row: ListingTableRow) => (
            <RowActionsMenu label={`Acciones de ${row.name || row.number || "este alojamiento"}`}>
                <DropdownMenuItem onClick={() => rowHandlersRef.current.open(row)}>
                    <Icon icon={Edit2} /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem className="text-danger" onClick={() => rowHandlersRef.current.remove(row)}>
                    <Icon icon={Trash2} /> Eliminar
                </DropdownMenuItem>
            </RowActionsMenu>
        )
        const actionsColumn: ColumnDef<ListingTableRow> = {
            id: "actions",
            header: () => <ActionsHeader />,
            enableSorting: false,
            meta: { cellClassName: "text-center" },
            cell: ({ row }) => actions(row.original),
        }
        return {
            unitColumns: listingColumns({ withProperty: false, actions: actionsColumn, onOpen: open }),
            renderUnitMobileRow: (row: ListingTableRow) => (
                <ListingMobileRow row={row} onOpen={() => open(row)} actions={actions(row)} />
            ),
        }
    }, [])

    return (
        <SectionCard
            title="Alojamientos"
            description="Lo que se puede reservar en esta propiedad: cada uno con su capacidad, precio y contacto."
            headingLevel={2}
            flush
            actions={
                <Button type="button" size="sm" onClick={handleOpenAddDialog}>
                    <Icon icon={Plus} /> Añadir alojamiento
                </Button>
            }
        >
            <>
                    <Dialog
                        open={isDialogOpen}
                        onOpenChange={(open) => {
                            if (isSavingUnit) return
                            if (open) setIsDialogOpen(true)
                            else closeDialog()
                        }}
                    >
                        {/* Formulario largo: encabezado y pie fijos, el cuerpo con scroll propio
                            (`layout="panel"`, el mismo que la reserva manual). */}
                        <DialogContent layout="panel" className="sm:max-w-150">
                            <DialogHeader divided>
                                <DialogTitle>{editingIndex !== null ? "Editar alojamiento" : "Añadir alojamiento"}</DialogTitle>
                                <DialogDescription>
                                    {editingIndex !== null ? "Los cambios se guardan al confirmar." : "Lo que el huésped reserva: nombre, capacidad, precio y contacto."}
                                </DialogDescription>
                            </DialogHeader>

                            {/* `DialogBody` es un div con `overflow-y-auto` nativo, no `ScrollArea`:
                                el Viewport de Radix (`height: 100%`) no resuelve contra una altura
                                fijada por flexbox y el formulario se pintaba fuera del diálogo. */}
                            <DialogBody>
                                <div className="space-y-6">
                                    <SwitchField
                                        label="Alojamiento activo"
                                        tone={propertyInactive && !unitForm.isActive ? "warning" : "neutral"}
                                        description={propertyInactive && !unitForm.isActive
                                            ? "La propiedad está inactiva: actívala para poder activar este alojamiento."
                                            : "Un alojamiento inactivo no recibe reservas nuevas."}
                                        checked={unitForm.isActive}
                                        // Solo se bloquea ACTIVAR: desactivar sigue permitido.
                                        disabled={propertyInactive && !unitForm.isActive}
                                        onCheckedChange={(checked) => setUnitForm({ ...unitForm, isActive: checked })}
                                    />

                                    <Tabs
                                        value={activeTab}
                                        onValueChange={(v) => setActiveTab(v as UnitFormTab | "automations")}
                                        className="w-full"
                                    >
                                        {/* AUTOM tab only exists once the property is saved — mirrors the
                                            property-level Automatización tab behavior */}
                                        {/* 5 pestañas: densidad sm de la primitiva; con nombre completo y
                                            scroll horizontal en móvil en vez de abreviar. */}
                                        <div className="mb-4 overflow-x-auto">
                                            <TabsList size="sm" className="w-full min-w-max sm:min-w-0">
                                                <TabsTrigger value="general">General</TabsTrigger>
                                                <TabsTrigger value="amenities">Operación</TabsTrigger>
                                                <TabsTrigger value="rooms">Distribución</TabsTrigger>
                                                <TabsTrigger value="policies">Políticas</TabsTrigger>
                                                {propertyUuid && <TabsTrigger value="automations">Automatizaciones</TabsTrigger>}
                                            </TabsList>
                                        </div>

                                        <TabsContent value="general" className="space-y-4">
                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="name">Nombre del alojamiento <RequiredMark /></Label>
                                                    <Input
                                                        id="name"
                                                        placeholder="Suite Junior"
                                                        maxLength={UNIT_LIMITS.name}
                                                        aria-invalid={!!fieldErrors.name}
                                                        value={unitForm.name ?? ""}
                                                        onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                                                    />
                                                    <FieldError role="alert">{fieldErrors.name}</FieldError>
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="internalName">Nombre interno o número</Label>
                                                    <Input
                                                        id="internalName"
                                                        placeholder="Ej. SJ-101"
                                                        // Límite del backend (`internal_name`, 15). El más
                                                        // estrecho del recurso: "Apto 105 Insula" ya no cabe.
                                                        maxLength={UNIT_LIMITS.internalName}
                                                        aria-invalid={!!fieldErrors.internalName}
                                                        value={unitForm.internalName ?? ""}
                                                        onChange={(e) => setUnitForm({ ...unitForm, internalName: e.target.value })}
                                                    />
                                                    <FieldError role="alert">{fieldErrors.internalName}</FieldError>
                                                </div>
                                            </div>

                                            <div className="grid gap-2 border-t border-rule pt-4">
                                                <div className="space-y-0.5">
                                                    <Label className="text-sm font-medium">Identificación externa</Label>
                                                    <p className="text-xs text-ink-3">
                                                        Si este alojamiento ya existe en tu PMS o canal, registra su
                                                        origen y el ID que tiene allí.
                                                    </p>
                                                </div>
                                                <ExternalPmsIdsField
                                                    subject="alojamiento"
                                                    value={unitForm.externalPmsIds ?? []}
                                                    onChange={(next) => {
                                                        setUnitForm({ ...unitForm, externalPmsIds: next })
                                                        if (hasServerIdentifierErrors) setServerIdentifierErrors({})
                                                        // Clearing as they fix it: keeping stale red on a row the PM
                                                        // is already correcting reads as "still wrong".
                                                        if (showExternalPmsIdErrors) setShowExternalPmsIdErrors(false)
                                                    }}
                                                    rowErrors={externalPmsIdRowErrors}
                                                />
                                                {/* Quitar la última fila y guardar ES el borrado
                                                    (`externalPmsIds: []`, sin deshacer — contrato
                                                    2026-08-23): mismo aviso que el formulario de
                                                    propiedad, antes de pulsar guardar. */}
                                                {initialExternalPmsIdsRef.current.length > 0
                                                    && (unitForm.externalPmsIds ?? []).length === 0 && (
                                                    // Aparece al vaciar el campo: dinámico, se anuncia sin interrumpir.
                                                    <FeedbackBanner tone="warning" mode="dynamic" className="mt-3">
                                                        Al guardar se eliminarán los vínculos con el PMS/canal
                                                        y las reservas externas de esos orígenes dejarán de
                                                        asociarse a este alojamiento.
                                                    </FeedbackBanner>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="roomTypeId">Categoría <RequiredMark /></Label>
                                                    <Select
                                                        value={unitForm.roomTypeId ? String(unitForm.roomTypeId) : undefined}
                                                        onValueChange={(value) => setUnitForm({ ...unitForm, roomTypeId: parseInt(value) })}
                                                        disabled={roomTypesLoading || roomTypes.length === 0}
                                                    >
                                                        <SelectTrigger id="roomTypeId" aria-invalid={!!fieldErrors.roomTypeId} className="w-full">
                                                            <SelectValue placeholder={roomTypesLoading ? "Cargando…" : "Elige la categoría"} />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {roomTypes.map(rt => (
                                                                <SelectItem key={rt.id} value={String(rt.id)}>{rt.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FieldError role="alert">{fieldErrors.roomTypeId}</FieldError>
                                                    {roomTypesFailed && (
                                                        <CatalogError
                                                            what="las categorías"
                                                            consequence="Sin categoría no se puede guardar."
                                                            retrying={roomTypesLoading}
                                                            onRetry={() => void loadRoomTypes()}
                                                        />
                                                    )}
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="maxOccupancy">Capacidad máxima</Label>
                                                    <NumberStepper
                                                        id="maxOccupancy"
                                                        min={1}
                                                        aria-invalid={!!fieldErrors.maxOccupancy}
                                                        value={Number(unitForm.extra.maxOccupancy) || 2}
                                                        onValueChange={(value) => setUnitForm({
                                                            ...unitForm,
                                                            extra: { ...unitForm.extra, maxOccupancy: value },
                                                        })}
                                                        decrementLabel="Un huésped menos"
                                                        incrementLabel="Un huésped más"
                                                    />
                                                    <FieldError role="alert">{fieldErrors.maxOccupancy}</FieldError>
                                                </div>
                                            </div>

                                            {/* Monto y moneda en un solo campo: son los mismos dos valores de
                                                siempre (`price` y `extra.currency`) y el payload no cambia. El
                                                catálogo vacío cae a la lista fija que ya existía. */}
                                            <div className="grid gap-2">
                                                <Label htmlFor="price">Precio inicial por noche</Label>
                                                <MoneyField
                                                    id="price"
                                                    amount={unitForm.price ?? ""}
                                                    onAmountChange={(value) => setUnitForm({ ...unitForm, price: value })}
                                                    currency={unitForm.extra.currency ?? "COP"}
                                                    onCurrencyChange={(val) => setUnitForm({ ...unitForm, extra: { ...unitForm.extra, currency: val } })}
                                                    currencies={currencies.length > 0
                                                        ? currencies.map((c) => ({ value: c.id, label: c.name }))
                                                        : FALLBACK_CURRENCIES}
                                                    currencyLabel="Moneda"
                                                    placeholder="250000"
                                                    aria-invalid={!!fieldErrors.price}
                                                />
                                                {/* Con separadores se dice cómo se leyó: «650.000» es 650000, no 650. */}
                                                {unitPriceInterpreted && <FieldHint data-slot="amount-interpreted">Se registra como {unitPriceInterpreted}</FieldHint>}
                                                <FieldError role="alert">{fieldErrors.price}</FieldError>
                                            </div>

                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="contactName">Nombre de contacto</Label>
                                                    <Input
                                                        id="contactName"
                                                        placeholder="Nombre del encargado"
                                                        maxLength={UNIT_LIMITS.contactName}
                                                        aria-invalid={!!fieldErrors.contactName}
                                                        value={unitForm.contactName ?? ""}
                                                        onChange={(e) => setUnitForm({ ...unitForm, contactName: e.target.value })}
                                                    />
                                                    <FieldError role="alert">{fieldErrors.contactName}</FieldError>
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="contactPhone">Teléfono de contacto</Label>
                                                    <Input
                                                        id="contactPhone"
                                                        placeholder="+57 300 123 4567"
                                                        maxLength={UNIT_LIMITS.contactPhone}
                                                        aria-invalid={!!fieldErrors.contactPhone}
                                                        value={unitForm.contactPhone ?? ""}
                                                        onChange={(e) => setUnitForm({ ...unitForm, contactPhone: e.target.value })}
                                                    />
                                                    <FieldError role="alert">{fieldErrors.contactPhone}</FieldError>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="contactEmail">Correo de contacto <RequiredMark /></Label>
                                                    <Input
                                                        id="contactEmail"
                                                        type="email"
                                                        placeholder="contacto@tupropiedad.com"
                                                        maxLength={UNIT_LIMITS.contactEmail}
                                                        aria-invalid={!!fieldErrors.contactEmail}
                                                        value={unitForm.contactEmail ?? ""}
                                                        onChange={(e) => setUnitForm({ ...unitForm, contactEmail: e.target.value })}
                                                    />
                                                    <FieldError role="alert">{fieldErrors.contactEmail}</FieldError>
                                                </div>
                                            </div>

                                        </TabsContent>

                                        {/* Cada bloque heredable: `SwitchField boxed` y, apagado, sus campos
                                            debajo. Sin íconos de título ni tamaños propios (plan v3 §3). */}
                                        <TabsContent value="amenities" className="space-y-6">
                                            <div className="space-y-4">
                                                <SwitchField
                                                    variant="boxed"
                                                    label="Heredar horarios de la propiedad"
                                                    description="Apágalo para fijar un check-in y check-out propios."
                                                    checked={unitForm.extra.inheritSchedule}
                                                    onCheckedChange={(checked) => setUnitForm({ ...unitForm, extra: { ...unitForm.extra, inheritSchedule: checked } })}
                                                />
                                                {!unitForm.extra.inheritSchedule && (
                                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                        <div className="grid gap-2">
                                                            <Label htmlFor="unitCheckIn">Check-in</Label>
                                                            <Input
                                                                id="unitCheckIn"
                                                                type="time"
                                                                value={unitForm.extra.checkIn ?? ""}
                                                                onChange={(e) => setUnitForm({
                                                                    ...unitForm,
                                                                    extra: { ...unitForm.extra, checkIn: e.target.value }
                                                                })}
                                                            />
                                                        </div>
                                                        <div className="grid gap-2">
                                                            <Label htmlFor="unitCheckOut">Check-out</Label>
                                                            <Input
                                                                id="unitCheckOut"
                                                                type="time"
                                                                value={unitForm.extra.checkOut ?? ""}
                                                                onChange={(e) => setUnitForm({
                                                                    ...unitForm,
                                                                    extra: { ...unitForm.extra, checkOut: e.target.value }
                                                                })}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-4">
                                                <SwitchField
                                                    variant="boxed"
                                                    label="Heredar WiFi de la propiedad"
                                                    description="Apágalo si este alojamiento tiene su propia red."
                                                    checked={unitForm.extra.inheritWifi}
                                                    onCheckedChange={(checked) => setUnitForm({ ...unitForm, extra: { ...unitForm.extra, inheritWifi: checked } })}
                                                />

                                                {!unitForm.extra.inheritWifi && (
                                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                        <div className="grid gap-2">
                                                            <Label htmlFor="unitWifiNetwork">Red WiFi</Label>
                                                            <Input
                                                                id="unitWifiNetwork"
                                                                placeholder="Red específica"
                                                                value={unitForm.extra.wifiDetails?.network ?? ""}
                                                                onChange={(e) => setUnitForm({ 
                                                                    ...unitForm, 
                                                                    extra: { 
                                                                        ...unitForm.extra, 
                                                                        wifiDetails: { ...unitForm.extra.wifiDetails, network: e.target.value } 
                                                                    } 
                                                                })}
                                                            />
                                                        </div>
                                                        <div className="grid gap-2">
                                                            <Label htmlFor="unitWifiPassword">Clave WiFi</Label>
                                                            <Input
                                                                id="unitWifiPassword"
                                                                placeholder="Clave específica"
                                                                value={unitForm.extra.wifiDetails?.password ?? ""}
                                                                onChange={(e) => setUnitForm({ 
                                                                    ...unitForm, 
                                                                    extra: { 
                                                                        ...unitForm.extra, 
                                                                        wifiDetails: { ...unitForm.extra.wifiDetails, password: e.target.value } 
                                                                    } 
                                                                })}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* La sección que se perdió al migrar al diálogo nuevo (reporte de
                                                Didier, 2026-09-06): el estado `inheritAmenities` y el payload ya
                                                la soportaban, pero ninguna UI podía cambiarla — el override era
                                                imposible. Mismo patrón que Horarios y WiFi. */}
                                            <div className="space-y-4">
                                                <SwitchField
                                                    variant="boxed"
                                                    label="Heredar amenidades de la propiedad"
                                                    description="Apágalo para elegir solo las de este alojamiento."
                                                    checked={unitForm.extra.inheritAmenities}
                                                    onCheckedChange={(checked) => setUnitForm({ ...unitForm, extra: { ...unitForm.extra, inheritAmenities: checked } })}
                                                />

                                                {!unitForm.extra.inheritAmenities && (
                                                    amenityOptions === null ? (
                                                        <LoadingState variant="spinner" label="Cargando amenidades…" />
                                                    ) : amenityCatalogFailed ? (
                                                        // Llega después de pedir el catálogo: dinámico.
                                                        <FeedbackBanner tone="warning" mode="dynamic" density="compact">
                                                            No se pudo cargar el catálogo de amenidades. Cierra y reabre el
                                                            diálogo para reintentar; la herencia de la propiedad no se ve
                                                            afectada.
                                                        </FeedbackBanner>
                                                    ) : amenityOptions.length === 0 ? (
                                                        <EmptyState title="El catálogo de amenidades está vacío." />
                                                    ) : (
                                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                            {amenityOptions.map((item) => {
                                                                const id = Number(item.id)
                                                                const selected = (unitForm.extra.amenities ?? []).includes(id)
                                                                return (
                                                                    <CheckboxCard
                                                                        key={item.id}
                                                                        label={item.name}
                                                                        checked={selected}
                                                                        onCheckedChange={(checked) => {
                                                                            const current: number[] = unitForm.extra.amenities ?? []
                                                                            // Siempre ids numéricos: es el shape que el
                                                                            // backend exige al escribir.
                                                                            const next = checked
                                                                                ? [...current, id]
                                                                                : current.filter((v) => v !== id)
                                                                            setUnitForm({
                                                                                ...unitForm,
                                                                                extra: { ...unitForm.extra, amenities: next },
                                                                            })
                                                                        }}
                                                                    />
                                                                )
                                                            })}
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="rooms" className="space-y-6">
                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <div className="grid gap-2">
                                                            <Label htmlFor="bedRoom">Habitaciones o camas</Label>
                                                            <NumberStepper
                                                                id="bedRoom"
                                                                min={1}
                                                                aria-invalid={!!fieldErrors.bedRoom}
                                                                value={Number(unitForm.extra.bedRoom) || 1}
                                                                onValueChange={(value) => setUnitForm({
                                                                    ...unitForm,
                                                                    extra: { ...unitForm.extra, bedRoom: value },
                                                                })}
                                                            />
                                                            <FieldError role="alert">{fieldErrors.bedRoom}</FieldError>
                                                </div>

                                                <div className="grid gap-2">
                                                            <Label htmlFor="bathRoom">Baños</Label>
                                                            <NumberStepper
                                                                id="bathRoom"
                                                                min={1}
                                                                aria-invalid={!!fieldErrors.bathRoom}
                                                                value={Number(unitForm.extra.bathRoom) || 1}
                                                                onValueChange={(value) => setUnitForm({
                                                                    ...unitForm,
                                                                    extra: { ...unitForm.extra, bathRoom: value },
                                                                })}
                                                            />
                                                            <FieldError role="alert">{fieldErrors.bathRoom}</FieldError>
                                                </div>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="policies" className="space-y-4">
                                            <div className="space-y-4">
                                                <SwitchField
                                                    variant="boxed"
                                                    label="Heredar políticas de la propiedad"
                                                    description="Apágalo para fijarle una política de cancelación propia."
                                                    checked={unitForm.extra.inheritPolicies}
                                                    onCheckedChange={(checked) => setUnitForm({ ...unitForm, extra: { ...unitForm.extra, inheritPolicies: checked } })}
                                                />

                                                {!unitForm.extra.inheritPolicies && (
                                                    <div className="grid gap-2">
                                                            <Label htmlFor="cancellationPolicy">Política de cancelación</Label>
                                                            <Select 
                                                                value={unitForm.extra.cancellationPolicy ?? ""}
                                                                onValueChange={(val) => setUnitForm({
                                                                    ...unitForm,
                                                                    extra: { ...unitForm.extra, cancellationPolicy: val }
                                                                })}
                                                            >
                                                                <SelectTrigger id="cancellationPolicy" className="w-full">
                                                                    <SelectValue placeholder="Elige una política" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {/* `STANDARD` es el valor que viaja por defecto (`DEFAULT_CANCELLATION_POLICY`):
                                                                        sin esta opción, un alojamiento guardado con él se mostraba vacío. */}
                                                                    <SelectItem value={DEFAULT_CANCELLATION_POLICY}>Estándar</SelectItem>
                                                                    <SelectItem value="FLEXIBLE">Flexible (reembolso completo hasta 24 h antes)</SelectItem>
                                                                    <SelectItem value="MODERATE">Moderada (reembolso completo hasta 5 días antes)</SelectItem>
                                                                    <SelectItem value="STRICT_14">Estricta (reembolso completo hasta 14 días antes)</SelectItem>
                                                                    <SelectItem value="NON_REFUNDABLE">No reembolsable</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                    </div>
                                                )}
                                            </div>
                                        </TabsContent>

                                        {/* ── Automations Overrides Tab (only when the property is saved) ── */}
                                        {propertyUuid && (
                                        <TabsContent value="automations" className="space-y-4">
                                            <Note tone="accent" density="default" icon={Info}>
                                                Puedes desactivar o cambiar parámetros para este alojamiento. El resto hereda la configuración de la propiedad
                                                {propertyAutomations.some(pa => readCredentialsScope(pa) === "listing")
                                                    ? ", salvo las que usan credenciales por alojamiento: sin las suyas, este alojamiento no se reporta."
                                                    : "."}
                                            </Note>

                                            {overridesLoading ? (
                                                <LoadingState rows={2} label="Cargando automatizaciones…" />
                                            ) : propertyAutomations.length === 0 ? (
                                                <EmptyState
                                                    icon={Zap}
                                                    title="No hay automatizaciones activas en esta propiedad."
                                                    className="rounded-xl border border-rule py-8"
                                                />
                                            ) : (
                                                <div className="space-y-3">
                                                    {!(unitForm as any).uuid && (
                                                        <Note>
                                                            Configura los overrides ahora; se crearán al guardar el alojamiento.
                                                        </Note>
                                                    )}
                                                    {propertyAutomations.map((automation) => {
                                                        const slug = automation.provider?.parameters?.slug ?? automation.providerName ?? ""
                                                        const schema = getOverrideFieldSchema(slug)
                                                        const override = listingOverrides[automation.uuid]
                                                        const hasOverride = !!override
                                                        // Identidad: la regla compartida con la tarjeta (contrato 2026-10-14).
                                                        const identity = isIdentityPropertyAutomation(automation)
                                                            ? identityOverrideSummary(override ?? null, automation, identityCatalog.catalog)
                                                            : null
                                                        const isInactive = identity ? identity.tone === "disabled" : hasOverride && !override.isActive
                                                        const params = override?.parameters ?? {}
                                                        const hasParams = !identity && hasOverride && override.isActive &&
                                                            (Object.values(params).some(v => v !== "" && v !== null && v !== undefined)
                                                                // Un secreto guardado cuenta aunque no llegue (nota 2026-11-12).
                                                                || (override.storedSecretKeys?.length ?? 0) > 0)
                                                        const display = automationDisplay(automation, override ?? null)
                                                        // TRA/SIRE por alojamiento: sin override no se reporta; apagado es excluido.
                                                        const perListing = readCredentialsScope(automation) === "listing"
                                                        const credentialSummary = perListing
                                                            ? listingCredentialSummary(slug, override)
                                                            : null

                                                        return (
                                                            <div key={automation.uuid} className="space-y-1">
                                                            <Surface flat tone={isInactive ? "danger" : hasParams ? "selected" : "sunk"} className="flex items-center justify-between gap-3 p-4">
                                                                <div className="min-w-0 space-y-0.5">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <Icon icon={Settings2} className="text-ink-3" />
                                                                        <span className="text-sm font-bold text-ink truncate">{display.title}</span>
                                                                        {display.detail && (
                                                                            <Badge>
                                                                                {display.detail}
                                                                            </Badge>
                                                                        )}
                                                                        {credentialSummary ? (
                                                                            <StatusPill tone={credentialSummary.tone}>
                                                                                {credentialSummary.label}
                                                                            </StatusPill>
                                                                        ) : isInactive && (
                                                                            perListing
                                                                                ? <StatusPill tone="idle">{LISTING_CREDENTIALS_COPY.excluded}</StatusPill>
                                                                                : <StatusPill tone="danger">Desactivada aquí</StatusPill>
                                                                        )}
                                                                        {hasParams && !perListing && (
                                                                            <Badge tone="accent">
                                                                                Personalizada
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-xs text-ink-3">
                                                                        {/* El estado ya está en la pastilla: acá va lo que significa,
                                                                            no el mismo texto dos veces (el lector lo leía doble). */}
                                                                        {identity
                                                                            ? identity.label
                                                                            : credentialSummary
                                                                            ? isInactive
                                                                                ? LISTING_CREDENTIALS_COPY.excludedHelp
                                                                                : hasOverride
                                                                                    ? "Se reporta con las credenciales de este alojamiento."
                                                                                    : "Sus reservas no se reportan hasta cargarlas."
                                                                            : hasParams
                                                                            ? schema.filter(f => (params[f.key] != null && params[f.key] !== "") || override?.storedSecretKeys?.includes(f.key)).map(f => f.key).join(", ") || "Parámetros sobreescritos"
                                                                            : isInactive
                                                                                ? perListing ? LISTING_CREDENTIALS_COPY.excludedHelp : "La automatización se omite para este alojamiento."
                                                                                : hasOverride
                                                                                    ? "Override activo sin parámetros propios."
                                                                                    : perListing
                                                                                        ? LISTING_CREDENTIALS_COPY.noCredentials
                                                                                        : "Hereda la configuración de la propiedad."}
                                                                        {display.channels && ` · ${display.channels}`}
                                                                    </p>
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="shrink-0"
                                                                    onClick={() => setEditingOverrideAutomation(automation)}
                                                                >
                                                                    {hasOverride ? "Editar" : "Configurar"}
                                                                </Button>
                                                            </Surface>
                                                            {/* Nota backend 2026-11-11: la credencial propia de este
                                                                alojamiento fue rechazada y está en pausa. */}
                                                            {override?.credentialsStatus && (
                                                                <CredentialsRejectedNotice
                                                                    status={override.credentialsStatus}
                                                                    action={
                                                                        <Button type="button" variant="outline" size="sm" onClick={() => setEditingOverrideAutomation(automation)}>
                                                                            <Icon icon={KeyRound} /> Actualizar credenciales
                                                                        </Button>
                                                                    }
                                                                />
                                                            )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </TabsContent>
                                        )}

                                    </Tabs>
                                </div>
                            </DialogBody>

                            <DialogFooter divided>
                                <Button type="button" variant="outline" onClick={closeDialog} disabled={isSavingUnit}>Cancelar</Button>
                                <Button type="button" onClick={() => void handleSaveUnit()} disabled={roomTypesLoading || roomTypes.length === 0} loading={isSavingUnit} loadingLabel="Guardando…">
                                    {editingIndex !== null ? "Guardar cambios" : "Añadir alojamiento"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <DeactivationConfirmDialog
                        target={confirmingUnitDeactivation ? { kind: "listing", name: unitForm.name || "este alojamiento", uuid: (unitForm as { uuid?: string }).uuid } : null}
                        onConfirm={() => {
                            setConfirmingUnitDeactivation(false)
                            void handleSaveUnit({ deactivationConfirmed: true })
                        }}
                        onCancel={() => setConfirmingUnitDeactivation(false)}
                    />

                    {/* Override create/edit modal (live for saved listings, draft otherwise) */}
                    {editingOverrideAutomation && (
                        <AutomationOverrideModal
                            open={!!editingOverrideAutomation}
                            onClose={() => setEditingOverrideAutomation(null)}
                            listingUuid={(unitForm as any).uuid ?? ""}
                            listingName={unitForm.name}
                            propertyAutomations={propertyAutomations}
                            override={listingOverrides[editingOverrideAutomation.uuid] ?? null}
                            lockedPropertyAutomationUuid={editingOverrideAutomation.uuid}
                            draftMode={!(unitForm as any).uuid}
                            credentialSibling={(() => {
                                // SIRE check-in ↔ check-out: se piden una vez y se guardan en las dos.
                                const sibling = findCredentialSibling(editingOverrideAutomation, propertyAutomations)
                                return sibling ? { automation: sibling, override: listingOverrides[sibling.uuid] ?? null } : null
                            })()}
                            onSiblingSaved={(siblingSaved) => {
                                setListingOverrides(prev => ({ ...prev, [siblingSaved.propertyAutomationUuid]: siblingSaved }))
                            }}
                            onSaved={(saved) => {
                                const paUuid = editingOverrideAutomation.uuid
                                const wasRejected = !!listingOverrides[paUuid]?.credentialsStatus
                                setListingOverrides(prev => ({ ...prev, [paUuid]: saved }))
                                // Estaba en pausa y la respuesta no dice si la levantó (la nota
                                // solo garantiza el campo en los GET): se relee este override.
                                const listingUuid = (unitForm as { uuid?: string }).uuid
                                const saveSeq = ++overrideSaveSeqRef.current
                                if (wasRejected && saved.credentialsStatus === undefined && listingUuid) {
                                    // Mismo guardia que la carga del diálogo: si se abrió otra
                                    // unidad (o se volvió a guardar) mientras tanto, la relectura
                                    // ya no es de esta pantalla y no escribe.
                                    const dialogRequest = overridesRequestRef.current
                                    void automationService.listListingOverrides(listingUuid).then((fresh) => {
                                        if (dialogRequest !== overridesRequestRef.current || saveSeq !== overrideSaveSeqRef.current) return
                                        const current = fresh.find((o) => o.propertyAutomationUuid === paUuid)
                                        if (current) setListingOverrides(prev => ({ ...prev, [paUuid]: current }))
                                    }).catch(() => { /* se queda lo guardado; la próxima apertura relee */ })
                                }
                                setEditingOverrideAutomation(null)
                            }}
                            onOverrideChanged={(changed) => {
                                setListingOverrides(prev => ({ ...prev, [editingOverrideAutomation.uuid]: changed }))
                            }}
                            onInheritRestored={() => {
                                setListingOverrides(prev => {
                                    const next = { ...prev }
                                    delete next[editingOverrideAutomation.uuid]
                                    return next
                                })
                                setEditingOverrideAutomation(null)
                            }}
                        />
                    )}
                {/* Las mismas columnas que la pestaña Alojamientos de Propiedades (`listing-columns`). */}
                <DataTable
                    columns={unitColumns}
                    density="comfortable"
                    data={unitRows}
                    getRowId={unitRowId}
                    // Sin búsqueda: editar o borrar un alojamiento no cambia de página.
                    resetPageOn="units"
                    renderMobileRow={renderUnitMobileRow}
                    pageSize={10}
                    itemLabel={UNITS_LABEL}
                    empty={
                        <EmptyState
                            title="Aún no hay alojamientos"
                            description="Añade el primero para poder recibir reservas."
                        />
                    }
                />

            <AlertDialog
                open={unitToDelete !== null}
                // Mientras se borra no se cierra: el resultado tiene que verse.
                onOpenChange={(open) => { if (!open && !isDeletingUnit) setUnitToDelete(null) }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar este alojamiento?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se elimina <span className="font-semibold text-ink">{unitToDelete?.name}</span> de
                            esta propiedad. Sus reservas se conservan, pero quedan sin alojamiento y no podrás
                            enviarles el link de check-in.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {/* Solo si está activo: uno inactivo ya no se puede «desactivar». */}
                    {unitToDelete?.isActive && (
                        <p className="text-sm text-ink-2">
                            Si prefieres dejar de operarlo sin eliminarlo, puedes desactivarlo; un alojamiento
                            inactivo se puede reactivar.
                        </p>
                    )}
                    <AlertDialogFooter>
                        {/* Radix enfoca «Cancelar» al abrir: eliminar exige un clic deliberado. */}
                        <AlertDialogCancel disabled={isDeletingUnit}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className={buttonVariants({ variant: "destructive" })}
                            keepOpen
                            pending={isDeletingUnit}
                            pendingLabel="Eliminando…"
                            onClick={() => void confirmRemoveUnit()}
                        >
                            Eliminar alojamiento
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            </>
        </SectionCard>
    )
}
