# Plan: TRA y SIRE con credenciales por alojamiento (frontend)

- **Fecha:** 2026-11-12. Revisión 2 del mismo día, que incorpora la auditoría externa.
- **Contrato:** «Frontend — TRA y SIRE con credenciales por alojamiento» (2026-11-10). Backend en la rama `feat/tra-sire-credenciales-por-alojamiento`, plan `20261110_tra-sire-credenciales-por-alojamiento.md`.
- **Estado (2026-11-12):** implementado y sin commit: fases 0b, 1 y 2, más lo de las fases 3–5 que no depende del backend:
  - B9: `?tab=` con `lib/property-tabs.ts` (`propertyEditHref`, `isPropertyTab`), y una prueba que compara la lista con las pestañas reales del formulario;
  - texto de `credentials_missing`;
  - B6: el `token` interno ya no se escribe ni se muestra;
  - §4.4: textos sin «heredar» en modo por alojamiento, con `LISTING_CREDENTIALS_COPY`, y los estados «Sin credenciales» y «Excluido».

  `npm run verify` y `next build` en verde (1887 pruebas). Siguen pendientes:
  - esperan a Q2: campos obligatorios por alojamiento, «configurado»/«incompleto»/«sin confirmar» y el conteo «N de M»;
  - esperan a Q2 y al `automationUuid`: el enlace directo desde la reserva;
  - accesibilidad de `ParameterField` (A5).

  Nada se verificó por curl ni en el navegador con sesión de PM.
- **Antecedente:** skill §1, «TRA/SIRE solo por alojamiento — NO soportado hoy» (2026-10-13). Ese análisis queda como historia.

## Cambios de la revisión 2

Cada punto de la auditoría se comprobó en el código antes de aceptarlo (2026-11-12):

| # | Hallazgo | Comprobación | Qué cambia en el plan |
|---|---|---|---|
| A1 | El front no debe depender de que el backend devuelva secretos | Correcto. Con un valor omitido, `missingAfterMerge` diría «falta» y obligaría a reescribirlo | Se elimina `missingAfterMerge`. `ready` e `incomplete` salen de metadatos del backend (`credentialsComplete`, `missingCredentialKeys`) |
| A2 | En modo por alojamiento no existe «heredar», y hay más textos que el atajo | Confirmado. `AutomationOverrideModal.tsx` :329, :394, :486, :534, :544, :567; `ListingOverridesPanel.tsx` :119, :262; `PropertiesUnits.tsx` :1230, :1307 | Inventario completo en §4.4 |
| A3 | El «3 de 5» en la tarjeta no es gratis | Confirmado. `ListingOverridesPanel` carga solo al expandirse (:41, :85) y hace una petición por alojamiento (:57) | Sin conteo en la tarjeta. El conteo va dentro del panel, después de cargarlo |
| A4 | El enlace de la reserva debe llevar al alojamiento | Confirmado. `AutomationStatusItem` conoce `item.automationUuid` (:69); `OperationsPanel` tiene `propertyUuid` y `listingUuid` (:78) | El enlace directo pasa a obligatorio (§4.5) |
| A5 | `FieldError` solo no basta para la accesibilidad | Confirmado. Ningún `Label` de `ParameterField` tiene `htmlFor` | Campos con `id`, `htmlFor`, `aria-invalid`, `aria-describedby`, `required`, y foco en el primer error |
| A6 | P1 no bloquea | De acuerdo. El contrato exige credenciales completas en el override activo y dice que sin ellas no se reporta; eso implica que las de la propiedad se ignoran | Se fija esa interpretación como contrato y queda solo para confirmar |
| **N1** | **Hallazgo nuevo, más grave: el modal pondría en claro cualquier valor sensible que reciba** | `AutomationOverrideModal.tsx:544` usa `placeholder: "Heredar: " + baseParams[clave]` en todo campo que no sea `array` ni `select`. Incluye los `password`: el token de TRA, la contraseña de SIRE y el `client_secret` y `password` de TTLock. Un placeholder se ve en claro aunque el campo sea de contraseña. ⚠️ **No se verificó por curl ni en Network si producción devuelve esos valores reales, enmascarados u omitidos.** El código demuestra la exposición si llegan, no que lleguen | Arreglo independiente, **antes** de la fase 1 (§5, fase 0b) |

### Revisión 3 (auditoría del 2026-11-12, 2:01 p. m.)

