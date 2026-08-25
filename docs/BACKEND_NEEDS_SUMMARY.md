# Lo que necesitamos del Backend — HitGuest v4.0

**Fecha:** Mayo 2026 · **Estado:** Bloqueados hasta tener estos endpoints

---

## Endpoints que necesitamos

| # | Método | Endpoint | Para qué |
|---|--------|----------|----------|
| 1 | `POST` | `/checkin/{uuid}/resolve-identity` | Buscar o crear guest por documento (doc_type_id, doc_number, nationality_id) → retorna `guest_uuid` |
| 2 | `POST` | `/checkin/{uuid}/guest/{guestUuid}/verify` | Iniciar verificación biométrica → retorna `verification_url` o `session_id` |
| 3 | `GET` | `/checkin/{uuid}/guest/{guestUuid}/verification-status` | Polling cada 3s para saber si Didit/Textract ya respondió → retorna `status` + `pre_filled_data` |
| 4 | `POST` | `/checkin/{uuid}/guest/{guestUuid}/complete` | Guardar datos finales + firma digital → retorna `smartlock_codes[]` + `contract_pdf_url` |
| 5 | `GET` | `/checkin/{uuid}/status` | ¿El main guest ya completó? → Para desbloquear secundarios |
| 6 | `POST` | `/uploads/presigned` | URL pre-firmada de S3 para subir fotos de documentos |

---

## Bloqueante activo

- ⚠️ **Origen de la reserva — `PUT /reservations/{uuid}`** (abierto 2026-08-19).
  Ningún endpoint expone si una reserva entró por sincronización o la creó el PM
  a mano: `source` es el canal comercial, y `source_pms` solo existe a nivel
  Listing. Sin ese dato no podemos diferenciar en la UI, y el bloqueo que había
  (adivinando por canal) impedía editar reservas creadas a mano.
  Detalle y `curl` en
  [`BACKEND_NEEDS_RESERVATION_ORIGIN.md`](./BACKEND_NEEDS_RESERVATION_ORIGIN.md).

- ⚠️ **Garantía con tarjeta — `POST /checkin/{uuid}/main/guarantee/setup-intent`**
  (abierto 2026-08-19). No bloquea desarrollo, **bloquea el diagnóstico**: el
  endpoint responde 200 y el huésped igual queda trabado en «Preparando
  formulario…». Necesitamos saber si un 200 puede traer `publishableKey` /
  `clientSecret` ausente o vacío, y un body real para reproducirlo.
  Detalle, evidencia y `curl` en
  [`BACKEND_NEEDS_GUARANTEE_SETUP_INTENT.md`](./BACKEND_NEEDS_GUARANTEE_SETUP_INTENT.md).

- ✅ **`send-checkin-link` 401 "Invalid or unauthorized token provided"** — Resuelto. Causa raíz confirmada: el Handler del backend mapeaba `AuthorizationException` (policy) a **401** en vez de 403, por eso parecía un problema de token/guard. Corregido; el endpoint funciona.

## Contrato de aislamiento por usuario (confirmado por backend — jul 2026)

- **Listados** (`GET /properties`, `/listings`, `/reservations`): filtran por dueño del token **de forma obligatoria en el controlador** — no dependen de ningún filtro del front.
- **Detalle por uuid** (`GET .../{uuid}`): `Gate::authorize('view')` + policies (`withinScope()`).
  - uuid inexistente → **404**
  - uuid válido pero de otra cuenta → **403** *(antes daba 401 por el bug del Handler — ya corregido)*
- **Impacto en el front (ya cubierto):** el logout automático solo se dispara con **401**; un **403** muestra "No tienes permiso para acceder a este recurso" sin cerrar sesión. Todas las llamadas por-cuenta usan solo el token de sesión del usuario (sin fallback al app token compartido).
- 🔴 **Pendiente backend — SUPER_ADMIN también debe ver solo lo suyo.** Detectado (jul 2026): logueado como Root (SUPER_ADMIN), `GET /properties` devuelve propiedades de TODAS las cuentas — `withinScope()` le da scope global a ese rol. **Decisión de producto: incluso el super admin solo ve sus propias properties/listings/reservations** en estos endpoints. Ajustar las policies/`index()` para que el rol SUPER_ADMIN no amplíe el scope en properties, listings ni reservations. El front no requiere cambios (ya manda solo el token de sesión; verificado en BFF y apiClient).

