# Roadmap de Implementación — Check-in v4.0 (Alineación Final)

> Cierra los gaps entre el estado actual del frontend y el spec definitivo del backend.
>
> **Fecha:** 2025-05-22  
> **Estado:** Aprobado para implementación  
> **Prerequisito:** Sesiones anteriores completaron: tipos base, `getPortal()`, `identify()`, `useIdentifySession`, refactor de las 10 páginas

---

## Inventario del estado actual

### ✅ Ya implementado y alineado
| Elemento | Detalle |
|---|---|
| `getPortal()` / `identify()` | Endpoints correctos, mocks funcionales |
| `IdentifyPayload` | 6 campos correctos: `name`, `lastname`, `isMainGuest`, etc. |
| `VerificationDirective` | Union type `"session" \| "document_upload" \| "verified_ok"` |
| Routing por `verification.type` | IdentifyScreen → decide ruta correctamente |
| `useIdentifySession` | Persiste en localStorage con TTL 2h |
| `VerifyScreen` | Didit redirect + Textract upload + polling + retry |
| `IdentifyScreen` | Manejo 422, 404, field errors |
| 10 páginas migradas | Todas usan `getPortal()` o `reservationUuid` como prop |

### ❌ Gaps a cerrar (8 gaps + 4 faltantes)

```
G-NEW-1  Endpoint /main/complete (payload profile + extra + signature)
G-NEW-2  Endpoint /secondary/{guestUuid}/complete
G-NEW-3  Endpoint /secondary/{guestUuid}/documents + paso de confirmación OCR
G-NEW-4  Endpoint GET /form/{guestUuid} (formulario dinámico)
G-NEW-5  Polling via portal endpoint (no dedicated status endpoint)
G-NEW-6  CheckinPortalResponse shape (guests, mainGuestCompleted, listingName)
G-NEW-7  FormSchema shape (requiredFields/optionalFields/prefilledData)
G-NEW-8  Error 403 en IdentifyScreen (secondary antes de main)
FALT-1   ContractScreen → usa reservation.uuid legacy
FALT-2   SuccessScreen → usa CheckinReservation legacy
FALT-3   SecondaryGuestFormScreen → usa reservation + guestToken legacy
FALT-4   SecondarySuccessScreen → usa CheckinReservationV4 legacy
```

---

## Fases de Implementación

### FASE 1 — Tipos y Contratos de Datos
**Objetivo:** Alinear todos los tipos TypeScript con el spec v4.0 real.  
**Impacto:** Romperá compilación temporalmente — se resuelve en fases siguientes.  
**Archivos:** `src/features/checkin/types/checkin.ts`

#### 1.1 — Actualizar `CheckinPortalResponse` (G-NEW-6)

**Antes:**
```typescript
interface CheckinPortalResponse {
  reservation: { uuid; arrivalDate; departureDate; totalGuestsAllowed }
  progress: { registered; completed; isFullyCompleted }
  registeredGuests: RegisteredGuest[]
}
```

**Después:**
```typescript
interface CheckinPortalResponse {
  reservation: {
    uuid: string
    listingName: string           // ← NUEVO
    arrivalDate: string
    departureDate: string
    totalGuests: number           // ← renombrado de totalGuestsAllowed
    isCheckinCompleted: boolean   // ← reemplaza progress.isFullyCompleted
  }
  guests: PortalGuest[]          // ← renombrado de registeredGuests
  mainGuestCompleted: boolean    // ← NUEVO (flag de gate)
}

interface PortalGuest {
  uuid: string
  isMainGuest: boolean
  isCheckinCompleted: boolean
  name: string | null            // null si aún no identificado
  verificationStatus?: string    // ← NUEVO (para polling G-NEW-5)
}
```

#### 1.2 — Actualizar `FormSchema` (G-NEW-7)

**Antes:**
```typescript
interface FormSchema {
  fields: FormFieldSchema[]  // array de { key, type, required, source }
}
```

**Después:**
```typescript
interface FormSchema {
  requiredFields: string[]       // ["countryOfOriginId", "reasonForTripId"]
  optionalFields: string[]       // ["cityOfOrigin"]
  prefilledData: Record<string, unknown>  // datos del backend para pre-fill
}
```

