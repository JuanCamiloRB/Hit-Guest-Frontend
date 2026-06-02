# Check-in Online & Reservas Manuales — Hit Guest

## Documento de Diseño y Flujo Completo

**Fecha:** Abril 2026
**Estado:** Pre-implementación
**Referencia:** Hospy check-in flow + Backend API Hit Guest

---

## PARTE 1 — Creación Manual de Reserva (Dashboard Admin)

### 1.1 Ruta

```
/dashboard/reservations/new
```

### 1.2 Campos del Formulario

| # | Campo | Tipo | Requerido | Backend Field | Notas |
|---|-------|------|-----------|---------------|-------|
| 1 | Nombre del huésped | text | ✅ | `extra.guest_name` | Se usa temporalmente hasta que el huésped haga check-in y se genere el `guest_id` |
| 2 | Email del huésped | email | ✅ | `email_guest` | Se usa para enviar el link de check-in |
| 3 | WhatsApp / Teléfono | tel | ❌ | `extra.guest_phone` | Formato internacional (+57, +1, etc.) |
| 4 | Alojamiento (Propiedad + Unidad) | select | ✅ | `listing_id` | Primero seleccionar propiedad, luego la unidad (listing) |
| 5 | Canal / Fuente | select | ✅ | `reservation_source_id` | Catálogo `category_id=6`: Airbnb, Booking, Directo, etc. |
| 6 | ID externo | text | ❌ | `external_id` | Código de confirmación de Airbnb/Booking (ej: HM4XCBQYYP) |
| 7 | Fecha de llegada | date | ✅ | `arrival_date` | Formato: YYYY-MM-DD |
| 8 | Fecha de salida | date | ✅ | `departure_date` | Formato: YYYY-MM-DD |
| 9 | Número de huéspedes | number | ✅ | `total_guests` | Mínimo 1, default 1 |
| 10 | Precio total | number | ✅ | `total_price` | Valor numérico |
| 11 | Moneda | select | ✅ | `currency` | COP, USD, EUR (3 caracteres) |
| 12 | Hora de llegada | time | ❌ | `extra.arrival_time` | El huésped puede completarlo después en el check-in |
| 13 | Hora de salida | time | ❌ | `extra.departure_time` | El huésped puede completarlo después en el check-in |
| 14 | Enviar link ahora | checkbox | — | — | Si está marcado, envía el email con el link de check-in al crear la reserva |

### 1.3 Payload que se envía al backend

```json
{
  "listingId": 45,
  "reservationSourceId": 15,
  "externalId": "HM4XCBQYYP",
  "arrivalDate": "2026-04-16",
  "departureDate": "2026-04-19",
  "emailGuest": "bsc-alejandro@hotmail.com",
  "totalGuests": 2,
  "currency": "USD",
  "totalPrice": 138,
  "extra": {
    "guest_name": "Alejandro Apolo",
    "guest_phone": "+1 786 342 8501",
    "arrival_time": null,
    "departure_time": null,
    "arrival_flight": null,
    "departure_flight": null
  },
  "statusReservationId": 20
}
```

### 1.4 Después de crear la reserva

1. Backend genera el UUID de la reserva
2. Si "Enviar link ahora" está marcado, se envía un email al `email_guest` con el link:
   ```
   https://app.hitguest.com/checkin/{reservationUuid}?pax={totalGuests}
   ```
3. La reserva aparece en el dashboard con estado `LINK_SENT` o `PENDING`
4. El `guest_id` queda como `NULL` hasta que el huésped complete el check-in

### 1.5 El link de check-in es universal (independiente del origen)

El proceso de check-in online es **siempre el mismo**, sin importar cómo se creó la reserva. El huésped recibe el link, abre los formularios, registra sus datos y los de sus acompañantes.

| Origen de la reserva | Cómo se crea | ¿Se envía link de check-in? | Flujo del huésped |
|---|---|---|---|
| **Manual** (admin desde dashboard) | Admin llena el formulario | ✅ Sí, al `email_guest` | Mismo flujo de check-in |
| **Airbnb** (importación iCal o API) | Se sincroniza automáticamente | ✅ Sí, al `email_guest` | Mismo flujo de check-in |
| **Booking** (importación iCal o API) | Se sincroniza automáticamente | ✅ Sí, al `email_guest` | Mismo flujo de check-in |
| **Directo** (reserva desde web propia) | Huésped reserva directamente | ✅ Sí, al `email_guest` | Mismo flujo de check-in |

