# Lo que necesitamos del Backend — Superusuario e ingreso a cuentas de clientes

> Pedido de producto del 2026-10-09: que un superusuario de HitGuest vea todas
> las cuentas (clientes, usuarios, propiedades) y pueda **entrar a la cuenta de
> cualquier usuario sin código ni contraseña**, conservando su propia sesión.
> Mock aprobado por el equipo (directorio de clientes, cuenta del cliente con
> sus usuarios, y el dashboard «dentro de la cuenta» con banner fijo y botón
> para volver). Contrastado con `RICARDO_API_CONTRACTS.md` y con lo que hoy
> responde `guest.hit.tools`. Revisado el 2026-10-09 tras auditoría externa:
> esta versión cierra los huecos de autorización y ciclo de vida de la primera.

## Resumen

| # | Pedido | Sin esto | Prioridad |
|---|---|---|---|
| 1 | La sesión dice si es de superusuario y con qué capacidades | El front no puede mostrar nada: inferirlo por correo o cuenta sería inventar | Alta |
| 2 | **Modelo de suplantación completo desde el primer deploy**: token aparte, id, actor, sujeto, motivo, modo, abilities recortadas, vencimiento, revocación por el actor, sin anidamiento, auditoría | Un token con acceso completo «para abrirlo después» es una brecha | Alta |
| 3 | `GET /user` con el token suplantado declara la suplantación | Al recargar la página el front no sabría que está dentro de otra cuenta | Alta |
| 4 | Directorio de clientes, detalle del cliente y sus usuarios (solo superusuario) | No hay lista que recorrer | Alta |
| 5 | Modo con escritura (`full`) solo con una capacidad aparte y aprobación de producto | Cualquier superusuario podría pedir escritura | Media |

## Antes de nada: una decisión de producto registrada va en contra

`RICARDO_API_CONTRACTS.md` §3.3 (`SUPER_ADMIN`, estado `PENDIENTE`): *«incluso
`SUPER_ADMIN` debe ver únicamente sus propias propiedades, listings y reservas
en estos endpoints. No debe recibir scope global»*. Este pedido **no la
contradice**: los endpoints de datos siguen acotando por el token de sesión, y
el superusuario ve **una cuenta a la vez** con un token emitido para ese
usuario. Lo que sí hay que registrar con el PO es que el superusuario pueda
**entrar** a las cuentas, y en qué modo. Pedimos que esa decisión quede escrita
antes de construir.

## Lo que ya existe y se reutiliza

- `GET /user` y `POST /auth/verify-otp` → `uuid`, `email`, `client_uuid`,
  `client_name`, `name`, `locale`, `isAccountOwner`. **Sin rol** (pendiente
  desde julio: `roles` en `UserResource`).
- `GET /users` lista los usuarios **del propio cliente**; `GET /clients/{uuid}`
  lee **la propia cuenta**. Para otro cliente: 403.
- Todo endpoint de datos (propiedades, reservas, billing, automatizaciones)
  acota por el token de sesión. **No pedimos «scope global»**: con un token del
  usuario suplantado, cada respuesta del backend queda acotada a un solo
  cliente. (El front, por su parte, es responsable de invalidar sus cachés y
  peticiones en vuelo al cambiar de contexto; hoy varias no están segmentadas
  por cliente.)

## 1. Quién es superusuario y qué puede — `GET /user` y `verify-otp`

En el mismo objeto `user` de ambos endpoints:

```json
{
  "uuid": "…",
  "email": "soporte@hitguest.com",
  "client_uuid": "…",
  "client_name": "HitGuest",
  "isAccountOwner": true,
  "roles": ["super_admin"],
  "capabilities": ["admin.clients.read", "admin.impersonate.read_only"]
}
```

- `roles` como **arreglo**, también para los usuarios de equipo
  (`["property_manager"]`, `["property_staff"]`): una sola forma, no `role` en
  unos sitios y `roles` en otros. Si el front necesita una etiqueta principal,
  la deriva del arreglo.
- `capabilities` es lo que decide la UI: el menú «Clientes» solo con
  `admin.clients.read`; el botón de entrar solo con
  `admin.impersonate.read_only`; la opción de escritura solo con
  `admin.impersonate.full`. Quién tiene qué se define en el backend; el front
  nunca lo deduce de un dominio de correo.

## 2. Suplantación — el modelo completo, no por fases

### 2.1 Iniciar

```
POST /admin/impersonations
Authorization: Bearer {token del superusuario}
{
  "userUuid": "user-uuid",
  "mode": "read_only",
  "reason": "Ticket HG-1234: revisión solicitada por el cliente"
}
```

