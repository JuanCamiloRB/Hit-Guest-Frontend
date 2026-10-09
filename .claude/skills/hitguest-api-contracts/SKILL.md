---
name: hitguest-api-contracts
description: Contratos reales de la API de HitGuest (guest.hit.tools) — qué endpoints existen, qué devuelven de verdad, qué está VERIFICADO contra el backend vivo y qué es solo documentación que ya resultó falsa. Incluye cómo autenticarse para comprobarlo por curl. Activar ANTES de tocar cualquier código que hable con el backend (automatizaciones de propiedad, contrato y firma, portal de check-in) Y TAMBIÉN cada vez que el backend mande o cambie un endpoint, payload o regla: registrar y documentar ese ajuste acá en el momento es parte obligatoria del skill.
---

# HitGuest — Contratos de API verificados

Este skill existe porque el repo perdió tiempo repetidas veces confiando en
documentación del backend que resultó incompleta o falsa. **Lo que está acá con
la marca ✅ se comprobó contra `guest.hit.tools` con un token real, no se
dedujo.** Lo marcado ⚠️ es documentación sin verificar, y ❌ es documentación
que ya se demostró falsa.

Regla que ordena todo lo demás: **ante un conflicto entre un documento y una
respuesta observada de la API, gana la respuesta observada.** Y ante una duda
que se puede resolver con un `curl`, se resuelve — no se elige la interpretación
conveniente.

> **Este skill se escribe, no solo se lee.** Cada endpoint, payload o regla que
> el backend mande o cambie se registra acá **en el momento** en que aparece.
> El protocolo está al final, en *Mantenimiento*, y es obligatorio: es lo único
> que impide volver a investigar lo mismo dentro de dos semanas.

---

## 0. Cómo comprobar cualquier cosa de acá

```
Base: https://guest.hit.tools/api/v1
```

Dos credenciales distintas, y confundirlas cuesta una sesión entera de
depuración:

| Credencial | Dónde vive | Sirve para |
|---|---|---|
| **App token** | `NEXT_PUBLIC_APP_API_TOKEN` en `.env` | Portal del huésped (rutas `checkin/*`, públicas). Da **401** en todo lo del PM. |
| **Token de sesión del PM** | `localStorage["auth-storage"] → state.user.token` | Todo el dashboard. |

El login es **OTP al email** (`POST /auth/login` → código → `POST /auth/verify-otp`),
así que no se puede automatizar sin acceso al inbox: el token hay que sacarlo de
devtools. Es una credencial viva — rotarla después de usarla.

```bash
API=https://guest.hit.tools/api/v1
H=(-H "Accept: application/json" -H "Content-Type: application/json" \
   -H "Authorization: Bearer $TOKEN")
curl -s "$API/providers?country=CO" "${H[@]}" | jq
```

Para saber si una ruta existe sin credenciales: **401 = existe**, 404 = no
existe, 405 = existe con otro método.

### 0b. Alta de cuenta: el registro NO emite ningún OTP

✅ **Verificado con un alta real el 2026-09-02** (correo recibido por el usuario):
`POST /account/register` (app token) crea la cuenta y envía **solo el correo de
bienvenida** — «Welcome aboard… Log in to my account». **No manda código.**

El código de 6 dígitos lo emite **`POST /auth/login`**, y el registro nunca lo
llama. Son dos flujos distintos que comparten el mismo endpoint de verificación:

```
Alta:   POST /account/register  → correo de bienvenida. Fin.
Acceso: POST /auth/login {email} → correo con el código
        POST /auth/verify-otp {email, otp} → sesión
```

⚠️ **`POST /auth/resend-otp` no sirve para un correo recién registrado.**
Necesita una sesión OTP previa creada por `/auth/login`, que en el alta no
existe. Observado (2026-09-01, contra **producción**): tras un
`/account/register` que respondió **201**, el reenvío para ese mismo correo
respondió **502**. Pedido para backend: que devuelva un 4xx explicando la causa
en vez de reventar — un 502 se lee como caída del servicio y hace que el
frontend reintente algo que nunca puede funcionar.

**Qué se rompe si se asume mal**: el frontend tenía una pantalla de OTP después
del registro. Pedía un código que el backend jamás había enviado, y «Reenviar»
llamaba a un endpoint que no podía funcionar. La cuenta quedaba creada y el
usuario encerrado. Corregido el 2026-09-02: el alta termina en una pantalla de
bienvenida con enlace a `/login`, que es donde el código sí se emite.

---

## 1. Automatizaciones de propiedad

### Quién crea las filas — el punto que más confusión causó

✅ **El backend solo auto-crea las dos de identidad.** Dejó de crear el resto
*a propósito*, para no llenar una propiedad de automatizaciones que nunca va a
usar.

✅ **El PM no puede crear filas.** `POST /property-automations` con un
`propertyUuid` válido responde `403 {"message":"Invalid or unauthorized token
provided."}` — le falta la habilidad `admin:create`. Control: `PATCH
/property-automations/{uuid}/configure` con el MISMO token llega a `422`
(validación), o sea que el token sí escribe. `POST /properties/{uuid}/automations`
da **405**.

❌ Documentación falsa detectada: que el `default_setup` crea todas las filas
por país. Solo cubre identidad hoy.

### De dónde sale "qué automatizaciones aplican"

✅ `GET /providers?country={ISO2}` filtra por `parameters.applicable_countries`
y **cada provider trae `parameters.default_setup`**:

```json
{ "enabled": true,
  "slots": [{ "name": "...", "order": 40, "guest_type": "all",
              "status_provider_id": 10, "parameters": { "token": "", "rnt": "" } }] }
```

Ese es el contrato. `enabled: false` = no se ofrece.

✅ Payload real para CO (2026-08-13):

| id | slug | `applicable_countries` | `default_setup` |
|---|---|---|---|
| 1 | `tra_colombia` | `["CO"]` | order 40, params `token, rnt` |
| 2 | `sire_colombia` | `["CO"]` | order **50 y 51** (check-in / check-out), params `document_type, document_number, password, company_code` |
| 1000 | `didit` | **ausente** ⚠️ | — |
| 1001 | `ttlock` | `["ALL"]` | order 20, params `username, password, client_id, client_secret, locks` |
| 1002 | `tufirma` | `["ALL"]` | **`enabled: false`** |
| 1003 | `pdf_report` | `["ALL"]` | order 30, params `recipients` |
| 1004 | `textract` | **ausente** ⚠️ | — |
| 1005 | `hitguest_signature` | `["ALL"]` | order 10, `main_guest`, **status 8 (nace activa)** |
| 1006 | `stripe_card_on_file` | `["ALL"]` | `enabled: false` |

Los providers 3-6 tienen `parameters.slug` en `null`.

**Trampas confirmadas:**

- ❌ Los `executionOrder` 1..8 **no existen**. Los reales son 10/20/30/40/50/51.
  Nunca hardcodear un orden ni identificar una automatización por su número.
- ❌ «`client_id`/`client_secret` de TTLock los gestiona HIT internamente» — falso,
  van en `parameters` y el PM los carga.
- ✅ Los slugs reales usan **guion bajo** (`tra_colombia`), y nuestras
  definiciones usan guion medio. Por eso **siempre** se compara con
  `canonicalSlug()`.
- ⚠️ **CONTRADICCIÓN ABIERTA.** La referencia del backend del 2026-08-12 declara
  resuelto que `?country=XX` ya devuelve los providers sin país declarado, y que
  por eso `didit` y `textract` aparecen. **Comprobado el 2026-08-12 23:02 UTC:
  no aparecen**, y el JSON de ambos llega sin la clave `applicable_countries`.
  Hasta que se confirme lo contrario, el catálogo no puede ofrecer un slot de
  identidad faltante. Repetir con:
  `curl -s "$API/providers?country=CO" "${H[@]}" | jq -r '.data[].parameters.slug'`
- ✅ `GET /providers` **pagina** (15 por defecto). Hoy entran justo en la primera
  página; con un provider más, una UI que lea solo `data` empieza a perderlos.
  `automationService.listProviders()` ya sigue la paginación leyendo
  `meta.last_page`.

### Los dos slots de identidad: obligatorios al CREAR, no al apagar

❌ **Corregido 2026-08-14.** Acá decía que no se pueden desactivar y que hay que
bloquear el switch. **Es falso**, y se implementó ese bloqueo por error. La
palabra «obligatoria» describe **quién crea la fila**, no si se puede apagar:

- **Estructural** — el backend **siempre** crea las filas de identidad
  `main_guest` y `secondary_guest`, aunque el cliente mande `automations` vacío
  u omitido. Por eso el frontend **omite** el array al crear la propiedad.
- **Operativo** — el PM **sí puede activar y desactivar** las dos. Al activarlas
  debe elegir Didit o Textract. Sin badge «Obligatorio», sin switch bloqueado.

Lo que sigue vigente: activar exige `providerId`; asignar provider desactiva
automáticamente el otro slot activo del mismo `guest_type`; y una fila ya creada
se identifica por `guest_type` + `execution_order <= 2`, mientras que **al
crear** la señal es el provider (`parameters.verification_type`).

⚠️ **Contradicción abierta con reservas (observado en producción 2026-09-15):**
apagar identidad ya funciona en el dashboard, pero `POST /reservations` la
sigue exigiendo. Con la verificación del huésped principal inactiva, el create
devuelve 422 con el mensaje «La propiedad debe tener una automatización de
Verificación de Identidad activa y configurada para el huésped principal antes
de crear una reserva» (llega en `errors` anclado al campo del alojamiento; el
front lo muestra tal cual, no lo genera). Es decir: el flujo «sin verificación
de identidad» NO está disponible end-to-end — se puede apagar el slot pero la
propiedad queda sin poder crear reservas. Preguntado al backend si esa regla se
relaja (o si el camino oficial es el waiver por reserva del doc de override).

### Verificación de identidad en el portal — cuatro trampas ya pagadas

✅ *Verificado en código el 2026-08-14.*

**Didit: `completed` no significa aprobado, y exigir `Approved` es un falso
negativo.** El frontend pedía `result.type === "completed"` **y**
`session.status === "Approved"`. En `@didit-protocol/sdk-web` v0.2.1,
`buildSessionData()` usa `Pending` cuando el evento `didit:completed` no trae
status — su valor por defecto. Con la verificación **aprobada** en el admin de
Didit y en la BD, la pantalla mostraba error. `completed` solo significa «se
cerró el flujo»; la decisión se reconcilia contra el portal y `/verify/result`
(`lib/didit-completion.ts`). Éxito: `approved`, `verified`, `completed`, `form`.

**El KYC lo señala `sessionType: "kyc"` + una URL nueva** — nunca se deduce de
`status: "pass"`. `pass` es una **transición**: ni éxito ni señal de escalada.
`sessionType` (`"biometric" | "kyc" | null`) es canónico y reemplazó a `subtype`.

**Textract: el 200 YA es la aprobación persistida.** Tras un 200 se avanza
directo a confirmación, sin volver a consultar el portal — esa consulta extra
producía la carrera del clásico «falla la primera vez y con los mismos datos pasa
la segunda». Y un 2xx **sin `extractedData`** no debe lanzar un error local: el
backend ya aprobó. Fijado por `VerifyScreen.test.tsx`.

**`isStale` manda sobre la espera.** Se eliminaron los timeouts locales de 3
minutos y 60 segundos; el backend decide cuándo la espera es obsoleta. Se
conserva el token de generación contra el sondeo zombi.

Además: `UNSUPPORTED_DOCUMENT_LAYOUT` se lee de `errorType`, `error_type` o
`code`, y le dice al huésped que use **pasaporte**.

> **El principio detrás de las cuatro**: el sondeo lo ejecuta el frontend, pero
> el **backend es la autoridad** sobre cuándo continuar, escalar, aprobar,
> rechazar o dar la espera por obsoleta. No montar una máquina de estados
> paralela en React.

El proveedor se elige por tipo de huésped de forma independiente: **no existe la
regla «principal = Didit, secundarios = Textract»** — cualquier combinación vale.

### ⚠️ Verificación de identidad OPCIONAL + captura de documento — contrato 2026-09-27 (implementado en front 2026-09-28; NO reverificado por curl)

*(Doc de backend `20260926_frontend-captura-documento-sin-verificacion.md`,
commits `515076b` + `a9e02d3`, 2772 tests. Sin migración. **Despliegue
coordinado**: `/identify` devuelve un `type` nuevo que el portal viejo manda al
`default` de error.)*

**Cierra la contradicción abierta de §1 («obligatoria ¿en qué sentido?»)**:
el PM SÍ puede apagar los dos slots de identidad (`configure` con
`statusProviderId: 10` → **200**, antes 422) y también por listing
(`statusRecordId: 7` → 201/200). `POST /reservations` y el PUT que mueve de
listing **dejan de dar 422** por falta de identidad (claves eliminadas:
`missing_identity_main/secondary`, `mandatory_automation_disabled_for_listing`,
`cannot_deactivate_mandatory`, `cannot_disable_mandatory`; el front nunca las
mapeó). Sigue vigente `cannot_disable_unconfigured` (no se desactiva por listing
una automation sin proveedor).

**Portal.** Sin proveedor para su tipo de huésped, `/identify` responde
`verification: { type: "document_capture", requiresBackImage: bool }` — antes
era el 422 «not configured», que ahora solo queda para `verification_type`
desconocido. Recurrente verificado con email → sigue `contact_challenge`; sin
email → `document_capture`. Subida por el MISMO endpoint del OCR
(`POST /checkin/{r}/secondary/{g}/documents`, también para el principal):
`front_image` obligatorio, `back_image` si `requiresBackImage`, `selfie_image`
se ignora. 200 = misma forma que OCR con **`extractedData: {}`** (nada lee el
documento; `formSchema.prefilledData` trae lo declarado). 422 con
`{success:false, errorType, message, failedFields}`: `DOCUMENT_NOT_DETECTED`
(**`failedFields: ["front"|"back"]` como strings**, distinto del OCR que manda
objetos), `DUPLICATE_DOCUMENT`, `SERVICE_UNAVAILABLE` (también fallo de
guardado), `GUEST_ALREADY_COMPLETED`. Si el recorte falla, se guarda la foto
original (no se rechaza); +2–3 s por el recorte. Re-subir permitido hasta
completar. `verification.status` nuevo **`document_captured`** con
`currentStep: "form"`, `verifiedAt: null`, `isStale/canRetry: false`; en este
modo NO aparecen `pending/rejected/fail` (historial de otras estadías ignorado).
`/complete`, `/main/sign` y `/guarantee/setup-intent` sin fotos → 403/422
`identity_not_verified` como hoy; con fotos avanzan. **La captura no se cobra.**

**Panel.** `identityDocument.method` y `capturedBy` pueden valer
**`document-capture`**; `verification.status` puede valer `document_captured`.
Etiqueta obligatoria «sin verificar», visualmente distinta de didit/textract.

**Cómo quedó en el front (2026-09-28):** `VerificationDirective` +=
`document_capture`; `checkinService.identify` normaliza `requiresBackImage`
(camel/snake; ausente ⇒ `true` + warn); `VerifyScreen` en modo captura no pide
selfie, toma `requiresBackImage` de la directiva (no del catálogo), envía
directo desde el paso de fotos, salta la pantalla de confirmación de OCR (con
`extractedData` vacío bloqueaba por fecha de nacimiento) y limpia solo el lado
señalado en `failedFields` (`lib/document-capture.ts`); `verification-result`
devuelve `{status:"verified", captured:true}` (mismo patrón que `waived`) y
`doc-verification.documentNotice` decide el chip del formulario
(«Fotos del documento recibidas», nunca «verificado»); panel: enums, etiqueta
«Fotos del documento · sin verificar» (tono info), `SETTLED_STATUSES`.
Revisión 2026-09-30: `GUEST_ALREADY_COMPLETED` en la subida NO es un fallo:
`VerifyScreen` lo intercepta y lleva a `/success?entry=completion_already_recorded`
(misma recuperación idempotente que `/identify` con `isCheckinCompleted`).
Revisión 2026-09-28: identidad se puede apagar POR LISTING desde la tarjeta
(`supportsListingStatusOverride` en la definición, separado de tener campos —
antes el panel de overrides solo salía con `listingOverrideSchema`);
`failedFields` se normaliza en `buildHttpError` a `{field, reason|null}`
(`normalizeFailedFields`), única forma interna; `isMandatory` eliminado del
modelo; `npm run typecheck` / `npm run verify` como gate.

### ⚠️ iCal — valor total declarado por el huésped principal — contrato 2026-09-27 (implementado front 2026-09-29; NO reverificado por curl)

