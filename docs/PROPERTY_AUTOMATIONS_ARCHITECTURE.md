# Property Automations Architecture — Identity Verification Integration

> **Date:** 2026-06-04  
> **Status:** Active — Architecture & Implementation Guide  
> **Priority:** Critical — Blocks check-in completion for properties without verification automation  
> **Related:** `CHECKIN_V4_API_ALIGNMENT.md`, `API_DOCUMENTATION.md`, `CHECKIN_V4_BACKEND_ALIGNED_PLAN.md`

---

## 1. Bug Analysis — The Root Cause

### 1.1 The Problem

```
POST /checkin/{uuid}/identify  →  verification.type = "verified_ok"
POST /checkin/{uuid}/main/complete  →  403: "Guest identity must be approved before completing main guest checkin."
```

**Why it happens:**

The backend has **two independent checks** that are not aligned:

| Endpoint | Logic | Result |
|----------|-------|--------|
| `POST /identify` | "Does this property have an identity verification automation (Didit/Textract)?" → **NO** → return `verified_ok` | ✅ Guest proceeds to form |
| `POST /main/complete` | "Does this guest have `person_verified_at` set?" → **NO** (never verified) → reject with 403 | ❌ Guest cannot complete |

The `verified_ok` response from `/identify` implies "no verification needed, proceed", but `/main/complete` still enforces `person_verified_at` regardless of whether a verification automation exists.

### 1.2 The Inconsistency

```
Property has NO verification automation configured
  │
  ├── /identify says: "verified_ok" → skip verification
  │
  └── /main/complete says: "Guest identity must be approved" → BLOCKED
```

**This is a backend bug.** The two endpoints must agree on verification requirements.

### 1.3 Required Backend Fix (Two Options)

#### Option A — Recommended: `/main/complete` respects automation config

If the property has **no identity verification automation**, `/main/complete` should **NOT** require `person_verified_at`. The check should be:

```php
// Pseudocode for /main/complete validation
$verificationAutomation = $property->automations()
    ->whereIn('order', [1, 2]) // Identity verification orders
    ->where('is_active', true)
    ->first();

if ($verificationAutomation && !$guest->person_verified_at) {
    return response()->json([
        'message' => 'Guest identity must be approved before completing main guest checkin.'
    ], 403);
}

// If no verification automation → allow completion without verification
```

#### Option B — `/identify` forces verification when `/main/complete` requires it

If `/main/complete` will always require `person_verified_at`, then `/identify` should **never** return `verified_ok` for new guests. Instead, it should default to `document_upload` (Textract) as a fallback when no provider is configured.

```
/identify logic (Option B):
  Property has Didit automation  →  verification.type = "session"
  Property has Textract automation  →  verification.type = "document_upload"  
  Property has NO automation  →  verification.type = "document_upload" (default fallback)
  Guest already verified (person_verified_at != null)  →  verification.type = "verified_ok"
```

**Recommendation:** Option A is cleaner. It makes the system consistent: if no automation is configured, verification is truly optional.

---

## 2. Current State — Frontend Automation Architecture

### 2.1 Property Automation UI (Current)

**File:** `src/features/properties/components/PropertiesAutomation.tsx`

The current UI shows **5 hardcoded boolean switches**:

| Rule ID | Label | Purpose |
|---------|-------|---------|
| `welcome_message` | Mensaje de Bienvenida | Send welcome message on booking confirmation |
| `checkin_instructions` | Instrucciones de Check-in | Send instructions 24h before arrival |
| `digital_key` | Generación de Código | Smart lock code generation |
| `online_checkin` | Check-in Online | Enable online check-in flow |
| `cleaning_task` | Tarea de Limpieza | Auto-create cleaning task on checkout |

**Storage:** `extra.automationSettings` (JSON blob on property record)

```typescript
// Current AutomationSettings type
interface AutomationSettings {
    welcome_message: boolean
    checkin_instructions: boolean
    digital_key: boolean
    online_checkin: boolean
    cleaning_task: boolean
}
```