```json
{
  "data": {
    "id": "impersonation-uuid",
    "token": "token-de-suplantación",
    "mode": "read_only",
    "startedAt": "2026-10-09T15:04:00Z",
    "expiresAt": "2026-10-09T16:04:00Z",
    "user": {
      "uuid": "user-uuid",
      "email": "didier@example.com",
      "client_uuid": "client-uuid",
      "client_name": "Pullman Miami SAS",
      "name": "Didier Van den Hove",
      "locale": "es",
      "isAccountOwner": true,
      "roles": ["property_manager"]
    }
  }
}
```

- `reason` **obligatorio**, 10–500 caracteres. Se guarda con actor, sujeto,
  cliente, modo, fecha, IP, user agent, vencimiento y cierre: sin motivo la
  auditoría no sirve.
- `mode`: `"read_only"` por defecto; `"full"` solo si el actor tiene
  `admin.impersonate.full`. La aprobación del PO no reemplaza el control por
  usuario.
- `user` tiene **la forma de `GET /user`** del usuario suplantado, para
  hidratarlo con el mismo código de siempre.

### 2.2 Qué es el token suplantado

- **Nuevo y de corta duración** (proponemos 60 min). **No invalida, no rota ni
  toca** el token del superusuario: el front conserva las dos sesiones y
  «Volver a mi cuenta» es dejar de usar el suplantado. Esa es la pieza que
  cumple «la sesión del superusuario no puede cerrarse».
- **Abilities recortadas, no heredadas del actor.** Con ese token:
  - solo endpoints de la cuenta (propiedades, reservas, billing, etc.);
  - **ningún** endpoint `/admin/*`: ni directorio, ni crear otra suplantación
    (anidamiento prohibido), ni leer clientes;
  - `isSuperAdmin`/`capabilities` administrativas ausentes en `GET /user`.
  Que el payload diga «no es superusuario» no basta: el backend tiene que
  recortar las abilities del token.
- **Ligado al actor.** Si el superusuario cierra sesión, pierde el rol, es
  desactivado o su sesión se revoca, **sus suplantaciones activas se revocan**.
  Conservar la sesión administrativa no significa que la suplantación deba
  sobrevivir a la pérdida de autorización del actor.

### 2.3 Solo lectura: por abilities y políticas, no solo por método HTTP

- En `read_only`, cualquier operación **con efecto** responde
  `403 {"code": "IMPERSONATION_READ_ONLY", "message": "…"}`, decidido por la
  política del endpoint. El método HTTP sirve como defensa adicional (bloquear
  `POST/PUT/PATCH/DELETE` fuera de lectura), no como única regla: hay `POST`
  que solo consultan o renderizan, y podría haber `GET` con efectos.
- **Bloqueado siempre, incluso en `full`**: transferir titularidad, eliminar
  la cuenta, cambiar el correo del dueño.
- El front desactiva los controles de escritura en solo lectura, pero el que
  manda es el backend.

### 2.4 Cerrar y revocar — con el token del actor

```
DELETE /admin/impersonations/{impersonationUuid}
Authorization: Bearer {token del superusuario}
```
→ **204**, idempotente (también si ya venció o ya se cerró). Así el actor puede
revocar una sesión activa o vencida sin depender del token suplantado, y un
token vencido no necesita «cerrarse»: el backend responde 401 y el front lo
descarta localmente. No pedimos un `DELETE` con el token suplantado: un
middleware normal lo rechazaría con 401 antes de llegar al controlador.

Opcional: `GET /admin/impersonations?active=1` para ver y revocar las propias.

### 2.5 Errores al iniciar

| Caso | Respuesta |
|---|---|
| Token sin `admin.impersonate.read_only` | `403 IMPERSONATION_FORBIDDEN` |
| Pide `full` sin `admin.impersonate.full` | `403 IMPERSONATION_FULL_FORBIDDEN` |
| Usuario inexistente | `404` |
| Usuario inactivo o eliminado | `409 TARGET_USER_INACTIVE` |
| Cliente suspendido | `409 TARGET_CLIENT_INACTIVE` |
| El objetivo es otro superusuario | `422 CANNOT_IMPERSONATE_SUPER_ADMIN` |
| El actor se suplanta a sí mismo | `409 CANNOT_IMPERSONATE_SELF` |
| El token del actor ya es suplantado | `409 NESTED_IMPERSONATION_FORBIDDEN` |
| `mode` desconocido | `422 INVALID_IMPERSONATION_MODE` |
| `reason` fuera de 10–500 | `422` estándar en `reason` |

## 3. Que el token suplantado se reconozca a sí mismo — `GET /user`

