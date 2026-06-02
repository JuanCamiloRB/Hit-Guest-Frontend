# Plan de Implementación — Check-in Online v4.0

> Alineación del frontend con la especificación `260506_hitguest-checkin-workflow-v4.html`

**Fecha:** 2025-05-19  
**Estado:** Planificación  
**Referencia:** Spec v4.0 (Charlas 1–8)

---

## Resumen Ejecutivo

La implementación actual cubre la estructura base (rutas, componentes, types, services, mock data) pero presenta **3 violaciones directas** del spec v4.0 y varias discrepancias moderadas. Este plan detalla las correcciones necesarias organizadas en fases.

---

## Fase 0 — Limpieza y Preparación

### 0.1 Eliminar CompanionsScreen del flujo principal

**Spec:** *"Ya no registra datos de secundarios. Cada guest secundario se registra de forma autónoma."*

| Acción | Detalle |
|---|---|
| Eliminar ruta `/checkin/[reference]/companions/page.tsx` | Ya no forma parte del flujo main |
| Eliminar ruta `/checkin/[reference]/[listingUuid]/[externalId]/companions/page.tsx` | Idem |
| Eliminar `CompanionsScreen.tsx` del barrel de componentes | Se reemplaza por flujo autónomo |
| Actualizar navegación de `ContractScreen` → `SuccessScreen` | El flujo main ya no pasa por companions |

> **Nota:** `CompanionsScreen.tsx` se conserva en el repo (no se borra el archivo) hasta que el flujo autónomo lo reemplace. Se eliminan las rutas que lo montan.

### 0.2 Extraer constante STEPS compartida

| Acción | Detalle |
|---|---|
| Crear `src/features/checkin/constants/steps.ts` | Define `MAIN_GUEST_STEPS` y `SECONDARY_GUEST_STEPS` |
| Reemplazar la constante local en cada componente | Import desde `constants/steps.ts` |

```typescript
// src/features/checkin/constants/steps.ts
export const MAIN_GUEST_STEPS = [
  { label: "Bienvenida", key: "welcome" },
  { label: "Identidad", key: "identify" },
  { label: "Verificación", key: "verify" },
  { label: "Datos", key: "guest" },
  { label: "Contrato", key: "contract" },
  { label: "Listo", key: "success" },
]

export const SECONDARY_GUEST_STEPS = [
  { label: "Identidad", key: "identify" },
  { label: "Verificación", key: "verify" },
  { label: "Datos", key: "guest" },
  { label: "Listo", key: "success" },
]
```

### 0.3 Eliminar/migrar flujo legacy `/r/[token]`

| Acción | Detalle |
|---|---|
| Evaluar si Guest Hub (`/r/[token]/page.tsx`) se conserva como landing | Es un buen concepto UX pero no está en el spec |
| Eliminar `/r/[token]/checkin/guests/page.tsx` | Flujo viejo hardcoded |
| Eliminar `/r/[token]/checkin/identity/page.tsx` | Scan simulado sin service |
| Eliminar `/r/[token]/checkin/success/page.tsx` | Success básico sin data real |
| Decisión: ¿mantener Guest Hub como wrapper para el flujo nuevo? | Requiere decisión de producto |

---

## Fase 1 — Main Guest Flow (Alineación con Spec)

### 1.1 Flujo de 4 pasos funcionales (6 screens)

El spec define 4 pasos funcionales. El frontend los presenta en 6 pantallas por UX:

```
Spec Step 1 (Resolve Identity) → Screen: Welcome + Identify
Spec Step 2 (Verify Identity)  → Screen: Verify  
Spec Step 3 (Data + Signature) → Screen: GuestForm + Contract
Spec Step 4 (Close + Triggers) → Screen: Success
```

**Decisión UX:** Mantener 6 pantallas es válido. La separación de GuestForm y Contract mejora la UX mobile. Documentar esta decisión.

### 1.2 VerifyScreen — Árbol de decisión Didit