Borrar `FormFieldSchema` — ya no se necesita.

#### 1.3 — Agregar tipos para completion (G-NEW-1, G-NEW-2)

```typescript
interface CompleteMainGuestPayload {
  guestUuid: string
  profile: {
    name: string
    lastname: string
    email: string
    phone: string
    dateOfBirth: string
    genderId: number | null
    nationalityId: number
    cityOfResidence?: string
    countryOfResidenceId?: number
  }
  extra: {
    countryOfOriginId?: number
    countryDestinationId?: number
    cityOfOrigin?: string
    reasonForTripId?: number
    documentImage1?: string | null
    documentImage2?: string | null
  }
  signature: string | null       // base64 data URL
}

interface CompleteSecondaryGuestPayload {
  profile: {
    name: string
    lastname: string
    email?: string
    phone?: string
    dateOfBirth: string
    identificationExpiryDate?: string
    nationalityId: number
  }
  extra: {
    countryOfOriginId?: number
    reasonForTripId?: number
  }
}

interface CompleteGuestResponse {
  guest: { uuid: string; name: string; lastname: string }
  reservationGuest: {
    isMainGuest: boolean
    isCheckinCompleted: boolean
  }
  reservation: {
    uuid: string
    isCheckinCompleted: boolean
    checkinCompletedAt?: string
    pendingGuests?: number
  }
}
```

#### 1.4 — Agregar tipo para GET /form/{guestUuid} (G-NEW-4)

```typescript
interface GuestFormSchemaResponse {
  requiredFields: string[]
  optionalFields: string[]
  prefilledData: Record<string, unknown>
  catalogs: {
    reasonsForTrip?: Array<{ id: number; name: string }>
    countries?: Array<{ id: number; name: string }>
  }
}
```

#### 1.5 — Agregar tipo para respuesta de upload OCR (G-NEW-3)

Actualizar `OCRResult`:
```typescript
interface OCRResult {
  extractedData: {
    firstName: string
    lastName: string
    documentNumber: string
    dateOfBirth: string
    expirationDate?: string
  }
  documentTypeDetected: string
  homologatedTypeId: number
}
```

#### 1.6 — Actualizar `IdentifySessionData`

Cambiar el campo `formSchema` para reflejar el nuevo shape:
```typescript
interface IdentifySessionData {
  // ... existentes ...
  formSchema: FormSchema  // ahora usa requiredFields/optionalFields/prefilledData
}
```

**Archivos afectados:** Solo `types/checkin.ts`  
**Estimación:** ~30 min

---

### FASE 2 — Service Layer + Mocks
**Objetivo:** Agregar métodos nuevos, corregir URLs, actualizar mocks.  
**Archivos:** `services/checkin-service.ts`, `data/mock-guest-data.ts`

#### 2.1 — Agregar `completeMainGuest()` (G-NEW-1)

```typescript
async completeMainGuest(
  reservationUuid: string, 
  payload: CompleteMainGuestPayload
): Promise<CompleteGuestResponse> {
  return apiClient.post(
    `${API_BASE}/checkin/${reservationUuid}/main/complete`,
    payload
  )
}
```

#### 2.2 — Agregar `completeSecondaryGuest()` (G-NEW-2)

```typescript
async completeSecondaryGuest(
  reservationUuid: string,
  guestUuid: string,
  payload: CompleteSecondaryGuestPayload
): Promise<CompleteGuestResponse> {
  return apiClient.post(
    `${API_BASE}/checkin/${reservationUuid}/secondary/${guestUuid}/complete`,
    payload
  )
}
```

#### 2.3 — Agregar `getGuestFormSchema()` (G-NEW-4)

```typescript
async getGuestFormSchema(
  reservationUuid: string,
  guestUuid: string
): Promise<GuestFormSchemaResponse> {
  return apiClient.get(
    `${API_BASE}/checkin/${reservationUuid}/form/${guestUuid}`
  )
}
```

#### 2.4 — Corregir URL de `uploadDocumentImages()` (G-NEW-3)

