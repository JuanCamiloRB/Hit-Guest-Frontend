# 🏨 Hit-Guest Frontend — Checkpoint del Proyecto

> **Fecha:** 29 Mayo 2026 | **Branch:** `features/dashboard` | **Build:** ✅ Passing  
> **Framework:** Next.js 16.1.6 (App Router) | **Deploy:** Vercel (CLI manual)

---

## 1. ¿Qué es Hit Guest?

Plataforma SaaS de gestión hotelera con **dos aplicaciones** en un solo proyecto Next.js:

| App | Grupo de rutas | Usuario | Estado |
|---|---|---|---|
| **Dashboard Admin** | `/(dashboard)/dashboard/*` | Operador/Host | ⚠️ Parcial — módulos conectados a API + módulos mock |
| **Check-in Guest** | `/(guest)/checkin/*` | Huésped | 🟡 UI completa, 100% mock |

**Backend:** API Kunas — `https://www.kunas.co/api/v1`

---

## 2. Stack Tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | Next.js (App Router + Turbopack) | 16.1.6 |
| UI | React | 19.2.3 |
| Estilos | TailwindCSS v4 + shadcn/ui | — |
| Forms | react-hook-form + Zod | v7 / v4 |
| Estado global | Zustand (persist → localStorage) | v5 |
| Tablas | @tanstack/react-table | v8 |
| Mapas | Leaflet + react-leaflet | v1.9 / v5 |
| Verificación ID | @didit-protocol/sdk-web | v0.2.1 |
| Firma digital | react-signature-canvas | v1.1.0 |
| Tipografía | Gabarito + Poppins (Google Fonts) | — |

---

## 3. Estructura del Proyecto

```
src/
├── app/
│   ├── (auth)/                      # Login, Register
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/                 # Admin panel
│   │   └── dashboard/
│   │       ├── page.tsx             # Home: stats + reservas
│   │       ├── properties/          # CRUD propiedades
│   │       ├── reservations/        # Lista + ops panel
│   │       ├── settings/            # Config cuenta
│   │       └── team/                # Gestión usuarios
│   ├── (guest)/                     # Check-in huéspedes
│   │   └── checkin/                 # 17 rutas (ver sección 5)
│   ├── layout.tsx                   # Root layout
│   └── globals.css                  # Design tokens + brand colors
│
├── components/
│   ├── layout/                      # AdminLayout, GuestLayout, Header, Sidebar
│   ├── shared/                      # DataTable (reusable)
│   └── ui/                          # 23 componentes shadcn/ui
│
├── features/                        # Módulos por dominio
│   ├── auth/                        # Login OTP, Register, Catalog Service
│   │   ├── components/              # LoginForm, RegisterForm, ProfileForm, Honeypot
│   │   ├── services/                # auth-service.ts, catalog-service.ts
│   │   └── types/                   # User, Client, AuthState, roles
│   ├── checkin/                     # ⭐ Módulo más grande (ver sección 6)
│   │   ├── components/              # 18 componentes
│   │   ├── data/                    # constants.ts, mock-guest-data.ts
│   │   ├── hooks/                   # useIdentifySession, useLocalStorage
│   │   ├── services/                # checkin-service.ts
│   │   └── types/                   # checkin.ts (488 líneas)
│   ├── clients/                     # Settings empresa
│   ├── dashboard/                   # StatsCards, DashboardHeader
│   ├── properties/                  # CRUD + listings
│   │   ├── components/              # PropertyCard, PropertyForm, etc.
│   │   └── services/                # properties-service.ts, listings-service.ts
│   ├── reservations/                # Lista + dialog + ops panel
│   │   ├── components/              # ReservationDialog, OperationsPanel, etc.
│   │   ├── data/                    # Mock data para ops panel
│   │   └── services/                # reservations-service.ts
│   └── users/                       # Team management
│       ├── components/              # UserList, UserDialog
│       └── services/                # user-service.ts (mock)
│
├── hooks/                           # useTranslation
├── lib/
│   ├── api-client.ts               # Fetch wrapper con auth headers
│   ├── config.ts                    # API_BASE, feature flags
│   ├── store/auth-store.ts         # Zustand: sesión persistida
│   ├── i18n/                        # Traducciones (preparado, no activo)
│   └── utils.ts                     # cn() helper
├── services/                        # countries-service.ts
├── store/                           # useLanguageStore
└── types/                           # Shared types (Property, Reservation, etc.)
```

---

## 4. Estado por Módulo

### ✅ Conectados a API Real

