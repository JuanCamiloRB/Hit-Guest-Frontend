# Contrato de endpoints consumidos por el frontend

> Documento **as-built**: describe lo que el frontend envía y consume en el
> código actual. No sustituye la especificación interna del backend.
>
> Última auditoría: 23 de julio de 2026.

Para contratos históricos, decisiones explícitamente atribuidas a Ricardo,
variantes supersedidas y propuestas preservadas, consultar
[`RICARDO_API_CONTRACTS.md`](./RICARDO_API_CONTRACTS.md).
Los planes originales incorporados el 23-jul-2026 se pueden auditar en
[`RICARDO_SOURCE_PLANS_2026-07-23.md`](./RICARDO_SOURCE_PLANS_2026-07-23.md).
Los archivos adicionales incorporados el 24-jul-2026 están en
[`RICARDO_SOURCE_PLANS_2026-07-24.md`](./RICARDO_SOURCE_PLANS_2026-07-24.md).

## 1. Alcance y convenciones

Esta referencia cubre:

- llamadas al backend de HIT Guest;
- rutas BFF/API implementadas por Next.js;
- endpoints del portal público de check-in;
- cargas multipart y descargas binarias;
- integración server-to-server con Google Places;
- endpoints legacy que todavía tienen un consumidor en el código.

La base del backend es:

```text
NEXT_PUBLIC_API_URL_GUEST
```

Fallback actual:

```text
https://guest.hit.tools/api/v1
```

### 1.1 Tipos de autenticación

| Código        | Autenticación                                                                            | Uso                                                             |
| ------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `APP`         | `Authorization: Bearer {APP_API_TOKEN}`                                                  | Pre-login, catálogos y portal de huéspedes                      |
| `SESSION`     | `Authorization: Bearer {token_del_usuario}`                                              | Datos de cuenta: propiedades, reservas, usuarios, billing, etc. |
| `BFF-SESSION` | El navegador envía el token de sesión a una ruta `/api/*`; Next.js lo reenvía al backend | BFF de propiedades                                              |
| `SERVER-KEY`  | Credencial disponible solo en el servidor                                                | Google Places                                                   |
| `PUBLIC`      | Sin token o navegación directa                                                           | Solo donde se indica expresamente                               |

Las llamadas JSON normalmente incluyen:

```http
Content-Type: application/json
Accept: application/json
Accept-Language: es|en|pt
X-Locale: es|en|pt
X-App-Locale: es|en|pt
Authorization: Bearer {token}
```

`apiClient` desenvuelve automáticamente respuestas `{ "data": ... }`. Por eso
los tipos descritos como “recurso” pueden llegar como recurso directo al
consumidor aunque el backend los envuelva.

### 1.2 Formato de errores

El frontend tolera, según el endpoint:

```json
{
  "message": "Mensaje legible",
  "errors": {
    "campo": ["Detalle de validación"]
  }
}
```

Los estados tratados expresamente son:

- `400`: solicitud incompleta;
- `401`: sesión ausente o expirada;
- `403`: acción no autorizada;
- `404`: recurso o endpoint no disponible;
- `409`: conflicto de estado;
- `422`: validación o regla de negocio;
- `429`: cooldown de automatización;
- `500`, `501`, `502`, `503`: error de backend, dependencia o configuración.

## 2. Matriz general