**Spec:**
```
1. Face Match Biométrico (SIEMPRE primero)
2. ¿Didit encontró datos?
   → NO match: KYC completo
   → SÍ match: ¿Docs vigentes?
       → Vigentes: Aprobado SIN KYC (pre-fill form)
       → Vencidos: Pasar a KYC
3. KYC → webhook → datos → pre-fill form
```

| Acción | Detalle |
|---|---|
| Refactorizar `VerifyScreen.tsx` | Implementar máquina de estados: `idle → face_match → awaiting_result → kyc_needed → kyc_in_progress → approved / rejected` |
| Agregar estado `skipKyc` | Cuando Face Match encuentra datos vigentes |
| Agregar UI condicional por estado | Face Match UI, KYC redirect UI, success sin KYC UI |
| Actualizar `checkinService.startVerification()` | Debe aceptar `phase: "face_match" | "kyc"` |
| Agregar `checkinService.getFaceMatchResult()` | Nuevo método para consultar resultado del face match |

**Máquina de estados propuesta:**

```typescript
type VerificationState =
  | { phase: "idle" }
  | { phase: "face_match_started"; sessionUrl?: string }
  | { phase: "face_match_result"; hasData: boolean; docsValid: boolean }
  | { phase: "kyc_required"; reason: "no_match" | "docs_expired" }
  | { phase: "kyc_in_progress"; sessionUrl?: string }
  | { phase: "approved"; preFilledData: Partial<GuestFormData> }
  | { phase: "rejected"; reason: string }
```

### 1.3 VerifyScreen — Flujo Textract

| Acción | Detalle |
|---|---|
| Implementar `<input type="file" accept="image/*" capture="environment">` real | Actualmente solo simula |
| Subir foto frontal (obligatoria) + posterior (opcional para pasaporte) | UX mobile-first |
| Mostrar preview de imagen capturada | Antes de enviar |
| Enviar a `checkinService.uploadDocumentImages()` | Nuevo método |
| Recibir resultado OCR → pre-fill form | Datos extraídos del documento |

### 1.4 Formulario dinámico por automatizaciones

**Spec:** Los campos del formulario dependen de las automatizaciones activas en la propiedad.

| Campo | Automatización que lo requiere |
|---|---|
| `country_of_origin_id` | SIRE |
| `country_destination_id` | SIRE |
| `city_of_origin` | SIRE |
| `reason_for_trip_id` | TRA |
| `document_image_1/2` | Verificación (siempre) |
| Campos básicos (nombre, doc, etc.) | Siempre |

| Acción | Detalle |
|---|---|
| Agregar `activeAutomations` al response de `getReservation()` | Lista de automations activas con sus `checkinFields` |
| Crear helper `getRequiredFields(automations)` | Retorna qué campos mostrar |
| Condicionar secciones del form según fields requeridos | Sección "Origen y destino" solo si SIRE/TRA activos |
| Actualizar validación `isFormValid` dinámicamente | Solo valida campos visibles |

**Tipo propuesto:**
```typescript
interface ActiveAutomation {
  id: number
  name: string
  providerName: string
  checkinFields: string[] // campos que esta automation necesita
  triggerTypes: string[]
}

// En CheckinReservation agregar:
activeAutomations: ActiveAutomation[]
```

### 1.5 Homologación de tipo de documento

| Acción | Detalle |
|---|---|
| Agregar `docTypeMapping` al response del provider | Viene de `providers.parameters.docTypeMapping` |
| Crear utility `mapProviderDocType(providerType: string, mapping): number` | Retorna catalog_id |
| Aplicar en pre-fill del form después de verificación | Auto-selecciona el tipo de doc correcto |

### 1.6 Provider configurable por guest_type

| Acción | Detalle |
|---|---|
| Cambiar `reservation.mainGuestProvider` → `reservation.verificationProvider` | Resuelto por backend según guest_type |
| El backend determina el provider al llamar `startVerification()` | Basado en `property_automations.parameters.guest_type` |
| Frontend no necesita lógica de selección | Solo recibe qué provider usar |

---

## Fase 2 — Flujo Autónomo de Guests Secundarios

### 2.1 Estructura de rutas