### 2.2 What's Missing

The current UI has **no way to configure**:
- **Identity verification provider** (Didit vs Textract) — Orders 1 & 2
- **Digital contract provider** (TuFirma) — Order 3
- **Smart lock credentials** (TTLock config) — Order 4
- **Guest report recipients** — Order 5
- **TRA Colombia credentials** — Order 6
- **SIRE Colombia credentials** — Orders 7 & 8
- **Trigger configuration** (when to fire, delay, chaining)
- **Guest filters** (all, foreign_only, national_only)

### 2.3 Backend Automation Model (Expected)

The backend uses a proper `property_automations` table (not just JSON booleans):

```
┌─────────────────────────────────────────────┐
│ property_automations                        │
├─────────────────────────────────────────────┤
│ id                  │ integer (PK)          │
│ property_id         │ integer (FK)          │
│ automation_order    │ integer (1-8)         │
│ name                │ string                │
│ provider_name       │ string (nullable)     │
│ is_active           │ boolean               │
│ parameters          │ json                  │
│ trigger_types       │ json (string[])       │
│ trigger_config      │ json                  │
│ guest_filter        │ string                │
│ guest_type          │ "main"|"secondary"|"all" │
│ created_at          │ timestamp             │
│ updated_at          │ timestamp             │
└─────────────────────────────────────────────┘
```

---

## 3. Automation Orders — Complete Reference

### 3.1 Order Map

| Order | Name | Provider Options | Guest Type | Impacts Check-in |
|-------|------|-----------------|------------|------------------|
| 1 | Identity Verification (Main Guest) | `didit`, `textract`, `null` | main | **YES** — determines `verification.type` in `/identify` |
| 2 | Identity Verification (Secondary) | `didit`, `textract`, `null` | secondary | **YES** — same as above for secondary guests |
| 3 | Digital Contract | `tufirma` | main | YES — enables `/contract` step |
| 4 | Smart Lock Codes | `ttlock` | all | YES — generates codes on completion |
| 5 | Guest Report PDF | `pdf_report` | all | No — post-checkin automation |
| 6 | TRA Colombia | `tra_colombia` | all | No — post-checkin automation |
| 7 | SIRE Colombia (Check-in) | `sire_colombia` | all | No — post-checkin automation |
| 8 | SIRE Colombia (Check-out) | `sire_colombia` | all | No — post-checkout automation |

### 3.2 Impact on Check-in Flow

```
Guest opens check-in link
  │
  ├── GET /checkin/{uuid} → portal
  │
  ├── POST /identify
  │     │
  │     ├── Backend checks: Property has Order 1 (main) or Order 2 (secondary) automation?
  │     │     │
  │     │     ├── YES, provider = "didit"
  │     │     │     └── Guest already verified? → "verified_ok"
  │     │     │         Guest not verified? → "session" + url
  │     │     │
  │     │     ├── YES, provider = "textract"
  │     │     │     └── Guest already verified? → "verified_ok"
  │     │     │         Guest not verified? → "document_upload"
  │     │     │
  │     │     └── NO automation configured
  │     │           └── "verified_ok" (no verification required)
  │     │
  │     └── Backend also checks: Property has Order 3 (contract)?
  │           └── This determines if /contract step appears in flow
  │
  ├── /verify (only if verification.type !== "verified_ok")
  │
  ├── /guest (form fields driven by formSchema)
  │
  ├── /contract (only if Order 3 is active)
  │
  └── POST /main/complete or /secondary/{uuid}/complete
        │
        └── Backend checks:
              ├── If Order 1/2 is active → requires person_verified_at
              └── If Order 1/2 is NOT active → skip verification check ← THIS IS THE FIX
```

---

## 4. Identity Verification — Deep Dive

### 4.1 Didit Provider (Order 1/2, provider = "didit")

**How it works:**

