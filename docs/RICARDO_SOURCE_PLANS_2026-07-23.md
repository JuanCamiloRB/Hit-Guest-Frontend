# Contratos fuente recibidos — 23 de julio de 2026

Este documento normaliza los cinco planes entregados el 23-jul-2026. Conserva
endpoints, payloads, respuestas, errores y reglas operativas. El estado efectivo
del frontend y las supersesiones se consultan en
[`RICARDO_API_CONTRACTS.md`](./RICARDO_API_CONTRACTS.md).

Los cuatro archivos recibidos al día siguiente están inventariados en
[`RICARDO_SOURCE_PLANS_2026-07-24.md`](./RICARDO_SOURCE_PLANS_2026-07-24.md).

## 1. Inventario y trazabilidad

| ID  | Plan fuente                                     | SHA-256                                                            |
| --- | ----------------------------------------------- | ------------------------------------------------------------------ |
| S1  | Gestión de Cuenta del Cliente y Dueño Principal | `6b0e1fc4ce38f4769e32398efba354da407d038f804d5d0dd2f5ce8604f94fe9` |
| S2  | Logo de Cliente                                 | `68504a03aca7ad3b53c145aec125030e47e1552fafd040a8b18e45b6cc4145dd` |
| S3  | Selfie Capture — Huéspedes Secundarios          | `2fe17c0139dc76f8e2dec30a0cbf28ff281b10c8ec212104feeb6c568d837004` |
| S4  | Billing y Créditos                              | `72b26961e2edf02f7cdb3646fb2c3b9c6065a3fff16cbff14cc99ec44196b82a` |
| S5  | Gestión de Imágenes de Propiedad                | `9e8ae6b33bfbf826e56d4921ceac0928d6e3c0f0fd52540466d87ed9addb2ab0` |

Salvo el portal público de check-in, los endpoints usan:

```http
Authorization: Bearer {sanctum-token}
Accept: application/json
Base URL: {API_BASE}/api/v1
```

## 2. S1 — Cuenta, cliente y dueño principal

El plan declara la implementación backend terminada y con 434 tests pasando.
Un cliente tiene un solo owner, aunque pueda tener varios
`property_manager`. El owner puede gestionar managers, eliminar usuarios,
transferir titularidad y eliminar la cuenta. No puede eliminarse ni quitarse su
propio rol antes de transferir.

### 2.1 Sesión

```http
GET /api/v1/user
```

```json
{
  "uuid": "user-uuid",
  "client_uuid": "client-uuid",
  "client_name": "Villa Palmeras SAS",
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "locale": "es",
  "isAccountOwner": true,
  "created_at": "2026-07-01 10:00:00",
  "updated_at": "2026-07-01 10:00:00"
}
```

`isAccountOwner` controla las acciones exclusivas del owner.

### 2.2 Recursos

`ClientResource`:

```json
{
  "data": {
    "uuid": "client-uuid",
    "personTypeId": 1,
    "name": "Villa Palmeras SAS",
    "lastname": null,
    "identificationTypeId": 3,
    "identificationNumber": "900123456",
    "email": "contacto@villapalmeras.com",
    "phone": "3001234567",
    "address": "Calle 10 #5-20",
    "addressDetail": null,
    "city": "Cartagena",
    "state": "Bolívar",
    "countryId": 48,
    "statusRecordId": 6,
    "ownerUserUuid": "user-uuid",
    "logoUrl": "https://api.hitguest.com/storage/clients/.../logo.png"
  }
}
```

`logoUrl` se omite cuando no hay logo. `balance` y
`balance_last_depleted_at` no se exponen.

`UserResource`:

```json
{
  "data": {
    "uuid": "user-uuid",
    "client_uuid": "client-uuid",
    "client_name": "Villa Palmeras SAS",
    "name": "María Gómez",
    "email": "maria@example.com",
    "locale": "es",
    "isAccountOwner": false,
    "created_at": "2026-07-10 09:00:00",
    "updated_at": "2026-07-10 09:00:00"
  }
}
```

El recurso no incluye roles. Si la UI debe mostrar el rol, backend debe agregar
por ejemplo `roles: ["property_manager"]`.

### 2.3 Consultar y actualizar cliente

```http
GET /api/v1/clients/{clientUuid}
PATCH /api/v1/clients/{clientUuid}
PUT /api/v1/clients/{clientUuid}
```

Payload máximo:

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

