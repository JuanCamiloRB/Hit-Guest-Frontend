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
