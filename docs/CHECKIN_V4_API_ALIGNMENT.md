# Alineación Frontend ↔ API Real — Check-in v4.0

> Documento de arquitectura que mapea los endpoints reales del backend con la implementación frontend.  
> Basado en el spec `260506_hitguest-checkin-workflow-v4.html` y los endpoints confirmados por backend.

**Fecha:** 2025-05-22  
**Estado:** Referencia activa  
**Prioridad:** Este documento reemplaza las asunciones del plan anterior.

---

## 1. Endpoints Reales Confirmados

### 1.1 GET `/api/v1/checkin/{reservationUuid}` — Portal / Welcome

Trae la info de la reserva cuando el link de checkin llega vía PMS o API.

**Response real (del backend):**

```json
{
  "reservation": {
    "uuid": "019d4f00-...",
    "arrivalDate": "2026-05-15",
    "departureDate": "2026-05-20",
    "totalGuestsAllowed": 3
  },
  "progress": {
    "registered": 1,
    "completed": 0,
    "isFullyCompleted": false
  },
  "registeredGuests": [
    {
      "uuid": "guest-uuid-...",
      "name": "Ricardo",
      "lastname": "Lombana",
      "isMain": true,
      "isCompleted": false
    }
  ]
}
```

**Campos clave:**
- `reservation.totalGuestsAllowed` → cuántos guests puede tener la reserva
- `progress.registered` → cuántos ya ingresaron sus datos de identidad
- `progress.completed` → cuántos completaron TODO el checkin
- `progress.isFullyCompleted` → `completedCount >= totalGuestsAllowed`
- `registeredGuests[]` → lista de guests ya registrados con su estado

---

### 1.2 POST `/api/v1/checkin/{reservationUuid}/identify` — Identificación

Este endpoint es el **corazón del flujo**. Identifica si el guest existe en DB, y retorna la estrategia de verificación + el schema del formulario.

**Payload (validación del backend):**

```json
{
  "identificationTypeId": 7,
  "identificationNumber": "1234567890",
  "nationalityId": 48,
  "name": "Ricardo",
  "lastname": "Lombana",
  "isMainGuest": true
}
```

| Campo | Tipo | Validación |
|---|---|---|
| `identificationTypeId` | integer, required | `exists:catalogs,id` WHERE `catalog_category_id = 2` |
| `identificationNumber` | string, required | `max:30` |
| `nationalityId` | integer, required | `exists:countries,id` |
| `name` | string, required | `max:120` |
| `lastname` | string, required | `max:60` |
| `isMainGuest` | boolean, required | — |

**Validaciones adicionales del backend:**
1. ❌ `Reservation not found` → 404
2. ❌ `The reservation has reached the maximum number of allowed guests` → 422

**Response real:**

```json
{
  "guest": {
    "uuid": "019d-...",
    "name": "Ricardo",
    "lastname": "Lombana"
  },
  "reservationGuest": {
    "isMainGuest": true,
    "isCheckinCompleted": false
  },
  "verification": { ... },
  "formSchema": { ... }
}
```

#### 1.2.1 Nodo `verification` — 3 posibles tipos

| `verification.type` | Significa | Acción frontend |
|---|---|---|
| `"session"` | Didit / session-based | Redirigir a `verification.url` (Face Match → KYC condicional) |
| `"document_upload"` | Textract / OCR-based | Mostrar UI de upload de fotos del documento |
| `"verified_ok"` | Guest ya existe + docs vigentes | **Saltar verificación** → ir directo al formulario de datos |

**Regla crítica:** El backend decide la estrategia. El frontend NO elige provider — solo ejecuta lo que el backend indica.

#### 1.2.2 Nodo `formSchema` — Formulario server-driven

El backend envía el schema de campos que el formulario debe mostrar. Esto reemplaza la lógica actual de `activeAutomations.checkinFields` en el frontend.

> **Pendiente:** Confirmar estructura exacta del `formSchema`. Posible formato:
> ```json
> {
>   "fields": [
>     { "key": "countryOfOriginId", "type": "select", "required": true, "source": "countries" },
>     { "key": "reasonForTripId", "type": "select", "required": true, "source": "catalog:8" }
>   ]
> }
> ```

---

## 2. Árbol de Decisiones — Flujo Completo

