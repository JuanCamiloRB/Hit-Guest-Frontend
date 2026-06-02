# HitGuest v4.0 — Requerimientos para Backend

**Fecha:** Mayo 2026
**De:** Frontend Team
**Para:** Backend Team
**Estado:** Esperando implementación

---

## 1. Lo que YA tenemos funcionando

### ✅ Endpoints que ya existen

| # | Método | Endpoint | Estado | Notas |
|---|--------|----------|--------|-------|
| 1 | `GET` | `/api/v1/checkin/{reservationUuid}` | ✅ Funciona | Retorna datos de la reserva |
| 2 | `GET` | `/api/v1/checkin/{sourceSlug}/{listingUuid}/{externalId}` | ✅ Funciona | Reserva por fuente externa |
| 3 | `POST` | `/api/v1/checkin/{reservationUuid}/guest` | ✅ Funciona | Guarda un guest (main o companion) |
| 4 | `GET` | `/api/v1/catalogs?catalogCategoryName[eq]=...` | ✅ Funciona | Catálogos (doc types, gender, etc.) |
| 5 | `GET` | `/api/v1/countries` | ✅ Funciona | Lista de países |

### ✅ Tablas que ya existen

- `reservations` — Reservas
- `guests` — Huéspedes
- `reservation_guests` — Relación reserva↔guest con `extra` JSON
- `catalogs` — Catálogos (doc types cat_2, gender cat_15, etc.)
- `countries` — Países
- `properties` — Propiedades
- `listings` — Unidades/habitaciones

### ✅ Flujo actual del frontend

```
1. Welcome (GET /checkin/{uuid}) → muestra datos reserva
2. Guest Form (22 campos) → POST /checkin/{uuid}/guest {is_main_guest: true}
3. Companions (12 campos × N) → POST /checkin/{uuid}/guest {is_main_guest: false}
4. Success → pantalla estática
```

---

## 2. Lo que NECESITAMOS para v4.0

### 🔴 Prioridad ALTA — Sin esto no podemos avanzar

---

#### EP-1: Resolución de identidad

```
POST /api/v1/checkin/{reservationUuid}/resolve-identity
```

**¿Qué hace?** Busca si el guest ya existe en la DB por su documento. Si no existe, crea un registro básico.

**Request:**
```json
{
  "doc_type_id": 7,
  "doc_number": "1234567890",
  "nationality_id": 48
}
```

**Response esperada:**
```json
{
  "success": true,
  "data": {
    "guest_uuid": "019d5000-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "is_new": true,
    "has_previous_verification": false
  }
}
```

**Regla de negocio:** `UNIQUE(reservation_id, doc_type_id, doc_number)` — si ya existe para esta reserva, retornar error 409.

---

#### EP-2: Iniciar verificación de identidad

```
POST /api/v1/checkin/{reservationUuid}/guest/{guestUuid}/verify
```

**¿Qué hace?** Inicia una sesión de verificación con el provider configurado (Didit o Textract).

**Request:**
```json
{
  "provider": "didit"
}
```

**Response esperada:**
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

**Notas:**
- El provider viene de `property_automations` (configurado por el PM)
- Si es Didit → retorna `verification_url` para redirect
- Si es Textract → el front sube las fotos directamente (ver EP-4)

---

#### EP-3: Consultar estado de verificación (Polling)

```
GET /api/v1/checkin/{reservationUuid}/guest/{guestUuid}/verification-status
```

**¿Qué hace?** El frontend hace polling cada 3-5 segundos después de iniciar la verificación. Cuando el webhook de Didit/Textract llega al backend, este endpoint refleja el resultado.

**Response (pendiente):**
```json
{
  "success": true,
  "data": {
    "status": "pending"
  }
}
```

**Response (aprobado con datos):**
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

**Response (fallido):**
```json
{
  "success": true,
  "data": {
    "status": "failed",
    "reason": "face_mismatch"
  }
}
```

**Posibles valores de `status`:** `pending`, `approved`, `failed`, `expired`

---

#### EP-4: Upload de documentos (Presigned URL)

```
POST /api/v1/uploads/presigned
```

**¿Qué hace?** Genera una URL pre-firmada de S3 para que el frontend suba la imagen del documento directamente, sin pasar por el backend.