*(Doc `20260927_precio-total-declarado-main-guest-ical.md`, commits `0fdd8ce` +
`83d4d06`. **Despliegue coordinado**: con el backend nuevo, un portal que no
envíe `totalPrice` recibe 422 y el titular de Airbnb sin valor NO puede iniciar
check-in.)* Reemplaza §5.2 del plan iCal del 2026-09-04: el valor lo declara el
huésped, no el PM; TRA se desbloquea con ese valor; el PM lo corrige después.

**Portal** (`GET /checkin/{uuid}` y ruta externa) → `reservation` +=
`requiresPriceDeclaration: bool` (solo iCal sin valor y sin huéspedes
identificados; **independiente** de `requiresGuestCountDeclaration`) y
`currency: ISO4217` (siempre presente; el huésped declara EN ESA moneda —
nombrarla en el copy, nunca fijar «COP»). `POST /identify` del PRINCIPAL +=
`totalPrice`: **número JSON con punto decimal, > 0, máx. 2 decimales**, nunca
texto formateado (`"1.50"` como texto se lee 1,5). 422 estándar
`errors.totalPrice` («Indícanos el valor total…» si falta; validación
traducida si es inválido); si faltan ambos, UN 422 con `totalGuests` y
`totalPrice`. De un solo uso: después llega `false` y el campo se ignora.
Secundarios, Calry, Kunas y manuales: sin cambio.

**Panel** `GET /reservations/{uuid}` += `priceDeclaredByGuest: bool` (badge
«Valor declarado por el huésped» + corregir; baja a `false` al corregir) y
`extra.guestPriceDeclaration {amount (string decimal), currency, guestUuid,
declaredAt (ISO con zona)}` — auditoría, se conserva, **NUNCA se reenvía en el
PUT** (clave reservada, se descarta). Corregir = `PUT {totalPrice}` de siempre.
⚠️ Si TRA ya se envió, la corrección NO actualiza el reporte (no hay reenvío).
Fuera de alcance: conversión de moneda, reenviar TRA, editar desde el portal.

**Cómo quedó en el front:** `lib/declared-price.ts` (`parseDeclaredPrice`:
ambos separadores → el último es decimal; uno solo → decimal si va una vez con
1–2 dígitos, miles si agrupa de a 3, si no inválido — nunca se adivina; preview
«Vas a declarar: $ 850.000,5» con `Intl` es-CO y la moneda de la reserva);
`IdentifyScreen` recibe `initialPriceDeclaration {required, currency}` desde
las dos páginas de servidor (mismo patrón que `initialGuestCountRequired`) y
manda `totalPrice` numérico; `reservations/lib/guest-price-declaration.ts`
(`readPriceDeclaration`, flag solo con `true` explícito); detalle con badge,
«Corregir valor» (mismo `RegisterPriceDialog` en modo `correct`, precargado) e
historial; el diálogo consulta `/automation-status` al abrir y avisa si TRA ya
se envió con éxito. **Corregido 2026-09-30**: la fuente es el HISTORIAL
`GET /reservations/{uuid}/automation-records` (`classifyRecord === "tra"` +
`status: "completed"`), NO `/automation-status`, que solo lista automatizaciones
ACTIVAS y ocultaba una TRA desactivada después de reportar.
**El flujo del PM «Falta registrar el valor» (`extra.priceUnconfirmed`) SIGUE
VIGENTE por contrato** (§2.1 del doc: «no cambia, simplemente va a aparecer
mucho menos»; §0: «si el PM registra el valor antes de que el huésped se
identifique, gana el PM»). No es un legado a retirar.
Revisión 2026-09-29: el parser valida una GRAMÁTICA antes de limpiar (solo
símbolo/código de moneda alrededor de `[\d.,]+`; «85O000», «1e3», «(500)» y el
menos Unicode se rechazan, no se convierten en otro monto); la comprobación de
TRA es un estado `loading|sent|not_sent|unknown` (en corrección no se guarda
hasta saber, y «no se pudo comprobar» nunca se muestra como «no enviado»);
`currency` del detalle es `string | null` sin fallback a COP y todo monto se
pinta con `src/lib/money.ts` (`formatMoney`, Intl es-CO: EUR sale como «EUR
1.200,00», nunca «$»); el refetch del portal reemplaza los flags en los dos
sentidos; el diálogo del PM valida máximo dos decimales; tests de componente
para IdentifyScreen (QA 1–3, 7, 8), RegisterPriceDialog y ReservationPriceCard.
Revisión 2026-09-30: `parseDeclaredPrice(raw, currency)` recibe la moneda de la
reserva — UN solo código explícito y debe coincidir («USD 500» o «USD 500 COP»
en COP = inválido; `€`/`£`/`US$` se comparan, `$` es ambiguo y lo resuelve el
preview); flag `requiresPriceDeclaration` sin `currency` = incumplimiento de
contrato: el portal bloquea el envío con un aviso y el refetch vivo también
reemplaza la moneda (solo un fetch fallido conserva la del servidor).
Revisión 2026-09-30 (3): `totalGuests`/`totalPrice` se exigen y se envían
SOLO si `isMainGuest && flag` (`mustDeclareGuestCount`/`mustDeclarePrice`): un
secundario con flags en `true` no queda bloqueado por campos que no ve.
Revisión 2026-09-30 (2): el parser recoge TODOS los indicadores de moneda
(símbolo inequívoco + código) y cada uno debe coincidir («€500 COP» en COP es
inválido; «€500 EUR» en EUR vale; `$` no cuenta); `analyzeDeclaredPrice`
devuelve razón discriminada (`empty|invalid_format|duplicate_currency|
currency_mismatch|out_of_range`) y el mensaje se decide con ella.
`npm run verify` = typecheck + `lint:gate` + tests. **Revisión 2026-10-05**:
`lint:gate` (`scripts/lint-changed.mjs --no-regressions`) exige cero errores en
los archivos NUEVOS y que cada archivo MODIFICADO no tenga más errores que en el
merge-base con `@{upstream}` (o `LINT_BASE`) — conteo por archivo con la API de
ESLint, la base lintada con `lintText` sobre `git show base:path`. Antes
`verify` corría `lint:new` (solo nuevos) y dejaba pasar errores nuevos en
archivos existentes. Probado con un `any` temporal: `reservations-service.ts
17 → 18` falla el gate. `lint:changed` (todo en cero) sigue informativo: falla
por la deuda previa (66 errores en los modificados de esta rama).


### Reanudación y respaldo local del portal (auditoría 2026-10-05)

- **`/identify?guest_uuid=` reanuda en las DOS rutas** (por UUID y externa
  `/{source}/{listing}/{externalId}`) con `lib/identify-resume.ts`
  (`resolveIdentifyResume`): `verification` → `/verify`, `contact_challenge` →
  `/contact-challenge`, el resto → `/guest`. La externa no leía `guest_uuid` y
  devolvía al formulario inicial a un huésped con OTP pendiente.
- **Subida aceptada (200 de §17)**: `VerifyScreen` anota
  `uploadOutcome: "verified" | "captured"` en la sesión de identify. Los dos
  formularios lo usan SOLO si el portal y `/verify/result` fallan a la vez
  (`acceptedUploadFallback`): sin eso la directiva `document_upload/capture`
  mandaba a repetir fotos que ya están en la reserva. Una observación real del
  backend siempre gana (un reset del PM vuelve a pedir verificación), y el chip
  de una captura nunca cae al «verificado» por defecto.
- Copy de `IdentifyScreen` neutral («Identificación», «registrar tu
  documento», «Continuar»): antes de la directiva no se sabe si habrá
  verificación o solo captura.
- **Cupo agotado en `/identify` (§7)**: llega SIEMPRE como 422
  `{message, errors: {reservation: [...]}}` (las dos capas, mismo shape desde
  2026-08-12). El front lo detectaba por el TEXTO («maximum»/«máximo»); un
  mensaje traducido sin esa palabra caía como error de campo sobre un campo
  inexistente («revisa los campos marcados» sin nada marcado). Ahora decide por
  la clave `errors.reservation`: toast con el mensaje del backend y vuelta al
  hub. El match por texto queda solo como respaldo de backend viejo.

### ⚠️ Didit: KYC directo para el huésped que Didit nunca verificó — contrato 2026-10-08 (backend DESPLEGADO; front implementado 2026-10-09, sin desplegar; NO verificado por curl)

*(Doc «Frontend — Didit: KYC directo», plan backend
`20261008_reduccion-tiempos-verificacion-didit.md`.)* **No cambia ningún
payload, endpoint ni estado.** Cambia QUÉ valor de `sessionType` recibe el
huésped nuevo en `POST /identify`:

| Huésped | `verification` de `/identify` | Polling |
|---|---|---|
| Didit NUNCA lo aprobó (nuevo, creado por el PM, intento fallido previo, verificado solo por OCR) | `{type:"session", url, sessionType:"kyc"}` (**antes `"biometric"`**) | `pending/in_progress` → `approved` o rechazo (`rejected` + `canRetry` + `failureReason`). **Ya no hay escalación biometric→kyc** |
| Didit YA lo aprobó antes | `sessionType:"biometric"`, igual que hoy, incluida la escalación a KYC si la selfie no alcanza | igual |

La sesión KYC **incluye liveness**: documento (frente y reverso) + UNA selfie,
en una sola sesión (antes: dos sesiones, ~3 min, dos esperas). `expiresAt` pasa
a creación **+ 23 h** (antes 24 h); el enlace de Didit sigue valiendo 24 h.

**Lo que el front ya hace bien** (verificado en código 2026-10-09): el tipo
admite `"biometric" | "kyc"`, `identify()` normaliza `sessionType`/`session_type`,
`IdentifyScreen` guarda la sesión y navega a `/verify` sin mirar el valor,
`VerifyScreen` toma `diditStep` de `verification.sessionType` (también al
reanudar desde `checkin-pending-didit`), lanza esa URL una sola vez y el
polling sigue siendo `/verify/result`. **Cómo quedó en el front (2026-10-09):** el `?didit_error=` del callback es
una PISTA, no el veredicto: el callback redirige DE INMEDIATO al reconciliador
(sin la espera de 2 s ni el «serás redirigido para intentar de nuevo»), las
pistas solo DESCRIBEN lo que dijo Didit (sin prometer reintento), `/verify`
arranca la reconciliación con `/verify/result` SIEMPRE que llega `didit_error`,
también sin sesión ni marcador local (otro navegador, modo privado, contexto
vencido — el sondeo solo necesita los ids de la ruta; muestra «Didit reportó:
… confirmando con el servidor» mientras tanto) y el resultado final trae
`canRetry`, `failureReason` y `attemptsRemaining` — antes un rechazo definitivo
se ofrecía como reintentable con un texto fijo, y sin sesión local ni siquiera
se consultaba al backend. Sin directiva local, «Repetir» vuelve a `/identify`
(resume idempotente), no a una pantalla sin sesión. Copy de `kyc`:
documento por ambos lados + una selfie en un solo proceso (el biométrico no
cambia). Mocks: 112 = KYC directo, 113 = escalación biometric→kyc del huésped
conocido. Comentario de sesión vencida corregido (24 h / `expiresAt` +23 h).
No se calcula ningún vencimiento local nuevo: tras el TTL local de 2 h,
`/identify` es un resume idempotente (contrato 2026-09-04), sin cobro.
⚠️ Pendiente en producción: huésped nuevo → una sola sesión KYC con documento
y una selfie; huésped aprobado antes → biométrico; rechazo reparable y
definitivo vía callback; que no se cree una segunda sesión al nuevo.
### ⚠️ Contrato 2026-09-02/04: `in_review` y `abandoned` son fallos REINTENTABLES; `/identify` nunca duplica por sí solo

*(Documento de backend del 2026-09-02, commits `0095e87` + `3febcae`, con
payloads capturados; + respuesta del 2026-09-04 sobre el reinicio en stale.
Implementado en el front el 2026-09-04 — `verification-result.ts`,
`verification-failure-meta.ts`, `VerifyScreen`.)*

**Tres campos aditivos** en `verification` (portal, por-huésped y
`/verify/result`): `canRetry: bool` (discriminador reparable/definitivo),
`attemptsRemaining: int` (por reserva; máximo configurable en backend — NUNCA
hardcodear el 3), `failureReason: string|null` (código estable →
`document_image_quality`, `face_match_not_computed`, `face_match_failed`,
`document_not_approved`, `manual_review`; el copy es del front).

**Cambios de comportamiento**: `in_review` deja de ser espera — llega
`currentStep: "rejected"` + `canRetry: true` (antes: spinner infinito hasta
isStale). `abandoned` (huésped cerró la pestaña) deja de colapsar en `fail`
permanente: terminal reintentable.

**⚠️ Trampa**: en un rechazo, `verificationUrl` apunta a la sesión MUERTA.
El reintento SIEMPRE es `POST /identify` (devuelve sesión nueva, `sessionType`
"biometric" aunque haya fallado la KYC — recaptura la selfie a propósito).
422 de `/identify` = intentos agotados, `{message}` localizado, mostrar tal
cual.

**Semántica de `/identify` por estado (la pregunta del botón en stale):**

| Estado al pulsarlo | Qué hace el backend | Costo |
|---|---|---|
| `isStale` + pending/in_progress/resubmitted | RESUME idempotente: misma `verification.url`, sin fila nueva, sin cobro. La sesión vieja NO se invalida y puede aprobar después | 0 |
| `isStale` + `kyc_session_failed` | Crea la KYC que nunca existió; la vieja pasa a `superseded`; sin repetir selfie | 1 sesión |
| `canRetry: true` (in_review/abandoned/ocr_rejected) | Marca `superseded` (webhooks tardíos ignorados a propósito), crea sesión + AutomationUsageRecord nuevos | 1 intento |
| `attemptsRemaining: 0` | 422 | — |

⇒ Botón de stale = **«Continuar verificación»** (no «Reiniciar» — la etiqueta
mentiría: es un resume). `isStale` SIGUE sin significar fallo, y en terminales
llega `false`.

**Tolerancia al orden de deploy (regla del front)**: `canRetry` ausente
(backend anterior) cae al comportamiento previo — rejected/fail/expired
terminales, `ocr_rejected` reintentable. El copy de espera para el `status`
`in_review` del portal se conserva como salvavidas para backend viejo.

**Lo que hoy NO existe**: descartar una sesión `pending` sana y forzar una
nueva (enlace de Didit roto → el huésped reabre el mismo enlace hasta el TTL
de 24 h). Es decisión de negocio pendiente del lado backend.


### ⚠️ Tope de intentos en la subida OCR (Textract) — contrato 2026-10-03 (implementado en front 2026-10-05; NO verificado por curl)

*(Actualización del documento de referencia del portal, plan de backend
`20261003_intentos-verificacion-textract-indicadores.md`. El documento llegó
cortado a mitad de §16, así que el detalle de §17 sale del resumen de cambios
del encabezado, no de la sección completa.)*

- `checkin.verification.max_attempts` rige también `POST
  /checkin/{r}/secondary/{g}/documents` (§17): sin intentos responde **422
  `errorType: "VERIFICATION_ATTEMPTS_EXHAUSTED"`** con el mismo `message` que el
  422 de `/identify`, ANTES de llamar a AWS.
- **Todas** las respuestas de §17 (422 y 200) traen el objeto `verification`
  (mismo shape que el portal: `canRetry`, `attemptsRemaining`, `failureReason`…).
- `failureReason` de OCR usa el vocabulario de Didit + tres códigos nuevos:
  `document_number_mismatch`, `duplicate_document`, `service_unavailable`.
- `SERVICE_UNAVAILABLE` (caída de AWS) **no gasta intento**.
- `in_review`/`abandoned` reemplazados por un reintento quedan retirados
  (`extra.retired_at`) y siguen contando contra el tope; solo el reset del PM
  devuelve intentos. Una aprobación se cobra exactamente una vez.

**Cómo quedó en el front:** `buildHttpError` conserva el bloque como
`error.verification` (`readUploadVerification`, camel/snake, solo tipos
correctos). En `VerifyScreen`: `VERIFICATION_ATTEMPTS_EXHAUSTED` es definitivo
(mensaje del backend, sin «Repetir»); `canRetry: false` cierra el reintento aunque
el motivo sea reparable (la última foto borrosa agota el tope) y solo en ese
caso se agrega «ya no quedan intentos» — un motivo ya definitivo (duplicado)
no se atribuye al tope; un rechazo reparable avisa «Te queda N intento(s)»
(≤ 2). En **captura** (`document_capture`) el bloque se ignora: no es
verificación ni tiene tope. `verification-failure-meta` tiene copy para los
tres códigos nuevos (`service_unavailable` dice que el intento no se descontó).
⚠️ Confirmar por curl: forma exacta del bloque en el 422 (¿raíz o dentro de
`data`?; el lector acepta las dos) y si la captura también lo trae.

