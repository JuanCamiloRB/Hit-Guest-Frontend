# Frontend Checkin — Handoff v4.1
> **Actualizado:** 2026-06-01 — v2 | Endpoints reales conectados. `USE_MOCK = false`.
> Este documento es la fuente de verdad del estado actual de la integración frontend ↔ backend.

---

## Estado general

| Categoría | Estado |
|---|---|
| Endpoints implementados en frontend | ✅ 6/6 conectados al backend real |
| TypeScript errors | ✅ 0 errores |
| `USE_MOCK` actual | `false` — apuntando a `https://www.kunas.co/api/v1` |
| Dual-path Didit (biometric → KYC) | ⚠️ `checkVerificationResult` en mock, falta endpoint backend `/verify/result` |
| Campos dinámicos del form (snake_case) | ✅ Bug crítico corregido (ver sección 4) |
| Upload de documentos (multipart) | ✅ Bug crítico corregido — usa `raw fetch` (ver sección 4) |
| Auth header en endpoints públicos | ✅ Corregido — solo se agrega si `APP_API_TOKEN` tiene valor |

---

## 1. Inventario de endpoints

### `GET /api/v1/checkin/{reservationUuid}` — Portal

**Frontend:** `checkinService.getPortal(reservationUuid)` → `CheckinPortalResponse`  
**Estado:** ✅ Implementado y alineado

**Response exacto del backend:**
```json
{
  "reservation": {
    "uuid": "string",
    "arrivalDate": "Y-m-d",
    "departureDate": "Y-m-d",
    "totalGuestsAllowed": 3
  },
  "progress": {
    "registered": 1,
    "completed": 0,
    "isFullyCompleted": false
  },
  "registeredGuests": [
    {
      "uuid": "string",
      "name": "Ricardo",
      "lastname": "Lombana",
      "isMain": true,
      "isCompleted": false
    }
  ]
}
```

**Lógica derivada en frontend (no viene del backend):**
```typescript
isMainGuestCompleted(portal) → registeredGuests.some(g => g.isMain && g.isCompleted)
pendingGuestsCount(portal)   → totalGuestsAllowed - progress.completed
```

**GAPs:**
- ❌ `reservation.listingName` — no existe. Frontend no puede mostrar nombre de propiedad.
- ❌ `registeredGuests[].verificationStatus` — no existe. No se puede distinguir "verificando" vs "completo".

---

### `POST /api/v1/checkin/{reservationUuid}/identify` — Identificación

**Frontend:** `checkinService.identify(reservationUuid, payload)` → `IdentifyResponse`  
**Estado:** ✅ Implementado, normalizador aplicado

**Request (camelCase → backend convierte internamente):**
```json
{
  "identificationTypeId": 8,
  "identificationNumber": "1234567890",
  "nationalityId": 42,
  "name": "Ricardo",
  "lastname": "Lombana",
  "isMainGuest": true
}
```

> `name` y `lastname` son opcionales en el form — se obtienen de Didit/OCR si no se proveen.

**Response exacto del backend:**
```json
{
  "guest": { "uuid": "018f...", "name": "Ricardo", "lastname": "Lombana" },
  "reservationGuest": { "isMainGuest": true, "isCheckinCompleted": false },
  "verification": {
    "type": "session | document_upload | verified_ok",
    "url": "https://didit.me/verify/..."
  },
  "formSchema": {
    "required_fields": ["country_of_origin_id", "reason_for_trip_id"],
    "optional_fields": [],
    "prefilledData": { "name": "Ricardo", "lastname": "Lombana", "nationalityId": 42 }
  }
}
```

**Normalización aplicada por `normalizeFormSchema()`:**
- `required_fields: ["country_of_origin_id"]` → `requiredFields: ["countryOfOriginId"]`
- `optional_fields: [...]` → `optionalFields: [...]`
- Valores del array también se convierten snake_case → camelCase

**Routing basado en `verification.type`:**
```
"session"         → VerifyScreen (Didit biometric + poll)
"document_upload" → VerifyScreen (upload docs + OCR)
"verified_ok"     → GuestFormScreen (directo, sin verificación)
```

**Error responses:**
- `422` — capacity exceeded o validación de campos
- `403` — secundario intentó antes de que main complete
- `409` — documento ya asociado a otro guest en esta reserva

---

### `GET /api/v1/checkin/{reservationUuid}/form/{guestUuid}` — Form Schema

**Frontend:** `checkinService.getGuestFormSchema(reservationUuid, guestUuid)` → `GuestFormSchemaResponse`  
**Estado:** ✅ Implementado, unwrap + normalización aplicada