```
/checkin/[reference]/s/[guestToken]/           → GateScreen (bloqueado si main no completó)
/checkin/[reference]/s/[guestToken]/identify    → IdentifyScreen (reutilizado)
/checkin/[reference]/s/[guestToken]/verify      → VerifyScreen (reutilizado)
/checkin/[reference]/s/[guestToken]/guest       → SecondaryGuestFormScreen (simplificado)
/checkin/[reference]/s/[guestToken]/success     → SecondarySuccessScreen
```

### 2.2 Gate Screen (nuevo componente)

```typescript
// src/features/checkin/components/SecondaryGateScreen.tsx
interface SecondaryGateScreenProps {
  reservation: CheckinReservation
  guestToken: string
  mainGuestCompleted: boolean
}
```

| Estado | UI |
|---|---|
| Main guest NO completó | Mensaje "El titular debe completar primero su check-in" + countdown/refresh |
| Main guest SÍ completó | Redirect automático a `/identify` |

### 2.3 Secondary Guest Form (simplificado)

Diferencias con el form del main guest:
- **NO** tiene firma de contrato (solo el main firma)
- **NO** necesita todos los campos del main
- Campos según automatizaciones activas (SIRE, TRA)
- Sin sección de "Información de viaje" opcional

| Acción | Detalle |
|---|---|
| Crear `SecondaryGuestFormScreen.tsx` | Form simplificado sin firma |
| Reutilizar `SearchableSelect`, `DocumentUpload` | Componentes compartidos |
| Campos requeridos: doc, nombre, fecha nacimiento, + automation fields | Menos campos que main |

### 2.4 Secondary Success Screen

| Acción | Detalle |
|---|---|
| Crear `SecondarySuccessScreen.tsx` | Sin smartlock codes (solo el main los recibe) |
| Mostrar confirmación simple | "Tu registro ha sido completado" |
| No mostrar contrato | El contrato es entre PM y main guest |

### 2.5 Service methods para secundarios

| Método | Descripción |
|---|---|
| `getSecondaryContext(reservationUuid, guestToken)` | Retorna: reservation info + main guest status + provider para secundarios |
| `resolveIdentity()` | Reutilizado (mismo endpoint) |
| `startVerification()` | Reutilizado (backend resuelve provider por guest_type) |
| `saveSecondaryGuest()` | Guarda datos del secundario (sin firma) |

### 2.6 Generación de links para secundarios

El backend genera un `guestToken` único por cada secondary guest slot. El main guest o el PM envía estos links:

```
https://app.hitguest.com/checkin/{reservation_uuid}/s/{guest_token}
```

---

## Fase 3 — Verificación de Identidad Robusta

### 3.1 Refactorizar a hook `useVerificationFlow`

```typescript
// src/features/checkin/hooks/useVerificationFlow.ts
interface UseVerificationFlowOptions {
  reservationUuid: string
  guestUuid: string
  provider: "didit" | "textract" | "metamap"
}

interface UseVerificationFlowReturn {
  state: VerificationState
  startFaceMatch: () => Promise<void>
  startKYC: () => Promise<void>
  uploadDocuments: (front: File, back?: File) => Promise<void>
  pollStatus: () => Promise<void>
  preFilledData: Partial<GuestFormData> | null
}
```

### 3.2 Polling real con exponential backoff

| Acción | Detalle |
|---|---|
| Crear `useVerificationPolling.ts` | Hook con polling cada 3s → 5s → 10s → 15s (max 2 min) |
| Timeout con fallback | Si no responde en 2 min → "Verificación pendiente, te notificaremos" |
| Cancelación al desmontar | Cleanup del interval |

### 3.3 Textract — Implementar captura real

| Acción | Detalle |
|---|---|
| Agregar `<input type="file" accept="image/*" capture="environment">` | Abre cámara en mobile |
| Comprimir imagen antes de enviar | Max 2MB, calidad 80% |
| Preview con opción de re-tomar | UX para asegurar legibilidad |
| Progress bar real basado en upload | No simulada |

---

## Fase 4 — Completar rutas faltantes