| Método                  | Ruta                                                                    | Auth          | Uso                                      |
| ----------------------- | ----------------------------------------------------------------------- | ------------- | ---------------------------------------- |
| POST                    | `/auth/login`                                                           | APP           | Solicitar OTP                            |
| POST                    | `/auth/verify-otp`                                                      | APP           | Verificar OTP y crear sesión             |
| POST                    | `/auth/resend-otp`                                                      | APP           | Reenviar OTP                             |
| POST                    | `/auth/logout`                                                          | SESSION       | Cerrar sesión                            |
| POST                    | `/account/register`                                                     | APP           | Registrar cliente/usuario                |
| GET, PATCH              | `/clients/{clientUuid}`                                                 | SESSION       | Leer/editar cuenta                       |
| POST, DELETE            | `/clients/{clientUuid}/logo`                                            | SESSION       | Subir/eliminar logo                      |
| POST                    | `/clients/{clientUuid}/transfer-ownership`                              | SESSION       | Transferir titularidad                   |
| GET, POST               | `/users`                                                                | SESSION       | Listar/crear usuarios                    |
| DELETE                  | `/users/{userUuid}`                                                     | SESSION       | Eliminar usuario                         |
| GET                     | `/catalogs`                                                             | APP           | Catálogos filtrados                      |
| GET                     | `/catalogs/identification-types`                                        | APP           | Tipos de documento por país              |
| GET                     | `/catalogs/category/currencies`                                         | APP           | Monedas                                  |
| GET                     | `/catalogs/category/timezones`                                          | APP           | Zonas horarias                           |
| GET                     | `/countries`                                                            | APP o SESSION | Países                                   |
| GET, POST               | `/properties`                                                           | SESSION       | Listar/crear propiedades                 |
| GET, PUT, PATCH, DELETE | `/properties/{uuid}`                                                    | SESSION       | Detalle/edición/eliminación              |
| POST                    | `/properties/{uuid}/restore`                                            | SESSION       | Restaurar propiedad                      |
| POST, DELETE            | `/properties/{uuid}/images`                                             | SESSION       | Galería                                  |
| GET                     | `/properties/{uuid}/listings`                                           | SESSION       | Alojamientos por propiedad               |
| GET, POST               | `/listings`                                                             | SESSION       | Listar/crear alojamientos                |
| GET, PUT, DELETE        | `/listings/{uuid}`                                                      | SESSION       | Detalle/edición/eliminación              |
| GET                     | `/properties/{uuid}/automations`                                        | SESSION       | Automatizaciones por propiedad           |
| GET, POST               | `/property-automations`                                                 | SESSION       | Listar/crear automatizaciones            |
| GET, PATCH, DELETE      | `/property-automations/{uuid}`                                          | SESSION       | CRUD de automatización                   |
| PATCH                   | `/property-automations/{uuid}/configure`                                | SESSION       | Configurar/activar                       |
| POST                    | `/property-automations/{uuid}/restore`                                  | SESSION       | Restaurar automatización                 |
| GET                     | `/providers`                                                            | SESSION       | Proveedores                              |
| GET                     | `/listings/{uuid}/automation-overrides`                                 | SESSION       | Overrides por alojamiento                |
| GET, POST               | `/listing-automation-overrides[/{uuid}]`                                | SESSION       | Consultar/crear/editar/eliminar override |
| POST                    | `/listing-automation-overrides/{uuid}/restore`                          | SESSION       | Restaurar override                       |
| GET                     | `/property-document-types`                                              | SESSION       | Tipos de documentos                      |
| GET, POST               | `/properties/{uuid}/documents`                                          | SESSION       | Listar/crear documentos                  |
| GET, PATCH, DELETE      | `/properties/{uuid}/documents/{documentUuid}`                           | SESSION       | CRUD de documento                        |
| POST                    | `/properties/{uuid}/documents/{documentUuid}/restore`                   | SESSION       | Restaurar documento                      |
| GET                     | `/reservations`                                                         | SESSION       | Listar reservas                          |
| GET, POST, PUT, DELETE  | `/reservations[/{uuid}]`                                                | SESSION       | CRUD de reserva                          |
| POST                    | `/reservations/{uuid}/send-checkin-link`                                | SESSION       | Enviar link                              |
| GET                     | `/reservations/{uuid}/guests`                                           | SESSION       | Huéspedes/documentos                     |
| GET                     | `/reservations/{uuid}/automation-status`                                | SESSION       | Estado de automatizaciones               |
| GET                     | `/reservations/{uuid}/automation-records`                               | SESSION       | Historial/consumo                        |
| POST                    | `/reservations/{uuid}/automation-records/{id}/redispatch`               | SESSION       | Reintentar fallo                         |
| POST                    | `/reservations/{uuid}/property-automations/{automationUuid}/dispatch`   | SESSION       | Disparar manualmente                     |
| POST                    | `/reservations/{uuid}/property-automations/{automationUuid}/resend-pdf` | SESSION       | Reenviar PDF                             |
| GET                     | `/reservations/{uuid}/documents/{documentUuid}/render`                  | SESSION       | Render de documento                      |
| GET                     | `/reservations/{uuid}/documents/{documentUuid}/pdf`                     | SESSION       | PDF de documento                         |
| GET                     | `/checkin/{reservationUuid}`                                            | APP           | Portal de check-in                       |
| POST                    | `/checkin/{reservationUuid}/identify`                                   | APP           | Identificar huésped                      |
| GET                     | `/checkin/{reservationUuid}/form/{guestUuid}`                           | APP           | Esquema dinámico                         |
| GET                     | `/checkin/{reservationUuid}/verify/result`                              | APP           | Resultado Didit                          |
| POST                    | `/checkin/{reservationUuid}/main/sign`                                  | APP           | Firma nativa                             |
| POST                    | `/checkin/{reservationUuid}/main/complete`                              | APP           | Completar principal                      |
| POST                    | `/checkin/{reservationUuid}/secondary/{guestUuid}/complete`             | APP           | Completar acompañante                    |
| POST                    | `/checkin/{reservationUuid}/secondary/{guestUuid}/documents`            | APP           | OCR/selfie                               |
| GET                     | `/checkin/{reservationUuid}/documents/{documentUuid}/render`            | APP           | Render para huésped                      |
| GET                     | `/checkin/{reservationUuid}/documents/{documentUuid}/pdf`               | APP           | PDF para huésped                         |
| GET                     | `/checkin/{reservationUuid}/contract/signed`                            | PUBLIC        | Contrato firmado                         |
| GET                     | `/kunas-pms/integration`                                                | SESSION       | Integración Kunas                        |
| POST                    | `/kunas-pms/connect`                                                    | SESSION       | Conectar Kunas                           |
| PATCH                   | `/kunas-pms/configuration`                                              | SESSION       | Actualizar credenciales                  |
| PATCH, DELETE           | `/integrations/{id}`                                                    | SESSION       | Estado/desconexión                       |
| GET                     | `/billing/balance`                                                      | SESSION       | Saldo                                    |
| GET                     | `/billing/packages`                                                     | SESSION       | Paquetes                                 |
| POST                    | `/billing/checkout`                                                     | SESSION       | Checkout                                 |
| GET                     | `/billing/transactions`                                                 | SESSION       | Transacciones                            |

## 3. Autenticación y cuenta

### 3.1 Solicitar OTP

`POST /auth/login` · `APP`

```json
{
  "email": "usuario@example.com"
}
```

El frontend **no envía contraseña**. Una respuesta `2xx` significa que el OTP fue
solicitado; el cuerpo no es utilizado.

### 3.2 Verificar OTP

`POST /auth/verify-otp` · `APP`

```json
{
  "email": "usuario@example.com",
  "otp": "123456"
}
```

Respuesta tolerada:

```json
{
  "token": "session-token",
  "user": {
    "uuid": "uuid",
    "email": "usuario@example.com",
    "name": "Nombre",
    "clientUuid": "uuid",
    "isAccountOwner": true
  }
}
```

También se toleran `data.token`, `access_token`, `accessToken` y sus variantes
anidadas.

### 3.3 Reenviar OTP

`POST /auth/resend-otp` · `APP`

```json
{
  "email": "usuario@example.com"
}
```

### 3.4 Logout

`POST /auth/logout` · `SESSION` · sin payload.

### 3.5 Registro

`POST /account/register` · `APP`

```json
{
  "personTypeId": 1,
  "name": "Juan",
  "lastname": "Pérez",
  "email": "juan@example.com",
  "phone": "+573001234567",
  "countryId": 48,
  "state": "Cundinamarca",
  "city": "Bogotá",
  "identificationTypeId": 5,
  "identificationNumber": "123456789"
}
```

Para empresa (`personTypeId = 2`), `name` contiene la razón social y `lastname`
se omite. El frontend actual no envía contraseña ni confirmación de contraseña.

### 3.6 Cliente