La única diferencia es **cómo se origina la reserva** (el campo `reservation_source_id`), no lo que sucede después. Una vez la reserva existe en el sistema, el flujo de envío de link → check-in online → automatizaciones es idéntico para todos los canales.

En el caso de la reserva manual, el checkbox **"Enviar link ahora"** le da al admin la opción de enviar el link inmediatamente al crear la reserva, o hacerlo después manualmente desde el panel de operaciones (por ejemplo, si necesita verificar algo antes de contactar al huésped).

### 1.6 Catálogos necesarios para este formulario

| Catálogo | category_id | Endpoint |
|----------|-------------|----------|
| Fuente de reserva (Airbnb, Booking, Directo) | 6 | `GET /catalogs?catalogCategoryName[eq]=reservation_source` |
| Estado de reserva | 7 | `GET /catalogs?catalogCategoryName[eq]=status_reservation` |
| Monedas | — | `GET /catalogs/category/currencies` o hardcoded (COP, USD, EUR) |

---

## PARTE 2 — Flujo del Check-in Online (Lo que ve el huésped)

### 2.1 Link que recibe el huésped

```
https://app.hitguest.com/checkin/{reservationUuid}?pax=2
```

Este es un link **público** (no requiere login). Solo es accesible con el UUID de la reserva.

---

### 2.2 PASO 1 — Pantalla de Bienvenida

**Ruta:** `/checkin/[reservationUuid]`

**Lo que se muestra (datos de la reserva, solo lectura):**

| Dato | Origen |
|------|--------|
| Logo + nombre del host/propiedad | Propiedad asociada al listing |
| Nombre de la propiedad | `property.name` |
| Nombre de la unidad | `listing.name` |
| Fecha de llegada | `reservation.arrival_date` |
| Fecha de salida | `reservation.departure_date` |
| Número de noches | Calculado: `departure - arrival` |
| Número de huéspedes a registrar | `reservation.total_guests` |
| Precio total | `reservation.total_price` + `reservation.currency` |

**Acción:** Botón "Comenzar Check-in" → Navega al Paso 2

---

### 2.3 PASO 2 — Registro del Huésped Principal

**Ruta:** `/checkin/[reservationUuid]/guest`

Este es el formulario más completo. El huésped principal debe proporcionar **todos** los datos requeridos para cumplir con normativas colombianas (TRA/SIRE).

**Campos del formulario:**

| # | Campo | Tipo | Requerido | Tabla | Campo DB | Catálogo |
|---|-------|------|-----------|-------|----------|----------|
| 1 | País del documento | select (countries) | ✅ | `reservation_guests` | `extra.document_country_id` | FK `countries` |
| 2 | Tipo de documento | select | ✅ | `guests` | `identification_type_id` | catalog `cat_id=2` (CC, CE, Pasaporte, etc.) |
| 3 | Número de documento | text | ✅ | `guests` | `identificacion_number` | — |
| 4 | Nombre | text | ✅ | `guests` | `name` | — |
| 5 | Apellido | text | ✅ | `guests` | `lastname` | — |
| 6 | Fecha de nacimiento | date | ✅ | `guests` | `date_of_birth` | — |
| 7 | Género | select | ✅ | `guests` | `gender_id` | FK catalogs |
| 8 | Teléfono / WhatsApp | tel | ✅ | `guests` | `phone` | — |
| 9 | Email | email | ✅ | `guests` | `email` | — |
| 10 | Nacionalidad | select (countries) | ✅ | `guests` | `nationality_id` | FK `countries` |
| 11 | Ciudad de residencia | text | ❌ | `guests` | `city_of_residence` | — |
| 12 | País de residencia | select (countries) | ❌ | `guests` | `country_of_residence_id` | FK `countries` |
| 13 | País de origen (de dónde viene) | select (countries) | ✅ | `reservation_guests` | `extra.country_of_origin_id` | FK `countries` |
| 14 | País destino | select (countries) | ✅ | `reservation_guests` | `extra.country_destination_id` | FK `countries` |
| 15 | Ciudad destino | text | ❌ | `reservation_guests` | `extra.city_destination` | — |
| 16 | Razón del viaje | select | ✅ | `reservation_guests` | `extra.reason_for_trip_id` | catalog `cat_id=8` |
| 17 | Hora de llegada estimada | time | ❌ | `reservations` | `extra.arrival_time` | — |
| 18 | Hora de salida estimada | time | ❌ | `reservations` | `extra.departure_time` | — |
| 19 | # Vuelo de llegada | text | ❌ | `reservations` | `extra.arrival_flight` | — |
| 20 | # Vuelo de salida | text | ❌ | `reservations` | `extra.departure_flight` | — |

