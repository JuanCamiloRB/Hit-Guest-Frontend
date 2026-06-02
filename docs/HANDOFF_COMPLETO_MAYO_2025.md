# 🏨 Hit-Guest Frontend — Handoff Completo

**Fecha:** 29 Mayo 2025 | **Branch:** features/dashboard | **Build:** ✅ Passing  
**Framework:** Next.js 16.1.6 (App Router) | **Deploy:** Vercel (CLI manual)

---

## Índice

1. [Descripción del Proyecto](#1-descripción-del-proyecto)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Estructura del Proyecto](#3-estructura-del-proyecto)
4. [Configuración](#4-configuración)
5. [Arquitectura de Comunicación](#5-arquitectura-de-comunicación)
6. [Módulo Auth](#6-módulo-auth)
7. [Módulo Check-in](#7-módulo-check-in)
8. [Módulo Properties](#8-módulo-properties)
9. [Módulo Reservations](#9-módulo-reservations)
10. [Módulo Dashboard](#10-módulo-dashboard)
11. [Módulo Users/Team](#11-módulo-usersteam)
12. [Módulo Clients/Settings](#12-módulo-clientssettings)
13. [Rutas y Navegación](#13-rutas-y-navegación)
14. [Componentes UI (shadcn/ui)](#14-componentes-ui-shadcnui)
15. [Design System](#15-design-system)
16. [Estado Actual (Mock vs Real)](#16-estado-actual-mock-vs-real)
17. [Deuda Técnica](#17-deuda-técnica)
18. [Prioridades](#18-prioridades)
19. [Archivos Clave](#19-archivos-clave)

---

## 1. Descripción del Proyecto

Plataforma SaaS de gestión hotelera con **dos aplicaciones** en un solo proyecto Next.js:

| App | Grupo de rutas | Usuario | Estado |
|-----|---------------|---------|--------|
| Dashboard Admin | `/(dashboard)/dashboard/*` | Operador/Host | ✅ Conectado a API real |
| Check-in Guest | `/(guest)/checkin/*` | Huésped | 🟡 UI completa, **100% mock** (backend no tiene endpoints) |

**Backend:** API Kunas — `https://www.kunas.co/api/v1`

---

## 2. Stack Tecnológico

| Capa | Tecnología | Versión | Uso |
|------|-----------|---------|-----|
| **Framework** | Next.js (App Router + Turbopack) | 16.1.6 | SSR, routing, API routes |
| **UI** | React | 19.2.3 | Componentes UI |
| **Estilos** | TailwindCSS v4 | 4 | CSS utility-first |
| **UI Components** | shadcn/ui | 3.8.4 | Componentes pre-estilizados |
| **Forms** | react-hook-form | 7.71.1 | Manejo de formularios |
| **Validation** | Zod | 4.3.6 | Validación de schemas |
| **Resolver** | @hookform/resolvers | 5.2.2 | Integración Zod + RHF |
| **Estado global** | Zustand | 5.0.11 | Auth store con persist |
| **Tablas** | @tanstack/react-table | 8.21.3 | DataTable con sorting/filtering |
| **Query** | @tanstack/react-query | 5.100.13 | Data fetching (instalado, no usado) |
| **Mapas** | Leaflet | 1.9.4 | Mapas interactivos |
| **Mapas React** | react-leaflet | 5.0.0 | Wrapper React de Leaflet |
| **Verificación ID** | @didit-protocol/sdk-web | 0.2.1 | KYC/biometrics |
| **Firma digital** | react-signature-canvas | 1.1.0-alpha.2 | Canvas de firma |
| **Dates** | date-fns | 4.1.0 | Manipulación de fechas |
| **Icons** | lucide-react | 0.564.0 | Iconos SVG |
| **Toasts** | sonner | 2.0.7 | Notificaciones |
| **Dark mode** | next-themes | 0.4.6 | Theme switching |
| **Class merging** | clsx + tailwind-merge | 2.1.1 / 3.4.1 | `cn()` helper |
| **Variants** | class-variance-authority | 0.7.1 | Component variants |
| **Animations** | tw-animate-css | 1.4.0 | Animaciones Tailwind |
| **TypeScript** | TypeScript | 5 | Type safety |

---

## 3. Estructura del Proyecto

```
Hit-Guest-Frontend/
├── .env                          # Variables de entorno (gitignore)
├── .env.local                    # Local overrides
├── components.json               # Config shadcn/ui
├── next.config.ts                # Config Next.js (images, etc)
├── package.json                  # Dependencias
├── tsconfig.json                 # Config TypeScript
├── postcss.config.mjs            # Config PostCSS
├── eslint.config.mjs            # Config ESLint
├── public/                       # Assets estáticos
│   ├── favicon.ico
│   └── ...
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/               # Grupo rutas auth
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── register/
│   │   │       └── page.tsx
│   │   ├── (dashboard)/          # Grupo rutas dashboard
│   │   │   ├── layout.tsx        # Layout dashboard
│   │   │   └── dashboard/
│   │   │       ├── page.tsx      # Home dashboard
│   │   │       ├── properties/   # CRUD propiedades
│   │   │       ├── reservations/ # Lista + detalle
│   │   │       ├── settings/     # Config cuenta
│   │   │       └── team/         # Gestión usuarios
│   │   ├── (guest)/              # Grupo rutas check-in
│   │   │   ├── layout.tsx        # Layout guest
│   │   │   └── checkin/
│   │   │       ├── [reference]/  # UUID reserva
│   │   │       │   ├── page.tsx  # Welcome screen
│   │   │       │   ├── identify/ # Formulario identificación
│   │   │       │   ├── verify/   # Didit/Upload OCR
│   │   │       │   ├── guest/    # Formulario dinámico
│   │   │       │   ├── contract/ # Firma digital
│   │   │       │   ├── success/  # Resumen final
│   │   │       │   ├── [listingUuid]/[externalId]/ # Ruta PMS
│   │   │       │   └── s/[guestToken]/ # Flujo secundarios
│   │   │       └── ...
│   │   ├── layout.tsx            # Root layout
│   │   ├── globals.css           # Design tokens + estilos
│   │   └── page.tsx              # Root page (redirect)
│   ├── components/               # Componentes compartidos
│   │   ├── layout/               # Layouts (AdminLayout, GuestLayout, Header, Sidebar)
│   │   ├── shared/               # DataTable (reusable)
│   │   ├── ui/                   # 23 componentes shadcn/ui
│   │   └── LanguageProvider.tsx  # i18n wrapper
│   ├── features/                 # Módulos por dominio
│   │   ├── auth/                 # Autenticación
│   │   │   ├── components/       # LoginForm, RegisterForm, ProfileForm, Honeypot
│   │   │   ├── hooks/            # useAuth, useLogin, useRegister, useFormSecurity
│   │   │   ├── services/         # auth-service.ts, catalog-service.ts
│   │   │   ├── types/            # User, Client, AuthState, roles
│   │   │   └── constants.ts      # Constantes auth
│   │   ├── checkin/              # Check-in huéspedes
│   │   │   ├── components/       # 18 componentes (Welcome, Identify, Verify, etc)
│   │   │   ├── data/             # constants.ts, mock-guest-data.ts
│   │   │   ├── hooks/            # useIdentifySession, useLocalStorage
│   │   │   ├── services/         # checkin-service.ts (USE_MOCK=true)
│   │   │   └── types/            # checkin.ts (488 líneas)
│   │   ├── properties/           # CRUD propiedades
│   │   │   ├── components/       # 9 componentes (PropertyForm, PropertiesList, etc)
│   │   │   ├── services/         # properties-service.ts, listings-service.ts
│   │   │   └── types/            # Property types (530 líneas)
│   │   ├── reservations/        # Lista + detalle reservas
│   │   │   ├── components/       # 7 componentes (ReservationDialog, OperationsPanel, etc)
│   │   │   ├── data/             # Mock data para operations panel
│   │   │   └── services/         # reservations-service.ts
│   │   ├── dashboard/            # Stats + header
│   │   │   └── components/       # StatsCards, DashboardHeader
│   │   ├── users/                # Team management
│   │   │   ├── components/       # UserList, UserDialog
│   │   │   └── services/         # user-service.ts (mock)
│   │   └── clients/              # Settings empresa
│   │       ├── components/       # ClientSettings
│   │       └── services/         # client-service.ts (mock)
│   ├── hooks/                   # Hooks globales
│   │   └── useTranslation.ts    # i18n (preparado, no activo)
│   ├── lib/                     # Utilidades
│   │   ├── api-client.ts         # Fetch wrapper con auth headers
│   │   ├── config.ts             # API_BASE, feature flags
│   │   ├── store/                # Zustand stores
│   │   │   └── auth-store.ts    # Auth state persistido
│   │   ├── i18n/                 # Traducciones (preparado)
│   │   ├── utils/                # cn() helper
│   │   └── utils.ts              # Utils generales
│   ├── services/                # Services globales
│   │   └── countries-service.ts  # Countries API
│   ├── store/                   # Zustand stores adicionales
│   │   └── useLanguageStore.ts  # Idioma seleccionado
│   └── types/                   # Tipos compartidos
│       ├── index.ts             # Property, Reservation, User, etc
│       ├── api.ts               # ApiError, ApiErrorResponse
│       └── catalog.ts           # Catalog types
└── docs/                        # Documentación
    ├── API_DOCUMENTATION.md
    ├── CHECKIN_FLOW.md
    ├── CHECKIN_V4_API_ALIGNMENT.md
    ├── CHECKIN_V4_IMPLEMENTATION_PLAN.md
    ├── CHECKIN_V4_TESTING_GUIDE.md
    ├── CHECKIN_V4_QA_GAP_AND_FAILURE_PLAN.md
    ├── BACKEND_REQUIREMENTS_V4.md
    ├── CHECKIN_BACKEND_HANDOFF.md
    ├── BRAND_GUIDELINES.md
    ├── ENV_CONFIGURATION.md
    └── HANDOFF_MAYO_2025.md
```

---

## 4. Configuración

### 4.1 package.json

```json
{
  "name": "hit-guest",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 4000",
    "build": "next build",
    "start": "next start -p 4000",
    "lint": "eslint"
  }
}
```

### 4.2 next.config.ts

```typescript
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};
```

**Nota:** Solo permite imágenes de Unsplash. Para agregar más dominios, agregar al array `remotePatterns`.

### 4.3 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "strict": true,
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### 4.4 Variables de Entorno

```env
NEXT_PUBLIC_API_URL_HIT=https://www.kunas.co/api/v1
NEXT_PUBLIC_API_URL_GUEST=https://www.kunas.co/api/v1
NEXT_PUBLIC_ENABLE_MOCKS=false
NEXT_PUBLIC_APP_API_TOKEN=fiKyAWOMla...
```

**⚠️ Importante:** `NEXT_PUBLIC_ENABLE_MOCKS` existe pero el check-in ignora este flag y usa su propio `USE_MOCK` interno en `checkin-service.ts:36`.

### 4.5 lib/config.ts

```typescript
export const CONFIG = {
  API_URL_GUEST: process.env.NEXT_PUBLIC_API_URL_GUEST || "https://www.kunas.co/api/v1",
  API_URL_HIT: process.env.NEXT_PUBLIC_API_URL_HIT || "https://www.kunas.co/api/v1",
  APP_API_TOKEN: process.env.NEXT_PUBLIC_APP_API_TOKEN || "",
  ENABLE_MOCKS: process.env.NEXT_PUBLIC_ENABLE_MOCKS === "true",
  DEFAULT_LOCALE: "es",
};

export const API_BASE = CONFIG.API_URL_GUEST.replace(/\/$/, "");
```

---

## 5. Arquitectura de Comunicación

### 5.1 api-client.ts

Fetch wrapper centralizado que maneja:

- **Headers automáticos:** `Content-Type`, `Accept`, `Accept-Language: es`, `X-Locale: es`
- **Auth tokens:** Priority: `sessionToken` (login usuario) > `APP_API_TOKEN` (token de app)
- **Unwrap automático:** Soporta `{ data: T }` y direct `T` responses
- **Error handling:** Lanza `ApiError` con status y response data

```typescript
export const apiClient = {
  get: <T>(url: string, options?: RequestInit) => request<T>(url, { ...options, method: "GET" }),
  post: <T>(url: string, body?: any, options?: RequestInit) => request<T>(url, { ...options, method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(url: string, body?: any, options?: RequestInit) => request<T>(url, { ...options, method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(url: string, body?: any, options?: RequestInit) => request<T>(url, { ...options, method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(url: string, options?: RequestInit) => request<T>(url, { ...options, method: "DELETE" }),
}
```

### 5.2 auth-store.ts (Zustand)

Estado de autenticación persistido en localStorage:

```typescript
interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

interface AuthActions {
  setSession: (user: User) => void
  clearSession: () => void
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
}
```

**Storage key:** `auth-storage`  
**Persist:** Solo `user` y `isAuthenticated`

### 5.3 Flujo de Auth

1. Usuario ingresa email → `POST /auth/login` → OTP enviado
2. Usuario ingresa OTP → `POST /auth/verify-otp` → User + token
3. `setSession(user)` → Guarda en Zustand + localStorage
4. Requests subsiguientes incluyen `Authorization: Bearer {token}`

---

## 6. Módulo Auth

### 6.1 Estructura

```
features/auth/
├── components/
│   ├── LoginForm.tsx          # Login OTP flow (2 pasos)
│   ├── RegisterForm.tsx      # Registro persona natural/empresa
│   ├── ProfileForm.tsx       # Edición perfil usuario
│   └── Honeypot.tsx          # Anti-bot hidden field
├── hooks/
│   ├── use-auth.ts           # Logout helper
│   ├── use-login.ts          # Login OTP logic (timer, resend)
│   ├── use-register.ts      # Register logic
│   └── use-form-security.ts # Honeypot validation, minTime
├── services/
│   ├── auth-service.ts       # API auth methods
│   └── catalog-service.ts    # Catálogos API
├── types/
│   └── index.ts              # Auth types + schemas
└── constants.ts              # Constantes auth
```

### 6.2 auth-service.ts

**Endpoints reales:**

| Método | Endpoint | Payload | Response |
|--------|----------|---------|----------|
| `requestOtp` | `POST /auth/login` | `{ email }` | — |
| `verifyOtp` | `POST /auth/verify-otp` | `{ email, otp }` | `{ user, token }` |
| `resendOtp` | `POST /auth/resend-otp` | `{ email }` | — |
| `register` | `POST /account/register` | `RegisterFormData` | — |
| `logout` | `POST /auth/logout` | — | — |
| `loginWithGoogle` | — | — | ❌ Not implemented |

**Error mappings:**
- `auth.otp.invalid` → "El código ingresado es inválido o ha expirado"
- `auth.otp.expired` → "El código ha expirado, por favor solicita uno nuevo"
- `The email has already been taken.` → "Este correo electrónico ya está en uso"
- `errors.validation.client.identification_number.exists` → "Este número de identificación ya está registrado"

### 6.3 catalog-service.ts

**11 métodos conectados a API real:**

| Método | Endpoint | Fallback |
|--------|----------|----------|
| `getPersonTypes` | `GET /catalogs?catalogCategoryName=person_type` | `[{id:"1",name:"Individual"},{id:"2",name:"Empresa"}]` |
| `getIdentificationTypes` | `GET /catalogs?catalogCategoryName=identification_type` | `[]` |
| `getStatusRecords` | `GET /catalogs?catalogCategoryName=status_record` | `[]` |
| `getCountries` | `GET /countries` | 6 países hardcoded (AU, CO, MX, ES, AR, US) |
| `getRoomTypes` | `GET /catalogs?catalogCategoryName=room_type` | `[]` |
| `getAmenities` | `GET /catalogs?catalogCategoryName=amenities` | `[]` |
| `getCurrencies` | `GET /catalogs/category/currencies` | `[{id:"COP",name:"COP - Peso Colombiano"}]` |
| `getReservationSources` | `GET /catalogs?catalogCategoryName=reservation_source` | `[{id:"14",name:"Airbnb"},{id:"15",name:"Booking.com"},{id:"16",name:"Directo"}]` |
| `getPropertyTypes` | `GET /catalogs?catalogCategoryName=property_type` | `[]` |
| `getTimezonesGrouped` | `GET /catalogs/category/timezones` | Hardcoded grouped fallback (América, Europa, Australia) |

**Response shape:**
```typescript
interface CatalogOption {
  id: string
  name: string
  description?: string
  extra?: any
}
```

### 6.4 Types

```typescript
// Roles predefinidos
type UserRole = "PRINCIPAL" | "SECONDARY_MANAGER" | "SECONDARY_STAFF" | "VIEWER"

// User
interface User {
  id: string
  clientId: string
  uuid?: string
  token?: string
  email: string
  firstName: string
  phone?: string
  address?: string
  city?: string
  country?: string
  avatar?: string
  role: UserRole
  isPrincipal: boolean
  permissions?: {
    reservations?: string[]
    properties?: string[]
  }
}

// Client
interface Client {
  id: string
  name: string
  taxId?: string
  address?: string
  city?: string
  country?: string
  phone?: string
  email?: string
  status: "ACTIVE" | "INACTIVE"
}

// Zod schemas
loginSchema = { email: string }
otpSchema = { otp: string (6 dígitos) }
registerSchema = { person_type_id, identificationTypeId, identificationNumber, companyName?, name, lastname, email, phone, country, state, city }
```

### 6.5 Security

- **Honeypot field:** Campo oculto en forms para detectar bots
- **Min time validation:** `useFormSecurity` con `minTime: 2000ms` previene submits rápidos
- **Email normalization:** `trim().toLowerCase()` en todos los endpoints

---

## 7. Módulo Check-in

### 7.1 Estructura

```
features/checkin/
├── components/          # 18 componentes
│   ├── WelcomeScreen.tsx          # Portal de bienvenida
│   ├── IdentifyScreen.tsx         # Formulario identificación
│   ├── VerifyScreen.tsx           # Didit SDK o Upload OCR
│   ├── GuestFormScreen.tsx        # Formulario dinámico
│   ├── ContractScreen.tsx         # Firma digital
│   ├── SuccessScreen.tsx          # Resumen final
│   ├── SecondaryGateScreen.tsx   # Gate acompañantes
│   ├── SecondaryGuestFormScreen.tsx # Form reducido acompañantes
│   ├── SecondarySuccessScreen.tsx # Success acompañantes
│   ├── StepIndicator.tsx          # Indicador pasos
│   ├── ProgressRing.tsx           # Ring de progreso
│   ├── DocumentUpload.tsx         # Upload documentos
│   ├── SearchableSelect.tsx       # Select con búsqueda
│   ├── FormInput.tsx              # Input genérico
│   ├── SignaturePad.tsx          # Canvas firma
│   ├── SmartlockCodes.tsx         # Códigos smartlock
│   ├── CollapsibleSection.tsx    # Sección colapsable
│   └── GuestHeader.tsx            # Header huésped
├── data/
│   ├── constants.ts              # Constantes check-in
│   └── mock-guest-data.ts        # Mock data (14KB)
├── hooks/
│   ├── useIdentifySession.ts     # localStorage persistence
│   └── useLocalStorage.ts        # Helper localStorage
├── services/
│   └── checkin-service.ts        # 7 métodos (USE_MOCK=true)
└── types/
    └── checkin.ts                # 488 líneas de tipos
```

### 7.2 checkin-service.ts

**⚠️ ESTADO:** `USE_MOCK = true` (línea 36) — **Ningún endpoint llega al backend**

**Endpoints que necesita el backend:**

| Método | Endpoint | Payload | Response | Estado |
|--------|----------|---------|----------|--------|
| `getPortal` | `GET /checkin/{uuid}` | — | `{reservation, progress, registeredGuests[]}` | Mock |
| `identify` | `POST /checkin/{uuid}/identify` | `IdentifyPayload` | `{guest, reservationGuest, verification, formSchema}` | Mock |
| `getGuestFormSchema` | `GET /checkin/{uuid}/form/{guestUuid}` | — | `{requiredFields, optionalFields, prefilledData, catalogs}` | Mock |
| `completeMainGuest` | `POST /checkin/{uuid}/main/complete` | `CompleteMainGuestPayload` | `CompleteGuestResponse` | Mock |
| `completeSecondaryGuest` | `POST /checkin/{uuid}/secondary/{guestUuid}/complete` | `CompleteSecondaryGuestPayload` | `CompleteGuestResponse` | Mock |
| `uploadDocumentImages` | `POST /checkin/{uuid}/secondary/{guestUuid}/documents` | `FormData` (frontImage, backImage) | `OCRResult` | Mock |
| `getContractTemplate` | `GET /checkin/{uuid}/contract-template` | — | `ContractTemplate` | Mock |

### 7.3 Tipos Clave

```typescript
// Portal response (GET /checkin/{uuid})
interface CheckinPortalResponse {
  reservation: {
    uuid: string
    arrivalDate: string              // "Y-m-d"
    departureDate: string            // "Y-m-d"
    totalGuestsAllowed: number
  }
  progress: {
    registered: number
    completed: number
    isFullyCompleted: boolean
  }
  registeredGuests: RegisteredGuest[]
}

interface RegisteredGuest {
  uuid: string
  name: string
  lastname: string
  isMain: boolean
  isCompleted: boolean
}

// Identify payload (POST /checkin/{uuid}/identify)
interface IdentifyPayload {
  identificationTypeId: number   // catalogs WHERE catalog_category_id = 2
  identificationNumber: string   // max:30
  nationalityId: number          // exists:countries
  name: string                   // max:120
  lastname: string               // max:60
  isMainGuest: boolean
}

// Identify response
interface IdentifyResponse {
  guest: { uuid, name, lastname }
  reservationGuest: { isMainGuest, isCheckinCompleted }
  verification: VerificationDirective
  formSchema: FormSchema
}

// Verification directive (backend decide strategy)
type VerificationDirective =
  | { type: "session"; url: string }        // Didit → redirigir
  | { type: "document_upload" }             // Textract → upload UI
  | { type: "verified_ok" }                 // Ya verificado → skip

// Form schema (server-driven)
interface FormSchema {
  requiredFields: string[]     // ["countryOfOriginId", "reasonForTripId"]
  optionalFields: string[]     // ["cityOfOrigin"]
  prefilledData: Record<string, unknown>
}

// Completion payloads
interface CompleteMainGuestPayload {
  guestUuid: string
  profile: GuestProfile
  extra: GuestExtra
  signature: string | null   // base64 data URL
}

interface CompleteSecondaryGuestPayload {
  profile: GuestProfile
  extra: GuestExtra
  // NO guestUuid, NO signature
}

interface CompleteGuestResponse {
  guest: { uuid, name, lastname }
  reservationGuest: { isMainGuest, isCheckinCompleted }
  reservation: {
    uuid: string
    isCheckinCompleted: boolean
    checkinCompletedAt?: string
    pendingGuests?: number
  }
}
```

### 7.4 useIdentifySession Hook

Persiste la respuesta de `/identify` en localStorage:

**Storage key:** `checkin-identify-{reservationUuid}`  
**TTL:** 2 horas

```typescript
interface IdentifySessionData {
  guestUuid: string
  guestName: string
  guestLastname: string
  isMainGuest: boolean
  isCheckinCompleted: boolean
  verification: VerificationDirective
  formSchema: FormSchema
  timestamp: number
}
```

**Métodos:**
- `save(response)` — Guarda en localStorage
- `load()` — Carga y valida TTL
- `clear()` — Elimina
- `getGuestUuid()` — Retorna guestUuid
- `getVerification()` — Retorna verification directive
- `getFormSchema()` — Retorna form schema

### 7.5 Flujo Main Guest (6 pasos)

1. **WelcomeScreen** → `/checkin/{uuid}`  
   - Muestra info reserva, lista guests, progress bar
   - CTAs por guest (pending, blocked, completed)

2. **IdentifyScreen** → `/checkin/{uuid}/identify`  
   - Form: nombre, apellido, nacionalidad, tipo doc, número
   - Usa catálogos reales (countries, document types)
   - Trigger re-entrada: `isCheckinCompleted=true` → redirect success

3. **VerifyScreen** → `/checkin/{uuid}/verify`  
   - Si `verification.type=session` → Didit SDK modal
   - Si `verification.type=document_upload` → Upload OCR
   - Si `verification.type=verified_ok` → Skip

4. **GuestFormScreen** → `/checkin/{uuid}/guest`  
   - Formulario dinámico basado en `formSchema.requiredFields`
   - Campos prellenados desde `formSchema.prefilledData`
   - Guarda en localStorage: `checkin-guest-form-{uuid}`

5. **ContractScreen** → `/checkin/{uuid}/contract`  
   - Template HTML + SignaturePad
   - Checkbox aceptar
   - POST `/main/complete` con profile + extra + signature
   - Guarda flag: `checkin-main-done-{uuid}`

6. **SuccessScreen** → `/checkin/{uuid}/success`  
   - Resumen final
   - Smartlock codes (si backend incluye)
   - CTA para acompañantes (si quedan pendientes)

### 7.6 Flujo Secondary Guest (4 pasos)

1. **SecondaryGateScreen** → `/checkin/{uuid}/s/{token}`  
   - Verifica si main completó
   - Si `mainGuestCompleted=false` → bloqueado
   - Si `mainGuestCompleted=true` → redirige a identify

2. **IdentifyScreen** → `/checkin/{uuid}/s/{token}/identify`  
   - Mismo form que main
   - Payload `isMainGuest=false`

3. **VerifyScreen** → `/checkin/{uuid}/s/{token}/verify`  
   - Default: `document_upload` (Textract)
   - OCR confirm editable

4. **SecondaryGuestFormScreen** → `/checkin/{uuid}/s/{token}/guest`  
   - Form reducido (sin signature)
   - POST `/secondary/{guestUuid}/complete`
   - Guarda flag: `checkin-secondary-done-{uuid}-{guestUuid}`

5. **SecondarySuccessScreen** → `/checkin/{uuid}/s/{token}/success`  
   - Success individual
   - Si último guest → success global

### 7.7 Triggers de Prueba (Mock)

| Número | Resultado |
|--------|-----------|
| `111` | Didit session (biometrics) |
| `112` | Didit session (KYC) |
| `222` | Textract document_upload |
| `333` | verified_ok (salta verificación) |
| `403` | 403 error (secondary antes de main) |
| `409` | 409 error (documento ya registrado) |
| `444` | Ya completó check-in (re-entrada) |
| `500` | 500 error backend |
| `999` | 422 capacity exceeded |

### 7.8 localStorage Keys

| Key | Escrito por | Leído por | TTL |
|-----|------------|-----------|-----|
| `checkin-identify-{uuid}` | IdentifyScreen | VerifyScreen, GuestFormScreen | 2h |
| `checkin-guest-form-{uuid}` | VerifyScreen (OCR), GuestFormScreen | ContractScreen | Sesión |
| `checkin-main-done-{uuid}` | ContractScreen | WelcomeScreen | Permanente |
| `checkin-secondary-done-{uuid}-{guestUuid}` | SecondaryGuestFormScreen | WelcomeScreen | Permanente |

---

## 8. Módulo Properties

### 8.1 Estructura

```
features/properties/
├── components/
│   ├── PropertyForm.tsx         # Formulario CRUD propiedad
│   ├── PropertiesList.tsx       # Lista propiedades
│   ├── PropertyCard.tsx         # Card propiedad
│   ├── PropertiesLocation.tsx   # Mapa + dirección
│   ├── PropertiesPhotos.tsx     # Upload fotos
│   ├── PropertiesUnits.tsx      # CRUD unidades (listings)
│   ├── PropertiesAmenities.tsx   # Selección amenities
│   ├── PropertiesAutomation.tsx # Config automations
│   └── MapComponent.tsx         # Leaflet map
├── services/
│   ├── properties-service.ts    # CRUD propiedades
│   ├── listings-service.ts     # CRUD unidades
│   └── properties.ts            # Helper functions
└── types/
    └── index.ts                 # 530 líneas de tipos
```

### 8.2 properties-service.ts

**Endpoints reales:**

| Método | Endpoint | Estado |
|--------|----------|--------|
| `create` | `POST /properties` | ✅ Real |
| `list` | `GET /properties` | ✅ Real |
| `getByUuid` | `GET /properties/{uuid}` | ✅ Real |
| `update` | `PUT /properties/{uuid}` | ✅ Real |
| `patch` | `PATCH /properties/{uuid}` | ✅ Real |
| `delete` | `DELETE /properties/{uuid}` | ✅ Real |
| `restore` | `POST /properties/{uuid}/restore` | ✅ Real |

**Response handling:**
- Soporta `{ data: T }` y direct `T`
- Unwrap automático de `.data` si presente

### 8.3 listings-service.ts

**Endpoints reales:**

| Método | Endpoint | Estado |
|--------|----------|--------|
| `list` | `GET /listings` | ✅ Real |
| `listByProperty` | `GET /listings?propertyUuid={uuid}` | ✅ Real |
| `create` | `POST /listings` | ✅ Real |
| `update` | `PUT /listings/{uuid}` | ✅ Real |
| `delete` | `DELETE /listings/{uuid}` | ✅ Real |

**⚠️ Workaround camelCase/snake_case:**
El payload duplica campos en ambos formatos para prevenir nulls del backend:

```typescript
const payload = {
  ...data,
  property_uuid: data.propertyUuid || (data as any).property_uuid,
  propertyUuid: data.propertyUuid || (data as any).property_uuid,
  room_type_id: Number(data.room_type_id || (data as any).roomTypeId) || 1,
  roomTypeId: Number(data.room_type_id || (data as any).roomTypeId) || 1,
  // ... más duplicaciones
}
```

### 8.4 Tipos Clave

```typescript
interface PropertyApiPayload {
  name: string
  description?: string | null
  email: string
  phone?: string | null
  address: string
  addressDetail?: string | null
  city: string
  state: string
  countryId: number
  latitude?: string | null
  longitude?: string | null
  externalId?: string | null
  external_id?: string | null
  timezone?: string | null
  statusRecordId: number
  propertyTypeId: number
  thumbnailUrl?: string | null
  thumbnail_url?: string | null
  // Duplicados para backend
  price?: number | string | null
  start_price?: number | string | null
  startPrice?: number | string | null
  amenity_ids?: (string | number)[]
  amenities?: (string | number)[]
  extra?: {
    picturesUrl?: string[]
    pictures_url?: string[]
    checkIn?: string | null
    checkOut?: string | null
    cancellationPolicy?: string | null
    amenities?: (number | string)[]
    wifiDetails?: { network?: string | null; password?: string | null } | null
    type?: string
    startPrice?: number
    start_price?: number
    internal_name?: string | null
    currency?: string
    propertyTypeId?: number | string | null
    thumbnailUrl?: string
    thumbnail_url?: string
    automationSettings?: any
    policies?: any[]
    roomTypes?: any[]
    price?: number | string | null
    units?: any[]
  } | null
  externalPmsIds?: { sourcePmsId: number; externalId: string }[]
  external_identifiers?: { source_pms_id: number; external_id: string }[]
}

interface ListingApiPayload {
  uuid?: string
  property_id?: number
  propertyUuid?: string
  name: string
  internal_name?: string
  internalName?: string
  room_type_id?: number
  roomTypeId?: number
  description?: string | null
  thumbnail_url?: string
  thumbnailUrl?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  price?: number
  total_price?: number
  start_price?: number
  extra?: any
  statusRecordId?: number
  status_record_id?: number
}
```

---

## 9. Módulo Reservations

### 9.1 Estructura

```
features/reservations/
├── components/
│   ├── ReservationsList.tsx      # Lista reservas (DataTable)
│   ├── ReservationDialog.tsx     # Diálogo crear reserva
│   ├── OperationsPanel.tsx       # Panel detalle (mock)
│   ├── ReservationsCalendar.tsx  # Vista calendario
│   ├── AutomationTrafficLight.tsx # Indicador automations
│   ├── StatusBadge.tsx           # Badge estado
│   └── columns.tsx               # Columnas DataTable
├── data/
│   ├── detailed-mock-data.ts     # Mock operations panel
│   ├── mock-dashboard-data.ts    # Mock dashboard
│   └── mock-reservations.ts      # Mock reservas
└── services/
    └── reservations-service.ts   # Lista reservas
```

### 9.2 reservations-service.ts

**Endpoints reales:**

| Método | Endpoint | Estado |
|--------|----------|--------|
| `list` | `GET /reservations` | ✅ Real |

**Mapping robusto:**
- Normaliza `arrivalDate/arrival_date`, `departureDate/departure_date`
- Extrae `guestName` de `extra.guestName` o `extra.guest_name` o `mainGuest.name`
- Mapea `source.slug` a "Airbnb" | "Booking" | "Direct"
- Extrae `property` y `listing` de nested objects
- Mapea `statusReservation.name` a status enum

```typescript
interface Reservation {
  id: string
  guestName: string
  email?: string
  phone?: string
  propertyId: string
  propertyName: string
  unitId: string
  unitName: string
  userId?: string
  checkIn: Date
  checkOut: Date
  nights: number
  status: "CONFIRMED" | "PENDING" | "CANCELLED" | "CHECKED_IN" | "CHECKED_OUT" | "LINK_SENT" | "PENDING_CONTRACT" | "NO_STARTED"
  source: "Airbnb" | "Booking" | "Direct"
  totalPrice: number
  automationStatus?: AutomationStatus
}
```

### 9.3 ReservationDialog.tsx

**Endpoint real:** `POST /reservations`

**Features:**
- Formulario completo con selects dinámicos
- Usa catálogos reales (properties, listings, sources)
- Dispatch evento `reservationCreated` para refrescar lista

### 9.4 OperationsPanel.tsx

**⚠️ ESTADO:** Usa `detailedMockReservations` hardcoded — **No hay endpoint de detalle**

**Features:**
- Panel de detalle al abrir reserva
- Automation tiles (link, checkin, contract, code, tra, sire)
- Activity log
- Breakdown de precios

---

## 10. Módulo Dashboard

### 10.1 Estructura

```
features/dashboard/
└── components/
    ├── StatsCards.tsx        # 4 cards (check-ins, check-outs, pendientes, ingresos)
    └── DashboardHeader.tsx   # Header dashboard
```

### 10.2 StatsCards.tsx

**⚠️ ESTADO:** Valores literales hardcoded

```typescript
<div className="text-2xl font-bold">4</div>  // Check-ins hoy
<div className="text-2xl font-bold">2</div>  // Check-outs hoy
<div className="text-2xl font-bold">8</div>  // Pendientes
<span className="text-2xl font-bold">$14.5M</span>  // Ingresos
```

---

## 11. Módulo Users/Team

### 11.1 Estructura

```
features/users/
├── components/
│   ├── UserList.tsx          # Lista usuarios
│   └── UserDialog.tsx        # Diálogo crear/editar
└── services/
    └── user-service.ts       # Mock service
```

### 11.2 user-service.ts

**⚠️ ESTADO:** 100% mock con array in-memory

```typescript
const mockUsers: User[] = [
  {
    id: "USR-001",
    clientId: "CLT-001",
    email: "admin@hitguest.com",
    firstName: "Juan Rodriguez",
    // ...
  },
  // 2 usuarios más
]

class UserServiceImpl {
  async getUsers(): Promise<User[]> {
    await new Promise(resolve => setTimeout(resolve, 1000))
    return mockUsers
  }
  async createUser(user: Omit<User, "id" | "isPrincipal">): Promise<User> {
    // Mutates mockUsers array
  }
  async updateUser(id: string, data: Partial<User>): Promise<User> {
    // Mutates mockUsers array
  }
  async deleteUser(id: string): Promise<void> {
    // Mutates mockUsers array
  }
}
```

---

## 12. Módulo Clients/Settings

### 12.1 Estructura

```
features/clients/
├── components/
│   └── ClientSettings.tsx    # Formulario settings empresa
└── services/
    └── client-service.ts     # Mock service
```

### 12.2 client-service.ts

**⚠️ ESTADO:** 100% mock con setTimeout

```typescript
const mockClient: Client = {
  id: "client-1",
  name: "Hotel Paraíso",
  taxId: "900.123.456-1",
  address: "Calle Principal #123",
  city: "Santa Marta",
  country: "Colombia",
  phone: "+57 300 123 4567",
  email: "contacto@hotelparaiso.com",
  status: "ACTIVE"
}

export const clientService: ClientService = {
  async getClient(id: string): Promise<Client> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockClient), 500)
    })
  },
  async updateClient(id: string, data: Partial<Client>): Promise<Client> {
    return new Promise((resolve) => {
      setTimeout(() => {
        Object.assign(mockClient, data)
        resolve(mockClient)
      }, 1000)
    })
  }
}
```

---

## 13. Rutas y Navegación

### 13.1 App Router Structure

```
src/app/
├── (auth)/                   # Grupo rutas auth (sin layout específico)
│   ├── login/page.tsx
│   └── register/page.tsx
├── (dashboard)/              # Grupo rutas dashboard
│   ├── layout.tsx            # AdminLayout (Sidebar + Header)
│   └── dashboard/
│       ├── page.tsx          # /dashboard
│       ├── properties/
│       │   └── page.tsx      # /dashboard/properties
│       ├── reservations/
│       │   ├── page.tsx      # /dashboard/reservations
│       │   └── [id]/
│       │       └── page.tsx  # /dashboard/reservations/{id}
│       ├── settings/
│       │   └── page.tsx      # /dashboard/settings
│       └── team/
│           └── page.tsx      # /dashboard/team
└── (guest)/                  # Grupo rutas check-in
    ├── layout.tsx            # GuestLayout (sin sidebar)
    └── checkin/
        └── [reference]/      # UUID reserva
            ├── page.tsx      # /checkin/{uuid}
            ├── identify/     # /checkin/{uuid}/identify
            ├── verify/       # /checkin/{uuid}/verify
            ├── guest/        # /checkin/{uuid}/guest
            ├── contract/     # /checkin/{uuid}/contract
            ├── success/      # /checkin/{uuid}/success
            ├── [listingUuid]/[externalId]/  # Ruta PMS alternativa
            │   └── ... (mismos componentes)
            └── s/[guestToken]/            # Flujo secundarios
                ├── page.tsx              # /checkin/{uuid}/s/{token}
                ├── identify/             # /checkin/{uuid}/s/{token}/identify
                ├── verify/               # /checkin/{uuid}/s/{token}/verify
                ├── guest/                # /checkin/{uuid}/s/{token}/guest
                └── success/              # /checkin/{uuid}/s/{token}/success
```

### 13.2 Layouts

**AdminLayout** (`components/layout/AdminLayout.tsx`):
- Sidebar (navegación dashboard)
- Header (user menu, logout)
- Solo para rutas `/(dashboard)/*`

**GuestLayout** (`components/layout/GuestLayout.tsx`):
- Sin sidebar
- Header minimal
- Solo para rutas `/(guest)/*`

### 13.3 Navegación

- **Auth → Dashboard:** Después de login exitoso, `router.push("/dashboard")`
- **Dashboard → Login:** Logout → `window.location.href = "/login"`
- **Check-in flow:** Navegación secuencial con `router.push()`
- **Re-entrada check-in:** Si `isCheckinCompleted=true` → redirect `/success`

---

## 14. Componentes UI (shadcn/ui)

### 14.1 Lista de 23 componentes

| Componente | Archivo | Uso |
|------------|---------|-----|
| Avatar | avatar.tsx | Imágenes usuario |
| Badge | badge.tsx | Status badges |
| Button | button.tsx | CTAs, form submits |
| Calendar | calendar.tsx | Date picker |
| Card | card.tsx | Contenedores |
| Checkbox | checkbox.tsx | Checkboxes |
| Dialog | dialog.tsx | Modales, diálogos |
| DropdownMenu | dropdown-menu.tsx | Menús desplegables |
| Form | form.tsx | Integración react-hook-form |
| Input | input.tsx | Inputs texto |
| Label | label.tsx | Labels form |
| PhoneInputField | phone-input-field.tsx | Input teléfono |
| Popover | popover.tsx | Popovers |
| ScrollArea | scroll-area.tsx | Scroll custom |
| Select | select.tsx | Selects dropdown |
| Sheet | sheet.tsx | Side sheets |
| Skeleton | skeleton.tsx | Loading skeletons |
| Sonner | sonner.tsx | Toast notifications |
| Switch | switch.tsx | Toggles |
| Table | table.tsx | Tablas |
| Tabs | tabs.tsx | Tabs navigation |
| Textarea | textarea.tsx | Textareas |
| Logo | Logo.tsx | Logo marca |

### 14.2 Componentes Layout

| Componente | Archivo | Uso |
|------------|---------|-----|
| AdminLayout | layout/AdminLayout.tsx | Layout dashboard |
| GuestLayout | layout/GuestLayout.tsx | Layout check-in |
| Header | layout/Header.tsx | Header compartido |
| Sidebar | layout/Sidebar.tsx | Sidebar dashboard |

### 14.3 Componentes Shared

| Componente | Archivo | Uso |
|------------|---------|-----|
| DataTable | shared/DataTable.tsx | Tabla con sorting/filtering |

---

## 15. Design System

### 15.1 Colores de Marca

| Token | Hex | Uso |
|-------|-----|-----|
| `--color-brand-navy` | #222755 | Accent, sidebar dark mode |
| `--color-brand-purple` | #9D4CF2 | Primary, CTAs, sidebar |
| `--color-brand-blue` | #5467FA | Secondary, links, badges |
| `--color-brand-white` | #F9FBFA | Background |

### 15.2 CSS Variables (Light Mode)

```css
:root {
  --radius: 0.75rem;
  --background: #F9FBFA;
  --foreground: #1a1a1a;
  --primary: #9D4CF2;              /* Brand Purple */
  --primary-foreground: #ffffff;
  --secondary: #5467FA;            /* Brand Blue */
  --secondary-foreground: #ffffff;
  --accent: #222755;               /* Brand Navy */
  --accent-foreground: #ffffff;
  --success: #71f5a4;
  --warning: #FFB800;
  --neutral: #9CA3AF;
  --card: #ffffff;
  --muted: #f4f4f5;
  --muted-foreground: #71717a;
  --destructive: #ef4444;
  --border: #e4e4e7;
  --input: #e4e4e7;
  --ring: #9D4CF2;
  
  /* Sidebar */
  --sidebar: #9D4CF2;
  --sidebar-foreground: #ffffff;
  --sidebar-primary: #ffffff;
  --sidebar-primary-foreground: #9D4CF2;
  --sidebar-accent: rgba(255, 255, 255, 0.1);
  --sidebar-accent-foreground: #ffffff;
  --sidebar-border: rgba(255, 255, 255, 0.1);
  --sidebar-ring: #ffffff;
}
```

### 15.3 CSS Variables (Dark Mode)

```css
.dark {
  --background: oklch(0.141 0.005 285.823);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.21 0.006 285.885);
  --primary: #5467FA;
  --secondary: oklch(0.274 0.006 286.033);
  --muted: oklch(0.274 0.006 286.033);
  --accent: #9D4CF2;
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: #9D4CF2;
  --sidebar: oklch(0.21 0.006 285.885);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: #5467FA;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: oklch(0.274 0.006 286.033);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: #9D4CF2;
}
```

### 15.4 Tipografía

**Fuentes Google:**
- **Gabarito** (700, 800) — Títulos, headings
- **Poppins** (300, 400, 500, 600) — Body text

```typescript
const gabarito = Gabarito({
  variable: "--font-gabarito",
  subsets: ["latin"],
  weight: ["700", "800"],
})

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
})
```

### 15.5 Utilities CSS

```css
/* Ocultar scrollbar */
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

/* Ocultar spinner inputs */
.no-spinner::-webkit-inner-spin-button,
.no-spinner::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.no-spinner { -moz-appearance: textfield; appearance: textfield; }
```

---

## 16. Estado Actual (Mock vs Real)

### 16.1 ✅ Conectados a API Real

| Módulo | Service | Endpoints |
|--------|---------|-----------|
| **Auth — Login OTP** | `auth-service.ts` | `POST /auth/login`, `POST /auth/verify-otp`, `POST /auth/resend-otp`, `POST /auth/logout` |
| **Auth — Register** | `auth-service.ts` | `POST /account/register` |
| **Catálogos** | `catalog-service.ts` | 11 métodos conectados |
| **Properties — CRUD** | `properties-service.ts` | 7 métodos (create, list, getByUuid, update, patch, delete, restore) |
| **Listings — CRUD** | `listings-service.ts` | 5 métodos (list, listByProperty, create, update, delete) |
| **Reservations — Lista** | `reservations-service.ts` | `GET /reservations` |
| **Reservations — Crear** | `ReservationDialog.tsx` | `POST /reservations` |

### 16.2 🟡 Operando con Mock

| Módulo | Archivo | Razón |
|--------|---------|-------|
| **Check-in completo** | `checkin-service.ts:36` | `USE_MOCK = true` — backend no tiene 7 endpoints |
| **OperationsPanel** | `OperationsPanel.tsx:70` | Usa `detailedMockReservations` hardcoded |
| **Dashboard Stats** | `StatsCards.tsx:16-52` | Valores literales: 4, 2, 8, $14.5M |
| **Settings (Empresa)** | `client-service.ts:21-34` | `setTimeout()` mock |
| **Team (Usuarios)** | `user-service.ts:62-90` | Array in-memory |

### 16.3 🔴 No Implementado

| Feature | Detalle |
|---------|---------|
| Middleware auth | No existe `middleware.ts` — rutas `/dashboard/*` sin protección |
| Login Google | `throw new Error("Google Login not implemented yet")` |
| Upload archivos (S3) | No hay integración — fotos son URLs manuales |
| Tests | Cero tests |
| CI/CD | Deploy manual vía `npx vercel --prod` |

---

## 17. Deuda Técnica

### 17.1 Bloqueantes

| Issue | Ubicación | Impacto |
|-------|-----------|---------|
| **Check-in hardcoded a mock** | `checkin-service.ts:36` | `USE_MOCK = true` no controlado por env var |
| **Backend sin endpoints check-in** | — | Bloquea producción check-in |

### 17.2 Medias

| Issue | Ubicación | Impacto |
|-------|-----------|---------|
| **Sin middleware de auth** | Falta `middleware.ts` | Rutas admin accesibles sin login |
| **camelCase/snake_case duplicados** | `listings-service.ts` | Envía ambos formatos simultáneamente |
| **StatsCards hardcoded** | `StatsCards.tsx` | No refleja datos reales |
| **OperationsPanel mock** | `OperationsPanel.tsx` | No hay endpoint de detalle |
| **Settings/Team mock** | `client-service.ts`, `user-service.ts` | Datos ficticios |

### 17.3 Bajas

| Issue | Ubicación | Impacto |
|-------|-----------|---------|
| **Sin upload de archivos** | Todo el proyecto | No S3/presigned URLs |
| **Cero tests** | — | Ni unit, ni integration, ni e2e |
| **CI/CD manual** | — | Deploy manual Vercel |
| **Login Google stub** | `auth-service.ts:98` | Solo `throw new Error` |
| **Root metadata genérica** | `layout.tsx:19` | title: "Create Next App" |
| **console.log de debug** | Varios servicios | Logs de desarrollo activos |

---

## 18. Prioridades

### 18.1 🔴 Alta (Bloqueante para producción check-in)

1. **Backend:** Implementar los 7 endpoints de check-in (ver `docs/BACKEND_REQUIREMENTS_V4.md`)
2. Flip `USE_MOCK = false` y validar E2E con backend real
3. Reemplazar catálogos mock en IdentifyScreen por CatalogService real
4. Integrar Didit en producción — configurar webhook + API keys

### 18.2 🟡 Media (Mejoran plataforma)

1. Auth middleware — proteger `/dashboard/*`
2. Dashboard stats reales — endpoint o cálculo desde reservas
3. OperationsPanel real — conectar a `GET /reservations/{uuid}`
4. Settings real — conectar a API de cuenta
5. Team real — conectar a CRUD de usuarios
6. Normalizar camelCase/snake_case — limpiar duplicación en listings

### 18.3 🟢 Baja (Nice-to-have)

1. S3 upload — fotos de propiedades, documentos, firmas
2. Tests — empezar por services y check-in flow
3. CI/CD — conectar Vercel a Git
4. Login Google — OAuth
5. i18n activo — ya está preparado
6. Dark mode toggle — CSS vars definidas

---

## 19. Archivos Clave

| Para entender... | Archivo |
|-----------------|---------|
| Comunicación con API | `src/lib/api-client.ts` |
| Config y env vars | `src/lib/config.ts` |
| Tipos del check-in | `src/features/checkin/types/checkin.ts` |
| Service check-in (mock) | `src/features/checkin/services/checkin-service.ts` |
| Mock data check-in | `src/features/checkin/data/mock-guest-data.ts` |
| Sesión del usuario | `src/lib/store/auth-store.ts` |
| Colores y design tokens | `src/app/globals.css` |
| Layout dashboard | `src/components/layout/Sidebar.tsx` |
| Propiedades (servicio) | `src/features/properties/services/properties-service.ts` |
| Listings (servicio) | `src/features/properties/services/listings-service.ts` |
| Reservas (servicio) | `src/features/reservations/services/reservations-service.ts` |
| Catálogos (servicio) | `src/features/auth/services/catalog-service.ts` |
| Auth (servicio) | `src/features/auth/services/auth-service.ts` |
| Tipos compartidos | `src/types/index.ts` |
| Config Next.js | `next.config.ts` |
| Variables de entorno | `.env` (gitignore) |

---

## 20. Comandos

```bash
# Desarrollo
npm run dev              # Dev server en puerto 4000

# Producción
npm run build            # Build producción
npm run start            # Start producción en puerto 4000

# Linting
npm run lint             # ESLint

# Deploy manual
npx vercel --prod        # Deploy a Vercel producción
```

---

**Fin del Handoff Completo**