| Módulo | Archivos clave | Qué hace |
|---|---|---|
| **Auth — Login OTP** | [auth-service.ts](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/features/auth/services/auth-service.ts) | `POST /auth/login` → OTP → `POST /auth/verify-otp` |
| **Auth — Register** | [auth-service.ts](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/features/auth/services/auth-service.ts) | `POST /account/register` (persona natural + empresa) |
| **Auth — Catálogos** | [catalog-service.ts](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/features/auth/services/catalog-service.ts) | Countries, ID types, amenities, currencies, room types, etc. |
| **Properties — CRUD** | [properties-service.ts](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/features/properties/services/properties-service.ts) | list, create, update, delete, restore, toggleStatus |
| **Listings — CRUD** | [listings-service.ts](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/features/properties/services/listings-service.ts) | listByProperty, create, update, delete |
| **Reservations — Lista** | [reservations-service.ts](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/features/reservations/services/reservations-service.ts) | `GET /reservations` con mapping robusto |
| **Reservations — Crear** | [ReservationDialog.tsx](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/features/reservations/components/ReservationDialog.tsx) | `POST /reservations` con selects dinámicos |

### 🟡 Operando con Mocks

| Módulo | Archivos clave | Qué falta |
|---|---|---|
| **Check-in completo** | [checkin-service.ts](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/features/checkin/services/checkin-service.ts) | `USE_MOCK = true` en línea 36. Los 7 endpoints del backend no existen aún |
| **OperationsPanel** | [OperationsPanel.tsx](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/features/reservations/components/OperationsPanel.tsx) | Usa `detailedMockReservations` hardcoded |
| **Dashboard Stats** | [StatsCards.tsx](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/features/dashboard/components/StatsCards.tsx) | Valores literales: 4, 2, 8, $14.5M |
| **Settings (Empresa)** | [client-service.ts](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/features/clients/services/client-service.ts) | CRUD 100% mock con `setTimeout` |
| **Team (Usuarios)** | [user-service.ts](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/features/users/services/user-service.ts) | CRUD 100% mock con array in-memory |

### 🔴 No implementado

| Feature | Detalle |
|---|---|
| Middleware auth | No hay `middleware.ts` — rutas `/dashboard/*` sin protección |
| Login Google | Método existe pero lanza `throw new Error("not implemented")` |
| Upload archivos (S3) | No hay integración — fotos de propiedades son URLs manuales |
| Tests | Cero tests: ni unit, ni integration, ni e2e |
| CI/CD | Deploy manual vía `npx vercel --prod` |

---

## 5. Mapa de Rutas Completo

### Dashboard Admin (`/(dashboard)`)

| Ruta | Componente | API |
|---|---|---|
| `/dashboard` | StatsCards + ReservationsTable | ✅ Parcial |
| `/dashboard/properties` | PropertyList → PropertyForm | ✅ Real |
| `/dashboard/reservations` | DataTable → OperationsPanel | ⚠️ Lista real, detalle mock |
| `/dashboard/settings` | ClientSettings + ProfileForm | 🟡 Mock |
| `/dashboard/team` | UserList + UserDialog | 🟡 Mock |

### Check-in Guest (`/(guest)`) — 17 rutas

| Ruta | Componente | Paso |
|---|---|---|
| `/checkin/{uuid}` | WelcomeScreen | Portal de bienvenida |
| `/checkin/{uuid}/identify` | IdentifyScreen | Datos + tipo doc |
| `/checkin/{uuid}/verify` | VerifyScreen | Didit SDK o Upload OCR |
| `/checkin/{uuid}/guest` | GuestFormScreen | Formulario 22 campos |
| `/checkin/{uuid}/contract` | ContractScreen | Firma digital |
| `/checkin/{uuid}/success` | SuccessScreen | Resumen + smartlocks |
| `/checkin/{uuid}/{listing}/{ext}/...` | Mismos componentes | Ruta alternativa PMS |
| `/checkin/{uuid}/s/{token}/...` | Secondary* componentes | Flujo acompañantes (4 pasos) |

---

## 6. Check-in — Detalle del Módulo

### Flujo Main Guest (6 pasos)
```
Welcome → Identify → Verify → GuestForm → Contract → Success
```

### Flujo Secondary Guest (4 pasos)
```
SecondaryGate → Identify → Verify → SecondaryGuestForm → SecondarySuccess
```

### Componentes (18 total)

