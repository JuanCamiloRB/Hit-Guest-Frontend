# Nivel de verificación de identidad por unidad (Avanzada / Esencial)

**Fecha:** 2026-10-12 · **Origen:** pregunta de producto (Didier) · **Estado:** ✅ respondido por backend el 2026-10-14 (en `main`); front pendiente

> El contrato que construyó el backend cubre lo pedido con diferencias de nombre:
> `effectiveProvider {id, name, slug, verificationType}` + `providerSource` en
> vez de `effectiveProviderId/Slug`, y Desactivar borra la elección. Detalle en
> el skill de contratos, «Proveedor de identidad POR UNIDAD».

## Qué se pide

Que un PM pueda elegir, para una unidad concreta, un nivel de verificación de
identidad distinto al de su propiedad:

- **Avanzada:** el provider `didit`.
- **Esencial:** el provider `textract`.

Ejemplo: la propiedad usa Avanzada y una unidad usa Esencial.

## Por qué hoy no se puede

El nivel es el `providerId` de la `PropertyAutomation` de identidad, y lo
heredan todas las unidades. El override de unidad
(`/listing-automation-overrides`) solo acepta estos campos:

- `statusRecordId`, con 6 = aplica y 7 = apagada en la unidad.
- `parameters`, un delta que se mezcla sobre los parámetros base.
- `token`.

No acepta `providerId`. La documentación de overrides lo dice para
didit/textract: *«El override típico sería solo… desactivar la verificación
en un listing específico»*.

El frontend no lo va a simular. Guardar una clave en `parameters` que el
resolver no lee le mostraría al PM un nivel que nunca se aplica.

## Contrato propuesto

Se extienden los endpoints actuales. No hacen falta endpoints nuevos.

### Escritura: `POST /listing-automation-overrides` y `PATCH /listing-automation-overrides/{uuid}`

```json
{ "statusRecordId": 6, "providerId": 1004, "parameters": null }
```

| `providerId` | Efecto |
|---|---|
| omitido en el POST | Hereda el provider de la propiedad (como hoy). |
| omitido en el PATCH | No cambia el valor guardado. |
| `null` | Vuelve a heredar el provider de la propiedad. |
| id válido | Ese provider se usa en esta unidad. |

**Validación, con 422 en `providerId`:**
- El provider debe existir y estar activo (`statusProviderId` 8).
- Debe ser de verificación de identidad, es decir, declarar `parameters.verification_type`.
- Solo se acepta en overrides de una automatización de identidad, `main_guest` o `secondary_guest`. Para cualquier otra automatización, 422.
- Con `statusRecordId: 7`, `providerId` no tiene efecto. Preferimos un 422 si llegan juntos, para que no quede guardado un nivel que nadie ve.

### Lectura

> ❌ Lo que proponíamos acá (`effectiveProviderId` / `effectiveProviderSlug`) NO
> es lo que construyó el backend. **Usar solo los campos definitivos**:
> `providerId` (lo elegido; `null` = hereda), `effectiveProvider {id, name,
> slug, verificationType}` (lo que ejecuta; `null` = nada) y `providerSource`
> (`"listing"` | `"property"` | `null`). Detalle en el skill de contratos,
> «Proveedor de identidad POR UNIDAD».

### Dónde debe regir el provider efectivo

El de la unidad, si existe, y si no el de la propiedad. Debe usarse en todos
estos lugares, porque si alguno sigue leyendo el de la propiedad, el huésped
verá un nivel y se le cobrará otro:

1. `POST /checkin/{r}/identify`: el tipo de `verification` (`session`,
   `document_upload` o `document_capture`).
2. `/verify/result` y el bloque `verification` del portal y del panel.
3. `GET /reservations/{uuid}/automation-status`: la fila de identidad.
4. La facturación: `AutomationUsageRecord` y `billable` con la tarifa del
   provider efectivo.
5. El reintento (`canRetry` y `attemptsRemaining`), que no debe mezclar intentos
   de dos providers distintos en la misma reserva.

### Cómo vuelve a heredar una unidad

Hay dos caminos, y los dos deben dejarla igual:

- `PATCH` con `providerId: null`, que conserva el override por si tiene otros campos.
- `DELETE /listing-automation-overrides/{uuid}`, que quita el override entero.

## Preguntas abiertas

1. Si la propiedad cambia de provider, ¿las unidades con override conservan el
   suyo? Proponemos que sí, porque el override es explícito.
2. Una reserva que ya empezó la verificación con un provider, ¿sigue con él si
   se cambia el override a mitad de camino? Proponemos que sí: el provider se
   fija al crear la sesión.
3. ¿Hay que mostrar en el detalle de la reserva qué provider se usó? Hoy lo
   deducimos de `identityDocument.method`.

## Lo que el frontend ya corrigió mientras tanto (2026-10-12)

- Una unidad sin override, guardada activa y sin cambios, ya no crea un override
  vacío. Esa fila se mostraba como «Hereda de la propiedad» sin serlo.
- Un override activo sin parámetros se muestra como «Override activo sin
  parámetros propios».
- «Volver a heredar» borra el override con
  `DELETE /listing-automation-overrides/{uuid}`.
