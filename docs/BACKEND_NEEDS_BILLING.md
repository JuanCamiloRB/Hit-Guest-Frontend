
# Lo que necesitamos del Backend — Saldo / Facturación (Tablero)

> **Formato**: Contrato de API para el equipo de backend. Describe los endpoints que el **frontend ya consume** pero que **aún no existen** en el backend. El front está construido contra este contrato: el día que estos endpoints respondan, la UI funciona sin cambios.

**Fecha:** Julio 2026 · **Estado:** Frontend listo — bloqueado en 2 endpoints

---

## Principio de diseño: el frontend NO conoce la pasarela de pago

> El **proveedor de pago (Stripe, MercadoPago, PayPal, lo que sea) es 100% responsabilidad del backend.**
> El frontend **no importa, no menciona, ni depende** de Stripe. Solo hace dos cosas:
> 1. pide el saldo, y
> 2. pide una recarga y **abre la URL de pago que el backend le devuelva** (`paymentUrl`), sea del proveedor que sea.
>
> Esto es Inversión de Dependencias (DIP): el front depende de una abstracción ("una URL de pago"), no de la implementación concreta ("Stripe Checkout"). Si mañana se cambia de proveedor, el frontend **no se toca**. Todo el manejo de sesiones de pago, webhooks, reintentos y acreditación de saldo vive en el backend.

---

## Contexto

El **Tablero de Operaciones** (`/dashboard`) muestra **consumo y saldo** en vez de duplicar la lista de reservas de Operaciones. Tiene tres bloques:

1. **Consumo por reserva** — costo de cada automatización (Verificación, Contrato, TRA, SIRE, Accesos) y total por reserva.
   → ✅ **Ya funciona con un endpoint existente**: `GET /reservations/{uuid}/automation-records` (campos `unitCost` + `billable`). **No requiere trabajo de backend.**
2. **SALDO de la cuenta** — bolsa prepaga en USD que se consume con cada automatización.
   → 🔴 **Requiere Endpoint 1** (abajo).
3. **Recargar bolsa** — el PM añade saldo. El backend crea la sesión de pago y devuelve la URL.
   → 🔴 **Requiere Endpoint 2** (abajo).

Mientras los endpoints no existan, el front **degrada con gracia**: la tarjeta de SALDO muestra "Pendiente de backend" y el botón "Recargar" muestra un toast "próximamente" (no rompe nada).

---

## Autenticación

Ambos endpoints requieren el token de sesión del PM (Sanctum), igual que el resto del dashboard:

```
Authorization: Bearer {sanctum-token-del-pm}
Content-Type: application/json
Accept: application/json
```

Base URL: `{API_BASE}/api/v1`

> El saldo es **por cuenta del PM** — debe resolverse a partir del token de sesión, no de un parámetro. Cada host ve solo su saldo, igual que ve solo sus reservas y propiedades (ver [BACKEND_NEEDS_SUMMARY](./BACKEND_NEEDS_SUMMARY.md)).

---

## Endpoint 1 — Consultar saldo de la cuenta

### `GET /api/v1/billing/balance`

Se llama al montar el Tablero para mostrar la tarjeta **SALDO**.

**Sin body.**

