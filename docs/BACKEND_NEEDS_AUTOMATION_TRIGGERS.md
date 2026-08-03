# Lo que necesitamos del Backend — Trigger "Hora programada" (property-automations)

> **Formato**: Contrato de API para el equipo de backend. El **frontend ya envía** este nuevo tipo de disparador; falta que el backend lo acepte y lo ejecute.

**Fecha:** Julio 2026 · **Estado:** Frontend listo — pendiente soporte de backend

---

## Contexto

Cada `property-automation` guarda su disparador dentro de `parameters`:

```json
{
  "triggerTypes": ["on_checkin_completed"],
  "triggerConfig": { "on_checkin_completed": { "delay_minutes": 0 } },
  "guest_filter": "all"
}
```

Los tipos de disparador que el frontend ya manejaba (ver [PROPERTY_AUTOMATIONS_ARCHITECTURE.md](./PROPERTY_AUTOMATIONS_ARCHITECTURE.md)):

- `on_checkin_completed`
- `on_guest_checkin_completed`
- `on_physical_checkout`
- `after_automation` (con `predecessor_automation_id`)

**Falta uno** que pidió el equipo (Didier): disparar una automatización **a una hora programada** — por ejemplo, reportar a SIRE a las 08:00, o 2 h antes del check-out. Aplica especialmente a **SIRE-IN (order 7)** y **SIRE-OUT (order 8)**, que son dos automatizaciones separadas y pueden tener reglas de disparo distintas.

---

## Nuevo trigger type: `on_scheduled_time`

El frontend ya lo agrega a `triggerTypes` y escribe su config en `triggerConfig.on_scheduled_time`. Tiene **dos modos**:

### Modo 1 — Hora absoluta

Se dispara a una hora fija del día del evento.

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

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `mode` | `"absolute"` | Modo hora fija |
| `time` | string `"HH:mm"` | Hora del día (24 h) a la que se dispara |

### Modo 2 — Relativo a un ancla

Se dispara un offset **antes/después** del check-in o del check-out.

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

| Campo | Tipo | Valores | Descripción |
|-------|------|---------|-------------|
| `mode` | string | `"relative"` | Modo relativo |
| `anchor` | string | `"checkin"` \| `"checkout"` | Evento de referencia |
| `direction` | string | `"before"` \| `"after"` | Antes o después del ancla |
| `offset_minutes` | number | `>= 0` | Minutos de separación respecto al ancla |

> Ejemplo: `{ anchor: "checkout", direction: "before", offset_minutes: 120 }` = "2 horas antes del check-out".

---

## Lo que necesita el backend

1. **Aceptar `on_scheduled_time`** en la lista permitida de `triggerTypes` (hoy un valor no listado podría rechazarse con 422).
2. **Validar `triggerConfig.on_scheduled_time`** según el modo:
   - `mode: "absolute"` → requiere `time` (`HH:mm`).
   - `mode: "relative"` → requiere `anchor`, `direction`, `offset_minutes`.
3. **Programar la ejecución** (scheduler/cron o jobs diferidos):
   - Absoluto: resolver la hora para el día del evento en la **timezone de la propiedad**.
   - Relativo: calcular `check-in/out ± offset_minutes`.
4. **Idempotencia**: no ejecutar dos veces la misma automatización para la misma reserva.

---

## Impacto en el frontend

- **Ya implementado** en [`TriggerConfigSection.tsx`](../src/features/properties/components/automations/TriggerConfigSection.tsx): checkbox "A una hora programada" + UI de los dos modos (hora absoluta / relativo con ancla, dirección y offset).
- Se guarda dentro de `parameters.triggerConfig.on_scheduled_time` como cualquier otro trigger — **sin cambios de contrato** en `POST/PATCH /properties/{uuid}/automations`.
- Hasta que el backend lo acepte, si se guarda podría devolver **422** (valor de `triggerTypes` no permitido). No rompe el resto de la config.

---

## Nota — SIRE-IN / SIRE-OUT (ya contemplado)

No requiere trabajo nuevo: **order 7 (`sire-colombia-checkin`)** y **order 8 (`sire-colombia-checkout`)** ya son dos automatizaciones independientes en el frontend ([automation-definitions.ts](../src/features/properties/data/automation-definitions.ts)) y en el doc de arquitectura. Cada una tiene su propio `triggerTypes`/`triggerConfig`, así que **ya pueden dispararse con reglas distintas hoy** (incluida "Hora programada" una vez el backend la soporte).