**Subida de documentos (en el mismo paso o paso separado):**

| # | Campo | Tipo | Requerido | Tabla | Campo DB |
|---|-------|------|-----------|-------|----------|
| 21 | Foto del documento (frente) | file/camera | ✅ | `reservation_guests` | `extra.document_image_1` |
| 22 | Foto del documento (reverso) | file/camera | Condicional | `reservation_guests` | `extra.document_image_2` |

> **Nota:** Si el tipo de documento es **Pasaporte**, solo se requiere 1 foto (la página de datos). Si es **Cédula de Ciudadanía** u otro documento de dos caras, se requieren 2 fotos (frente y reverso).

**Al completar este paso, se ejecuta:**

1. `POST /guests` → Crea el huésped → Retorna `guest_id` y `guest_uuid`
2. `POST /reservation-guests` → Asocia el huésped a la reserva con los datos extra
3. `PUT /reservations/{uuid}` → Actualiza `guest_id` con el ID del huésped principal

**Acción:** Botón "Continuar" → Si `total_guests > 1`, va al Paso 3. Si no, va al Paso 4.

---

### 2.4 PASO 3 — Registro de Huéspedes Adicionales (Acompañantes)

**Ruta:** `/checkin/[reservationUuid]/companions`

**Se muestra:**
- Indicador de progreso: "2 de 2 huéspedes" (o "1 de 3", etc.)
- Lista de huéspedes ya registrados con ✅
- Botón "Registrar siguiente huésped"

**Campos del formulario (simplificado vs. huésped principal):**

| # | Campo | Tipo | Requerido | Tabla | Campo DB | Catálogo |
|---|-------|------|-----------|-------|----------|----------|
| 1 | País del documento | select (countries) | ✅ | `reservation_guests` | `extra.document_country_id` | FK `countries` |
| 2 | Tipo de documento | select | ✅ | `guests` | `identification_type_id` | catalog `cat_id=2` |
| 3 | Número de documento | text | ✅ | `guests` | `identificacion_number` | — |
| 4 | Nombre | text | ✅ | `guests` | `name` | — |
| 5 | Apellido | text | ✅ | `guests` | `lastname` | — |
| 6 | Fecha de nacimiento | date | ✅ | `guests` | `date_of_birth` | — |
| 7 | Género | select | ❌ | `guests` | `gender_id` | FK catalogs |
| 8 | Teléfono | tel | ❌ | `guests` | `phone` | — |
| 9 | Email | email | ❌ | `guests` | `email` | — |
| 10 | Razón del viaje | select | ✅ | `reservation_guests` | `extra.reason_for_trip_id` | catalog `cat_id=8` |
| 11 | Foto documento (frente) | file/camera | ✅ | `reservation_guests` | `extra.document_image_1` | — |
| 12 | Foto documento (reverso) | file/camera | Condicional | `reservation_guests` | `extra.document_image_2` | — |

> **Diferencias vs. huésped principal:** No se piden país de origen, país destino, ciudad destino, hora de vuelo, dirección, país de residencia. Estos datos se heredan del titular o no aplican.

**Al completar cada acompañante:**

1. `POST /guests` → Crea el huésped acompañante
2. `POST /reservation-guests` → Asocia a la reserva

**Se repite hasta que todos los huéspedes estén registrados.** Luego → Paso 4.

---

### 2.5 PASO 4 — Contrato de Arrendamiento (Opcional, según configuración)

**Ruta:** `/checkin/[reservationUuid]/contract`

> Este paso solo aparece si la propiedad tiene habilitado el contrato digital.

**Se muestra:**
- Texto completo del contrato de arrendamiento
- Datos pre-llenados: nombre del huésped, fechas, propiedad, precio
- Área de firma digital (canvas táctil)
- Checkbox: "He leído y acepto los términos del contrato"