**Response exacto del backend (envuelto en `formSchema`):**
```json
{
  "formSchema": {
    "required_fields": ["country_of_origin_id", "reason_for_trip_id"],
    "optional_fields": [],
    "prefilledData": {
      "name": "Ricardo",
      "lastname": "Lombana",
      "email": "r@example.com",
      "phone": "+57300...",
      "dateOfBirth": "1985-07-20",
      "nationalityId": 42,
      "identificationNumber": "1234567890",
      "identificationTypeId": 8
    }
  }
}
```

**Tras normalización, el frontend trabaja con:**
```typescript
{
  requiredFields: ["countryOfOriginId", "reasonForTripId"],
  optionalFields: [],
  prefilledData: { ... }  // ya en camelCase desde el backend
}
```

> **Nota:** Los catálogos (`countries`, `reasonsForTrip`, `genders`) NO vienen en este response. El frontend los carga por separado via `CatalogService`.

---

### `POST /api/v1/checkin/{reservationUuid}/secondary/{guestUuid}/documents` — Upload OCR

**Frontend:** `checkinService.uploadDocumentImages(...)` — usado en `VerifyScreen`  
**Estado:** ✅ Implementado con keys correctas + raw fetch (fix multipart)

**Request — `multipart/form-data` (snake_case, sin conversión automática):**
```
front_image: [File]   — frontal del documento, max 10MB
back_image:  [File]   — posterior del documento, max 10MB (opcional para pasaporte)
```

**Response exacto del backend:**
```json
{
  "extractedData": {
    "firstName": "Maria",
    "lastName": "Gomez",
    "documentNumber": "987654321",
    "dateOfBirth": "1990-03-15",
    "expirationDate": "2028-12-31"
  },
  "formSchema": {
    "required_fields": ["country_of_origin_id", "reason_for_trip_id"],
    "optional_fields": [],
    "prefilledData": { "name": "Maria", ... }
  }
}
```

**Error response (OCR fallido):**
```json
{
  "success": false,
  "errorType": "low_quality",
  "message": "Could not extract data from document images.",
  "failedFields": ["documentNumber"]
}
```

---

### `POST /api/v1/checkin/{reservationUuid}/main/complete` — Completar Main Guest

**Frontend:** `checkinService.completeMainGuest(reservationUuid, payload)` — en `ContractScreen`  
**Estado:** ✅ Implementado + re-fetch portal posterior

**Request payload:**
```json
{
  "guestUuid": "018f...",
  "profile": {
    "name": "Ricardo",
    "lastname": "Lombana",
    "email": "r@example.com",
    "phone": "+57300...",
    "dateOfBirth": "1985-07-20",
    "genderId": 1,
    "nationalityId": 42,
    "cityOfResidence": "Medellín",
    "countryOfResidenceId": 42
  },
  "extra": {
    "countryOfOriginId": 42,
    "countryDestinationId": 42,
    "cityOfOrigin": "Medellín",
    "reasonForTripId": 1
  },
  "signature": null
}
```

> Los campos en `extra` son los de `required_fields` del formSchema que no son del perfil del guest.

**Response exacto del backend:**
```json
{ "message": "Main guest checkin completed." }
```

**Flujo post-complete en frontend:**
```typescript
await completeMainGuest(...)
const portal = await getPortal(reservationUuid)   // re-fetch obligatorio
if (portal.progress.isFullyCompleted) → /success
else → /success?main_done=true&pending=N
```

---

### `POST /api/v1/checkin/{reservationUuid}/secondary/{guestUuid}/complete` — Completar Secundario

**Frontend:** `checkinService.completeSecondaryGuest(...)` — en `SecondaryGuestFormScreen`  
**Estado:** ✅ Implementado + re-fetch portal posterior

**Request payload (UUID en URL, no en body):**
```json
{
  "profile": {
    "name": "Maria",
    "lastname": "Gomez",
    "email": "m@example.com",
    "phone": "+57311...",
    "dateOfBirth": "1992-05-10",
    "genderId": 2,
    "nationalityId": 42,
    "identificationTypeId": 8,
    "identificationNumber": "987654321",
    "identificationExpiryDate": "2028-12-31",
    "cityOfResidence": "Bogotá",
    "countryOfResidenceId": 42
  },
  "extra": {
    "countryOfOriginId": 42,
    "reasonForTripId": 1
  }
}
```

**Response exacto del backend:**
```json
{ "message": "Secondary guest checkin completed." }
```

