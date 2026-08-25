# Maestro de contratos API recibidos de Ricardo y del backend

> Archivo de trazabilidad contractual. Reúne contratos, payloads, respuestas y
> decisiones de producto preservadas en el repositorio.
>
> Última auditoría: 23 de julio de 2026.

## 1. Cómo leer este documento

Este archivo complementa:

- [`FRONTEND_API_ENDPOINTS.md`](./FRONTEND_API_ENDPOINTS.md): comportamiento
  efectivo del frontend actual;
- [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md): especificación histórica
  amplia;
- los handoffs de check-in v4.0/v4.1.

### 1.1 Evidencia y atribución

Además de los documentos del repositorio, el 23 y 24 de julio de 2026 se
recibieron nueve archivos fuente del backend. Su inventario, hash y
transcripción contractual normalizada están en
[`RICARDO_SOURCE_PLANS_2026-07-23.md`](./RICARDO_SOURCE_PLANS_2026-07-23.md) y
[`RICARDO_SOURCE_PLANS_2026-07-24.md`](./RICARDO_SOURCE_PLANS_2026-07-24.md).
Para el resto del material se usan estas etiquetas:

| Etiqueta             | Significado                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| `RICARDO-EXPLÍCITO`  | El código o documento nombra expresamente a Ricardo como origen de la decisión                 |
| `BACKEND-CONFIRMADO` | El repositorio lo describe como validación, respuesta exacta o contrato confirmado por backend |
| `AS-BUILT`           | Es el contrato que implementa hoy el frontend                                                  |
| `PROPUESTA-FRONTEND` | Fue solicitado o diseñado por frontend; no se atribuye a Ricardo                               |
| `SUPERSEDIDO`        | Existió como contrato anterior, pero fue reemplazado                                           |
| `PENDIENTE`          | Falta confirmación o implementación backend                                                    |
| `FUENTE-ORIGINAL`    | Contrato incluido en uno de los planes originales recibidos el 23 o 24-jul-2026                |

No se atribuye personalmente a Ricardo ningún material que el repositorio solo
identifica como propuesta del frontend.

### 1.2 Orden de precedencia

Cuando dos contratos se contradicen:

1. decisión explícita de julio de 2026;
2. contrato backend v4.1 o posterior;
3. contrato backend v4.0;
4. contrato legacy confirmado;
5. propuesta frontend.

## 2. Índice contractual

| Dominio                     | Estado principal                             | Sección |
| --------------------------- | -------------------------------------------- | ------- |
| Aislamiento multi-tenant    | `BACKEND-CONFIRMADO` jul-2026                | 3       |
| Cuenta, cliente y owner     | `FUENTE-ORIGINAL` / `AS-BUILT`               | 4       |
| Usuarios                    | `FUENTE-ORIGINAL`, con supersesión posterior | 5       |
| Logo de cliente             | `FUENTE-ORIGINAL` / `AS-BUILT`               | 6       |
| Propiedades y listings      | `RICARDO-EXPLÍCITO` / `AS-BUILT`             | 7       |
| Contratos por canal y firma | `RICARDO-EXPLÍCITO`                          | 8       |
| Reservas y link de check-in | `BACKEND-CONFIRMADO` / `AS-BUILT`            | 9       |
| Automatizaciones            | `RICARDO-EXPLÍCITO` / `BACKEND-CONFIRMADO`   | 10      |
| Check-in legacy             | `BACKEND-CONFIRMADO`, supersedido            | 11      |
| Check-in v4.0               | `BACKEND-CONFIRMADO`                         | 12      |
| Check-in v4.1               | `BACKEND-CONFIRMADO`                         | 13      |
| Extensiones v4.2–v4.7       | `AS-BUILT` / contrato backend                | 14      |
| Integración Kunas PMS       | `AS-BUILT`                                   | 15      |
| Billing                     | `FUENTE-ORIGINAL` / `AS-BUILT`               | 16      |
| Propuestas no confirmadas   | `PROPUESTA-FRONTEND`                         | 17      |
| Conflictos y supersesiones  | Mixto                                        | 18      |

### 2.1 Autenticación y registro

Estos contratos aparecen en la documentación general y en la implementación
actual. El repositorio no los atribuye personalmente a Ricardo.

#### Solicitar OTP

```http
POST /auth/login
Authorization: Bearer {appToken}
Content-Type: application/json
```

Payload actual:

```json
{
  "email": "usuario@example.com"
}
```

Una respuesta `2xx` confirma que se solicitó el código. El contrato histórico
que incluía `password` está supersedido por OTP.

#### Verificar OTP

