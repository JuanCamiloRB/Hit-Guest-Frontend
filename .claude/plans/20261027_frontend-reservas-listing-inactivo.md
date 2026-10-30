# Plan Frontend: alojamientos y propiedades inactivos (reservas, portal, aviso y despacho por huésped)

**Módulos:** Panel del PM (reservas, alojamientos, propiedades, estado de automatizaciones) y portal del huésped.
**Dependencia:** backend del plan `20261027_listing-inactivo-operaciones.md` (implementado y probado).
**Despliegue:** coordinado. El **portal** debe reconocer `portalStatus: "listing_inactive"` antes o junto con el
backend. El panel degrada bien: todo 422 nuevo trae `message` legible, así que lo muestra como cualquier otro error.

---

## 1. Qué cambia

"Inactivo" pasa a significar lo mismo en todo el sistema. Un alojamiento **no es operable** cuando:
- **su propiedad** está inactiva (`statusRecord.id` ≠ 6) o eliminada → `PROPERTY_INACTIVE`. Esta razón tiene precedencia.
- si no, **el alojamiento** está inactivo o eliminado → `LISTING_INACTIVE`.

| Antes | Ahora |
|---|---|
| Se podía crear, mover, reactivar y restaurar reservas en inactivos (panel, API, M2M) | **422** con `code` (sección 2.1) |
| El portal funcionaba completo y cobraba la verificación de identidad | Entrada con `listing_inactive`; acciones con **422** (2.3) |
| El link de check-in por correo salía igual | **No sale ningún link** (correo, WhatsApp, inbox OTA) |
| El barrido cerraba reservas en curso sin SIRE/TRA | Se **congelan**; a los 30 días de la salida pasan a abandonada o incompleta. **Nunca cerrada** |
| Un alojamiento podía estar activo bajo una propiedad inactiva | **422** `PROPERTY_INACTIVE` (2.2) |
| Reactivar la propiedad no reactivaba sus alojamientos; restaurarla los reactivaba todos | Vuelven **exactamente los que la propiedad apagó**, como estaban |
| iCal y KunasPMS dejaban de importar en inactivos; Calry no | **Siempre se importa** (altas, cambios, cancelaciones). Lo que no se hace es operar |
| Despachar SIRE a mano mandaba `guest null` y no hacía nada | Despacho **por huésped** (2.4) |

---

## 2. API

### 2.1 Reservas en un alojamiento o propiedad inactivos (panel/API)

| Operación | Endpoint | Cuándo responde 422 |
|---|---|---|
| Crear | `POST /api/v1/reservations` | Siempre que el alojamiento o su propiedad estén inactivos |
| Mover | `PUT/PATCH /api/v1/reservations/{uuid}` | Solo si el alojamiento **cambia** y el destino está inactivo |
| Reactivar | `PUT/PATCH /api/v1/reservations/{uuid}` | Solo si el estado **pasa a confirmada** (desde cancelada, abandonada o desconocida) |
| Restaurar | `POST /api/v1/reservations/{uuid}/restore` | Siempre |
| Reenviar link | `POST /api/v1/reservations/{uuid}/send-checkin-link` | Siempre |

**Editar o cancelar** una reserva que ya está en un inactivo **sigue funcionando**. El GET→PUT reenvía el mismo
alojamiento y el mismo estado, y eso no cuenta como mover ni reactivar. Aplica a cualquier token, M2M `admin:*` incluido.

```json
HTTP 422
{
  "message": "El alojamiento está inactivo. Actívalo para poder operar reservas en él.",
  "errors": { "listingId": ["El alojamiento está inactivo. Actívalo para poder operar reservas en él."] },
  "payload": null,
  "code": "LISTING_INACTIVE"
}
```
Con la propiedad inactiva llega `"code": "PROPERTY_INACTIVE"` y su propio mensaje. **Decidan por `code`**, no por el texto,
que viene traducido según `X-Locale`. El campo de error es `listingId`, el mismo de los demás errores de ese campo.

### 2.2 Alojamientos bajo una propiedad inactiva

