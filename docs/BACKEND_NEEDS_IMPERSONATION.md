# Lo que necesitamos del Backend — Superusuario e ingreso a cuentas de clientes

> Pedido de producto del 2026-10-09: que un superusuario de HitGuest vea todas
> las cuentas (clientes, usuarios, propiedades) y pueda **entrar a la cuenta de
> cualquier usuario sin código ni contraseña**, conservando su propia sesión.
> Mock aprobado por el equipo: tres pantallas (directorio de clientes, cuenta
> del cliente con sus usuarios, y el dashboard «dentro de la cuenta» con banner
> fijo y botón para volver). Contrastado con `RICARDO_API_CONTRACTS.md` y con
> lo que hoy responde `guest.hit.tools`.

## Resumen

| # | Pedido | Sin esto | Prioridad |
|---|---|---|---|
| 1 | `GET /user` dice si la sesión es de superusuario | El front no puede mostrar nada: inferirlo por correo o cuenta sería inventar | Alta |
| 2 | Directorio de clientes y de sus usuarios (solo superusuario) | No hay lista que recorrer | Alta |
| 3 | Emitir un **token aparte** para actuar como un usuario, sin invalidar el del superusuario | Es la pieza que conserva la sesión propia | Alta |
| 4 | `GET /user` con ese token declara que es una suplantación | Al recargar la página el front no sabría que está dentro de otra cuenta | Alta |
| 5 | Auditoría del actor real y modo solo lectura | Un soporte podría enviar, cobrar o borrar sin rastro | Alta (producto) |

## Antes de nada: una decisión de producto registrada va en contra

`RICARDO_API_CONTRACTS.md` §3.3 (`SUPER_ADMIN`, estado `PENDIENTE`): *«incluso
`SUPER_ADMIN` debe ver únicamente sus propias propiedades, listings y reservas
en estos endpoints. No debe recibir scope global»*. Este pedido **no la
contradice si se hace por suplantación**: los endpoints de datos siguen
acotando por el token de sesión, y el superusuario ve una cuenta a la vez con un
token emitido para ese usuario. Lo que sí hay que acordar con el PO es que el
superusuario pueda **entrar** a las cuentas. Pedimos que esa decisión quede
registrada antes de construir.

## Lo que ya existe y se reutiliza

- `GET /user` y `POST /auth/verify-otp` → `uuid`, `email`, `client_uuid`,
  `client_name`, `name`, `locale`, `isAccountOwner`. **Sin rol** (pendiente
  desde julio: `roles` en `UserResource`).
- `GET /users` lista los usuarios **del propio cliente**; `GET /clients/{uuid}`
  lee **la propia cuenta**. Para otro cliente: 403.
- Todo endpoint de datos (propiedades, reservas, billing, automatizaciones)
  acota por el token de sesión. **No pedimos «scope global»**: con un token del
  usuario suplantado, cada pantalla del front muestra una sola cuenta sin tocar
  nada, y no hay forma de mezclar datos de dos clientes.

## 1. Quién es superusuario — `GET /user` y `verify-otp`

Campo nuevo, booleano, en el mismo objeto `user` de ambos endpoints:

```json
{
  "uuid": "…",
  "email": "soporte@hitguest.com",
  "client_uuid": "…",
  "client_name": "HitGuest",
  "isAccountOwner": true,
  "isSuperAdmin": true
}
```

- `false` o ausente = usuario normal. El front muestra el menú «Clientes» solo
  con `true` explícito.
- Quién es superusuario se define en el backend (tabla/rol); el front nunca lo
  deduce de un dominio de correo.
- Si prefieren `roles: ["super_admin"]` (lo que ya estaba pendiente para los
  roles de equipo), sirve igual; lo importante es que sea un valor explícito.

## 2. Directorio de clientes y usuarios — solo superusuario

```
GET /admin/clients?search={texto}&page={n}
Authorization: Bearer {token de superusuario}
```

```json
{
  "data": [
    {
      "uuid": "client-uuid",
      "name": "Pullman Miami SAS",
      "ownerEmail": "owner@example.com",
      "status": "active",
      "propertiesCount": 8,
      "usersCount": 3,
      "balance": { "amount": 6.49, "currency": "USD" },
      "createdAt": "2026-07-01T10:00:00Z"
    }
  ],
  "meta": { "current_page": 1, "last_page": 2, "per_page": 15, "total": 8 }
}
```

```
GET /admin/clients/{clientUuid}
GET /admin/clients/{clientUuid}/users
```

```json
{
  "data": [
    {
      "uuid": "user-uuid",
      "name": "Didier Van den Hove",
      "email": "didier@example.com",
      "isAccountOwner": true,
      "role": "property_manager",
      "lastLoginAt": "2026-10-09T13:12:00Z"
    }
  ]
}
```

- Para cualquier token que no sea de superusuario: **403**, nunca una lista
  vacía (una lista vacía se leería como «no hay clientes»).
- `search` busca por nombre del cliente, nombre y correo del dueño.
- Los contadores pueden omitirse en una primera versión; el front los muestra
  solo si vienen.

## 3. Entrar como un usuario — token aparte, el del superusuario intacto