| Componente | Tamaño | Responsabilidad |
|---|---|---|
| [WelcomeScreen.tsx](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/features/checkin/components/WelcomeScreen.tsx) | 234 lín | Portal: info reserva, lista guests, progress bar |
| [IdentifyScreen.tsx](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/features/checkin/components/IdentifyScreen.tsx) | 245 lín | Form: nombre, apellido, nacionalidad, tipo doc, número |
| [VerifyScreen.tsx](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/features/checkin/components/VerifyScreen.tsx) | 416 lín | Didit SDK modal + Upload doc + OCR confirm editable |
| [GuestFormScreen.tsx](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/features/checkin/components/GuestFormScreen.tsx) | ~600 lín | Formulario dinámico (campos required/optional del backend) |
| [ContractScreen.tsx](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/features/checkin/components/ContractScreen.tsx) | 200 lín | Template HTML + firma + checkbox aceptar → POST complete |
| [SuccessScreen.tsx](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/features/checkin/components/SuccessScreen.tsx) | 135 lín | Resumen final, smartlock codes, CTA para acompañantes |
| [SecondaryGateScreen.tsx](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/features/checkin/components/SecondaryGateScreen.tsx) | ~100 lín | Gate: verifica si main completó |
| [SecondaryGuestFormScreen.tsx](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/features/checkin/components/SecondaryGuestFormScreen.tsx) | ~650 lín | Form reducido para acompañantes |
| [SecondarySuccessScreen.tsx](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/features/checkin/components/SecondarySuccessScreen.tsx) | ~100 lín | Success para acompañantes |
| StepIndicator, ProgressRing, DocumentUpload, SearchableSelect, FormInput, SignaturePad, SmartlockCodes, CollapsibleSection, GuestHeader | — | Componentes auxiliares reutilizables |

### Service — [checkin-service.ts](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/features/checkin/services/checkin-service.ts)

7 métodos, todos con mock fallback:

| Método | Endpoint esperado | Mock |
|---|---|---|
| `getPortal(uuid)` | `GET /checkin/{uuid}` | `mockPortalResponse()` |
| `identify(uuid, payload)` | `POST /checkin/{uuid}/identify` | `mockIdentifyResponse()` |
| `getGuestFormSchema(uuid, guestUuid)` | `GET /checkin/{uuid}/form/{guestUuid}` | `mockFormSchemaResponse()` |
| `completeMainGuest(uuid, payload)` | `POST /checkin/{uuid}/main/complete` | `mockCompleteResponse(true)` |
| `completeSecondaryGuest(uuid, guestUuid, payload)` | `POST /checkin/{uuid}/secondary/{guestUuid}/complete` | `mockCompleteResponse(false)` |
| `uploadDocumentImages(uuid, guestUuid, formData)` | `POST /checkin/{uuid}/secondary/{guestUuid}/documents` | `mockOCRResult()` |
| `getContractTemplate(uuid)` | `GET /checkin/{uuid}/contract-template` | `mockContractTemplate()` |

### Estado entre pantallas — localStorage

| Key | Escrito por | Leído por | TTL |
|---|---|---|---|
| `checkin-identify-{uuid}` | IdentifyScreen | VerifyScreen, GuestFormScreen | 2h |
| `checkin-guest-form-{uuid}` | VerifyScreen (OCR), GuestFormScreen | ContractScreen | Sesión |
| `checkin-main-done-{uuid}` | ContractScreen | WelcomeScreen | Permanente |
| `checkin-secondary-done-{uuid}-{guestUuid}` | SecondaryGuestFormScreen | WelcomeScreen | Permanente |

---

## 7. Design System

### Colores de Marca

| Token | Hex | Uso |
|---|---|---|
| `--color-brand-navy` | `#222755` | Accent, sidebar dark mode |
| `--color-brand-purple` | `#9D4CF2` | Primary, CTAs, sidebar |
| `--color-brand-blue` | `#5467FA` | Secondary, links, badges |
| `--color-brand-white` | `#F9FBFA` | Background |

### Componentes UI (shadcn/ui) — 23 instalados

Avatar, Badge, Button, Calendar, Card, Checkbox, Dialog, DropdownMenu, Form, Input, Label, PhoneInputField, Popover, ScrollArea, Select, Sheet, Skeleton, Sonner, Switch, Table, Tabs, Textarea

---

## 8. Estado Global

| Store | Archivo | Persistencia | Contenido |
|---|---|---|---|
| Auth | [auth-store.ts](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/lib/store/auth-store.ts) | localStorage (`auth-storage`) | `user`, `isAuthenticated`, `isLoading`, `error` |
| Language | `src/store/useLanguageStore.ts` | No | Idioma seleccionado (preparado, no activo) |

---

## 9. Configuración & Environment

**`.env`**
```
NEXT_PUBLIC_API_URL_HIT=https://www.kunas.co/api/v1
NEXT_PUBLIC_API_URL_GUEST=https://www.kunas.co/api/v1
NEXT_PUBLIC_ENABLE_MOCKS=false
NEXT_PUBLIC_APP_API_TOKEN=fiKyAWOMla...
```

> [!NOTE]
> `NEXT_PUBLIC_ENABLE_MOCKS` existe pero el check-in usa su propio flag interno `USE_MOCK`.

**`next.config.ts`**: Solo permite `images.unsplash.com` en remote patterns.

---

## 10. Documentación Interna

14 archivos en [/docs/](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/docs):