| Operación | Endpoint | 422 `PROPERTY_INACTIVE` en |
|---|---|---|
| Activar (`statusRecordId: 6`) | `PUT/PATCH /api/v1/listings/{uuid}` | `errors.statusRecordId` |
| Moverlo activo a esa propiedad (`propertyUuid`) | `PUT/PATCH /api/v1/listings/{uuid}` | `errors.propertyId` |
| Crearlo activo | `POST /api/v1/listings` | `errors.statusRecordId` |
| Restaurarlo | `POST /api/v1/listings/{uuid}/restore` | `errors.propertyId` |

Crear o mover un alojamiento **inactivo** a esa propiedad sí se permite. Mismo envelope que en 2.1.

### 2.3 Portal del huésped

**Entrada** (`GET /api/v1/checkin/{reservationUuid}` y `GET /api/v1/checkin/{source}/{listingUuid}/{externalId}`):
```json
HTTP 200
{ "portalStatus": "listing_inactive", "message": "Esta reserva no puede procesarse porque el alojamiento asociado está inactivo o ya no existe." }
```
Funciona como `cancelled`, `deleted` y `abandoned`: sin la clave `reservation`, con una pantalla informativa. Prioridad:
- una reserva cancelada, eliminada o abandonada sigue mostrando **su** estado;
- un check-in **ya completo** (todos los huéspedes) o una reserva post-estancia (cerrada o incompleta) muestran el portal normal, con sus documentos.

**Acciones** (identify, OTP de contacto, sesión Didit, formulario, firma, garantía, completar principal y secundario,
documentos de secundario, `saveGuest`). Se rechazan **antes** de validar el payload:
```json
HTTP 422
{ "code": "LISTING_INACTIVE", "message": "Esta reserva no puede procesarse porque el alojamiento asociado está inactivo o ya no existe." }
```
(o `PROPERTY_INACTIVE`). Si reciben ese `code`, muestren la misma pantalla de `listing_inactive`.

**Siguen funcionando**, porque son de solo lectura: resultado de verificación, contrato firmado y su vista previa, estado de la garantía, render y PDF de documentos.

### 2.4 Despacho manual

**Con el alojamiento o la propiedad inactivos**, `dispatch`, `redispatch` y `resend-pdf` responden **422** con el envelope de 2.1.
Antes respondían 202 y no pasaba nada. Con el alojamiento **eliminado** sigue el 422 de siempre (`listing_unavailable`).

**Automatizaciones por huésped** son las que tienen un disparo `on_guest_checkin_completed` u `on_physical_checkout`, por ejemplo SIRE.

`POST /api/v1/reservations/{r}/property-automations/{uuid}/dispatch`
- **Sin cuerpo:** un job por cada huésped con check-in completo al que aplica la automatización y que **todavía no tiene ejecución**. El botón actual sigue funcionando así, sin cambios.
- **`{"guestUuid": "…"}`:** solo para ese huésped.
- **202:**
  ```json
  { "message": "Automatización despachada para 2 huésped(es).", "dispatchedGuests": ["uuid-1", "uuid-2"] }
  ```
- **Errores:**

  | Status | Cuándo |
  |---|---|
  | 404 | El huésped no es de la reserva |
  | 422 | No queda ningún huésped pendiente |
  | 422 | Ese huésped ya tiene una ejecución exitosa o en curso |
  | 422 | Ese huésped tiene una ejecución fallida: usen reintentar |
  | 422 | La automatización no aplica a ese huésped, o no ha terminado su check-in |
  | 422 | Se mandó `guestUuid` a una automatización de nivel reserva |

`POST /api/v1/reservations/{r}/automation-records/{record}/redispatch`: el último registro fallido de **cada huésped** se puede reintentar, aunque no sea el último de la automatización. El enfriamiento de 5 minutos se cuenta por huésped.

### 2.5 Estado de automatizaciones (`GET /api/v1/reservations/{uuid}/automation-status`)