Con el token de suplantación, `GET /user` devuelve el usuario suplantado **más**:

```json
{
  "…": "campos normales del usuario suplantado",
  "impersonation": {
    "id": "impersonation-uuid",
    "actorUuid": "superusuario-uuid",
    "actorEmail": "soporte@hitguest.com",
    "mode": "read_only",
    "startedAt": "2026-10-09T15:04:00Z",
    "expiresAt": "2026-10-09T16:04:00Z"
  }
}
```

Permite reconstruir el banner («estás dentro de la cuenta de X como Y, vence a
las HH:MM») al recargar, sin que el front guarde nada inventado. Sin
suplantación la clave no viene o es `null`. **Al vencer**: los endpoints
responden el 401 de siempre; el front, mientras suplanta, lo trata como «salir
de la cuenta ajena», nunca como «cerrar sesión».

## 4. Directorio — solo superusuario

```
GET /admin/clients?search={texto}&page={n}
```
```json
{
  "data": [
    {
      "uuid": "client-uuid",
      "name": "Pullman Miami SAS",
      "status": "active",
      "owner": { "uuid": "owner-uuid", "name": "Didier", "email": "didier@example.com" },
      "balance": { "amount": 6.49, "currency": "USD" },
      "counts": { "users": 3, "properties": 8 },
      "createdAt": "2026-07-01T10:00:00Z"
    }
  ],
  "meta": { "current_page": 1, "last_page": 2, "per_page": 15, "total": 8 }
}
```

```
GET /admin/clients/{clientUuid}
```
```json
{
  "data": {
    "uuid": "client-uuid",
    "name": "Pullman Miami SAS",
    "email": "cuenta@example.com",
    "status": "active",
    "balance": { "amount": 6.49, "currency": "USD" },
    "owner": { "uuid": "owner-uuid", "name": "Didier", "email": "didier@example.com" },
    "counts": { "users": 3, "properties": 8, "listings": 15, "reservations": 320 },
    "createdAt": "2026-07-01T10:00:00Z"
  }
}
```

```
GET /admin/clients/{clientUuid}/users?page={n}
```
```json
{
  "data": [
    {
      "uuid": "user-uuid",
      "name": "Didier Van den Hove",
      "email": "didier@example.com",
      "isAccountOwner": true,
      "roles": ["property_manager"],
      "status": "active",
      "lastLoginAt": "2026-10-09T13:12:00Z"
    }
  ],
  "meta": { "current_page": 1, "last_page": 1, "per_page": 15, "total": 3 }
}
```

- Sin `admin.clients.read`: **403**, nunca una lista vacía (se leería como «no
  hay clientes»).
- `search` busca por nombre del cliente y por nombre y correo del dueño.
- Los `counts` pueden omitirse en una primera versión; el front los muestra
  solo si vienen.

## Lo que NO pedimos, y por qué

Un «scope global» que haga que `GET /properties`, `GET /reservations`, billing,
etc. devuelvan datos de todos los clientes. Obligaría a tocar cada endpoint y
cada pantalla del front para filtrar y rotular por cliente, y es justo el tipo
de cambio que produce fugas entre cuentas. Con suplantación por token cada
respuesta viene de una sola cuenta.

## Lo que el front construye en cuanto esto exista

Diseñado y aprobado en mock: sesión con dos capas (actor y suplantado) en el
`auth-store`; el cliente HTTP usa el token suplantado mientras esté activo y un
401 en ese modo sale de la suplantación en vez de cerrar la sesión; banner fijo
con cliente, usuario, modo y vencimiento, y botón «Volver a mi cuenta»;
invalidación de cachés y peticiones en vuelo por cliente al entrar y salir;
pantallas de directorio y de cuenta del cliente; controles de escritura
desactivados en solo lectura. **No se construye nada que llame a estos
endpoints hasta que existan.**

## Orden de entrega

1. Decisión del PO registrada (puede entrar; en qué modo) y actualización de
   `RICARDO_API_CONTRACTS.md` §3.3.
2. `roles` y `capabilities` en la sesión (#1).
3. **Modelo de suplantación completo** (#2): token temporal con id, actor,
   sujeto y cliente, motivo, abilities recortadas, solo lectura por políticas,
   vencimiento, revocación por el actor, sin anidamiento, auditoría. Todo en el
   mismo deploy.
4. `GET /user` con el bloque `impersonation` (#3).
5. Directorio paginado de clientes y detalle (#4).
6. Usuarios del cliente, paginados (#4).
7. Modo `full` solo si producto lo aprueba y con `admin.impersonate.full` (#5).