`GET /clients/{clientUuid}` · `SESSION`

Campos consumidos: `uuid`, `personTypeId`, `name`, `lastname`,
`identificationTypeId`, `identificationNumber`, `email`, `phone`, `address`,
`addressDetail`, `city`, `state`, `countryId`, `logoUrl`.

`PATCH /clients/{clientUuid}` · `SESSION`

```json
{
  "personTypeId": 1,
  "name": "Juan",
  "lastname": "Pérez",
  "identificationTypeId": 5,
  "identificationNumber": "123456789",
  "phone": "+573001234567",
  "address": "Calle 1",
  "addressDetail": "Apto 2",
  "city": "Bogotá",
  "state": "Cundinamarca",
  "countryId": 48
}
```

El email es inmutable y no se envía. El frontend acepta `200` sin cuerpo.

### 3.7 Logo

`POST /clients/{clientUuid}/logo` · `SESSION` · `multipart/form-data`

| Campo  | Tipo    |
| ------ | ------- |
| `logo` | archivo |

Respuesta consumida:

```json
{
  "logoUrl": "https://..."
}
```

`DELETE /clients/{clientUuid}/logo` · `SESSION` · sin payload. La operación se
considera idempotente.

### 3.8 Transferir titularidad

`POST /clients/{clientUuid}/transfer-ownership` · `SESSION`

```json
{
  "user_uuid": "uuid-del-nuevo-titular"
}
```

Solo el titular actual debe poder ejecutar esta acción.

## 4. Usuarios de equipo

### 4.1 Listar

`GET /users?name[has]={texto}` · `SESSION`

El filtro es opcional. La respuesta puede ser un array o un paginado `{data}`.

### 4.2 Crear

`POST /users` · `SESSION`

```json
{
  "client_uuid": "uuid-cliente",
  "name": "Operador",
  "email": "operador@example.com",
  "password": "secreto",
  "role": "property_staff"
}
```

Roles enviados: `property_manager`, `property_staff`, `read_only`.

### 4.3 Eliminar

`DELETE /users/{userUuid}` · `SESSION` · sin payload.

El frontend no tiene edición de usuario conectada actualmente.

## 5. Catálogos y países

### 5.1 Catálogo por nombre

`GET /catalogs` · `APP`

Query exacta:

```text
status[eq]=ACT
catalogCategoryName[eq]={categoryName}
```

Categorías consumidas:

- `person_type`
- `identification_type`
- `status_record`
- `room_type`
- `amenities`
- `reservation_source`
- `reason_for_trip`
- `gender`
- `property_type`

Respuesta normalizada:

```json
[
  {
    "id": "1",
    "name": "Nombre"
  }
]
```

### 5.2 Catálogo por id

`GET /catalogs?status[eq]=ACT&catalogCategoryId[eq]={id}` · `APP`

Se usa para selects dinámicos declarados por proveedores.

### 5.3 Tipos de identificación por país

`GET /catalogs/identification-types?country={ISO2}` · `APP`

`country` es opcional.

```json
[
  {
    "id": 5,
    "name": "Cédula de ciudadanía",
    "parameters": {
      "requiresBackImage": true,
      "applicableCountries": ["CO"]
    }
  }
]
```

### 5.4 Monedas

`GET /catalogs/category/currencies` · `APP`

Cada elemento debe aportar `code` o `id`, y `name`.

### 5.5 Zonas horarias

`GET /catalogs/category/timezones` · `APP`

El frontend tolera una lista plana o grupos:

```json
[
  {
    "region": "America",
    "timezones": [
      {
        "id": "America/Bogota",
        "name": "America/Bogota"
      }
    ]
  }
]
```

### 5.6 Países

`GET /countries` · `APP` antes del login o `SESSION` en administración.

Filtros opcionales:

- `name[has]`
- `region[has]`
- `subregion[has]`
- `iso2[eq]`
- `iso3[eq]`
- `currency[eq]`

Campos consumidos: `id|uuid`, `name|es_name`, `iso2|kod|code`, `iso3`, `emoji`,
`phonecode|phone_code|calling_code`, `timezones`.

## 6. Propiedades

### 6.1 Listar y detalle

- `GET /properties` · `SESSION`
- `GET /properties/{propertyUuid}` · `SESSION`

La lista puede ser array o `{data: []}`. El detalle puede ser recurso directo o
`{data: recurso}`.

### 6.2 Crear

`POST /properties` · `SESSION`

```json
{
  "name": "Casa Centro",
  "description": "Descripción",
  "email": "host@example.com",
  "phone": "+573001234567",
  "address": "Calle 1 # 2-3",
  "addressDetail": "Piso 2",
  "city": "Bogotá",
  "state": "Cundinamarca",
  "countryId": 48,
  "latitude": "4.71100000",
  "longitude": "-74.07210000",
  "timezone": "America/Bogota",
  "statusRecordId": 6,
  "propertyTypeId": 101,
  "extra": {
    "internal_name": "REF-INTERNA",
    "currency": "COP",
    "communicationsLocale": "es",
    "thumbnailUrl": "https://...",
    "checkIn": "15:00",
    "checkOut": "11:00",
    "cancellationPolicy": "Texto",
    "amenities": [1, 2],
    "wifiDetails": {
      "network": "WiFi",
      "password": "secreto"
    },
    "picturesUrl": ["https://..."],
    "policies": [],
    "roomTypes": []
  },
  "externalPmsIds": [
    {
      "sourcePmsId": 1,
      "externalId": "PMS-123"
    }
  ]
}
```

`automations` es nullable/opcional. El cliente actual lo omite porque el alta no
pregunta al PM qué provider de identidad desea; el backend crea los dos slots
estructurales sin provider. Si en el futuro se envía el array, se usan slugs
canónicos, `statusProviderId` solo `8|10`, y se omite `executionOrder` porque el
servidor renumera: identidad en 1/2 y el resto desde 3 preservando orden relativo.

Los slots de identidad principal y secundarios son obligatorios en existencia,
no en estado: el backend los crea siempre, pero el PM puede activarlos o
desactivarlos. Al activar uno debe seleccionar un provider de verificación.