- **N1** quedaba como «✅ comprobado que el GET devuelve credenciales en claro». Pasa a **⚠️ sin verificar**, porque es inferencia del código, no una respuesta observada. Corregido también en el skill.
- **Estado `unknown`:** el texto ya no afirma «Credenciales cargadas». Ahora dice «No pudimos confirmar las credenciales», en tono de advertencia y con «Revisar», sin contarlo como listo ni como incompleto.
- **Obligatoriedad por campo** (§4.3), en tres niveles:
  - `schema.required`: requisito del contrato.
  - `requiredForSave`: obligatorio ahora, porque el override es nuevo o la clave figura en `missingCredentialKeys`.
  - Secreto ya configurado: vacío, sin `required`, con el texto «Ya configurado · escribe para reemplazarlo».

  El 422 sigue siendo la autoridad final. El servicio normaliza `credentialsComplete`/`credentials_complete` y `missingCredentialKeys`/`missing_credential_keys`.
- **Fase 5:** antes de armar el enlace directo, hay que confirmar que el `automationUuid` de `automation-status` es el `uuid` de la `PropertyAutomation`. Evidencia en el código: ya se usa como `{uuid}` en `/reservations/{r}/property-automations/{uuid}/dispatch` (`automation-service.ts:776`). Falta confirmarlo con curl.
- **Aprobadas para implementar:** 0b → 1 → 2. Las fases 3 y 4 esperan los metadatos del backend (Q2). La fase 5 espera además la confirmación anterior.

## 1. Qué cambia para el PM

En un edificio con dueños distintos, el PM activa TRA o SIRE en la propiedad **sin credenciales**, con el interruptor «Credenciales por alojamiento».

- Cada alojamiento lleva las suyas. Un alojamiento sin credenciales completas **no se reporta ni se cobra**, y el panel de la reserva lo muestra con un enlace al alojamiento afectado.
- Automatizaciones y Alojamientos editan **el mismo** override (`listing-automation-overrides`): son dos vistas del mismo dato.

## 2. Lo que ya está bien (comprobado en el código)

- **El token del Ministerio ya va en `parameters.token`.**
  - El modal arma los campos con `getOverrideFieldSchema(slug)` (el esquema del proveedor) y los manda en `parameters`.
  - Nunca escribe el `token` superior en `create` ni en `update`.
- **El `PATCH` manda solo lo que cambió** y `null` para borrar una clave.
- **`lastError` se traduce en un solo lugar,** `errorMessage()` (`automation-status-meta.ts`, `ERROR_CODE_LABELS`). Lo usan la tarjeta, la subfila por huésped y el historial.
- **Las claves obligatorias ya están en el esquema.** Los `required` del esquema coinciden con la validación del contrato:
  - TRA: `token` y `rnt`.
  - SIRE: `document_type`, `document_number` y `password` (`company_code` es opcional).

  Se derivan de ahí, sin una segunda lista.

## 3. Brechas

| # | Brecha | Dónde |
|---|---|---|
| B1 | No existe `credentials_scope` | tipos, `ConfigModal.tsx` |
| B2 | La activación exige las credenciales de la propiedad | `AutomationCard.tsx:221` (`missingRequiredParams`), `:282` |
| B3 | Todos los campos del override son opcionales y su texto habla de herencia | `getOverrideFieldSchema` (`automation-definitions.ts:550`) |
| B4 | El 422 del override va a un toast y `ParameterField` no asocia etiquetas ni errores | `AutomationOverrideModal.tsx:378`, `ParameterField.tsx` |
| B5 | Los textos de «heredar» son falsos en modo por alojamiento | inventario en §4.4 |
| B6 | El `token` superior se escribe y se muestra | `draftOverrideCreatePayload` (`PropertiesUnits.tsx:139`), `isMeaningfulOverride` (:148), insignia «Token» (`ListingOverridesPanel.tsx:168`, `PropertiesUnits.tsx:1263`) |
| B7 | `credentials_missing` no tiene texto | `ERROR_CODE_LABELS` |
| B8 | El panel de la reserva no tiene con qué armar el enlace | `AutomationStatusList` recibe solo `reservationUuid` (`OperationsPanel.tsx:383`) |
| B9 | **Bug que ya existía:** `?tab=automation` en vez de `automations` abre el formulario vacío | `PropertyCard.tsx:175` |
| N1 | **Bug que ya existía:** secretos de la propiedad en el placeholder | `AutomationOverrideModal.tsx:544` |

## 4. Diseño

### 4.1 Lógica pura: `src/features/properties/lib/credentials-scope.ts`