**Respuesta 200:**
```json
{
  "data": {
    "amount": 40.00,
    "currency": "USD"
  }
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `amount` | number | Saldo actual disponible (decimal, en la moneda `currency`) |
| `currency` | string | Código ISO de moneda. Por ahora siempre `"USD"` |

**Respuestas:**

| Status | Descripción | Acción del frontend |
|--------|-------------|---------------------|
| 200 | Retorna el saldo | Muestra el monto en la tarjeta SALDO |
| 401 | Token de sesión inválido/expirado | Redirige al login (flujo global) |
| 404 / 501 | Endpoint aún no implementado | Muestra "Pendiente de backend" (estado actual) |

**Notas:**
- El front ya trata **404/501 como "no configurado"** y no rompe. En cuanto devuelvas 200 con el shape de arriba, la tarjeta se puebla automáticamente.
- El `amount` debe reflejar el saldo **después** de descontar el consumo de automatizaciones (misma fuente de verdad que `automation-records.unitCost`).

**Consumido por:** `billingService.getBalance()` → `src/features/billing/services/billing-service.ts`.

---

## Endpoint 2 — Iniciar recarga de saldo

### `POST /api/v1/billing/recharge`

El backend crea la sesión de pago **con el proveedor que use internamente** y devuelve la URL a la que el frontend redirige. **El frontend no sabe qué proveedor es.**

**Body:**
```json
{
  "amount": 40,
  "currency": "USD"
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `amount` | number | ✅ | Monto a recargar en la moneda `currency` (> 0) |
| `currency` | string | ❌ | Código ISO. Default `"USD"` |

**Respuesta 200 / 201:**
```json
{
  "data": {
    "paymentUrl": "https://pagos.tu-proveedor.com/session/abc123..."
  }
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `paymentUrl` | string | URL de la **página de pago alojada** por el backend/proveedor. El frontend hace `window.location.href = paymentUrl` sin interpretar el contenido |

> **Nombre del campo:** el front usa `paymentUrl` (agnóstico). Por resiliencia también acepta `checkoutUrl` y `redirectUrl` como alias, pero el nombre canónico acordado es **`paymentUrl`**.

**Respuestas:**

| Status | Descripción | Acción del frontend |
|--------|-------------|---------------------|
| 200/201 | Sesión de pago creada | Redirige a `paymentUrl` |
| 401 | Token de sesión inválido/expirado | Redirige al login |
| 422 | `amount` inválido (≤ 0, moneda no soportada) | Muestra error inline |
| 404 / 501 | Endpoint aún no implementado | Toast "Recarga — próximamente" (estado actual) |
| 500 | Error al crear la sesión de pago | Toast genérico de error |

**Consumido por:** `billingService.createRecharge(amount, currency)` → `src/features/billing/services/billing-service.ts`.

---

## Flujo de pago completo (todo del lado backend)

```
[PM pulsa "Recargar $40"]
        ↓  POST /billing/recharge { amount: 40 }        ← lo único que hace el front
[Backend crea la sesión de pago con su proveedor]  → { paymentUrl }
        ↓  Front redirige a paymentUrl (sin saber el proveedor)
[PM paga en la página del proveedor]
        ↓  Proveedor → webhook al backend (pago confirmado)   ← backend
[Backend acredita el saldo]  amount += 40                     ← backend
        ↓  Proveedor redirige de vuelta (success_url del backend)
[PM vuelve al Tablero]  → GET /billing/balance refleja el saldo nuevo
```

**Puntos que resuelve el backend (el frontend no participa):**

1. **Elección del proveedor de pago** — Stripe u otro. Encapsulado en el backend.
2. **Webhook de confirmación** — el backend acredita el saldo **al confirmarse el pago**, no al crear la sesión (el pago puede no completarse).
3. **`success_url` / `cancel_url`** — las define el backend al crear la sesión. Propuesta: `success_url = {APP_URL}/dashboard?recharge=success`, `cancel_url = {APP_URL}/dashboard?recharge=cancel`. Al volver, el front refresca el saldo y muestra un toast según el query param (esto sí lo hace el front, pero no toca al proveedor).
4. **Idempotencia** — clave de idempotencia al crear la sesión para evitar cobros dobles si el PM reintenta.
5. **Monto mínimo / preestablecidos** — el front ofrece `$20 / $40 / $100` + monto libre. Confirmar si hay mínimo (ej. $10).
6. **Moneda** — hoy solo `USD`. Confirmar si habrá multi-moneda.

---

## Endpoints opcionales (a futuro, no bloqueantes)

Para robustecer el Tablero sin cambiar la UI actual:

| # | Método | Endpoint | Para qué | Beneficio |
|---|--------|----------|----------|-----------|
| 3 | `GET` | `/billing/transactions` | Historial de movimientos (recargas + consumos) con paginación | Habilita una vista "Historial de saldo" |
| 4 | `GET` | `/billing/consumption?from&to` | Agregado de consumo por periodo ya calculado en backend | Elimina el patrón N+1 actual (hoy el front pide `automation-records` por cada reserva y agrega en cliente) |

> El Endpoint 4 es una optimización: hoy `consumptionService.getReservationCosts()` hace una llamada por reserva en paralelo (`Promise.allSettled`). Funciona, pero un agregado server-side escala mejor cuando un PM tenga cientos de reservas.

---

## Resumen para el board

| # | Método | Endpoint | Para qué | Estado FE |
|---|--------|----------|----------|-----------|
| 1 | `GET` | `/billing/balance` | Saldo de la cuenta (tarjeta SALDO del Tablero) | ✅ Listo, esperando backend |
| 2 | `POST` | `/billing/recharge` | Crear sesión de pago y devolver `paymentUrl` | ✅ Listo, esperando backend |
| 3 | `GET` | `/billing/transactions` | Historial de movimientos (opcional) | ⏳ Futuro |
| 4 | `GET` | `/billing/consumption` | Consumo agregado por periodo (opcional, anti N+1) | ⏳ Futuro |

> **Consumo por reserva** (líneas de costo del Tablero) **NO** necesita backend nuevo — usa `GET /reservations/{uuid}/automation-records` que ya existe.
>
> **Recordatorio de diseño:** ninguna palabra "Stripe" aparece en el frontend. El proveedor es un detalle del backend detrás de `paymentUrl`.