---

## 2. Flujo Didit — Estado actual y el GAP pendiente

### Lo que el MD v4.1 del backend describe (flujo confirmado)

```
POST /identify → { type: "session", url: "https://didit.me/verify/..." }
     │
     └─ Frontend abre URL (nueva tab o Didit SDK embebido)
          │
          └─ Usuario completa biometría en Didit
               │
               └─ Didit webhook → backend actualiza guest internamente
                    │
                    └─ Frontend polling GET /checkin/{uuid} cada 3s
                         Busca: registeredGuests[guest].isCompleted = true
```

**Problema:** `isCompleted: true` solo ocurre después de `POST /complete`, NO después de la verificación biométrica. El polling como está descrito en el MD no detecta "verificación lista, procede al formulario" — detecta "todo el checkin terminó."

Esto es el **GAP-02** del backend.

### Lo que el usuario confirmó verbalmente (dual-path)

```
Biometría siempre primero:
  → Guest existe en Didit, docs vigentes → obtener datos → ir a formulario
  → Guest no existe en Didit → lanzar flujo KYC de Didit
```

### Nuestra implementación actual (mock funcional)

```
launchDiditSession(url, 'biometric')
  → onComplete (SDK) →
       → checkinService.checkVerificationResult()   ← MOCK: /verify/result
            ├─ { status: 'verified', guestData: {...} } → prefill + ir a /guest
            └─ { status: 'kyc_required', kycUrl: '...' } → launchDiditSession(kycUrl, 'kyc')
```

**El endpoint `/verify/result` NO existe en el backend actualmente.**

### ¿Qué necesita el backend implementar?

**Opción A — endpoint nuevo (recomendada, ya tenemos el frontend listo):**
```
GET /api/v1/checkin/{reservationUuid}/verify/result?guest_uuid={guestUuid}
```
El backend consulta el estado del webhook de Didit recibido y responde:
```json
// Guest existía en Didit, docs vigentes:
{ "status": "verified", "guestData": { "firstName": "...", "lastName": "...", "documentNumber": "...", "dateOfBirth": "...", "expirationDate": "..." } }

// Guest nuevo, necesita KYC:
{ "status": "kyc_required", "kycUrl": "https://verify.didit.me/u/Eq_r_SjHTm-9ScZ_9jyDGQ" }

// Falló:
{ "status": "failed" }
```

**Opción B — agregar verificationStatus al portal (cubre GAP-02):**
```json
"registeredGuests": [
  { "uuid": "...", "isMain": true, "isCompleted": false, "verificationStatus": "approved | pending | failed | null" }
]
```
Frontend detecta `verificationStatus: "approved"` y procede al formulario.

> La Opción A resuelve el dual-path específico (biometric → KYC). La Opción B resuelve GAP-02 en general pero no da el `kycUrl`. Para el dual-path se necesita Opción A o ambas.

---

## 3. Catálogos necesarios

| Catálogo | Endpoint actual | Método en CatalogService | Estado |
|---|---|---|---|
| Tipos de documento | `GET /catalogs?status[eq]=ACT&catalogCategoryName[eq]=identification_type` | `getIdentificationTypes()` | ✅ Existe |
| Países | `GET /countries` | `getCountries()` | ✅ Existe |
| Género | `GET /catalogs?...&catalogCategoryName[eq]=gender` | `getGenders()` | ✅ Agregado |
| Motivo de viaje | `GET /catalogs?...&catalogCategoryName[eq]=reason_for_trip` | `getReasonsForTrip()` | ✅ Agregado |

> Confirmar con backend que el `catalogCategoryName` exacto para motivo de viaje es `reason_for_trip` (no `reason_for_travel` ni otro).

---

## 4. Bugs críticos corregidos en esta sesión

### Bug 1 — `required_fields` valores no normalizados (CRÍTICO para producción)

**Síntoma:** Los campos dinámicos del formulario nunca se mostraban en producción.  
**Causa:** `normalizeFormSchema()` convertía la clave `required_fields` → `requiredFields` pero los valores del array permanecían en snake_case (`'country_of_origin_id'`). El form chequea con camelCase (`'countryOfOriginId'`), entonces `includes()` siempre retornaba `false`.  
**Fix:** Se agregó conversión snake_case → camelCase sobre los valores del array en `normalizeFormSchema()`.

```typescript
// Antes (roto en producción):
requiredFields: raw?.required_fields || []
// Resultado: ['country_of_origin_id', 'reason_for_trip_id']

// Después (correcto):
requiredFields: toArray(raw?.required_fields).map(snakeToCamel)
// Resultado: ['countryOfOriginId', 'reasonForTripId']
```