```
Guest abre link de checkin
│
├── GET /api/v1/checkin/{reservationUuid}
│   └── ¿Reserva existe?
│       ├── NO → Pantalla "Reserva no encontrada"
│       └── SÍ → WelcomeScreen con datos de reserva + progress
│
├── Guest hace click "Comenzar Check-in"
│   └── Navega a /identify
│
├── POST /api/v1/checkin/{reservationUuid}/identify
│   │
│   ├── Error: "Reservation not found" → Toast error + volver al welcome
│   ├── Error: "Maximum guests reached" → Pantalla "Reserva llena"
│   │
│   └── Success → Almacenar response (guest, verification, formSchema)
│       │
│       ├── verification.type === "verified_ok"
│       │   └── SALTAR verify → navegar directo a /guest?guest_uuid=XXX
│       │       (guest ya existe, docs vigentes, no necesita verificar)
│       │
│       ├── verification.type === "session"
│       │   └── Navegar a /verify?guest_uuid=XXX
│       │       └── Redirigir a verification.url (Didit)
│       │           ├── Didit Face Match primero (siempre)
│       │           │   ├── Match + Docs vigentes → approved (sin KYC)
│       │           │   ├── Match + Docs vencidos → KYC completo
│       │           │   └── Sin match → KYC completo
│       │           └── Webhook/polling → approved → navegar a /guest
│       │
│       └── verification.type === "document_upload"
│           └── Navegar a /verify?guest_uuid=XXX
│               └── Mostrar UI upload (foto frontal + posterior)
│                   └── Upload → Textract OCR → pre-fill → navegar a /guest
│
├── /guest → Formulario de datos (campos según formSchema del backend)
│   ├── Pre-filled con datos del webhook de verificación
│   ├── Campos dinámicos según automatizaciones activas (SIRE, TRA, etc.)
│   └── Submit → POST guardar datos del guest
│
├── /contract → Firma digital (solo main guest)
│   └── Submit → POST completar checkin
│       └── Dispara: PDF Contrato + Smartlock codes
│
└── /success → Confirmación
    ├── Main guest: muestra smartlock codes
    └── Secondary: mensaje sin smartlock codes
```

---

## 3. GAP Analysis — Frontend Actual vs API Real

### 3.1 🔴 Críticos (rompen integración)

| # | Componente | Estado actual | API real | Acción |
|---|---|---|---|---|
| G1 | `IdentifyScreen` payload | Envía `{doc_type_id, doc_number, nationality_id}` | Espera `{identificationTypeId, identificationNumber, nationalityId, name, lastname, isMainGuest}` | **Agregar campos name/lastname/isMainGuest + renombrar keys** |
| G2 | `IdentityResolution` type | `{guestUuid, isNew, hasPreviousVerification}` | `{guest, reservationGuest, verification, formSchema}` | **Reescribir type completo** |
| G3 | Routing post-identify | `if (isNew \|\| !hasPreviousVerification)` → verify, else → guest | Basado en `verification.type`: `session` → verify, `document_upload` → verify, `verified_ok` → guest | **Cambiar lógica de routing** |
| G4 | Portal response type | `CheckinReservation` con 15+ campos inventados | API retorna `{reservation, progress, registeredGuests}` | **Reescribir type y WelcomeScreen** |
| G5 | Service endpoint URL | `/checkin/{uuid}/resolve-identity` | `/checkin/{reservationUuid}/identify` | **Corregir URL** |
| G6 | VerifyScreen decide provider | Lee `reservation.verificationProvider` | El backend ya decidió en `/identify` response | **Recibir verification.type como prop** |

### 3.2 🟡 Moderados (funcionalidad incompleta)

| # | Componente | Problema | Acción |
|---|---|---|---|
| G7 | `IdentifyScreen` | No tiene campos `name` y `lastname` | Agregar inputs |
| G8 | `IdentifyScreen` | No maneja error "max guests reached" | Agregar error handling específico |
| G9 | `GuestFormScreen` | Usa `activeAutomations` para decidir campos | Migrar a `formSchema` del backend |
| G10 | `VerifyScreen` | No maneja redirect real a Didit URL | Implementar `window.location.href` |
| G11 | `VerifyScreen` | No tiene upload real de fotos para Textract | Implementar `<input type="file">` + upload |
| G12 | `WelcomeScreen` | Muestra datos que el portal endpoint no entrega (`listingName`, `propertyLocation`, etc.) | Adaptar UI a datos disponibles |
| G13 | State management | `formSchema` y `verification` de `/identify` se pierden al navegar | Persistir en localStorage o context |