| Doc | Contenido | Tamaño |
|---|---|---|
| API_DOCUMENTATION.md | Referencia completa API Kunas | 62KB |
| CHECKIN_FLOW.md | Diseño del flujo de check-in | 23KB |
| CHECKIN_V4_API_ALIGNMENT.md | Alineación frontend ↔ backend v4 | 22KB |
| CHECKIN_V4_IMPLEMENTATION_PLAN.md | Plan de implementación v4 | 18KB |
| CHECKIN_V4_TESTING_GUIDE.md | Guía de QA con casos de prueba | 20KB |
| CHECKIN_V4_QA_GAP_AND_FAILURE_PLAN.md | Plan de gaps y failures | 17KB |
| BACKEND_REQUIREMENTS_V4.md | Requerimientos para backend | 13KB |
| CHECKIN_BACKEND_HANDOFF.md | Handoff previo para backend | 22KB |
| BRAND_GUIDELINES.md | Colores y tipografía | 3KB |
| ENV_CONFIGURATION.md | Variables de entorno | 3KB |

---

## 11. Deuda Técnica Conocida

| Issue | Ubicación | Impacto |
|---|---|---|
| **Sin middleware de auth** | Falta `middleware.ts` | Rutas admin accesibles sin login |
| **camelCase/snake_case duplicados** | properties-service.ts payloads | Envía `thumbnailUrl` + `thumbnail_url` simultáneamente |
| **Check-in hardcoded a mock** | `checkin-service.ts:36` | `USE_MOCK = true` no se controla por env var |
| **Catálogos mock en IdentifyScreen** | IdentifyScreen.tsx:45-46 | Usa `mockCountries` y `mockDocumentTypes` en vez de CatalogService |
| **StatsCards hardcoded** | StatsCards.tsx | Valores literales (4, 2, 8, $14.5M) |
| **Sin upload de archivos** | Todo el proyecto | No hay S3/presigned URLs — fotos son URLs manuales |
| **Root metadata genérica** | layout.tsx | `title: "Create Next App"` |
| **Login Google stub** | auth-service.ts | `throw new Error("not implemented")` |
| **Cero tests** | — | Ni unit, ni integration, ni e2e |

---

## 12. Lo Que Sigue — Prioridades

### 🔴 Alta (Bloqueante para producción del check-in)

1. **Backend: implementar los 7 endpoints de check-in** (ver `/docs/BACKEND_REQUIREMENTS_V4.md`)
2. **Flip `USE_MOCK = false`** y validar E2E con backend real
3. **Reemplazar catálogos mock** en IdentifyScreen por CatalogService real
4. **Integrar Didit en producción** — configurar webhook + API keys

### 🟡 Media (Mejoran la plataforma)

5. **Auth middleware** — proteger `/dashboard/*`
6. **Dashboard stats reales** — endpoint o cálculo desde reservas
7. **OperationsPanel real** — conectar a `GET /reservations/{uuid}`
8. **Settings real** — conectar a API de cuenta
9. **Team real** — conectar a CRUD de usuarios
10. **Normalizar camelCase/snake_case** — limpiar duplicación de payloads

### 🟢 Baja (Nice-to-have)

11. **S3 upload** — fotos de propiedades, documentos, firmas
12. **Tests** — empezar por services y check-in flow
13. **CI/CD** — conectar Vercel a Git
14. **Login Google** — OAuth
15. **I18n activo** — ya está preparado
16. **Dark mode toggle** — CSS vars definidas

---

## 13. Referencia Rápida de Archivos Clave

| Para entender... | Abre este archivo |
|---|---|
| Cómo se comunica con la API | [api-client.ts](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/lib/api-client.ts) |
| Tipos del check-in (contrato API) | [checkin.ts](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/features/checkin/types/checkin.ts) |
| Service del check-in (mock flag) | [checkin-service.ts](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/features/checkin/services/checkin-service.ts) |
| Mock data del check-in | [mock-guest-data.ts](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/features/checkin/data/mock-guest-data.ts) |
| Sesión del usuario | [auth-store.ts](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/lib/store/auth-store.ts) |
| Colores y design tokens | [globals.css](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/app/globals.css) |
| Layout del dashboard | [Sidebar.tsx](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/components/layout/Sidebar.tsx) |
| Propiedades (servicio) | [properties-service.ts](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/features/properties/services/properties-service.ts) |
| Reservas (servicio) | [reservations-service.ts](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/features/reservations/services/reservations-service.ts) |
| Catálogos (servicio) | [catalog-service.ts](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/features/auth/services/catalog-service.ts) |
| Tipos compartidos | [types/index.ts](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/src/types/index.ts) |
| Config Next.js | [next.config.ts](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/next.config.ts) |
| Variables de entorno | [.env](file:///Users/juancamilorodriguez/Desktop/Hit-Guest-Frontend/.env) |