### Bug 2 — `GuestFormSchemaResponse.catalogs` obsoleto

**Causa:** El tipo tenía un campo `catalogs` que el backend no devuelve.  
**Fix:** Eliminado del tipo. Los catálogos se cargan por separado via `CatalogService` en `GuestFormScreen` y `SecondaryGuestFormScreen`.

### Bug 3 — `CompleteGuestResponse` esperaba objeto completo

**Causa:** Frontend esperaba `result.reservation.isCheckinCompleted` en el response del complete.  
**Fix:** Backend solo devuelve `{ message }`. Se agregó re-fetch de portal post-complete en `ContractScreen` y `SecondaryGuestFormScreen`.

### Bug 4 — `FormData` keys en camelCase para upload

**Causa:** Se usaban `"frontImage"` y `"backImage"` como keys del `FormData`.  
**Fix:** Cambiado a `"front_image"` y `"back_image"` (snake_case, sin conversión automática en multipart).

### Bug 5 — `uploadDocumentImages` usaba `apiClient.post` con `FormData` (CRÍTICO para producción)

**Síntoma:** El upload de documentos en producción siempre fallaría — el backend recibía `{}` con `Content-Type: application/json`.  
**Causa:** `apiClient.post(url, formData)` hace `JSON.stringify(FormData)` → serializa a `{}` y sobreescribe el `Content-Type` a `application/json`, eliminando el boundary de multipart.  
**Fix:** `uploadDocumentImages` ahora usa `raw fetch` directamente, **sin** `Content-Type` (el browser lo asigna automáticamente con el boundary correcto).

```typescript
// Antes (roto en producción):
return apiClient.post(url, payload)  // → JSON.stringify(FormData) = {}

// Después (correcto):
const res = await fetch(url, { method: 'POST', headers: uploadHeaders, body: payload })
// payload es FormData → browser pone multipart/form-data; boundary=...
```

### Bug 6 — `getPortal()` enviaba `Authorization: Bearer ` con token vacío

**Síntoma:** En entornos sin `APP_API_TOKEN` configurado, el portal devolvería 401 en lugar de cargarse (es un endpoint público).  
**Causa:** El header se construía como `Authorization: Bearer ${CONFIG.APP_API_TOKEN}` incondicionalmente — si el token es `""`, manda `Bearer ` (inválido).  
**Fix:** El header solo se agrega si `CONFIG.APP_API_TOKEN` tiene valor.

```typescript
// Antes:
headers: { "Authorization": `Bearer ${CONFIG.APP_API_TOKEN}` }  // siempre se manda

// Después:
if (CONFIG.APP_API_TOKEN) headers["Authorization"] = `Bearer ${CONFIG.APP_API_TOKEN}`
```

---

## 5. Gaps del backend — Tabla de seguimiento

| ID | Gap | Impacto en frontend | Acción requerida |
|---|---|---|---|
| GAP-01 | Portal no devuelve `listingName` | No se puede mostrar nombre de propiedad | Backend: agregar `reservation.listingName` desde `listing.name` |
| GAP-02 | Portal no devuelve `verificationStatus` por guest | No se puede detectar "verificación aprobada" vs "checkin completo" | Backend: agregar `verificationStatus` a `registeredGuests[]` |
| GAP-03 | `/complete` solo devuelve `{ message }` | ✅ Resuelto — re-fetch portal posterior | Aceptado para MVP |
| GAP-04 | No hay `redirectUrl` configurado en Didit | Si usuario cierra tab, no vuelve al portal | Backend: configurar `redirectUrl` en `createBiometricSession()` |
| GAP-05 | SmartLock codes no expuestos | Screen 5 no puede mostrar códigos de acceso | Backend: incluir en GET portal cuando `isFullyCompleted=true` |
| GAP-06* | No hay endpoint `/verify/result` | Flujo dual-path Didit no funciona en producción | Backend: implementar (ver sección 2) |
| GAP-07* | `verification.type` no incluye `subtype` | ✅ Resuelto — frontend hace default a `"biometric"` | Aceptado |

> *GAP-06 y GAP-07 identificados por el frontend, no estaban en el MD original del backend.

---

## 6. Mock triggers (solo cuando `USE_MOCK = true`)

> ⚠️ **`USE_MOCK = false` actualmente** — los triggers no tienen efecto. Para activarlos en desarrollo, cambiar `USE_MOCK = true` en `checkin-service.ts` línea 40.