```ts
type CredentialsScope = "property" | "listing"

supportsListingCredentials(automation | slug): boolean   // solo TRA y SIRE, por canonicalSlug
readCredentialsScope(automation): CredentialsScope       // "listing" → listing; ausente/null/"property"/desconocido → property
requiredListingCredentialKeys(slug): string[]            // los `required` del esquema del proveedor

listingCredentialState(override | null):
  | { kind: "missing" }                            // sin override: no se reporta
  | { kind: "excluded" }                           // override 7
  | { kind: "ready" }                              // override 6 + credentialsComplete === true
  | { kind: "incomplete"; missing: string[] }      // override 6 + credentialsComplete === false
  | { kind: "unknown" }                            // override 6 sin metadatos (backend sin el campo)
```

- **No se calcula nada a partir de valores de secretos.** Se lee `credentialsComplete` y `missingCredentialKeys`, que llegan del backend (pregunta Q2).
- Un override 6 sin metadatos es `unknown` y se pinta «No pudimos confirmar las credenciales», en tono de advertencia y con la acción «Revisar» (abre el modal). No cuenta como listo ni como incompleto. Mismo criterio tri-estado que `automationType`.
- Los metadatos se normalizan en el servicio (`normalizeOverride`):
  - `credentialsComplete` o `credentials_complete` → `boolean | undefined`;
  - `missingCredentialKeys` o `missing_credential_keys` → `string[] | undefined`, solo strings.

  Un tipo inesperado se lee como ausente, o sea `unknown`.
- El nombre visible de `missing` sale del `label` del esquema; nunca se muestra la clave cruda.

Pruebas:
- `readCredentialsScope` con todas las entradas; un valor desconocido falla hacia `property`, el modo que exige credenciales.
- `requiredListingCredentialKeys` igual a la lista del contrato.
- `listingCredentialState` en sus cinco estados, incluido `unknown`.

### 4.2 Propiedad (`ConfigModal`, `AutomationCard`)

- **Interruptor** «Credenciales por alojamiento», solo si `supportsListingCredentials`. Ayuda: «Para edificios con apartamentos de dueños distintos. Cada alojamiento lleva sus propias credenciales; uno sin ellas no se reporta.»
  - **Encendido:** oculta las credenciales generales, mantiene los disparadores y guarda `credentials_scope: "listing"` explícito.
  - **Apagado:** guarda `"property"` explícito y vuelve a exigir las credenciales.
- **No se borran las credenciales generales** al cambiar de modo. El contrato implica que se ignoran en modo por alojamiento (A6), y conservarlas permite volver al otro modo.
- **422 en `parameters.credentials_scope`:** se asocia al interruptor (`aria-describedby`).
- **`AutomationCard`:**
  - `missingRequiredParams` queda vacío en modo `"listing"`.
  - La tarjeta dice solo «Credenciales por alojamiento», **sin conteo** (A3).
- **SIRE:** cada fila (check-in y check-out) tiene su `configure` y su modo. No se sincronizan solas (Q3).

### 4.3 Formulario del alojamiento (`AutomationOverrideModal`, `ParameterField`)

- **El modo se lee** de la `PropertyAutomation`: `activePa`, o si no `override.propertyAutomation.parameters`.
- **Modo `"listing"`:**
  - **Campos.** Los textos hablan del alojamiento: «RNT de este alojamiento», «Token del Ministerio (MINCIT)». La obligatoriedad se calcula por campo, en tres niveles:
    - `schema.required`: requisito del contrato (`requiredListingCredentialKeys`). No cambia.
    - `requiredForSave(clave)`: obligatorio **ahora**, si el override es nuevo o si la clave está en `missingCredentialKeys`. Solo esto pone `required` y `aria-required` y bloquea el guardado en local.
    - **Ya configurado:** override existente con metadatos y la clave fuera de `missingCredentialKeys`. Vacío, sin `required`, con el texto «Ya configurado · escribe para reemplazarlo». Si se deja vacío, no se envía.
    - **Sin metadatos (`unknown`) al editar:** nada es `requiredForSave`. Decide el 422.

    El 422 es siempre la autoridad final: se muestra aunque la validación local haya pasado.
  - **Estado.** El interruptor dice «Excluir este alojamiento (no se reporta)» (7). Excluir es una decisión explícita, distinta de no estar configurado.
  - **Un override nuevo vacío** no se crea: «Completa las credenciales de este alojamiento o exclúyelo.» y el modal sigue abierto.
  - **Quitar.** Borrar el override es «Quitar credenciales», con el aviso: «Este alojamiento dejará de reportarse.»
  - **`PATCH` parcial:** solo las claves editadas.