**Antes:** `POST /checkin/${uuid}/guest/${guestUuid}/upload`  
**Después:** `POST /checkin/${uuid}/secondary/${guestUuid}/documents`

Y cambiar keys del FormData a `frontImage` y `backImage` (spec).

#### 2.5 — Deprecar `getVerificationStatus()` + nuevo polling (G-NEW-5)

Agregar helper para polling via portal:
```typescript
async pollGuestVerification(
  reservationUuid: string,
  guestUuid: string
): Promise<{ status: string }> {
  const portal = await this.getPortal(reservationUuid)
  const guest = portal.guests.find(g => g.uuid === guestUuid)
  return { status: guest?.verificationStatus ?? "pending" }
}
```

Marcar `getVerificationStatus()` como `@deprecated`.

#### 2.6 — Actualizar mocks

- `mockPortalResponse()` → retornar shape con `guests`, `mainGuestCompleted`, `listingName`
- `mockIdentifyResponse()` → retornar `formSchema` con `requiredFields/optionalFields/prefilledData`
- Agregar `mockCompleteResponse()` para ambos endpoints
- Agregar `mockFormSchemaResponse()` para GET /form
- Actualizar `mockOCRResult` al nuevo shape con `extractedData.firstName` etc.

#### 2.7 — Deprecar métodos legacy

| Método | Estado |
|---|---|
| `saveGuest()` | `@deprecated` → usar `completeMainGuest()` |
| `saveSecondaryGuest()` | `@deprecated` → usar `completeSecondaryGuest()` |
| `getVerificationStatus()` | `@deprecated` → usar `pollGuestVerification()` |
| `startVerification()` | `@deprecated` → ya no se usa (backend decide en /identify) |

**Estimación:** ~1.5 horas

---

### FASE 3 — Hook: useIdentifySession
**Objetivo:** Adaptar al nuevo FormSchema shape.  
**Archivo:** `hooks/useIdentifySession.ts`

Cambio mínimo: el hook ya guarda `response.formSchema` como viene. Solo necesitamos asegurar que el tipo `FormSchema` importado es el nuevo. Si la Fase 1 se hizo bien, esto compila automáticamente.

**Verificación:** Compilar `tsc --noEmit` después de Fases 1+2.

**Estimación:** ~15 min (mostly verification)

---

### FASE 4 — WelcomeScreen (G-NEW-6 UI)
**Objetivo:** Adaptar al nuevo portal shape + per-guest CTAs.  
**Archivo:** `components/WelcomeScreen.tsx`

#### Cambios:
1. Destructure `{ reservation, guests, mainGuestCompleted }` en lugar de `{ reservation, progress, registeredGuests }`
2. Renombrar `totalGuestsAllowed` → `totalGuests`
3. Mostrar `reservation.listingName` como título de la propiedad
4. Calcular progreso: `guests.filter(g => g.isCheckinCompleted).length / reservation.totalGuests`
5. Renderizar lista de guests con CTAs individuales:
   - Main guest: "Iniciar mi registro" → `/identify`
   - Secondary guest + `mainGuestCompleted=true`: "Iniciar mi registro" → link del secundario
   - Secondary guest + `mainGuestCompleted=false`: badge "🔒 Esperando al titular"
6. Usar `reservation.isCheckinCompleted` en lugar de `progress.isFullyCompleted`

**Estimación:** ~45 min

---

### FASE 5 — GuestFormScreen (G-NEW-4, G-NEW-1)
**Objetivo:** Formulario dinámico via endpoint + submit con estructura profile/extra/signature.  
**Archivo:** `components/GuestFormScreen.tsx`

#### 5.1 — Fetch form schema desde endpoint

En `useEffect`, después de validar `guestUuid`:
```typescript
const schema = await checkinService.getGuestFormSchema(reservationUuid, guestUuid)
```

Usar `schema.requiredFields` y `schema.optionalFields` para determinar qué campos mostrar.
Usar `schema.prefilledData` para pre-llenar el form.
Usar `schema.catalogs` para los selects (en lugar de mock catalogs).

#### 5.2 — Refactorizar helper de campo visible/requerido