```
1. PM configures Didit on property (via Property Automations UI)
2. Guest calls POST /identify
3. Backend: "Property has Didit automation" → creates Didit session → returns:
   { verification: { type: "session", url: "https://verify.didit.me/u/..." } }
4. Frontend: Opens Didit SDK/redirect
5. Didit: Face match + optional KYC
6. Didit: Sends webhook to backend
7. Backend: Sets person_verified_at on guest record
8. Frontend: Polls portal → sees verification.currentStep = "form" → proceeds
```

**Parameters needed in automation config:**

```json
{
  "provider": "didit",
  "parameters": {}
}
```

> Didit credentials are configured at the **platform level** (HIT backend env vars), not per-property. The PM only needs to **enable/disable** the automation. No per-property credentials are needed.

**Frontend VerifyScreen behavior (already implemented):**
- `verification.type === "session"` → launches Didit SDK via `@didit-protocol/sdk-web`
- SDK `onComplete` → starts portal polling
- Portal polling: checks `registeredGuests[guestUuid].verification.currentStep`
- `currentStep === "form"` → navigate to guest form
- `currentStep === "rejected"` → show error

### 4.2 Textract Provider (Order 1/2, provider = "textract")

**How it works:**

```
1. PM configures Textract on property (via Property Automations UI)
2. Guest calls POST /identify
3. Backend: "Property has Textract automation" → returns:
   { verification: { type: "document_upload" } }
4. Frontend: Shows upload UI (front + back photo)
5. Guest uploads photos → POST /secondary/{guestUuid}/documents
6. Backend: Sends images to AWS Textract → extracts data → returns OCRResult
7. Frontend: Shows extracted data for confirmation → pre-fills guest form
8. Backend: Sets person_verified_at (after OCR success)
```

**Parameters needed in automation config:**

```json
{
  "provider": "textract",
  "parameters": {}
}
```

> Textract credentials are also platform-level (AWS env vars). PM only enables/disables.

**Frontend VerifyScreen behavior (already implemented):**
- `verification.type === "document_upload"` → shows file upload UI
- Upload → calls `checkinService.uploadDocumentImages()`
- OCR result → shows confirmation screen with editable fields
- Confirm → saves to localStorage → navigates to guest form

### 4.3 No Provider (Order 1/2 not configured)

**Current behavior (BUG):**
```
/identify → "verified_ok" → skip to form → /main/complete → 403 ERROR
```

**Expected behavior after fix:**
```
/identify → "verified_ok" → skip to form → /main/complete → SUCCESS
```

No frontend changes needed — just the backend fix described in Section 1.3.

---

## 5. Proposed Backend API — Property Automations CRUD

### 5.1 Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/v1/properties/{uuid}/automations` | List all automations for a property |
| `POST` | `/api/v1/properties/{uuid}/automations` | Create/update automation for a property |
| `PUT` | `/api/v1/properties/{uuid}/automations/{id}` | Update specific automation |
| `PATCH` | `/api/v1/properties/{uuid}/automations/{id}` | Toggle active/inactive |
| `DELETE` | `/api/v1/properties/{uuid}/automations/{id}` | Remove automation |

### 5.2 GET /api/v1/properties/{uuid}/automations

**Response:**