- **Errores por campo (B4, A5):**
  - Para cada campo, `ParameterField` recibe `id`, `error` y `required`:
    - `Label htmlFor`;
    - `aria-invalid` y `aria-describedby` hacia `FieldError`, la primitiva de `components/ui`;
    - `required` o `aria-required`.
  - El modal mapea `errors["parameters.<clave>"]` con `fieldError()` y lleva el foco al primer campo rechazado.
  - Lo que no tiene campo va al toast con el mensaje del backend.
- **Borradores de unidades nuevas:**
  - Se validan las claves obligatorias **antes** de cerrar el modal.
  - `draftOverrideCreatePayload` deja de mandar `token`.
  - Un POST de borrador que falla sigue el patrón vigente de `failedUnits`.
- **`token` superior (B6):**
  - No se escribe nunca más.
  - Se quitan la insignia «Token» y su uso en `isMeaningfulOverride`.
  - El tipo lo conserva solo para lectura, con un comentario.

### 4.4 Textos de herencia: inventario completo (A2)

En modo `"listing"` cada uno se reemplaza. En modo `"property"` quedan como están.

| Dónde | Hoy | En modo por alojamiento |
|---|---|---|
| `AutomationOverrideModal.tsx:329` | «Sin cambios: la unidad sigue heredando…» | «Completa las credenciales de este alojamiento o exclúyelo.» |
| `:394` (toast al borrar) | «La unidad vuelve a heredar de la propiedad» | «Credenciales quitadas. Este alojamiento ya no se reporta.» |
| `:486` (ayuda del interruptor) | «Hoy hereda de la propiedad. Apágala para omitirla…» | «Apágalo para excluir este alojamiento: no se reporta.» |
| `:534` (aviso) | «…lo que dejes vacío hereda el valor de la propiedad» | «Estas credenciales son solo de este alojamiento. Sin ellas no se reporta.» |
| `:544` (placeholder) | `Heredar: <valor>` | El texto de ejemplo del esquema (y N1 lo corrige en los dos modos) |
| `:567` (botón) | «Volver a heredar» | «Quitar credenciales» |
| `ListingOverridesPanel.tsx:119` | «Todas heredan de la propiedad» | Conteo después de cargar: «2 de 5 alojamientos con credenciales» |
| `ListingOverridesPanel.tsx:262` | «Hereda de la propiedad» | Estado de `listingCredentialState` (§4.6) |
| `PropertiesUnits.tsx:1230` | «…El resto hereda la configuración de la propiedad.» | Frase según el modo de cada automatización; en por alojamiento: «TRA y SIRE llevan las credenciales de este alojamiento.» |
| `PropertiesUnits.tsx:1307` | «Hereda la configuración de la propiedad.» | Estado de `listingCredentialState` |

Los textos se deciden en **una** función (`credentialsCopy(scope)` en el mismo módulo), así no pueden divergir entre el panel y la pestaña AUTOM.

### 4.5 Reserva y navegación directa (A4)

- **Texto:** `credentials_missing` → «Faltan las credenciales de este alojamiento. Cárgalas y vuelve a ejecutar la automatización.», una sola vez en `ERROR_CODE_LABELS`. El historial lo muestra como texto, sin enlace.
- **Enlace en la tarjeta y en la subfila del huésped:** «Configurar credenciales» hacia

  ```
  /dashboard/properties/{propertyUuid}?tab=automations&automation={automationUuid}&listing={listingUuid}
  ```

  - `OperationsPanel` pasa `propertyUuid` y `listingUuid` a `AutomationStatusList`, y de ahí a `AutomationStatusItem`.
  - Sin `propertyUuid` no hay enlace.
  - Sin `listingUuid`, el enlace llega solo hasta la automatización.
- **Destino:**
  - `PropertyForm` lee `automation` y `listing` junto con `tab` y los pasa a `PropertiesAutomation`.
  - La tarjeta con ese `uuid` se desplaza a la vista.
  - Su `ListingOverridesPanel` recibe `initialExpanded` y `focusListingUuid`: se expande, carga y resalta la fila de ese alojamiento, que recibe el foco.
  - No se abre el modal solo, para no cambiar nada sin que el PM lo pida.
  - Un `uuid` que no está en la propiedad se ignora sin error.