`PATCH` acepta campos parciales. En `PUT` son obligatorios
`personTypeId`, `identificationTypeId`, `identificationNumber`, `email`,
`phone`, `address`, `city`, `state`, `countryId` y `statusRecordId`;
`lastname` y `addressDetail` son opcionales. Cualquier `property_manager` de la
cuenta puede editar. `200` no retorna body.

No se envían `ownerUserUuid`, `balance`, `balance_last_depleted_at` ni
`logoUrl`.

### 2.4 Listar usuarios

```http
GET /api/v1/users
GET /api/v1/users?name[has]=texto&email[has]=texto&includeClient=1
```

La consulta queda scoped automáticamente a la cuenta.

```json
{
  "data": [
    {
      "uuid": "user-uuid",
      "name": "Juan Pérez",
      "email": "juan@example.com",
      "isAccountOwner": true
    }
  ],
  "links": { "first": "...", "last": "...", "prev": null, "next": null },
  "meta": { "current_page": 1, "last_page": 1, "per_page": 15, "total": 1 }
}
```

### 2.5 Crear usuario

```http
POST /api/v1/users
Content-Type: application/json
```

```json
{
  "client_uuid": "client-uuid",
  "name": "Operador",
  "email": "operador@example.com",
  "password": "mínimo-8",
  "role": "property_staff"
}
```

| Campo         | Regla                                              |
| ------------- | -------------------------------------------------- |
| `client_uuid` | requerido; siempre la cuenta propia                |
| `name`        | requerido, string, máximo 255                      |
| `email`       | requerido, email único                             |
| `password`    | requerido, mínimo 8                                |
| `role`        | `property_manager`, `property_staff` o `read_only` |

Si `role` se omite, el usuario queda sin permisos funcionales. Responde `201`
con `UserResource`; `403` por asignar manager sin ser owner o cruzar de cuenta;
`422` por validación.

### 2.6 Editar usuario — contrato original supersedido

```http
PATCH /api/v1/users/{userUuid}
PUT /api/v1/users/{userUuid}
```

```json
{
  "client_uuid": "client-uuid",
  "name": "Nombre opcional",
  "email": "nuevo@example.com",
  "password": "mínimo-8",
  "role": "read_only"
}
```

`client_uuid` era obligatorio incluso para `PATCH`; omitirlo generaba `404`.
Los demás campos eran opcionales. `role: null` estaba permitido; omitir `role`
no modificaba el actual. `200` no tenía body.

Errores:

- `403`: cambiar a/desde `property_manager` sin ser owner o cruzar de cuenta;
- `422`: owner intentando quitarse su rol:
  `You cannot change your own role away from property_manager while you are the account owner. Transfer ownership to another user first.`

Este endpoint fue retirado de la UI por una decisión posterior: el email
representa identidad y requeriría reverificación OTP.

### 2.7 Eliminar usuario

```http
DELETE /api/v1/users/{userUuid}
```

Solo owner; soft-delete. `204` sin body. `403` si no es owner o cruza de cuenta.
Autoeliminarse produce `422`:

```json
{
  "message": "The account owner cannot be deleted. Transfer ownership to another user first."
}
```

### 2.8 Transferir titularidad

```http
POST /api/v1/clients/{clientUuid}/transfer-ownership
Content-Type: application/json
```

```json
{
  "user_uuid": "target-user-uuid"
}
```

Solo owner actual o `super_admin`. El destino debe existir en la misma cuenta.
El backend le asigna `property_manager` si no lo tenía; el owner anterior
conserva ese rol.

`200` retorna el `ClientResource` con `ownerUserUuid` actualizado. Después debe
refrescarse `GET /user`. `403` indica caller no owner; `422`, usuario inválido.

### 2.9 Eliminar cuenta

```http
DELETE /api/v1/clients/{clientUuid}
```

Solo owner. `204` sin body; `403` si no es owner. Es soft-delete pero no hace
cascada: propiedades, listings, reservas y automatizaciones permanecen. El
frontend debe cerrar sesión inmediatamente.

### 2.10 Errores y limitaciones

- El `403` tiene siempre body genérico:
  `{"message":"Invalid or unauthorized token provided."}`. La UI infiere el
  contexto y no muestra ese texto literalmente.
- Un `404` también puede significar que faltó `client_uuid` al editar usuario.
- En `422` estándar se usa `errors.{campo}[0]`.
- No hay invitación por email.
- `GET /users/{user}` no estaba scoped correctamente; el frontend debe evitarlo.
- No había traducciones portuguesas.

## 3. S2 — Logo del cliente

### 3.1 Consultar