```json
{
  "data": [
    {
      "id": 1,
      "automationOrder": 1,
      "name": "Verificación de Identidad (Huésped Principal)",
      "providerName": "didit",
      "isActive": true,
      "guestType": "main",
      "parameters": {},
      "triggerTypes": ["on_checkin_completed"],
      "triggerConfig": {
        "on_checkin_completed": { "delay_minutes": 0 }
      },
      "guestFilter": "all"
    },
    {
      "id": 2,
      "automationOrder": 2,
      "name": "Verificación de Identidad (Huéspedes Secundarios)",
      "providerName": "textract",
      "isActive": true,
      "guestType": "secondary",
      "parameters": {},
      "triggerTypes": ["on_guest_checkin_completed"],
      "triggerConfig": {},
      "guestFilter": "all"
    },
    {
      "id": 4,
      "automationOrder": 4,
      "name": "Códigos de Cerradura Inteligente",
      "providerName": "ttlock",
      "isActive": true,
      "guestType": "all",
      "parameters": {
        "username": "ttlock_account@email.com",
        "password": "***",
        "client_id": "xxx",
        "client_secret": "***",
        "locks": [
          { "lock_id": 123456, "name": "Puerta principal", "type": "building_entrance" }
        ]
      },
      "triggerTypes": ["on_checkin_completed"],
      "triggerConfig": {},
      "guestFilter": "all"
    }
  ]
}
```

### 5.3 POST /api/v1/properties/{uuid}/automations

**Payload (create or update by order):**

```json
{
  "automationOrder": 1,
  "providerName": "didit",
  "isActive": true,
  "parameters": {},
  "triggerTypes": ["on_checkin_completed"],
  "triggerConfig": {},
  "guestFilter": "all"
}
```

**Validation rules:**

| Field | Type | Rules |
|-------|------|-------|
| `automationOrder` | integer | required, 1-8 |
| `providerName` | string/null | required for orders with providers |
| `isActive` | boolean | required |
| `parameters` | object | validated per order (see Section 3) |
| `triggerTypes` | string[] | optional, from allowed list |
| `triggerConfig` | object | optional, keyed by trigger type |
| `guestFilter` | string | optional, `all`/`foreign_only`/`national_only` |

---

## 6. Frontend Implementation Plan

### 6.1 Phase 1 — Backend Fix (No Frontend Changes)

**Goal:** Fix the `/main/complete` 403 error for properties without verification automation.

**Backend change:** In the `completeMainGuest` controller/service, wrap the `person_verified_at` check:

```php
// Only enforce verification if the property has an active verification automation
$hasVerificationAutomation = $property->automations()
    ->whereIn('automation_order', [1, 2])
    ->where('is_active', true)
    ->exists();

if ($hasVerificationAutomation && !$guest->person_verified_at) {
    abort(403, 'Guest identity must be approved before completing main guest checkin.');
}
```

**Frontend impact:** None. The existing flow will work once the backend allows completion without verification.

### 6.2 Phase 2 — Property Automations API Integration

**Goal:** Replace the current boolean `automationSettings` with real automation records from the backend.

#### 6.2.1 New Types

**File:** `src/features/properties/types/index.ts`

```typescript
/** A single automation record from the backend */
export interface PropertyAutomation {
  id: number
  automationOrder: number       // 1-8
  name: string
  providerName: string | null   // "didit" | "textract" | "tufirma" | "ttlock" | etc.
  isActive: boolean
  guestType: "main" | "secondary" | "all"
  parameters: Record<string, unknown>
  triggerTypes: string[]
  triggerConfig: Record<string, unknown>
  guestFilter: "all" | "foreign_only" | "national_only"
}

/** The full list of automation definitions (UI display metadata) */
export interface AutomationDefinition {
  order: number
  id: string                    // kebab-case key for UI
  title: string
  description: string
  icon: LucideIcon
  color: string
  bgColor: string
  providerOptions: ProviderOption[]
  guestType: "main" | "secondary" | "all"
  requiresConfig: boolean       // true if provider needs parameters
  isMandatory: boolean          // true if automation cannot be deactivated
}

export interface ProviderOption {
  value: string                 // "didit" | "textract" | "tufirma" | etc.
  label: string
  description: string
  parametersSchema: ParameterField[]
}

export interface ParameterField {
  key: string
  label: string
  type: "text" | "password" | "email" | "select" | "array"
  required: boolean
  placeholder?: string
}
```

#### 6.2.2 New Service

**File:** `src/features/properties/services/automation-service.ts`