- **B9:** `?tab=automation` pasa a `?tab=automations` en `PropertyCard.tsx:175`, con su prueba.

### 4.6 Estados por alojamiento en los dos paneles

Se aplica la misma función en `ListingOverridesPanel` y en la pestaña AUTOM. de `PropertiesUnits`. Componentes existentes: `StatusPill` y `Badge`.

| Estado | Texto | Tono |
|---|---|---|
| `missing` | «Sin credenciales · no se reporta» | warning |
| `incomplete` | «Falta RNT» (etiquetas del esquema) | warning |
| `unknown` | «No pudimos confirmar las credenciales» + «Revisar» | warning |
| `ready` | «Credenciales configuradas» | success |
| `excluded` | «Excluido» | neutro |

El conteo aparece solo dentro del panel ya cargado (A3).

## 5. Fases (un commit y una auditoría con `git show <sha>` por fase; `npm run verify` en cada una)

- **Fase 0. Confirmar el contrato desplegado** (§6 y §8). Bloquea las fases 3 y 4, no las 1 y 2.
- **Fase 0b. N1, independiente y antes que todo. Alcance estrecho:**
  - **Nunca** interpolar valores de `baseParams` en placeholders, sean secretos o no. Un campo que hereda usa el texto genérico «Usa el valor de la propiedad».
  - Prueba con valores centinela en `token`, `password`, `client_secret`, `rnt` y `document_number`: ninguno aparece en el texto, en un placeholder, en un `aria-*` ni en un mensaje del DOM.
  - El commit y el skill no afirman que la API real devuelva esos valores (⚠️).
  - Se puede desplegar sola.
- **Fase 1. Modelo y lógica pura,** sin UI: §4.1 con sus pruebas.
- **Fase 2. Configuración de la propiedad** (§4.2). Prueba: activar en modo por alojamiento sin credenciales manda `"listing"` y no pide el token; volver a `"property"` lo exige.
- **Fase 3. Formulario del alojamiento** (§4.3, §4.4). Pruebas:
  - el 422 `parameters.rnt` va bajo el RNT, con foco y `aria-invalid`;
  - un secreto ya guardado no bloquea;
  - excluir no pide credenciales;
  - el borrador incompleto no cierra;
  - no queda ningún texto de herencia en modo por alojamiento.
- **Fase 4. Estados en los dos paneles** (§4.6).
- **Fase 5. Reserva y navegación directa** (§4.5). Requisito previo: confirmar con curl que el `automationUuid` de `automation-status` es el `uuid` de la `PropertyAutomation` (la evidencia del código está en la revisión 3).
- **Fase 6. Compatibilidad, QA y despliegue** (§7, §9).

## 6. Preguntas al backend

- **Q1** (confirmar; el plan ya lo asume, A6). En modo `"listing"`, ¿las credenciales de la propiedad se ignoran por completo?
- **Q2 (bloquea las fases 3 y 4).** ¿Pueden agregar al GET actual del override `credentialsComplete: bool` y `missingCredentialKeys: string[]`, calculados sobre lo guardado y **sin devolver los valores** de `token` y `password`?
  - Sin eso, el front no distingue «configurado», «incompleto» y «sin credenciales».
  - Pregunta relacionada (N1, ⚠️ sin verificar): ¿el GET de las automatizaciones de la propiedad devuelve los valores reales de `token` y `password`, enmascarados u omitidos?
- **Q3.** SIRE check-in y check-out, ¿llevan modo y override independientes?
- **Q4.** ¿Hay overrides de TRA en producción con el token en el campo `token` superior? ¿Se migran a `parameters.token`?
- **Q5.** Pasar de `"listing"` a `"property"` con la automatización activa, ¿exige las credenciales en la misma petición?
- **Q6.** ¿`lastError` llega exactamente como `credentials_missing`?

### Mensaje para el backend (listo para enviar)

> Para cerrar el front de TRA/SIRE por alojamiento necesitamos confirmar:
> 1. Con `credentials_scope: "listing"`, ¿las credenciales de la propiedad se ignoran por completo? El contrato da a entender que sí.
> 2. Para no devolver `token`/`password`, ¿pueden incluir en el GET actual del override `credentialsComplete` y `missingCredentialKeys`? El front necesita distinguir configurado, incompleto y sin credenciales sin ver los secretos. Relacionado: el GET de las automatizaciones de la propiedad, ¿devuelve los valores reales de `token`/`password`, enmascarados u omitidos?
> 6. El `automationUuid` de `automation-status`, ¿es el `uuid` de la `PropertyAutomation`? Lo usaremos para enlazar a su configuración.
> 3. ¿SIRE check-in y check-out llevan overrides independientes?
> 4. ¿Existen overrides de TRA con el token en el campo superior `token`? Con el cambio dejarían de reportar.
> 5. ¿`lastError` llega exactamente como `credentials_missing`?

