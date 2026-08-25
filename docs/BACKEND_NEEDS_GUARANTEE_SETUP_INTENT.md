# Backend — Garantía con tarjeta (`/guarantee/setup-intent`)

> **2026-08-19.** El portal muestra «No pudimos preparar el formulario de
> tarjeta» mientras el backend registra **200**. El frontend ya hizo su parte;
> esto no se puede cerrar sin ustedes.

| # | Pedido | Prioridad |
|---|---|---|
| 1 | ¿Un 200 puede traer `publishableKey` / `clientSecret` vacío o ausente? ¿Cuándo? | **Alta** |
| 2 | Un body real de 200 (claves, sin valores) o una reserva de prueba con token | **Alta** |
| 3 | Stripe mal configurado → error explícito, no 200 incompleto | Media |
| 4 | Que el log muestre las **claves** del payload, no solo `{status, message}` | Media |

## Evidencia

El video del huésped muestra **a la vez** «hasta USD 200» (solo se pinta si
`guaranteeAmount` y `currency` llegaron) y «Preparando formulario…» (solo mientras
el campo no montó). ⇒ **El 200 resolvió con datos, y el montaje de Stripe nunca
terminó.** El fallo está entre recibir la respuesta y montar Stripe.

Descartado con mecanismo: no fue fallo del POST, ni bloqueador/CSP (ese caso ya
tiene su propio mensaje distinto), ni 401 (redirige al OTP).

Causa más probable: el 200 sin `publishableKey` usable. `@stripe/stripe-js@9`
(`dist/index.js:166`) rechaza con *"Expected publishable key to be of type
string"* si no es string, y lanza si es `""`.

⚠️ El log es del **18/08 15:51** y el video del **19/08 6:52** — pueden ser
intentos distintos. Y esa reserva (`01a0169c-…`) ya no existe: responde **404**.

## 1. ¿Puede un 200 venir incompleto?

- ¿Hay algún camino que responda 200 con `publishableKey` o `clientSecret` en
  `null`, `""` o ausente? ¿**Bajo qué condiciones** (cuenta sin Stripe, entorno)?
- ¿De dónde sale el `publishableKey`: config global de HIT, o algo por
  propiedad/cuenta que pueda faltar?

**Por qué importa:** si puede faltar, nuestro tipo pasa a nullable. Si nunca
falta, la causa es nuestra y la seguimos por nuestro lado. Hoy no podemos elegir
sin inventar.

## 2. Un body real, o una reserva de prueba

Basta ver **qué claves vienen**, con valores enmascarados
(`"publishableKey": "pk_test_***"`). O una reserva con garantía +
`X-Checkin-Verification-Token` vigente y lo corremos nosotros:

```bash
curl -s -X POST "$API/checkin/{reservationUuid}/main/guarantee/setup-intent" \
  -H "Authorization: Bearer $APP_TOKEN" \
  -H "X-Checkin-Verification-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"guestUuid":"{guestUuid}"}' | jq 'keys'
```

## 3. Error explícito en vez de 200 incompleto

Un 200 debería significar «el frontend puede montar el formulario». Si no se
puede emitir un SetupIntent utilizable, preferimos 4xx/5xx con código estable
—ya tienen el patrón con `errors.checkin.guarantee_not_required`— antes que un
200 al que le faltan campos.

## 4. Log con las claves

Hoy registra `{status, message}`, así que un 200 incompleto se ve idéntico a uno
bueno. Con esto alcanza (nunca los valores):

```
setup-intent OK · keys=[clientSecret,publishableKey,…] · publishableKey=EMPTY
```

Esa línea habría cerrado el caso en cinco minutos.

## Códigos que ahora muestra la pantalla

| Código | Significa | De quién |
|---|---|---|
| `SETUP-PAYLOAD` | 200 sin `clientSecret`/`publishableKey` usables | **Backend** |
| `SETUP-KEY` | Llave presente, Stripe la rechazó | **Backend** (config) |
| `SETUP-HTTP` | El POST falló (4xx/5xx/red) | Según status |
| `SETUP-BLOCKED` | `js.stripe.com` no cargó | Huésped |
| `SETUP-DOM` / `SETUP-ELEMENTS` | Contenedor o Elements fallaron | Frontend |

**Si Didier reproduce y ve `SETUP-PAYLOAD`, eso confirma el pedido 1 sin nada
más.**

## Estado del frontend

Validamos el payload en runtime antes de llamar a Stripe, separamos el mensaje
por causa, y corregimos dos bugs propios (el contenedor se destruía al pasar a
`pending`; el montaje dependía de una carrera con el render). Verificado con
`tsc`, `eslint`, `next build` y 572 tests.

**Esto no arregla la causa raíz:** si el 200 llega incompleto, el huésped sigue
sin poder registrar la tarjeta — solo dejó de ser un fallo mudo.
