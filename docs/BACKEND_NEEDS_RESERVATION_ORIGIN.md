# Backend — Origen de la reserva y edición (`PUT /reservations/{uuid}`)

> **2026-08-19.** Un PM no podía editar la reserva `MANUAL-5ZOBAR` (Habitare
> Cristales, canal Airbnb). La causa era del frontend y ya está corregida; lo que
> queda acá es el dato que nos falta para hacerlo bien.

| # | Pedido | Prioridad |
|---|---|---|
| 1 | ¿`PUT /reservations/{uuid}` rechaza reservas sincronizadas? ¿Con qué código? | **Alta** |
| 2 | Exponer el **origen** a nivel reserva (importada vs. creada a mano) | **Alta** |
| 3 | Si se edita una reserva sincronizada, ¿la siguiente sincronización pisa los cambios? | Media |

## Qué pasó

El frontend deshabilitaba «Editar reserva» cuando el canal era Airbnb, con el
aviso *«Las reservas de Airbnb no se pueden editar manualmente»*. **Esa regla no
salía de ningún contrato** — `FRONTEND_API_ENDPOINTS §11.2` documenta
`POST /reservations` y `PUT /reservations/{uuid}` con el mismo payload y sin
restricción por canal — y además era inconsistente: Booking.com también se
sincroniza y nunca estuvo bloqueado.

El error de fondo es que usábamos el **canal comercial** como sustituto del
**mecanismo de importación**, y no son lo mismo. La reserva del reporte tiene
`externalId` **`MANUAL-5ZOBAR`**: ese prefijo lo genera nuestro propio formulario
al crear una reserva a mano. O sea, la creó una persona en el dashboard eligiendo
canal Airbnb, y la bloqueábamos como si Airbnb la hubiera importado.

**Ya corregido de nuestro lado**: el botón dejó de bloquear (si ustedes rechazan
la edición, mostramos su error tal cual), y se quitaron los textos que afirmaban
importación — un badge «Importada por iCal» y un «Importada desde Airbnb», ambos
derivados del canal y ambos falsos en este caso.

## 1. ¿`PUT /reservations/{uuid}` rechaza reservas sincronizadas?

- ¿Existe alguna validación que impida editar una reserva que entró por
  sincronización (iCal, Calry, Kunas PMS)?
- Si existe: **¿qué código y qué shape devuelve?** (como `guarantee_not_required`
  en check-in). Lo mostramos tal cual y dejamos de adivinar.
- Si **no** existe: confirmarlo. Entonces el PM puede editar cualquier reserva y
  no hay nada que bloquear.

## 2. El origen, a nivel reserva

Hoy **ningún endpoint lo expone**. Revisamos todos los de reserva —
`GET /reservations`, `GET /reservations/{uuid}`, `/guests`, `/automation-status`,
`/automation-records` — y el objeto reserva trae `uuid`, fechas, `emailGuest`,
`totalGuests`, `totalPrice`, `currency`, `externalId`, `extra`, `listing`,
`source`, `statusReservation`, `isCheckinCompleted`. Ninguno dice cómo entró.

Los dos catálogos que sí existen no alcanzan:

| Catálogo | Qué es | Dónde vive |
|---|---|---|
| `reservation_source` | **Canal comercial** (Airbnb/Booking/Directo) — lo elige el PM al crear | En la reserva (`source`) |
| `source_pms` | **Origen de sincronización** (100 Airbnb · 101 Booking.com · 134 KunasPMS) | Solo en Listing/Property, dentro de `externalPmsIds[]` |

**Pedido**: exponer en la reserva algo equivalente a `source_pms` — un
`sourcePmsId`, un `isImported`, o un `syncedAt`. Con cualquiera de los tres
podemos distinguir de verdad y volver a diferenciar en la UI lo que hoy tuvimos
que dejar neutro.

`listing.externalPmsIds[]` no sirve como sustituto: dice que **el alojamiento**
está conectado a un PMS, no que **esta reserva** haya venido de ahí.

## 3. Convivencia con la sincronización

Si un PM edita una reserva que sí llegó sincronizada, **¿la siguiente pasada de
sincronización sobrescribe sus cambios?** Es la preocupación legítima que
probablemente originó el bloqueo. Si la respuesta es sí, preferimos que el
rechazo lo haga el backend (pedido 1) antes que reponer una regla adivinada en el
cliente.

## Cómo comprobar el pedido 2 en 30 segundos

Si el campo ya existe y solo no está documentado, se ve así:

```bash
curl -s "https://guest.hit.tools/api/v1/reservations/{uuid}" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer $PM_TOKEN" | jq 'keys'
```

Nos basta la lista de claves; los valores no hacen falta.