```http
GET /api/v1/user
GET /api/v1/clients/{clientUuid}
```

El primer endpoint entrega `client_uuid`; el segundo, el `ClientResource`.
`logoUrl` está ausente, no `null`, cuando no existe logo.

### 3.2 Subir o reemplazar

```http
POST /api/v1/clients/{clientUuid}/logo
Content-Type: multipart/form-data
```

```text
logo: [File] required, PNG o JPEG, máximo 2 MB
```

No se define manualmente el header `Content-Type`; el navegador agrega el
boundary. Al subir un logo nuevo, el backend reemplaza el anterior. Redimensiona
a máximo 350 px en la dimensión dominante, conserva la proporción y conserva
transparencia PNG.

`200` retorna el `ClientResource` completo con `data.logoUrl` actualizado.

Errores `422`:

```json
{
  "message": "The logo field is required.",
  "errors": { "logo": ["The logo field is required."] }
}
```

```json
{
  "message": "The logo field must be a file of type: png, jpg, jpeg.",
  "errors": {
    "logo": ["The logo field must be a file of type: png, jpg, jpeg."]
  }
}
```

SVG y WEBP no están soportados.

### 3.3 Eliminar

```http
DELETE /api/v1/clients/{clientUuid}/logo
```

Sin body. Es idempotente: responde `200` aunque no hubiera logo y retorna el
`ClientResource` sin `logoUrl`.

## 4. S3 — Selfie de huésped secundario

```http
POST /api/v1/checkin/{reservationUuid}/secondary/{guestUuid}/documents
Content-Type: multipart/form-data
```

```text
front_image:  [File] required, image, max 10 MB
back_image:   [File] conditional por tipo de documento, image, max 10 MB
selfie_image: [File] required, image, max 10 MB
```

Respuesta `200`:

```json
{
  "extractedData": {
    "name": "...",
    "lastname": "...",
    "dateOfBirth": "...",
    "identificationExpiryDate": "..."
  },
  "formSchema": {}
}
```

Respuesta `422`:

```json
{
  "success": false,
  "errorType": "FACE_MISMATCH",
  "message": "La selfie no coincide con el documento de identidad...",
  "failedFields": []
}
```

| `errorType`                  | Significado                               | Reintento    |
| ---------------------------- | ----------------------------------------- | ------------ |
| `FACE_MISMATCH`              | similitud facial menor a 80%              | nueva selfie |
| `NO_FACE_DETECTED`           | rostro no detectado en selfie o documento | nueva selfie |
| `SERVICE_UNAVAILABLE`        | Rekognition/Textract no disponible        | todo         |
| `DUPLICATE_DOCUMENT`         | documento ya usado en la reserva          | no; soporte  |
| `CRITICAL_FIELD_ERROR`       | campos clave ilegibles                    | documentos   |
| `LOW_QUALITY_IMAGE`          | confianza global insuficiente             | documentos   |
| `EXPIRED_DOCUMENT`           | documento vencido                         | no           |
| `DOCUMENT_NUMBER_UNREADABLE` | número no extraíble                       | documentos   |
| `DOCUMENT_NUMBER_MISMATCH`   | número no coincide                        | no; soporte  |

En fallos faciales el backend elimina todos los archivos. El siguiente request
debe reenviar los tres; la UI puede conservar los `File` de documentos y pedir
solo una nueva selfie. Captura mobile sugerida:

```html
<input type="file" accept="image/*" capture="user" />
```

## 5. S4 — Billing y créditos

### 5.1 Balance

```http
GET /api/v1/billing/balance
```

```json
{
  "balance": 45.5,
  "currency": "USD"
}
```

- `balance > 5`: normal;
- `0 < balance <= 5`: bajo;
- `balance <= 0`: agotado.

### 5.2 Paquetes

