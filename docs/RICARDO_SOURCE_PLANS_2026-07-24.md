# Contratos fuente recibidos — 24 de julio de 2026

Este anexo normaliza los cuatro archivos entregados el 24-jul-2026. Conserva
los contratos API y registra duplicados sin volver a documentarlos. El maestro
vigente está en
[`RICARDO_API_CONTRACTS.md`](./RICARDO_API_CONTRACTS.md).

## 1. Inventario y trazabilidad

| ID  | Plan fuente                                             | SHA-256                                                            | Resultado                   |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------- |
| S6  | Gestión de Imágenes de Propiedad                        | `9a8899bb0b7fe71753ef5ad1e332c3184ccec137f044406def3b2928506e6adc` | Duplicado contractual de S5 |
| S7  | Gestión de Integración Kunas PMS                        | `5f4cccbc44f1277ee9dd2391472eec41af16f38c59cd41cfd5f0ce297ca19478` | Contrato nuevo              |
| S8  | Panel de Automatizaciones por Reserva                   | `ef1fc75f3b4d3c5acb89c64e26088e42e07b041741e288589f3ff6fac48d54d3` | Contrato nuevo              |
| S9  | Property Automations — Parameters & Providers Reference | `8833a3a1e85cea3fd5b6b949f81b175b601c1c09f5966f01d015ee3441f69955` | Referencia nueva            |