**Revisión 2026-10-05 con el documento COMPLETO** (`~/Downloads/20260806_referencia-endpoints-checkin-estados 2.md`,
1261 líneas, 2026-10-04; por chat llegaba truncado en §16):
- §17 dice textual: «el frontend decide entre reintentar y soporte con
  `verification.canRetry`». Ahora manda en los DOS sentidos: `canRetry: true`
  reabre un motivo que la tabla local daba por definitivo
  (`DUPLICATE_DOCUMENT`, `EXPIRED_DOCUMENT`, `DOCUMENT_NUMBER_MISMATCH`) como
  reintento de fotos; sin el bloque decide la tabla local.
- Mapeo `errorType → failureReason` (§17): LOW_QUALITY/CRITICAL_FIELD/
  NUMBER_UNREADABLE → `document_image_quality`; UNSUPPORTED_LAYOUT/EXPIRED →
  `document_not_approved`; NO_FACE → `face_match_not_computed`; FACE_MISMATCH →
  `face_match_failed`; NUMBER_MISMATCH/DUPLICATE/SERVICE_UNAVAILABLE → los tres
  nuevos. El doc pide el copy desde `failureReason`; el front muestra el
  `message` del backend (localizado y más específico: EXPIRED trae la fecha) y
  conserva los textos propios de UNSUPPORTED_LAYOUT («usa tu pasaporte») y
  DOCUMENT_NOT_DETECTED (lado señalado). Decisión consciente.
- §18 también devuelve el cupo agotado como 422 `errors.reservation`:
  `SecondaryGuestFormScreen` lo muestra y vuelve al hub (antes se quedaba en un
  formulario que no podía enviar).
- Tiempo de §17 ~10–20 s (recorte con Bedrock): el `fetch` de la subida no
  tiene timeout propio, así que no corta verificaciones que el backend completa.
- Desde 2026-10-03 el reintento OCR «va por `POST /identify`» (devuelve
  `document_upload`); el front re-sube directo, que §17 acepta (el paso 0
  revisa el tope igual).

### `parameters.slug` es lo único que separa una automation de un conector

⚠️ La tabla `providers` mezcla las dos cosas. Colasistencia, Taxxa, Webpos
Panamá y Kunas PMS viven ahí **sin `slug` ni `job_class`** — el despachador las
saltaría en su último gate. Desde que el filtro por país dejó de excluir a los
providers sin país declarado, **tampoco quedan fuera por accidente**. En
desarrollo hay además filas de prueba (`tufirmaZ`, `Test`).

Listarlas dejaría al PM «configurando» algo que no se ejecuta nunca.

### Disparadores — seis válidos, tres que dan 422

⚠️ Van en `parameters.triggerTypes` (array) y su config en
`parameters.triggerConfig`. Desde agosto de 2026 **se validan**: un string fuera
de la lista responde 422 en `parameters.triggerTypes.{índice}`.

Válidos: `on_main_guest_checkin_completed` · `on_guest_checkin_completed` ·
`on_checkin_completed` · `at_time_of_day` · `on_physical_checkout` ·
`after_automation`.

❌ **Eliminados**: `on_physical_checkin`, `after_checkin`, `after_checkout`.
Tenían rama en el despachador pero **ningún emisor** — una automation
configurada con ellos no corría nunca, en silencio. Hoy dan 422. No volver a
agregarlos.

`triggeredBy` puede traer además valores que **no** son disparadores
configurables: `on_main_guest_form_submitted`, `manual_dispatch`,
`manual_redispatch`, `manual_resend`.

### Por qué una automation activa no corre

⚠️ Once gates, evaluados en orden, y **ninguno produce error visible**: la
automation se salta en silencio, sin registro de uso. Explica casi todos los
«está activa y no pasó nada». En orden: propiedad activa · listing activo ·
automation activa · trigger coincide · override del listing · `requires_checkin`
· país · `requires_guarantee` · `guest_filter` · ya ejecutada · job registrado.
Después el job aplica un **gate de saldo** (hoy inocuo: todos los costos están
en 0).

### Detalles por automation que cambian la UI

| Automation | Qué hay que saber |
|---|---|
| SIRE | `company_code` es un **override opcional a propósito**, no un olvido — el job lee la empresa del login. ⚠️ `guest_filter` **debe** ser `foreign_only` y **el backend no lo valida**: en `all` reporta también a los nacionales. Factura **una vez por reserva** aunque haya varias ejecuciones — ver varias con `billable: false` es normal. |
| PDF report | Activarlo sin destinatarios **no falla**: queda `completed` con `{"skipped": true, "reason": "no_recipients"}`. Revisar `responsePayload` antes de mostrar «enviado». Cada reenvío **factura de nuevo**. |
| TTLock | La validación revisa **cada** cerradura; los errores llegan indexados: `parameters.locks.0.lock_id`. |
| Stripe card | `requires_guarantee: true` — se salta aunque esté activa y se dispare manualmente, si el contrato no exige garantía (422). |
| Firma nativa | Solo soporta `agreement_only`. `billable: false` — la única gratuita. |

### Dónde vive esto en el código

- `lib/automation-catalog.ts` — cruza filas existentes con `default_setup.slots`.
- `data/automation-definitions.ts` — **solo presentación** (ícono, color, título,
  cómo se dibuja cada campo). El backend dice QUÉ hay; el front, cómo se ve.
  Una clave que el backend pida y el esquema no conozca se renderiza como texto,
  **nunca se descarta**.

### `POST /properties` → `automations[]` — CONTRATO REESCRITO (2026-08-12)

❌ Lo anterior ya no aplica: el array **era** obligatorio y descartaba su
contenido en silencio (se mandaba `didit` + inactiva y creaba `textract` +
activa). Eso se corrigió.

⚠️ *(del tracker del backend; no reverificado por curl)* **Este es el punto de
aprovisionamiento.** «Se crea sola» aplica al alta por **import** (Kunas PMS,
Calry), **no** a `POST /properties`: una propiedad creada por API recibe
**únicamente lo que venga en su array `automations`**, más los 2 slots
estructurales de identidad. Para dejarla con el set completo de un país hay que
**enviar TRA, SIRE ×2, TTLock y PDF explícitamente**.

⇒ El seed **debe construirse por país**, desde `GET /providers?country=` +
`default_setup.slots`. Mandar TRA a una propiedad de otro país ahora responde
**422** (antes se descartaba en silencio).

| Campo | Regla nueva | Antes |
|---|---|---|
| `automations` | **nullable** | `required\|min:1` + reglas ocultas |
| `providerSlug` | nullable, debe resolver | validaba por un campo y persistía por otro |
| `executionOrder` | **nullable** — el servidor renumera igual | requerido |
| `statusProviderId` | requerido, **`in: 8,10`** | `integer` a secas (un `999` explotaba como error de FK) |

**Siete casos que ahora dan 422** (antes: 201 con una fila degradada, sin
provider y en status 10, y solo un log del lado del backend): slug inexistente ·
provider que no aplica al país · `statusProviderId: 8` sin `providerSlug` ·
status fuera de `{8,10}` · dos entradas de identidad para el mismo `guestType` ·
`triggerType` desconocido · `after_automation` (siempre rechazado ahí: encadena
por id y ninguna automation existe todavía).

Las claves de error van en **camelCase con índice**:
`automations.{i}.providerSlug`, `automations.{i}.parameters.triggerTypes.{j}`.

**Orden final: lo impone el servidor.** 1 = identidad `main_guest`, 2 = identidad
`secondary_guest`, 3, 4, … = el resto preservando el orden relativo enviado.

**Dos señales distintas para «esto es identidad», según el momento:**

- **Al crear**: lo decide el **provider** — lo es si declara
  `parameters.verification_type` (hoy solo `didit` y `textract`). El
  `executionOrder` que mande el cliente es irrelevante.
- **Ya creadas**: `guest_type` + `execution_order <= 2`.

### ⚠️ `POST /property-automations` NO pina el orden — enviar `executionOrder` SIEMPRE

El pinning de identidad de arriba cubre solo `POST /properties`. En el store
directo `executionOrder` es `nullable · entero ≥ 1` y el tracker **no documenta
ningún pinning ni validación de rango** (⚠️ no verificable por curl: el token de
PM da 403 `admin:create` en ese endpoint). Una fila `main_guest` con orden en
rango de identidad (≤ 2 o null) **es identidad para el backend** por la señal
"ya creadas", venga de donde venga.

Bug real (2026-08-15, deploy Vercel): una fila de firma `main_guest` quedó
indesactivable con error de verificación y primera en el listado (✅ observado
por el PM). Eso implica orden ≤ 2 o null — es el único camino documentado a ese
bloqueo — ⚠️ pendiente de confirmar el valor exacto con
`GET /properties/{uuid}/automations`. Quién creó esa fila NO fue el frontend
desplegado (verificado contra `git show bd2d1be`: ningún camino de creación).
⚠️ Hipótesis plausible, no confirmada: al activarla con `providerId`, la regla
"asignar provider a un slot de identidad desactiva el otro slot activo del mismo
`guest_type`" apagó la fila Didit real.

Regla del frontend: **toda creación por este endpoint envía `executionOrder`
explícito ≥ 3**, tomado del `slot.order` del `default_setup` (firma = 10).
Precedente: `src/features/properties/lib/signature-automation.ts`
(`buildSignatureAutomationCreatePayload`). Reparación de una fila ya rota:
`PATCH /property-automations/{uuid}` (update genérico, edita orden) con
`executionOrder ≥ 3`, luego ya se puede desactivar. ⚠️ Pedido al backend
pendiente: pinear/validar orden también en el store.

✅ La respuesta incluye ahora **`providerSlug` en cada automation**, para
identificar el provider sin resolver ids ni depender del objeto sideloaded.

### ⚠️ Envío del link de check-in por email + WhatsApp — contrato del 2026-09-19 (implementado en front el 2026-09-22; NO reverificado por curl)

*(Documento de backend, commit `bea1323`, 2661 tests. Requiere `migrate` +
`db:seed --class=ProviderSeeder`. No envía ningún WhatsApp hasta que HIT cargue
credenciales de Meta; mientras tanto el envío se salta con
`responsePayload.reason: "whatsapp_not_configured"` y el email sale igual.)*

**Modelo**: provider global `parameters.slug: "whatsapp_checkin_link"`
(`automationType: "checkin_link_delivery"`, `billing: {billable: true,
unit_cost: 0, scope: "per_execution"}`) → `PropertyAutomation` con
`parameters.channels: ["email"|"whatsapp"]` (8 activa / 10 inactiva) →
`ListingAutomationOverride` opcional cuyo `channels` REEMPLAZA entero el de la
propiedad (`statusRecordId: 6` aplica; otro valor = apagada en ese listing).
Tabla de verdad: sin automatización, inactiva, override inactivo o `channels`
vacío ⇒ `["email"]`. **El backend nunca resuelve a lista vacía.**

**Endpoints**: `GET /providers?name[has]=WhatsApp` (identificar por slug, NUNCA
por nombre ni por id) · `GET /properties/{uuid}/automations` · **`POST
/property-automations` (paso 1, inactiva y `parameters: {}`) → `PATCH
/property-automations/{uuid}/configure {statusProviderId: 8, parameters:
{channels}}` (paso 2)** — el POST no valida `channels`, solo configure ·
`GET /listings/{uuid}/automation-overrides`, `POST|PUT|DELETE
/listing-automation-overrides[/{uuid}]` · `POST /reservations/{uuid}/send-checkin-link`
(sin cambio de contrato; ahora enruta por los dos canales y **cada reenvío por
WhatsApp cobra**). 422 de configure: `parameters.channels` (ninguno) o
`parameters.channels.{i}` (valor desconocido); solo valida al ACTIVAR.
Permiso: `automation.configure`, solo dueño de la propiedad; `property_staff` no.

**Estado del envío en `GET /reservations/{uuid}` → `extra`** (camelCase al leer):
`checkinLinkSentAt/To`, `mailDeliveryStatus` (`delivered|failed|complained`) +
`mailDeliveryReason`; `checkinLinkWhatsappSentAt/To` (E.164),
`checkinLinkWhatsappMessageId` (**wamid, no mostrar**), `whatsappDeliveryStatus`
(`sent|delivered|read|failed`, se PISA por reserva: histórico en
`automation-records` con `providerSlug: whatsapp_checkin_link`),
`whatsappDeliveryStatusAt/Reason`, `guestPhone`. Un `failed` se reembolsa solo.
Sin teléfono usable: no envía WhatsApp, no cobra, manda email igual y avisa a
soporte (`skipped.reason: no_whatsapp_phone`). **Teléfono se ESCRIBE
`extra.guest_phone` (snake) y se LEE `extra.guestPhone` (camel)** — el front ya
lo hace así en `ReservationDialog.tsx:466/393`.

**⚠️ Contradicciones con lo verificado en este skill — resolver por curl ANTES de construir:**

1. **`POST /property-automations` respondía 403 `admin:create` al PM** (§1,
   verificado). El doc asume que el PM crea la fila con ese endpoint. Si el
   commit no otorgó ese permiso, el paso 1 no funciona y no hay flujo. Es el
   mismo bloqueo abierto de §5.
2. El doc muestra el body del POST en **snake_case** (`property_uuid`,
   `provider_id`, `status_provider_id`); el repo manda **camelCase**
   (`PropertyAutomationCreatePayload`). Confirmar cuál acepta.
3. El body del doc **omite `executionOrder`**. Regla vigente de este skill: en
   ese endpoint SIEMPRE enviar `executionOrder ≥ 3` (orden null/≤2 = identidad
   para el backend). El doc muestra `executionOrder: 7` en la fila creada, sin
   decir quién lo asignó. ¿El provider trae `default_setup.slots[].order`?
4. Si el provider llega **sin `applicable_countries`**, `GET /providers?country=`
   no lo devuelve (misma trampa de didit/textract, §1) y el catálogo no puede
   ofrecerlo. Confirmar con `jq '.data[] | select(.parameters.slug=="whatsapp_checkin_link")'`.
5. El tablero de consumo (`billing/lib/pricing.ts` → `classifyRecord`) no tenía
   categoría para este slug: sus registros facturables quedaban FUERA de
   «Consumo por reserva» en silencio. ✅ Corregido 2026-09-22: columna
   «WhatsApp» (`checkinLink`), clasificada ANTES que identidad porque el nombre
   «Check-in Link Delivery» matchea la regex de verificación.

**⚠️ Addendum 2026-09-27 — tercer canal `ota_inbox` (implementado en front 2026-10-01, NO verificado por curl).**
Mismo `checkin_link_delivery`; `channels` admite `email | whatsapp | ota_inbox`.
Publica el link en el chat de la OTA vía el PMS de origen (Kunas o Calry).
Precio de OTRO provider: `ota_inbox_checkin_link` (`GET /providers?name[has]=OTA Inbox`),
`billing.unit_cost: 0.0625` — cobra desde el día uno. Ese provider **no es
automatización** (sin `automationType`): no debe aparecer como tarjeta.
422 en `parameters.channels` si la propiedad no está conectada a Kunas/Calry
(pista en UI: `pmsIdentifiers` no vacío; el 422 manda). **Los overrides de
listing ahora validan `channels`** con los mismos 422. Detalle de reserva:
`extra.checkinLinkOtaSentAt`, `checkinLinkOtaVia` (`kunas_pms|calry`),
`checkinLinkOtaMessageId` (NO mostrar); **sin estado de entrega** — solo
«Enviado». Solo aplica a reservas con `importSource` Kunas/Calry; en manual/iCal
cae a email en silencio. ⚠️ **Cambia el histórico de cobros**: un cobro de OTA
también llega con `providerSlug: "whatsapp_checkin_link"` — distinguir por
`responsePayload.channel` (`whatsapp | ota_inbox`), NO por slug. `skipped`
nuevos (ninguno cobra): `not_imported_from_pms`, `pms_integration_unavailable`,
`kunas_messaging_not_configured`, `calry_not_configured`, `no_ota_thread`,
`already_posted`. ⚠️ **Email de respaldo tardío**: si un canal cobrado falla
3 veces tras despacharse y email no estaba marcado, el backend lo manda igual —
`checkinLinkSentAt` puede aparecer con `channels` sin email («Email (respaldo)»).