### 3.3 🟢 Menores (refinamiento)

| # | Problema | Acción |
|---|---|---|
| G14 | `reservationGuest.isCheckinCompleted` no se usa para resumir flujo | Usar para detectar re-entry |
| G15 | `registeredGuests[]` no se muestra en welcome | Mostrar progreso visual |
| G16 | `isMainGuest` se hardcodea como `true` | Determinar dinámicamente |

---

## 4. Tipos TypeScript — Alineados con API Real

### 4.1 Portal Response (GET /checkin/{uuid})

```typescript
/** Response de GET /api/v1/checkin/{reservationUuid} */
export interface CheckinPortalResponse {
  reservation: {
    uuid: string
    arrivalDate: string          // "Y-m-d"
    departureDate: string        // "Y-m-d"
    totalGuestsAllowed: number
  }
  progress: {
    registered: number
    completed: number
    isFullyCompleted: boolean
  }
  registeredGuests: RegisteredGuest[]
}

export interface RegisteredGuest {
  uuid: string
  name: string
  lastname: string
  isMain: boolean
  isCompleted: boolean
}
```

### 4.2 Identify Request & Response (POST /checkin/{uuid}/identify)

```typescript
/** Payload para POST /api/v1/checkin/{reservationUuid}/identify */
export interface IdentifyPayload {
  identificationTypeId: number   // catalogs WHERE catalog_category_id = 2
  identificationNumber: string   // max:30
  nationalityId: number          // exists:countries
  name: string                   // max:120
  lastname: string               // max:60
  isMainGuest: boolean
}

/** Response de POST /api/v1/checkin/{reservationUuid}/identify */
export interface IdentifyResponse {
  guest: {
    uuid: string
    name: string
    lastname: string
  }
  reservationGuest: {
    isMainGuest: boolean
    isCheckinCompleted: boolean
  }
  verification: VerificationDirective
  formSchema: FormSchema
}

/** El backend decide qué tipo de verificación necesita el guest */
export type VerificationDirective =
  | { type: "session"; url: string }        // Didit → redirigir a URL
  | { type: "document_upload" }             // Textract → mostrar upload UI
  | { type: "verified_ok" }                 // Ya verificado → saltar a form

/** Schema de campos que el formulario debe renderizar (server-driven) */
export interface FormSchema {
  fields: FormFieldSchema[]
}

export interface FormFieldSchema {
  key: string
  type: "text" | "select" | "date" | "tel" | "email" | "file"
  label?: string
  required: boolean
  source?: string         // "countries" | "catalog:8" | "catalog:15" etc.
  maxLength?: number
  placeholder?: string
}
```

### 4.3 Verification Types actualizados

```typescript
/** Nodo verification del identify response — union type */
export type VerificationType = "session" | "document_upload" | "verified_ok"
```

---

## 5. Service Layer — Endpoints Corregidos

```typescript
class CheckinService {

  // ── Portal ──────────────────────────────────────────
  // GET /api/v1/checkin/{reservationUuid}
  async getPortal(reservationUuid: string): Promise<CheckinPortalResponse>

  // ── Identify ────────────────────────────────────────
  // POST /api/v1/checkin/{reservationUuid}/identify
  async identify(reservationUuid: string, payload: IdentifyPayload): Promise<IdentifyResponse>

  // ── Verification status (polling after Didit/Textract) ──
  // GET /api/v1/checkin/{reservationUuid}/guest/{guestUuid}/verification-status
  async getVerificationStatus(reservationUuid: string, guestUuid: string): Promise<VerificationResult>

  // ── Upload document images (Textract flow) ──
  // POST /api/v1/checkin/{reservationUuid}/guest/{guestUuid}/upload
  async uploadDocumentImages(reservationUuid: string, guestUuid: string, images: FormData): Promise<OCRResult>

  // ── Save guest data ─────────────────────────────────
  // POST /api/v1/checkin/{reservationUuid}/guest
  async saveGuest(reservationUuid: string, payload: GuestSavePayload): Promise<void>

  // ── Complete checkin ────────────────────────────────
  // POST /api/v1/checkin/{reservationUuid}/guest/{guestUuid}/complete
  async completeGuest(reservationUuid: string, guestUuid: string, payload: any): Promise<CheckinCompletionResponse>

  // ── Contract ────────────────────────────────────────
  // GET /api/v1/checkin/{reservationUuid}/contract-template
  async getContractTemplate(reservationUuid: string): Promise<ContractTemplate>

  // ── Secondary gate ──────────────────────────────────
  // GET /api/v1/checkin/{reservationUuid}/s/{guestToken}/status
  async getSecondaryGateStatus(reservationUuid: string, guestToken: string): Promise<SecondaryGateStatus>
}
```