**Request:**
```json
{
  "file_type": "image/jpeg",
  "context": "document_front",
  "guest_uuid": "019d5000-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "upload_url": "https://s3.amazonaws.com/hitguest-docs/...",
    "file_key": "guests/019d5000/doc_front_1715000000.jpg"
  }
}
```

**¿Por qué?** Actualmente mandamos las fotos como base64 en el JSON del POST. Esto es ineficiente para imágenes grandes. Con presigned URLs el front sube directo a S3 y solo manda el `file_key` al backend.

---

#### EP-5: Completar checkin de un guest (Refactor del POST actual)

```
POST /api/v1/checkin/{reservationUuid}/guest/{guestUuid}/complete
```

**¿Qué hace?** Reemplaza al actual `POST /checkin/{uuid}/guest`. La diferencia es que ahora ya tenemos el `guestUuid` del paso de resolución.

**Request:**
```json
{
  "is_main_guest": true,
  "name": "Ricardo",
  "lastname": "Lombana",
  "identification_type_id": 7,
  "identificacion_number": "1234567890",
  "date_of_birth": "1990-05-15",
  "email": "ricardo@gmail.com",
  "phone": "+57 300 123 4567",
  "nationality_id": 48,
  "gender_id": 114,
  "signature_base64": "data:image/png;base64,iVBOR...",
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
    "document_image_1": "guests/019d5000/doc_front.jpg",
    "document_image_2": "guests/019d5000/doc_back.jpg"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "guest_id": 123,
    "guest_uuid": "019d5000-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "is_checkin_completed": true,
    "contract_pdf_url": "https://s3.../contract_019d4f00.pdf",
    "smartlock_codes": [
      { "name": "Entrada edificio", "type": "building_entrance", "code": "4821", "valid_from": "2026-05-15", "valid_until": "2026-05-20" },
      { "name": "Apto 304", "type": "unit_entrance", "code": "1567", "valid_from": "2026-05-15", "valid_until": "2026-05-20" }
    ]
  }
}
```

**Triggers automáticos al completar main guest:**
1. Generar PDF del contrato firmado
2. Generar códigos de smartlock (uno por cerradura del listing)
3. Marcar `reservation_guests.is_checkin_completed = true`

---

#### EP-6: Estado de la reserva (para secundarios)

```
GET /api/v1/checkin/{reservationUuid}/status
```

**¿Qué hace?** Los guests secundarios necesitan saber si el main guest ya completó su checkin para desbloquearse.

**Response:**
```json
{
  "success": true,
  "data": {
    "main_guest_completed": true,
    "total_guests": 3,
    "completed_guests": [
      { "guest_uuid": "019d5000-...", "name": "Ricardo L.", "is_main": true }
    ],
    "pending_guests": 2
  }
}
```

---

### 🟡 Prioridad MEDIA — Necesario pero puede ir en segunda iteración

---

#### EP-7: Campos adicionales en el GET /checkin existente

El endpoint `GET /api/v1/checkin/{reservationUuid}` que ya existe necesita retornar estos campos **adicionales**:

```json
{
  "data": {
    "...campos que ya retorna...",

    "property_country_id": 48,
    "main_guest_provider": "didit",
    "secondary_guest_provider": "textract",
    "has_contract": true,
    "listing_smartlocks": [
      { "id": 1, "name": "Entrada edificio", "type": "building_entrance" },
      { "id": 2, "name": "Apto 304", "type": "unit_entrance" }
    ],
    "main_guest_status": "pending",
    "automations_enabled": ["contract", "smartlock", "sire", "tra"]
  }
}
```

| Campo nuevo | Tipo | Para qué lo usa el frontend |
|-------------|------|-----------------------------|
| `property_country_id` | int | Mostrar defaults en selects de país |
| `main_guest_provider` | string | Saber qué SDK de verificación cargar |
| `secondary_guest_provider` | string | Puede diferir del main |
| `has_contract` | bool | Mostrar u ocultar el paso de firma |
| `listing_smartlocks` | array | Preview de cuántos códigos recibirá |
| `main_guest_status` | string | Gate para secundarios |
| `automations_enabled` | array | Adaptar UI según configuración del PM |

---

#### EP-8: Template del contrato

```
GET /api/v1/checkin/{reservationUuid}/contract-template
```