### 6.3 Actualizar

- `PUT /properties/{propertyUuid}` · `SESSION`: payload completo anterior, sin
  `automations`.
- `PATCH /properties/{propertyUuid}` · `SESSION`: objeto parcial libre, usado
  principalmente para cambios de estado.

### 6.4 Eliminar y restaurar

- `DELETE /properties/{propertyUuid}` · `SESSION` · sin payload.
- `POST /properties/{propertyUuid}/restore` · `SESSION` · `{}`.

### 6.5 Galería

`POST /properties/{propertyUuid}/images` · `SESSION` · `multipart/form-data`

| Campo      | Tipo              | Regla frontend                     |
| ---------- | ----------------- | ---------------------------------- |
| `images[]` | archivo repetible | Máximo 10 por carga, 5 MB cada uno |

Respuesta: propiedad actualizada; la galería se lee en
`extra.picturesUrl|pictures_url`.

`DELETE /properties/{propertyUuid}/images` · `SESSION`

```json
{
  "url": "https://url-exacta-devuelta-por-la-api"
}
```

## 7. Alojamientos/listings

### 7.1 Consultas

- `GET /listings` · `SESSION`
- `GET /properties/{propertyUuid}/listings` · `SESSION`
- `GET /listings/{listingUuid}` · `SESSION`

La ruta anidada es la fuente preferida para filtrar por propiedad.

### 7.2 Crear

`POST /listings` · `SESSION`

El frontend mantiene temporalmente duplicados camelCase/snake_case:

```json
{
  "property_uuid": "uuid-propiedad",
  "propertyUuid": "uuid-propiedad",
  "name": "Apartamento 101",
  "internal_name": "APT-101",
  "internalName": "APT-101",
  "room_type_id": 1,
  "roomTypeId": 1,
  "description": "Descripción",
  "status_record_id": 6,
  "statusRecordId": 6,
  "contact_email": "host@example.com",
  "contactEmail": "host@example.com",
  "contact_name": "Host",
  "contactName": "Host",
  "contact_phone": "+573001234567",
  "contactPhone": "+573001234567",
  "thumbnail_url": "https://...",
  "thumbnailUrl": "https://...",
  "price": 250000,
  "start_price": 250000,
  "extra": {
    "startPrice": 250000,
    "currency": "COP"
  }
}
```

Los campos originales recibidos por el servicio también se conservan mediante
spread; el bloque anterior representa los campos que el servicio garantiza.

### 7.3 Actualizar y eliminar

- `PUT /listings/{listingUuid}` · `SESSION`: mismo payload normalizado, excepto
  que el servicio no agrega explícitamente `property_uuid`.
- `DELETE /listings/{listingUuid}` · `SESSION` · sin payload.

## 8. Automatizaciones de propiedad

Estados: `8 = activa`, `10 = inactiva`.

### 8.1 Listas y detalle

- `GET /properties/{propertyUuid}/automations?includeProvider=true`
- `GET /property-automations`
- `GET /property-automations/{uuid}`
- `GET /providers`

Filtros soportados por el frontend:

| Ruta                           | Query                                                                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `/property-automations`        | `propertyUuid[eq]`, `providerId[eq]`, `guestType[eq]`, `statusProviderId[eq]`, `includeProvider`, `includeProperty`, `page` |
| `/property-automations/{uuid}` | `includeProvider`, `includeUsageRecords`                                                                                    |
| `/providers`                   | `statusProviderId[eq]`, `includeIntegrations`, `country`, `page`                                                            |

`/providers` pagina a 15; el servicio sigue todas las páginas. La UI de
automations filtra por presencia de `parameters.slug`, porque la misma tabla
contiene Integrations sin job del pipeline.

### 8.2 Crear

`POST /property-automations` · `SESSION`

```json
{
  "propertyUuid": "uuid",
  "providerId": 10,
  "name": "Smart Lock Codes",
  "guestType": "all",
  "executionOrder": 4,
  "parameters": {},
  "statusProviderId": 10
}
```

`guestType`: `main_guest`, `secondary_guest` o `all`.

Cuando el provider está disponible para el país pero la propiedad todavía no
tiene la fila, el PM la crea inactiva con este endpoint. Después completa
credenciales y disparadores, y la activa de forma atómica con `/configure`.

### 8.3 Editar y configurar

`PATCH /property-automations/{uuid}` · `SESSION`

```json
{
  "name": "Nombre",
  "guestType": "all",
  "executionOrder": 4,
  "parameters": {},
  "statusProviderId": 8
}
```

Todos los campos son opcionales. `providerId` y `propertyUuid` no se modifican
por esta ruta.

`PATCH /property-automations/{uuid}/configure` · `SESSION`

Activación:

```json
{
  "statusProviderId": 8,
  "providerId": 10,
  "parameters": {}
}
```

Desactivación:

```json
{
  "statusProviderId": 10
}
```

### 8.4 Eliminar y restaurar

- `DELETE /property-automations/{uuid}` · sin payload.
- `POST /property-automations/{uuid}/restore` · `{}`.

### 8.5 Parámetros de proveedores conocidos

TTLock:

```json
{
  "username": "usuario",
  "password": "secreto",
  "client_id": "cliente",
  "client_secret": "secreto-del-cliente",
  "locks": [
    {
      "lock_id": 123,
      "name": "Puerta",
      "type": "unit_entrance"
    }
  ]
}
```

PDF Report:

```json
{
  "recipients": ["ops@example.com"]
}
```

TRA Colombia:

```json
{
  "token": "token",
  "rnt": "12345"
}
```

SIRE Colombia:

```json
{
  "document_type": "CC",
  "document_number": "123",
  "password": "secreto",
  "company_code": "900123456",
  "guest_filter": "foreign_only"
}
```

`company_code` es opcional. `guest_filter` se fuerza a `foreign_only` para SIRE;
el backend todavía no lo valida. Las automations operativas deben guardar al
menos un valor válido en `triggerTypes`, o el despachador las omite en silencio.