Cada ítem conserva sus campos actuales y agrega dos:
- `isPerGuest` (bool);
- `guests`: un elemento por huésped de la reserva, vacío si la automatización es de nivel reserva:
  ```json
  { "guestUuid": "…", "name": "Ana Pérez", "isMainGuest": true, "checkinCompleted": true,
    "status": "failed", "usageRecordId": 123, "lastError": "…", "lastRunAt": "2026-10-27 09:00:00",
    "canDispatch": false, "canRedispatch": true }
  ```
  `status` puede ser `not_started`, `pending`, `completed`, `failed` o `skipped`. Para reintentar a un huésped, usen su `usageRecordId`.

En las automatizaciones por huésped, el `canDispatch` de arriba significa "hay algún huésped elegible sin ejecución".

### 2.6 Contar reservas afectadas (para el aviso)

- Alojamiento: `GET /api/v1/reservations?listingUuid[eq]={uuid}&statusReservationId[in]=…` → `meta.total`.
- Propiedad, nuevo: `GET /api/v1/reservations?propertyUuid[eq]={uuid}&statusReservationId[in]=…` → `meta.total`.

Usen los ids de confirmada, en curso e incompleta. Los de **incompleta** y **abandonada** cambian por ambiente: tómenlos
del catálogo de estados de reserva, como ya hacen para mostrar el estado.

### 2.7 Estado de propiedades y alojamientos

- 6 = activo, 7 = inactivo (catálogo categoría 3, solo esos dos valores).
- Siempre llega como `statusRecord: {id, name}` anidado, nunca como `statusRecordId` plano. Comparen por `id`, porque `name` viene traducido.
- Las listas **no ocultan** inactivos. Para filtrar: `?statusRecordId[eq]=6`; sin operador, el filtro se ignora.
- En los PUT, manden `statusRecordId` como número JSON. Desde ahora el backend también acepta `"6"` sin efectos raros.

---

## 3. Aviso al desactivar (texto exacto)

### Alojamiento

**es**
> Al desactivar este alojamiento:
> - Se detienen las automatizaciones de sus reservas confirmadas, en curso e incompletas.
> - Los huéspedes que no hayan terminado su check-in no podrán continuarlo, y no se envían links de check-in.
> - No se podrán crear, mover, reactivar ni restaurar reservas en él.
> - Las reservas que lleguen de tu PMS o calendario se siguen registrando, pero no se operan.
> - Lo que ya se ejecutó no se revierte: los códigos de acceso enviados siguen funcionando hasta la salida y los contratos enviados siguen vigentes.
> - Sus reservas quedan en pausa: si sigue inactivo 30 días después de la salida, pasan a abandonadas o incompletas.
> - Al reactivarlo, nada se ejecuta solo: reenvía los links de check-in.

**en**
> When you deactivate this listing:
> - Automations stop for its confirmed, in-progress and incomplete reservations.
> - Guests who have not finished their check-in cannot continue it, and no check-in links are sent.
> - Reservations cannot be created, moved, reactivated or restored on it.
> - Reservations coming from your PMS or calendar are still recorded, but not operated.
> - Whatever already ran is not undone: access codes already sent keep working until checkout, and contracts already sent stay valid.
> - Its reservations are put on hold: if it is still inactive 30 days after checkout, they become abandoned or incomplete.
> - When you reactivate it, nothing runs on its own: resend the check-in links.

**pt**
> Ao desativar esta acomodação:
> - As automações das suas reservas confirmadas, em andamento e incompletas param.
> - Os hóspedes que não concluíram o check-in não poderão continuá-lo, e nenhum link de check-in é enviado.
> - Não será possível criar, mover, reativar nem restaurar reservas nela.
> - As reservas que chegarem do seu PMS ou calendário continuam sendo registradas, mas não são operadas.
> - O que já foi executado não é desfeito: os códigos de acesso enviados continuam funcionando até o checkout e os contratos enviados continuam válidos.
> - As suas reservas ficam em pausa: se continuar inativa 30 dias após o checkout, passam a abandonadas ou incompletas.
> - Ao reativá-la, nada é executado sozinho: reenvie os links de check-in.

### Propiedad