### 4.1 Ruta externa — agregar pasos faltantes

```
/checkin/[reference]/[listingUuid]/[externalId]/identify/page.tsx    ← CREAR
/checkin/[reference]/[listingUuid]/[externalId]/verify/page.tsx      ← CREAR
/checkin/[reference]/[listingUuid]/[externalId]/contract/page.tsx    ← CREAR
```

Cada una sigue el mismo patrón que las rutas por UUID:
```typescript
export default async function Page({ params }) {
  const reservation = await checkinService.getReservationByExternal(...)
  const basePath = `/checkin/${params.reference}/${params.listingUuid}/${params.externalId}`
  return <Component reservation={reservation} basePath={basePath} />
}
```

---

## Fase 5 — Hooks y Persistencia

### 5.1 useLocalStorage hook

```typescript
// src/features/checkin/hooks/useLocalStorage.ts
// Persiste datos del formulario para no perder progreso si el usuario cierra/recarga
// Key: `checkin_${reservationUuid}_${guestUuid}_form`
// TTL: 24 horas
```

### 5.2 useCheckinFlow hook (orquestador)

```typescript
// src/features/checkin/hooks/useCheckinFlow.ts
// Maneja el estado global del flujo:
// - currentStep
// - guestUuid (resuelto en step 1)
// - verificationStatus
// - formData (persisted)
// - Navegación entre pasos
```

---

## Fase 6 — Ajustes de Types y Service

### 6.1 Actualizar `CheckinReservation`

```typescript
interface CheckinReservation {
  // ... campos existentes ...
  
  // NUEVOS (alineación spec v4)
  activeAutomations: ActiveAutomation[]
  verificationProvider: "didit" | "textract" | "metamap" // resuelto por backend
  secondaryGuestProvider: "didit" | "textract" | "metamap"
  mainGuestCompleted: boolean
  propertyCountryId: number // para isForeign() si se necesita en frontend
}
```

### 6.2 Nuevos métodos en CheckinService

```typescript
class CheckinService {
  // EXISTENTES (mantener)
  getReservation(reference: string): Promise<CheckinReservation>
  resolveIdentity(uuid: string, payload: any): Promise<IdentityResolution>
  startVerification(uuid: string, guestUuid: string, provider: string): Promise<any>
  getVerificationStatus(uuid: string, guestUuid: string): Promise<VerificationResult>
  saveGuest(uuid: string, payload: any): Promise<any>
  completeGuest(uuid: string, guestUuid: string, payload: any): Promise<CheckinCompletionResponse>
  getContractTemplate(uuid: string): Promise<ContractTemplate>

  // NUEVOS
  getFaceMatchResult(uuid: string, guestUuid: string): Promise<FaceMatchResult>
  uploadDocumentImages(uuid: string, guestUuid: string, images: FormData): Promise<OCRResult>
  getSecondaryGateStatus(uuid: string, guestToken: string): Promise<SecondaryGateStatus>
  saveSecondaryGuest(uuid: string, guestToken: string, payload: any): Promise<any>
  getActiveAutomations(uuid: string): Promise<ActiveAutomation[]>
}
```

### 6.3 Nuevos tipos

```typescript
interface FaceMatchResult {
  matched: boolean
  hasExistingData: boolean
  docsValid: boolean
  docsExpiryDate?: string
  preFilledData?: Partial<GuestFormData>
}

interface OCRResult {
  success: boolean
  extractedData: Partial<GuestFormData>
  confidence: number
  mappedDocTypeId: number // homologado a catálogo HitGuest
}

interface SecondaryGateStatus {
  mainGuestCompleted: boolean
  mainGuestName?: string
  reservation: CheckinReservation
  guestToken: string
}

interface ActiveAutomation {
  id: number
  name: string
  providerName: string
  checkinFields: string[]
  triggerTypes: string[]
  guestType: "main" | "secondary" | "all"
}
```

---

## Cronograma Sugerido