S6 difiere de S5 únicamente porque la primera línea perdió el marcador Markdown
`#`. Sus endpoints, payloads, respuestas y reglas son idénticos. El contrato
normalizado se conserva en la
[sección 6 del anexo anterior](./RICARDO_SOURCE_PLANS_2026-07-23.md#6-s5--imágenes-de-propiedad).

Los endpoints administrativos requieren:

```http
Authorization: Bearer {sanctum-token}
Accept: application/json
Base URL: {API_BASE}/api/v1
```

## 2. S7 — Integración Kunas PMS

### 2.1 Modelo

```json
{
  "data": {
    "id": 12,
    "userId": 3,
    "providerId": 5,
    "name": "KunasPMS",
    "token": "token-hit-interno",
    "parameters": {
      "token": "provider-token-kunas",
      "email": "pm@miempresa.com",
      "pmsProperties": [
        { "id": "101", "name": "Apartamento Centro" },
        { "id": "102", "name": "Villa Mar" }
      ]
    },
    "statusProviderId": 8
  }
}
```

Reglas:

- `statusProviderId = 8`: activa;
- `statusProviderId = 10`: inactiva;
- `parameters.password` no retorna;
- `parameters.token` y el `token` raíz no deben mostrarse;
- `pmsProperties` puede ser `[]` mientras termina la sincronización.

### 2.2 Consultar estado

```http
GET /api/v1/kunas-pms/integration
```

Sin body.

| Status | Respuesta                                                                    |
| ------ | ---------------------------------------------------------------------------- |
| `200`  | `IntegrationResource`                                                        |
| `404`  | `{"message":"The requested resource was not found."}`; no existe integración |
| `401`  | sesión inválida                                                              |

### 2.3 Conectar o reconectar

```http
POST /api/v1/kunas-pms/connect
Content-Type: application/json
```

```json
{
  "token": "token-del-proveedor-kunas",
  "email": "pm@empresa.com",
  "password": "contraseña",
  "name": "Mi integración Kunas"
}
```

| Campo      | Regla                               |
| ---------- | ----------------------------------- |
| `token`    | string requerido                    |
| `email`    | email requerido                     |
| `password` | string requerido                    |
| `name`     | string opcional; default `KunasPMS` |

`202` retorna `IntegrationResource` e inicia sincronización en background.
Reconectar actualiza las credenciales y vuelve a sincronizar propiedades.

Credenciales inválidas:

```json
{
  "message": "KunasPMS authentication failed.",
  "errors": {
    "credentials": ["The provided KunasPMS credentials are invalid."]
  }
}
```

Validación:

```json
{
  "message": "The token field is required.",
  "errors": {
    "token": ["The token field is required."],
    "email": ["The email field must be a valid email address."]
  }
}
```

Otros status: `401` credenciales, `422` campos y `500` configuración backend.
Un `401` de Kunas se distingue del de sesión porque contiene
`errors.credentials`.

### 2.4 Actualizar credenciales

```http
PATCH /api/v1/kunas-pms/configuration
Content-Type: application/json
```

```json
{
  "email": "nuevo@empresa.com",
  "password": "nueva-contraseña"
}
```

Ambos campos son requeridos. El backend valida las nuevas credenciales.

| Status | Resultado                                              |
| ------ | ------------------------------------------------------ |
| `200`  | `IntegrationResource` actualizado                      |
| `401`  | credenciales Kunas inválidas, con `errors.credentials` |
| `404`  | no existe integración activa                           |
| `422`  | validación                                             |

No vuelve a sincronizar propiedades o reservas.

### 2.5 Activar o pausar

```http
PATCH /api/v1/integrations/{id}
Content-Type: application/json
```

Activar:

```json
{ "statusProviderId": 8 }
```

Pausar:

```json
{ "statusProviderId": 10 }
```

`{id}` admite el id numérico o el token HIT; se recomienda el id. `200` retorna
`IntegrationResource`; también puede responder `401`, `404` o `422`.

Pausar hace que se rechacen webhooks y detiene el procesamiento de nuevas
reservas.

### 2.6 Desconectar

```http
DELETE /api/v1/integrations/{id}
```

Sin body. `204` sin respuesta, `401` o `404`. No elimina propiedades, reservas
ni importaciones previas.

## 3. S8 — Panel de automatizaciones por reserva

Además del bearer token, el plan prescribe:

```http
X-Locale: es
```

Valores de idioma: `es`, `en`, `pt`. Los mensajes de error ya llegan
traducidos.

### 3.1 Estado actual

```http
GET /api/v1/reservations/{reservationUuid}/automation-status
```

```json
{
  "data": [
    {
      "automationUuid": "01960d3e-...",
      "automationName": "SIRE Colombia",
      "providerSlug": "sire_colombia",
      "status": "failed",
      "wasSuccessful": false,
      "lastSuccessAt": null,
      "lastError": "Connection timeout",
      "lastRunAt": "2026-07-01 13:00:00",
      "usageRecordId": 38,
      "requiresCheckin": "reservation",
      "redispatchRequiresCheckin": null,
      "canManualDispatch": true,
      "reservationCheckinCompleted": true,
      "mainGuestCheckinCompleted": true,
      "canDispatch": false,
      "canRedispatch": true
    }
  ]
}
```

| Campo                       | Contrato                                            |
| --------------------------- | --------------------------------------------------- | ---------- | --------- | ------- |
| `status`                    | `not_started                                        | pending    | completed | failed` |
| `wasSuccessful`             | indica si alguna ejecución anterior fue exitosa     |
| `lastSuccessAt`             | fecha `America/Bogota` o `null`                     |
| `lastError`                 | mensaje del último fallo o `null`                   |
| `lastRunAt`                 | fecha `America/Bogota` o `null`                     |
| `usageRecordId`             | id del último intento; necesario para redispatch    |
| `requiresCheckin`           | `reservation                                        | main_guest | null`     |
| `redispatchRequiresCheckin` | `main_guest                                         | null`      |
| `canManualDispatch`         | capacidad general del provider                      |
| `canDispatch`               | fuente de verdad para el botón de primera ejecución |
| `canRedispatch`             | fuente de verdad para el botón de reintento         |

El backend ordena por `execution_order`.

### 3.2 Historial

```http
GET /api/v1/reservations/{reservationUuid}/automation-records
GET /api/v1/reservations/{reservationUuid}/automation-records?automationUuid={uuid}
```

```json
{
  "data": [
    {
      "id": 38,
      "status": "failed",
      "triggeredBy": "manual_redispatch",
      "automationUuid": "automation-uuid",
      "automationName": "SIRE Colombia",
      "providerSlug": "sire_colombia",
      "guestUuid": null,
      "billable": true,
      "unitCost": "0.0000",
      "lastError": {
        "message": "Connection timeout",
        "httpStatus": 504,
        "httpBody": "{\"error\":\"Gateway Timeout\"}"
      },
      "responsePayload": {
        "error": "Connection timeout",
        "http_status": 504
      },
      "createdAt": "2026-07-01 13:00:00",
      "updatedAt": "2026-07-01 13:00:30"
    }
  ]
}
```

`lastError.httpStatus` y `lastError.httpBody` pueden ser `null`.

`triggeredBy`:

- `on_checkin_completed`;
- `on_main_guest_checkin_completed`;
- `on_guest_checkin_completed`;
- `after_automation`;
- `manual_dispatch`;
- `manual_redispatch`;
- `manual_resend`.

El resultado no está paginado, va del más reciente al más antiguo.

### 3.3 Dispatch inicial

```http
POST /api/v1/reservations/{reservationUuid}/property-automations/{automationUuid}/dispatch
```

Solo cuando `canDispatch === true`. Sin payload contractual.

```json
{ "message": "Automation dispatched successfully." }
```

Status `202`.

| Status | Causa                                       |
| ------ | ------------------------------------------- |
| `422`  | check-in requerido incompleto               |
| `422`  | provider no admite acciones manuales        |
| `422`  | automation inactiva                         |
| `422`  | ya tiene intento pending o completed        |
| `422`  | tiene fallo previo y corresponde redispatch |
| `422`  | no existe job handler                       |
| `429`  | cooldown de cinco minutos                   |

### 3.4 Redispatch

```http
POST /api/v1/reservations/{reservationUuid}/automation-records/{usageRecordId}/redispatch
```

Solo cuando `canRedispatch === true`. Sin payload contractual.

```json
{ "message": "Automation re-dispatched successfully." }
```

Status `202`.

| Status | Causa                           |
| ------ | ------------------------------- |
| `422`  | gate de check-in incompleto     |
| `422`  | acciones manuales no permitidas |
| `422`  | el registro no está `failed`    |
| `422`  | no es el registro más reciente  |
| `429`  | cooldown de cinco minutos       |

### 3.5 Reenviar PDF

```http
POST /api/v1/reservations/{reservationUuid}/property-automations/{automationUuid}/resend-pdf
```

Solo para `providerSlug === "pdf_report"` y con check-in completo. Puede
ejecutarse aunque exista un registro `completed`.

| Status | Causa                       |
| ------ | --------------------------- |
| `202`  | reenvío aceptado            |
| `422`  | check-in incompleto         |
| `422`  | no es una automation de PDF |
| `429`  | cooldown de cinco minutos   |

### 3.6 Reglas de UI/operación

- Hacer polling cada 10–15 segundos únicamente mientras exista un item
  `pending`; no hay WebSocket.
- El `429` no incluye `Retry-After` ni `cooldownSecondsRemaining`; el contador
  de 300 segundos comienza al recibir la respuesta. No aplica a admin tokens.
- Los timestamps no son UTC: vienen en `America/Bogota` (UTC-5).
- `failed + wasSuccessful=true` significa que una ejecución anterior funcionó
  y un reintento posterior falló.
- Automations de secundarios con `on_guest_checkin_completed` son automáticas:
  no muestran acciones, pero sí aparecen en historial con `guestUuid`.
- Los `4xx` son errores de negocio para mostrar al PM; los `5xx` se presentan
  como error genérico.

Slugs observados por este panel:

| `providerSlug`       | Nombre                   |
| -------------------- | ------------------------ |
| `sire_colombia`      | SIRE Migración Colombia  |
| `tra_colombia`       | TRA Turismo Colombia     |
| `pdf_report`         | Reporte de Huéspedes PDF |
| `ttlock`             | SmartLock TTLock         |
| `tufirma`            | Firma TuFirma            |
| `hitguest_signature` | Firma propia HIT Guest   |

## 4. S9 — Parámetros y providers

Los valores se envían en `PropertyAutomation.parameters` mediante el endpoint
`/configure`. Las credenciales del PM viven allí; las credenciales internas HIT
permanecen en el registro `Provider`.

### 4.1 Parámetros universales opcionales

```json
{
  "triggerTypes": [
    "on_checkin_completed",
    "on_guest_checkin_completed",
    "on_physical_checkout",
    "after_automation"
  ],
  "triggerConfig": {
    "on_checkin_completed": { "delay_minutes": 0 },
    "on_physical_checkout": { "delay_minutes": 120 },
    "after_automation": {
      "predecessor_automation_id": 5,
      "delay_minutes": 30
    }
  },
  "guest_filter": "all"
}
```

`delay_minutes` es entero. `guest_filter` acepta
`all|foreign_only|national_only`.

### 4.2 Matriz de automatizaciones

| Orden | Automatización        | Provider             | ID        | Parámetros requeridos             |
| ----- | --------------------- | -------------------- | --------- | --------------------------------- |
| 1     | Identidad principal   | `didit` o `textract` | 1000/1004 | ninguno                           |
| 2     | Identidad secundarios | `didit` o `textract` | 1000/1004 | ninguno                           |
| 3     | Contrato digital      | `tufirma`            | 1002      | ninguno                           |
| 4     | Smart lock            | `ttlock`             | 1001      | `username`, `password`, `locks[]` |
| 5     | Guest Report PDF      | `pdf-report`         | 1003      | `recipients[]`                    |
| 6     | TRA Colombia          | `tra-colombia`       | 1         | `token`, `rnt`                    |
| 7     | SIRE check-in         | `sire-colombia`      | 2         | credenciales SIRE                 |
| 8     | SIRE check-out        | `sire-colombia`      | 2         | credenciales SIRE independientes  |

TuFirma no puede desactivarse. Al activar una identidad de orden 1 o 2, el
backend desactiva otra activa del mismo `guestType`.

### 4.3 TTLock

```json
{
  "username": "ttlock_account@email.com",
  "password": "ttlock_account_password",
  "locks": [
    {
      "lock_id": 123456,
      "name": "Puerta Principal",
      "type": "unit_entrance"
    }
  ]
}
```

`locks` requiere mínimo uno. `locks[].lock_id` es integer y `locks[].type`
acepta `unit_entrance|building_entrance|amenity`. `client_id` y
`client_secret` son internos HIT y no se envían.

### 4.4 PDF

```json
{
  "recipients": ["manager@property.com", "operations@property.com"]
}
```

Mínimo un email válido.

### 4.5 TRA

```json
{
  "token": "Token_autenticacion_TRA",
  "rnt": "123456789"
}
```

Ambos strings requeridos.

### 4.6 SIRE check-in/check-out

```json
{
  "document_type": "CC",
  "document_number": "123456789",
  "password": "sire_password",
  "company_code": "900123456"
}
```

Todos los campos son strings requeridos. Los órdenes 7 y 8 se configuran por
separado.

### 4.7 Catálogo de providers

Providers activos como automatizaciones:

| ID   | Nombre           | `path`          | Facturable      | Costo documentado |
| ---- | ---------------- | --------------- | --------------- | ----------------- |
| 1000 | Didit            | `didit`         | sí              | USD 0.85          |
| 1004 | AWS Textract     | `textract`      | sí              | USD 0.20          |
| 1002 | TuFirma Digital  | `tufirma`       | sí              | USD 0.00          |
| 1001 | TTLock           | `ttlock`        | sí              | USD 0.85          |
| 1003 | Guest Report PDF | `pdf-report`    | sí              | USD 0.00          |
| 1    | TRA Colombia     | `tra-colombia`  | no especificado | no especificado   |
| 2    | SIRE Colombia    | `sire-colombia` | no especificado | no especificado   |

Providers registrados sin automation por defecto:

| ID  | Provider      | `path`                   | Campos `externalData`                                                                                                                                     |
| --- | ------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3   | Colasistencia | `colasistencia-colombia` | `client_code`, `client_password`, `product_code`, `activity_code`                                                                                         |
| 4   | Taxxa         | `taxxa-colombia`         | `url`, `email`, `password`, `mode`, `organization_type`, `tributaryidentificationkey`, `fiscal_responsibilities`, `fiscal_regime`, `legal_entity_doctype` |
| 5   | Kunas PMS     | `kunas-pms`              | `username`, `password`, `mode`, `token`                                                                                                                   |
| 6   | Webpos Panamá | `webpos-panama`          | `url`, `company_license`, `key`, `branch_code`, `pos_code`, `mode`                                                                                        |

### 4.8 Payloads de providers futuros

Colasistencia:

```json
{
  "client_code": "CODIGO_CLIENTE",
  "client_password": "CLAVE_CLIENTE",
  "product_code": "CODIGO_PRODUCTO",
  "activity_code": "CODIGO_ACTIVIDAD"
}
```

Taxxa:

```json
{
  "url": "https://demo1.taxxa.co/api2.djson",
  "email": "cliente@empresa.com",
  "password": "clave_cliente",
  "mode": "test",
  "organization_type": "company",
  "tributaryidentificationkey": "01-IVA",
  "fiscal_responsibilities": "O-13",
  "fiscal_regime": "48",
  "legal_entity_doctype": "NIT"
}
```

Valores documentados:

- `mode`: `test|production`;
- `organization_type`: `company|person`;
- `tributaryidentificationkey`: `01-IVA|04-INC|ZA-IVA e INC|ZZ-No aplica`;
- `fiscal_responsibilities`: `O-13|O-15|O-23|O-47|R-99-PN`;
- `fiscal_regime`: `48|49`;
- `legal_entity_doctype`: `CC|NIT`.

Kunas:

```json
{
  "username": "email@cliente.com",
  "password": "clave_cliente",
  "mode": "production",
  "token": "TOKEN_API"
}
```

Webpos:

```json
{
  "url": "https://fepa-api.webposonline.com",
  "company_license": "CODIGO_EMPRESA",
  "key": "CLAVE_API",
  "branch_code": "CODIGO_SUCURSAL",
  "pos_code": "PUNTO_DE_VENTA",
  "mode": "production"
}
```

Para providers id 1–6, `externalData` viene de
`provider.parameters.v1.externalData`; para IDs 1000+, de
`provider.parameters.externalData`.

## 5. Divergencias y decisiones de integración

| Tema                | Fuente                               | Tratamiento                                                      |
| ------------------- | ------------------------------------ | ---------------------------------------------------------------- |
| Imágenes S6         | Mismo contrato que S5                | No duplicar especificación                                       |
| Slug API de panel   | S8 usa snake_case (`pdf_report`)     | No confundir con `Provider.path` de configuración (`pdf-report`) |
| Wrapper automations | S8 retorna `{data:[...]}`            | No tratar la raíz como arreglo contractual                       |
| TTLock secrets      | S9 excluye `client_id/client_secret` | Deben permanecer internos en HIT                                 |
| Kunas configuration | S7 requiere solo email/password      | `token` no pertenece al PATCH de configuración                   |
| Timestamps          | S8 usa hora Bogotá sin UTC           | Parsear con zona explícita para evitar desplazamientos           |
| Cooldown            | S8 no retorna metadata temporal      | Contar 300 segundos desde el `429`                               |