**Al completar:**
- Se almacena la firma como imagen
- Se genera el PDF del contrato firmado
- Automatización `contract` → estado `success` en el traffic light

---

### 2.6 PASO 5 — Confirmación / Check-in Completado

**Ruta:** `/checkin/[reservationUuid]/complete`

**Se muestra:**
- ✅ "Check-in completado exitosamente"
- Resumen de la reserva:
  - Propiedad y unidad
  - Fechas y noches
  - Huéspedes registrados (lista con nombres)
- Información de acceso (si la configuración lo permite según timing):
  - Dirección completa de la propiedad
  - Código de acceso / instrucciones de llegada
  - Horario de check-in y check-out
  - WiFi (red + contraseña)
  - Contacto del host
  - Reglas de la casa
- Mensaje: "Recibirás un email con toda esta información"

**Al llegar a esta pantalla, el backend:**
1. Actualiza `status_reservation_id` → "CHECK_IN_COMPLETED" o "CONFIRMED"
2. Dispara automatizaciones pendientes:
   - **Código de acceso** → genera o envía código de cerradura inteligente
   - **TRA** → envío al sistema de Registro de Alojados de Migración Colombia
   - **SIRE** → envío al Sistema de Información para el Registro de Extranjeros

---

## PARTE 3 — Catálogos necesarios para todo el flujo

| Catálogo | category_id | Dónde se usa | Ejemplo de valores |
|----------|-------------|--------------|-------------------|
| `identification_type` | 2 | Tipo de documento del huésped | Cédula de Ciudadanía, Cédula de Extranjería, Pasaporte, NIT |
| `reservation_source` | 6 | Canal/fuente de la reserva | Airbnb, Booking.com, Directo, Expedia |
| `status_reservation` | 7 | Estado de la reserva | Pendiente, Link Enviado, Check-in Completado, Confirmada, Cancelada |
| `reason_for_trip` | 8 | Razón del viaje | Turismo, Negocios, Visita familiar, Estudio, Otro |
| `person_verification` | 13 | Tipo de verificación de identidad | Verificación facial, Documento verificado |
| `countries` | tabla propia | Nacionalidad, residencia, origen, destino, documento | Colombia, Ecuador, Estados Unidos, etc. |
| `gender` | FK catalogs | Género del huésped | Masculino, Femenino, No binario, N/A |

---

## PARTE 4 — Estructura de Archivos Frontend

```
src/
├── app/
│   ├── checkin/                              ← PÚBLICO (sin auth)
│   │   └── [reservationUuid]/
│   │       ├── layout.tsx                    ← Layout con branding del host
│   │       ├── page.tsx                      ← Paso 1: Bienvenida
│   │       ├── guest/
│   │       │   └── page.tsx                  ← Paso 2: Huésped principal
│   │       ├── companions/
│   │       │   └── page.tsx                  ← Paso 3: Acompañantes
│   │       ├── contract/
│   │       │   └── page.tsx                  ← Paso 4: Contrato
│   │       └── complete/
│   │           └── page.tsx                  ← Paso 5: Confirmación
│   │
│   └── (dashboard)/dashboard/reservations/   ← PRIVADO (con auth)
│       ├── page.tsx                          ← Ya existe: lista + calendario
│       ├── new/
│       │   └── page.tsx                      ← NUEVO: Crear reserva manual
│       └── [id]/
│           └── page.tsx                      ← Ya existe: panel de operaciones
│
├── features/
│   └── checkin/                              ← NUEVO módulo
│       ├── components/
│       │   ├── CheckinLayout.tsx             ← Layout público con logo, color, idioma
│       │   ├── StepIndicator.tsx             ← Barra de progreso (Paso 1/5)
│       │   ├── WelcomeScreen.tsx             ← Datos de reserva + botón comenzar
│       │   ├── GuestForm.tsx                 ← Formulario huésped principal (20+ campos)
│       │   ├── CompanionForm.tsx             ← Formulario acompañante (12 campos)
│       │   ├── CompanionsList.tsx            ← Lista de acompañantes registrados
│       │   ├── DocumentUpload.tsx            ← Componente de subida de fotos documento
│       │   ├── ContractViewer.tsx            ← Visualización del contrato
│       │   ├── SignaturePad.tsx              ← Firma digital (canvas)
│       │   └── CheckinComplete.tsx           ← Pantalla de confirmación
│       ├── services/
│       │   ├── reservations-service.ts       ← GET/POST/PUT reservas
│       │   └── guests-service.ts             ← POST guests, POST reservation-guests
│       └── types/
│           └── checkin.ts                    ← Interfaces TypeScript
│
└── features/reservations/                    ← Ya existe (dashboard)
    └── components/
        └── CreateReservationForm.tsx          ← NUEVO: form de crear reserva manual
```