Lo mismo que para el alojamiento, más estas dos líneas:
- **es:** "Se desactivan todos sus alojamientos activos; al reactivar la propiedad vuelven esos mismos (los que desactivaste a mano siguen inactivos)." / "Mientras esté inactiva, no podrás activar, crear activos, mover ni restaurar alojamientos en ella."
- **en:** "All its active listings are deactivated; when you reactivate the property, those same listings come back (the ones you deactivated yourself stay inactive)." / "While it is inactive, you cannot activate, create active, move or restore listings in it."
- **pt:** "Todas as suas acomodações ativas são desativadas; ao reativar a propriedade, essas mesmas voltam (as que você desativou manualmente continuam inativas)." / "Enquanto estiver inativa, não será possível ativar, criar ativas, mover nem restaurar acomodações nela."

Para mostrar cuántas reservas se afectan, usen 2.6.

Una nota para el equipo; no hace falta mostrársela al PM: las propiedades **desactivadas antes de este despliegue** no
recuerdan qué alojamientos estaban activos. Al reactivarlas, sus alojamientos se activan uno a uno, como antes.

---

## 4. Respuestas a las preguntas del frontend

| Pregunta | Respuesta |
|---|---|
| ¿Se cancelan los jobs en cola? | No se borran de la cola. Al ejecutarse, cada job relee el estado y termina sin hacer nada (sin cobro). No se programan nuevos. Si se reactiva antes de que corra un job diferido (por hora o por salida), ese job corre. |
| Al reactivar, ¿qué pasa con lo pendiente? | Nada se re-ejecuta solo. El PM reenvía los links. Las automatizaciones por hora o por salida se retoman solas en las corridas nocturnas si la reserva sigue en su ventana; las de check-in completado se despachan a mano (2.4). |
| ¿"Todas las reservas" incluye finalizadas y canceladas? | No. Solo confirmadas, en curso e incompletas, que son las únicas que corren automatizaciones. |
| ¿Aplica a las importadas? | Se importan siempre (Calry, KunasPMS, iCal), con altas, cambios y cancelaciones. No reciben link y no se operan. |
| Desactivar la propiedad, ¿cambia sus alojamientos? | Sí: apaga los activos, y al reactivarla o restaurarla vuelven esos mismos. |
| ¿Portal y link siguen funcionando? | No: entrada `listing_inactive`, acciones con 422 y ningún link. La excepción son los check-ins ya completos. |
| ¿6/7 y cómo llega? | Ver 2.7. |

---

## 5. Checklist

- [ ] Panel, reservas: mostrar el `message` de los 422 y, por `code`, ofrecer "Activar alojamiento" (`LISTING_INACTIVE`) o "Activar propiedad" (`PROPERTY_INACTIVE`).
- [ ] Panel, reservas: deshabilitar crear, mover, reactivar, restaurar y reenviar link cuando el alojamiento o la propiedad estén inactivos (el backend igual lo impide).
- [ ] Panel, alojamientos: deshabilitar "activar" y "restaurar" bajo una propiedad inactiva; manejar el 422 `PROPERTY_INACTIVE`.
- [ ] Panel, desactivar: mostrar el aviso de la sección 3, con el conteo de 2.6.
- [ ] Portal: pantalla para `portalStatus: "listing_inactive"`, y la misma ante un 422 con `code` `LISTING_INACTIVE` o `PROPERTY_INACTIVE`.
- [ ] Panel, automatizaciones: usar `isPerGuest` y `guests[]`; botón por huésped (`guestUuid`) y reintento por `usageRecordId` de cada huésped.
- [ ] Panel, automatizaciones: con el alojamiento inactivo, manejar el 422 de dispatch, redispatch y resend-pdf.

## 6. Pruebas manuales (staging)

1. Desactivar un alojamiento → intentar crear una reserva en él → 422 `LISTING_INACTIVE`.
2. Desactivar la propiedad → crear una reserva → 422 `PROPERTY_INACTIVE`; activar un alojamiento suyo → 422 `PROPERTY_INACTIVE`.
3. Con el alojamiento inactivo: abrir el portal de una reserva sin check-in → `listing_inactive`; intentar identificarse → 422 con `code`.
4. Con un check-in ya completo: el portal se ve normal y el contrato firmado se descarga.
5. Desactivar una propiedad con un alojamiento apagado a mano → reactivarla → ese sigue en 7 y los demás vuelven a 6.
6. Reserva con 2 huéspedes completos y SIRE sin ejecutar → "Despachar" → 202 con los dos en `dispatchedGuests`; `automation-status` muestra `guests[]`.