## 7. Despliegue

- **Primero el backend.** Con el backend anterior, el interruptor terminaría en un 422 por `token`/`rnt`. El front lo muestra y no se rompe, pero ofrecería algo que todavía no funciona.
- **Sin `credentials_scope`, todo es `"property"`:** las propiedades actuales no cambian.
- **N1 (fase 0b)** se despliega sola, sin esperar al backend.

## 8. Verificación con token de PM

```bash
API=https://guest.hit.tools/api/v1
H=(-H "Accept: application/json" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN")

# 1. TRA en modo por alojamiento sin credenciales → 200 y el modo de vuelta
curl -s -X PATCH "$API/property-automations/$TRA/configure" "${H[@]}" \
  -d '{"statusProviderId":8,"parameters":{"credentials_scope":"listing"}}' | jq '.data.parameters.credentials_scope'
# 2. Override activo sin rnt → 422 en parameters.rnt
curl -s -X POST "$API/listing-automation-overrides" "${H[@]}" \
  -d "{\"listingUuid\":\"$L\",\"propertyAutomationUuid\":\"$TRA\",\"statusRecordId\":6,\"parameters\":{\"token\":\"X\"}}" | jq '.errors | keys'
# 3. Completar solo el rnt → 200; mirar SOLO las claves y los metadatos, no los valores
curl -s -X PATCH "$API/listing-automation-overrides/$O" "${H[@]}" -d '{"parameters":{"rnt":"123456"}}' \
  | jq '{keys: (.data.parameters|keys), credentialsComplete: .data.credentialsComplete, missing: .data.missingCredentialKeys}'
# 4. credentials_scope en otra automatización → 422
curl -s -X PATCH "$API/property-automations/$PDF/configure" "${H[@]}" \
  -d '{"statusProviderId":8,"parameters":{"credentials_scope":"listing"}}' | jq '.errors | keys'
# 5. Reserva de un alojamiento sin credenciales
curl -s "$API/reservations/$R/automation-status" "${H[@]}" | jq '.data[] | select(.lastError) | {name: .automationName, lastError}'
```

Nunca pegar en el chat tokens ni valores de credenciales. Los `jq` de arriba muestran solo claves y metadatos.

## 9. QA y criterios de aceptación

1. TRA en una propiedad sin RNT, con el interruptor encendido: se activa sin pedir el token. La tarjeta dice «Credenciales por alojamiento».
2. Al expandir el panel: estado por alojamiento y «N de M con credenciales».
3. Un alojamiento sin override: «Sin credenciales · no se reporta», en los dos paneles.
4. Guardar con solo el token: el error aparece bajo el RNT, con foco, y lo anuncia el lector de pantalla.
5. Editar un alojamiento con el token ya guardado y cambiar solo el RNT: guarda sin pedir el token.
6. Excluir: no pide credenciales y aparece «Excluido». Quitar credenciales avisa que deja de reportarse.
7. En modo por alojamiento no queda ningún texto de «heredar».
8. Reserva con `credentials_missing`: el texto y «Configurar credenciales» abren la propiedad en Automatizaciones, con TRA y el alojamiento resaltados. Al cargar las credenciales, «Reintentar» funciona.
9. Apagar el interruptor vuelve a pedir las credenciales de la propiedad. No se borraron.
10. SIRE: lo mismo en check-in y check-out; `guest_filter: foreign_only` sigue forzado.
11. Las propiedades actuales, sin `credentials_scope`, funcionan igual.
12. Ningún secreto aparece en el DOM, en placeholders, en logs, en snapshots ni en fixtures de prueba (N1).
13. El enlace «Automatizaciones» de la tarjeta de propiedad abre la pestaña con contenido (B9).
14. `npm run verify` y `npm run build`, y un recorrido real con sesión de PM.

## 10. Fuera de alcance

- Cargar las credenciales de varios alojamientos a la vez.
- Un aviso preventivo antes de la llegada. El contrato lo resuelve con el error en la reserva.
- Volver a despachar en bloque lo que falló por `credentials_missing`.
- Abrir el modal del alojamiento automáticamente desde el enlace.