---

## PARTE 5 — Resumen del Flujo Completo

```
┌─────────────────────────────────────────────────────────────────┐
│ ADMIN (Dashboard)                                               │
│                                                                 │
│  1. Crea reserva manual o la importa de Airbnb/Booking          │
│     → POST /reservations                                        │
│     → guest_id = NULL                                           │
│                                                                 │
│  2. Sistema envía email/WhatsApp con link al huésped            │
│     → https://app.hitguest.com/checkin/{uuid}?pax=2             │
│                                                                 │
│  3. Dashboard muestra reserva con estado "Link Enviado"         │
│     → Traffic light: [LINK ✅] [CHECK-IN ⏳] [CONTRATO ⏳]...   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ HUÉSPED (Página pública, mobile-first)                          │
│                                                                 │
│  Paso 1: Bienvenida                                             │
│  ├── Ve datos de la reserva (propiedad, fechas, precio)         │
│  └── Presiona "Comenzar Check-in"                               │
│                                                                 │
│  Paso 2: Datos del huésped principal                            │
│  ├── Llena 20 campos (nombre, documento, origen, destino...)    │
│  ├── Sube foto(s) del documento de identidad                    │
│  ├── → POST /guests (crea huésped, genera guest_id)             │
│  ├── → POST /reservation-guests (asocia a reserva)              │
│  └── → PUT /reservations/{uuid} (asigna guest_id principal)     │
│                                                                 │
│  Paso 3: Acompañantes (si pax > 1)                              │
│  ├── Formulario simplificado por cada acompañante               │
│  ├── Indicador: "2 de 2 huéspedes registrados"                  │
│  ├── → POST /guests + POST /reservation-guests (por cada uno)   │
│  └── Repite hasta completar todos                               │
│                                                                 │
│  Paso 4: Contrato (si está habilitado)                          │
│  ├── Lee contrato de arrendamiento                              │
│  ├── Firma digital                                              │
│  └── Acepta términos                                            │
│                                                                 │
│  Paso 5: Confirmación                                           │
│  ├── "Check-in completado ✅"                                    │
│  ├── Resumen de datos + huéspedes registrados                   │
│  ├── Info de acceso (código, dirección, WiFi, reglas)           │
│  └── → Dispara automatizaciones (código, TRA, SIRE)            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ ADMIN ve actualización en tiempo real                            │
│                                                                 │
│  Traffic light actualizado:                                      │
│  [LINK ✅] [CHECK-IN ✅] [CONTRATO ✅] [CÓDIGO ⏳] [TRA ⏳]...  │
│                                                                 │
│  Puede ver todos los datos que el huésped ingresó               │
│  Puede ver las fotos de los documentos                          │
│  Puede descargar el contrato firmado                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## PARTE 6 — Consideraciones de UX

### Mobile-First
El 90%+ de los huéspedes abrirán el link desde su celular. El diseño debe ser:
- Formularios de una columna
- Botones grandes y táctiles
- Cámara nativa para fotos de documentos (no solo upload de archivo)
- Pasos claros con indicador de progreso visible

### Idioma
- Default: Español
- Futuro: soporte multi-idioma (inglés, portugués) según configuración de la propiedad

### Branding
- El layout del check-in debe mostrar el logo y colores de la propiedad/host
- Personalizable desde la configuración del dashboard (similar a Hospy)

### Validaciones
- Validar formato de documento según tipo (CC = solo números, Pasaporte = alfanumérico)
- Validar email con formato correcto
- Validar teléfono con código de país
- Validar que la fecha de nacimiento sea razonable (> 0 años, < 120 años)
- No permitir avanzar al siguiente paso sin completar los campos requeridos

### Offline / Errores
- Si hay error de red al enviar, mostrar mensaje claro y permitir reintentar
- Guardar progreso en localStorage para no perder datos si el huésped cierra el navegador
- Si el link ya fue completado, mostrar pantalla de "Check-in ya realizado" con el resumen