**Cómo quedó el addendum en el front (2026-10-01):**
- Frontera: `normalizeUsageRecord` expone `channel: "whatsapp" | "ota_inbox" | null`
  como campo tipado (el allowlist genérico de `responsePayload` lo descartaba —
  sin esto todo caía en WhatsApp). `sanitizeProvider` y la fila conservan
  `automationType` en TRI-ESTADO: string · `null` explícito (no es
  automatización) · clave ausente (el backend no lo dice).
- Catálogo: `isAutomationProvider` = slug presente y `automationType !== null`.
  Sin la clave se CONSERVA (providers históricos sin verificar: filtrar por la
  ausencia escondería todo) — compatibilidad declarada, no cumplimiento.
  Además la partición saca por slug los providers de WhatsApp y OTA.
- Fila detectada por `automationType === "checkin_link_delivery"`, con el slug
  como respaldo. Providers resueltos con `automationService.findProviderBySlug`.
- Pista PMS: el formulario guarda `pmsIdentifiers` como `externalPmsIds`
  (`watch("externalPmsIds")`). Casilla OTA: oculta sin pista ni valor guardado;
  visible con pista; si está guardada sin pista, visible, marcada, con aviso y
  removible. 422 de `parameters.channels(.N)` anclado junto a las casillas
  (tarjeta y cada unidad).
- Overrides: «heredar» (borra) o «configurar distinto» con casillas; email fijo.
- Tablero: columnas «WhatsApp» y «Mensaje OTA» por `channel`; sin `channel` =
  WhatsApp; cualquier `skipped: true` suma cero aunque llegue completed+billable.
- Historial: canal por registro y mapa cerrado de 9 motivos `skipped`.
- Reserva: fila OTA «Enviado» + vía, sin estado; «Email (respaldo)» solo con
  configuración resuelta (es la actual, no la del envío); aviso de OTA no
  aplicable con `originKnown` + `importSource` fuera de Kunas/Calry; reenvío
  con `describeResendCharges` (canales aplicables, certeza por tarifa).
- Auditoría externa 2026-10-01 (5 ajustes): el diálogo de reenvío deja el
  email OPCIONAL (vacío = se omite del body y el backend usa el correo
  registrado — exigirlo bloqueaba reenviar solo por WhatsApp/OTA en reservas
  iCal sin correo); tarifas unitarias con `formatUsdRate` (hasta 4 decimales:
  0.0625 ya no se mostraba 0,06, un 4 % menos); en el historial `skipped: true`
  manda sobre `billable` (`chargeLabel` → «Sin cargo», misma regla del
  tablero); con origen DESCONOCIDO (`otaApplicable: null`) el reenvío anuncia
  la OTA condicionada («solo si la reserva lo permite; si sale, cuesta…»), sin
  afirmar envío ni cobro; y en el override por unidad volver a «configurar
  distinto» restaura los canales persistidos y la casilla OTA también es
  visible por lo GUARDADO (pasar el borrador por «heredar» la ocultaba y
  guardar borraba la OTA sin tocarla).
- Curls nuevos: `automationType` en providers históricos y en
  `ota_inbox_checkin_link`; `channel` en registros de WhatsApp; forma de los
  `skipped` (status/billable); reembolso de WhatsApp fallido (¿el registro pasa
  a failed?).