```
POST /admin/impersonate
Authorization: Bearer {token de superusuario}
{ "userUuid": "user-uuid", "mode": "read_only" }
```

```json
{
  "token": "token-de-suplantación",
  "expiresAt": "2026-10-09T16:04:00Z",
  "mode": "read_only",
  "user": {
    "uuid": "user-uuid",
    "email": "didier@example.com",
    "client_uuid": "client-uuid",
    "client_name": "Pullman Miami SAS",
    "name": "Didier Van den Hove",
    "locale": "es",
    "isAccountOwner": true,
    "isSuperAdmin": false
  }
}
```

Semántica, que es lo que importa:

- Es un token **nuevo y de corta duración** (proponemos 60 min). **No invalida,
  no rota ni toca** el token del superusuario. Así el front guarda las dos
  sesiones y «Volver a mi cuenta» es simplemente dejar de usar el token
  suplantado. Esta es la pieza que cumple «la sesión del superusuario no puede
  cerrarse».
- `user` tiene **exactamente la forma de `GET /user`** del usuario suplantado,
  para que el front lo hidrate con el mismo código de siempre.
- `mode`: `"read_only"` (por defecto) o `"full"`. En solo lectura, toda
  escritura (`POST`/`PUT`/`PATCH`/`DELETE` fuera de `/admin/*`) responde
  **403** con `{"code": "IMPERSONATION_READ_ONLY", "message": "…"}`. El front
  desactiva los botones, pero el que manda es el backend.
- Errores: 403 si el token no es de superusuario; 404 si el usuario no existe;
  422 `{"code": "CANNOT_IMPERSONATE_SUPER_ADMIN"}` si el objetivo es otro
  superusuario.

```
DELETE /admin/impersonate
Authorization: Bearer {token de suplantación}
```
→ 204. Revoca ese token. Si ya venció, también 204 (idempotente).

## 4. Que el token suplantado se reconozca a sí mismo — `GET /user`

Con el token de suplantación, `GET /user` devuelve el usuario suplantado **más**:

```json
{
  "…": "campos normales del usuario suplantado",
  "impersonation": {
    "actorUuid": "superusuario-uuid",
    "actorEmail": "soporte@hitguest.com",
    "mode": "read_only",
    "startedAt": "2026-10-09T15:04:00Z",
    "expiresAt": "2026-10-09T16:04:00Z"
  }
}
```

Es lo que permite reconstruir el banner («estás dentro de la cuenta de X como
Y, vence a las HH:MM») al recargar la página, sin que el front guarde nada
inventado. Sin suplantación la clave no viene (o es `null`).

**Al vencer el token**: los endpoints responden el **401** de siempre. El front,
mientras esté suplantando, trata ese 401 como «salir de la cuenta ajena» y no
como «cerrar sesión», así la sesión del superusuario sobrevive.

## 5. Auditoría y permisos (decisión de producto)

- Toda escritura hecha con un token suplantado queda registrada con el **actor
  real** (`actorUuid`) además del usuario suplantado. Los logs de API, los
  `AutomationUsageRecord` y cualquier correo que se dispare deberían poder
  decir quién actuó de verdad.
- Pedimos **solo lectura por defecto**. Entrar a mirar una cuenta de soporte no
  debería poder enviar un WhatsApp cobrado, recargar saldo, transferir la
  titularidad o eliminar reservas por accidente. `mode: "full"` queda como
  opción explícita al entrar, si el PO la aprueba.
- Acciones que recomendamos **bloquear siempre** aunque el modo sea `full`:
  transferir titularidad, eliminar la cuenta, cambiar el correo del dueño.

## Lo que NO pedimos, y por qué

Un «scope global» que haga que `GET /properties`, `GET /reservations`, billing,
etc. devuelvan datos de todos los clientes. Obligaría a tocar cada endpoint y
cada pantalla del front para filtrar y rotular por cliente, y es justo el tipo
de cambio que produce fugas entre cuentas. Con suplantación por token no hay
nada que filtrar.

## Lo que el front construye en cuanto esto exista

Ya está diseñado y no depende de la forma exacta de los payloads más allá de lo
descrito: sesión con dos capas (actor y suplantado) en el `auth-store`; el
cliente HTTP usa el token suplantado mientras esté activo y un 401 en ese modo
sale de la suplantación en vez de cerrar la sesión; banner fijo con cliente,
usuario, modo y vencimiento, y botón «Volver a mi cuenta»; limpieza de las
cachés por cliente al entrar y salir; pantallas de directorio de clientes y de
cuenta del cliente; controles de escritura desactivados en solo lectura.

## Orden sugerido

1. Decisión del PO (registrar que el superusuario puede entrar a las cuentas).
2. `isSuperAdmin` en `GET /user` (#1): con esto el front ya puede ocultar o
   mostrar el menú.
3. `POST /admin/impersonate` + `GET /user` con `impersonation` (#3 y #4): con
   esto ya funciona entrar y volver, aunque el directorio sea provisional.
4. Directorio (#2).
5. Auditoría y solo lectura (#5), antes de abrirlo a más personas que el equipo.
