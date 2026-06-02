# Documentación API HitGuest

## Configuración Base

```
URL_BASE_HIT = 'https://www.kunas.co/api/v1'
```

---

## 📋 Índice

1. [Headers y Configuración](#headers-y-configuración)
2. [Endpoints de Autenticación](#endpoints-de-autenticación)
3. [Endpoints de Catálogos](#endpoints-de-catálogos)
4. [Endpoints de Países](#endpoints-de-países)
5. [Endpoints de Propiedades](#endpoints-de-propiedades)
6. [Endpoints de Listings (Alojamientos)](#endpoints-de-listings-alojamientos)
7. [Endpoints de Reservaciones](#endpoints-de-reservaciones)
8. [Endpoints de Check-in v4.1 (Guest Flow)](#endpoints-de-check-in-v41-guest-flow)
9. [Categorías de Catálogos](#categorías-de-catálogos)
10. [Estructura de Base de Datos](#estructura-de-base-datos)
11. [Ejemplos de Payloads](#ejemplos-de-payloads)
12. [Validaciones y Reglas](#validaciones-y-reglas)

---

## Headers y Configuración

### Headers Requeridos

```javascript
{
  "Content-Type": "application/json",
  "Accept": "application/json",
  "Authorization": "Bearer {token}", // Para endpoints autenticados
  "X-App-Token": "{app_token}"       // Token de la aplicación
}
```

### Headers de Idioma (Opcionales)

Puedes usar cualquiera de estos headers para especificar el idioma:

```javascript
{
  "X-Locale": "es",           // Opción 1
  "X-App-Locale": "es",       // Opción 2
  "Accept-Language": "es"     // Opción 3
}
```

Idiomas soportados: `es`, `en`

---

## Endpoints de Autenticación

### 1. Registro de Usuario

**Endpoint:** `POST /account/register`

**Payload:**
```json
{
  "personTypeId": 2,
  "name": "Juan",
  "lastname": "Pérez",
  "identificationTypeId": 5,
  "identificationNumber": "1234567890",
  "email": "juan@example.com",
  "phone": "+573001234567",
  "city": "Cali",
  "state": "Valle",
  "countryId": 48,
  "password": "password123",
  "password_confirmation": "password123"
}
```

**Validaciones:**
- `personTypeId`: Requerido, debe existir en catálogos (catalog_category_id = 1)
- `name`: Requerido, máximo 120 caracteres
- `lastname`: Opcional, máximo 120 caracteres
- `identificationTypeId`: Requerido, debe existir en catálogos (catalog_category_id = 2)
- `identificationNumber`: Requerido, máximo 30 caracteres, único por tipo de identificación
- `email`: Requerido, formato email válido, máximo 60 caracteres, único
- `phone`: Requerido, máximo 60 caracteres
- `city`: Requerido, máximo 120 caracteres
- `state`: Requerido, máximo 120 caracteres
- `countryId`: Requerido, debe existir en tabla countries
- `password`: Requerido, mínimo 8 caracteres, debe coincidir con confirmación
- `statusRecordId`: **NO enviar** (lo llena automáticamente el backend)

**Respuesta Exitosa:**
```json
{
  "success": true,
  "message": "Usuario registrado exitosamente",
  "data": {
    "user": {
      "uuid": "018cac04-4119-710b-a52f-8610b4b68aa3",
      "email": "juan@example.com",
      "name": "Juan"
    }
  }
}
```

---

### 2. Login

**Endpoint:** `POST /auth/login`

**Payload:**
```json
{
  "email": "juan@example.com",
  "password": "password123"
}
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "data": {
    "token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "user": {
      "uuid": "018cac04-4119-710b-a52f-8610b4b68aa3",
      "email": "juan@example.com",
      "name": "Juan"
    }
  }
}
```

---

### 3. Logout

**Endpoint:** `POST /auth/logout`

**Headers:** Requiere token de autenticación

**Respuesta Exitosa:**
```json
{
  "success": true,
  "message": "Sesión cerrada exitosamente"
}
```

---

### 4. Reenviar OTP

**Endpoint:** `POST /auth/resend-otp`

**Payload:**
```json
{
  "email": "juan@example.com"
}
```

---

### 5. Verificar OTP

**Endpoint:** `POST /auth/verify-otp`

**Payload:**
```json
{
  "email": "juan@example.com",
  "otp": "123456"
}
```

---

## Endpoints de Catálogos

### 1. Obtener Catálogos

**Endpoint:** `GET /catalogs`

**Parámetros de Query:**

Puedes filtrar por cualquiera de estos campos usando operadores:

```
GET /catalogs?status[eq]=ACT&catalogCategoryName[eq]=person_type
```

**Operadores disponibles:**
- `[eq]` - Igual a
- `[neq]` - Diferente de
- `[has]` - Contiene
- `[nhas]` - No contiene

**Ejemplos:**

```bash
# Obtener tipos de persona activos
GET /catalogs?status[eq]=ACT&catalogCategoryName[eq]=person_type

# Obtener tipos de identificación
GET /catalogs?status[eq]=ACT&catalogCategoryName[eq]=identification_type

# Obtener estados de registro (⚠️ Retorna 500 - Bug Conocido)
GET /catalogs?status[eq]=ACT&catalogCategoryName[eq]=status_record
# ⚠️ KNOWN BUG: Este endpoint retorna HTTP 500 Internal Server Error.
# El frontend usa valores hardcodeados como fallback: { id: '6', name: 'Activo' }, { id: '7', name: 'Inactivo' }

# Obtener amenidades
GET /catalogs?status[eq]=ACT&catalogCategoryName[eq]=amenities

# Obtener fuentes PMS
GET /catalogs?status[eq]=ACT&catalogCategoryName[eq]=source_pms

# Obtener tipos de propiedad
GET /catalogs?status[eq]=ACT&catalogCategoryName[eq]=property_type

# Obtener tipos de cama (⚠️ Retorna 500 - Bug Conocido)
GET /catalogs?status[eq]=ACT&catalogCategoryName[eq]=bed_type
# ⚠️ KNOWN BUG: Este endpoint retorna HTTP 500 Internal Server Error.
# El frontend ya no requiere estos catálogos (UI simplificada a número de camas).

# Obtener tipos de baño (⚠️ Retorna 500 - Bug Conocido)
GET /catalogs?status[eq]=ACT&catalogCategoryName[eq]=bath_type
# ⚠️ KNOWN BUG: Este endpoint retorna HTTP 500 Internal Server Error.
# El frontend ya no requiere estos catálogos (UI simplificada a número de baños).

# Obtener políticas de cancelación (posible 500 - verificar)
GET /catalogs?status[eq]=ACT&catalogCategoryName[eq]=cancellation_policy
# Frontend usa valores hardcodeados como fallback si el endpoint falla.
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "catalog_category_id": 1,
      "catalogCategoryName": "person_type",
      "name": "Natural",
      "code": "NAT",
      "status": "ACT",
      "extra": null
    },
    {
      "id": 2,
      "catalog_category_id": 1,
      "catalogCategoryName": "person_type",
      "name": "Jurídica",
      "code": "JUR",
      "status": "ACT",
      "extra": null
    }
  ]
}
```

---

### 2. Obtener Timezones

**Endpoint:** `GET /catalogs/category/timezones`

**Respuesta Exitosa:**
```json
{
  "success": true,
  "data": [
    {
      "value": "America/Bogota",
      "label": "America/Bogota (UTC-5)"
    },
    {
      "value": "America/New_York",
      "label": "America/New_York (UTC-5)"
    }
  ]
}
```

---

### 3. Obtener Monedas (Currencies)

**Endpoint:** `GET /v1/catalogs/category/currencies`

Devuelve la lista de monedas disponibles filtradas por las Américas + EUR. No requiere autenticación especial. La respuesta usa `code` como identificador, distinto al patrón `id/name` del resto de catálogos.

**Parámetros:** Ninguno requerido.

**Respuesta Exitosa (`200 OK`):**
```json
{
    "data": [
        { "code": "ANG", "name": "Netherlands Antillean guilder" },
        { "code": "ARS", "name": "Argentine peso" },
        { "code": "AWG", "name": "Aruban florin" },
        { "code": "BBD", "name": "Barbadian dollar" },
        { "code": "BMD", "name": "Bermudian dollar" },
        { "code": "BOB", "name": "Bolivian boliviano" },
        { "code": "BRL", "name": "Brazilian real" },
        { "code": "BSD", "name": "Bahamian dollar" },
        { "code": "BZD", "name": "Belize dollar" },
        { "code": "CAD", "name": "Canadian dollar" },
        { "code": "CLP", "name": "Chilean peso" },
        { "code": "COP", "name": "Colombian peso" },
        { "code": "CRC", "name": "Costa Rican colón" },
        { "code": "CUP", "name": "Cuban peso" },
        { "code": "DKK", "name": "Danish krone" },
        { "code": "DOP", "name": "Dominican peso" },
        { "code": "EUR", "name": "Euro" },
        { "code": "FKP", "name": "Falkland Islands pound" },
        { "code": "GBP", "name": "British pound" },
        { "code": "GTQ", "name": "Guatemalan quetzal" },
        { "code": "GYD", "name": "Guyanese dollar" },
        { "code": "HNL", "name": "Honduran lempira" },
        { "code": "HTG", "name": "Haitian gourde" },
        { "code": "JMD", "name": "Jamaican dollar" },
        { "code": "KYD", "name": "Cayman Islands dollar" },
        { "code": "MXN", "name": "Mexican peso" },
        { "code": "NIO", "name": "Nicaraguan córdoba" },
        { "code": "PAB", "name": "Panamanian balboa" },
        { "code": "PEN", "name": "Peruvian sol" },
        { "code": "PYG", "name": "Paraguayan guarani" },
        { "code": "SRD", "name": "Surinamese dollar" },
        { "code": "TTD", "name": "Trinidad and Tobago dollar" },
        { "code": "USD", "name": "United States dollar" },
        { "code": "UYU", "name": "Uruguayan peso" },
        { "code": "VES", "name": "Bolívar" },
        { "code": "XCD", "name": "East Caribbean dollar" }
    ]
}
```

**Campos de la respuesta:**

| Campo  | Tipo   | Descripción |
|--------|--------|-------------|
| `code` | string | Código ISO 4217 de la moneda. Se usa como identificador (`value`) en el selector del frontend. |
| `name` | string | Nombre descriptivo de la moneda en inglés. |

> **Nota:** El formato de respuesta difiere de otros catálogos — usa `{ data: [{ code, name }] }` en lugar de `{ data: [{ id, name }] }`. El parser en `getCurrencies()` mapea `code → id` para normalizar la estructura `CatalogOption`.

**Integración en el frontend:**

- **Servicio:** `catalogsService.getCurrencies()` en `src/services/catalogs-service.ts`
  - Llama a `GET /v1/catalogs/category/currencies`
  - Mapea `{ code, name }` → `CatalogOption { id: code, name: "${code} - ${name}" }`
- **Uso en UI:** Selector de moneda en el diálogo de unidades (`PropertiesUnits.tsx`) — tab General, al lado del campo "Precio Inicial por Noche"
- **Persistencia:** La moneda seleccionada se guarda en `extra.currency` del listing (`POST/PUT /v1/listings`)
- **Valor por defecto:** `"COP"` (hrederado del valor por defecto de la propiedad)

---


## Endpoints de Países

### 1. Obtener Países

**Endpoint:** `GET /countries`

**Parámetros de Query:**

```javascript
{
  name: ['eq', 'neq', 'has', 'nhas'],
  region: ['eq', 'neq', 'has', 'nhas'],
  subregion: ['eq', 'neq', 'has', 'nhas'],
  iso2: ['eq'],
  iso3: ['eq'],
  currency: ['eq']
}
```

**Ejemplos:**

```bash
# Buscar países que contengan "co" en el nombre
GET /countries?name[has]=co

# Buscar países de América
GET /countries?region[has]=america

# Buscar países de América que contengan "co"
GET /countries?name[has]=co&region[has]=america

# Buscar por código ISO2
GET /countries?iso2[eq]=CO

# Buscar por código ISO3
GET /countries?iso3[eq]=COL

# Buscar por moneda
GET /countries?currency[eq]=COP
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "data": [
    {
      "id": 48,
      "name": "Colombia",
      "iso2": "CO",
      "iso3": "COL",
      "phone_code": "+57",
      "capital": "Bogotá",
      "currency": "COP",
      "currency_name": "Colombian peso",
      "currency_symbol": "$",
      "region": "Americas",
      "subregion": "South America",
      "timezones": [
        {
          "zoneName": "America/Bogota",
          "gmtOffset": -18000,
          "gmtOffsetName": "UTC-05:00"
        }
      ]
    }
  ]
}
```

---

## Endpoints de Propiedades

### 1. Crear Propiedad

**Endpoint:** `POST /properties`

**Payload:**
```json
{
  "propertyTypeId": 102,
  "name": "Propiedad 2",
  "description": "nueva descripcion 2",
  "email": "algun@email.com",
  "phone": "+5730030030000",
  "address": "Calle con carrera 2",
  "addressDetail": null,
  "city": "Cali",
  "state": "Valle",
  "countryId": 48,
  "latitude": "4.00000000",
  "longitude": "-72.00000000",
  "timezone": "America/Bogota",
  "extra": {
    "picturesUrl": [
      "https://a0.muscache.com/im/pictures/prohost-api/Hosting-1476977613990701381/original/f1b3ed75-901d-4b4c-90e2-9be250641371.jpeg?im_w=720",
      "https://a0.muscache.com/im/pictures/prohost-api/Hosting-1476977613990701381/original/b09c9e50-0ec9-4713-96c3-09f4e1712fcc.jpeg?im_w=720"
    ],
    "checkIn": "15:00",
    "checkOut": "11:00",
    "cancellationPolicy": "Estricta: Reembolso del 50% hasta 7 días antes de la llegada. updated",
    "amenities": [46, 50, 79, 88],
    "wifiDetails": {
      "network": "VillaSol_Guest_updated",
      "password": "vacacionesperfectas2026-updated"
    },
    "currency": "COP"
  },
  "externalPmsIds": [
    {
      "sourcePmsId": 100,
      "externalId": "1476977613990701381"
    }
  ],
  "statusRecordId": 6
}
```

**Nota:** El campo `userUuid` NO es obligatorio. El backend lo extrae automáticamente del token de autenticación de la request.

**Validaciones:**
- `userUuid`: **NO requerido** (el backend lo extrae del token de autenticación)
- `name`: Requerido, máximo 120 caracteres
- `description`: Opcional, texto
- `email`: Requerido, formato email, máximo 60 caracteres
- `phone`: Opcional, máximo 60 caracteres
- `address`: Requerido, máximo 255 caracteres
- `addressDetail`: Opcional, máximo 255 caracteres
- `city`: Requerido, máximo 120 caracteres
- `state`: Requerido, máximo 120 caracteres
- `countryId`: Requerido, debe existir en countries
- `latitude`: Opcional, entre -90 y 90, requerido si se envía longitude
- `longitude`: Opcional, entre -180 y 180, requerido si se envía latitude
- `timezone`: Opcional, máximo 120 caracteres, debe ser timezone válido
- `propertyTypeId`: Requerido, debe existir en catálogos (catalog_category_id = 14)
- `statusRecordId`: Requerido, debe existir en catálogos (catalog_category_id = 3)
- `extra.picturesUrl`: Opcional, array de URLs válidas, máximo 500 caracteres cada una
- `extra.checkIn`: Opcional, formato hora (HH:mm), máximo 10 caracteres
- `extra.checkOut`: Opcional, formato hora (HH:mm), máximo 10 caracteres
- `extra.cancellationPolicy`: Opcional, texto
- `extra.amenities`: Opcional, array de IDs que deben existir en catálogos (catalog_category_id = 10)
- `extra.wifiDetails.network`: Opcional, máximo 100 caracteres
- `extra.wifiDetails.password`: Opcional, máximo 100 caracteres
- `externalPmsIds`: Opcional, array
- `externalPmsIds[].sourcePmsId`: Requerido si se envía array, debe existir en catálogos (catalog_category_id = 12), no duplicar en el mismo request
- `externalPmsIds[].externalId`: Requerido si se envía array, máximo 60 caracteres

**Respuesta Exitosa:**
```json
{
  "success": true,
  "message": "Propiedad creada exitosamente",
  "data": {
    "property": {
      "id": 1,
      "uuid": "018cac05-1234-5678-abcd-1234567890ab",
      "user_id": 1,
      "name": "Villa del Sol",
      "email": "contacto@villa.com",
      "city": "Cali",
      "state": "Valle del Cauca",
      "country_id": 48
    }
  }
}
```

---

### 2. Listar Propiedades

**Endpoint:** `GET /properties`

**Headers:** Requiere token de autenticación

**Parámetros de Query (Filtros Opcionales):**

Puedes filtrar las propiedades usando los siguientes parámetros:

| Parámetro | Operadores | Descripción | Ejemplo |
|-----------|-----------|-------------|---------|
| `userUuid` | `[eq]` | Filtrar por UUID del usuario | `userUuid[eq]=018cac04-4119-710b-a52f-8610b4b68aa3` |
| `name` | `[eq]`, `[has]` | Filtrar por nombre de la propiedad | `name[has]=villa` |
| `city` | `[eq]`, `[has]` | Filtrar por ciudad | `city[eq]=Cali` |
| `state` | `[eq]`, `[has]` | Filtrar por estado/departamento | `state[has]=valle` |
| `countryId` | `[eq]`, `[neq]` | Filtrar por ID del país | `countryId[eq]=48` |
| `statusRecordId` | `[eq]`, `[neq]` | Filtrar por estado de registro | `statusRecordId[eq]=6` |

**Ejemplos de uso:**

```bash
# Obtener todas las propiedades del usuario autenticado
GET /properties

# Buscar propiedades por nombre
GET /properties?name[has]=villa

# Filtrar por ciudad
GET /properties?city[eq]=Cali

# Filtrar por estado
GET /properties?state[has]=valle

# Filtrar por país
GET /properties?countryId[eq]=48

# Filtrar por estado de registro (activas)
GET /properties?statusRecordId[eq]=6

# Combinar múltiples filtros
GET /properties?city[eq]=Cali&statusRecordId[eq]=6
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "uuid": "018cac05-1234-5678-abcd-1234567890ab",
      "user_id": 1,
      "name": "Villa del Sol",
      "description": "Hermosa villa con vista al mar",
      "email": "contacto@villa.com",
      "phone": "+5730030030000",
      "address": "Calle 123 #45-67",
      "address_detail": "Torre A, Apto 901",
      "city": "Cali",
      "state": "Valle del Cauca",
      "country_id": 48,
      "geo_location": "3.4516,-76.5320",
      "timezone": "America/Bogota",
      "extra": {
        "picturesUrl": ["https://example.com/image1.jpg"],
        "checkIn": "15:00",
        "checkOut": "11:00",
        "amenities": [47, 50, 54],
        "wifiDetails": {
          "network": "VillaSol_Guest",
          "password": "vacaciones2026"
        }
      },
      "status_record_id": 6,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

### 3. Obtener Propiedad por UUID

**Endpoint:** `GET /properties/{property_uuid}`

**Parámetros de URL:**
- `property_uuid`: UUID de la propiedad

**Headers:** Requiere token de autenticación

**Ejemplo:**
```
GET /properties/018cac05-1234-5678-abcd-1234567890ab
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "uuid": "018cac05-1234-5678-abcd-1234567890ab",
    "user_id": 1,
    "name": "Villa del Sol",
    "description": "Hermosa villa con vista al mar",
    "email": "contacto@villa.com",
    "phone": "+5730030030000",
    "address": "Calle 123 #45-67",
    "address_detail": "Torre A, Apto 901",
    "city": "Cali",
    "state": "Valle del Cauca",
    "country_id": 48,
    "geo_location": "3.4516,-76.5320",
    "timezone": "America/Bogota",
    "extra": {
      "picturesUrl": ["https://example.com/image1.jpg"],
      "checkIn": "15:00",
      "checkOut": "11:00",
      "amenities": [47, 50, 54],
      "wifiDetails": {
        "network": "VillaSol_Guest",
        "password": "vacaciones2026"
      }
    },
    "status_record_id": 6,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

---

### 4. Actualizar Propiedad

**Endpoint:** `PUT /properties/{property_uuid}` o `PATCH /properties/{property_uuid}`

**Métodos Soportados:**
- **PUT**: Actualización completa (reemplaza todos los campos)
- **PATCH**: Actualización parcial (solo actualiza los campos enviados)

**Parámetros de URL:**
- `property_uuid`: UUID de la propiedad a actualizar

**Headers:** Requiere token de autenticación

**Payload (PUT - Actualización Completa):**

Mismo formato que crear propiedad. Todos los campos requeridos deben enviarse.

```json
{
  "name": "Villa del Sol - Actualizada",
  "description": "Hermosa villa con vista al mar - Renovada",
  "email": "contacto@villa.com",
  "phone": "+5730030030000",
  "address": "Calle 123 #45-67",
  "addressDetail": "Torre A, Apto 901",
  "city": "Cali",
  "state": "Valle del Cauca",
  "countryId": 48,
  "latitude": "3.4516",
  "longitude": "-76.5320",
  "timezone": "America/Bogota",
  "extra": {
    "picturesUrl": ["https://example.com/image1.jpg"],
    "checkIn": "15:00",
    "checkOut": "11:00",
    "amenities": [47, 50, 54, 76],
    "wifiDetails": {
      "network": "VillaSol_Guest",
      "password": "nuevaPassword2026"
    }
  },
  "statusRecordId": 6
}
```

**Payload (PATCH - Actualización Parcial):**

Solo envía los campos que deseas actualizar.

```json
{
  "name": "Villa del Sol - Nombre Actualizado",
  "description": "Nueva descripción actualizada"
}
```

**Nota:** El campo `userUuid` NO es obligatorio. El backend lo extrae automáticamente del token de autenticación.

**Validaciones:** Mismas que crear propiedad (solo para campos enviados en PATCH)

**Respuesta Exitosa:**
```json
{
  "success": true,
  "message": "Propiedad actualizada exitosamente",
  "data": {
    "property": {
      "id": 1,
      "uuid": "018cac05-1234-5678-abcd-1234567890ab",
      "user_id": 1,
      "name": "Villa del Sol - Actualizada",
      "email": "contacto@villa.com",
      "city": "Cali",
      "state": "Valle del Cauca",
      "country_id": 48,
      "updated_at": "2024-03-31T08:10:00Z"
    }
  }
}
```

---

### 5. Eliminar Propiedad

**Endpoint:** `DELETE /properties/{property_uuid}`

**Parámetros de URL:**
- `property_uuid`: UUID de la propiedad

**Headers:** Requiere token de autenticación

**Ejemplo:**
```
DELETE /properties/018cac05-1234-5678-abcd-1234567890ab
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "message": "Propiedad eliminada exitosamente"
}
```

**Nota:** Esta operación realiza un soft delete (marca `deleted_at` con timestamp)

**⚠️ Problema Conocido del Backend:**
Actualmente el endpoint DELETE está retornando error 500 (Internal Server Error) y HTML en lugar de JSON. Este es un bug del backend que debe ser corregido.

---

### 6. Restaurar Propiedad

**Endpoint:** `POST /properties/{property_uuid}/restore`

**Parámetros de URL:**
- `property_uuid`: UUID de la propiedad eliminada (soft delete)

**Headers:** Requiere token de autenticación

**Ejemplo:**
```
POST /properties/018cac05-1234-5678-abcd-1234567890ab/restore
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "message": "Propiedad restaurada exitosamente",
  "data": {
    "property": {
      "id": 1,
      "uuid": "018cac05-1234-5678-abcd-1234567890ab",
      "user_id": 1,
      "name": "Villa del Sol",
      "email": "contacto@villa.com",
      "city": "Cali",
      "state": "Valle del Cauca",
      "country_id": 48,
      "deleted_at": null,
      "updated_at": "2024-03-31T09:43:00Z"
    }
  }
}
```

**Nota:** Este endpoint restaura una propiedad previamente eliminada (limpia el campo `deleted_at`)
---

## Endpoints de Listings (Alojamientos)

### 1. Crear Listing / Unidad

**Endpoint:** `POST /listings`

Este endpoint permite crear una unidad o alojamiento (listing) asociado a una propiedad existente de forma dinámica.

**Mecanismo de Herencia de la Propiedad:**
Para evitar redundancia, el backend implementa una funcionalidad inteligente de herencia para campos comunes de `extra` (`checkIn`, `checkOut`, `cancellationPolicy`, `amenities`, y `wifiDetails`).
- **Si el campo NO se envía en el payload:** El listing heredará automáticamente el valor que tiene configurado su propiedad padre.
- **Si el campo SÍ se envía en el payload:** El valor provisto sobrescribirá la herencia, dándole a este listing información específica y personalizada que reemplaza la info de la propiedad.

**Payload de Ejemplo:**
```json
{
    "propertyUuid": "019d3b98-ad49-7055-8904-1c8794f4d18f",
    "roomTypeId": 16,
    "name": "Apto 102",
    "internalName": "AP102",
    "description": "nueva descripcion 2",
    "thumbnailUrl": "https://a0.muscache.com/im/pictures/prohost-api/Hosting-1476977613990701381/original/f1b3ed75-901d-4b4c-90e2-9be250641371.jpeg?im_w=720",
    "contactName": "Persona encargada 2",
    "contactEmail": "algun@email.com",
    "contactPhone": "+5730030030000",
    "extra": {
        "picturesUrl": [
            "https://a0.muscache.com/im/pictures/prohost-api/Hosting-1476977613990701381/original/f1b3ed75-901d-4b4c-90e2-9be250641371.jpeg?im_w=720",
            "https://a0.muscache.com/im/pictures/prohost-api/Hosting-1476977613990701381/original/b09c9e50-0ec9-4713-96c3-09f4e1712fcc.jpeg?im_w=720"
        ],
        "bedRoom": 2,
        "bathRoom": 1,
        "rooms": 2,
        "maxOccupancy": 4,
        "minNights": 2,
        "maxNights": 30,
        "startPrice": 150000,  // Precio inicial por noche
        "currency": "COP"      // Moneda (opcional, default: COP)
        
        // --- CAMPOS HEREDABLES --- (Opcionales)
        // Si NO incluyes estos campos, heredarán los valores de la propiedad:
        // "checkIn": "15:00",
        // "checkOut": "12:00",
        // "cancellationPolicy": "Estricta: Reembolso del 50%",
        // "amenities": [46, 50, 79, 88, 76, 47],
        // "wifiDetails": {
        //     "network": "VillaSol_Guest_apto101",
        //     "password": "vacacionesperfectas2026-apto101"
        // }
    },
    "externalPmsIds": [
        {
            "sourcePmsId": 100,
            "externalId": "1476977613990701381"
        }
    ],
    "statusRecordId": 6
}
```

**Validaciones y Campos Clave:**
- `propertyUuid`: Requerido. UUID de la propiedad madre.
- `roomTypeId`: Requerido. Tipo de habitación (catalog_category_id = 5).
- `name`: Requerido. Nombre principal de la unidad.
- `internalName`: Opcional. Nombre de uso interno para la administración.
- `extra.picturesUrl`: Opcional. Array de URLs de fotos.
- `extra.bedRoom`, `extra.bathRoom`, `extra.rooms`, `extra.maxOccupancy`: Detalles capacidad de la unidad.
- `extra.startPrice`: Opcional. Precio inicial por noche (número).
- `extra.currency`: Opcional. Moneda del precio (default: "COP").
- `externalPmsIds`: Opcional. Útil para mapear el listing desde otras plataformas PMS (catalog_category_id = 12 para el pms source id).
- `statusRecordId`: Requerido. Estado general de la unidad.

---

## Endpoints de Reservaciones

### Resumen de Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/reservations` | Listar reservaciones (con filtros) |
| `POST` | `/reservations` | Crear nueva reservación |
| `GET` | `/reservations/{reservation}` | Obtener reservación por UUID |
| `PUT \| PATCH` | `/reservations/{reservation}` | Actualizar reservación |
| `DELETE` | `/reservations/{reservation}` | Eliminar reservación (soft delete) |
| `POST` | `/reservations/{reservation}/restore` | Restaurar reservación eliminada |

---

### 1. Listar Reservaciones

**Endpoint:** `GET /reservations`

**Headers:** Requiere token de autenticación

**Parámetros de Query (Filtros Opcionales):**

| Parámetro | Operadores | Descripción | Ejemplo |
|-----------|-----------|-------------|---------|
| `listingUuid` | `[eq]` | Filtrar por UUID del listing | `listingUuid[eq]=019d3bbb-...` |
| `reservationSourceId` | `[eq]`, `[neq]` | Filtrar por fuente de reserva | `reservationSourceId[eq]=22` |
| `arrivalDate` | `[eq]`, `[gte]`, `[lte]` | Filtrar por fecha de llegada | `arrivalDate[gte]=2026-05-01` |
| `departureDate` | `[eq]`, `[gte]`, `[lte]` | Filtrar por fecha de salida | `departureDate[lte]=2026-06-01` |
| `statusReservationId` | `[eq]`, `[neq]` | Filtrar por estado de la reserva | `statusReservationId[eq]=27` |
| `emailGuest` | `[eq]`, `[has]` | Filtrar por email del huésped | `emailGuest[has]=gmail` |
| `externalId` | `[eq]` | Filtrar por ID externo | `externalId[eq]=HM4XCBQYYP` |

**Ejemplos de uso:**

```bash
# Obtener todas las reservaciones
GET /reservations

# Filtrar por listing
GET /reservations?listingUuid[eq]=019d3bbb-b91d-706c-b87d-512c42e2c814

# Filtrar por rango de fechas
GET /reservations?arrivalDate[gte]=2026-05-01&departureDate[lte]=2026-06-01

# Filtrar por estado
GET /reservations?statusReservationId[eq]=27

# Combinar múltiples filtros
GET /reservations?listingUuid[eq]=019d3bbb-...&statusReservationId[eq]=27
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "uuid": "019d4f00-1234-7890-abcd-1234567890ab",
      "reservation_source_id": 22,
      "listing_id": 45,
      "external_id": "HMXY789QWE",
      "arrival_date": "2026-05-15",
      "departure_date": "2026-05-20",
      "guest_id": null,
      "email_guest": "ricardo.lombana@gmail.com",
      "total_guests": 3,
      "currency": "USD",
      "total_price": 750.50,
      "extra": {
        "specialRequests": "Cuna para bebé solicitada",
        "estimatedArrivalTime": "14:30",
        "flightNumber": "AV123"
      },
      "status_reservation_id": 27,
      "created_at": "2026-05-01T10:00:00Z",
      "updated_at": "2026-05-01T10:00:00Z",
      "deleted_at": null
    }
  ]
}
```

---

### 2. Crear Reservación

**Endpoint:** `POST /reservations`

**Headers:** Requiere token de autenticación

**Payload:**
```json
{
  "listingUuid": "019d3bbb-b91d-706c-b87d-512c42e2c814",
  "reservationSourceId": 22,
  "externalId": "HMXY789QWE",
  "arrivalDate": "2026-05-15",
  "departureDate": "2026-05-20",
  "guestUuid": "019d4ca0-bb29-7371-9300-833b0b944f52",
  "emailGuest": "ricardo.lombana@gmail.com",
  "totalGuests": 3,
  "currency": "USD",
  "totalPrice": 750.50,
  "statusReservationId": 27,
  "extra": {
    "specialRequests": "Cuna para bebé solicitada",
    "estimatedArrivalTime": "14:30",
    "flightNumber": "AV123"
  }
}
```

**Validaciones:**

| Campo | Requerido | Tipo | Reglas |
|-------|-----------|------|--------|
| `listingUuid` | ✅ | string (UUID) | Debe existir en `listings.uuid` |
| `reservationSourceId` | ✅ | integer | Debe existir en catálogos (`catalog_category_id = 6`) |
| `externalId` | ❌ | string | Máximo 60 caracteres. Código de confirmación externo (Airbnb, Booking, etc.) |
| `arrivalDate` | ✅ | date | Formato `YYYY-MM-DD`. Debe ser fecha futura o actual |
| `departureDate` | ✅ | date | Formato `YYYY-MM-DD`. Debe ser posterior a `arrivalDate` |
| `guestUuid` | ❌ | string (UUID) | Debe existir en `guests.uuid`. Vincula un huésped existente. Queda `null` si no se envía (el huésped lo completa durante el check-in) |
| `emailGuest` | ✅ | string (email) | Máximo 60 caracteres. Email del huésped para enviar link de check-in |
| `totalGuests` | ✅ | integer | Mínimo 1, default 1. Número total de huéspedes |
| `currency` | ✅ | string | Exactamente 3 caracteres. Código ISO 4217 (COP, USD, EUR, etc.) |
| `totalPrice` | ✅ | numeric | Precio total de la reserva. Acepta decimales |
| `statusReservationId` | ✅ | integer | Debe existir en catálogos (`catalog_category_id = 7`) |
| `extra` | ❌ | object | JSON libre para datos adicionales |

**Campos comunes en `extra`:**

| Campo Extra | Tipo | Descripción |
|-------------|------|-------------|
| `extra.guest_name` | string | Nombre temporal del huésped (antes del check-in) |
| `extra.guest_phone` | string | Teléfono/WhatsApp del huésped |
| `extra.specialRequests` | string | Solicitudes especiales |
| `extra.estimatedArrivalTime` | string | Hora estimada de llegada (HH:mm) |
| `extra.flightNumber` | string | Número de vuelo |
| `extra.arrival_time` | string | Hora de llegada confirmada |
| `extra.departure_time` | string | Hora de salida |
| `extra.arrival_flight` | string | Vuelo de llegada |
| `extra.departure_flight` | string | Vuelo de salida |

**Respuesta Exitosa:**
```json
{
  "success": true,
  "message": "Reservación creada exitosamente",
  "data": {
    "reservation": {
      "id": 1,
      "uuid": "019d4f00-1234-7890-abcd-1234567890ab",
      "listing_id": 45,
      "reservation_source_id": 22,
      "external_id": "HMXY789QWE",
      "arrival_date": "2026-05-15",
      "departure_date": "2026-05-20",
      "guest_id": null,
      "email_guest": "ricardo.lombana@gmail.com",
      "total_guests": 3,
      "currency": "USD",
      "total_price": 750.50,
      "status_reservation_id": 27,
      "created_at": "2026-05-01T10:00:00Z"
    }
  }
}
```

**Nota:** El campo `guest_id` queda como `null` hasta que el huésped complete el check-in online. En ese momento se crea el registro en `guests` y se actualiza la reserva con `PUT`.

---

### 3. Obtener Reservación por UUID

**Endpoint:** `GET /reservations/{reservation_uuid}`

**Parámetros de URL:**
- `reservation_uuid`: UUID de la reservación

**Headers:** Requiere token de autenticación

**Ejemplo:**
```
GET /reservations/019d4f00-1234-7890-abcd-1234567890ab
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "uuid": "019d4f00-1234-7890-abcd-1234567890ab",
    "reservation_source_id": 22,
    "listing_id": 45,
    "external_id": "HMXY789QWE",
    "arrival_date": "2026-05-15",
    "departure_date": "2026-05-20",
    "guest_id": null,
    "email_guest": "ricardo.lombana@gmail.com",
    "total_guests": 3,
    "currency": "USD",
    "total_price": 750.50,
    "extra": {
      "specialRequests": "Cuna para bebé solicitada",
      "estimatedArrivalTime": "14:30",
      "flightNumber": "AV123"
    },
    "status_reservation_id": 27,
    "created_at": "2026-05-01T10:00:00Z",
    "updated_at": "2026-05-01T10:00:00Z",
    "deleted_at": null
  }
}
```

---

### 4. Actualizar Reservación

**Endpoint:** `PUT /reservations/{reservation_uuid}` o `PATCH /reservations/{reservation_uuid}`

**Métodos Soportados:**
- **PUT**: Actualización completa (reemplaza todos los campos)
- **PATCH**: Actualización parcial (solo actualiza los campos enviados)

**Parámetros de URL:**
- `reservation_uuid`: UUID de la reservación a actualizar

**Headers:** Requiere token de autenticación

**Payload (PUT - Actualización Completa):**

Mismo formato que crear reservación. Todos los campos requeridos deben enviarse.

```json
{
  "listingUuid": "019d3bbb-b91d-706c-b87d-512c42e2c814",
  "reservationSourceId": 22,
  "externalId": "HMXY789QWE",
  "arrivalDate": "2026-05-16",
  "departureDate": "2026-05-21",
  "emailGuest": "ricardo.lombana@gmail.com",
  "totalGuests": 4,
  "currency": "USD",
  "totalPrice": 900.00,
  "statusReservationId": 27,
  "extra": {
    "specialRequests": "Cuna para bebé + cama extra",
    "estimatedArrivalTime": "16:00",
    "flightNumber": "AV456"
  }
}
```

**Payload (PATCH - Actualización Parcial):**

Solo envía los campos que deseas actualizar.

```json
{
  "totalGuests": 4,
  "totalPrice": 900.00,
  "statusReservationId": 28
}
```

**Caso de uso común — Asignar huésped tras check-in:**
```json
{
  "guestUuid": "019d4ca0-bb29-7371-9300-833b0b944f52"
}
```

**Validaciones:** Mismas que crear reservación (solo para campos enviados en PATCH)

**Respuesta Exitosa:**
```json
{
  "success": true,
  "message": "Reservación actualizada exitosamente",
  "data": {
    "reservation": {
      "id": 1,
      "uuid": "019d4f00-1234-7890-abcd-1234567890ab",
      "listing_id": 45,
      "total_guests": 4,
      "total_price": 900.00,
      "status_reservation_id": 28,
      "updated_at": "2026-05-02T14:30:00Z"
    }
  }
}
```

---

### 5. Eliminar Reservación

**Endpoint:** `DELETE /reservations/{reservation_uuid}`

**Parámetros de URL:**
- `reservation_uuid`: UUID de la reservación

**Headers:** Requiere token de autenticación

**Ejemplo:**
```
DELETE /reservations/019d4f00-1234-7890-abcd-1234567890ab
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "message": "Reservación eliminada exitosamente"
}
```

**Nota:** Esta operación realiza un soft delete (marca `deleted_at` con timestamp)

---

### 6. Restaurar Reservación

**Endpoint:** `POST /reservations/{reservation_uuid}/restore`

**Parámetros de URL:**
- `reservation_uuid`: UUID de la reservación eliminada (soft delete)

**Headers:** Requiere token de autenticación

**Ejemplo:**
```
POST /reservations/019d4f00-1234-7890-abcd-1234567890ab/restore
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "message": "Reservación restaurada exitosamente",
  "data": {
    "reservation": {
      "id": 1,
      "uuid": "019d4f00-1234-7890-abcd-1234567890ab",
      "listing_id": 45,
      "email_guest": "ricardo.lombana@gmail.com",
      "deleted_at": null,
      "updated_at": "2026-05-03T09:00:00Z"
    }
  }
}
```

**Nota:** Este endpoint restaura una reservación previamente eliminada (limpia el campo `deleted_at`)

---

### Catálogos Relacionados con Reservaciones

| Catálogo | category_id | Endpoint | Uso |
|----------|-------------|----------|-----|
| `reservation_source` | 6 | `GET /catalogs?catalogCategoryName[eq]=reservation_source` | Canal/fuente de la reserva (Airbnb, Booking, Directo, etc.) |
| `status_reservation` | 7 | `GET /catalogs?catalogCategoryName[eq]=status_reservation` | Estado de la reserva (Pendiente, Confirmada, Cancelada, etc.) |
| `currencies` | — | `GET /catalogs/category/currencies` | Monedas disponibles (COP, USD, EUR, etc.) |

#### Valores de `reservation_source` (category_id = 6)

| id | name (es) | name (en) | slug | order |
|----|-----------|-----------|------|-------|
| 21 | Directo | Direct | `direct` | 1 |
| 22 | Airbnb | Airbnb | `airbnb` | 2 |
| 23 | Booking.com | Booking.com | `booking` | 3 |
| 24 | Vrbo | Vrbo | `vrbo` | 4 |
| 25 | Despegar | Despegar | `despegar` | 5 |
| 26 | Expedia | Expedia | `expedia` | 6 |
| 107 | Desconocido | Unknown | `unknow` | 999 |

> **Nota importante:** El campo `slug` es clave para el endpoint de check-in externo. Es el valor que se usa en la URL `/checkin/{sourceSlug}/{listingUuid}/{externalId}`.

#### Valores de `status_reservation` (category_id = 7)

| id | name (es) | name (en) | order |
|----|-----------|-----------|-------|
| 27 | Confirmada | Confirmed | 1 |
| 28 | En Progreso | In Progress | 2 |
| 29 | Cancelada | Cancelled | 3 |
| 30 | Finalizada | Closed | 4 |
| 108 | Eliminada | Deleted | 5 |
| 109 | Desconocido | Unknown | 6 |

#### Valores de `gender` (category_id = 15)

| id | name (es) | name (en) |
|----|-----------|----------|
| 113 | Mujer | Female |
| 114 | Hombre | Male |
| 115 | Indeterminado | Indeterminated |

---

### Endpoints de Check-in (Portales de entrada)

El backend expone **2 formatos de URL** para que el guest acceda al portal de check-in. Ver **sección 8** para el flujo completo v4.1 con todos los payloads.

#### Escenario 1 — Reserva con UUID interno

**Endpoint:** `GET /checkin/{reservationUuid}`

```
GET /checkin/019d4f00-1234-7890-abcd-1234567890ab
```

**Uso:** `https://app.hitguest.com/checkin/019d4f00-1234-7890-abcd-1234567890ab`

---

#### Escenario 2 — Reserva externa (Airbnb, Booking, etc.)

**Endpoint:** `GET /checkin/{sourceSlug}/{listingUuid}/{externalId}`

**Parámetros de URL:**
| Parámetro | Tipo | Descripción | Ejemplo |
|-----------|------|-------------|---------|
| `sourceSlug` | string | Slug del catálogo `reservation_source` | `airbnb`, `booking`, `vrbo` |
| `listingUuid` | string (UUID) | UUID del listing en HitGuest | `019d3bbb-b91d-706c-b87d-512c42e2c814` |
| `externalId` | string | Código de confirmación de la plataforma externa | `HM4XCBQYYP` |

```
GET /checkin/airbnb/019d3bbb-b91d-706c-b87d-512c42e2c814/HM4XCBQYYP
```

**Uso:** `https://app.hitguest.com/checkin/airbnb/019d3bbb-b91d-706c-b87d-512c42e2c814/HM4XCBQYYP`

> Ver **sección 8.1** para la estructura exacta del response.

> ❌ **DEPRECATED:** `POST /checkin/{reservationUuid}/guest` → **410 GONE**. No usar. Reemplazado por `/identify` + `/main/complete` + `/secondary/{uuid}/complete` (ver sección 8).

---

### Flujo Típico de una Reservación

```
CREACIÓN:
1. Admin crea reservación manual     → POST /reservations (guest_id = null)
   — ó —
   Webhook de PMS crea reservación   → POST /reservations (automático)

LINK DE CHECK-IN (2 formatos posibles):
2a. Reserva interna (UUID)           → https://app.hitguest.com/checkin/{reservationUuid}
2b. Reserva externa (Airbnb, etc.)   → https://app.hitguest.com/checkin/{sourceSlug}/{listingUuid}/{externalId}

PROCESO DE CHECK-IN:
3. Frontend resuelve la reserva      → GET /checkin/{...} (según formato del link)
4. Huésped llena formularios         → Paso 2: datos personales + Paso 3: foto documento
5. Frontend envía por cada huésped   → POST /checkin/{reservationUuid}/guest
   (el backend crea guest, reservation_guest, y vincula al titular)

GESTIÓN:
6. Admin puede ver/editar            → GET/PUT /reservations/{uuid}
7. Cancelar si es necesario          → DELETE /reservations/{uuid}
8. Restaurar si fue error            → POST /reservations/{uuid}/restore
```

---

## Categorías de Catálogos

| ID | Nombre | Descripción | Uso Principal |
|----|--------|-------------|---------------|
| 1 | `person_type` | Tipo de persona | Registro de usuarios (Natural/Jurídica) |
| 2 | `identification_type` | Tipo de identificación | Registro de usuarios (CC, CE, NIT, etc.) |
| 3 | `status_record` | Estado de registro | Estado general de registros (Activo, Inactivo, etc.) |
| 4 | `status_integration` | Estado de integración | Estado de integraciones con sistemas externos |
| 5 | `room_type` | Tipo de habitación | Clasificación de listings (Habitación, Apartamento, etc.) |
| 6 | `reservation_source` | Fuente de reserva | Origen de la reserva (Airbnb, Booking, Directo, etc.) |
| 7 | `status_reservation` | Estado de reserva | Estado de reservas (Confirmada, Cancelada, etc.) |
| 8 | `reason_for_trip` | Razón de viaje | Motivo del viaje del huésped |
| 9 | `payment_method` | Método de pago | Formas de pago aceptadas |
| 10 | `amenities` | Amenidades | Servicios y comodidades (WiFi, Piscina, etc.) |
| 11 | `listing_document_type` | Tipo de documento de listing | Documentos asociados a listings |
| 12 | `source_pms` | Sistema PMS fuente | Sistemas de gestión de propiedades |
| 13 | `person_verification` | Verificación de persona | Tipos de verificación de identidad |
| 14 | `property_type` | Tipo de propiedad | Clasificación de propiedades (Hotel, Apartamento, etc.) |
| 15 | `gender` | Género | Género del huésped en el check-in (Mujer=113, Hombre=114, Indeterminado=115) |

---

## Estructura de Base de Datos

### Tabla: users
Almacena información de usuarios del sistema.

**Campos principales:**
- `id`: ID único
- `uuid`: UUID único
- `email`: Email único
- `name`: Nombre
- `phone`: Teléfono
- `status_record_id`: Estado del usuario

---

### Tabla: properties
Almacena información de propiedades.

**Campos principales:**
- `id`: ID único
- `uuid`: UUID único
- `user_id`: ID del usuario propietario (FK a users)
- `external_id`: ID externo (opcional)
- `name`: Nombre de la propiedad (máx 120 caracteres)
- `description`: Descripción (texto)
- `email`: Email de contacto (máx 60 caracteres)
- `phone`: Teléfono de contacto (máx 60 caracteres)
- `address`: Dirección (máx 255 caracteres)
- `address_detail`: Detalle de dirección (máx 255 caracteres)
- `city`: Ciudad (máx 120 caracteres)
- `state`: Estado/Departamento (máx 120 caracteres)
- `country_id`: ID del país (FK a countries)
- `geo_location`: Coordenadas "latitude,longitude" (máx 60 caracteres)
- `timezone`: Zona horaria (máx 120 caracteres)
- `extra`: JSON con datos adicionales (picturesUrl, checkIn, checkOut, amenities, wifiDetails)
- `status_record_id`: Estado de la propiedad (FK a catalogs)
- `created_at`, `updated_at`, `deleted_at`: Timestamps

**Índices:**
- `uuid` (único)
- `user_id`
- `external_id`
- `country_id`
- `status_record_id`

---

### Tabla: listings
Almacena unidades/habitaciones dentro de propiedades.

**Campos principales:**
- `id`: ID único
- `uuid`: UUID único
- `user_id`: ID del usuario (FK a users)
- `property_id`: ID de la propiedad (FK a properties)
- `name`: Nombre del listing (máx 120 caracteres)
- `internal_name`: Nombre interno (máx 15 caracteres)
- `room_type_id`: Tipo de habitación (FK a catalogs, category_id = 5)
- `description`: Descripción (texto)
- `thumbnail_url`: URL de imagen principal (máx 255 caracteres)
- `contact_name`: Nombre de contacto (máx 255 caracteres)
- `contact_email`: Email de contacto (máx 60 caracteres)
- `contact_phone`: Teléfono de contacto (máx 60 caracteres)
- `extra`: JSON con datos adicionales (pictures_url, bed_room, bath_room, rooms, max_occupancy, min_nights, max_nights, channels, check_in, check_out, wifi_details, amenities, cancellation_policy)
- `status_record_id`: Estado del listing (FK a catalogs)
- `created_at`, `updated_at`, `deleted_at`: Timestamps

---

### Tabla: listing_external_ids
Almacena IDs externos de listings (para integraciones).

**Campos principales:**
- `id`: ID único
- `listing_id`: ID del listing (FK a listings)
- `source_pms_id`: ID del sistema PMS fuente (FK a catalogs, category_id = 12)
- `external_id`: ID externo (máx 60 caracteres)

---

### Tabla: listing_documents
Almacena documentos asociados a listings.

**Campos principales:**
- `id`: ID único
- `listing_id`: ID del listing (FK a listings)
- `listing_document_type_id`: Tipo de documento (FK a catalogs, category_id = 11)
- `content`: Contenido del documento (texto)
- `status_record_id`: Estado del documento (FK a catalogs)
- `created_at`, `updated_at`, `deleted_at`: Timestamps

---

### Tabla: reservations
Almacena reservas.

**Campos principales:**
- `id`: ID único
- `uuid`: UUID único
- `reservation_source_id`: Fuente de la reserva (FK a catalogs, category_id = 6)
- `listing_id`: ID del listing (FK a listings)
- `external_id`: ID externo de la reserva (máx 60 caracteres)
- `arrival_date`: Fecha de llegada
- `departure_date`: Fecha de salida
- `guest_id`: ID del huésped principal (FK a guests)
- `email_guest`: Email del huésped (máx 60 caracteres)
- `total_guests`: Total de huéspedes (default 1)
- `currency`: Moneda (máx 3 caracteres)
- `total_price`: Precio total
- `extra`: JSON con datos adicionales
- `status_reservation_id`: Estado de la reserva (FK a catalogs, category_id = 7)
- `created_at`, `updated_at`, `deleted_at`: Timestamps

---

### Tabla: reservation_guests
Relación entre reservas y huéspedes.

**Campos principales:**
- `id`: ID único
- `reservation_uuid`: UUID de la reserva (FK a reservations.uuid)
- `guest_id`: ID del huésped (FK a guests)
- `external_id`: ID externo (máx 60 caracteres)
- `extra`: JSON con datos adicionales (document_country_id, country_of_origin_id, country_destination_id, city_of_origin, reason_for_trip_id, document_image_1, document_image_2)
- `created_at`, `updated_at`: Timestamps

---

### Tabla: guests
Almacena información de huéspedes.

**Campos principales:**
- `id`: ID único
- `uuid`: UUID único
- `name`: Nombre (máx 120 caracteres)
- `lastname`: Apellido (máx 60 caracteres)
- `nationality_id`: Nacionalidad (FK a countries)
- `gender_id`: Género (FK a catalogs)
- `identification_type_id`: Tipo de identificación (FK a catalogs, category_id = 2)
- `identificacion_number`: Número de identificación (máx 30 caracteres)
- `date_of_birth`: Fecha de nacimiento
- `email`: Email (máx 255 caracteres)
- `phone`: Teléfono (máx 60 caracteres)
- `city_of_residence`: Ciudad de residencia (máx 120 caracteres)
- `country_of_residence_id`: País de residencia (FK a countries)
- `extra`: JSON con datos adicionales
- `created_at`, `updated_at`: Timestamps

**Índices:**
- `uuid` (único)
- `identification_type_id`, `identificacion_number` (compuesto)
- `nationality_id`
- `gender_id`
- `country_of_residence_id`

---

### Tabla: guest_verifications
Almacena verificaciones de huéspedes.

**Campos principales:**
- `id`: ID único
- `guest_id`: ID del huésped (FK a guests)
- `person_verification_id`: Tipo de verificación (FK a catalogs, category_id = 13)
- `created_at`, `updated_at`: Timestamps

---

### Tabla: catalogs
Almacena catálogos generales del sistema.

**Campos principales:**
- `id`: ID único
- `catalog_category_id`: ID de la categoría de catálogo
- `name`: Nombre del catálogo
- `code`: Código único
- `status`: Estado (ACT/INA)
- `extra`: JSON con datos adicionales

---

### Tabla: countries
Almacena información de países.

**Campos principales:**
- `id`: ID único
- `name`: Nombre del país
- `iso2`: Código ISO2 (2 caracteres)
- `iso3`: Código ISO3 (3 caracteres)
- `phone_code`: Código telefónico
- `capital`: Capital
- `currency`: Código de moneda
- `currency_name`: Nombre de la moneda
- `currency_symbol`: Símbolo de la moneda
- `region`: Región
- `subregion`: Subregión
- `timezones`: JSON con zonas horarias

---

## Ejemplos de Payloads

### Registro de Usuario Natural

```json
{
  "personTypeId": 1,
  "name": "María",
  "lastname": "González",
  "identificationTypeId": 5,
  "identificationNumber": "1234567890",
  "email": "maria@example.com",
  "phone": "+573001234567",
  "city": "Bogotá",
  "state": "Cundinamarca",
  "countryId": 48,
  "password": "SecurePass123!",
  "password_confirmation": "SecurePass123!"
}
```

### Registro de Usuario Jurídico

```json
{
  "personTypeId": 2,
  "name": "Hoteles del Caribe S.A.S.",
  "lastname": "-",
  "identificationTypeId": 6,
  "identificationNumber": "900123456-7",
  "email": "contacto@hotelesdelcaribe.com",
  "phone": "+573051234567",
  "city": "Cartagena",
  "state": "Bolívar",
  "countryId": 48,
  "password": "HotelesCaribe2026!",
  "password_confirmation": "HotelesCaribe2026!"
}
```

### Propiedad Completa con Todas las Opciones

```json
{
  "name": "Casa de Playa Paradise",
  "description": "Hermosa casa frente al mar con todas las comodidades para unas vacaciones inolvidables. Capacidad para 8 personas, 4 habitaciones, 3 baños.",
  "email": "reservas@casaparadise.com",
  "phone": "+573201234567",
  "address": "Carrera 1 #10-50",
  "addressDetail": "Sector Playa Blanca",
  "city": "Santa Marta",
  "state": "Magdalena",
  "countryId": 48,
  "latitude": "11.2408",
  "longitude": "-74.2120",
  "timezone": "America/Bogota",
  "extra": {
    "picturesUrl": [
      "https://example.com/casa-paradise/exterior.jpg",
      "https://example.com/casa-paradise/sala.jpg",
      "https://example.com/casa-paradise/cocina.jpg",
      "https://example.com/casa-paradise/habitacion1.jpg",
      "https://example.com/casa-paradise/piscina.jpg"
    ],
    "checkIn": "15:00",
    "checkOut": "11:00",
    "cancellationPolicy": "Flexible: Reembolso completo hasta 24 horas antes del check-in. Después de ese tiempo, se cobra el 50% del total.",
    "amenities": [47, 50, 54, 76, 79, 87, 91, 95],
    "wifiDetails": {
      "network": "CasaParadise_5G",
      "password": "Paradise2026!"
    }
  },
  "externalPmsIds": [
    {
      "sourcePmsId": 100,
      "externalId": "AIRBNB-987654321"
    },
    {
      "sourcePmsId": 101,
      "externalId": "BOOKING-123456789"
    }
  ],
  "statusRecordId": 6
}
```

### Propiedad Mínima (Campos Requeridos)

```json
{
  "name": "Apartamento Centro",
  "email": "contacto@apartamento.com",
  "address": "Calle 50 #30-20",
  "city": "Medellín",
  "state": "Antioquia",
  "countryId": 48,
  "statusRecordId": 6
}
```

---

## Validaciones y Reglas

### Reglas de Registro de Usuario

```javascript
{
  personTypeId: {
    required: true,
    type: 'integer',
    exists: 'catalogs.id where catalog_category_id = 1'
  },
  name: {
    required: true,
    type: 'string',
    maxLength: 120
  },
  lastname: {
    required: false,
    type: 'string',
    maxLength: 120
  },
  identificationTypeId: {
    required: true,
    type: 'integer',
    exists: 'catalogs.id where catalog_category_id = 2'
  },
  identificationNumber: {
    required: true,
    maxLength: 30,
    unique: 'clients.identification_number where identification_type_id = {identificationTypeId}'
  },
  email: {
    required: true,
    type: 'email',
    maxLength: 60,
    unique: 'users.email'
  },
  phone: {
    required: true,
    type: 'string',
    maxLength: 60
  },
  city: {
    required: true,
    type: 'string',
    maxLength: 120
  },
  state: {
    required: true,
    type: 'string',
    maxLength: 120
  },
  countryId: {
    required: true,
    type: 'integer',
    exists: 'countries.id'
  },
  statusRecordId: {
    required: true,
    type: 'integer',
    exists: 'catalogs.id where catalog_category_id = 3',
    note: 'NO enviar en el payload, lo llena el backend automáticamente'
  },
  password: {
    required: true,
    minLength: 8,
    confirmed: true
  }
}
```

### Reglas de Creación de Propiedad

```javascript
{
  user_id: {
    required: true,
    exists: 'users.id'
  },
  name: {
    required: true,
    type: 'string',
    maxLength: 120
  },
  description: {
    required: false,
    type: 'string'
  },
  email: {
    required: true,
    type: 'email',
    maxLength: 60
  },
  phone: {
    required: false,
    type: 'string',
    maxLength: 60
  },
  address: {
    required: true,
    type: 'string',
    maxLength: 255
  },
  address_detail: {
    required: false,
    type: 'string',
    maxLength: 255
  },
  city: {
    required: true,
    type: 'string',
    maxLength: 120
  },
  state: {
    required: true,
    type: 'string',
    maxLength: 120
  },
  country_id: {
    required: true,
    exists: 'countries.id'
  },
  latitude: {
    required: false,
    type: 'numeric',
    between: [-90, 90],
    requiredWith: 'longitude'
  },
  longitude: {
    required: false,
    type: 'numeric',
    between: [-180, 180],
    requiredWith: 'latitude'
  },
  timezone: {
    required: false,
    type: 'string',
    maxLength: 120,
    validTimezone: true
  },
  status_record_id: {
    required: true,
    type: 'integer',
    exists: 'catalogs.id where catalog_category_id = 3'
  },
  external_identifiers: {
    required: false,
    type: 'array'
  },
  'external_identifiers.*.source_pms_id': {
    requiredWith: 'external_identifiers',
    type: 'integer',
    exists: 'catalogs.id where catalog_category_id = 12',
    noDuplicates: true
  },
  'external_identifiers.*.external_id': {
    requiredWith: 'external_identifiers',
    type: 'string',
    maxLength: 60
  },
  extra: {
    required: false,
    type: 'object'
  },
  'extra.pictures_url': {
    required: false,
    type: 'array'
  },
  'extra.pictures_url.*': {
    type: 'url',
    maxLength: 500
  },
  'extra.check_in': {
    required: false,
    type: 'string',
    maxLength: 10
  },
  'extra.check_out': {
    required: false,
    type: 'string',
    maxLength: 10
  },
  'extra.cancellation_policy': {
    required: false,
    type: 'string'
  },
  'extra.amenities': {
    required: false,
    type: 'array'
  },
  'extra.amenities.*': {
    type: 'integer',
    exists: 'catalogs.id where catalog_category_id = 10'
  },
  'extra.wifi_details': {
    required: false,
    type: 'object'
  },
  'extra.wifi_details.network': {
    required: false,
    type: 'string',
    maxLength: 100
  },
  'extra.wifi_details.password': {
    required: false,
    type: 'string',
    maxLength: 100
  }
}
```

---

### Reglas de Creación de Reservación

```javascript
{
  listing_uuid: {
    required: true,
    type: 'uuid',
    exists: 'listings.uuid'
  },
  reservation_source_id: {
    required: true,
    type: 'integer',
    exists: 'catalogs.id where catalog_category_id = 6'
  },
  external_id: {
    required: false,
    type: 'string',
    maxLength: 60
  },
  arrival_date: {
    required: true,
    type: 'date',
    format: 'YYYY-MM-DD',
    afterOrEqual: 'today'
  },
  departure_date: {
    required: true,
    type: 'date',
    format: 'YYYY-MM-DD',
    after: 'arrival_date'
  },
  guest_uuid: {
    required: false,
    type: 'uuid',
    exists: 'guests.uuid',
    note: 'Opcional. Queda null hasta que el huésped complete el check-in online'
  },
  email_guest: {
    required: true,
    type: 'email',
    maxLength: 60
  },
  total_guests: {
    required: true,
    type: 'integer',
    min: 1,
    default: 1
  },
  currency: {
    required: true,
    type: 'string',
    exactLength: 3,
    note: 'Código ISO 4217 (COP, USD, EUR, etc.)'
  },
  total_price: {
    required: true,
    type: 'numeric',
    min: 0,
    note: 'Acepta decimales (ej: 750.50)'
  },
  status_reservation_id: {
    required: true,
    type: 'integer',
    exists: 'catalogs.id where catalog_category_id = 7'
  },
  extra: {
    required: false,
    type: 'object'
  },
  'extra.guest_name': {
    required: false,
    type: 'string',
    maxLength: 120
  },
  'extra.guest_phone': {
    required: false,
    type: 'string',
    maxLength: 60
  },
  'extra.specialRequests': {
    required: false,
    type: 'string'
  },
  'extra.estimatedArrivalTime': {
    required: false,
    type: 'string',
    maxLength: 10,
    note: 'Formato HH:mm'
  },
  'extra.flightNumber': {
    required: false,
    type: 'string',
    maxLength: 30
  },
  'extra.arrival_time': {
    required: false,
    type: 'string',
    maxLength: 10
  },
  'extra.departure_time': {
    required: false,
    type: 'string',
    maxLength: 10
  },
  'extra.arrival_flight': {
    required: false,
    type: 'string',
    maxLength: 30
  },
  'extra.departure_flight': {
    required: false,
    type: 'string',
    maxLength: 30
  }
}
```

---

## Códigos de Error Comunes

### Errores de Validación (422)

```json
{
  "success": false,
  "message": "Los datos proporcionados no son válidos",
  "errors": {
    "email": ["El email ya está registrado"],
    "identificationNumber": ["El número de identificación ya existe para este tipo de documento"]
  }
}
```

### Error de Autenticación (401)

```json
{
  "success": false,
  "message": "No autenticado"
}
```

### Error de Autorización (403)

```json
{
  "success": false,
  "message": "No tiene permisos para realizar esta acción"
}
```

### Error de Recurso No Encontrado (404)

```json
{
  "success": false,
  "message": "Recurso no encontrado"
}
```

### Error del Servidor (500)

```json
{
  "success": false,
  "message": "Error interno del servidor"
}
```

---

## Notas Importantes

1. **Campos Auto-completados por el Backend:**
   - `statusRecordId` en registro de usuario
   - `uuid` en todas las tablas que lo tengan
   - `created_at`, `updated_at` en todas las tablas

2. **Convenciones de Nombres:**
   - Frontend usa **camelCase**: `personTypeId`, `identificationNumber`
   - Backend usa **snake_case**: `person_type_id`, `identification_number`
   - Los servicios deben hacer la conversión correspondiente

3. **Campos JSON (extra):**
   - Se almacenan como JSON en la base de datos
   - Permiten flexibilidad para agregar campos sin modificar el schema
   - Deben validarse según las reglas específicas de cada endpoint

4. **IDs Externos:**
   - Permiten integración con sistemas externos (Airbnb, Booking, etc.)
   - No pueden duplicarse en el mismo request
   - Deben referenciar catálogos válidos de `source_pms`

5. **Coordenadas Geográficas:**
   - Se almacenan como string en formato "latitude,longitude"
   - Ambas deben enviarse juntas o ninguna
   - Latitude: -90 a 90
   - Longitude: -180 a 180

6. **Timezones:**
   - Deben ser timezones válidos de la base de datos IANA
   - Ejemplos: `America/Bogota`, `America/New_York`, `Europe/Madrid`

7. **Amenidades:**
   - Son IDs de catálogos con `catalog_category_id = 10`
   - Se envían como array de números
   - Deben existir en la tabla de catálogos

---

## 8. Endpoints de Check-in v4.1 (Guest Flow)

> **Versión:** 4.1 — Sincronizado con backend a 2026-06-01
> **Autenticación:** Ninguna. Todos los endpoints de check-in son públicos (sin Bearer token).
> **Base URL:** `https://www.kunas.co/api/v1`

### Resumen de endpoints

| Método | Endpoint | Pantalla | Estado |
|--------|----------|----------|--------|
| `GET` | `/checkin/{reservationUuid}` | Portal | ✅ Activo |
| `GET` | `/checkin/{sourceSlug}/{listingUuid}/{externalId}` | Portal (externo) | ✅ Activo |
| `POST` | `/checkin/{reservationUuid}/identify` | Identificación | ✅ Activo |
| `POST` | `/checkin/{reservationUuid}/secondary/{guestUuid}/documents` | Upload OCR | ✅ Activo |
| `GET` | `/checkin/{reservationUuid}/form/{guestUuid}` | Formulario | ✅ Activo |
| `POST` | `/checkin/{reservationUuid}/main/complete` | Completar main | ✅ Activo |
| `POST` | `/checkin/{reservationUuid}/secondary/{guestUuid}/complete` | Completar secundario | ✅ Activo |
| ~~`POST`~~ | ~~`/checkin/{reservationUuid}/guest`~~ | — | ❌ 410 GONE |
| ~~`POST`~~ | ~~`/checkin/{reservationUuid}/didit/session`~~ | — | ❌ 410 GONE |

---

### 8.1 — Portal

**Endpoint:** `GET /checkin/{reservationUuid}`  
**También:** `GET /checkin/{sourceSlug}/{listingUuid}/{externalId}`

**Response:**
```json
{
  "reservation": {
    "uuid": "019d4f00-1234-7890-abcd-1234567890ab",
    "arrivalDate": "2026-06-10",
    "departureDate": "2026-06-15",
    "totalGuestsAllowed": 3
  },
  "progress": {
    "registered": 1,
    "completed": 0,
    "isFullyCompleted": false
  },
  "registeredGuests": [
    {
      "uuid": "018f...",
      "name": "Ricardo",
      "lastname": "Lombana",
      "isMain": true,
      "isCompleted": false
    }
  ]
}
```

**Notas:**
- `reservedGuests` puede ser `[]` si ningún guest se ha identificado aún.
- Para saber si el main guest completó: buscar en `registeredGuests` el de `isMain: true` con `isCompleted: true`.
- `progress.isFullyCompleted = true` → toda la reserva está completa.
- ⚠️ **GAP-01:** No incluye `listingName`. ⚠️ **GAP-02:** No incluye `verificationStatus` por guest.

---

### 8.2 — Identificación del Guest

**Endpoint:** `POST /checkin/{reservationUuid}/identify`  
**Content-Type:** `application/json`

**Request payload:**
```json
{
  "identificationTypeId": 8,
  "identificationNumber": "1234567890",
  "nationalityId": 42,
  "name": "Ricardo",
  "lastname": "Lombana",
  "isMainGuest": true
}
```

| Campo | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| `identificationTypeId` | integer | ✅ | `cat_id=2` (CC, CE, DNI, Pasaporte) |
| `identificationNumber` | string | ✅ | Máx. 30 caracteres |
| `nationalityId` | integer | ✅ | FK `countries.id` |
| `name` | string | ❌ | Se obtiene de Didit/OCR si se omite |
| `lastname` | string | ❌ | Se obtiene de Didit/OCR si se omite |
| `isMainGuest` | boolean | ✅ | `true` para el titular, `false` para acompañantes |

**Response exitoso:**
```json
{
  "guest": {
    "uuid": "018f...",
    "name": "Ricardo",
    "lastname": "Lombana"
  },
  "reservationGuest": {
    "isMainGuest": true,
    "isCheckinCompleted": false
  },
  "verification": {
    "type": "session",
    "url": "https://verify.didit.me/u/JxXnsWmXTy-VGB9-9qI1RA"
  },
  "formSchema": {
    "required_fields": ["country_of_origin_id", "reason_for_trip_id"],
    "optional_fields": [],
    "prefilledData": {
      "name": "Ricardo",
      "lastname": "Lombana",
      "nationalityId": 42
    }
  }
}
```

**Valores posibles de `verification.type`:**

| `type` | Significado | Acción del frontend |
|--------|-------------|---------------------|
| `"session"` | Sesión Didit (biométrica) | Abrir `verification.url` en nueva tab o SDK |
| `"document_upload"` | Textract OCR | Ir al flujo de upload de documentos |
| `"verified_ok"` | Guest ya verificado | Ir directo al formulario |

**Notas importantes:**
- `formSchema.required_fields` y `optional_fields` vienen en **snake_case** (ej: `country_of_origin_id`).
- `formSchema.prefilledData` viene en **camelCase** (ej: `nationalityId`).
- El frontend normaliza ambos internamente mediante `normalizeFormSchema()`.
- Guardar `guest.uuid` y `formSchema` en localStorage — son necesarios para los siguientes pasos.

**Errores:**
- `403` — Guest secundario intentó identificarse antes de que el main complete.
- `409` — Documento ya asociado a otro guest en esta reserva.
- `422` — Capacidad máxima alcanzada o campo inválido.

---

### 8.3 — Upload de Documentos (flujo Textract)

**Endpoint:** `POST /checkin/{reservationUuid}/secondary/{guestUuid}/documents`  
**Content-Type:** `multipart/form-data`

> ⚠️ **Importante:** Este endpoint NO convierte camelCase automáticamente. Los campos del FormData deben enviarse en **snake_case**.

**Request (multipart/form-data):**
```
front_image: [File]   — imagen frontal del documento, máx 10MB
back_image:  [File]   — imagen posterior, máx 10MB (opcional para pasaporte)
```

**Response exitoso:**
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
    "required_fields": ["country_of_origin_id", "reason_for_trip_id"],
    "optional_fields": [],
    "prefilledData": {
      "name": "Maria",
      "lastname": "Gomez",
      "identificationNumber": "987654321"
    }
  }
}
```

**Response de error (OCR fallido):**
```json
{
  "success": false,
  "errorType": "low_quality",
  "message": "Could not extract data from document images.",
  "failedFields": ["documentNumber"]
}
```

**Notas:**
- Las imágenes se guardan en `identity_documents/{guestUuid}/front.jpg` y `back.jpg`.
- `extractedData` viene en camelCase (el backend aplica `camelizeKeys`).
- `formSchema` viene con `required_fields` en snake_case — igual que en `/identify`.

---

### 8.4 — Formulario dinámico

**Endpoint:** `GET /checkin/{reservationUuid}/form/{guestUuid}`

**Response:**
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

**Campos posibles en `required_fields` (snake_case):**

| Campo | Tipo de input | Catálogo/FK |
|-------|---------------|-------------|
| `name` / `lastname` | text | — |
| `email` | email | — |
| `phone` | tel | — |
| `date_of_birth` | date | — |
| `gender_id` | select | `cat_id=15` (ver tabla género) |
| `nationality_id` | select | FK `countries` |
| `city_of_residence` | text | — |
| `country_of_residence_id` | select | FK `countries` |
| `country_of_origin_id` | select | FK `countries` |
| `country_destination_id` | select | FK `countries` |
| `city_of_origin` | text | — |
| `reason_for_trip_id` | select | `cat_id=8` |
| `identification_expiry_date` | date | — |
| `signature` | canvas | Solo main guest |

**Notas:**
- La respuesta está **envuelta** en `{ formSchema: { ... } }` — el frontend hace unwrap automáticamente.
- Los **catálogos NO vienen** en esta respuesta. Cargarlos por separado con `GET /catalogs?...`.
- Si llegaste desde upload (8.3), usar el `formSchema` de ese response — evita una llamada extra.

---

### 8.5 — Completar Main Guest

**Endpoint:** `POST /checkin/{reservationUuid}/main/complete`  
**Content-Type:** `application/json`

**Request payload:**
```json
{
  "guestUuid": "018f...",
  "profile": {
    "name": "Ricardo",
    "lastname": "Lombana",
    "email": "r@example.com",
    "phone": "+57300...",
    "dateOfBirth": "1985-07-20",
    "genderId": 114,
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

**Separación `profile` vs `extra`:**
- `profile` → campos del perfil del guest (guardados en tabla `guests`).
- `extra` → campos adicionales del viaje (guardados en `reservation_guests.extra`).
- Ambos reciben los campos del `required_fields` del formSchema en **camelCase**.

**Response:**
```json
{ "message": "Main guest checkin completed." }
```

**⚠️ Importante:** El response solo devuelve un mensaje. El frontend **debe hacer un GET al portal** (`/checkin/{reservationUuid}`) inmediatamente después para obtener el estado actualizado.

**Validación previa (backend):** La identidad del guest debe estar verificada (`verificationPersonStatus = 'approved'`). Si no, devuelve `403`.

**Post-completion:** El backend dispara automáticamente las automations `on_main_guest_checkin_completed` y desbloquea a los guests secundarios.

---

### 8.6 — Completar Guest Secundario

**Endpoint:** `POST /checkin/{reservationUuid}/secondary/{guestUuid}/complete`  
**Content-Type:** `application/json`

> El `guestUuid` va en la **URL**, NO en el body.

**Request payload:**
```json
{
  "profile": {
    "name": "Maria",
    "lastname": "Gomez",
    "email": "m@example.com",
    "phone": "+57311...",
    "dateOfBirth": "1992-05-10",
    "genderId": 113,
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

**Diferencias vs main guest:**
- Sin `guestUuid` en el body (va en la URL).
- Sin `signature`.
- `profile` incluye campos de documento: `identificationTypeId`, `identificationNumber`, `identificationExpiryDate`.

**Response:**
```json
{ "message": "Secondary guest checkin completed." }
```

**⚠️ Importante:** Igual que en main — hacer GET al portal después para verificar `progress.isFullyCompleted`.

**Validación previa:** Main guest debe tener `is_checkin_completed = true`. Si no, devuelve `403`.

---

### 8.7 — Catálogos necesarios para el check-in

Estos catálogos deben cargarse por separado (NO vienen en el `formSchema`):

| Catálogo | Endpoint | Uso en el form |
|----------|----------|----------------|
| Tipos de documento | `GET /catalogs?status[eq]=ACT&catalogCategoryName[eq]=identification_type` | `identificationTypeId` en identificación |
| Países | `GET /countries` | Nacionalidad, residencia, origen, destino |
| Género | `GET /catalogs?status[eq]=ACT&catalogCategoryName[eq]=gender` | `genderId` (Mujer=113, Hombre=114, Indeterminado=115) |
| Motivo de viaje | `GET /catalogs?status[eq]=ACT&catalogCategoryName[eq]=reason_for_trip` | `reasonForTripId` (cat_id=8) |

---

### 8.8 — Flujo completo de check-in

```
PORTAL
  GET /checkin/{uuid} → reservation + registeredGuests
     │
     └─ IDENTIFICACIÓN
          POST /identify → { guest, verification, formSchema }
               │
               ├─ verification.type = "session"
               │    └─ Abrir verification.url (Didit biométrico)
               │         └─ Polling GET /checkin/{uuid} cada 3s
               │              └─ guest.isCompleted → FORMULARIO
               │
               ├─ verification.type = "document_upload"
               │    └─ POST /secondary/{uuid}/documents (multipart)
               │         └─ extractedData + formSchema → FORMULARIO
               │
               └─ verification.type = "verified_ok"
                    └─ FORMULARIO (directo)

FORMULARIO
  GET /form/{guestUuid} → formSchema (si no viene del paso anterior)
     └─ Submit
          ├─ main   → POST /main/complete → GET portal → portal screen
          └─ sec    → POST /secondary/{uuid}/complete → GET portal
                           └─ isFullyCompleted=true → pantalla final
```

---

## Changelog

### Versión 1.2 (Junio 2026)
- Sección completa de **Endpoints de Check-in v4.1** con 6 endpoints integrados
- Payloads y responses exactos sincronizados con backend real
- Separación `profile` vs `extra` en endpoints de completar
- Documentación de `formSchema` (snake_case en fields, camelCase en prefilledData)
- Nota sobre multipart/form-data (snake_case obligatorio en `/documents`)
- Catálogo de género (category 15) agregado
- Endpoint `POST /guest` marcado como 410 GONE (deprecated)
- Endpoint `POST /didit/session` marcado como 410 GONE (deprecated)

### Versión 1.1 (Abril 2026)
- Documentación de endpoints de Reservaciones (CRUD completo + Restore)
- Payloads de creación y actualización con validaciones
- Catálogos relacionados (`reservation_source`, `status_reservation`)
- Flujo típico de reservación documentado

### Versión 1.0 (Marzo 2026)
- Documentación inicial de la API
- Endpoints de autenticación
- Endpoints de catálogos
- Endpoints de países
- Endpoints de propiedades
- Estructura completa de base de datos