```typescript
class AutomationService {
  // GET /api/v1/properties/{uuid}/automations
  async list(propertyUuid: string): Promise<PropertyAutomation[]>

  // POST /api/v1/properties/{uuid}/automations
  async createOrUpdate(propertyUuid: string, payload: Partial<PropertyAutomation>): Promise<PropertyAutomation>

  // PATCH /api/v1/properties/{uuid}/automations/{id} — toggle
  async toggle(propertyUuid: string, automationId: number, isActive: boolean): Promise<PropertyAutomation>

  // DELETE /api/v1/properties/{uuid}/automations/{id}
  async remove(propertyUuid: string, automationId: number): Promise<void>
}
```

#### 6.2.3 Automation Definitions (UI Config)

```typescript
const AUTOMATION_DEFINITIONS: AutomationDefinition[] = [
  {
    order: 1,
    id: "identity-verification-main",
    title: "Verificación de Identidad (Principal)",
    description: "Verificar identidad del huésped principal mediante reconocimiento facial o documento.",
    icon: Shield,
    color: "text-violet-500",
    bgColor: "bg-violet-50",
    guestType: "main",
    requiresConfig: false,  // Provider selected, no per-property credentials
    isMandatory: false,
    providerOptions: [
      {
        value: "didit",
        label: "Didit (Biométrico + ID)",
        description: "Verificación facial y documento con Didit. Reconocimiento automático.",
        parametersSchema: []  // No per-property config needed
      },
      {
        value: "textract",
        label: "HIT AI (OCR de Documento)",
        description: "Análisis de documento con IA. El huésped sube fotos del documento.",
        parametersSchema: []  // No per-property config needed
      }
    ]
  },
  {
    order: 2,
    id: "identity-verification-secondary",
    title: "Verificación de Identidad (Secundarios)",
    description: "Verificar identidad de huéspedes acompañantes.",
    icon: Shield,
    color: "text-violet-500",
    bgColor: "bg-violet-50",
    guestType: "secondary",
    requiresConfig: false,
    isMandatory: false,
    providerOptions: [
      // Same as Order 1
    ]
  },
  {
    order: 3,
    id: "digital-contract",
    title: "Contrato Digital",
    description: "Firma de contrato digital obligatorio antes de completar el check-in.",
    icon: FileText,
    color: "text-blue-500",
    bgColor: "bg-blue-50",
    guestType: "main",
    requiresConfig: true,  // TuFirma config TBD
    isMandatory: true,     // Cannot be deactivated
    providerOptions: [
      {
        value: "tufirma",
        label: "TuFirma",
        description: "Firma electrónica con validez legal.",
        parametersSchema: []  // TBD
      }
    ]
  },
  {
    order: 4,
    id: "smart-lock-codes",
    title: "Códigos de Cerradura Inteligente",
    description: "Generar códigos de acceso automáticos para cerraduras TTLock.",
    icon: Key,
    color: "text-amber-500",
    bgColor: "bg-amber-50",
    guestType: "all",
    requiresConfig: true,
    isMandatory: false,
    providerOptions: [
      {
        value: "ttlock",
        label: "TTLock",
        description: "Integración con cerraduras inteligentes TTLock.",
        parametersSchema: [
          { key: "username", label: "Usuario TTLock", type: "email", required: true },
          { key: "password", label: "Contraseña TTLock", type: "password", required: true },
          { key: "client_id", label: "Client ID", type: "text", required: true },
          { key: "client_secret", label: "Client Secret", type: "password", required: true },
          // locks[] managed via sub-form
        ]
      }
    ]
  },
  {
    order: 5,
    id: "guest-report-pdf",
    title: "Reporte PDF de Huéspedes",
    description: "Enviar reporte PDF con datos de huéspedes a los destinatarios configurados.",
    icon: FileText,
    color: "text-teal-500",
    bgColor: "bg-teal-50",
    guestType: "all",
    requiresConfig: true,
    isMandatory: false,
    providerOptions: [
      {
        value: "pdf_report",
        label: "Reporte PDF",
        description: "Generar y enviar PDF por email.",
        parametersSchema: [
          // recipients[] managed via sub-form
        ]
      }
    ]
  },
  {
    order: 6,
    id: "tra-colombia",
    title: "TRA Colombia",
    description: "Registro automático ante la Policía de Turismo (TRA).",
    icon: Shield,
    color: "text-green-500",
    bgColor: "bg-green-50",
    guestType: "all",
    requiresConfig: true,
    isMandatory: false,
    providerOptions: [
      {
        value: "tra_colombia",
        label: "TRA Colombia",
        description: "Reporte automático a la Policía Nacional de Turismo.",
        parametersSchema: [
          { key: "token", label: "Token API TRA", type: "password", required: true },
          { key: "rnt", label: "Registro Nacional de Turismo (RNT)", type: "text", required: true },
        ]
      }
    ]
  },
  {
    order: 7,
    id: "sire-colombia-checkin",
    title: "SIRE Colombia (Check-in)",
    description: "Registro automático de huéspedes extranjeros ante Migración Colombia.",
    icon: Shield,
    color: "text-indigo-500",
    bgColor: "bg-indigo-50",
    guestType: "all",
    requiresConfig: true,
    isMandatory: false,
    providerOptions: [
      {
        value: "sire_colombia",
        label: "SIRE Colombia",
        description: "Registro en el Sistema de Información para el Registro de Extranjeros.",
        parametersSchema: [
          { key: "document_type", label: "Tipo de Documento", type: "select", required: true },
          { key: "document_number", label: "Número de Documento", type: "text", required: true },
          { key: "password", label: "Contraseña SIRE", type: "password", required: true },
          { key: "company_code", label: "NIT / Código Empresa", type: "text", required: true },
        ]
      }
    ]
  },
  {
    order: 8,
    id: "sire-colombia-checkout",
    title: "SIRE Colombia (Check-out)",
    description: "Notificación de salida de huéspedes extranjeros ante Migración Colombia.",
    icon: Shield,
    color: "text-indigo-500",
    bgColor: "bg-indigo-50",
    guestType: "all",
    requiresConfig: true,
    isMandatory: false,
    providerOptions: [
      // Same as Order 7 — shares credentials
    ]
  },
]
```