**Response:**
```json
{
  "success": true,
  "data": {
    "title": "Contrato de Arrendamiento Turístico",
    "body_html": "<p>Entre <strong>{{host_name}}</strong>...</p>",
    "variables": {
      "host_name": "María García",
      "guest_name": "Ricardo Lombana",
      "property_name": "Apartamentos Centro Histórico",
      "unit_name": "Unidad 201",
      "arrival_date": "2026-05-15",
      "departure_date": "2026-05-20",
      "total_price": 750.50,
      "currency": "USD"
    }
  }
}
```

---

### 🟢 Prioridad BAJA — Backend interno, frontend no participa

| Item | Descripción |
|------|-------------|
| Webhooks Didit/Textract | `POST /api/v1/webhooks/didit` y `/textract` — solo backend |
| `isForeign()` | Lógica en backend para determinar si es extranjero |
| Triggers SIRE/TRA | Backend dispara automáticamente, frontend no interviene |
| `automation_usage_records` | Backend registra costos, frontend solo lee en dashboard |
| Email de bienvenida | Backend envía al crear reserva |
| Encuesta de satisfacción | Backend programa X horas post-checkout |

---

## 3. Tablas nuevas que necesita el backend

| Tabla | Estado | Campos principales |
|-------|--------|-------------------|
| `listing_smartlocks` | 🆕 **CREAR** | id, listing_id, name, type (building_entrance / unit_entrance / amenity), is_active |
| `reservation_smartlock_codes` | 🆕 **CREAR** | id, reservation_id, listing_smartlock_id, code, valid_from, valid_until |
| `guest_verifications` | 🆕 **CREAR** | id, guest_id, property_automation_id, external_session_id, raw_response, status |
| `automation_usage_records` | 🔄 **ACTUALIZAR** | Agregar: billable (bool), unit_cost (decimal) |
| `property_automations` | 🔄 **ACTUALIZAR** | triggerTypes cambia de string a array en parameters JSON |
| `guests` | 🔄 **ACTUALIZAR** | Agregar: status_person_verification, doc_expiry_date, didit_reference |

---

## 4. Resumen Visual

```
                    LO QUE TENEMOS               LO QUE FALTA
                    ─────────────────            ─────────────────
Endpoints:          3 endpoints ✅               8 endpoints nuevos 🔴
Tablas:             7 tablas ✅                  3 nuevas + 3 actualizadas 🔴
Verificación:       No existe ❌                 Didit + Textract 🔴
Firma digital:      No existe ❌                 Canvas + PDF 🔴
Smartlocks:         No existe ❌                 Multi-cerradura 🔴
Secundarios:        Main los registra            Autónomos con su link 🔴
Automatizaciones:   No existen ❌                SIRE + TRA + triggers 🟡
Upload fotos:       Base64 en JSON               Presigned URLs S3 🟡
```

---

## 5. Orden sugerido de implementación

```
SEMANA 1:  EP-1 (resolve-identity) + EP-3 (verification-status)
SEMANA 2:  EP-2 (verify) + Webhooks Didit/Textract
SEMANA 3:  EP-5 (complete con firma) + EP-4 (presigned URLs)
SEMANA 4:  EP-6 (status reserva) + EP-7 (campos adicionales GET)
SEMANA 5:  EP-8 (contract template) + Smartlock tables + generación códigos
SEMANA 6:  Automatizaciones SIRE/TRA + isForeign()
```

> **Nota:** El frontend puede trabajar en paralelo con mocks para cada endpoint. Lo que necesitamos primero es el **contrato exacto** (request/response) de cada endpoint para crear los mocks correctos.

---

## 6. Preguntas pendientes para Backend

| # | Pregunta | Impacto |
|---|----------|---------|
| 1 | ¿Los webhooks de Didit llegan a una URL fija o configurable por property? | Diseño de EP-2 |
| 2 | ¿La firma se guarda como imagen en S3 o como campo en `reservation_guests`? | Diseño de EP-5 |
| 3 | ¿Los secundarios reciben un link por email o acceden desde el mismo link? | Diseño de EP-6 |
| 4 | ¿El presigned URL de S3 ya existe en otro módulo que podamos reutilizar? | Implementación EP-4 |
| 5 | ¿`property_automations` ya tiene registros en producción o es tabla nueva? | Migración |
| 6 | ¿Los smartlock codes son aleatorios o vienen de un API externo (TTLock, Nuki)? | Diseño EP-5 |
| 7 | ¿El contrato es un template HTML fijo por property o es configurable? | Diseño EP-8 |