Triggers configurables: `on_main_guest_checkin_completed`,
`on_guest_checkin_completed`, `on_checkin_completed`, `at_time_of_day`,
`on_physical_checkout` y `after_automation`. Los eliminados
`on_physical_checkin`, `after_checkin` y `after_checkout` responden 422.
`after_automation` exige hoy un `predecessor_automation_id` entero que el recurso
público no expone; el portal no permite crear esa cadena hasta que exista UUID.

## 9. Overrides por alojamiento

Estados: `6 = activo`, `7 = inactivo`.

### 9.1 Consultar

- `GET /listings/{listingUuid}/automation-overrides?includePropertyAutomation=1`
- `GET /listing-automation-overrides/{uuid}?includePropertyAutomation=1`

### 9.2 Crear

`POST /listing-automation-overrides` · `SESSION`

```json
{
  "listingUuid": "uuid-listing",
  "propertyAutomationUuid": "uuid-automation",
  "statusRecordId": 6,
  "parameters": {
    "lock_id": 123
  },
  "token": null
}
```

`parameters` y `token` son opcionales.

### 9.3 Actualizar, eliminar y restaurar

`PATCH /listing-automation-overrides/{uuid}`:

```json
{
  "statusRecordId": 7,
  "parameters": {
    "lock_id": null
  },
  "token": null
}
```

Todos los campos son opcionales. Un parámetro `null` solicita limpiarlo.

- `DELETE /listing-automation-overrides/{uuid}` · sin payload.
- `POST /listing-automation-overrides/{uuid}/restore` · `{}`.

## 10. Documentos de propiedad

### 10.1 Tipos y listado

- `GET /property-document-types`
- `GET /properties/{propertyUuid}/documents`

Filtros del listado:

- `propertyDocumentTypeId[eq]`
- `statusRecordId[eq]`
- `uuid[eq]`
- `page`
- `per_page`

La respuesta del listado conserva `{data, meta}` para paginación.

### 10.2 Crear

`POST /properties/{propertyUuid}/documents` · `SESSION`

```json
{
  "propertyDocumentTypeId": 1,
  "statusRecordId": 6,
  "content": "<p>Hola {{guest_first_name}}</p>",
  "reservationSourceId": 16,
  "signatureProviderSlug": "hitguest_signature"
}
```

`content`, `reservationSourceId` y `signatureProviderSlug` son opcionales/null.
Firmas conocidas: `hitguest_signature`, `tufirma`.

### 10.3 Consultar, editar, eliminar y restaurar

- `GET /properties/{propertyUuid}/documents/{documentUuid}`
- `PATCH /properties/{propertyUuid}/documents/{documentUuid}`: payload parcial
  del bloque de creación.
- `DELETE /properties/{propertyUuid}/documents/{documentUuid}`
- `POST /properties/{propertyUuid}/documents/{documentUuid}/restore`

### 10.4 Render administrativo

- `GET /reservations/{reservationUuid}/documents/{documentUuid}/render`
  devuelve `{uuid, rendered}`.
- `GET /reservations/{reservationUuid}/documents/{documentUuid}/pdf` devuelve
  `application/pdf`.

Ambos requieren sesión.

## 11. Reservas

### 11.1 Listar y consultar

- `GET /reservations`
- `GET /reservations/{reservationUuid}`

Campos consumidos:

```json
{
  "uuid": "uuid",
  "arrivalDate": "2026-07-23",
  "departureDate": "2026-07-25",
  "emailGuest": "guest@example.com",
  "totalGuests": 2,
  "totalPrice": 500000,
  "currency": "COP",
  "externalId": "MANUAL-ABC123",
  "extra": {
    "guestName": "Nombre",
    "guestPhone": "+57300..."
  },
  "listing": {},
  "source": {},
  "statusReservation": {},
  "isCheckinCompleted": false
}
```

Se toleran variantes snake_case. `arrivalDate` y `departureDate` son fechas de
calendario `YYYY-MM-DD`, no timestamps.

### 11.2 Crear o actualizar

- `POST /reservations`
- `PUT /reservations/{reservationUuid}`

Payload exacto construido por el formulario:

```json
{
  "listingUuid": "uuid-listing",
  "listing_uuid": "uuid-listing",
  "listingId": "uuid-listing",
  "listing_id": "uuid-listing",
  "reservationSourceId": 16,
  "externalId": "MANUAL-ABC123",
  "arrivalDate": "2026-07-23",
  "departureDate": "2026-07-25",
  "emailGuest": "guest@example.com",
  "totalGuests": 2,
  "currency": "COP",
  "totalPrice": 500000,
  "extra": {
    "guest_name": "Nombre Apellido",
    "guest_country": "CO",
    "guest_phone": "+573001234567"
  },
  "statusReservationId": 27
}
```

`statusReservationId = 27` representa Confirmada. La opción visual
`sendLinkNow` no se incluye actualmente en este payload.

### 11.3 Eliminar

`DELETE /reservations/{reservationUuid}` · `SESSION` · sin payload.

### 11.4 Enviar link de check-in

`POST /reservations/{reservationUuid}/send-checkin-link` · `SESSION`

```json
{
  "locale": "es",
  "email": "destino@example.com"
}
```

Ambos campos son opcionales. Sin `locale`, el backend usa el idioma de la
propiedad; sin `email`, usa el email principal de la reserva.

Respuesta:

```json
{
  "message": "Link de check-in enviado"
}
```

### 11.5 Huéspedes y documentos de identidad

`GET /reservations/{reservationUuid}/guests` · `SESSION`

El frontend consume variantes v4.6:

```json
[
  {
    "guestProfile": {
      "uuid": "uuid",
      "name": "Nombre",
      "lastname": "Apellido",
      "identificationNumber": "123"
    },
    "reservationSpecificData": {
      "documentImages": {
        "front": "https://...",
        "back": "https://..."
      }
    },
    "isCompleted": true,
    "isMainGuest": true
  }
]
```

Las URLs de imagen retornadas se consultan luego con `GET {url_retornada}` y
header Bearer; no existe una ruta fija construida por el frontend.

## 12. Estado, historial y despacho de automatizaciones

### 12.1 Estado vivo

`GET /reservations/{reservationUuid}/automation-status` · `SESSION`