### 6.3 Phase 3 — Redesigned Automation UI

**Goal:** Replace the current 5 boolean switches with a proper automation management interface.

#### 6.3.1 UI Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Tab: Automatización                                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ⚡ Reglas de Automatización                             │
│ Configura disparadores automáticos para mejorar la      │
│ experiencia del huésped y agilizar tu operación.        │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🛡 Verificación de Identidad (Principal)            │ │
│ │ Verificar identidad del huésped principal mediante  │ │
│ │ reconocimiento facial o documento.                  │ │
│ │                                          [🔘 ON ]  │ │
│ │ ─────────────────────────────────────────────────── │ │
│ │ Proveedor: [Didit (Biométrico + ID) ▾]             │ │
│ │ ⏱ Tiempo Real                        ⚙ Configurar │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🛡 Verificación de Identidad (Secundarios)          │ │
│ │ ...same layout with provider selector...            │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📄 Contrato Digital               OBLIGATORIO      │ │
│ │ Firma de contrato digital obligatorio.              │ │
│ │                                          [🔘 ON ]  │ │
│ │ ─────────────────────────────────────────────────── │ │
│ │ Proveedor: TuFirma                 ⚙ Configurar   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🔑 Códigos de Cerradura Inteligente                 │ │
│ │ Generar códigos de acceso automáticos.              │ │
│ │                                          [⚪ OFF]   │ │
│ │ ─────────────────────────────────────────────────── │ │
│ │ ⚠ Requiere configuración de TTLock  ⚙ Configurar  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ... (Orders 5-8 follow same pattern) ...                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### 6.3.2 Provider Configuration Modal

