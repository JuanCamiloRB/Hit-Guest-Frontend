# Check-in Online — Documentación Backend ↔ Frontend

**Fecha:** Abril 2026  
**Estado:** Frontend implementado con mock data — payload del POST confirmado por backend  
**Base URL API:** `https://www.kunas.co/api/v1`

---

## Índice

1. [Resumen de lo implementado](#1-resumen)
2. [Endpoints que el backend debe soportar](#2-endpoints)
3. [Catálogos necesarios](#3-catálogos)
4. [Estructura de rutas del frontend](#4-rutas)
5. [Payload del POST /checkin/{uuid}/guest](#5-payload)
6. [Respuesta esperada del GET /checkin](#6-respuesta-get)
7. [Guía de pruebas](#7-pruebas)
8. [Archivos del frontend relevantes](#8-archivos)

---

## 1. Resumen

Se implementó el flujo completo de check-in online que permite a un huésped registrarse antes de su llegada. El flujo tiene **4 pasos**:

| Paso | Pantalla | Descripción | Endpoint Backend |
|------|----------|-------------|------------------|
| 1 | **Bienvenida** | Muestra datos de la reserva (propiedad, fechas, huéspedes) | `GET /checkin/{...}` |
| 2 | **Datos del Titular** | Formulario de 22 campos del huésped principal | — |
| 3 | **Acompañantes** | Formulario simplificado (12 campos) por cada acompañante | — |
| 4 | **Éxito** | Confirmación con resumen y próximos pasos | `POST /checkin/{uuid}/guest` (se envía en Paso 2/3) |

**Actualmente el frontend funciona con datos mock.** Solo necesita conectarse a los endpoints reales del backend.

---

## 2. Endpoints que el backend debe soportar

### 2.1 `GET /api/v1/checkin/{reservationUuid}`

**Propósito:** Obtener toda la información de la reserva a partir del UUID interno.

**Cuándo se usa:** Cuando el link viene de un PMS integrado o de una reserva manual.

```
GET /api/v1/checkin/019d4f00-1234-7890-abcd-1234567890ab
```

**URL que ve el huésped:**
```
https://app.hitguest.com/checkin/019d4f00-1234-7890-abcd-1234567890ab
```

---

### 2.2 `GET /api/v1/checkin/{sourceSlug}/{listingUuid}/{externalId}`

**Propósito:** Obtener la información de la reserva a partir de la fuente externa + listing + código externo.

**Cuándo se usa:** Cuando el link viene de Airbnb, Booking, etc. (fuentes sin integración directa).

**Parámetros de URL:**
| Parámetro | Tipo | Descripción | Valores posibles |
|-----------|------|-------------|-----------------|
| `sourceSlug` | string | Slug del catálogo `reservation_source` (cat_id=6) | `direct`, `airbnb`, `booking`, `vrbo`, `despegar`, `expedia`, `unknow` |
| `listingUuid` | string (UUID) | UUID del listing en HitGuest | `019d3bbb-b91d-706c-b87d-512c42e2c814` |
| `externalId` | string | Código de confirmación de la plataforma | `HMXY789QWE`, `HM4XCBQYYP` |

```
GET /api/v1/checkin/airbnb/019d3bbb-b91d-706c-b87d-512c42e2c814/HM4XCBQYYP
```

**URL que ve el huésped:**
```
https://app.hitguest.com/checkin/airbnb/019d3bbb-b91d-706c-b87d-512c42e2c814/HM4XCBQYYP
```

---

### 2.3 `POST /api/v1/checkin/{reservationUuid}/guest`

**Propósito:** Guardar los datos de **un huésped** durante el proceso de check-in.

**Cuándo se llama:** 
- Una vez para el huésped **titular** (22 campos completos)
- Una vez por cada **acompañante** (12 campos simplificados)

**El backend debe:**
1. Crear el registro en la tabla `guests`
2. Crear la asociación en `reservation_guests` con los datos extra
3. Si es el titular, vincular el `guest_id` en la tabla `reservations`
4. Actualizar el estado de la reserva si todos los huéspedes fueron registrados

```
POST /api/v1/checkin/019d4f00-1234-7890-abcd-1234567890ab/guest
Content-Type: application/json
```

> ⚠️ Ver sección [5. Payload](#5-payload) para el JSON exacto.

---

## 3. Catálogos necesarios

El frontend usa los siguientes catálogos. **Todos deben estar disponibles vía la API de catálogos.**

### 3.1 `reservation_source` (category_id = 6)

| id | name (es) | name (en) | slug | order |
|----|-----------|-----------|------|-------|
| 21 | Directo | Direct | `direct` | 1 |
| 22 | Airbnb | Airbnb | `airbnb` | 2 |
| 23 | Booking.com | Booking.com | `booking` | 3 |
| 24 | Vrbo | Vrbo | `vrbo` | 4 |
| 25 | Despegar | Despegar | `despegar` | 5 |
| 26 | Expedia | Expedia | `expedia` | 6 |
| 107 | Desconocido | Unknown | `unknow` | 999 |

### 3.2 `status_reservation` (category_id = 7)

| id | name (es) | name (en) | slug | order |
|----|-----------|-----------|------|-------|
| 27 | Confirmada | Confirmed | NULL | 1 |
| 28 | En Progreso | In Progress | NULL | 2 |
| 29 | Cancelada | Cancelled | NULL | 3 |
| 30 | Finalizada | Closed | NULL | 4 |
| 108 | Eliminada | Deleted | NULL | 5 |
| 109 | Desconocido | Unknown | NULL | 6 |

### 3.3 `identification_type` (category_id = 2)

| id | name (es) | name (en) |
|----|-----------|-----------|
| 7 | Cédula de Ciudadanía | Citizenship ID |
| 8 | Cédula de Extranjería | Foreign ID |
| 9 | Pasaporte | Passport |
| 10 | DNI | National ID |
| 11 | NIT | Tax ID |

> **Importante para el front:** Si `identification_type_id = 9` (Pasaporte), solo se pide 1 foto del documento. Para cualquier otro tipo, se piden 2 (frente y reverso).

### 3.4 `gender` (category_id = 15)

| id | name (es) | name (en) |
|----|-----------|-----------|
| 113 | Mujer | Female |
| 114 | Hombre | Male |
| 115 | Indeterminado | Indeterminated |

### 3.5 `reason_for_trip` (category_id = 8)

| id | name (es) | name (en) |
|----|-----------|-----------|
| 31 | Turismo | Tourism |
| 32 | Negocios | Business |
| 33 | Visita familiar | Family Visit |
| 34 | Estudio | Study |
| 35 | Otro | Other |

> ⚠️ Los IDs de `reason_for_trip` son mock del frontend. **El backend debe confirmar los IDs reales.**

### 3.6 `countries` (tabla propia)

```
GET /api/v1/countries
```

Se usa para 5 selectores de país en el formulario del titular:
- País del documento
- Nacionalidad
- País de residencia
- País de origen (de dónde viene)
- País destino

---

## 4. Estructura de rutas del frontend

```
src/app/(guest)/checkin/
│
├── layout.tsx                                    ← Layout compartido (GuestHeader)
│
├── [reservationId]/                              ← Ruta UUID interno
│   ├── page.tsx         → Paso 1: Bienvenida     → GET /checkin/{reservationUuid}
│   ├── guest/page.tsx   → Paso 2: Titular (22 campos)
│   ├── companions/page.tsx → Paso 3: Acompañantes (12 campos × N)
│   └── success/page.tsx → Paso 4: Éxito
│
└── [sourceSlug]/[listingUuid]/[externalId]/      ← Ruta externa
    ├── page.tsx         → Paso 1: Bienvenida     → GET /checkin/{slug}/{listing}/{ext}
    ├── guest/page.tsx   → Paso 2: Titular (22 campos)
    ├── companions/page.tsx → Paso 3: Acompañantes (12 campos × N)
    └── success/page.tsx → Paso 4: Éxito
```

> **Ambas rutas usan los mismos componentes** de `src/features/checkin/components/`. No hay duplicación de lógica.

---

## 5. Payload del POST /checkin/{reservationUuid}/guest

### ✅ Validación confirmada por el backend (Laravel)

El backend usa una estructura **plana** con nombres en **snake_case**:

```php
// Reglas de validación del backend:
'name'                   => ['required', 'string', 'max:120'],
'lastname'               => ['required', 'string', 'max:60'],
'identification_type_id' => ['required', 'integer', 'exists:catalogs,id'],
'identificacion_number'  => ['required', 'string', 'max:30'],
'date_of_birth'          => ['required', 'date', 'date_format:Y-m-d'],
'email'                  => ['required', 'email', 'max:255'],
'phone'                  => ['required', 'string', 'max:60'],
'nationality_id'         => ['nullable', 'integer', 'exists:countries,id'],
'gender_id'              => ['nullable', 'integer', 'exists:catalogs,id'],
'is_main_guest'          => ['required', 'boolean'],
'extra'                  => ['nullable', 'array'],
```

> ⚠️ **Nota:** el campo se llama `identificacion_number` (con "c", en español), NO `identification_number`.

### 5.1 Campos requeridos vs opcionales

| Campo | Tipo | Requerido | Validación | Catálogo / FK |
|-------|------|-----------|------------|---------------|
| `name` | string | ✅ | max 120 chars | — |
| `lastname` | string | ✅ | max 60 chars | — |
| `identification_type_id` | integer | ✅ | exists:catalogs,id | cat_id=2 |
| `identificacion_number` | string | ✅ | max 30 chars | — |
| `date_of_birth` | date | ✅ | formato `Y-m-d` | — |
| `email` | email | ✅ | max 255 chars | — |
| `phone` | string | ✅ | max 60 chars | — |
| `is_main_guest` | boolean | ✅ | `true` / `false` | — |
| `nationality_id` | integer | ❌ nullable | exists:countries,id | FK `countries` |
| `gender_id` | integer | ❌ nullable | exists:catalogs,id | cat_id=15 |
| `extra` | object | ❌ nullable | array/object | — |

### 5.2 Huésped Titular (is_main_guest = true)

```json
{
  "name": "Ricardo",
  "lastname": "Lombana",
  "identification_type_id": 7,
  "identificacion_number": "1234567890",
  "date_of_birth": "1990-05-15",
  "email": "ricardo.lombana@gmail.com",
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
    "document_image_1": "base64_o_url_foto_frente",
    "document_image_2": "base64_o_url_foto_reverso"
  }
}
```

### 5.3 Acompañante (is_main_guest = false)

```json
{
  "name": "Ana",
  "lastname": "Gómez",
  "identification_type_id": 9,
  "identificacion_number": "AB1234567",
  "date_of_birth": "1992-08-20",
  "email": "ana.gomez@gmail.com",
  "phone": "+57 315 999 8888",
  "nationality_id": null,
  "gender_id": 113,
  "is_main_guest": false,
  "extra": {
    "document_country_id": 48,
    "reason_for_trip_id": 31,
    "document_image_1": "base64_o_url_foto_frente",
    "document_image_2": null
  }
}
```

### 5.4 Mapeo Frontend (camelCase) → Backend (snake_case)

El frontend usa camelCase internamente. Al enviar al backend, se convierten:

| Frontend (camelCase) | Backend (snake_case) | Nivel |
|---------------------|---------------------|-------|
| `name` | `name` | root |
| `lastname` | `lastname` | root |
| `identificationTypeId` | `identification_type_id` | root |
| `identificationNumber` | `identificacion_number` | root ⚠️ |
| `dateOfBirth` | `date_of_birth` | root |
| `email` | `email` | root |
| `phone` | `phone` | root |
| `nationalityId` | `nationality_id` | root |
| `genderId` | `gender_id` | root |
| — | `is_main_guest` | root (nuevo) |
| `documentCountryId` | `document_country_id` | extra |
| `countryOfOriginId` | `country_of_origin_id` | extra |
| `countryDestinationId` | `country_destination_id` | extra |
| `cityOfResidence` | `city_of_residence` | extra |
| `countryOfResidenceId` | `country_of_residence_id` | extra |
| `cityDestination` | `city_destination` | extra |
| `reasonForTripId` | `reason_for_trip_id` | extra |
| `arrivalTime` | `arrival_time` | extra |
| `departureTime` | `departure_time` | extra |
| `arrivalFlight` | `arrival_flight` | extra |
| `departureFlight` | `departure_flight` | extra |
| `documentImage1` | `document_image_1` | extra |
| `documentImage2` | `document_image_2` | extra |
  | `specialRequests` | `special_requests` | extra |
  | `estimatedArrivalTime` | `estimated_arrival_time` | extra |
  | `flightNumber` | `flight_number` | extra |

---

## 6. Respuesta esperada del GET /checkin

⚠️ **El backend debe definir esta estructura.** El frontend espera algo como:

```json
{
  "success": true,
  "data": {
    "uuid": "019d4f00-1234-7890-abcd-1234567890ab",
    "listingId": 45,
    "listingName": "Unidad 201 - Vista a la Ciudad",
    "propertyName": "Apartamentos Centro Histórico",
    "propertyLocation": "Cali, Valle del Cauca, Colombia",
    "arrivalDate": "2026-05-15",
    "departureDate": "2026-05-20",
    "totalGuests": 2,
    "totalPrice": 750.50,
    "currency": "USD",
    "emailGuest": "ricardo.lombana@gmail.com",
    "guestName": "Ricardo",
    "statusReservationId": 27,
    "reservationSourceId": 22,
    "extra": {
      "specialRequests": "Cuna para bebé solicitada",
      "estimatedArrivalTime": "14:30"
    }
  }
}
```

**Campos mínimos que el frontend necesita del GET para renderizar el Paso 1:**

| Campo | Tipo | Uso en la UI |
|-------|------|-------------|
| `uuid` | string | Para armar la URL del POST posterior |
| `listingName` | string | Nombre de la unidad/habitación |
| `propertyName` | string | Nombre de la propiedad |
| `propertyLocation` | string | Ubicación (ciudad, país) |
| `arrivalDate` | string (YYYY-MM-DD) | Fecha de llegada |
| `departureDate` | string (YYYY-MM-DD) | Fecha de salida |
| `totalGuests` | integer | Cuántos formularios de huésped mostrar |
| `totalPrice` | number | Para mostrar en el resumen (opcional) |
| `currency` | string | Moneda del precio (USD, COP, etc.) |
| `emailGuest` | string | Pre-llenar email en el form del titular |
| `guestName` | string | Pre-llenar nombre y mostrar "Bienvenido, {nombre}" |

---

## 7. Guía de pruebas

### 7.1 Probar las rutas del frontend (con mock data)

Levantar el frontend:
```bash
npm run dev
```

Luego navegar a estas URLs:

| URL | Qué debe pasar |
|-----|----------------|
| `http://localhost:3000/checkin/test-uuid-123` | Muestra la pantalla de Bienvenida con datos mock |
| `http://localhost:3000/checkin/test-uuid-123/guest` | Muestra formulario de 22 campos del titular |
| `http://localhost:3000/checkin/test-uuid-123/companions` | Muestra formulario de acompañantes (mock: 2 huéspedes) |
| `http://localhost:3000/checkin/test-uuid-123/success` | Muestra pantalla de check-in completado |
| `http://localhost:3000/checkin/airbnb/listing-uuid/HM4X` | Misma bienvenida pero con ruta externa |
| `http://localhost:3000/checkin/airbnb/listing-uuid/HM4X/guest` | Mismo formulario, ruta externa |

### 7.2 Probar los endpoints del backend (cuando estén listos)

#### Test 1: GET reserva por UUID
```bash
curl -X GET "https://www.kunas.co/api/v1/checkin/{reservationUuid}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {APP_TOKEN}"
```

**Esperado:** JSON con los datos de la reserva (ver sección 6).

#### Test 2: GET reserva por fuente externa
```bash
curl -X GET "https://www.kunas.co/api/v1/checkin/airbnb/{listingUuid}/{externalId}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {APP_TOKEN}"
```

**Esperado:** Mismo JSON que Test 1.

#### Test 3: POST guardar huésped titular
```bash
curl -X POST "https://www.kunas.co/api/v1/checkin/{reservationUuid}/guest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {APP_TOKEN}" \
  -d '{
    "name": "Ricardo",
    "lastname": "Lombana",
    "identification_type_id": 7,
    "identificacion_number": "1234567890",
    "date_of_birth": "1990-05-15",
    "email": "ricardo.lombana@gmail.com",
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
      "document_image_1": "data:image/jpeg;base64,/9j/4AAQ...",
      "document_image_2": "data:image/jpeg;base64,/9j/4AAQ..."
    }
  }'
```

**Esperado:**
```json
{
  "success": true,
  "data": {
    "guestId": 123,
    "guestUuid": "019d5000-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "reservationGuestId": 456
  }
}
```

#### Test 4: POST guardar acompañante
```bash
curl -X POST "https://www.kunas.co/api/v1/checkin/{reservationUuid}/guest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {APP_TOKEN}" \
  -d '{
    "name": "Ana",
    "lastname": "Gómez",
    "identification_type_id": 9,
    "identificacion_number": "AB1234567",
    "date_of_birth": "1992-08-20",
    "email": "ana.gomez@gmail.com",
    "phone": "+57 315 999 8888",
    "nationality_id": null,
    "gender_id": 113,
    "is_main_guest": false,
    "extra": {
      "document_country_id": 48,
      "reason_for_trip_id": 31,
      "document_image_1": "data:image/jpeg;base64,/9j/4AAQ...",
      "document_image_2": null
    }
  }'
```

**Esperado:** Mismo formato de respuesta que Test 3, sin vincular `guest_id` a la reserva (solo el titular se vincula).

### 7.3 Verificar la lógica completa

1. **Crear una reserva manual:**
   ```bash
   POST /api/v1/reservations
   ```
   Con `totalGuests: 2` y `statusReservationId: 27`

2. **Obtener la reserva via check-in:**
   ```bash
   GET /api/v1/checkin/{uuid-de-la-reserva-creada}
   ```

3. **Registrar el titular:**
   ```bash
   POST /api/v1/checkin/{uuid}/guest
   ```
   Con `is_main_guest: true`

4. **Verificar que el `guest_id` se actualizó en la reserva:**
   ```bash
   GET /api/v1/reservations/{uuid}
   ```
   → `guest_id` ya no debe ser NULL

5. **Registrar el acompañante:**
   ```bash
   POST /api/v1/checkin/{uuid}/guest
   ```
   Con `is_main_guest: false`

6. **Verificar que ambos están en `reservation_guests`:**
   Debería haber 2 registros vinculados a esta reserva.

### 7.4 Flujo visual completo (cuando conectemos el backend)

```
Paso 1: Bienvenida
  → Frontend llama: GET /checkin/{uuid}
  → Muestra: nombre propiedad, fechas, # huéspedes
  → Botón: "Comenzar Check-in"

Paso 2: Datos del Titular (22 campos)
  → Secciones: Documento → Personal → Origen/Destino → Viaje → Fotos
  → Validación: todos los campos * requeridos
  → Al dar "Continuar": POST /checkin/{uuid}/guest {is_main_guest: true}

Paso 3: Acompañantes (si totalGuests > 1)
  → Formulario simplificado (12 campos)
  → Loop: un formulario por cada acompañante
  → Por cada uno: POST /checkin/{uuid}/guest {is_main_guest: false}
  → Progress ring: "1 de 1 acompañantes completados"

Paso 4: Éxito
  → Animación de check verde
  → Resumen de la reserva
  → Mensaje: "Recibirás las instrucciones por email"
```

---

## 8. Archivos del frontend relevantes

### Componentes (la lógica vive aquí)

| Archivo | Descripción |
|---------|-------------|
| `src/features/checkin/components/WelcomeScreen.tsx` | Paso 1: pantalla de bienvenida con resumen de reserva |
| `src/features/checkin/components/GuestFormScreen.tsx` | Paso 2: formulario de 22 campos en 5 secciones colapsables |
| `src/features/checkin/components/CompanionsScreen.tsx` | Paso 3: formulario de 12 campos con loop multi-huésped |
| `src/features/checkin/components/SuccessScreen.tsx` | Paso 4: pantalla de éxito |
| `src/features/checkin/components/SearchableSelect.tsx` | Select con búsqueda (usado para selectores de países) |
| `src/features/checkin/components/DocumentUpload.tsx` | Simulación de captura/subida de foto de documento |
| `src/features/checkin/components/StepIndicator.tsx` | Barra de progreso horizontal |

### Tipos y datos

| Archivo | Descripción |
|---------|-------------|
| `src/features/checkin/types/checkin.ts` | Interfaces: `CheckinReservation`, `GuestFormData`, `CompanionFormData` |
| `src/features/checkin/data/mock-guest-data.ts` | Datos mock (reserva, catálogos, países) — **reemplazar por API calls** |

### Rutas (wrappers delgados)

| Ruta | Archivo |
|------|---------|
| `/checkin/{uuid}` | `src/app/(guest)/checkin/[reservationId]/page.tsx` |
| `/checkin/{uuid}/guest` | `src/app/(guest)/checkin/[reservationId]/guest/page.tsx` |
| `/checkin/{uuid}/companions` | `src/app/(guest)/checkin/[reservationId]/companions/page.tsx` |
| `/checkin/{uuid}/success` | `src/app/(guest)/checkin/[reservationId]/success/page.tsx` |
| `/checkin/{slug}/{listing}/{ext}` | `src/app/(guest)/checkin/[sourceSlug]/[listingUuid]/[externalId]/page.tsx` |
| `/checkin/{slug}/{listing}/{ext}/guest` | `src/app/(guest)/checkin/[sourceSlug]/[listingUuid]/[externalId]/guest/page.tsx` |
| `/checkin/{slug}/{listing}/{ext}/companions` | `src/app/(guest)/checkin/[sourceSlug]/[listingUuid]/[externalId]/companions/page.tsx` |
| `/checkin/{slug}/{listing}/{ext}/success` | `src/app/(guest)/checkin/[sourceSlug]/[listingUuid]/[externalId]/success/page.tsx` |

---

## ✅ Confirmado / ⚠️ Pendientes

### ✅ Confirmado

| # | Item | Estado |
|---|------|--------|
| 1 | **Estructura del payload POST** — Estructura plana con snake_case, `is_main_guest` boolean, `extra` como array nullable | ✅ Confirmado |
| 2 | **Campos requeridos** — name, lastname, identification_type_id, identificacion_number, date_of_birth, email, phone, is_main_guest | ✅ Confirmado |
| 3 | **Campos nullable** — nationality_id, gender_id, extra | ✅ Confirmado |

### ⚠️ Pendientes

| # | Pendiente | Impacto |
|---|-----------|---------|
| 1 | **Estructura de la respuesta** del `GET /checkin/{...}` — ¿qué campos devuelve? | Alto |
| 2 | **Respuesta del POST** — ¿qué devuelve al crear el guest? ¿el guest creado? ¿solo success? | Alto |
| 3 | **IDs reales** del catálogo `reason_for_trip` (cat_id=8) — ¿existen los IDs 31-35? | Medio |
| 4 | **¿Cómo se suben las fotos?** — ¿base64 en `extra`? ¿endpoint separado de upload? ¿S3 presigned URL? | Alto |
| 5 | **¿El POST requiere autenticación?** — El huésped no tiene login. ¿Requieren app token o son abiertos? | Alto |
| 6 | **¿El backend actualiza el estado automáticamente** cuando todos los huéspedes están registrados? ¿O el frontend debe hacer un PATCH? | Medio |
| 7 | **Contenido de `extra`** — ¿El backend valida los keys dentro de extra o acepta cualquier key? | Medio |