```json
[
  {
    "automationUuid": "uuid",
    "automationName": "Identity Verification",
    "providerSlug": "didit",
    "status": "not_started",
    "lastError": null,
    "lastRunAt": null,
    "usageRecordId": null,
    "contractPdfPath": null,
    "wasSuccessful": false,
    "lastSuccessAt": null,
    "requiresCheckin": "reservation",
    "redispatchRequiresCheckin": null,
    "canManualDispatch": true,
    "reservationCheckinCompleted": false,
    "mainGuestCheckinCompleted": false,
    "canDispatch": false,
    "canRedispatch": false
  }
]
```

Estados: `not_started`, `pending`, `completed`, `failed`.
`canDispatch` y `canRedispatch` son autoritativos; si faltan, el cliente asume
`false` y no infiere permisos a partir del estado.

### 12.2 Historial y consumo

`GET /reservations/{reservationUuid}/automation-records?automationUuid={uuid}`

El filtro es opcional.

```json
[
  {
    "id": 1,
    "status": "completed",
    "triggeredBy": "manual_dispatch",
    "automationUuid": "uuid",
    "automationName": "Nombre",
    "providerSlug": "didit",
    "guestUuid": "uuid",
    "billable": true,
    "unitCost": "0.8500",
    "lastError": null,
    "responsePayload": {},
    "createdAt": "2026-07-23 10:00:00",
    "updatedAt": "2026-07-23 10:00:01"
  }
]
```

### 12.3 Acciones manuales

Todas usan `POST`, `SESSION` y payload `{}`:

- `/reservations/{reservationUuid}/automation-records/{recordId}/redispatch`
- `/reservations/{reservationUuid}/property-automations/{automationUuid}/dispatch`
- `/reservations/{reservationUuid}/property-automations/{automationUuid}/resend-pdf`

`dispatch` es solo para una automation que nunca corrió; `redispatch`, para el
último registro fallido. `resend-pdf` funciona sin importar el estado anterior,
exige check-in de reserva completo y crea un consumo nuevo, por lo que la UI pide
confirmación explícita.

Respuesta esperada:

```json
{
  "message": "Acción encolada"
}
```

## 13. Portal de check-in

Todos los endpoints de esta sección usan `APP`, salvo el contrato firmado
marcado como público.

### 13.1 Obtener portal

`GET /checkin/{reservationUuid}`

```json
{
  "reservation": {
    "uuid": "uuid",
    "arrivalDate": "2026-07-23",
    "departureDate": "2026-07-25",
    "totalGuestsAllowed": 2,
    "checkinAllowed": true
  },
  "progress": {
    "registered": 1,
    "completed": 0,
    "isFullyCompleted": false
  },
  "registeredGuests": [
    {
      "uuid": "uuid",
      "name": "Nombre",
      "lastname": "Apellido",
      "isMain": true,
      "isCompleted": false,
      "verification": {
        "status": "pending",
        "currentStep": "verification",
        "verifiedAt": null
      }
    }
  ],
  "documents": [
    {
      "uuid": "uuid",
      "type": "Agreement",
      "renderUrl": "/api/v1/checkin/.../render",
      "pdfUrl": "/api/v1/checkin/.../pdf"
    }
  ],
  "contract": {
    "signingProvider": "hitguest_signature",
    "status": "not_started",
    "hasNativeSignature": false
  }
}
```

Reservas canceladas/eliminadas pueden responder solo `portalStatus` y `message`.

### 13.2 Identificar huésped

`POST /checkin/{reservationUuid}/identify`

El servicio envía simultáneamente camelCase y snake_case:

```json
{
  "identificationTypeId": 5,
  "identificationNumber": "123456789",
  "nationalityId": 48,
  "name": "Nombre",
  "lastname": "Apellido",
  "isMainGuest": true,
  "nationality_id": 48,
  "identification_type_id": 5,
  "identification_number": "123456789",
  "is_main_guest": true
}
```

Respuesta:

```json
{
  "guest": {
    "uuid": "uuid",
    "name": "Nombre",
    "lastname": "Apellido"
  },
  "reservationGuest": {
    "isMainGuest": true,
    "isCheckinCompleted": false
  },
  "verification": {
    "type": "session",
    "sessionType": "biometric",
    "url": "https://..."
  },
  "formSchema": {
    "required_fields": [],
    "optional_fields": [],
    "prefilledData": {},
    "user_fields": []
  }
}
```

Directivas actuales: `session`, `document_upload`, `contact_challenge`.

### 13.3 Esquema de formulario

`GET /checkin/{reservationUuid}/form/{guestUuid}`

```json
{
  "formSchema": {
    "required_fields": ["country_of_origin_id"],
    "optional_fields": ["city_of_origin"],
    "prefilledData": {},
    "user_fields": [
      {
        "key": "purpose_of_travel",
        "type": "select",
        "required": true,
        "catalog_category_id": 8,
        "label": "Motivo del viaje"
      }
    ]
  }
}
```

### 13.4 Resultado de verificación

`GET /checkin/{reservationUuid}/verify/result`

Query:

- `guest_uuid` obligatorio.

El tracker vigente no declara `session_id` para este endpoint. La sesión exacta
se usa únicamente en `/checkin/didit/session/{sessionId}/context`; el polling se
resuelve por el vínculo reserva + huésped.

Respuesta del backend:

```json
{
  "verification": {
    "status": "pending",
    "currentStep": "verification",
    "verifiedAt": null,
    "sessionType": "kyc",
    "startedAt": "2026-08-12T10:00:00Z",
    "expiresAt": "2026-08-12T10:15:00Z",
    "isStale": false,
    "verificationUrl": "https://verify.didit.me/..."
  }
}
```

El frontend normaliza esa máquina a `verified`, `kyc_required`,
`restart_required`, `contact_challenge`, `failed`, `stale` o `pending`.
La escalada se detecta por `sessionType: "kyc"`; `pass` no es éxito ni señal
suficiente para escalar. `isStale` es la única señal para abandonar la espera:
el frontend no aplica un timeout propio.

### 13.5 Firma nativa

`POST /checkin/{reservationUuid}/main/sign`