```typescript
const isFieldRequired = (key: string) => schema?.requiredFields.includes(key)
const isFieldVisible = (key: string) => 
  schema?.requiredFields.includes(key) || schema?.optionalFields.includes(key)
```

Reemplazar `hasFormField()` / `isSireActive` / `isTraActive` con:
```typescript
const showOriginSection = isFieldVisible('countryOfOriginId') || isFieldVisible('reasonForTripId')
```

#### 5.3 — Cambiar submit: saveGuest → completeMainGuest

Reestructurar payload:
```typescript
const payload: CompleteMainGuestPayload = {
  guestUuid,
  profile: {
    name: form.name,
    lastname: form.lastname,
    email: form.email,
    phone: form.phone,
    dateOfBirth: form.dateOfBirth,
    genderId: form.genderId || null,
    nationalityId: Number(form.nationalityId),
    cityOfResidence: form.cityOfResidence,
    countryOfResidenceId: form.countryOfResidenceId || undefined,
  },
  extra: {
    countryOfOriginId: form.countryOfOriginId || undefined,
    countryDestinationId: form.countryDestinationId || undefined,
    cityOfOrigin: form.cityOfResidence,
    reasonForTripId: form.reasonForTripId || undefined,
    documentImage1: form.documentImage1,
    documentImage2: form.documentImage2,
  },
  signature: null, // Se captura en ContractScreen
}
```

**Nota:** La firma se captura en ContractScreen. GuestFormScreen navega a `/contract`.

#### 5.4 — Post-submit routing

Si backend devuelve `CompleteGuestResponse`:
- `reservation.isCheckinCompleted = true` → directo a `/success`
- else → `/contract` (main) o `/success` (si no hay contrato)

**Estimación:** ~2 horas

---

### FASE 6 — ContractScreen + Completion Flow (FALT-1)
**Objetivo:** Integrar firma con el endpoint de complete.  
**Archivo:** `components/ContractScreen.tsx`

#### Cambios:
1. Cambiar prop `reservation: any` → `reservationUuid: string`
2. Usar `checkinService.getContractTemplate(reservationUuid)` (ya correcto)
3. En `handleComplete`:
   - Leer datos del form de localStorage
   - Llamar `checkinService.completeMainGuest()` con el payload completo incluyendo `signature`
   - O bien: enviar solo `{ guestUuid, signature, acceptedTerms: true }` si el backend ya tiene los datos del form del step anterior

#### Actualizar página `contract/page.tsx`:
```typescript
// De:
const reservation = await checkinService.getReservation(...)
return <ContractScreen reservation={reservation} basePath={basePath} />

// A:
return <ContractScreen reservationUuid={resolvedParams.reference} basePath={basePath} />
```

**Estimación:** ~45 min

---

### FASE 7 — VerifyScreen (G-NEW-3, G-NEW-5)
**Objetivo:** Corregir URL upload + polling + paso de confirmación OCR.  
**Archivo:** `components/VerifyScreen.tsx`

#### 7.1 — Fix URL de upload

Cambiar `checkinService.uploadDocumentImages()` invocación. La URL se corrige en el service (Fase 2.4), no en el componente.

#### 7.2 — Paso de confirmación de datos extraídos (Screen 2B-2)

Después de upload exitoso, en lugar de ir directo a polling:
1. Recibir `OCRResult` con `extractedData`
2. Mostrar nuevo estado `"confirm_ocr"` con los datos extraídos en un mini-form editable
3. Guest puede corregir → guardar datos corregidos en session/localStorage
4. Continuar a form screen con datos pre-filled

Agregar estado: `"idle" | "verifying" | "polling" | "confirm_ocr" | "failed"`

#### 7.3 — Polling via portal (G-NEW-5)

Cambiar:
```typescript
// De:
const status = await checkinService.getVerificationStatus(reservationUuid, guestUuid)

// A:
const result = await checkinService.pollGuestVerification(reservationUuid, guestUuid)
```

**Estimación:** ~1.5 horas

---

### FASE 8 — IdentifyScreen (G-NEW-8)
**Objetivo:** Manejar error 403.  
**Archivo:** `components/IdentifyScreen.tsx`