```http
POST /auth/verify-otp
Authorization: Bearer {appToken}
Content-Type: application/json
```

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
    "uuid": "user-uuid",
    "email": "usuario@example.com",
    "name": "Nombre",
    "clientUuid": "client-uuid",
    "isAccountOwner": true
  }
}
```

El token también puede llegar como `data.token`, `access_token`, `accessToken`
o dentro de `user`.

#### Reenviar OTP

```http
POST /auth/resend-otp
Authorization: Bearer {appToken}
Content-Type: application/json
```

```json
{
  "email": "usuario@example.com"
}
```

#### Cerrar sesión

```http
POST /auth/logout
Authorization: Bearer {sessionToken}
```

Sin payload.

#### Registrar cliente/usuario

```http
POST /account/register
Authorization: Bearer {appToken}
Content-Type: application/json
```

Payload actual:

```json
{
  "personTypeId": 1,
  "name": "Juan",
  "lastname": "Pérez",
  "identificationTypeId": 5,
  "identificationNumber": "1234567890",
  "email": "juan@example.com",
  "phone": "+573001234567",
  "countryId": 48,
  "state": "Cundinamarca",
  "city": "Bogotá"
}
```

Para empresa (`personTypeId = 2`), `name` contiene la razón social y `lastname`
se omite.

Contrato histórico más amplio:

```json
{
  "personTypeId": 1,
  "name": "Juan",
  "lastname": "Pérez",
  "identificationTypeId": 5,
  "identificationNumber": "1234567890",
  "email": "juan@example.com",
  "phone": "+573001234567",
  "city": "Bogotá",
  "state": "Cundinamarca",
  "countryId": 48,
  "password": "password123",
  "password_confirmation": "password123"
}
```

`password` y `password_confirmation` ya no son enviados por el frontend OTP.

### 2.2 Catálogos y países

#### Catálogo por nombre

```http
GET /catalogs?status[eq]=ACT&catalogCategoryName[eq]={categoryName}
Authorization: Bearer {appToken}
```

Categorías preservadas:

- `person_type`
- `identification_type`
- `status_record`
- `room_type`
- `amenities`
- `reservation_source`
- `reason_for_trip`
- `gender`
- `property_type`
- `source_pms`
- `cancellation_policy`
- `bed_type` y `bath_type` como catálogos históricos

Respuesta base:

```json
{
  "data": [
    {
      "id": 1,
      "name": "Nombre",
      "description": "Descripción",
      "parameters": {},
      "status": "ACT"
    }
  ]
}
```

#### Catálogo por id

```http
GET /catalogs?status[eq]=ACT&catalogCategoryId[eq]={categoryId}
```

Usado por campos dinámicos de proveedor.

#### Tipos de identificación por país

```http
GET /catalogs/identification-types?country=CO
```

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

#### Monedas y zonas horarias

```http
GET /catalogs/category/currencies
GET /catalogs/category/timezones
```

Respuesta agrupada de zonas horarias tolerada:

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

#### Países

```http
GET /countries
```

Filtros contractuales:

```text
name[has]
region[has]
subregion[has]
iso2[eq]
iso3[eq]
currency[eq]
```

Campos consumidos:

```json
{
  "id": 48,
  "name": "Colombia",
  "iso2": "CO",
  "iso3": "COL",
  "emoji": "🇨🇴",
  "phonecode": "57",
  "timezones": ["America/Bogota"]
}
```

## 3. Aislamiento multi-tenant

**Evidencia:** `BACKEND-CONFIRMADO`, julio de 2026.

### 3.1 Listados

```http
GET /properties
GET /listings
GET /reservations
```

Reglas:

- el controlador filtra obligatoriamente por el dueño del token;
- el frontend no debe aportar un filtro de cuenta para garantizar aislamiento;
- estos endpoints usan exclusivamente token de sesión;
- el app token compartido nunca es fallback para datos de cuenta.

### 3.2 Detalle

```http
GET /properties/{uuid}
GET /listings/{uuid}
GET /reservations/{uuid}
```

El contrato exige `Gate::authorize("view")` y `withinScope()`:

| Caso                          | Estado |
| ----------------------------- | ------ |
| UUID inexistente              | `404`  |
| UUID existente de otra cuenta | `403`  |
| Sesión inválida o expirada    | `401`  |

Un `403` no debe cerrar la sesión. El bug histórico donde
`AuthorizationException` era convertido a `401` fue corregido.

### 3.3 SUPER_ADMIN

**Estado:** `PENDIENTE`.

Decisión de producto registrada: incluso `SUPER_ADMIN` debe ver únicamente sus
propias propiedades, listings y reservas en estos endpoints. No debe recibir
scope global.

## 4. Cuenta, cliente y dueño principal

**Evidencia:** contrato `dueno-principal-cuenta-cliente`, alineado en julio de 2026.

### 4.1 Modelo

El registro crea:

- un `CLIENTE`: cuenta facturable;
- un `USUARIO`: property manager vinculado al cliente.

“Mi cuenta” edita el cliente. “Usuarios” gestiona usuarios del cliente.

### 4.2 Sesión

Contrato histórico de sesión:

```http
GET /user
```

Respuesta exacta documentada:

```json
{
  "uuid": "user-uuid",
  "email": "owner@example.com",
  "client_uuid": "client-uuid",
  "client_name": "Villa Palmeras SAS",
  "name": "Owner",
  "locale": "es",
  "isAccountOwner": true,
  "created_at": "2026-07-01 10:00:00",
  "updated_at": "2026-07-01 10:00:00"
}
```

El frontend actual también acepta estos campos dentro del `user` devuelto por:

```http
POST /auth/verify-otp
```

### 4.3 Obtener cliente

```http
GET /clients/{clientUuid}
Authorization: Bearer {sessionToken}
```

Respuesta contractual `ClientResource` (wrapper `data`):

```json
{
  "data": {
    "uuid": "client-uuid",
    "personTypeId": 1,
    "name": "Nombre o razón social",
    "lastname": "Apellido",
    "identificationTypeId": 5,
    "identificationNumber": "123456789",
    "email": "cuenta@example.com",
    "phone": "+573001234567",
    "address": "Calle 1",
    "addressDetail": "Apto 2",
    "city": "Bogotá",
    "state": "Cundinamarca",
    "countryId": 48,
    "statusRecordId": 6,
    "ownerUserUuid": "user-uuid",
    "logoUrl": "https://..."
  }
}
```

Se tolera camelCase o snake_case. `logoUrl` puede omitirse cuando no existe.

### 4.4 Editar cliente

```http
PATCH /clients/{clientUuid}
Authorization: Bearer {sessionToken}
Content-Type: application/json
```

`PATCH` acepta payload parcial. `PUT` requiere
`personTypeId`, `identificationTypeId`, `identificationNumber`, `email`,
`phone`, `address`, `city`, `state`, `countryId` y `statusRecordId`.

Payload completo posible:

```json
{
  "personTypeId": 1,
  "name": "Nombre",
  "lastname": "Apellido",
  "identificationTypeId": 5,
  "identificationNumber": "123456789",
  "email": "cuenta@example.com",
  "phone": "+573001234567",
  "address": "Calle 1",
  "addressDetail": "Apto 2",
  "city": "Bogotá",
  "state": "Cundinamarca",
  "countryId": 48,
  "statusRecordId": 6
}
```

Reglas:

- en este contrato original `email` sí es editable; el frontend actual lo omite
  por una decisión posterior, registrada como divergencia;
- las compañías (`personTypeId = 2`) pueden omitir `lastname`;
- respuesta exitosa: `200`, incluso sin body.

### 4.5 Transferir titularidad

```http
POST /clients/{clientUuid}/transfer-ownership
Authorization: Bearer {sessionToken}
Content-Type: application/json
```

```json
{
  "user_uuid": "target-user-uuid"
}
```

Reglas:

- solo el owner actual;
- el usuario destino pertenece al mismo cliente;
- el destino pasa a ser owner;
- si el destino no era `property_manager`, el backend le asigna el rol;
- el owner anterior conserva rol `property_manager`, pero deja de ser owner;
- `200`: `ClientResource` con `ownerUserUuid` actualizado;
- `403`: caller no es owner;
- `422`: usuario inválido o regla de protección.

### 4.6 Eliminar cuenta

```http
DELETE /clients/{clientUuid}
```

**Estado del contrato original:** implementado, `204` sin body, solo owner.

El borrado es soft-delete y **no hace cascada**: propiedades, listings,
reservas y automatizaciones permanecen. Después del `204`, el frontend debe
cerrar la sesión. El consumidor actual todavía no conecta esta acción.

### 4.7 Contrato supersedido de `/account`

Estas rutas fueron planteadas antes del contrato de cliente por UUID:

```http
GET /account
PATCH /account
```

Payload propuesto para `PATCH /account`:

```json
{
  "personTypeId": 1,
  "name": "Nombre",
  "lastname": "Apellido",
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

**Estado:** `SUPERSEDIDO` por `GET/PATCH /clients/{uuid}`.

## 5. Usuarios

### 5.1 Decisión de producto

El plan original del backend sí incluía `PATCH/PUT /users/{uuid}`. Una decisión
de producto posterior, atribuida explícitamente a Ricardo, ordenó retirar la
edición de la UI:

- solo crear y eliminar;
- no editar usuario;
- cambiar email representa otra identidad y requeriría OTP de re-verificación;
- solo el owner puede crear otro `property_manager`;
- un usuario no puede eliminarse a sí mismo ni eliminar otro owner.

### 5.2 Listar

```http
GET /users
GET /users?name[has]={texto}
```

Respuesta Laravel paginada:

```json
{
  "data": [
    {
      "uuid": "user-uuid",
      "client_uuid": "client-uuid",
      "name": "Operador",
      "email": "operador@example.com",
      "isAccountOwner": false
    }
  ],
  "links": { "first": "...", "last": "...", "prev": null, "next": null },
  "meta": { "current_page": 1, "last_page": 1, "per_page": 15, "total": 1 }
}
```

**Pendiente backend:** agregar roles al `UserResource`, por ejemplo:

```json
{
  "roles": ["property_staff"]
}
```

### 5.3 Crear

```http
POST /users
Authorization: Bearer {sessionToken}
Content-Type: application/json
```

```json
{
  "client_uuid": "client-uuid",
  "name": "Operador",
  "email": "operador@example.com",
  "password": "secreto",
  "role": "property_staff"
}
```

Roles:

- `property_manager`
- `property_staff`
- `read_only`

El contrato actual crea con contraseña definida por el owner. La invitación por
email sería una funcionalidad nueva.

### 5.4 Eliminar

```http
DELETE /users/{userUuid}
```

Sin payload. Solo owner; soft delete.

- `204`: eliminado;
- `403`: caller no owner o usuario de otra cuenta;
- `422`: intento de autoeliminación:
  `The account owner cannot be deleted. Transfer ownership to another user first.`

### 5.5 Editar

```http
PATCH /users/{userUuid}
```

Contrato original:

```json
{
  "client_uuid": "client-uuid",
  "name": "Nombre opcional",
  "email": "nuevo@example.com",
  "password": "mínimo-8",
  "role": "property_staff"
}
```

`client_uuid` era efectivamente obligatorio incluso con `PATCH`; omitirlo
producía `404`. `200` no tenía body. Cambiar a/desde `property_manager` sin ser
owner producía `403`; el owner intentando quitarse su propio rol producía
`422`. **Estado vigente:** `SUPERSEDIDO/NO CONECTADO` por la decisión posterior
de no editar identidad de usuario desde frontend.

## 6. Logo del cliente

**Evidencia:** contrato de logo, julio de 2026.

### 6.1 Subir o reemplazar

```http
POST /clients/{clientUuid}/logo
Authorization: Bearer {sessionToken}
Accept: application/json
Content-Type: multipart/form-data; boundary=...
```

Multipart:

```text
logo: [File]
```

Reglas:

- PNG o JPEG;
- máximo contractual registrado: 2 MB;
- el browser define el boundary;
- reemplaza el logo anterior.

Respuesta:

```json
{
  "data": {
    "uuid": "client-uuid",
    "logoUrl": "https://..."
  }
}
```

La respuesta contractual es el `ClientResource` completo. El consumidor tolera
formas planas y `logo_url` por compatibilidad, pero no son el contrato original.
El backend redimensiona a máximo 350 px en la dimensión dominante, preservando
proporción y transparencia PNG.

### 6.2 Eliminar

```http
DELETE /clients/{clientUuid}/logo
```

Sin payload. Idempotente; puede responder `200` aunque no existiera logo.
Retorna el `ClientResource` completo sin la clave `logoUrl`.

## 7. Propiedades y listings

### 7.1 Crear propiedad

```http
POST /properties
Authorization: Bearer {sessionToken}
Content-Type: application/json
```

Contrato consolidado:

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
  ],
  "automations": []
}
```

`automations` se usa en creación; update lo omite.

### 7.2 Actualizar y ciclo de vida

```http
GET    /properties
GET    /properties/{propertyUuid}
PUT    /properties/{propertyUuid}
PATCH  /properties/{propertyUuid}
DELETE /properties/{propertyUuid}
POST   /properties/{propertyUuid}/restore
```

`PUT` usa el payload completo sin `automations`; `PATCH` acepta campos parciales;
restore usa `{}`.

### 7.3 Imágenes

```http
POST /properties/{propertyUuid}/images
```

Multipart:

```text
images[]: [File]
images[]: [File]
```

Contrato original: máximo 10 por request y 5 MB cada una. La carga **anexa** las
imágenes a `extra.picturesUrl`; no reemplaza las existentes. `200` retorna el
`PropertyResource` completo actualizado.

```http
DELETE /properties/{propertyUuid}/images
Content-Type: application/json
```

```json
{
  "url": "https://url-exacta-retornada-por-el-backend"
}
```

La URL debe coincidir exactamente con un elemento de `extra.picturesUrl`.
Eliminar una URL externa solo la retira del arreglo; el backend no borra
almacenamiento externo. No hay endpoint de reordenamiento ni garantía de orden.

### 7.4 Listar listings por propiedad

**Evidencia:** `RICARDO-EXPLÍCITO`, julio de 2026.

Ruta canónica:

```http
GET /properties/{propertyUuid}/listings
```

La forma anterior:

```http
GET /listings?property_uuid={propertyUuid}
```

es inválida para el módulo de búsqueda y llegó a devolver listings de todas las
propiedades. La variante plana válida registrada es:

```http
GET /listings?propertyUuid[eq]={propertyUuid}
```

### 7.5 Crear listing

```http
POST /listings
```

Payload de compatibilidad:

```json
{
  "property_uuid": "property-uuid",
  "propertyUuid": "property-uuid",
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
    "picturesUrl": ["https://..."],
    "bedRoom": 2,
    "bathRoom": 1,
    "rooms": 2,
    "startPrice": 250000,
    "currency": "COP",
    "maxOccupancy": 4,
    "minNights": 2,
    "maxNights": 30,
    "checkIn": "15:00",
    "checkOut": "11:00",
    "cancellationPolicy": "Estricta",
    "amenities": [46, 50],
    "wifiDetails": {
      "network": "WiFi",
      "password": "secreto"
    }
  },
  "externalPmsIds": [
    {
      "sourcePmsId": 100,
      "externalId": "1476977613990701381"
    }
  ]
}
```

Contrato histórico de herencia:

- si `extra.checkIn`, `checkOut`, `cancellationPolicy`, `amenities` o
  `wifiDetails` no se envían, el listing hereda el valor de la propiedad;
- si se envían, reemplazan el valor heredado para ese listing.

También existen:

```http
GET    /listings
GET    /listings/{listingUuid}
PUT    /listings/{listingUuid}
DELETE /listings/{listingUuid}
```

## 8. Contratos por canal y método de firma

**Evidencia:** `RICARDO-EXPLÍCITO`, julio de 2026.

### 8.1 Reglas de producto

1. Un contrato pertenece a un canal: Airbnb, Directo, etc.
2. Máximo un contrato activo por canal.
3. Cada contrato define su método de firma.
4. Métodos aceptados:
   - `hitguest_signature`
   - `tufirma`
5. “Firma Digital” deja de ser un nodo independiente: la firma es atributo del
   contrato.
6. Una reserva nunca debe recibir dos contratos para el mismo canal.

### 8.2 Crear documento/contrato

```http
POST /properties/{propertyUuid}/documents
```

```json
{
  "propertyDocumentTypeId": 1,
  "statusRecordId": 6,
  "content": "<p>Hola {{guest_first_name}}</p>",
  "reservationSourceId": 16,
  "signatureProviderSlug": "hitguest_signature"
}
```

Los campos específicos de contrato son:

| Campo                   | Tipo         | Regla                                   |
| ----------------------- | ------------ | --------------------------------------- |
| `reservationSourceId`   | integer/null | Canal del catálogo `reservation_source` |
| `signatureProviderSlug` | string/null  | `hitguest_signature` o `tufirma`        |

### 8.3 Actualizar

```http
PATCH /properties/{propertyUuid}/documents/{documentUuid}
```

Payload parcial:

```json
{
  "statusRecordId": 6,
  "content": "<p>Contenido actualizado</p>",
  "reservationSourceId": 22,
  "signatureProviderSlug": "tufirma"
}
```

### 8.4 Consultas y ciclo de vida

```http
GET    /property-document-types
GET    /properties/{propertyUuid}/documents
GET    /properties/{propertyUuid}/documents/{documentUuid}
DELETE /properties/{propertyUuid}/documents/{documentUuid}
POST   /properties/{propertyUuid}/documents/{documentUuid}/restore
```

Respuesta de documento:

```json
{
  "uuid": "document-uuid",
  "propertyUuid": "property-uuid",
  "documentType": {
    "id": 1,
    "name": "Agreement",
    "parameters": {
      "shortcodes": ["guest_first_name", "property_name"]
    }
  },
  "content": "<p>...</p>",
  "statusRecord": {
    "id": 6,
    "name": "Activo"
  },
  "reservationSourceId": 16,
  "signatureProviderSlug": "hitguest_signature",
  "deletedAt": null
}
```

El frontend tolera `reservation_source_id` y `signature_provider_slug`.

### 8.5 Pendiente contractual

Falta definir el payload exacto de la automatización “Contratos” para elegir
contratos activos aplicables. La documentación propone que nunca puedan
seleccionarse dos contratos para una misma fuente.

## 9. Reservas y envío de link

### 9.1 Crear/actualizar reserva

```http
POST /reservations
PUT  /reservations/{reservationUuid}
```

Payload implementado:

```json
{
  "listingUuid": "listing-uuid",
  "listing_uuid": "listing-uuid",
  "listingId": "listing-uuid",
  "listing_id": "listing-uuid",
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

Las fechas son valores de calendario `YYYY-MM-DD`.

### 9.2 Consultas y ciclo de vida

```http
GET    /reservations
GET    /reservations/{reservationUuid}
PATCH  /reservations/{reservationUuid}
DELETE /reservations/{reservationUuid}
POST   /reservations/{reservationUuid}/restore
```

`PATCH` aparece en el contrato histórico como actualización parcial; el servicio
frontend actual usa `PUT`.

Restore está documentado históricamente, aunque no tiene consumidor actual en
el servicio.

### 9.3 Idioma de comunicaciones

Propiedad:

```json
{
  "extra": {
    "communicationsLocale": "es"
  }
}
```

Valores: `es`, `en`, `pt`.

Detalle de reserva confirmado:

```json
{
  "listing": {
    "communicationsLocale": "es"
  }
}
```

### 9.4 Enviar o reenviar link

```http
POST /reservations/{reservationUuid}/send-checkin-link
Authorization: Bearer {sessionToken}
Content-Type: application/json
```

Payload completamente opcional:

```json
{
  "locale": "es",
  "email": "huesped@example.com"
}
```

Reglas:

- sin `locale`: usa idioma de la propiedad;
- sin `email`: usa email del huésped principal;
- el override aplica solo a ese envío;
- `422`: estado inválido o reserva sin email;
- el envío automático usa defaults de propiedad/reserva.

Respuesta:

```json
{
  "message": "Link de check-in enviado"
}
```

## 10. Automatizaciones

### 10.1 Modelo y estados

Estados de provider:

- `8`: activo;
- `10`: inactivo.

Tipos de huésped:

- `main_guest`
- `secondary_guest`
- `all`

### 10.2 Crear

```http
POST /property-automations
```

```json
{
  "propertyUuid": "property-uuid",
  "providerId": 10,
  "name": "Smart Lock Codes",
  "guestType": "all",
  "executionOrder": 4,
  "parameters": {},
  "statusProviderId": 8
}
```

### 10.3 Actualizar y configurar

```http
PATCH /property-automations/{automationUuid}
```

```json
{
  "name": "Nombre",
  "guestType": "all",
  "executionOrder": 4,
  "parameters": {},
  "statusProviderId": 8
}
```

```http
PATCH /property-automations/{automationUuid}/configure
```

Activar:

```json
{
  "statusProviderId": 8,
  "providerId": 10,
  "parameters": {}
}
```

Desactivar:

```json
{
  "statusProviderId": 10
}
```

### 10.4 Consultar y ciclo de vida

```http
GET    /properties/{propertyUuid}/automations
GET    /property-automations
GET    /property-automations/{automationUuid}
DELETE /property-automations/{automationUuid}
POST   /property-automations/{automationUuid}/restore
GET    /providers
```

### 10.5 Parámetros conocidos

Parámetros universales opcionales:

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

`guest_filter`: `all|foreign_only|national_only`.

TTLock:

```json
{
  "username": "usuario",
  "password": "secreto",
  "locks": [
    {
      "lock_id": 123,
      "name": "Puerta",
      "type": "unit_entrance"
    }
  ]
}
```

`locks` requiere al menos un elemento. `locks[].type`:
`unit_entrance|building_entrance|amenity`. `client_id` y `client_secret` son
configuración interna HIT y **no** se envían.

PDF Report:

```json
{
  "recipients": ["ops@example.com"]
}
```

TRA:

```json
{
  "token": "token",
  "rnt": "12345"
}
```

SIRE:

```json
{
  "document_type": "CC",
  "document_number": "123",
  "password": "secreto",
  "company_code": "900123456"
}
```

Matriz por `executionOrder`:

| Orden | Automatización        | Provider `path`      | Parámetros del PM                 |
| ----- | --------------------- | -------------------- | --------------------------------- |
| 1     | Identidad principal   | `didit` o `textract` | ninguno                           |
| 2     | Identidad secundarios | `didit` o `textract` | ninguno                           |
| 3     | Contrato digital      | `tufirma`            | ninguno; no desactivable          |
| 4     | Smart locks           | `ttlock`             | `username`, `password`, `locks[]` |
| 5     | Reporte PDF           | `pdf-report`         | `recipients[]`                    |
| 6     | TRA Colombia          | `tra-colombia`       | `token`, `rnt`                    |
| 7     | SIRE check-in         | `sire-colombia`      | credenciales SIRE                 |
| 8     | SIRE check-out        | `sire-colombia`      | credenciales SIRE independientes  |

Al activar una verificación de identidad de orden 1 o 2 se desactiva cualquier
otra activa del mismo `guestType`.

### 10.6 Overrides por listing

Crear:

```http
POST /listing-automation-overrides
```

```json
{
  "listingUuid": "listing-uuid",
  "propertyAutomationUuid": "automation-uuid",
  "statusRecordId": 6,
  "parameters": {
    "lock_id": 123
  },
  "token": null
}
```

Editar:

```http
PATCH /listing-automation-overrides/{overrideUuid}
```

```json
{
  "statusRecordId": 7,
  "parameters": {
    "lock_id": null
  },
  "token": null
}
```

Consultar y ciclo de vida:

```http
GET    /listings/{listingUuid}/automation-overrides?includePropertyAutomation=1
GET    /listing-automation-overrides/{overrideUuid}?includePropertyAutomation=1
DELETE /listing-automation-overrides/{overrideUuid}
POST   /listing-automation-overrides/{overrideUuid}/restore
```

### 10.7 Estado vivo

```http
GET /reservations/{reservationUuid}/automation-status
```

Contrato fuente (`data` wrapper):

```json
{
  "data": [
    {
      "automationUuid": "uuid",
      "automationName": "TRA Colombia",
      "providerSlug": "tra_colombia",
      "status": "failed",
      "lastError": "Detalle",
      "lastRunAt": "2026-07-23 10:00:00",
      "usageRecordId": 12,
      "wasSuccessful": true,
      "lastSuccessAt": "2026-07-22 10:00:00",
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

Estados: `not_started`, `pending`, `completed`, `failed`.
Los timestamps están en `America/Bogota` y el orden es `execution_order`.

### 10.8 Acciones manuales

**Evidencia:** `RICARDO-EXPLÍCITO`, julio de 2026.

Solo pueden mostrar acciones manuales:

- TRA;
- SIRE check-in;
- SIRE check-out;
- Guest Report PDF.

No muestran “Disparar/Reintentar”:

- identidad;
- firma;
- TTLock;
- instrucciones de acceso.

Endpoints con payload `{}`:

```http
POST /reservations/{reservationUuid}/automation-records/{recordId}/redispatch
POST /reservations/{reservationUuid}/property-automations/{automationUuid}/dispatch
POST /reservations/{reservationUuid}/property-automations/{automationUuid}/resend-pdf
```

Respuestas `202`:

```json
{
  "message": "Automation dispatched successfully."
}
```

Redispatch usa `Automation re-dispatched successfully.`. Los errores de negocio
son `422`; el cooldown de 5 minutos responde `429` sin `Retry-After` ni segundos
restantes. Los mensajes ya vienen traducidos según `X-Locale`.

### 10.9 Historial

```http
GET /reservations/{reservationUuid}/automation-records
GET /reservations/{reservationUuid}/automation-records?automationUuid={uuid}
```

```json
{
  "data": [
    {
      "id": 1,
      "status": "completed",
      "triggeredBy": "manual_dispatch",
      "automationUuid": "uuid",
      "automationName": "TRA Colombia",
      "providerSlug": "tra_colombia",
      "guestUuid": "uuid",
      "billable": true,
      "unitCost": "0.8500",
      "lastError": null,
      "responsePayload": {},
      "createdAt": "2026-07-23 10:00:00",
      "updatedAt": "2026-07-23 10:00:01"
    }
  ]
}
```

No está paginado y ordena del más reciente al más antiguo. `triggeredBy`:
`on_checkin_completed`, `on_main_guest_checkin_completed`,
`on_guest_checkin_completed`, `after_automation`, `manual_dispatch`,
`manual_redispatch` o `manual_resend`. `lastError` puede ser
`{message,httpStatus,httpBody}`. Las automatizaciones de secundarios son
automáticas: aparecen en historial con `guestUuid`, pero no ofrecen acciones
manuales.

### 10.10 Contrato histórico de automatizaciones anidadas

Antes de los endpoints UUID-only de `/property-automations`, la documentación
definía:

```http
GET    /properties/{propertyUuid}/automations
POST   /properties/{propertyUuid}/automations
PUT    /properties/{propertyUuid}/automations/{automationId}
PATCH  /properties/{propertyUuid}/automations/{automationId}
DELETE /properties/{propertyUuid}/automations/{automationId}
```

Crear/actualizar:

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

Toggle:

```json
{
  "isActive": false
}
```

`guestFilter`: `all`, `foreign_only`, `national_only`.

**Estado:** contrato histórico supersedido por `/property-automations` con UUID,
`statusProviderId`, `guestType` y `executionOrder`.

### 10.11 Contrato histórico de overrides anidados

La primera especificación usaba:

```http
GET    /listings/{listingUuid}/automation-overrides
GET    /listings/{listingUuid}/automation-overrides/{overrideUuid}
POST   /listings/{listingUuid}/automation-overrides
PUT    /listings/{listingUuid}/automation-overrides/{overrideUuid}
DELETE /listings/{listingUuid}/automation-overrides/{overrideUuid}
POST   /listings/{listingUuid}/automation-overrides/{overrideUuid}/restore
```

Crear:

```json
{
  "propertyAutomationUuid": "automation-uuid",
  "statusProviderId": 6,
  "token": "optional_custom_token",
  "parameters": {
    "token": "override_token",
    "rnt": "654321"
  }
}
```

Actualizar:

```json
{
  "statusProviderId": 7,
  "token": "new_token_value",
  "parameters": {
    "token": "nuevo_token",
    "rnt": "999999"
  }
}
```

Reglas históricas:

- shallow merge de `parameters`;
- `propertyAutomationUuid` inmutable;
- token interno autogenerado si el provider tenía `internalUse`;
- soft delete y restore.

**Estado:** supersedido por el contrato top-level
`/listing-automation-overrides`, que lleva `listingUuid` en el body y usa
`statusRecordId`.

## 11. Check-in legacy confirmado

**Evidencia:** `BACKEND-CONFIRMADO`.

Este fue el primer contrato validado de check-in. Se conserva por trazabilidad,
pero su POST fue supersedido por v4.1.

### 11.1 Portal

```http
GET /api/v1/checkin/{reservationUuid}
GET /api/v1/checkin/{sourceSlug}/{listingUuid}/{externalId}
```

Respuesta esperada en esa versión:

```json
{
  "success": true,
  "data": {
    "uuid": "reservation-uuid",
    "listingId": 45,
    "listingName": "Unidad 201",
    "propertyName": "Apartamentos Centro",
    "propertyLocation": "Cali, Colombia",
    "arrivalDate": "2026-05-15",
    "departureDate": "2026-05-20",
    "totalGuests": 2,
    "totalPrice": 750.5,
    "currency": "USD",
    "emailGuest": "guest@example.com",
    "guestName": "Ricardo",
    "statusReservationId": 27,
    "reservationSourceId": 22,
    "extra": {
      "specialRequests": "Cuna",
      "estimatedArrivalTime": "14:30"
    }
  }
}
```

### 11.2 Guardar huésped

```http
POST /api/v1/checkin/{reservationUuid}/guest
```

Payload principal:

```json
{
  "name": "Ricardo",
  "lastname": "Lombana",
  "identification_type_id": 7,
  "identificacion_number": "1234567890",
  "date_of_birth": "1990-05-15",
  "email": "guest@example.com",
  "phone": "+57 300 123 4567",
  "nationality_id": 48,
  "gender_id": 114,
  "is_main_guest": true,
  "extra": {
    "document_country_id": 48,
    "country_of_origin_id": 48,
    "country_destination_id": 48,
    "city_of_residence": "Bogotá",
    "country_of_residence_id": 48,
    "city_destination": "Cali",
    "reason_for_trip_id": 31,
    "arrival_time": "14:30",
    "departure_time": "11:00",
    "arrival_flight": "AV123",
    "departure_flight": "AV456",
    "document_image_1": "base64_o_url",
    "document_image_2": "base64_o_url"
  }
}
```

Nota histórica: `identificacion_number` usa “c” en español.

Payload acompañante:

```json
{
  "name": "Ana",
  "lastname": "Gómez",
  "identification_type_id": 9,
  "identificacion_number": "AB1234567",
  "date_of_birth": "1992-08-20",
  "email": "ana@example.com",
  "phone": "+57 315 999 8888",
  "nationality_id": null,
  "gender_id": 113,
  "is_main_guest": false,
  "extra": {
    "document_country_id": 48,
    "reason_for_trip_id": 31,
    "document_image_1": "base64_o_url",
    "document_image_2": null
  }
}
```

Respuesta histórica esperada:

```json
{
  "success": true,
  "data": {
    "guestId": 123,
    "guestUuid": "guest-uuid",
    "reservationGuestId": 456
  }
}
```

## 12. Check-in v4.0 confirmado

### 12.1 Portal

```http
GET /api/v1/checkin/{reservationUuid}
```

Respuesta real documentada:

```json
{
  "reservation": {
    "uuid": "reservation-uuid",
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
      "uuid": "guest-uuid",
      "name": "Ricardo",
      "lastname": "Lombana",
      "isMain": true,
      "isCompleted": false
    }
  ]
}
```

### 12.2 Identificar

```http
POST /api/v1/checkin/{reservationUuid}/identify
```

Payload backend:

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

Validaciones:

- `identificationTypeId`: integer, catálogo categoría 2;
- `identificationNumber`: string, máximo 30;
- `nationalityId`: país existente;
- `name`: máximo 120;
- `lastname`: máximo 60;
- `isMainGuest`: boolean;
- `404`: reserva inexistente;
- `422`: capacidad máxima alcanzada.

Respuesta:

```json
{
  "guest": {
    "uuid": "guest-uuid",
    "name": "Ricardo",
    "lastname": "Lombana"
  },
  "reservationGuest": {
    "isMainGuest": true,
    "isCheckinCompleted": false
  },
  "verification": {
    "type": "session",
    "url": "https://didit.me/verify/..."
  },
  "formSchema": {
    "required_fields": [],
    "optional_fields": [],
    "prefilledData": {}
  }
}
```

`verification.type`:

- `session`;
- `document_upload`;
- `verified_ok`.

El backend elige el provider; el frontend no lo envía.

## 13. Check-in v4.1 confirmado

### 13.1 Esquema dinámico

```http
GET /api/v1/checkin/{reservationUuid}/form/{guestUuid}
```

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

Los catálogos no vienen en esta respuesta.

### 13.2 Upload OCR

```http
POST /api/v1/checkin/{reservationUuid}/secondary/{guestUuid}/documents
Content-Type: multipart/form-data
```

Contrato v4.1:

```text
front_image: [File]  required, max 10 MB
back_image:  [File]  conditional, max 10 MB
```

Respuesta v4.1:

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
    "required_fields": ["country_of_origin_id"],
    "optional_fields": [],
    "prefilledData": {
      "name": "Maria"
    }
  }
}
```