---

## 6. Component Changes Required

### 6.1 IdentifyScreen — Cambios

```
ANTES:                                  DESPUÉS:
┌─────────────────────────┐            ┌─────────────────────────┐
│ País del documento      │            │ Nombre *                │
│ Tipo de documento       │            │ Apellidos *             │
│ Número de documento     │            │ Nacionalidad *          │
│                         │            │ Tipo de documento *     │
│                         │            │ Número de documento *   │
│ [Verificar Identidad]   │            │                         │
└─────────────────────────┘            │ [Verificar Identidad]   │
                                       └─────────────────────────┘
                                       
Payload ANTES:                         Payload DESPUÉS:
{                                      {
  doc_type_id: 7,                        identificationTypeId: 7,
  doc_number: "123...",                  identificationNumber: "123...",
  nationality_id: 48                    nationalityId: 48,
}                                        name: "Ricardo",
                                         lastname: "Lombana",
                                         isMainGuest: true
                                       }

Routing ANTES:                         Routing DESPUÉS:
if (isNew || !hasPrevious)             switch (res.verification.type) {
  → /verify                              case "session":     → /verify (Didit)
else                                     case "doc_upload":  → /verify (Textract)
  → /guest                               case "verified_ok": → /guest (skip!)
                                       }
```

### 6.2 VerifyScreen — Cambios

```
ANTES:                                  DESPUÉS:
- Recibe reservation completa           - Recibe verificationType + verificationUrl
- Lee provider de reservation            - Backend ya decidió el provider
- Mock polling                           - Si "session": redirect a URL real
                                         - Si "document_upload": upload UI real
                                         - Polling real de verification status
```

### 6.3 WelcomeScreen — Cambios

```
ANTES:                                  DESPUÉS:
- Muestra listingName,                  - Muestra dates + totalGuestsAllowed
  propertyName, propertyLocation,        - Muestra progress bar (registered/completed)
  totalGuests, nights                    - Muestra lista de registeredGuests
- No muestra progreso                    - Indica cuántos faltan
```

### 6.4 GuestFormScreen — Cambios

```
ANTES:                                  DESPUÉS:
- Lee activeAutomations para             - Usa formSchema del /identify response
  decidir qué campos mostrar              para renderizar campos dinámicos
- Hardcoded SIRE/TRA logic              - formSchema-driven (server-side)
```

---

## 7. State Management — Persistencia entre pantallas

El `/identify` response contiene datos que se necesitan en pantallas posteriores:
- `guest.uuid` → necesario en /verify y /guest
- `verification.type` + `verification.url` → necesario en /verify
- `formSchema` → necesario en /guest
- `reservationGuest.isCheckinCompleted` → para detectar re-entry

**Estrategia:**

```typescript
// localStorage key: `checkin-identify-{reservationUuid}`
interface IdentifySessionData {
  guestUuid: string
  guestName: string
  guestLastname: string
  isMainGuest: boolean
  isCheckinCompleted: boolean
  verification: VerificationDirective
  formSchema: FormSchema
  timestamp: number  // para invalidar sesiones viejas
}
```

- `guest_uuid` también viaja por URL search params (como ahora) para deep-linking
- Al llegar a `/verify` o `/guest`, se lee de localStorage primero, URL params como fallback
- Si no hay session data y no hay `guest_uuid` en URL → redirect a `/identify`

---

## 8. Edge Cases & Error Handling

### 8.1 Errores del /identify

| Error | HTTP | UX |
|---|---|---|
| Reservation not found | 404 | Toast error + redirect a welcome |
| Max guests reached | 422 | Modal/pantalla "La reserva ya tiene todos sus huéspedes registrados" |
| Validation errors (campos) | 422 | Mostrar errores inline por campo |
| Guest already completed checkin | 200 (`isCheckinCompleted: true`) | Redirect a /success con mensaje "Ya completaste tu check-in" |