Agregar case en el `catch`:
```typescript
} else if (e.status === 403) {
    toast.error("El huésped principal debe completar su registro primero")
    router.push(basePath)
}
```

Insertar antes del `else if (e.errors)` existente.

**Estimación:** ~10 min

---

### FASE 9 — SecondaryGuestFormScreen (G-NEW-2, FALT-3)
**Objetivo:** Migrar de `reservation + guestToken` a `reservationUuid + guestUuid`.  
**Archivo:** `components/SecondaryGuestFormScreen.tsx`

#### Cambios:
1. Props: `{ reservation, guestToken, basePath }` → `{ reservationUuid, basePath }`
2. Leer `guestUuid` de `searchParams` (como el main flow)
3. Leer `useIdentifySession` para nombre, formSchema pre-filled
4. Fetch `getGuestFormSchema(reservationUuid, guestUuid)` para campos dinámicos
5. Submit con `completeSecondaryGuest(reservationUuid, guestUuid, payload)`
6. Post-submit: leer `response.reservation.isCheckinCompleted`:
   - `true` → todos completaron → `/success`
   - `false` → confirmación individual

#### Actualizar página `s/[guestToken]/guest/page.tsx`:
```typescript
// De:
return <SecondaryGuestFormScreen reservation={status.reservation} guestToken={...} basePath={...} />

// A:
return <SecondaryGuestFormScreen reservationUuid={resolvedParams.reference} basePath={basePath} />
```

**Estimación:** ~1.5 horas

---

### FASE 10 — SuccessScreen + SecondarySuccessScreen (FALT-2, FALT-4)
**Objetivo:** Migrar de `CheckinReservation` legacy a portal response.  
**Archivos:** `SuccessScreen.tsx`, `SecondarySuccessScreen.tsx`

#### SuccessScreen:
1. Props: `{ reservation: CheckinReservation }` → `{ reservationUuid: string }`
2. Fetch `getPortal(reservationUuid)` en useEffect para mostrar datos de reserva
3. Usar `portal.reservation.listingName` (ya disponible)
4. Mostrar SmartLock codes si están en el response de complete

#### SecondarySuccessScreen:
1. Props: `{ reservation: CheckinReservationV4 }` → `{ reservationUuid: string }`
2. Similar: fetch portal para datos básicos
3. Sin SmartLock codes (solo main los recibe)

#### Actualizar páginas:
- `success/page.tsx` → pasar `reservationUuid`
- `s/[guestToken]/success/page.tsx` → pasar `reservationUuid`
- `[listingUuid]/[externalId]/success/page.tsx` → pasar `reservationUuid`

**Estimación:** ~1 hora

---

### FASE 11 — Limpieza y Verificación Final
**Objetivo:** Eliminar legacy, verificar compilación, cleanup.

#### 11.1 — Eliminar rutas companions (si existen)

```
src/app/(guest)/checkin/[reference]/companions/page.tsx
src/app/(guest)/checkin/[reference]/[listingUuid]/[externalId]/companions/page.tsx
```

#### 11.2 — Eliminar tipos deprecated

Después de que NINGÚN componente use los tipos legacy:
- `RegisteredGuest` → reemplazado por `PortalGuest`
- `FormFieldSchema` → eliminada
- `CheckinReservationV4.verificationProvider` → ya no se usa
- `CheckinReservationV4.secondaryGuestProvider` → ya no se usa

#### 11.3 — Eliminar métodos deprecated del service

- `saveGuest()` → reemplazado por `completeMainGuest()`
- `saveSecondaryGuest()` → reemplazado por `completeSecondaryGuest()`
- `getVerificationStatus()` → reemplazado por `pollGuestVerification()`
- `startVerification()` → eliminado
- `resolveIdentity()` → eliminado
- `getReservation()` → eliminado (ya marcado deprecated)

#### 11.4 — Verificación

```bash
npx tsc --noEmit       # cero errores
npx next build         # build exitoso
```

#### 11.5 — Checklist funcional