| Número de documento | Flujo simulado |
|---|---|
| `111` | Didit — biometric session → luego `checkVerificationResult` → verified |
| `112` | Didit — biometric session → luego `checkVerificationResult` → kyc_required |
| `222` | Textract — document_upload |
| `333` | verified_ok — saltar verificación, datos prefill |
| `403` | Error 403 — main guest no ha completado |
| `409` | Error 409 — documento ya asociado |
| `999` | Error 422 — max guests alcanzado |
| `500` | Error 500 — server error |
| Cualquier otro | Default: document_upload |

---

## 7. Estado de conexión al backend real

### ✅ Ya conectado

| Ítem | Estado | Detalle |
|---|---|---|
| URL base | ✅ Configurada | `https://www.kunas.co/api/v1` (default en `config.ts`) |
| `USE_MOCK` | ✅ `false` | `checkin-service.ts` línea 40 |
| 6 endpoints checkin | ✅ Activos | Apuntan al backend real |
| Multipart upload | ✅ Corregido | Bug 5 resuelto |
| Auth en endpoints públicos | ✅ Corregido | Bug 6 resuelto |

### ⚠️ Pendiente confirmar con backend

| # | Pregunta | Afecta a |
|---|---|---|
| 1 | ¿`catalogCategoryName` para motivo de viaje es exactamente `reason_for_trip`? | `CatalogService.getReasonsForTrip()` |
| 2 | ¿Para género es `gender`? | `CatalogService.getGenders()` |
| 3 | ¿`formSchema.required_fields` en snake_case y `prefilledData` en camelCase? (confirmado en MD v4.1) | `normalizeFormSchema()` |
| 4 | ¿`redirectUrl` de Didit configurado para retornar al portal? | `VerifyScreen` polling |
| 5 | ¿Implementan `GET /verify/result` para el dual-path Didit? | `checkVerificationResult()` |

### 🔴 Para volver a modo mock (debug/desarrollo)

```typescript
// src/features/checkin/services/checkin-service.ts, línea 40
const USE_MOCK = true  // ← solo para desarrollo local
```

---

## 8. State machine del frontend

```
PORTAL (WelcomeScreen)
  └─ click "Iniciar registro"
       └─ IDENTIFY (IdentifyScreen)
            └─ POST /identify
                 ├─ verification.type = "session"
                 │    └─ VERIFY — Didit biometric (VerifyScreen)
                 │         └─ onComplete → GET /verify/result (mock)
                 │              ├─ "verified"    → FORM (datos prefill de Didit)
                 │              └─ "kyc_required" → VERIFY — Didit KYC → FORM
                 │
                 ├─ verification.type = "document_upload"
                 │    └─ VERIFY — Upload + OCR (VerifyScreen)
                 │         └─ confirmación datos → FORM
                 │
                 └─ verification.type = "verified_ok"
                      └─ FORM (directo, sin verificación)

FORM (GuestFormScreen)
  └─ guardar en localStorage → navegar a CONTRACT

CONTRACT (ContractScreen)
  └─ POST /main/complete → GET portal
       ├─ isFullyCompleted=true → SUCCESS (todos)
       └─ isFullyCompleted=false → SUCCESS (main_done, esperando secundarios)
            └─ Secundarios: misma ruta IDENTIFY → VERIFY → FORM
                 └─ POST /secondary/{uuid}/complete → GET portal
                      ├─ isFullyCompleted=false → SUCCESS secundario
                      └─ isFullyCompleted=true → SUCCESS todos (SCREEN 5)
```

---

## 9. Archivos clave del frontend

| Archivo | Responsabilidad |
|---|---|
| `src/features/checkin/types/checkin.ts` | Todos los tipos TypeScript del flujo |
| `src/features/checkin/services/checkin-service.ts` | Todos los llamados a API + `USE_MOCK` |
| `src/features/checkin/data/mock-guest-data.ts` | Mocks para desarrollo |
| `src/features/auth/services/catalog-service.ts` | Catálogos (countries, doc types, genders, etc.) |
| `src/features/checkin/components/VerifyScreen.tsx` | Flujo Didit (biometric + KYC) + Textract |
| `src/features/checkin/components/GuestFormScreen.tsx` | Formulario dinámico main guest |
| `src/features/checkin/components/SecondaryGuestFormScreen.tsx` | Formulario dinámico secundario |
| `src/features/checkin/components/ContractScreen.tsx` | Firma + POST /main/complete |
| `src/features/checkin/components/IdentifyScreen.tsx` | POST /identify |