### 8.2 Re-entry (guest vuelve a abrir el link)

```
POST /identify → response.reservationGuest.isCheckinCompleted === true
  → Redirect a /success (no repetir el flujo)

POST /identify → response.verification.type === "verified_ok"
  → Significa que ya verificó antes pero NO completó checkin
  → Saltar a /guest para que termine de llenar datos
```

### 8.3 Didit Session

```
verification.type === "session"
  → window.location.href = verification.url (redirect externo)
  → Al volver (callback URL), el frontend debe:
     1. Leer guest_uuid de URL params
     2. Llamar getVerificationStatus()
     3. Si approved → navegar a /guest
     4. Si pending → mostrar "Esperando verificación..." con polling
     5. Si failed → mostrar error + botón "Reintentar"
```

### 8.4 Textract Upload

```
verification.type === "document_upload"
  → Mostrar UI con <input type="file" accept="image/*" capture="environment">
  → Foto frontal (obligatoria) + foto posterior (opcional según doc type)
  → Upload a endpoint → OCR → pre-fill del form
  → Navegar a /guest con datos pre-filled
```

### 8.5 Secondary Guest Specifics

```
Secondary guest:
  - isMainGuest = false en el payload de /identify
  - Gate check: main guest debe tener isCheckinCompleted = true
  - El backend puede retornar un provider de verificación DIFERENTE
  - No tiene paso de /contract
  - /success NO muestra smartlock codes
```

---

## 9. Orden de Implementación

### Fase A — Types & Service (sin romper UI)
1. Crear nuevos types (`CheckinPortalResponse`, `IdentifyPayload`, `IdentifyResponse`, `VerificationDirective`)
2. Agregar nuevos métodos al service (`getPortal`, `identify`) manteniendo los antiguos
3. Actualizar mock data para retornar las nuevas estructuras
4. Crear `IdentifySessionData` y helper para localStorage

### Fase B — IdentifyScreen (cambio más grande)
1. Agregar campos `name`, `lastname` al form
2. Agregar `isMainGuest` (derivado de prop o contexto)
3. Cambiar payload a `IdentifyPayload` format
4. Cambiar routing post-response basado en `verification.type`
5. Persistir `IdentifyResponse` en localStorage
6. Manejar errores: 404, max guests, ya completó checkin

### Fase C — VerifyScreen (refactor)
1. Recibir `verificationType` y `verificationUrl` como props (leídos de session data)
2. Si `session`: implementar redirect a Didit URL + callback handling
3. Si `document_upload`: implementar upload UI con `<input type="file">`
4. Polling real de `getVerificationStatus()` con exponential backoff
5. Eliminar lógica que lee `reservation.verificationProvider`

### Fase D — WelcomeScreen + GuestFormScreen
1. WelcomeScreen: adaptar a `CheckinPortalResponse` (progress, registeredGuests)
2. GuestFormScreen: migrar de `activeAutomations` a `formSchema` (cuando se confirme la estructura)

### Fase E — Error screens
1. Pantalla "Reserva llena" (max guests)
2. Pantalla "Ya completaste tu check-in" (re-entry)
3. Pantalla "Verificación fallida" con retry

---

## 10. Preguntas Pendientes para Backend

| # | Pregunta | Impacto |
|---|---|---|
| Q1 | ¿Estructura exacta de `formSchema`? ¿Es un array de field definitions o algo más simple? | Determina si GuestFormScreen es 100% server-driven o híbrido |
| Q2 | ¿Cuál es el callback URL después de que Didit completa? ¿El frontend define la URL o el backend la configura? | Afecta el flujo de redirect/return de Didit |
| Q3 | ¿El endpoint `/identify` retorna catálogos (docTypes, countries) o se traen de otro endpoint? | IdentifyScreen necesita poblar los selects |
| Q4 | ¿Cómo determina el frontend si el guest actual es `isMainGuest`? ¿Lo sabe de antemano o lo envía y el backend valida? | Afecta UX del IdentifyScreen |
| Q5 | ¿El endpoint de upload para Textract (`/guest/{uuid}/upload`) retorna los datos extraídos inmediatamente o requiere polling? | Afecta UX del VerifyScreen en modo Textract |
| Q6 | ¿El flujo secundario (`/s/{guestToken}`) usa el mismo endpoint `/identify` o tiene uno propio? | Afecta si el flujo secundario comparte componentes |