---

## Mi cuenta = CLIENTE · Usuarios = USUARIO (alineado jul 2026)

Modelo confirmado por backend: el registro crea un **CLIENTE** (cuenta facturable) + un **USUARIO** rol PM asociado. El front ya refleja esto:

- **"Mi cuenta"** edita el CLIENTE con los 12 campos: `person_type_id, name, lastname, identification_type_id, identification_number, email, phone, address, address_detail, city, state, country_id`.
- **"Usuarios"** gestiona solo USUARIOS: nombre completo, email, rol.

**Endpoints que necesitamos:**

1. **`GET /account`** → datos completos del CLIENTE (los 12 campos, camelCase o snake_case — el front tolera ambos). Hoy el front lo intenta y cae con gracia a los datos de sesión si no existe.
2. **`PATCH /account`** → aceptar el set completo (hoy el front envía `personTypeId, name, lastname, identificationTypeId, identificationNumber, phone, address, addressDetail, city, state, countryId` — mismo naming que `POST /account/register`). Email nunca se envía (inmutable).
3. **CRUD de usuarios de la cuenta** (sigue pendiente — hoy es mock en el front): listar / invitar / editar / eliminar con `{ name, email, role }`.

## Contratos por canal + firma (jul 2026)

Spec de Ricardo: los contratos se asocian a un **canal** (Airbnb, Directo, …) con **máx. 1 contrato ACTIVO por canal**, y cada contrato define su **método de firma** (TuFirma o Firma HIT). "Firma Digital" deja de ser un nodo suelto de automatización — la firma es un atributo del contrato.

**Front ya listo (a confirmar naming):** el modal de documento, cuando el tipo es Contrato, muestra selects de **Canal** y **Firma**, valida 1-activo-por-canal en cliente, y envía en create/update:
- `reservationSourceId` (id del canal, catálogo reservation sources)
- `signatureProviderSlug` (`"hitguest_signature"` | `"tufirma"`)

**Necesitamos del backend:**
1. Persistir y devolver esos 2 campos en `POST/PATCH/GET /properties/{uuid}/documents` (confirmar naming; el front lee camelCase y snake_case).
2. Validación server-side de **1 contrato activo por canal** (la del front es solo UX).
3. **Automatización "Contratos"**: contrato de parámetros para que el PM seleccione los contratos activos aplicables (uno y solo uno por canal; nunca 2 contratos a una misma reserva). ¿Va en `parametersSchema` del provider? Definir shape.
4. Reestructurar el catálogo de automatizaciones: quitar "Firma Digital" como nodo independiente; el envío del contrato + firma es una sola automatización "Contratos" (provider HIT Guest / TuFirma según el documento).

## Cuenta + Dueño Principal (owner) — base implementada (jul 2026)

Front alineado al contrato `dueno-principal-cuenta-cliente`:
- **Sesión**: `GET /user` cableado → `client_uuid` + `isAccountOwner` en la sesión (enriquecido tras verify-otp). Base del owner-gating.
- **Mi cuenta**: migrado de `/account` a **`GET/PATCH /clients/{uuid}`** (12 campos, PATCH parcial, 200 sin body). El logo (`/clients/{uuid}/logo`) sigue igual. → **Ya NO usamos `GET /account`** (elimina la suposición previa).
- **Usuarios**: `userService` real (era mock) → `GET/POST/DELETE /users`. **Solo CREAR + ELIMINAR** — la edición de usuario se quitó a propósito (decisión de Ricardo jul 2026): cambiar el email = otra identidad → requeriría flujo OTP de re-verificación que no existe. `PATCH /users/{uuid}` (updateUser) se removió del service; re-agregar cuando exista ese flujo. Owner-gating: badge "Dueño", solo el owner crea `property_manager` (los demás solo staff/read_only), eliminar solo owner y nunca la propia fila ni otro owner. 403 genérico → mensaje propio; 422 de owner-protección → se muestran directos (traducidos).