Error OCR histórico:

```json
{
  "success": false,
  "errorType": "low_quality",
  "message": "Could not extract data from document images.",
  "failedFields": ["documentNumber"]
}
```

### 13.3 Completar principal

```http
POST /api/v1/checkin/{reservationUuid}/main/complete
```

Payload v4.1 documentado:

```json
{
  "guestUuid": "guest-uuid",
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

Respuesta exacta v4.1:

```json
{
  "message": "Main guest checkin completed."
}
```

### 13.4 Completar acompañante

```http
POST /api/v1/checkin/{reservationUuid}/secondary/{guestUuid}/complete
```

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

```json
{
  "message": "Secondary guest checkin completed."
}
```

### 13.5 Resultado Didit

```http
GET /api/v1/checkin/{reservationUuid}/verify/result?guest_uuid={guestUuid}
```

Respuesta vigente:

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

El frontend detecta la sesión documental con `sessionType: "kyc"`, no con
`status: "pass"`. `isStale` decide cuándo dejar de esperar; no se replica en el
cliente el umbral temporal del backend. El único query documentado por el
tracker vigente es `guest_uuid`; no se envía un `session_id` inventado.

## 14. Extensiones v4.2–v4.7

Estas extensiones están formalizadas en tipos y consumidores actuales. El
repositorio no siempre identifica personalmente quién entregó cada revisión.

### 14.1 v4.2 — estado de verificación

Elemento de `registeredGuests`:

```json
{
  "uuid": "guest-uuid",
  "isMain": true,
  "isCompleted": false,
  "verification": {
    "status": "pending",
    "currentStep": "verification",
    "verifiedAt": null
  }
}
```

Estados:

- `not_started`
- `pending`
- `in_progress`
- `in_review`
- `approved`
- `rejected`
- `fail`
- `expired`
- `completed`

`currentStep`: `verification`, `form`, `rejected`, `completed`.

### 14.2 v4.3 — documentos en portal

```json
{
  "documents": [
    {
      "uuid": "document-uuid",
      "type": "Agreement",
      "renderUrl": "/api/v1/checkin/{reservationUuid}/documents/{documentUuid}/render",
      "pdfUrl": "/api/v1/checkin/{reservationUuid}/documents/{documentUuid}/pdf"
    }
  ]
}
```

Endpoints:

```http
GET /checkin/{reservationUuid}/documents/{documentUuid}/render
GET /checkin/{reservationUuid}/documents/{documentUuid}/pdf
```

### 14.3 v4.4 — firma de contrato

Portal:

```json
{
  "contract": {
    "signingProvider": "hitguest_signature",
    "status": "not_started",
    "hasNativeSignature": false,
    "signedAt": null,
    "signedContractUrl": null
  }
}
```

`signingProvider`: `hitguest`, `hitguest_signature`, `tufirma` o null.

Firma nativa:

```http
POST /checkin/{reservationUuid}/main/sign
```

```json
{
  "guestUuid": "guest-uuid",
  "documentUuid": "contract-document-uuid",
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

Contrato firmado:

```http
GET /checkin/{reservationUuid}/contract/signed
```

### 14.4 v4.5 — ciclo de vida del portal

Reservas canceladas o eliminadas pueden responder:

```json
{
  "portalStatus": "cancelled",
  "message": "La reserva fue cancelada"
}
```

`portalStatus`: `cancelled` o `deleted`.

Una reserva cerrada conserva portal completo, pero:

```json
{
  "reservation": {
    "checkinAllowed": false
  }
}
```

### 14.5 v4.5/v4.6 — huéspedes y documentos

```http
GET /reservations/{reservationUuid}/guests
```

```json
[
  {
    "guestProfile": {
      "uuid": "guest-uuid",
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

Solo deben exponerse URLs resolubles/autenticadas de
`reservationSpecificData.documentImages`, no rutas internas de storage.

### 14.6 v4.6 — campos dinámicos de proveedor

El backend puede declarar:

```json
{
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
```

Tipos: `text`, `number`, `select`, `auto`. Los campos `auto` no se muestran. El
valor del usuario se envía con la clave exacta dentro de `extra`:

```json
{
  "extra": {
    "purpose_of_travel": 31
  }
}
```

### 14.7 v4.7 — documentos y selfie

Contrato original de selfie:

```http
POST /checkin/{reservationUuid}/secondary/{guestUuid}/documents
```

```text
front_image:  [File] required, image, max 10 MB
back_image:   [File] conditional, image, max 10 MB
selfie_image: [File] required, image, max 10 MB
```

Errores estructurados:

```json
{
  "success": false,
  "errorType": "FACE_MISMATCH",
  "message": "No fue posible validar la identidad",
  "failedFields": []
}
```

Valores documentados de `errorType`: `FACE_MISMATCH` (similitud menor a 80%),
`NO_FACE_DETECTED`, `SERVICE_UNAVAILABLE`, `DUPLICATE_DOCUMENT`,
`CRITICAL_FIELD_ERROR`, `LOW_QUALITY_IMAGE`, `EXPIRED_DOCUMENT`,
`DOCUMENT_NUMBER_UNREADABLE` y `DOCUMENT_NUMBER_MISMATCH`.

En un fallo facial el backend elimina los tres archivos. El reintento debe
reenviar `front_image`, `back_image` cuando aplique y `selfie_image`; la UX puede
retener temporalmente los documentos y pedir solo una nueva selfie.

### 14.8 Payload actual de completion

Principal:

```json
{
  "guestUuid": "guest-uuid",
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
    "reasonForTripId": 31,
    "documentImage1": "https://...",
    "documentImage2": "https://...",
    "purpose_of_travel": 31
  }
}
```

Acompañante: mismo `profile` y `extra`, sin `guestUuid` en raíz porque está en la
URL. El formulario dedicado también puede enviar:

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

Respuesta actual:

```json
{
  "message": "Check-in actualizado",
  "status": "completed"
}
```

`status` también puede ser `pending_signature`.

## 15. Integración Kunas PMS

`IntegrationResource` exitoso:

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
      "email": "pm@example.com",
      "pmsProperties": [{ "id": "101", "name": "Apartamento Centro" }]
    },
    "statusProviderId": 8
  }
}
```

Los tokens no se muestran. `parameters.password` nunca retorna.
`pmsProperties` puede ser `[]` mientras sincroniza.

### 15.1 Consultar

```http
GET /kunas-pms/integration
```

`404` significa que no existe integración.

### 15.2 Conectar

```http
POST /kunas-pms/connect
```

```json
{
  "token": "provider-token",
  "email": "pms@example.com",
  "password": "secreto",
  "name": "KunasPMS"
}
```

`token`, `email` y `password` son requeridos; `name` es opcional y por defecto
`KunasPMS`. Responde `202` con `IntegrationResource` e inicia sincronización
asíncrona. `401` de credenciales incluye `errors.credentials`; `422` usa
`errors.{campo}`. Repetir connect actualiza credenciales y resincroniza.

### 15.3 Configurar

```http
PATCH /kunas-pms/configuration
```

```json
{
  "email": "pms@example.com",
  "password": "nuevo-secreto"
}
```

Ambos campos son requeridos. Responde `200` con `IntegrationResource`; valida
credenciales pero no resincroniza.

### 15.4 Estado y desconexión

```http
PATCH /integrations/{id}
```

```json
{
  "statusProviderId": 8
}
```

`8` activa y `10` pausa. `{id}` admite id numérico o token HIT; se recomienda el
id. `200` retorna `IntegrationResource`.

```http
DELETE /integrations/{id}
```

`204` sin body. No elimina propiedades ni reservas ya importadas.

## 16. Billing

### 16.1 Contrato consumido actualmente

```http
GET /billing/balance
```

```json
{
  "balance": 45.5,
  "currency": "USD"
}
```

Estados UI: `balance > 5` normal, `0 < balance <= 5` bajo y `balance <= 0`
agotado.

```http
GET /billing/packages
```

```json
{
  "packages": [
    { "amount": 10, "label": "$10", "description": "10 USD credits" },
    { "amount": 25, "label": "$25", "description": "25 USD credits" },
    { "amount": 50, "label": "$50", "description": "50 USD credits" },
    { "amount": 100, "label": "$100", "description": "100 USD credits" }
  ],
  "minimumCustom": 10,
  "currency": "USD"
}
```

```http
POST /billing/checkout
```

```json
{
  "amount": 25
}
```

`amount` es numérico, mínimo `minimumCustom` y máximo `10000`.

```json
{
  "checkoutUrl": "https://checkout.stripe.com/...",
  "sessionId": "cs_..."
}
```

```http
GET /billing/transactions?page=1
```

Respuesta Laravel paginada `{data, meta, links}`.

Cada transacción contiene:

```json
{
  "id": 42,
  "type": "credit",
  "amount": 25,
  "balanceAfter": 70.5,
  "source": "stripe",
  "description": "Recarga Stripe",
  "createdAt": "2026-07-10T14:30:00+00:00"
}
```

`type`: `credit|debit`; `source`:
`trial|stripe|automation|automation_refund|manual`; `status`:
`completed|refunded`.
El webhook de Stripe acredita de forma asíncrona e idempotente por sesión. Las
automatizaciones debitan saldo, se pausan al llegar a cero y el backend envía
alerta diaria por debajo de USD 5 e inmediata al llegar a USD 0.

**Disponibilidad:** el frontend interpreta `404/501` como backend no configurado.

### 16.2 Contrato anterior propuesto por frontend

```http
POST /api/v1/billing/recharge
```

Payload:

```json
{
  "amount": 25,
  "currency": "USD"
}
```

Respuesta propuesta:

```json
{
  "data": {
    "paymentUrl": "https://pagos.proveedor.com/session/abc123"
  }
}
```

`paymentUrl` era el nombre canónico; el frontend propuesto también toleraba
`checkoutUrl` y `redirectUrl`. El backend debía definir internamente
`success_url`, `cancel_url`, webhook e idempotencia.

Endpoints opcionales preservados:

```http
GET /billing/transactions
GET /billing/consumption?from={date}&to={date}
```

`/billing/consumption` buscaba evitar el patrón de una consulta
`automation-records` por reserva.

**Estado:** `PROPUESTA-FRONTEND`, supersedida en el consumidor por
`POST /billing/checkout`.

### 16.3 Crédito de bienvenida

Decisión registrada:

- una cuenta nueva debe iniciar con USD 10;
- `GET /billing/balance` debe devolver `10.00`;
- idealmente debe existir una transacción de crédito de bienvenida.

La fuente no lo atribuye expresamente a Ricardo.

## 17. Propuestas frontend preservadas, no atribuidas a Ricardo

Estas rutas aparecen en `BACKEND_REQUIREMENTS_V4.md` y
`BACKEND_NEEDS_SUMMARY.md` como necesidades del frontend. Se conservan para no
perder payloads históricos, pero **no son contratos recibidos**.

### 17.1 Resolver identidad

```http
POST /api/v1/checkin/{reservationUuid}/resolve-identity
```

```json
{
  "doc_type_id": 7,
  "doc_number": "1234567890",
  "nationality_id": 48
}
```

```json
{
  "success": true,
  "data": {
    "guest_uuid": "guest-uuid",
    "is_new": true,
    "has_previous_verification": false
  }
}
```

**Estado:** `SUPERSEDIDO` por `/identify`.

### 17.2 Iniciar verificación

```http
POST /api/v1/checkin/{reservationUuid}/guest/{guestUuid}/verify
```

```json
{
  "provider": "didit"
}
```

```json
{
  "success": true,
  "data": {
    "session_id": "sess_abc123",
    "verification_url": "https://verify.didit.me/sess_abc123",
    "status": "pending"
  }
}
```

**Estado:** `SUPERSEDIDO`; `/identify` entrega la directiva de verificación.

### 17.3 Polling de verificación

```http
GET /api/v1/checkin/{reservationUuid}/guest/{guestUuid}/verification-status
```

Respuesta aprobada propuesta:

```json
{
  "success": true,
  "data": {
    "status": "approved",
    "pre_filled_data": {
      "name": "Ricardo",
      "lastname": "Lombana",
      "date_of_birth": "1990-05-15",
      "doc_type_id": 7,
      "doc_number": "1234567890",
      "doc_expiry_date": "2030-12-31",
      "nationality_id": 48
    },
    "documents_expired": false
  }
}
```

**Estado:** reemplazado por estado del portal y `/verify/result`.

### 17.4 Presigned upload

```http
POST /api/v1/uploads/presigned
```

```json
{
  "file_type": "image/jpeg",
  "context": "document_front",
  "guest_uuid": "guest-uuid"
}
```

```json
{
  "success": true,
  "data": {
    "upload_url": "https://s3.amazonaws.com/...",
    "file_key": "guests/guest-uuid/doc_front.jpg"
  }
}
```

**Estado:** propuesta no adoptada; el contrato actual usa multipart al backend.

### 17.5 Complete genérico

```http
POST /api/v1/checkin/{reservationUuid}/guest/{guestUuid}/complete
```

Payload plano propuesto:

```json
{
  "is_main_guest": true,
  "name": "Ricardo",
  "lastname": "Lombana",
  "identification_type_id": 7,
  "identificacion_number": "1234567890",
  "date_of_birth": "1990-05-15",
  "email": "guest@example.com",
  "phone": "+57 300 123 4567",
  "nationality_id": 48,
  "gender_id": 114,
  "signature_base64": "data:image/png;base64,...",
  "extra": {
    "document_country_id": 48,
    "country_of_origin_id": 48,
    "country_destination_id": 48,
    "city_of_residence": "Bogotá",
    "country_of_residence_id": 48,
    "reason_for_trip_id": 31,
    "document_image_1": "file-key",
    "document_image_2": "file-key"
  }
}
```

**Estado:** `SUPERSEDIDO` por `/main/complete` y
`/secondary/{guestUuid}/complete`.

### 17.6 Estado de reserva

```http
GET /api/v1/checkin/{reservationUuid}/status
```

```json
{
  "success": true,
  "data": {
    "main_guest_completed": true,
    "total_guests": 3,
    "completed_guests": [
      {
        "guest_uuid": "guest-uuid",
        "name": "Ricardo L.",
        "is_main": true
      }
    ],
    "pending_guests": 2
  }
}
```

**Estado:** función cubierta hoy por el portal.

### 17.7 Gate de acompañante por token

```http
GET /api/v1/checkin/{reservationUuid}/s/{guestToken}/status
```

Respuesta propuesta:

```json
{
  "mainGuestCompleted": true,
  "mainGuestName": "Ricardo Lombana",
  "guestToken": "token"
}
```

**Estado:** la implementación actual deriva este estado desde el portal.

### 17.8 Upload genérico de documentos

```http
POST /api/v1/checkin/{reservationUuid}/guest/{guestUuid}/upload
Content-Type: multipart/form-data
```

Fue una variante intermedia del upload Textract.

**Estado:** supersedido por
`/secondary/{guestUuid}/documents`.

### 17.9 Template de contrato

```http
GET /api/v1/checkin/{reservationUuid}/contract-template
```

```json
{
  "success": true,
  "data": {
    "title": "Contrato de Arrendamiento Turístico",
    "body_html": "<p>Entre <strong>{{host_name}}</strong>...</p>",
    "variables": {
      "host_name": "Host",
      "guest_name": "Ricardo Lombana",
      "property_name": "Apartamentos Centro",
      "unit_name": "Unidad 201",
      "arrival_date": "2026-05-15",
      "departure_date": "2026-05-20",
      "total_price": 750.5,
      "currency": "USD"
    }
  }
}
```

**Estado:** reemplazado por documentos renderizables por reserva.

### 17.10 Endpoints backend-only históricos

```http
POST /api/v1/webhooks/didit
POST /api/v1/webhooks/textract
```

Los webhooks fueron registrados como responsabilidad exclusiva del backend; no
hay payload contractual completo en el repositorio.

```http
POST /api/v1/didit/session
```

**Estado:** `410 GONE` según el changelog de la documentación general; el inicio
de sesión se integró en `/identify`.

### 17.11 Trigger programado

`BACKEND_NEEDS_AUTOMATION_TRIGGERS.md` propone:

```json
{
  "triggerTypes": ["on_scheduled_time"],
  "triggerConfig": {
    "on_scheduled_time": {
      "mode": "absolute",
      "time": "08:00"
    }
  }
}
```

o relativo:

```json
{
  "triggerTypes": ["on_scheduled_time"],
  "triggerConfig": {
    "on_scheduled_time": {
      "mode": "relative",
      "anchor": "checkout",
      "direction": "before",
      "offset_minutes": 120
    }
  }
}
```

Reglas propuestas:

- `mode = absolute`: requiere `time` en `HH:mm`;
- `mode = relative`: requiere `anchor` (`checkin|checkout`), `direction`
  (`before|after`) y `offset_minutes >= 0`;
- la hora absoluta usa la timezone de la propiedad;
- la ejecución debe ser idempotente.

**Estado:** `PROPUESTA-FRONTEND`; no existe consumidor API activo.

## 18. Conflictos y supersesiones

| Tema                   | Contrato anterior                                        | Contrato prevalente                                   |
| ---------------------- | -------------------------------------------------------- | ----------------------------------------------------- |
| Login                  | `/auth/login` con email + password                       | `/auth/login` solo email para solicitar OTP           |
| Cuenta                 | `GET/PATCH /account`                                     | `GET/PATCH /clients/{uuid}`                           |
| Editar usuario         | Plan backend implementado permitía `PATCH /users/{uuid}` | No editar en UI por decisión posterior de Ricardo     |
| Listings por propiedad | `property_uuid`                                          | Ruta anidada o `propertyUuid[eq]`                     |
| Identidad              | `/resolve-identity`                                      | `/identify`                                           |
| Guardar guest          | `/checkin/{uuid}/guest` plano                            | `/main/complete` y `/secondary/{uuid}/complete`       |
| Upload                 | base64/presigned                                         | multipart `front_image`, `back_image`, `selfie_image` |
| Firma                  | `signature` dentro de complete                           | `/main/sign` separado antes de complete               |
| Contrato               | nodo “Firma Digital” separado                            | firma como atributo de contrato por canal             |
| Verificación           | endpoint `verification-status`                           | portal `verification` + `/verify/result`              |
| Recarga                | `/billing/recharge`                                      | `/billing/checkout`                                   |
| Fechas                 | timestamps genéricos                                     | fechas de calendario `YYYY-MM-DD`                     |

## 19. Fuentes auditadas

### 19.1 Referencias con atribución explícita a Ricardo

- cinco planes originales recibidos el 23-jul-2026, inventariados en
  [`RICARDO_SOURCE_PLANS_2026-07-23.md`](./RICARDO_SOURCE_PLANS_2026-07-23.md);
- cuatro archivos fuente recibidos el 24-jul-2026, inventariados en
  [`RICARDO_SOURCE_PLANS_2026-07-24.md`](./RICARDO_SOURCE_PLANS_2026-07-24.md);
- `docs/BACKEND_NEEDS_SUMMARY.md`
  - contratos por canal y firma;
  - decisión de no editar usuarios;
- `src/features/properties/services/listings-service.ts`
  - ruta anidada de listings por propiedad;
- `src/features/reservations/components/automations/automation-status-meta.ts`
  - proveedores con dispatch/redispatch manual.

### 19.2 Contratos descritos como backend confirmado

- `docs/CHECKIN_BACKEND_HANDOFF.md`
- `docs/CHECKIN_V4_API_ALIGNMENT.md`
- `docs/FRONTEND_HANDOFF_V41.md`
- `docs/BACKEND_NEEDS_SUMMARY.md`
- `docs/API_DOCUMENTATION.md`

### 19.3 Propuestas frontend mantenidas aparte

- `docs/BACKEND_REQUIREMENTS_V4.md`
- `docs/BACKEND_NEEDS_AUTOMATION_TRIGGERS.md`
- `docs/BACKEND_NEEDS_BILLING.md`
- `docs/PROPERTY_AUTOMATIONS_ARCHITECTURE.md`

## 20. Material externo faltante

Los nueve archivos entregados el 23 y 24 de julio ya están incorporados. Si
existen otros contratos compartidos por WhatsApp, email, Notion, Slack o
archivos que no fueron copiados al repositorio, todavía no pueden verificarse
desde este workspace.
Al incorporarlos, cada uno debe registrar:

- fecha de recepción;
- nombre del contrato o mensaje;
- endpoint y método;
- request completo;
- response completo;
- errores y reglas;
- versión reemplazada;
- estado actual.