```json
{
  "guestUuid": "uuid",
  "documentUuid": "uuid-contrato",
  "signatureImage": "data:image/png;base64,..."
}
```

```json
{
  "message": "Firma guardada",
  "attempt": 1,
  "signedAt": "2026-07-23T10:00:00Z"
}
```

### 13.6 Completar huésped principal

`POST /checkin/{reservationUuid}/main/complete`

```json
{
  "guestUuid": "uuid",
  "profile": {
    "name": "Nombre",
    "lastname": "Apellido",
    "email": "guest@example.com",
    "phone": "+57300...",
    "dateOfBirth": "1990-01-01",
    "genderId": 114,
    "nationalityId": 48,
    "cityOfResidence": "Bogotá",
    "countryOfResidenceId": 48,
    "identificationExpiryDate": "2030-01-01"
  },
  "extra": {
    "countryOfOriginId": 48,
    "countryDestinationId": 48,
    "cityOfOrigin": "Medellín",
    "reasonForTripId": 1,
    "documentImage1": "https://...",
    "documentImage2": "https://...",
    "purpose_of_travel": 1
  }
}
```

Las claves dinámicas declaradas por `user_fields` (por ejemplo,
`purpose_of_travel`) se expanden directamente dentro de `extra`.

Respuesta:

```json
{
  "message": "Check-in actualizado",
  "status": "completed"
}
```

`status` también puede ser `pending_signature`.

### 13.7 Completar acompañante

`POST /checkin/{reservationUuid}/secondary/{guestUuid}/complete`

Payload: los mismos objetos `profile` y `extra` anteriores, sin `guestUuid` en la
raíz. El formulario dedicado de acompañantes también puede agregar:

```json
{
  "extra": {
    "arrivalTime": "15:00",
    "departureTime": "11:00",
    "arrivalFlight": "AV123",
    "departureFlight": "AV456"
  }
}
```

### 13.8 Subir documentos y selfie

`POST /checkin/{reservationUuid}/secondary/{guestUuid}/documents` ·
`multipart/form-data`

| Campo          | Regla                               |
| -------------- | ----------------------------------- |
| `front_image`  | Documento frontal                   |
| `back_image`   | Condicional según tipo de documento |
| `selfie_image` | Requerido                           |

Respuesta:

```json
{
  "extractedData": {
    "name": "Nombre",
    "lastname": "Apellido",
    "identificationNumber": "123",
    "dateOfBirth": "1990-01-01",
    "expirationDate": "2030-01-01"
  },
  "formSchema": {
    "required_fields": [],
    "optional_fields": [],
    "prefilledData": {}
  }
}
```

Errores OCR pueden incluir `errorType` y
`failedFields: [{field, reason, confidence}]`.
`UNSUPPORTED_DOCUMENT_LAYOUT` es reintentable con otro documento y la UI debe
indicar explícitamente que el huésped use su pasaporte. Por tolerancia de
versiones, el cliente también acepta `error_type`.

### 13.9 Documentos del huésped

- `GET /checkin/{reservationUuid}/documents/{documentUuid}/render` devuelve
  `{rendered}` o `{data: {rendered}}`.
- `GET /checkin/{reservationUuid}/documents/{documentUuid}/pdf` devuelve PDF.
- `GET /checkin/{reservationUuid}/contract/signed` devuelve el contrato firmado
  como stream y se abre por navegación directa (`PUBLIC` según el contrato actual).

## 14. Endpoints de check-in legacy

Estos métodos aún existen en el servicio y, por tanto, forman parte del
inventario, pero no deben elegirse para desarrollo nuevo.

| Método | Ruta                                               | Payload/uso                         |
| ------ | -------------------------------------------------- | ----------------------------------- |
| GET    | `/checkin/{sourceSlug}/{listingUuid}/{externalId}` | Resolver reserva por referencia PMS |
| GET    | `/checkin/{uuid}/guest/{guestUuid}/facematch`      | Resultado facial legacy             |
| POST   | `/checkin/{uuid}/s/{guestToken}/guest`             | Payload libre de acompañante legacy |
| GET    | `/checkin/{uuid}/automations`                      | Automatizaciones activas legacy     |

`GET /checkin/{uuid}` también es usado por el wrapper legacy `getReservation`,
pero apunta al mismo portal documentado arriba.

## 15. Integración Kunas PMS

### 15.1 Consultar

`GET /kunas-pms/integration` · `SESSION`

`404` se interpreta como “sin integración”.

```json
{
  "id": 1,
  "userId": 1,
  "providerId": 1,
  "name": "KunasPMS",
  "token": "interno",
  "parameters": {
    "email": "pms@example.com",
    "pmsProperties": []
  },
  "statusProviderId": 8
}
```

### 15.2 Conectar

`POST /kunas-pms/connect`

```json
{
  "token": "provider-token",
  "email": "pms@example.com",
  "password": "secreto",
  "name": "KunasPMS"
}
```

`name` es opcional. La sincronización posterior es asíncrona.

### 15.3 Actualizar configuración

`PATCH /kunas-pms/configuration`

```json
{
  "email": "pms@example.com",
  "password": "nuevo-secreto",
  "token": "token-opcional"
}
```

### 15.4 Activar, desactivar y desconectar

`PATCH /integrations/{id}`

```json
{
  "statusProviderId": 8
}
```

`8 = activa`, `10 = inactiva`.

`DELETE /integrations/{id}` · sin payload; respuesta esperada `204`.

## 16. Billing

> El frontend trata `404` y `501` como “backend de billing todavía no
> configurado”. Estos contratos están implementados como consumidores, pero su
> disponibilidad debe verificarse por ambiente.

### 16.1 Saldo

`GET /billing/balance`

```json
{
  "balance": 25.5,
  "currency": "USD"
}
```

También se tolera `amount`.

### 16.2 Paquetes

`GET /billing/packages`

```json
{
  "packages": [
    {
      "amount": 25,
      "label": "$25",
      "description": "25 USD credits"
    }
  ],
  "minimumCustom": 10,
  "currency": "USD"
}
```

### 16.3 Crear checkout