---

## 7. Respuestas 2026-10-28 (plan `20261028_respuestas-frontend-estado-proveedores-garantia.md`)

### 7.1 Clave estable del estado de reserva
- La reserva trae ahora **`statusReservation.slug`**, junto a `id` y `name`.
- El catálogo ya lo traía: `GET /api/v1/catalogs?catalogCategoryName[eq]=status_reservation&status[eq]=ACT` → `slug` en cada fila.
- Valores: `confirmed`, `in_progress`, `closed`, `cancelled`, `abandoned`, `incomplete`, `deleted`, `unknown`.
- Usen `slug` en vez de los ids: los de `abandoned` e `incomplete` cambian por ambiente. Son minúsculas, la misma convención que `source.slug`.

### 7.2 `statusReservationId[in]`
- **Formato:** ids separados por coma, `?statusReservationId[in]=27,28,860`.
- **Limpieza:** se ignoran espacios, ceros, valores no numéricos y duplicados. Si la lista queda vacía no se filtra nada: llegan todos los estados.
- **No soportado:** la forma de arreglo `statusReservationId[in][]=27`.
- **Combinable con:** `statusReservationId[eq]`/`[neq]`, `listingUuid[eq]`, `propertyUuid[eq]`, fechas, etc.
- **Ids:** tómenlos del catálogo por `slug` (7.1).

### 7.3 Estado del alojamiento en la reserva
- `listing.inactiveReason` viene en todas las respuestas de reservas (show, index, store, update y restore).
- Vale `null`, `"LISTING_INACTIVE"` o `"PROPERTY_INACTIVE"`: la misma regla y los mismos códigos que los 422, sin consultas extra.
- "Reenviar link" se habilita cuando `listing.inactiveReason === null` y `statusReservation.slug` es `confirmed` o `in_progress`.
- Si `listing` viene `null`, el alojamiento fue eliminado.

### 7.4 Nombres de proveedores
`provider.name` trae ahora estos nombres universales, en inglés, para todos los idiomas:

| Proveedor (slug) | `name` |
|---|---|
| `didit` | "Advanced Verification" |
| `textract` | "Essential Verification" |
| `hitguest_signature` | "HitGuest Signature" (sin cambio) |

- Si el panel filtraba con `GET /providers?name[eq]=…` o comparaba los nombres anteriores, cámbienlo por el slug (`parameters.slug`), que no cambia.
- El handoff `20261014` les indicaba etiquetar la verificación según `verification_type`; ya pueden mostrar `provider.name` directamente.

### 7.5 Monto de la garantía
- **Una sola fuente:** el documento global de la garantía (`damage_consumption_guarantee`), un monto por idioma. Solo lo editan super_admin o un token M2M.
- **Una sola lectura:** el anexo del contrato (vista previa y PDF), el `guaranteeAmount` del setup-intent y el tope del cobro leen ahora **el mismo monto**. Usan el idioma configurado en la propiedad (`communications_locale`), nunca el del request; si ese idioma no tiene monto, se usa el inglés.
- **Formato:** `guaranteeAmount` es siempre un número en texto, sin separador de miles (`"1000"`, `"1000.50"`). El formato para mostrarlo lo pone el frontend. `currency` es siempre `"USD"`.
- **Al editar:** guardar un monto con separador de miles (`1,000`, `1.000,50`) o con texto responde 422.
- **Al cobrar:** si no hay un monto válido configurado, el cobro responde 422 en vez de cobrar sin tope.
- **Stripe:** no retiene nada al guardar la tarjeta, porque el SetupIntent solo la guarda. El cobro lo hace un admin después, con ese tope.
- **Sin congelar:** el monto no se fija por reserva, así que una edición posterior del documento cambia lo que se muestra y el tope desde ese momento.
