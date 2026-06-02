# 🏨 Hit-Guest Frontend — Handoff Actualizado

**Fecha:** 29 Mayo 2025 | **Branch:** features/dashboard | **Build:** ✅ Passing  
**Framework:** Next.js 16.1.6 (App Router) | **Deploy:** Vercel (CLI manual)

---

## 1. ¿Qué es Hit Guest?

Plataforma SaaS de gestión hotelera con **dos apps** en un solo proyecto Next.js:

| App | Grupo de rutas | Usuario | Estado |
|-----|---------------|---------|--------|
| Dashboard Admin | `/(dashboard)/dashboard/*` | Operador/Host | ✅ Conectado a API real |
| Check-in Guest | `/(guest)/checkin/*` | Huésped | 🟡 UI completa, **100% mock** (backend no tiene los endpoints) |

**Backend:** API Kunas — `https://www.kunas.co/api/v1`

---

## 2. Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js (App Router + Turbopack) | 16.1.6 |
| UI | React | 19.2.3 |
| Estilos | TailwindCSS v4 + shadcn/ui | — |
| Forms | react-hook-form + Zod | v7 / v4 |
| Estado global | Zustand (persist → localStorage) | v5 |
| Tablas | @tanstack/react-table | v8 |
| Query | @tanstack/react-query | v5 |
| Mapas | Leaflet + react-leaflet | v1.9 / v5 |
| Verificación ID | @didit-protocol/sdk-web | v0.2.1 |
| Firma digital | react-signature-canvas | v1.1.0 |
| Dates | date-fns | v4 |

---

## 3. Estado Actual por Módulo

### ✅ Conectados a API Real (Dashboard)

| Módulo | Service | Endpoints reales |
|--------|---------|-----------------|
| **Auth — Login OTP** | `auth-service.ts` | `POST /auth/login` → `POST /auth/verify-otp` → `POST /auth/resend-otp` → `POST /auth/logout` |
| **Auth — Register** | `auth-service.ts` | `POST /account/register` |
| **Catálogos** | `catalog-service.ts` | `GET /catalogs?...`, `GET /countries`, `GET /catalogs/category/currencies`, `GET /catalogs/category/timezones` |
| **Properties — CRUD** | `properties-service.ts` | `GET/POST /properties`, `GET/PUT/PATCH/DELETE /properties/{uuid}`, `POST /properties/{uuid}/restore` |
| **Listings — CRUD** | `listings-service.ts` | `GET/POST /listings`, `GET /listings?propertyUuid=...`, `PUT/DELETE /listings/{uuid}` |
| **Reservations — Lista** | `reservations-service.ts` | `GET /reservations` → mapping robusto con normalización de campos |
| **Reservations — Crear** | `ReservationDialog.tsx` | `POST /reservations` con selects dinámicos desde catálogos |

### 🟡 Operando con Mock (Datos hardcoded)

| Módulo | Archivo | Razón |
|--------|---------|-------|
| **Check-in completo** | `checkin-service.ts` | `USE_MOCK = true` (línea 36). Backend NO tiene los 7 endpoints de checkin |
| **OperationsPanel** (detalle reserva) | `OperationsPanel.tsx` | Usa `detailedMockReservations` hardcoded — no hay `GET /reservations/{uuid}` |
| **Dashboard Stats** | `StatsCards.tsx` | Valores literales: 4, 2, 8, $14.5M |
| **Settings (Empresa)** | `client-service.ts` | `setTimeout()` mock — no hay API de cliente |
| **Team (Usuarios)** | `user-service.ts` | Array in-memory — no hay API de usuarios |

### 🔴 No Implementado

| Feature | Detalle |
|---------|---------|
| Middleware auth | No existe `middleware.ts` — rutas `/dashboard/*` accesibles sin login |
| Login Google | `throw new Error("Google Login not implemented yet")` |
| Upload archivos (S3) | No hay integración — fotos son URLs manuales |
| Tests | Cero tests |
| CI/CD | Deploy manual vía `npx vercel --prod` |