When PM clicks "Configurar" on an automation that `requiresConfig`:

```
┌─────────────────────────────────────────────┐
│ ⚙ Configurar: Códigos de Cerradura          │
│                                             │
│ Proveedor: TTLock                           │
│                                             │
│ Usuario TTLock:                             │
│ ┌─────────────────────────────────────────┐ │
│ │ ttlock_account@email.com                │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Contraseña TTLock:                          │
│ ┌─────────────────────────────────────────┐ │
│ │ ••••••••                                │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Client ID:                                  │
│ ┌─────────────────────────────────────────┐ │
│ │ abc123                                  │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Client Secret:                              │
│ ┌─────────────────────────────────────────┐ │
│ │ ••••••••                                │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Cerraduras:                                 │
│ ┌─────────────────────────────────────────┐ │
│ │ + Agregar cerradura                     │ │
│ │ 🔒 Puerta principal (building_entrance) │ │
│ │ 🔒 Puerta unidad (unit_entrance)        │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│         [Cancelar]  [Guardar Configuración] │
└─────────────────────────────────────────────┘
```

### 6.4 Phase 4 — Migration from Boolean Settings to Automation Records

#### 6.4.1 Backward Compatibility

During migration, support BOTH systems:

```typescript
// Reading automations: try API first, fallback to legacy
async function getPropertyAutomations(propertyUuid: string): Promise<PropertyAutomation[]> {
  try {
    // Try new API
    return await automationService.list(propertyUuid)
  } catch {
    // Fallback: convert legacy boolean settings to automation-like objects
    const property = await propertiesService.getByUuid(propertyUuid)
    const settings = property.extra?.automationSettings
    return convertLegacySettings(settings)
  }
}
```

#### 6.4.2 Data Migration Script (Backend)

```
For each property:
  Read extra.automationSettings
  Create property_automation records:
    welcome_message: true  → Order N/A (notification type, separate system)
    checkin_instructions: true → Order N/A (notification type)
    digital_key: true → Order 4, provider = "ttlock", parameters = {} (needs config)
    online_checkin: true → No direct mapping (property-level feature flag)
    cleaning_task: true → Order N/A (task management, separate system)
```

> **Note:** Most current boolean settings map to **notification/task automations** that are NOT in the check-in automation orders 1-8. Only `digital_key` maps to Order 4 (TTLock). The identity verification (Orders 1-2) was never configurable from the frontend, which is why the bug exists.

---

## 7. Check-in Flow — Updated Decision Tree

After implementing property automations properly:

```
POST /identify (backend logic)
│
├── Get property automations for orders 1 (main) or 2 (secondary)
│
├── Has active verification automation?
│   │
│   ├── YES, provider = "didit"
│   │   ├── Guest has person_verified_at? → { type: "verified_ok" }
│   │   └── Guest NOT verified? → Create Didit session → { type: "session", url: "..." }
│   │
│   ├── YES, provider = "textract"
│   │   ├── Guest has person_verified_at? → { type: "verified_ok" }
│   │   └── Guest NOT verified? → { type: "document_upload" }
│   │
│   └── NO verification automation
│       └── { type: "verified_ok" }  ← No verification needed
│
POST /main/complete (backend logic — AFTER FIX)
│
├── Get property automations for order 1 (main)
│
├── Has active verification automation?
│   │
│   ├── YES → Check person_verified_at
│   │   ├── Verified? → Allow completion ✅
│   │   └── Not verified? → 403 "Guest identity must be approved" ❌
│   │
│   └── NO → Allow completion without verification ✅  ← THE FIX
│
└── Continue with other validations (form data, contract signature, etc.)
```

---

## 8. Frontend Files to Modify

### 8.1 Immediate (Bug Fix — Phase 1)

**No frontend changes.** Backend fix only.

### 8.2 Phase 2 — New Files