| Flujo | Validar |
|---|---|
| Main: Portal → Identify → Verify (Didit) → Form → Contract → Success | Completo |
| Main: Portal → Identify → Verify (Textract + confirm OCR) → Form → Contract → Success | Completo |
| Main: Portal → Identify → verified_ok → Form → Contract → Success | Skip verify |
| Secondary: Gate bloqueado → main completa → Gate OK → Identify → Verify → Form → Success | Gate funciona |
| Secondary: Identify antes de main → 403 → mensaje claro | Error manejado |
| Reserva con max guests → 422 → mensaje claro | Error manejado |
| Reserva no encontrada → 404 → fallback UI | Error manejado |
| Todos completan → `isCheckinCompleted = true` → pantalla final | Completo |

**Estimación:** ~1 hora

---

## Orden de ejecución y dependencias

```
FASE 1 (tipos)
   │
   ├─── FASE 2 (service + mocks) ← depende de tipos
   │       │
   │       ├─── FASE 3 (hook) ← verificar compilación
   │       │
   │       ├─── FASE 4 (WelcomeScreen) ← usa nuevos tipos portal
   │       │
   │       ├─── FASE 5 (GuestFormScreen) ← usa getGuestFormSchema + completeMainGuest
   │       │       │
   │       │       └─── FASE 6 (ContractScreen) ← depende de flow de GuestForm
   │       │
   │       ├─── FASE 7 (VerifyScreen) ← usa pollGuestVerification + OCR confirm
   │       │
   │       ├─── FASE 8 (IdentifyScreen 403) ← independiente, quick fix
   │       │
   │       ├─── FASE 9 (SecondaryGuestForm) ← usa completeSecondaryGuest
   │       │
   │       └─── FASE 10 (Success screens) ← usa portal response
   │
   └─── FASE 11 (limpieza) ← después de TODO compilando
```

**Fases paralelas posibles:**
- Fases 4, 7, 8 son independientes entre sí
- Fases 5+6 son secuenciales
- Fase 9 es independiente de 5+6
- Fase 10 es independiente

---

## Resumen de estimaciones

| Fase | Esfuerzo | Prioridad |
|---|---|---|
| **Fase 1** — Tipos | 30 min | 🔴 P0 |
| **Fase 2** — Service + mocks | 1.5 h | 🔴 P0 |
| **Fase 3** — Hook verificación | 15 min | 🔴 P0 |
| **Fase 4** — WelcomeScreen | 45 min | 🟡 P1 |
| **Fase 5** — GuestFormScreen | 2 h | 🔴 P0 |
| **Fase 6** — ContractScreen | 45 min | 🔴 P0 |
| **Fase 7** — VerifyScreen | 1.5 h | 🟡 P1 |
| **Fase 8** — IdentifyScreen 403 | 10 min | 🟡 P1 |
| **Fase 9** — SecondaryGuestForm | 1.5 h | 🔴 P0 |
| **Fase 10** — Success screens | 1 h | 🟡 P1 |
| **Fase 11** — Limpieza | 1 h | 🟢 P2 |
| **Total** | **~11 horas** | |

---

## Archivos modificados por fase

```
Fase 1:  types/checkin.ts
Fase 2:  services/checkin-service.ts, data/mock-guest-data.ts
Fase 3:  hooks/useIdentifySession.ts
Fase 4:  components/WelcomeScreen.tsx
Fase 5:  components/GuestFormScreen.tsx
Fase 6:  components/ContractScreen.tsx, contract/page.tsx (×3 rutas)
Fase 7:  components/VerifyScreen.tsx
Fase 8:  components/IdentifyScreen.tsx (1 línea)
Fase 9:  components/SecondaryGuestFormScreen.tsx, s/[guestToken]/guest/page.tsx
Fase 10: components/SuccessScreen.tsx, SecondarySuccessScreen.tsx, success/page.tsx (×3)
Fase 11: Eliminar archivos companions, deprecated types/methods
```

## Archivos NO tocados (ya alineados)

```
hooks/useLocalStorage.ts
components/StepIndicator.tsx
components/SearchableSelect.tsx
components/FormInput.tsx
components/CollapsibleSection.tsx
components/DocumentUpload.tsx
components/SecondaryGateScreen.tsx
data/constants.ts
```