---

## 4. Arquitectura de Comunicación con API

```
src/lib/api-client.ts  →  Fetch wrapper centralizado
src/lib/config.ts      →  API_BASE = NEXT_PUBLIC_API_URL_GUEST
src/lib/store/auth-store.ts  →  Zustand: token persistido en localStorage
```

**Flujo de auth en requests:**
1. `api-client.ts` lee token del `authStore` (Zustand)
2. Priority: `sessionToken` (login del usuario) > `APP_API_TOKEN` (token de app)
3. Headers automáticos: `Authorization`, `Content-Type`, `Accept-Language: es`
4. Unwrap automático de `{ data: T }` responses

---

## 5. Mapa de Rutas

### Dashboard Admin

| Ruta | Qué hace | Estado API |
|------|----------|-----------|
| `/dashboard` | StatsCards + ReservationsList | ⚠️ Stats mock, lista real |
| `/dashboard/properties` | CRUD propiedades + listings | ✅ Real |
| `/dashboard/reservations` | DataTable + Calendar + Dialog crear | ✅ Lista real |
| `/dashboard/reservations/[id]` | OperationsPanel detallado | 🟡 Mock |
| `/dashboard/settings` | Tabs: Perfil, Seguridad, Equipo, etc. | 🟡 Mock |
| `/dashboard/team` | User management | 🟡 Mock |

### Check-in Guest (17 rutas)

| Ruta | Componente | Paso |
|------|-----------|------|
| `/checkin/{uuid}` | WelcomeScreen | Portal de bienvenida |
| `/checkin/{uuid}/identify` | IdentifyScreen | Datos + tipo doc |
| `/checkin/{uuid}/verify` | VerifyScreen | Didit SDK o Upload OCR |
| `/checkin/{uuid}/guest` | GuestFormScreen | Formulario dinámico |
| `/checkin/{uuid}/contract` | ContractScreen | Firma digital |
| `/checkin/{uuid}/success` | SuccessScreen | Resumen + smartlocks |
| `/checkin/{uuid}/{listingUuid}/{ext}/...` | Mismos componentes | Ruta PMS alternativa |
| `/checkin/{uuid}/s/{token}/...` | Secondary* componentes | Flujo acompañantes |

---

## 6. Check-in — Detalle del Módulo (100% Mock)

### Endpoints que necesita del backend (NO existen aún):

| Método | Endpoint | Payload/Respuesta |
|--------|----------|-------------------|
| `getPortal` | `GET /checkin/{uuid}` | → `{reservation, progress, registeredGuests[]}` |
| `identify` | `POST /checkin/{uuid}/identify` | `{identificationTypeId, identificationNumber, nationalityId, name, lastname, isMainGuest}` → `{guest, reservationGuest, verification, formSchema}` |
| `getGuestFormSchema` | `GET /checkin/{uuid}/form/{guestUuid}` | → campos dinámicos required/optional |
| `completeMainGuest` | `POST /checkin/{uuid}/main/complete` | profile + extra + signature |
| `completeSecondaryGuest` | `POST /checkin/{uuid}/secondary/{guestUuid}/complete` | form data acompañante |
| `uploadDocumentImages` | `POST /checkin/{uuid}/secondary/{guestUuid}/documents` | FormData: frontImage, backImage → OCR |
| `getContractTemplate` | `GET /checkin/{uuid}/contract-template` | → HTML template |

### Estado entre pantallas (localStorage):

| Key | Escrito por | Leído por | TTL |
|-----|------------|-----------|-----|
| `checkin-identify-{uuid}` | IdentifyScreen | VerifyScreen, GuestFormScreen | 2h |
| `checkin-guest-form-{uuid}` | VerifyScreen (OCR), GuestFormScreen | ContractScreen | Sesión |
| `checkin-main-done-{uuid}` | ContractScreen | WelcomeScreen | Permanente |
| `checkin-secondary-done-{uuid}-{guestUuid}` | SecondaryGuestFormScreen | WelcomeScreen | Permanente |