| Fase | Prioridad | Esfuerzo | Dependencia |
|---|---|---|---|
| **Fase 0** — Limpieza | 🔴 P0 | 2-3 horas | Ninguna |
| **Fase 1** — Main Guest alineado | 🔴 P0 | 8-12 horas | Fase 0 |
| **Fase 2** — Secundarios autónomos | 🔴 P0 | 6-8 horas | Fase 1.2 (verify) |
| **Fase 3** — Verificación robusta | 🟡 P1 | 6-8 horas | Backend endpoints |
| **Fase 4** — Rutas faltantes | 🟡 P1 | 1-2 horas | Fase 1 |
| **Fase 5** — Hooks y persistencia | 🟢 P2 | 4-5 horas | Fase 1+2 |
| **Fase 6** — Types y service | 🟡 P1 | 3-4 horas | En paralelo con Fase 1 |

**Total estimado:** ~30-42 horas de desarrollo frontend

---

## Decisiones Pendientes (requieren input de producto)

1. **¿Mantener 6 pantallas o unificar Form + Contract en 1?** — El spec dice 1 paso, el UX actual usa 2 pantallas
2. **¿Mantener Guest Hub (`/r/[token]`) como landing?** — Buen concepto pero no está en spec
3. **¿Quién envía los links de secundarios?** — ¿El main guest desde su Success screen? ¿El PM desde admin?
4. **¿Mostrar badge "Extranjero" en el frontend?** — `isForeign()` es backend, ¿se refleja en UI?
5. **¿Timeout de verificación Didit?** — ¿Qué pasa si el guest abandona la verificación a medio camino?

---

## Archivos a Crear

```
src/features/checkin/constants/steps.ts
src/features/checkin/hooks/useVerificationFlow.ts
src/features/checkin/hooks/useVerificationPolling.ts
src/features/checkin/hooks/useCheckinFlow.ts
src/features/checkin/hooks/useLocalStorage.ts
src/features/checkin/components/SecondaryGateScreen.tsx
src/features/checkin/components/SecondaryGuestFormScreen.tsx
src/features/checkin/components/SecondarySuccessScreen.tsx
src/app/(guest)/checkin/[reference]/s/[guestToken]/page.tsx
src/app/(guest)/checkin/[reference]/s/[guestToken]/identify/page.tsx
src/app/(guest)/checkin/[reference]/s/[guestToken]/verify/page.tsx
src/app/(guest)/checkin/[reference]/s/[guestToken]/guest/page.tsx
src/app/(guest)/checkin/[reference]/s/[guestToken]/success/page.tsx
src/app/(guest)/checkin/[reference]/[listingUuid]/[externalId]/identify/page.tsx
src/app/(guest)/checkin/[reference]/[listingUuid]/[externalId]/verify/page.tsx
src/app/(guest)/checkin/[reference]/[listingUuid]/[externalId]/contract/page.tsx
```

## Archivos a Modificar

```
src/features/checkin/types/checkin.ts                    → Nuevos tipos
src/features/checkin/services/checkin-service.ts         → Nuevos métodos
src/features/checkin/data/mock-guest-data.ts             → Nuevos mocks
src/features/checkin/components/VerifyScreen.tsx          → Árbol Didit + Textract real
src/features/checkin/components/GuestFormScreen.tsx       → Campos dinámicos
src/features/checkin/components/DocumentUpload.tsx        → Input file real
src/features/checkin/components/WelcomeScreen.tsx         → Import STEPS compartido
src/features/checkin/components/IdentifyScreen.tsx        → Import STEPS compartido
src/features/checkin/components/ContractScreen.tsx        → Import STEPS compartido
src/features/checkin/components/SuccessScreen.tsx         → Import STEPS compartido
```

## Archivos a Eliminar (rutas)

```
src/app/(guest)/checkin/[reference]/companions/page.tsx
src/app/(guest)/checkin/[reference]/[listingUuid]/[externalId]/companions/page.tsx
src/app/(guest)/r/[token]/checkin/guests/page.tsx        → Legacy
src/app/(guest)/r/[token]/checkin/identity/page.tsx      → Legacy
src/app/(guest)/r/[token]/checkin/success/page.tsx       → Legacy
```