```http
GET /api/v1/billing/packages
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

Los paquetes vienen de la API y no deben hardcodearse.

### 5.3 Checkout

```http
POST /api/v1/billing/checkout
Content-Type: application/json
```

```json
{ "amount": 25 }
```

`amount` es requerido, numérico, mínimo `minimumCustom` y máximo `10000`.

```json
{
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_xxx...",
  "sessionId": "cs_test_xxx..."
}
```

El frontend redirige a `checkoutUrl`. `422` indica monto inválido; `500`, error
al crear la sesión Stripe.

### 5.4 Transacciones

```http
GET /api/v1/billing/transactions?page={n}
```

```json
{
  "data": [
    {
      "uuid": "01926d3f-...",
      "type": "credit",
      "amount": 25,
      "balanceAfter": 27.5,
      "description": "Package $25",
      "source": "stripe",
      "paymentGateway": "stripe",
      "status": "completed",
      "createdAt": "2026-07-10T14:32:15+00:00"
    }
  ],
  "links": { "first": "...", "last": "...", "prev": null, "next": "..." },
  "meta": {
    "current_page": 1,
    "last_page": 4,
    "per_page": 20,
    "total": 73,
    "from": 1,
    "to": 20
  }
}
```

Enumeraciones:

- `type`: `credit | debit`;
- `source`: `trial | stripe | automation | automation_refund | manual`;
- `status`: `completed | refunded`.

`createdAt` es ISO 8601 con timezone. Los montos llegan como números y se
formatean a dos decimales para UI.

### 5.5 Flujo Stripe y reglas operativas

- El backend redirigía originalmente a
  `/billing/success?session_id={CHECKOUT_SESSION_ID}`; debe alinearse con la ruta
  real del frontend si esta es `/settings/billing/success`.
- El webhook `POST /stripe/webhook` procesa el crédito de forma asíncrona.
- La pantalla de éxito puede mostrar estado pendiente o hacer polling de balance
  por máximo 10 segundos/5 intentos.
- No se hace polling permanente: refrescar al iniciar sesión, volver de Stripe y
  entrar a billing.
- Recargar la página de éxito con el mismo `session_id` es idempotente.
- Las automatizaciones billables debitan al completar y se pausan con saldo
  cero.
- Backend envía email diario por saldo menor a USD 5 e inmediato al llegar a
  cero.

Rutas frontend acordadas: `/settings/billing` y `/billing/success`. El widget de
saldo es persistente; el banner de saldo cero es global y no bloqueante.

## 6. S5 — Imágenes de propiedad

### 6.1 Consultar

```http
GET /api/v1/properties/{propertyUuid}
```

```json
{
  "data": {
    "uuid": "abc-def-123",
    "name": "Villa Palmeras",
    "extra": {
      "picturesUrl": [
        "https://api.hitguest.com/storage/properties/abc-def-123/images/photo1.jpg"
      ]
    }
  }
}
```

`extra.picturesUrl` es un arreglo de URLs absolutas. Puede ser `[]` o estar
ausente. Puede contener URLs externas.

### 6.2 Subir

```http
POST /api/v1/properties/{propertyUuid}/images
Content-Type: multipart/form-data
```

```text
images[]: [File] required, máximo 10 archivos/request, máximo 5 MB/archivo
```

No se configura manualmente el `Content-Type`. La operación anexa al arreglo
existente. `200` retorna el `PropertyResource` completo actualizado.

Ejemplo `422`:

```json
{
  "message": "The images.0 field must be an image.",
  "errors": {
    "images.0": ["The images.0 field must be an image."],
    "images.1": ["The images.1 field may not be greater than 5120 kilobytes."]
  }
}
```

### 6.3 Eliminar

```http
DELETE /api/v1/properties/{propertyUuid}/images
Content-Type: application/json
```

```json
{
  "url": "https://api.hitguest.com/storage/properties/abc-def-123/images/photo1.jpg"
}
```

Se elimina una imagen por request. La URL debe ser exactamente una de
`extra.picturesUrl`. `200` retorna el `PropertyResource` completo actualizado;
`422` indica `url` ausente o no string.

No existe reordenamiento ni garantía de orden. Una URL externa se elimina del
arreglo, pero el backend no toca el almacenamiento externo. Para más de diez
archivos se hacen varios requests.

## 7. Divergencias que no deben perderse

| Tema              | Fuente original                  | Estado posterior o frontend actual                                 |
| ----------------- | -------------------------------- | ------------------------------------------------------------------ |
| Email del cliente | S1 lo declara editable           | El frontend actual lo omite                                        |
| Editar usuario    | S1 implementaba `PATCH/PUT`      | Retirado de UI por decisión posterior de Ricardo                   |
| Eliminar cliente  | S1 lo declara implementado       | El frontend aún no lo conecta                                      |
| Roles en usuarios | No vienen en `UserResource`      | Sigue siendo bloqueante para mostrar roles reales                  |
| Error selfie      | S3 usa `errorType` en mayúsculas | Consumidores que normalicen lowercase deben hacerlo explícitamente |
| Logo response     | `ClientResource` completo        | No asumir respuesta plana `{logoUrl}`                              |
| Imágenes response | `PropertyResource` completo      | Reemplazar estado con `data.extra.picturesUrl`                     |