| File | Purpose |
|------|---------|
| `src/features/properties/types/automation.ts` | New types for PropertyAutomation, AutomationDefinition, etc. |
| `src/features/properties/services/automation-service.ts` | CRUD service for property automations |
| `src/features/properties/data/automation-definitions.ts` | Static UI definitions for the 8 automation orders |

### 8.3 Phase 3 — Modified Files

| File | Changes |
|------|---------|
| `src/features/properties/components/PropertiesAutomation.tsx` | Complete rewrite: replace 5 boolean switches with 8 automation cards + provider selectors + config modals |
| `src/features/properties/types/index.ts` | Update `AutomationSettings` interface, add new types, update `propertyFormSchema` |
| `src/features/properties/components/PropertyForm.tsx` | Load automations from API instead of form state |

### 8.4 Phase 4 — Cleanup

| File | Changes |
|------|---------|
| `src/features/properties/types/index.ts` | Remove old `AutomationSettings` boolean interface |
| `src/features/properties/types/index.ts` | Remove `automationSettings` from `propertyFormSchema` |
| `src/features/properties/types/index.ts` | Remove `automationSettings` from `formDataToApiPayload` |
| `src/features/checkin/types/checkin.ts` | Remove deprecated `ActiveAutomation` interface |

---

## 9. Implementation Priority

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 🔴 P0 | Backend fix: `/main/complete` checks automation config before requiring verification | Small | **Unblocks all properties without verification** |
| 🟡 P1 | Backend: Implement `GET/POST /properties/{uuid}/automations` endpoints | Medium | Enables frontend automation management |
| 🟡 P1 | Frontend: Create automation types + service | Small | Foundation for UI |
| 🟢 P2 | Frontend: Redesign `PropertiesAutomation.tsx` with real automations | Medium | PM can configure verification |
| 🟢 P2 | Frontend: Provider config modals (TTLock, TRA, SIRE) | Medium | Full automation management |
| 🔵 P3 | Data migration: boolean settings → automation records | Small | Clean up legacy |
| 🔵 P3 | Frontend: Remove deprecated `AutomationSettings` / `ActiveAutomation` | Small | Code cleanup |

---

## 10. Open Questions for Backend

| # | Question | Impact |
|---|----------|--------|
| 1 | Does `property_automations` table already exist in the backend DB? Or does it need to be created? | Determines if we need migration |
| 2 | Are Didit/Textract credentials stored at platform level or per-property? | Determines if Orders 1-2 need `parameters` |
| 3 | Does the backend already have `GET /properties/{uuid}/automations` endpoint? | Determines if we just need frontend |
| 4 | For the bug fix: Can we immediately patch `/main/complete` to check automation config? | **Critical path — unblocks now** |
| 5 | How does the backend determine which `formSchema` fields to include? Is it based on active automations (SIRE/TRA → extra fields)? | Affects form rendering |
| 6 | TuFirma (Order 3): What parameters are needed? API key? Template ID? | Needed for config modal |
| 7 | Are Orders 7 & 8 (SIRE check-in/check-out) sharing the same automation record or separate records with shared credentials? | Affects UI |

---

## 11. Summary

### The Bug
- **Root cause:** Backend inconsistency between `/identify` (returns `verified_ok` when no automation) and `/main/complete` (always requires `person_verified_at`).
- **Fix:** `/main/complete` should only require verification when the property has an active verification automation (Order 1 or 2).

### The Architecture Gap
- **Current:** Property automation UI has 5 generic boolean toggles stored as JSON in `extra.automationSettings`.
- **Needed:** Full automation management system with 8 ordered automations, each with providers, parameters, triggers, and guest filters.
- **The identity verification automations (Orders 1 & 2) were never exposed in the frontend**, which is why properties lack them and the bug occurs.

### The Path Forward
1. **Now:** Backend patch to fix the 403 error (P0)
2. **Next:** Backend automation CRUD API (P1)
3. **Then:** Frontend automation management UI redesign (P2)
4. **Later:** Migration from legacy boolean settings (P3)