**Cómo quedó en el front (2026-09-22):**
- Tarjeta propia `CheckinLinkDeliveryCard` en la pestaña Automatizaciones (no
  una `AutomationCard` genérica: aquella exige disparadores y modal de
  credenciales). La fila se separa del catálogo genérico con
  `partitionCheckinLinkDelivery` (`lib/checkin-link-delivery.ts`), que también
  tiene la tabla de verdad `resolveEffectiveChannels` — la ÚNICA forma válida
  de responder «¿por dónde sale el link?» (el backend no expone los canales
  efectivos, gap #4).
- **Decisión de producto tomada en el front (pregunta 2 de §12): email SIEMPRE
  marcado, WhatsApp es el extra.** Elimina el estado «cero canales» y no
  promete «solo WhatsApp», que con Airbnb sin teléfono cae a email en silencio.
- Creación en dos pasos con `automationService.create` (camelCase, como el
  resto del repo, `executionOrder` ≥ 3 siempre) → `configure` con
  `{statusProviderId: 8, parameters: {channels}}`. Un 403 en el POST se avisa
  con copy propio: «tu cuenta no puede crear esta automatización todavía».
- Provider: primero en `GET /providers?country=`; si no está, segunda búsqueda
  `listProviders({ nameHas: "WhatsApp" })` (`name[has]`), identificado por slug.
- Override por unidad dentro de la misma tarjeta (`CheckinLinkDeliveryOverrides`):
  heredar (borra el override) · email+WhatsApp · solo email (override ACTIVO con
  `channels: ["email"]`; un override inactivo se lee igual que «solo email»).
- Detalle de reserva: `ReservationDetailData` ganó `propertyUuid`,
  `listingUuid` y `checkinLinkDelivery` (lector `lib/checkin-link-delivery-status.ts`,
  nunca lee el wamid); `useCheckinLinkChannels` resuelve los canales de ESA
  reserva y alimenta el aviso «sin teléfono» (con botón que abre el diálogo de
  edición existente; la ficha se recarga por el evento `reservationCreated`) y
  el aviso de costo en el diálogo de reenvío.
- Pendiente a propósito: contador «N de M reservas sin teléfono» (pregunta 1 de
  §12, pantalla nueva) y ocultar el control a `property_staff` (el rol por
  usuario todavía no llega en `GET /user`; el 403 se muestra con su mensaje).

### ⚠️ Identificadores externos de PMS (`external_identifiers`) — contrato reescrito por backend el 2026-08-23

*(del handoff de backend del 2026-08-24; ⚠️ no reverificado por curl — pero los
tests de backend están en verde y el cambio YA está en producción.)*

Aplica a `POST|PUT|PATCH /properties/{uuid}` y `/listings/{uuid}`:

1. **Cada fila de `pmsIdentifiers` trae `id` nuevo, y reenviarlo en el PATCH es
   OBLIGATORIO para editar esa fila.** Sin `id`, mismo `sourcePmsId` → **422
   `property_source_taken` / `listing_source_taken`** (el validador de unicidad
   solo excluye la fila cuyo `id` venga en el payload). Sin `id` con `sourcePmsId`
   distinto → 200, borra la fila vieja y crea una nueva (id nuevo). `id` obsoleto
   o de otro modelo → 422 en `externalIdentifiers.N.id`. ⇒ regla: **rehidratar el
   estado SIEMPRE desde la última respuesta del servidor** tras cada guardado.
2. **`externalPmsIds: []` ahora BORRA todas las filas** (antes era no-op). Clave
   omitida = no toca nada (vale igual para PUT). ⇒ el frontend solo puede enviar
   la clave cuando la sección se editó de verdad (dirty-gating), y `[]` tras
   borrar la última fila es el único uso legítimo (confirmación destructiva).
3. `sourcePmsId` inválido → 422 (`exists` contra catálogo categoría 12). No
   hardcodear ids: la categoría crece con cada PMS de Calry.
4. **Tres nombres para lo mismo** (deuda #1 declarada, sin resolver): se ENVÍA
   `externalPmsIds`, se RECIBE `pmsIdentifiers`, los ERRORES llegan como
   `externalIdentifiers.N.campo`. Mensajes ya localizados por `X-Locale` (en/es;
   pt cae a fallback) — mostrarlos tal cual. `duplicate_source` = dos filas con
   el mismo PMS en el propio payload (máx. una por PMS).
5. Filtros nuevos aditivos en `GET /properties`, `GET /listings` y
   `GET /properties/{uuid}/listings`: `externalId[eq|has|neq]`,
   `sourcePmsId[eq|neq]`; combinados exigen la MISMA fila (whereHas único);
   `neq` = "ninguno de mis identificadores" (whereDoesntHave). Tenant-scoping
   se aplica antes: filtrar por el id de otro cliente da lista vacía.
6. Chocar con el identificador de OTRO cliente guarda con 200 y solo levanta un
   `ClientRiskFlag` interno — **invisible en la API**, no mostrar nada.

**✅ Corregido en frontend el 2026-08-26** (pendiente de deploy): `ExternalPmsId`
ganó `id?`, `normalizeExternalPmsIds` lo conserva y `toExternalPmsIdsPayload` lo
reenvía (filas nuevas sin él); la clave `externalPmsIds` viaja SOLO con edición
real — PropertyForm por `formState.dirtyFields`, diálogo de unidades por
`sameExternalPmsIds(snapshot, actual)`; quitar la última fila muestra aviso
destructivo antes de guardar; tras cada guardado se rehidrata desde la
respuesta con `readExternalPmsIds` (que distingue `[]` afirmado de clave
ausente → `null`); y los 422 `externalIdentifiers.N.campo` se atribuyen a la
fila real vía `readExternalIdentifierServerErrors` en ambos formularios. Todo
lo derivable vive en `lib/external-pms-ids.ts` (19 tests). Ya estaba resuelto:
select desde `catalogService.getPmsSources()` (categoría 12) y dedupe cliente.

### ✅ Catálogo `status_reservation` (categoría 7) — hay DOS estados que el front no mapea

✅ **Verificado por curl el 2026-10-09** (app token, endpoint público):

```bash
curl -s "$API/catalogs?catalogCategoryId[eq]=7" -H "X-Locale: es" -H "Authorization: Bearer $APP_TOKEN"
# 27 Confirmada · 28 En Progreso · 29 Cancelada · 30 Finalizada · 108 Eliminada
# 109 Desconocido · 859 Abandonada · 860 Incompleta
```

❌ `RESERVATION_STATUS_BY_ID` (`reservations-service.ts`) solo conoce 27, 28, 29,
30, 108 y 109. **859 y 860 caen al respaldo `UNKNOWN`** y la lista los pinta con
el «?» de «Desconocido» — el reporte de Ricardo del 2026-10-09 («en varias vi
desconocido»). Antes de unificar el normalizador (commit `8443b8d`), el listado
ponía `CONFIRMED` por defecto a todo lo que no reconocía: estas reservas salían
como Confirmadas, que era peor (mentía). Ningún documento del backend describe
859/860 ni qué los dispara (¿un job que marca reservas sin check-in tras la
llegada?). ⚠️ Pendiente: confirmar con backend el significado y si `checkinAllowed`
los excluye (hoy solo 27 y 28 habilitan automatizaciones).

### ✅ Catálogo `property_type` — los ids NO son 100/101/102 = Casa/Hotel/Apartamento

✅ **Verificado por curl el 2026-10-06** (app token, endpoint público):

```bash
curl -s "$API/catalogs?status[eq]=ACT&catalogCategoryName[eq]=property_type" -H "Authorization: Bearer $APP_TOKEN"
# sin X-Locale: 102 Hotel · 103 Apartment · 104 Condominium · 105 Studio · 106 House
# con X-Locale: es (lo que manda CatalogService): Hotel · Apartamento · Condominio · Estudio · Casa
```
Sin `uuid` en las filas (claves: `id, name, name_translations, order,
parameters, status, catalogCategoryId`), así que el `String(item.uuid || item.id)`
de `fetchCatalog` usa el id y el cruce con `propertyTypeId` funciona.
❌ Corregido el 2026-10-06: acá se dijo que los nombres llegaban en inglés; eso
pasaba solo con el curl sin `X-Locale`. La app los recibe en español.

❌ El front asumía 100 = Casa, 101 = Hotel, 102 = Apartamento (switch en
`PropertyCard`, opciones de respaldo del formulario, `extra.type` derivado de
`=== 101`) y **completaba un tipo ausente con `102`**. Como 102 es Hotel, toda
propiedad sin tipo salía «HOTEL» — el reporte del 2026-10-06 sobre las
importadas de Kunas — y al editarla el PUT guardaba Hotel.

**Corregido 2026-10-06:** `lib/property-type.ts` (`readPropertyTypeId`:
`propertyType.id` → `propertyTypeId` → `property_type_id` →
`extra.propertyTypeId`, entero > 0, si no `null`; ignora el `extra.type` de
texto). Sin tipo: la tarjeta dice «Sin tipo», el formulario queda vacío y la
validación obliga a elegir (nunca se guarda un tipo inventado). La etiqueta sale
SOLO del catálogo; mientras carga no se muestra ninguna.

⚠️ **Sin verificar (falta token de PM): qué `propertyTypeId` trae una propiedad
importada de Kunas.** Si llega `null`, el arreglo del front resuelve el reporte
(dirá «Sin tipo»). Si el import la crea con 102, el front muestra la verdad del
dato y el arreglo es de backend (mapear el tipo de Kunas o dejarlo nulo):
`curl -s "$API/properties" "${H[@]}" | jq '.data[] | {name, propertyTypeId, propertyType, pmsIdentifiers}'`

Auditoría 2026-10-06: `fetchCatalog` nunca rechaza (un fallo devuelve `[]`),
así que `usePropertyTypeLabel` trata un catálogo vacío como fallo y NO lo guarda
(antes quedaba vacío toda la sesión). El selector del formulario muestra
«Cargando tipos…» mientras `isLoadingCatalogs`, y «No se pudo cargar…» solo con
la carga terminada y vacía. **El incidente de Kunas sigue abierto** hasta ver el
payload real con el curl de arriba.

### ❌ `extra.currency` de un Listing NO persiste — el backend la descarta en silencio

✅ **Verificado por curl el 2026-09-03** (cuenta de prueba, propiedad y listing
creados y borrados en la misma sesión):

```bash
POST /listings  {"extra":{"currency":"USD","startPrice":150,...}}  → 201
# extra devuelto: {bedRoom, bathRoom, maxOccupancy, startPrice, amenities} — SIN currency
PUT  /listings/{uuid}  {"currency":"USD","extra":{"currency":"USD"}}  → 200
GET  /listings/{uuid}  → extra sin currency, currency top-level ausente
```

Ni `extra.currency` ni un `currency` top-level sobreviven: el backend tiene una
whitelist de claves de `extra` (conserva `startPrice`, `maxOccupancy`,
`bedRoom`, `bathRoom`, agrega `amenities`) y descarta el resto **con 200/201**.
Mismo patrón que `internal_name` en el extra de Propiedades.

**Qué rompe**: el selector de Moneda del formulario de unidades es una ilusión
— el PM elige USD, la pantalla lo muestra "guardado" (la rehidratación cae al
estado local: `apiData.extra?.currency || unitForm.extra.currency`), pero el
servidor no tiene ninguna moneda. Por eso el prefill de moneda del diálogo de
Nueva Reserva (que SÍ está bien escrito y desplegado: `handleListingChange` lee
`extra.currency` del `GET /listings/{uuid}`) nunca encuentra nada y cae al
default COP. Reporte de Didier del 2026-09-03: "el anuncio fue creado en USD y
la reserva sale en COP".

**El fix es de backend** (persistir la moneda del listing); en el front no hay
nada que inventar — cuando la clave llegue, el prefill existente la usa solo.

### ⚠️ `extra.amenities` de Listings: se ESCRIBE con ids, se LEE con objetos

*(Reporte de backend del 2026-09-06, con el PUT real en el log de producción.)*

El backend espera **`amenities: [46, 47, 52]`** (array de IDs) al crear/editar
un listing, pero el GET los devuelve **enriquecidos**: `[{id: 46, name:
"WiFi"}, …]`. Round-trip asimétrico: re-enviar lo leído tal cual manda objetos
y dispara el warning del backend. Además el backend AGREGA `amenities: []` al
extra aunque nunca se haya mandado (observado en el curl del 2026-09-03 del
caso currency), así que `raw.extra?.amenities === undefined` NO sirve como
señal de "el PM nunca configuró amenities propias".

Regla: normalizar a ids en la frontera del payload, siempre.

### ❌ `internal_name` NO existe a nivel Propiedad — solo Listings

Confirmado por el dueño del backend (2026-08-18): *«El campo `internal_name` solo
lo manejamos para Listings… no aplica para Properties»*. El síntoma que lo
destapó: el `extra` de la propiedad **no persiste** el nombre interno — se
mandaba y se perdía en silencio.

El frontend tenía el campo «Nombre Interno (ID)» en el formulario de propiedad,
mapeado a `external_id` y escrito en `extra.internal_name` al guardar. Se quitó
entero (vista, esquema zod, payload y lectura de la respuesta).

**No confundir con los dos que sí existen** y que quedan intactos:

- `Listing.internal_name` — el nombre/número interno de la unidad. **Máx 15
  caracteres**, es el límite más estrecho y menos evidente del formulario.
- `Property.externalPmsIds[]` — los identificadores del PMS
  (`{sourcePmsId, externalId}`). Son otra cosa: hubo un bug por rellenar el
  nombre interno vacío con el id del PMS, que así se convertía en silencio en el
  nombre interno de la propiedad.

### ⚠️ Los slots NO traen la configuración de ejecución

✅ **Verificado el 2026-08-13**: `default_setup.slots[].parameters` trae
**únicamente claves de credenciales** — `{rnt, token}`, `{recipients}`,
`{username, password, client_id, client_secret, locks}`,
`{document_type, document_number, password, company_code}`. En **toda** la
respuesta de `/providers?country=CO` no aparece ni un `triggerTypes`, ni un
`triggerConfig`, ni un `guest_filter`:

```bash
curl -s "$API/providers?country=CO" "${H[@]}" \
  | jq '[.. | objects | select(has("triggerTypes") or has("guest_filter"))] | length'   # → 0
```

**Consecuencia**: sembrar copiando literalmente `slot.parameters` crea filas sin
disparador. El PM carga credenciales, activa, y el despachador la salta en el
**gate 4** — en silencio, sin registro de uso ni error. Es el peor modo de
fallo del sistema.

Antes de implementar el seed por país hay que confirmar con backend **si los
slots van a incluir los triggers operativos** (y el `guest_filter: foreign_only`
de SIRE). No inventar un mapa de triggers en el frontend.

### ⚠️ El `provider` sideloaded trae credenciales

Hallazgo del backend, **abierto y priorizado**: cuando una automation viene con
su provider cargado, se serializa el modelo `Provider` **completo**, incluidos
sus `parameters` — donde TuFirma y Stripe Card On File guardan tokens y llaves.
Ocurre en la respuesta de `POST /properties` y en **todo** el CRUD de
automations.

**Regla mientras tanto: no loguear ni cachear el objeto `provider` completo.**
Identificar por `providerSlug` / `providerId`. Ya se eliminó por esto el
`console.log` de la respuesta cruda en `propertiesService.getByUuid()`.

---

## 2. Contrato y firma

### Se llama «Contrato», NO «Firma Digital»

✅ **Regla de producto, respaldada por la spec del backend** (`docs/RICARDO_API_CONTRACTS.md`
§8.1.5): *«"Firma Digital" deja de ser un nodo independiente: la firma es
atributo del contrato»*. La automatización agrupa **el contrato completo** —qué
documento se envía, por qué canal y quién lo firma—, así que nombrarla por uno
solo de sus atributos hacía leer la tarjeta como si ahí se eligiera el firmante,
que es justamente el error que la regla de abajo prohíbe.

**Un solo lugar decide el nombre**: `title` en
`features/properties/data/automation-definitions.ts` (`id: "digital-contract"`).
De ahí lo leen **las dos** pantallas donde aparece — la tarjeta de
Automatizaciones de una propiedad y el panel de automatizaciones de una reserva,
vía `TITLE_BY_DEFINITION_ID` / `AUTOMATION_TITLE_OVERRIDES` en
`reservations/components/automations/automation-status-meta.ts`. Cambiarlo en un
solo sitio alcanza; escribir el texto a mano en una pantalla las hace divergir.

**Lo que NO se renombra, porque es otra cosa:**

| Sigue diciendo «firma» | Por qué |
|---|---|
| `SignaturePad.tsx` («Firma Digital») | Es el canvas donde el huésped **dibuja su firma**. No firma un contrato ahí: firma. |
| Textos de `ContractScreen` / `SuccessScreen` | Describen el **acto o el resultado** de firmar («la firma fue rechazada»), no la automatización. |
| `"TuFirma Digital"` | Es el **nombre del proveedor** que manda el backend (`provider.name`), no copy nuestro. |
| `automationName: "Firma Digital"` en fixtures | Es el dato **del backend**, que sigue mandando su propio nombre. Cambiarlo haría que el fixture mienta. |

⚠️ El `id` de la definición sigue siendo **`digital-contract`** y el
`automationName` del backend sigue siendo el suyo: son **llaves de cruce**, no
texto de producto. Renombrar el `id` rompería
`DEFINITION_ID_BY_AUTOMATION_NAME`, que es lo único que une el nombre que manda
`/automation-status` con la definición del front.

✅ El semáforo de la reserva clasifica con `CONTRACT_NAME_RE = /firma|contrato|signature/i`
(`reservations-service.ts`), así que **tolera los dos nombres** — el rename del
front no lo rompe, y tampoco lo rompería que el backend renombre su lado.

### Quién firma

✅ **Una sola fuente de verdad: `parameters.by_source[canal].provider_slug`**,
en la automatización cuyo provider tiene `parameters.signature`. Es lo que
valida `providerSupportsContractType()` y lo que el portal del huésped consume
como `contract.signingProvider`.

El `provider_id` de esa fila **no decide nada**. Nunca poner un selector de
proveedor en la tarjeta de automatización: escribiría otro campo, no cambiaría
quién firma, y al no conocer el `contract_type` ofrecería la firma nativa para
una garantía — que el backend rechaza con 422 (`hitguest_signature` solo puede
firmar `agreement_only`).

❌ «La firma digital no se puede desactivar (422)» — el backend confirmó que esa
regla **ya no aplica**. El contrato es opt-in.

⚠️ Identificar la fila de firma por `provider.parameters.signature`, **jamás** por
`executionOrder === 3`.

### ⚠️ `by_source` con un id que el catálogo no reconoce → fila visible pero ineditable

Caso real (2026-09-03): una automatización de Contrato llegó con
`parameters.by_source["1"]` (garantía y alquiler · TuFirma). ✅ **Verificado por
curl el 2026-09-03**: `GET /reservation-sources` NO contiene el id 1. Catálogo
completo observado: Directo=21 **(order 1)**, Airbnb=22, Booking.com=23,
Vrbo=24, Despegar=25, Expedia=26, Desconocido=107, KunasPMS=135, Calry=845,
Agoda=846, Google Calendar=847, Google Ads=848, Hostelworld=849, HotelBeds=850,
Trip.com=851, TripAdvisor=852. (El front excluye del picker 845 y 107; ⚠️ 135
KunasPMS y 847 Google Calendar también parecen integraciones técnicas más que
canales de contrato — decisión de producto pendiente.)

⚠️ Hipótesis con sustento pero sin confirmar: **"Canal 1" sería Directo guardado
por su `order` (1) en vez de su `id` (21)** — algún escritor confundió los dos
campos. Confirmable solo por backend (quién escribió esa fila).

Consecuencia en el front:

- La **tarjeta** de Automatizaciones muestra el routing crudo con fallback
  «Canal 1» (decisión deliberada: nunca ocultar una fila que el backend tiene).
- La pestaña **Documentos** hidrata filtrando por `allowedSourceIds`
  (`routingForMode`), así que esa clave **no aparece y no se puede editar**
  desde la UI. Las dos pantallas son coherentes con sus reglas, pero juntas
  producen «lo veo y no puedo tocarlo».

Editar SÍ tiene endpoint: `PATCH /property-automations/{uuid}/configure` con el
`parameters` completo — es el que usa la propia pantalla al guardar
(`ContractRoutingSection`, secuencia documents→configure). Guardar una config
válida debería pisar la clave huérfana… **si** configure con `parameters`
presente hace replace del objeto y no merge profundo. ⚠️ No verificado — es la
misma familia de dudas que el merge/replace con `parameters` OMITIDO (abierto
desde 2026-08-21). **El token de esa cuenta no está disponible**, así que la
verificación quedó instrumentada en el propio front (2026-09-03): la pestaña
Documentos recalcula el aviso de canal huérfano desde los `parameters` que
DEVUELVE `configure()` (y desde la relectura tras un fallo). El próximo guardado
real responde solo: **aviso desaparece = replace · aviso reaparece = merge** —
en ese caso el copy ya le dice al PM que la config sigue en el servidor.

Pendiente con backend: ¿qué es el id 1 en su catálogo, y quién escribió ese
routing? Ninguna versión de esta pantalla pudo — el picker solo ofrece ids del
catálogo.

### Firma nativa — request/response de `/main/sign` (primera firma real: 2026-08-14)

✅ *Verificado en código + PDF real generado en producción (reserva
`01a0020e-…`, firmada 21:09:32Z, PDF 21:34:08 — 25 min después).*

- **Request**: `POST /checkin/{uuid}/main/sign` con
  `{guestUuid, documentUuid, signatureImage}` + `X-Checkin-Verification-Token`.
  Nada más está documentado en el payload — el front no manda metadata del
  dispositivo.
- **Response**: `{message, attempt, signedAt}`. El front no consume ningún
  campo (correcto: no hay nada accionable; éxito = 2xx).
- **NO es idempotente**: re-llamar pisa la firma y suma un intento al historial.
  Por eso la firma vive FUERA de cualquier loop de reintento (guard
  `signatureSaved` en `ContractScreen`) y el reingreso se detecta con
  `hasNativeSignature`/`status: "signed"` antes de volver a mostrar el canvas.
- **El PDF tarda**: `status: "signed"` es inmediato; `signedContractUrl` llegó
  25 minutos después (lo genera la automatización de firma al correr). La
  descarga se habilita SOLO por `signedContractUrl` — ese gating ya está en
  producción.
- ⚠️ **Hallazgo para backend**: la constancia legal registra
  `User Agent del dispositivo: node`. El front llama a `guest.hit.tools`
  directo desde el navegador (sin proxy — verificado: `postWithAppToken` usa
  `fetch` client-side contra `API_URL_GUEST`), así que `/main/sign` llevó el UA
  real del iPhone. `node` es el UA default del fetch de Node.js ⇒ la evidencia
  se capturó en el salto interno que genera el PDF, no en la firma del huésped.
  Para valor probatorio (Ley 527) el UA/IP deben ser los del dispositivo al
  firmar; revisar también si la IP registrada es la del huésped.
  ❌ **Corregido 2026-10-08:** lo de «sin proxy» es FALSO hoy. `API_BASE` en el
  navegador es `/api/guest` (`src/lib/config.ts`): TODO el tráfico del portal y
  del dashboard pasa por `src/app/api/guest/[...path]/route.ts` en Vercel, que
  es quien pone el app token. El UA `node` y la IP de Vercel que ve el backend
  son de ese proxy, no del salto que genera el PDF. Ver §3, «Tope de 4 MB».

---

## 2b. Documentos de identidad en el detalle de reserva (panel del PM)

✅ **Verificado por curl el 2026-08-18** contra `GET /reservations/{uuid}/guests`
con token de PM.

Cada elemento de `data[]` trae la clave **`identityDocument`** (presente en 6/6
huéspedes revisados):

```json
"identityDocument": {
  "images": { "front": "https://…/reservations/{r}/identity-documents/{guestUuid}/front", "back": null },
  "source": "reservation|guest|mixed|none",
  "method": "didit|textract-ocr|otp|null",
  "capturedBy": "didit|textract-ocr|null",
  "capturedAt": "2026-07-02 14:31:08",
  "inheritedFromAnotherReservation": true
}
```

❌ **`reservationSpecificData.documentImages` NO existe en la respuesta real.**
Ese objeto trae solo `contactChallenge` y `nativeSignature`. Era la única clave
que el frontend leía, así que un huésped con documento aparecía como
«Documentos aún no disponibles», **en silencio**. Es el bug que motivó todo esto.

⚠️ **Contradicción entre documentos del backend, resuelta por observación**: el
tracker del 2026-08-12 (línea 978) llama a esas URLs «URLs firmadas», lo que
sugeriría que un `<img src>` directo funciona. El documento del 08-17 dice que
exigen Bearer y que la URL firmada «hoy no existe». **Gana el 08-17**:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "$URL_DEL_DOCUMENTO"                    # → 401
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" "$URL" "${H[@]}"        # → 200 image/jpeg
```

Comportamientos verificados:

- Sin token → **401**. Con Bearer → **200 image/jpeg** (~293 KB, 1620×1140).
- `back` cuando `images.back` es `null` → **404**. `side` inválido → **404**.
- CORS permite `authorization` desde otro origen
  (`access-control-allow-origin: *`), así que el fetch autenticado funciona en
  navegador sin pasar por el BFF.
- La ruta alternativa `GET /guests/{guestUuid}/identity-documents/{side}` (la que
  aparece en `guestProfile.extra.documentImages`) también responde 200.

**Tres reglas del contrato que rompen la UI si se asumen mal:**

1. **`inheritedFromAnotherReservation` es TRI-estado.** `null` ≠ `false`:
   significa que el backend no puede determinar de qué estancia salió la foto.
   Leerlo con `!!valor` afirma «es de esta reserva» sin base.
2. **`method` ≠ `capturedBy`.** `method` es cómo superó identidad *en esta
   reserva*; `capturedBy` es qué flujo tomó *la foto que se ve*. En el huésped
   recurrente llegan `otp` + `didit` — observado en producción.
3. **`capturedAt` viene como `"Y-m-d H:i:s"` SIN zona horaria.**
   `new Date("2026-08-14 12:00:00")` se interpreta como hora local, así que
   mostrarlo con hora da un valor desplazado y con pinta de correcto. Se muestra
   **solo la fecha**.

Combinaciones reales observadas (las cuatro deben renderizar): `otp|didit|
inherited:true|solo frente` · `didit|didit|inherited:true|frente+reverso` ·
`null|null|inherited:null|frente+reverso` · `didit|source:none|inherited:true|
SIN imágenes` (verificado por Didit, pero el proveedor conserva la evidencia).

Dónde vive en el código: `features/reservations/lib/identity-document.ts` (una
sola lectura del contrato; estaba duplicada y por eso ninguna de las dos copias
se actualizó) y `components/identity-document-meta.ts` (copy y tonos).

## 2c. Garantía con tarjeta (Stripe SetupIntent)

Solo aplica cuando `contract/preview.guarantee !== null`. La tarjeta se tokeniza,
**nunca se cobra acá**; el backend no ve datos de tarjeta.

### `POST /checkin/{reservationUuid}/main/guarantee/setup-intent`

Body `{guestUuid}` + header `X-Checkin-Verification-Token`.

⚠️ *Shape documentado en el tracker del backend del 2026-08-12 (grupo 4,
`CheckinController.php:504-548`) — **no reverificado por curl**:*

```json
{ "clientSecret": "…", "publishableKey": "…",
  "guaranteeAmount": "…|null", "currency": "USD",
  "message": "Guarantee card setup started." }
```

✅ **Verificado parcialmente en producción el 2026-08-19** (portal real,
`…t-frontend.vercel.app`): un 200 de este endpoint **sí trajo `guaranteeAmount`
y `currency`** — el portal renderizó «hasta USD 200», texto que solo se pinta con
ambos campos truthy. **El `message` se traduce por `X-Locale`**: con `es` llega
`"Se inició el registro de la tarjeta de garantía."`, no el inglés del tracker.

⚠️ **ABIERTO — `publishableKey` no está verificado.** El mismo 200 que trajo
`guaranteeAmount` y `currency` terminó en fallo del frontend al montar Stripe.
Ver la trampa de abajo. **Que el backend loguee `status: 200` NO prueba que el
payload esté completo**: el log de producción registra solo `{status, message}`,
no el body.

Validación, en orden (tracker): reserva existe · es el huésped principal · tiene
verificación de identidad válida · contrato resuelto · ese contrato requiere
garantía (si no, 422 `errors.checkin.guarantee_not_required`). Un fallo de la API
de Stripe da **500 genérico**.

⚠️ **No es idempotente**: cada llamada crea una fila de método de pago `pending`;
solo la más reciente cuenta. No reintentar en bucle.

### `GET /checkin/{reservationUuid}/main/guarantee/status?guest_uuid={uuid}`

```json
{ "guarantee": { "status": "not_started|pending|active|failed|detached",
                 "cardBrand": "…|null", "cardLast4": "…|null",
                 "failureReason": "…|null" } }
```

Solo `active` desbloquea `/main/complete` cuando el contrato exige garantía
(si no: 422 `"A guarantee card must be registered before completing check-in."`).
Falta `guest_uuid` → 422. `guest_uuid` va en **snake_case en la query**, mientras
los bodies POST van en camelCase.

### ⚠️ Trampa: un 200 con `publishableKey` ausente se ve igual que un fallo de red

`loadStripe(key)` con `key` que **no sea string** rechaza la promesa
(`@stripe/stripe-js@9` → `dist/index.js:166`,
*"Expected publishable key to be of type string"*), y con `""` lanza el
`IntegrationError` de Stripe.js. En ambos casos el error cae en el `catch`
genérico de `GuaranteeCardForm.mountCardForm`, que lo muestra como **«No pudimos
preparar el formulario de tarjeta. Intenta de nuevo.»** — el mismo texto que usa
la rama del contenedor no montado.

**Consecuencia**: con el backend respondiendo 200, el huésped queda trabado en
«Preparando formulario…» y nadie puede distinguir por pantalla si faltó
`publishableKey`, si falló el montaje del contenedor o si reventó
`elements.create()`. Distinguir exige la consola del navegador.

**No confundir con** `loadStripe` resolviendo `null` (Stripe.js bloqueado por
adblock/CSP): ese caso **sí** tiene su propio texto («No pudimos cargar el
formulario de pago seguro…»), así que su presencia lo descarta.

✅ **Mitigado en el frontend el 2026-08-19.** `readUsableSetupIntent()`
(`features/checkin/components/guarantee-setup-meta.ts`) valida `clientSecret` y
`publishableKey` en runtime **antes** de llamar a `loadStripe`, y cada causa de
fallo tiene ahora su propio mensaje y una referencia corta (`SETUP-PAYLOAD`,
`SETUP-KEY`, `SETUP-BLOCKED`, `SETUP-DOM`, `SETUP-ELEMENTS`, `SETUP-HTTP`) que el
huésped puede leer por WhatsApp. **Esto no arregla la causa raíz**: si el 200
llega incompleto, el huésped sigue sin poder registrar la tarjeta — solo deja de
ser un fallo mudo e inatribuible.

⚠️ El tipo `GuaranteeSetupIntent` sigue declarando `publishableKey: string` (no
nullable) **a propósito**: describe lo que el contrato promete. No se cambió a
nullable porque eso sería inventar el contrato en la dirección contraria, y el
punto está abierto con backend. Cuando respondan: si puede faltar, el tipo pasa a
nullable; si garantizan que siempre viene, la validación runtime queda como
detector de violaciones de contrato. Precedente de por qué importa:
`guaranteeAmount` tuvo que redeclararse `string | number | null` cuando se vio lo
que realmente llegaba.

## 2d-bis. De dónde sale el monto de la garantía (el "USD 200")

⚠️ *Auditado en código el 2026-09-03 (pedido de producto: que el monto sea el
capturado en el contrato de garantía, no 200).*

- El portal del huésped pinta `{currency} {amount}` con el **`guaranteeAmount`
  del setup-intent** (`GuaranteeCardForm.tsx:162,475`) — el "USD 200" NO está en
  el front; llega del backend (y puede llegar como string `"200"`).
- Por diseño del plan vigente (PLAN_CONTRATOS_POR_SOURCE §5): el texto del
  anexo de garantía es un **system document global** (`GET
  /system-documents/slug/damage_consumption_guarantee`) cuyos shortcodes
  (`guarantee_amount`, `guarantee_mechanism`, `guarantee_release_hours`,
  `damage_catalog_url`) viven en su `extra` y son `null` hasta que **HitGuest
  staff** los configure con una herramienta interna que este repo no construye.
  El PM solo PREVISUALIZA (GuaranteePreview, read-only, con aviso de variables
  sin resolver).
- `SourceRouting` = `{contract_type, provider_slug}` — **no existe ningún campo
  de monto capturable por el PM** en el front ni en el contrato conocido.

⇒ Hacer capturable el monto es un CAMBIO de contrato y de producto (¿por canal
en `by_source`? ¿por propiedad? ¿global?), no un fix de front. No inventar la
clave: el precedente de `extra.currency` y `internal_name` demuestra que este
backend descarta claves no contratadas con 200.

## 2e. El gate del `verificationToken` — tres causas bajo un mismo 401

✅ **Contrato** (tracker de check-in, líneas 715-726). `GET /form/{guestUuid}`
—y también `/main/sign`, `/main/guarantee/setup-intent`, `/main/complete` y
`/secondary/{guest}/complete`— responde **401** en tres condiciones distintas:

| Condición | Mensaje |
|---|---|
| Falta verificar el OTP | `"You must verify the code we sent to your email before continuing."` |
| **Falta el header** `X-Checkin-Verification-Token` | **el mismo literal que el anterior** |
| Token inválido o vencido | `"Your verification session has expired. Please verify the code again."` |

⚠️ El gate aplica **solo** a quien pasó por `contact_challenge`. Quien se
verificó con Didit o con la IA propia nunca lo activa.

**Nunca deducir la causa del `message`** — dos de las tres comparten literal, y
el texto de este backend ya cambió antes. El frontend la deduce de lo que sí
sabe: qué credencial tenía guardada al llamar (`getVerificationTokenState`).
`absent` = nunca verificó · `expired` = venció · `valid` = **el backend rechazó
un token que el cliente daba por bueno**, que no es un vencimiento y no se
arregla repitiendo el OTP.

✅ `POST /contact-challenges/{id}/verify` devuelve
`{ expiresAt: "ISO8601Z", verificationToken: "…" }`. **`expiresAt` viene con `Z`**
(a diferencia de `capturedAt` en §2b, que llega sin zona) — `Date.parse` lo lee
bien.

### ⚠️ Deltas del backend 2026-08-24 (contrato recibido 2026-08-26, no reverificado por curl)

1. **`/verify` es idempotente**: reenviar el código CORRECTO sobre un challenge
   ya verificado devuelve **200 con un `verificationToken` NUEVO** (antes 410)
   mientras la ventana de sesión siga viva; el token anterior sigue válido hasta
   caducar. `/resend` sobre un challenge verified también pasa de 410 a 200.
   Elimina el callejón sin salida del bucle del 19-08.
2. **Los dos 401 del gate traen `code`**: `CONTACT_CHALLENGE_REQUIRED` (nunca
   verificó o no llegó el header → a la pantalla OTP) y
   `CONTACT_CHALLENGE_TOKEN_INVALID` (token rechazado → reintentar verify con el
   mismo código; si falla, código nuevo). **Decidir por `code`, no por
   `message`** — esto reemplaza (con fallback) la deducción local por
   `getVerificationTokenState` que impuso la regla §2e original.
3. **`/identify` trae `verification.alreadyVerified`**: `true` = está RETOMANDO
   un challenge ya resuelto con sesión viva — mismo `challengeId`, **sin correo
   nuevo**, `expiresIn` calculado sobre la ventana de sesión (el código en sí ya
   venció pero reingresa). Copy: «reingresa el código que te enviamos», nunca
   «te enviamos un código nuevo». Reingresar el código emite token fresco.
4. **TTL deslizante del `verificationToken`**: cada request que pasa el gate
   renueva la expiración a 60 min desde ese momento. El `expiresAt` del verify
   es el MÍNIMO garantizado, no el definitivo. ⇒ un vencimiento local fijo
   (guardado al verificar) se vuelve pesimista: expulsar al huésped por ese
   reloj local es un falso positivo creciente cuanto más trabajó. Las
   respuestas de los endpoints gateados NO traen el nuevo `expiresAt` — el
   cliente que quiera espejarlo debe extender su copia local con la MISMA
   duración observada al guardar, no con 60 min quemados.
5. `contact_challenge_pending` / `currentStep: "contact_challenge"` en
   `/verify/result` y el portal — ya manejado en `verification-result.ts:59`.
6. Divergencia deliberada nuestra que se mantiene: el doc recomienda
   `sessionStorage`, pero el token vive en `localStorage` por el bug real del
   salto de navegador in-app (regla 4 de §2e). El backend no depende de dónde
   lo guarde el cliente.

### 🔴 Bug del 2026-08-19: un token ausente producía un bucle infinito

Si esa respuesta llega **sin** `verificationToken`,
`JSON.stringify({token: undefined, …})` **omite la clave**. El lector caía
entonces al camino "token legacy" y devolvía **el JSON entero como si fuera el
token**; ese texto viajaba en el header, el backend lo rechazaba con 401, el
huésped volvía al OTP y se guardaba la misma basura otra vez. Y como quedaba sin
`expiresAt`, se consideraba vigente **para siempre**. Síntoma: «Preparando
formulario…» + «Tu sesión de verificación expiró», sin avanzar nunca.

Reglas que quedaron implementadas en `lib/verification-token.ts`:

1. **Un token que no sea string no vacío NO se guarda** — se borra el anterior y
   se grita por consola. El tipo promete `string`, así que hay que validarlo en
   runtime (mismo criterio que `publishableKey` en §2c).
2. **Solo un valor que NO empieza por `{` puede ser un token legacy.** Un objeto
   JSON sin `token` string, o un JSON roto, es basura: se descarta y se limpia.
3. **Un guardado corrupto se reporta `absent`, nunca `valid`** — si no, los
   chequeos previos dan vía libre a una llamada condenada al 401.
4. **Vive en `localStorage`, no en `sessionStorage`** (corregido el mismo día):
   todo el estado que el token acompaña —sesión de identify, borrador del
   formulario, OCR, pendiente de Didit— ya vive en `localStorage`. Con dos vidas
   distintas, una pestaña descartada por iOS o el salto del navegador in-app a
   Safari conservaba el flujo pero perdía la credencial → 401 → OTP otra vez. La
   lectura migra el token del sitio viejo (se mueve, no se copia) y `clear`
   borra los dos. La caducidad real la sigue poniendo `expiresAt` (60 min del
   servidor).

### ✅ RESUELTO 2026-09-15: `/automation-status` reportaba `completed` en la fila de identidad con la verificación RECHAZADA

**Cerrado por el contrato 2026-09-15 (§2c-bis, punto c):** todo desenlace que no
verificó al huésped cierra ahora la fila en `{status: "failed", lastError:
"identity_not_verified", canRedispatch: false}`. La hipótesis era correcta:
`completed` significaba «el registro se cerró». Reservas cerradas ANTES del
deploy conservan su `completed` histórico (no es bug del front). La fila sigue
siendo POR AUTOMATIZACIÓN (último registro de cualquier huésped) — los botones
por huésped se deciden con el bloque `verification` del panel, no con esta fila.
Lo de abajo se conserva como historia del diagnóstico:

Caso real (reserva 3195533, Ricardo): la tarjeta «Verificación de Identidad
(Principal)» mostró **Completado** con la verificación rechazada y el check-in
sin completar. El front es un ESPEJO demostrable: `normalizeStatusItem` hace
`status: raw.status ?? "not_started"` (passthrough) y `getStatusMeta` solo
indexa `STATUS_META[item.status]` — el `completed` viene en el JSON de
`/automation-status`. Hipótesis (mismo patrón «completed ≠ aprobado» del
portal): el registro refleja que el JOB corrió bien (lanzó la sesión/procesó el
webhook), no el RESULTADO de la identidad. Preguntado a backend qué escribe la
fila de identidad tras un rechazo del proveedor. **No cruzar en el front el
estado del huésped para "corregir" la tarjeta** — sería la máquina de estados
paralela que este contrato prohíbe; la fuente por-huésped correcta ya se
muestra en «Documentos de huéspedes» (misma pantalla).

## 2c-bis. Override del PM sobre la verificación (contrato 2026-09-08, revisado 2026-09-15, shapes confirmados 2026-09-16)

✅ **Backend confirmó por escrito los tres puntos el 2026-09-16** (respuesta a
las preguntas de forma del front), y son los que el frontend ya implementó en
`1e6fbfc`:
1. El bloque `verification` por huésped **se agrega** a
   `GET /reservations/{uuid}/guests`, con **el mismo shape exacto del portal
   (las 10 claves)**. ⇒ la ficha del PM deja de depender del endpoint del
   huésped. *(Implementado: `getGuests` es panel-first.)*
2. Al revocar, **`identityWaiver` vuelve a `null`**: presencia del bloque =
   exoneración vigente, **sin ramas por `status`**. `revokedAt` **sale del
   contrato** — nunca se podía llenar porque la consulta filtra por activo.
   *(Implementado: `IdentityWaiver` no lo declara.)*
3. La fila de identidad en `completed` **se arregla**: todo cierre de Didit que
   no verificó (`fail`, `expired`, mismatch de documento, `in_review`,
   `abandoned`) pasa a `status: "failed"` con **`lastError` _o_
   `responsePayload.error` = `identity_not_verified`** (las dos formas).
   *(Implementado: la síntesis genérica de `normalizeStatusItem` ya cubre las
   dos; fijado por `automation-identity-status.test.ts`.)*

⚠️ **Dos avisos del backend que cambian cómo se lee esa fila:**
- **La fila de automatización es POR AUTOMATIZACIÓN, no por huésped**: muestra
  el último registro de *cualquiera* de los huéspedes de la reserva. Para
  decidir qué botón mostrar se usa el bloque `verification` **del huésped**,
  nunca esa fila. *(Así está: `resolveGuestVerificationActions` recibe
  `guest.verificationSignals`.)*
- **Las reservas cerradas ANTES del deploy conservan su `completed`
  histórico.** No es un bug del front ni afecta al QA: el bloque `verification`
  se calcula en vivo y dice la verdad también ahí.

⚠️ *Del documento de backend (commits e20ba92 + 583a965); no reverificado por curl.
Revisión 2026-09-15 (incorpora las 3 observaciones del front): (a) §4.3 el
endpoint del panel `GET /reservations/{uuid}/guests` trae ahora un bloque
`verification` POR HUÉSPED con el MISMO shape exacto del portal (status,
currentStep, isStale, canRetry, attemptsRemaining, failureReason…), calculado
por el mismo código — la ficha del PM se pinta desde ahí y DEJA de consultar el
portal; (b) §4.2 `identityWaiver.revokedAt` **eliminado y nunca pudo tener
valor** (la consulta solo devuelve exoneraciones activas; al revocar el bloque
vuelve a `null` — presencia = vigente, sin ramas por status); (c) §4.5 la fila
de identidad de `/automation-status` deja de cerrar en `completed` cuando la
verificación NO aprobó: ahora `{status: "failed", lastError:
"identity_not_verified", canRedispatch: false}` — cierra el ABIERTO 2026-09-08
de §2e (reserva 3195533); reservas cerradas antes del deploy conservan su
`completed` histórico. Requiere en el servidor: `php artisan migrate` +
`db:seed --class=RolePermissionSeeder`.*

**Tres endpoints** (token del PM):
- `POST /reservations/{r}/guests/{g}/verification/reset` — sin cuerpo. 200 →
  `{retiredAttempts, attemptsRemaining: 3}`. Lo ven PM y staff. 422 si el
  huésped ya completó.
- `POST .../verification/waiver` — `{reason}` OBLIGATORIO (10–1000 chars, no
  solo espacios). 201 con `waiver{uuid,status,reason,grantedAt}`. **Solo el
  DUEÑO de la cuenta** (403 para el resto). 422 codes: `guest_already_completed`,
  `waiver_guest_already_verified`, `waiver_already_active`,
  `guest_not_in_reservation` (404).
- `DELETE .../verification/waiver` — `{reason}` opcional. 403 no-dueño, 404 sin
  waiver activo, 422 si ya completó (**ocultar la acción, no solo manejar el
  422**: revocar tras completar reescribiría TRA/SIRE y contratos firmados).

**No hay endpoint "¿soy el dueño?"**: usar `user.isAccountOwner` del GET /user
(ya está en el auth-store del front).

**Portal — `status: "waived"` nuevo** (los 3 endpoints de verification): llega
con `currentStep: "form"`, `canRetry: false`, `attemptsRemaining: 0`. Decisión
de producto: **al huésped no se le dice NADA** — avanza como uno verificado, sin
cartel (fijado por test del backend que el `reason` nunca viaja al portal).
`waived` gana a `rejected`; si se revoca, vuelve a `rejected`. ⚠️ QA 3: en
ningún lugar la UI puede decir "verificado" para un exonerado — ni el portal ni
el panel (el backend nunca lo dirá).

**Panel — `identityWaiver` SIEMPRE presente** en ReservationGuestResource
(`GET /reservations/{uuid}/guests`), `null` sin exoneración:
`{uuid, status, reason, grantedAt, grantedBy}` (❌ `revokedAt` anunciado en la
v1 del doc: eliminado 2026-09-15, nunca pudo tener valor). **`reason` llega
`null` para quien no es el dueño** — staff ve QUE hay exoneración, no el texto.
Es el caso normal, no un error. El `reason` tampoco aparece nunca en el bloque
`verification` (test del backend lo fija).

**Panel — `identityDocument.imageFailures`** `{front, back}`: distingue
"documento sin reverso" (`images.back: null` + `imageFailures.back: null`) de
"reverso PERDIDO" (`imageFailures.back: {flow, reason, at}`) → aviso de
expediente incompleto, que hoy era un hueco silencioso.

**Árbol de acciones por huésped**: isCompleted → nada · waiver activo → chip
"Verificación exonerada" + grantedBy/At + reason (solo dueño) + Revocar (solo
dueño) · pending+isStale → Reiniciar (webhook perdido) · rejected+canRetry:false
→ Reiniciar + Exonerar (dueño) — EL caso que justifica todo · rejected+canRetry
→ Reiniciar opcional. La exoneración vive EN LA RESERVA, no en el huésped: no
cachear por guestUuid. El exonerado sigue obligado a formulario, contrato,
garantía y OTP. Al exonerar el backend manda correo al dueño (no lo dispara el
front). pt sin traducciones de interfaz (en/es; correos sí tienen pt).

## 2d. Verificado ≠ check-in completado (columna CHECK-IN de la lista)

✅ **Son dos ejes distintos del contrato, y confundirlos ya costó un bug**
(2026-08-19: un huésped recién verificado por OTP se mostraba «0 de 1
verificado»).

| Dato | Dónde vive | Qué mide |
|---|---|---|
| `progress.completed` | portal `GET /checkin/{uuid}` | huéspedes con `isCompleted` — **check-in terminado** |
| `registeredGuests[].verification` | portal, objeto aparte por huésped | **identidad superada** |
| `completedGuests` (o `progress.completed`) | `GET /reservations` | completados — ⚠️ ninguna de las claves candidatas está confirmada contra un payload real |

El tracker del backend lo advierte textual: *«es esperable ver `isCompleted:true`
junto a `verification.status` distinto de `completed`»*.

**Por qué el OTP no completa el check-in**: verificar el código solo entrega el
`verificationToken`; después siguen el formulario y `/main/complete`. Un huésped
verificado con `completed: 0` es un estado **normal**, no un error.

⚠️ **`GET /reservations` NO expone un conteo de verificados.**
`/automation-status` tampoco: trae el `status` de las 2 filas de identidad y los
flags `reservationCheckinCompleted` / `mainGuestCheckinCompleted`, pero nada por
huésped. **El portal es la única fuente**, y es público con el app token — por eso
`getGuestVerificationCount()` lo consulta por reserva en la lista.

**Reglas que se derivan** (implementadas en `automation-cell-meta.ts` y
`reservations-service.ts`):

1. **El sustantivo tiene que decir de qué eje habla**: «X de Y completados» o
   «X de Y verificados», nunca uno con el número del otro.
2. **`null` ≠ `0`**: un conteo no reportado devuelve `null`/`undefined` y la
   celda cae a su etiqueta binaria en vez de afirmar que no ha llegado nadie.
3. **El denominador de verificación son los REGISTRADOS, no `totalGuests`** (que
   es el cupo): «1 de 1 verificado» con 1 registrado de 3 permitidos es la
   verdad; «1 de 3» insinuaría que faltan dos que ni se registraron. *(Vigente
   solo donde se muestre verificación — hoy el detalle de la reserva.)*
4. **Un check-in forzado (`status_reservation_id = 30`) NO cuenta como
   verificado.** El backend fuerza `isCompleted: true` sin tocar `verification`,
   así que el `status` explícito manda sobre el flag. Solo cuando el backend no
   manda un status reconocible, el completado alcanza para darlo por verificado.

**Decisión de producto (Didier, 2026-08-21): la columna CHECK-IN de la lista
habla SOLO de check-ins completos.** La variante del 2026-08-19 que mostraba
«N de M verificados» mientras nadie completaba se retiró: la columna se llama
CHECK-IN y el tablero de operaciones cuenta check-ins terminados, así que un
huésped verificado sin completar cuenta como cero («0 de 1 completado»). Con
eso se eliminó también `getGuestVerificationCount()` y la consulta al portal
por cada fila de la lista — el conteo de completados ya viene en
`GET /reservations`. Los dos ejes del contrato SIGUEN siendo distintos (todo lo
de arriba vale); lo que cambió es qué eje muestra la lista. La verificación por
huésped se consulta en el detalle de la reserva (§2b).

## 2g. Edición de reservas del PM — contrato reescrito por backend el 2026-08-24

*(del handoff del 2026-08-24, suite backend 1519/0; ⚠️ no reverificado por curl)*

`GET|PUT|PATCH /reservations/{uuid}`, `GET|POST /reservations`:

1. **Origen a nivel reserva (🆕, responde nuestro BACKEND_NEEDS_RESERVATION_ORIGIN):**
   `isImported: bool` (la creó una integración), `importSource: "calry"|"kunas_pms"|null`,
   `syncedAt: ISO|null`. Los dos primeros son retroactivos; **`syncedAt` es
   forward-only**: `null` = «no sabemos», NUNCA pintarlo como «sin sincronizar»
   si `isImported` es true. `source` sigue siendo el canal comercial, no el
   origen técnico.
2. **PUT no rechaza reservas sincronizadas** (confirmado: nada mira el origen).
   El 422 fantasma de `externalId` contra una cancelada gemela quedó corregido
   en backend. `externalId`: si se manda debe traer valor — **omitirlo está
   bien** (clave para editar sin regenerar códigos).
3. **Round-trip GET→PUT ya es fiel**: el request acepta las formas anidadas
   (`statusReservation:{id}`, `listing:{uuid}`, `mainGuest:{uuid}`,
   `source:{id}`) además de las planas; la plana GANA si van las dos.
   `mainGuest: null` reenviado NO borra el huésped; `guestUuid: null` explícito
   SÍ. `extra` se mergea, y cinco claves se descartan si se mandan
   (`calryRecord`, `kunasPmsRecord`, `syncedAt`, `manualEdits`,
   `overwrittenEdits` — propiedad del backend).
4. **Qué pisa el PMS**: solo el webhook `reservation.updated`, y solo 6 campos
   (`arrivalDate`, `departureDate`, `totalGuests`, `totalPrice`, `currency`, y
   `source` si el payload trae canal). `emailGuest`/`mainGuest`/status/
   `externalId`/`listing` y el resto de `extra` NUNCA. Los imports por polling
   no pisan nada y no hay cron. Decisión de producto: el PMS gana, no se
   bloquea la edición — pero queda rastro: `extra.manualEdits`
   ({campoCamel: ISO}) y `extra.overwrittenEdits[]`
   ({field SNAKE_CASE, previous/incoming strings para mostrar,
   manuallyEditedAt, overwrittenAt, source}; máx 20; solo conflictos reales).
   ⚠️ Colateral: si el PMS BAJA `totalGuests`, la reserva puede pasar a
   completada de golpe y disparar automatizaciones facturables.
5. **Errores del PUT**: 422 camelCase con envelope estándar; **hay DOS shapes
   de 404** (el de binding trae clave `error` extra; una reserva CANCELADA
   devuelve ese 404, no un 200 con `deletedAt`); 403 nuevo al mover la reserva
   a un listing de otro cliente; 422 nuevo en `arrivalDate`/`departureDate` si
   una sola fecha queda incoherente contra el valor GUARDADO; 422 nuevo en
   `listingId` al mover a un listing sin automatizaciones de identidad activas
   (main y secondary). Mensajes localizados (en/es; pt cae a fallback) — se
   muestran tal cual.
6. `totalPrice` llega como **string** (`"1250.00"`); `deletedAt` no aparece en
   una reserva viva (es `when`, no null); `mainGuest` presente pero `null` sin
   huésped; `restore` omite los contadores.

**✅ Corregido e implementado en frontend el 2026-08-27** (pendiente de
deploy): el diálogo de edición ya NO regenera `externalId` ni fuerza
`statusReservationId: 27` (ambos se mandan solo al crear); los 422 de campo se
anclan al control real del formulario con el mensaje del backend tal cual
(`lib/reservation-edit-errors.ts`); el origen se lee con
`lib/reservation-origin.ts` (tri-estado `originKnown` — «creada manualmente»
solo con `false` explícito; `syncedAt` null simplemente no se muestra) y se
pinta en el detalle («Importada desde Calry · última sincronización») + aviso
ámbar no bloqueante al editar una importada; `extra.overwrittenEdits` se lee
tolerante por fila (campo desconocido muestra su clave, fila malformada se
descarta sin tirar la lista) y el detalle muestra «El PMS revirtió N cambios».
La lista conserva `origin` en el tipo aunque aún no lo pinte.

## 2e-bis. Reserva manual: el link de check-in NO sale solo — lo pide el front

⚠️ *`docs/API_DOCUMENTATION.md` («Envío automático: al importar una reserva de
la propiedad»); no reverificado por curl. Reporte de Ricardo 2026-10-08: «este
link le debió llegar al correo del guest».*

- **Según la documentación** (⚠️ no verificado contra producción), el backend
  envía el link por sí solo **solo al importar** (PMS, iCal), y `POST
  /reservations` no tiene flag de envío. Es una HIPÓTESIS documental hasta que
  pase la prueba de doble envío de abajo. El repo lo documentaba desde mayo («`sendLinkNow` existe en UI
  pero no se envía») y el diálogo igual anunciaba «Se enviará el link».
- **Implementado 2026-10-08 — ⚠️ PENDIENTE de prueba integrada:** con la
  casilla marcada, el front llama `POST /reservations/{uuid}/send-checkin-link`
  (§3.6 del contrato WhatsApp, sin body: el backend usa el correo del huésped y
  enruta por los canales configurados) con el uuid de la respuesta del POST.
  ⚠️ Trampa que ya costó una versión rota: `apiClient` DESENVUELVE `data`, así
  que el `{data: {reservation: {uuid}}}` documentado llega al código como
  `{reservation: {uuid}}` — probar siempre contra la forma que entrega el
  cliente, no contra el JSON crudo. Si el envío falla, la reserva queda creada y
  el aviso dice POR QUÉ no salió (mensaje del backend) en vez de prometer nada.
- ⚠️ **Antes de desplegar: descartar el doble envío.** Que el doc solo hable de
  envío automático «al importar» no demuestra que `POST /reservations` no
  dispare otro proceso, y un segundo WhatsApp es un segundo cobro. Prueba con
  token de PM: crear una manual con la casilla APAGADA, esperar 2 min y leer
  `GET /reservations/{uuid}` → `extra.checkinLinkSentAt` debe seguir `null` y
  `GET /reservations/{uuid}/automation-records` sin registro del link; luego
  crear una con la casilla ENCENDIDA → exactamente UN registro del link.
- La ficha de la reserva se relee tras un reenvío exitoso: antes seguía
  diciendo «Todavía no se ha enviado» (lo que se reportó como «caché del front»).
- ⚠️ Pendiente: confirmar por curl que el 201 trae `data.reservation.uuid`; si
  no lo trae, el aviso manda a reenviar desde la ficha (no inventa nada).

## 2f. Integración Airbnb iCal (contrato del 2026-09-04, backend implementado)

⚠️ *Del documento de backend; no reverificado por curl. Lo esencial:*

- **Conectar**: `POST /integrations` de siempre con el provider "Airbnb iCal"
  (resolver su id por `GET /providers` — NUNCA hardcodear; el doc usa 5320 como
  ejemplo). `parameters: {}` obligatorio aunque vacío. `statusProviderId: 10`
  = interruptor maestro que silencia todos los feeds sin borrar config.
- **Feeds**: CRUD en `/ical/feeds` (+ `POST {uuid}/sync` → **202** encolado, y
  `GET {uuid}/message-template`). Shape: `{uuid, listingUuid, sourcePmsId:100,
  icalUrl, statusRecordId (6/7), lastSyncedAt, lastSyncError}`. El POST registra
  el `externalListingId` como identificador externo del listing y dispara sync
  inmediato. PATCH solo acepta `icalUrl`/`statusRecordId` (el resto inmutable a
  propósito). DELETE = soft, NO borra reservas importadas. 422s: icalUrl
  (https / host / duplicado), externalListingId (no coincide con la URL — la
  defensa contra importar reservas ajenas), o message solo (integración no
  conectada). `lastSyncError` distingue "sin reservas" de "feed roto".
- **Plantilla de mensaje**: `message` va en el communications_locale de la
  property (NO sigue X-Locale — lo lee el huésped); `instructions` sí siguen
  X-Locale. No armar la URL del check-in en el front. `[código de confirmación]`
  se reemplaza con el menú Shortcodes de Airbnb. ❌ «programar ≥1h después de
  reservar» era una recomendación del doc que el front convirtió en aviso
  prohibitivo; **corregido 2026-09-22**: «inmediatamente después» funciona,
  porque el link no depende del sync y el portal responde `pending_sync` +
  Reintentar mientras tanto. ⚠️ El front YA NO pinta `instructions` del backend
  (decía «Menú > Mensajes > Mensajes programados», ruta que no existe en el
  Airbnb actual): los pasos son copy propio en `AirbnbIcalPanel.tsx`
  (Mensajes → engranaje → Administra tus respuestas rápidas → Crear → Hora
  personalizada · Reservación confirmada). Pedido a backend: corregir o retirar
  `instructions`.
- **Portal**: `portalStatus: "pending_sync"` (HTTP 200) en la ruta externa
  cuando la reserva aún no sincronizó — se resuelve solo en <30 min, merece
  botón Reintentar. La ruta externa ahora tiene rate limit 60/min → manejar 429.
- **`requiresGuestCountDeclaration: true`** en `reservation` del portal: el
  identify del huésped PRINCIPAL debe incluir `totalGuests` (mismo request, no
  hay endpoint aparte a propósito). Errores en `errors.totalGuests` (faltante /
  min:1 / "hasta :max"). De un solo uso: tras declarar pasa a false. Reservas de
  Calry/Kunas/manuales nunca traen el flag.
- **`checkinLinkWhatsappTo` vs `…SentTo` (2026-09-30)**: el doc escribe
  `checkinLinkWhatsappTo` pero el de email es `checkinLinkSentTo`; sin curl, el
  lector acepta las dos formas (y snake_case). Confirmar cuál llega.
- **Aviso de edición (2026-09-30, pedido de Ricardo 09-26)**: una reserva iCal
  NO es de PMS. El aviso ámbar del diálogo de edición se decide por
  `importSource` (`describeImportedReservationNotice`): en `ical` dice que solo
  las fechas vienen del calendario y que huéspedes, valor y moneda se registran
  en HIT; en Calry/Kunas conserva el aviso de los 6 campos del webhook (§2g.4).
- **Reserva importada**: `importSource: "ical"` (tercer valor), `emailGuest:
  null` es lo normal, `totalGuests: 0` = sin declarar, `extra.
  capacityDeclarationRequired` (informativo) y `extra.priceUnconfirmed`
  (accionable: TRA no corre — registro failed con `responsePayload.error:
  "price_unconfirmed"`, misma forma que insufficient_balance). Se limpia SOLO
  enviando `totalPrice` por PUT (incluso `0` explícito vale); mandarla en
  `extra` se descarta. El PM corrige capacidad con el PUT de siempre.

## 3. Portal de check-in

Rutas públicas (protegidas solo por lo impredecible del UUID), autenticadas con
el **app token**. Trampas que ya costaron bugs:

- **`portalStatus` llega con HTTP 200.** Una reserva cancelada o eliminada
  responde `200 {"portalStatus":"cancelled"}` **sin** `reservation`,
  `progress` ni `registeredGuests`. Decidir por el status HTTP rompe la pantalla.
- **`forceCompleted`**: con `status_reservation_id === 30` el backend pisa
  `isCompleted: true` en todos los huéspedes sin tocar `verification`. Los dos
  campos pueden contradecirse legítimamente.
- **`/identify` devuelve cuatro formas de `verification`**, no dos:
  `session`, `document_upload`, `contact_challenge` y `verified_ok`.
- **`isMainGuest` puede volver `false`** aunque se haya pedido `true`, en
  silencio, si ya existe un titular. Usar siempre el valor de la RESPUESTA.
- **El proveedor de verificación se configura por `guest_type`.** No existe la
  regla «principal = Didit, secundario = Textract»; cualquier combinación es
  posible.
- **`/main/complete` tiene dos formas de éxito**: con proveedor asíncrono
  responde `{status: "pending_signature"}` y el titular queda INCOMPLETO hasta
  el webhook; con síncrono responde sin campo `status`.
- **`uploadSecondaryDocuments` usa otro shape de error**
  (`{success, errorType, message, failedFields}`), distinto al `{message}` del
  resto del portal.
- **La descarga del contrato se habilita SOLO por `signedContractUrl`.**
  `status: "signed"` se pone antes de que el PDF exista.
- **`/verify/result` es la ÚNICA fuente de `verificationUrl`.** El portal no lo
  expone. Sin esa llamada no hay forma de lanzar la sesión KYC — no quitarla del
  ciclo de sondeo. El backend lo diseñó explícitamente para polling continuo (no
  tiene gate de `checkinAllowed`).

Toda la máquina de estados de `verification` se resuelve con
`lib/verification-result.ts` (`normalizeVerificationResult`). **Es el único
criterio válido de "verificado"** — hubo cuatro criterios distintos conviviendo y
provocaba esperas de 3 minutos sobre huéspedes ya completos.

### ✅ Todo lo que sale del navegador pasa por el proxy `/api/guest` — y Vercel lo corta en 4 MB

✅ **Medido contra producción el 2026-10-08** (`app.hitguest.com`), reporte de
Ricardo: la subida de documentos (§17) fallaba con «Error en la solicitud» y el
backend **no registraba ninguna llamada**.

```bash
# cuerpo multipart de N MB contra el proxy (sin token: el proxy pone el app token)
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  "https://app.hitguest.com/api/guest/checkin/<r>/secondary/<g>/documents" \
  -F "front_image=@probe.bin;type=image/jpeg;filename=front.jpg"
# 0,2 · 1 · 2 · 3 · 3,5 · 4,0 MB → 422 del backend (llegó)
# 4,3 · 4,6 · 6 MB            → 413 {"error":{"code":"413","message":"Request Entity Too Large"}}
```

- El 413 lo emite el **borde de Vercel** antes de ejecutar la función: ni el
  proxy ni el backend lo ven, y su cuerpo trae el mensaje en `error.message`,
  no en `message` — por eso `buildHttpError` caía al genérico.
- La documentación de Vercel dice 4,5 MB; el tope efectivo es **4 MB** por
  petición (`PROXY_REQUEST_BODY_LIMIT_BYTES`, `src/lib/image-upload.ts`).
- Aplica a TODA subida del navegador: §17 (tres fotos), las fotos en base64 que
  el formulario del huésped mete en el JSON de `/complete` (base64 pesa 33 %
  más), la galería de propiedades (`POST /properties/{uuid}/images`, hasta 10
  archivos en UNA petición) y el logo (ya limitado a 2 MB).
- **Cómo quedó en el front (2026-10-08):** `prepareImageForUpload` recomprime
  en el navegador (JPEG, lado mayor 1800 px, objetivo ≤ 1 MB; orientación EXIF
  la aplica el propio navegador al decodificar) y, si no puede, manda el
  original; el total se compara contra el tope ANTES de enviar; un 413 muestra
  «Las fotos pesan demasiado…» y conserva las fotos; la galería se recomprime
  (2000 px) y se envía en lotes que quepan. El límite de 10 MB por foto que
  tenía `VerifyScreen` era ficción: nunca pasaba de 4 MB en total.
- ⚠️ Sin verificar: que Textract/Rekognition acepten igual una foto de 1800 px
  (debería: AnalyzeID trabaja bien desde ~1000 px). Si sube el rechazo por
  `LOW_QUALITY_IMAGE` tras el deploy, subir `UPLOAD_IMAGE_MAX_DIMENSION`.

### Payload del portal observado en reserva completada (✅ 2026-08-21)

`GET /checkin/01a015e0-…` (reserva MANUAL-QK3ZSY, completada el día anterior):

- Claves raíz: `contract, documents, progress, registeredGuests, reservation`.
- `reservation` = `{arrivalDate, checkinAllowed, departureDate,
  totalGuestsAllowed, uuid}` — **NO trae `reference`**.
- `documents[]` = `{uuid, type: "Contrato", name: null}` — `name` puede ser
  null; el código que muestre documentos no puede asumirlo string.
- `contract.signedContractUrl` es una **ruta relativa**
  (`/api/v1/checkin/{uuid}/contract/signed`), no una URL absoluta de storage.
- El backend ve las llamadas del portal **desde la IP del serverless de Vercel**
  (proxy BFF del frontend): `cf-connecting-ip` AWS + `cf-ipcountry: US` en sus
  logs NO son el huésped (concuerda con el hallazgo del UA `node` en §2).

⚠️ **ABIERTO — portal durante la transacción de completar.** Incidente
2026-08-20 16:44:36Z: `/main/complete` respondió 200 y el huésped vio el error
boundary del segmento checkin en el mismo minuto (render de `/success` reventó).
Un día después el mismo portal renderiza perfecto. No está verificado qué
devuelve `GET /checkin/{uuid}` en los segundos en que la firma/complete y sus
automatizaciones síncronas todavía están escribiendo (¿payload parcial sin
`progress`/`registeredGuests`? ¿`signedAt`/`type` con shape transitorio?).
Pregunta concreta para backend; mientras tanto el frontend no puede asumir que
un 200 del portal trae siempre el shape completo.

**Mitigado en frontend (2026-08-21):** `lib/portal-payload.ts`
(`classifyPortalPayload` + `assertRenderablePortal`) valida en el borde de los
DOS servicios (`checkinService.getPortal` y `checkinServerService.getPortal*`)
el piso que revienta el render — `reservation.uuid` string, `progress` objeto,
`registeredGuests` array — y trata un 200 malformado como fallo de red (lanza),
reusando los catch/fallback que cada llamador ya tenía. `portalStatus` sigue
pasando intacto. Los crashes del segmento ahora dejan rastro: `error.tsx` emite
un beacon a `POST /api/client-error` (log server-side con ruta y user-agent) y
muestra el `digest` como referencia en pantalla.

---

## 4. Reglas que se derivan de todo lo anterior

1. **Resolver providers por slug, nunca por id.** Tres documentos del backend
   dieron tres juegos de ids distintos. Los ids hardcodeados solo como último
   recurso (`didit` 1000, `textract` 1004, `hitguest_signature` 1005 — esos tres
   sí verificados).
2. **Nunca identificar una automatización por `executionOrder`.**
3. **Comparar slugs siempre con `canonicalSlug()`.**
4. **Una lista vacía significa «no sabemos», no «no hay nada».** Si
   `/providers` viene vacío, no agregar ni ocultar nada.
5. **Nunca ocultar una fila que el backend sí creó**, aunque no haya definición
   de presentación para ella.
6. **Ante dos documentos del backend que se contradicen, decirlo y verificar.**
   No elegir el que convenga.

---

## 5. Abierto — no inventar una respuesta

- **Con qué endpoint se crea una fila cuando el PM activa una que no existe.**
  Hoy: 403 en `POST /property-automations`, 405 en
  `POST /properties/{uuid}/automations`. Sin esto, las automatizaciones se
  listan pero no se pueden activar. **Es el bloqueo principal.**
- **⚠️ `PATCH /property-automations/{uuid}/configure` con `parameters` OMITIDO:
  ¿merge o replace?** (preguntado a backend 2026-08-21, caso Insula). El toggle
  del frontend manda solo `{statusProviderId[, providerId]}` sin la clave
  `parameters`. Si el backend RESETEA `parameters` cuando la clave no viene,
  cada encendido/apagado de la tarjeta de Contrato borra el routing
  (`contract_mode`/`by_source`) — explicaría una fila ACTIVA y "SIN CONFIGURAR"
  a la vez. Si hace merge/ignora la clave ausente, el candidato cae. No asumir
  ninguna de las dos hasta la respuesta.
- **⚠️ Fila de Insula (caso 2026-08-21):** la tarjeta mostró "SIN CONFIGURAR"
  con Documentos aparentando configuración (Directo · alquiler · firma nativa).
  Falta ver `GET /properties/{uuid}/automations?includeProvider=true` de esa
  propiedad: si `parameters` está vacío, el routing nunca se persistió (o lo
  tiene otra fila); no se necesita endpoint nuevo para mostrarlo — todo lo que
  la tarjeta enumera sale de ese GET + `/reservation-sources` + `/providers`.
- `didit`/`textract` sin `applicable_countries` en la respuesta de la API.
- **Consumo de reservas eliminadas (pedido de producto 2026-09-03):** el
  cliente podrá eliminar reservas de Operaciones sin que su consumo desaparezca
  del Tablero de saldos. El tablero HOY se alimenta de `GET /reservations` +
  `GET /reservations/{uuid}/automation-records` por reserva, así que la
  eliminación la borra de la contabilidad visible. Falta saber: ¿`DELETE
  /reservations/{uuid}` es soft-delete recuperable por query (`withTrashed` o
  similar en el index)? ¿`automation-records` responde para una reserva
  eliminada (la CANCELADA da 404 en el show, §2g)? ¿O existe/puede existir un
  endpoint de consumo a nivel CUENTA que embeba el snapshot de la reserva
  (huésped, unidad, check-in)? Sin una de las tres, el pedido no es
  implementable solo desde el front.
- Si `POST /properties` va a respetar el array `automations` o dejar de pedirlo.
- **⚠️ `GET /reservations` ¿pagina? (auditoría externa 2026-10-08).** Este
  skill y el código afirmaban «devuelve la lista completa, sin paginación»
  (❌ nunca verificado por curl). En producción se observó UNA carga seguida de
  exactamente **15** consultas de automatización — el `per_page` por defecto
  de Laravel. Y el «aviso si viene paginado» del front era código muerto:
  `apiClient` desenvuelve `data` y descarta `meta`, así que jamás vio
  `meta.last_page` (el repo ya lo sabía: `listProviders` y
  `propertyDocumentService.list` leen `meta` con un `fetch` crudo por eso).
  **Corregido 2026-10-08**: `fetchAllReservationPages` sigue `?page=N` hasta
  `meta.last_page` con el token de sesión (si no pagina, una sola llamada);
  `source.name` y `emailGuest` se leen con tolerancia (el `name` puede ser
  `{en, es}` como el del estado); cada fila se mapea aislada y una mal formada
  se descarta con `console.error` en vez de tumbar el lote. Confirmar con
  token de PM: `curl -s "$API/reservations?page=1" "${H[@]}" | jq '{n: (.data|length), meta}'`.
- **⚠️ `GET /reservations` respondió 202 en producción (observado por auditoría
  externa el 2026-10-08, 07:30, dos segundos después de un 200 de la misma
  lista; cuerpo NO capturado).** Ningún contrato documenta un 202 en ese
  endpoint (solo en `POST /integrations` de Kunas = «sincronización iniciada en
  background» y en `POST /ical/feeds/{uuid}/sync`). Hipótesis: el backend
  devuelve 202 mientras corre una sincronización. Lo que SÍ es del front: el
  cliente aceptaba cualquier 2xx y `fetchList` convertía un cuerpo sin arreglo
  en `[]` — la tabla pasaba de «una reserva» a «No hay resultados» sin error.
  Corregido 2026-10-08: un 2xx cuyo cuerpo no trae el arreglo ya no es «cero
  reservas», es un fallo (la pantalla conserva lo que tenía); un 202 se trata
  como «todavía no» y se reintenta solo. **Pedir a backend el cuerpo exacto del
  202 y en qué condiciones lo emite** — la prueba del auditor (Preserve log en
  Network, guardar ambos cuerpos) es la correcta.

- **Reservas manuales «que no se muestran» (Ricardo, 2026-10-08).** DOS causas
  del lado del front, ambas corregidas: (a) el botón «Nueva Reserva» del
  encabezado del Tablero y el calendario NO escuchaban `reservationCreated`
  (solo la lista); (b) **el listado hacía `statusReservation.name.toLowerCase()`
  a secas** mientras el detalle ya usaba `mapReservationStatus` (id del catálogo
  primero; `name` como objeto `{en, es}` o JSON serializado). Con el `name` como
  objeto, UNA reserva lanzaba un TypeError dentro del `map`, `list()` rechazaba y
  `ReservationsList` conservaba la lista anterior solo con un `console.error`:
  exactamente «se crea pero no aparece». Ahora hay un único normalizador
  (auditoría externa 2026-10-08). Si después de recargar tampoco aparece, es
  `GET /reservations` (¿filtra por fecha o estado? ¿empezó a paginar?
  `warnIfPaginated` lo gritaría en consola).
  Confirmar con token de PM:
  `curl -s "$API/reservations" "${H[@]}" | jq '{total: (.data|length), meta, ultimas: [.data[-3:][] | {externalId, arrivalDate, statusReservationId: .statusReservation.id, createdAt}]}'`

- **Superusuario e ingreso a cuentas de clientes (pedido de producto
  2026-10-09).** NO existe ningún contrato: `GET /user` no dice quién es
  superusuario, `GET /users` y `GET /clients/{uuid}` son solo de la propia
  cuenta, y `RICARDO_API_CONTRACTS.md` §3.3 registra que `SUPER_ADMIN` NO debe
  recibir scope global. Lo pedido (sin inventar nada en el front):
  `roles` + `capabilities` en `GET /user`; `GET /admin/clients`, su detalle y
  `/admin/clients/{uuid}/users` (paginados, 403 sin capacidad); `POST
  /admin/impersonations {userUuid, mode, reason}` que emite un token APARTE,
  corto, con abilities RECORTADAS (nada de `/admin/*`, sin anidamiento), ligado
  al actor y revocable por el actor con `DELETE /admin/impersonations/{id}`;
  `GET /user` con ese token trae `impersonation {id, actorUuid, mode,
  expiresAt}`; solo lectura por políticas (no solo por método) y `full` solo
  con `admin.impersonate.full`; auditoría con motivo obligatorio. Todo el
  modelo en el mismo deploy, nunca «auditoría después». **Bloqueante previo:**
  hoy `SUPER_ADMIN` recibe propiedades de TODAS las cuentas (`withinScope()`,
  observado jul 2026, `BACKEND_NEEDS_SUMMARY.md`): hay que quitarlo antes, o el
  actor se salta la suplantación. Permisos efectivos = los del objetivo ∩ modo
  ∩ allowlist − prohibiciones; nunca más que el usuario suplantado. Detalle y payloads en
  `docs/BACKEND_NEEDS_IMPERSONATION.md`. **Front construido 2026-10-09 y
  OCULTO** detrás de `capabilities` (`src/features/admin/`): sesión de dos capas
  en el `auth-store` (`actor`), 401 dentro de una cuenta ajena = salir de ella
  (nunca cerrar la del superusuario), revocación con el token del actor,
  navegación completa al entrar/salir, banner, directorio y cuenta del cliente,
  diálogo con motivo. Lectores en `admin-readers.ts`/`session-access.ts`: único
  punto a ajustar cuando llegue el contrato real.

El detalle con evidencia está en `docs/BACKEND_NEEDS_PROPERTY_AUTOMATIONS.md`.

---

## Mantenimiento — obligatorio, no opcional

**Cada vez que se ajusta, se descubre o se verifica un contrato, endpoint o
payload del backend, se registra acá en el mismo momento.** No al final de la
tarea, no "cuando haya tiempo": en el momento. Este archivo es el que evita
volver a investigar lo mismo, y solo sirve si está al día.

### Cuándo registrar (cualquiera de estas dispara el registro)

- El backend manda un plan, un `.md`, un mensaje de chat o un artifact con
  endpoints, payloads o reglas.
- Se corre un `curl` contra la API y la respuesta aporta algo que no estaba acá
  — incluido confirmar lo que ya estaba (pasa de ⚠️ a ✅ con fecha).
- Un endpoint cambia de forma, de permisos o de códigos de error.
- Se descubre que algo documentado es falso.
- Se agrega, renombra o elimina un campo, un slug o un id de catálogo.

### Qué anotar en cada entrada

1. **Método y ruta exactos**, con los query params que importan.
2. **El payload real**, recortado a lo que se usa — nunca parafraseado.
3. **La marca**: ✅ verificado contra la API (con la fecha), ⚠️ solo documentado,
   ❌ documentado y demostrado falso.
4. **Cómo se comprobó**, si fue ✅: el `curl` o la llamada, para que otro lo
   repita sin rearmarlo.
5. **Qué se rompe si se asume mal.** Una regla sin consecuencia no se recuerda;
   la consecuencia es lo que hace que alguien la respete.

### Lo falso NO se borra

Cuando algo pasa a ❌, **se deja escrito con su corrección al lado**. Borrarlo
hace que el próximo lea el mismo documento del backend y llegue a la misma
conclusión equivocada. La sección de trampas confirmadas vale precisamente
porque conserva los errores, no porque los oculte.

### Dónde va cada cosa

| Qué | Dónde |
|---|---|
| El contrato en sí | **Este skill** |
| El hallazgo y su porqué | Memoria (`mem_save` + archivo en `memory/`) |
| Un pedido al backend | `docs/BACKEND_NEEDS_*.md`, con la evidencia observada |
| Un patrón de código que se deriva | `hitguest-standards` |

### Verificar antes de citar

Antes de usar algo de acá como verdad, confirmar que el archivo o el campo que
cita sigue existiendo. Este skill puede quedar desactualizado exactamente igual
que la memoria — ya pasó con la afirmación de que el token de sesión no vivía en
`localStorage`, que era falsa. «El skill dice que X existe» no es lo mismo que
«X existe ahora».

Cada afirmación debe poder señalar una respuesta observada o un archivo real.
Una que no lo pueda hacer se marca ⚠️ o se borra — es exactamente igual de
peligrosa que inventar un endpoint (Regla 1 y Regla 7 de `hitguest-standards`).