`POST /billing/checkout`

```json
{
  "amount": 25
}
```

```json
{
  "checkoutUrl": "https://checkout.stripe.com/...",
  "sessionId": "cs_..."
}
```

El frontend navega a `checkoutUrl`; no llama Stripe directamente.

### 16.4 Transacciones

`GET /billing/transactions?page={n}`

```json
{
  "data": [
    {
      "uuid": "uuid",
      "type": "credit",
      "amount": 25,
      "balanceAfter": 30,
      "description": "Recarga",
      "source": "stripe",
      "paymentGateway": "stripe",
      "status": "completed",
      "createdAt": "2026-07-23T10:00:00Z"
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 1,
    "per_page": 15,
    "total": 1,
    "from": 1,
    "to": 1
  }
}
```

## 17. Rutas internas de Next.js

Estas rutas son same-origin y no forman parte del backend Laravel.

### 17.1 BFF de propiedades

`GET /api/bff/properties` · `BFF-SESSION`

- Requiere `Authorization: Bearer {session}` del navegador.
- Reenvía `GET /properties`.
- Respuesta: `{ "data": [...] }`.
- `401` sin token; `502` si falla el backend.

`GET /api/bff/properties/{propertyUuid}/listings` · `BFF-SESSION`

- Reenvía `GET /properties/{propertyUuid}/listings`.
- Respuesta: `{ "data": [...] }`.

`GET /api/bff/properties-with-listings` · `BFF-SESSION`

- Solicita propiedades y luego listings por propiedad en paralelo.
- Agrega `_propertyUuid` a cada listing.

```json
{
  "properties": [],
  "listings": []
}
```

### 17.2 Proxy de catálogos del check-in

`GET /api/checkin/catalogs?category={categoryName}`

- Reenvía `GET /catalogs?status[eq]=ACT&catalogCategoryName[eq]=...`.
- Usa app token configurado en el servidor.
- `400` sin categoría; `500` sin token; `502` sin conexión.

`GET /api/checkin/countries`

Orden de autenticación hacia `/countries`:

1. token Bearer recibido del navegador;
2. app token del servidor;
3. solicitud sin token.

La respuesta del backend se reenvía sin normalizar.

### 17.3 Geocodificación

El modo gratuito nativo no requiere configuración y usa una búsqueda explícita
con OpenStreetMap/Nominatim: el PM completa la dirección y presiona Enter o
`Buscar dirección`. No se consulta por cada tecla porque el servidor público de
Nominatim lo prohíbe.

Configuración comercial opcional:

```env
GEOCODING_PROVIDER=google
GOOGLE_MAPS_API_KEY=...
```

La clave nunca se expone al navegador. Si `GOOGLE_MAPS_API_KEY` existe, Google
se activa aunque `GEOCODING_PROVIDER` no esté definido. Una instancia Nominatim
propia/administrada puede habilitar autocomplete mediante
`GEOCODING_PROVIDER=nominatim` y `NOMINATIM_BASE_URL`.

`GET /api/geocode/autocomplete?q={texto}&session={token}`

- `q` requiere al menos tres caracteres.
- Los prefijos inequívocos de unidad se quitan solo para consultar al proveedor
  (`907/188 ...` → `188 ...`) y se restauran al seleccionar la dirección.
- `session` es opcional pero recomendado para agrupar facturación.
- Respuesta:

```json
{
  "suggestions": [
    {
      "placeId": "ChIJ...",
      "description": "Bogotá, Colombia"
    }
  ]
}
```

Sin proveedor de autocomplete, la consulta automática responde `503` con
`reason: "manual_search_required"` y la UI ofrece la búsqueda gratuita. Esta
envía `mode=search`; los fallos responden con `reason: "provider_error"` y una
búsqueda válida sin coincidencias responde `200` con `suggestions: []`.

El handler llama server-to-server:

`POST https://places.googleapis.com/v1/places:autocomplete`

```json
{
  "input": "Bogotá",
  "languageCode": "es",
  "sessionToken": "token-opcional"
}
```

`GET /api/geocode/details?placeId={id}&session={token}`

```json
{
  "lat": 4.711,
  "lng": -74.0721,
  "formattedAddress": "Bogotá, Colombia",
  "addressLine1": "Carrera 7 72-41",
  "addressLine2": "501",
  "streetNumber": "72-41",
  "streetName": "Carrera 7",
  "city": "Bogotá",
  "suburb": "Chapinero",
  "state": "Bogotá",
  "postalCode": "110221",
  "countryCode": "CO"
}
```

El handler llama:

`GET https://places.googleapis.com/v1/places/{placeId}`

con `languageCode`, `sessionToken` y field mask
`id,formattedAddress,location,addressComponents`.

## 18. Hallazgos de contrato que deben vigilarse

1. El login actual es OTP y solo envía email; cualquier documentación con
   contraseña en `/auth/login` está desactualizada.
2. Propiedades y reservas deben usar exclusivamente token de sesión. No deben
   caer al app token porque son datos multi-tenant.
3. Listings y reservas duplican temporalmente varias claves camel/snake. El
   backend debería definir una forma canónica antes de retirar compatibilidad.
4. `sendLinkNow` existe en UI de reserva, pero no se envía al backend.
5. Billing tolera explícitamente endpoints ausentes (`404/501`).
6. Fechas de reserva son valores `YYYY-MM-DD`; no deben parsearse como
   medianoche UTC.
7. Hay cuatro rutas legacy de check-in todavía expuestas por el servicio.
8. Las imágenes/documentos protegidos se descargan con Bearer como blob; un
   `<img src>` directo no puede enviar ese header.

## 19. Archivos fuente auditados

- `src/lib/api-client.ts`
- `src/lib/server-api.ts`
- `src/features/auth/services/*`
- `src/features/users/services/*`
- `src/features/properties/services/*`
- `src/features/reservations/services/*`
- `src/features/checkin/services/*`
- `src/features/integrations/services/*`
- `src/features/billing/services/*`
- `src/services/countries-service.ts`
- `src/app/api/**/route.ts`
- consumidores directos de `fetch` en componentes
- tipos de request/response de cada feature