**Blockers / pendientes de backend:**
1. 🔴 **El rol NO viaja en `UserResource`.** Por eso la tabla de Usuarios **no muestra el rol por fila** (solo el badge de owner vía `isAccountOwner`). Para mostrar/filtrar por rol, agregar `roles: [...]` (getRoleNames de Spatie) a `UserResource`. En edición no puedo prellenar el rol actual → el selector arranca en "No cambiar".
2. **Sin invitación por correo**: `POST /users` crea con contraseña definida en la UI (hoy la ingresa el owner). Si se quiere invitación con activación, es feature nueva.
3. Pendiente 2º paso (no implementado aún): **transferir propiedad** (`POST /clients/{uuid}/transfer-ownership`) y **eliminar cuenta** (`DELETE /clients/{uuid}`).

## Logo de cliente (jul 2026) — implementado

Front listo según el contrato de logo (`POST`/`DELETE /clients/{uuid}/logo`, multipart campo `logo`, PNG/JPEG ≤2MB). Sección "Logo de la cuenta" en Mi cuenta con validación cliente, preview, reemplazo, borrado y manejo 422/403/401.

**Suposición a confirmar con Ricardo:** el contrato dice tomar `client_uuid` de `GET /user` y `logoUrl` de `GET /clients/{uuid}`. El front **reutiliza `GET /account`** (que ya carga el cliente para los 12 campos) y espera que esa respuesta incluya **`uuid`** y **`logoUrl`** (el contrato recomienda "reutilizar esa misma respuesta"). 
- Si `GET /account` **no** trae `uuid`, la sección de logo se muestra deshabilitada (no rompe) → habría que exponer `uuid` en `/account`, o cambio el front a `GET /user` + `GET /clients/{uuid}`.
- `logoUrl` ausente (sin logo) se maneja como null.

## Mejoras menores (no bloqueantes)

- 🟡 **Crédito de bienvenida USD 10 en el registro.** Cada nuevo registro de usuario debe abrir la cuenta con **USD 10 de saldo**. Esto es 100% backend: acreditar el saldo al crear/activar la cuenta, de modo que `GET /billing/balance` devuelva `10.00` para una cuenta nueva (idealmente también como transacción visible en `GET /billing/transactions`, tipo "Crédito de bienvenida"). El front ya lo comunica en el formulario de registro y en la pantalla de activación; si el monto llegara a cambiar, avisar para actualizar el texto.

- ✅ **`communicationsLocale` en el detalle de la reserva** — Resuelto. El backend ya lo expone en `GET /reservations/{uuid}` dentro de `listing.communicationsLocale`. El front lo lee y el menú "Enviar Link de Check-in" muestra el idioma default de la propiedad (ej. "Idioma de la propiedad · Español").

---

## Campos nuevos en el GET existente

El `GET /checkin/{uuid}` que ya funciona necesita agregar:

```json
{
  "main_guest_provider": "didit",
  "secondary_guest_provider": "textract",
  "has_contract": true,
  "main_guest_status": "pending",
  "listing_smartlocks": [
    { "name": "Entrada edificio", "type": "building_entrance" },
    { "name": "Apto 304", "type": "unit_entrance" }
  ]
}
```

---

## Tablas nuevas

| Tabla | Propósito |
|-------|-----------|
| `listing_smartlocks` | Cerraduras por listing (nombre, tipo, activa) |
| `reservation_smartlock_codes` | Códigos generados por reserva + cerradura |
| `guest_verifications` | Resultado de Didit/Textract por guest |

---

## Preguntas clave

1. ¿Los secundarios reciben su propio link por email o entran por el mismo link de la reserva?
2. ¿La firma se guarda en S3 como imagen o en DB como base64?
3. ¿Los smartlock codes son random o vienen de API externo (TTLock, Nuki)?
4. ¿Ya tienen algo de Didit/Textract integrado o es desde cero?