### Componentes (18):

`WelcomeScreen`, `IdentifyScreen`, `VerifyScreen`, `GuestFormScreen`, `ContractScreen`, `SuccessScreen`, `SecondaryGateScreen`, `SecondaryGuestFormScreen`, `SecondarySuccessScreen`, `StepIndicator`, `ProgressRing`, `DocumentUpload`, `SearchableSelect`, `FormInput`, `SignaturePad`, `SmartlockCodes`, `CollapsibleSection`, `GuestHeader`

---

## 7. Archivos Clave (Referencia Rápida)

| Para entender... | Archivo |
|-----------------|---------|
| Comunicación con API | `src/lib/api-client.ts` |
| Config y env vars | `src/lib/config.ts` |
| Tipos del check-in | `src/features/checkin/types/checkin.ts` |
| Service check-in (mock) | `src/features/checkin/services/checkin-service.ts` |
| Auth service (real) | `src/features/auth/services/auth-service.ts` |
| Catálogos service (real) | `src/features/auth/services/catalog-service.ts` |
| Properties service (real) | `src/features/properties/services/properties-service.ts` |
| Listings service (real) | `src/features/properties/services/listings-service.ts` |
| Reservations service (real) | `src/features/reservations/services/reservations-service.ts` |
| Sesión del usuario | `src/lib/store/auth-store.ts` |
| Design tokens | `src/app/globals.css` |
| Types compartidos | `src/types/` |

---

## 8. Deuda Técnica Conocida

| Issue | Impacto |
|-------|---------|
| **camelCase/snake_case duplicados** en `listings-service.ts` | Envía ambos formatos simultáneamente como workaround |
| **Check-in hardcoded a mock** (`USE_MOCK = true`) | No controlado por env var — requiere editar código |
| **Sin middleware de auth** | Rutas admin accesibles sin login |
| **StatsCards hardcoded** | No refleja datos reales |
| **OperationsPanel mock** | No hay endpoint de detalle de reserva |
| **Sin upload de archivos** | No S3/presigned URLs |
| **Login Google stub** | Solo `throw new Error` |
| **Cero tests** | Ni unit, ni integration, ni e2e |
| `console.log` de debug en services | Logs de desarrollo activos en producción |

---

## 9. Prioridades para Producción

### 🔴 Bloqueante (Check-in)

1. **Backend**: Implementar los 7 endpoints de check-in (ver `docs/BACKEND_REQUIREMENTS_V4.md`)
2. Flip `USE_MOCK = false` y validar E2E
3. Configurar Didit en producción (webhook + API keys)

### 🟡 Mejoras Dashboard

1. `GET /reservations/{uuid}` → eliminar mock del OperationsPanel
2. API de stats → eliminar StatsCards hardcoded
3. API de clients → eliminar client-service mock
4. API de users → eliminar user-service mock
5. Auth middleware → proteger `/dashboard/*`
6. Limpiar duplicación camelCase/snake_case en listings

### 🟢 Nice-to-have

- S3 upload (fotos, documentos, firmas)
- Tests
- CI/CD (Vercel ↔ Git)
- Login Google (OAuth)
- i18n activo
- Dark mode toggle

---

## 10. Variables de Entorno

```env
NEXT_PUBLIC_API_URL_HIT=https://www.kunas.co/api/v1
NEXT_PUBLIC_API_URL_GUEST=https://www.kunas.co/api/v1
NEXT_PUBLIC_ENABLE_MOCKS=false
NEXT_PUBLIC_APP_API_TOKEN=fiKyAWOMla...
```

> ⚠️ `NEXT_PUBLIC_ENABLE_MOCKS` existe pero el check-in ignora este flag y usa su propio `USE_MOCK` interno.

---

## 11. Comandos

```bash
npm run dev      # Dev server en puerto 4000
npm run build    # Build producción
npm run start    # Start producción en puerto 4000
npx vercel --prod  # Deploy manual
```
