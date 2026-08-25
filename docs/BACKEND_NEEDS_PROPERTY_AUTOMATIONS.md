# Lo que necesitamos del Backend — Property Automations

> Estado contrastado con `20260812_frontend-tracker-automations.html` y con las
> respuestas verificadas de `guest.hit.tools` el 2026-08-13. Este documento
> reemplaza la versión basada en el contrato anterior de `POST /properties`.

## Resumen vigente

| # | Bloqueo | Impacto | Prioridad |
|---|---|---|---|
| 1 | `default_setup.slots` no publica triggers operativos | No se puede construir un seed por país que luego sea ejecutable | Alta |
| 2 | `after_automation` exige un ID entero no expuesto | El PM no puede escoger un predecesor desde una API basada en UUID | Media |
| 3 | `guest_filter` no se valida | SIRE puede reportar nacionales si otro cliente manda `all` | Alta |
| 4 | El backend serializa `provider.parameters` completo | Tokens y llaves llegan innecesariamente al navegador | Alta |
| 5 | No existe una señal estable para filas de prueba | `tufirmaZ` no puede filtrarse sin hardcodear nombres/slugs de ambiente | Media |
| 6 | `POST /property-automations` no pina ni valida `executionOrder` | Una fila no-identidad con orden ≤ 2 (o null) secuestra el slot de identidad | Alta |

## Ya no son bloqueos

- `automations` en `POST /properties` es nullable/opcional.
- Los slugs inválidos, providers de otro país, estados fuera de `{8,10}` y
  triggers inválidos responden 422 en lugar de degradarse silenciosamente.
- La identidad se reconoce por `parameters.verification_type` durante el alta.
- El filtro por país incluye providers sin `applicable_countries`; Didit y
  Textract salen de la misma consulta que el resto.
- Slug canónico y alias legacy resuelven al mismo provider. El frontend usa el
  canónico (`sire_colombia`, `tra_colombia`, `pdf_report`).
- El PM crea manualmente una `PropertyAutomation` disponible para el país con
  `POST /property-automations` y la configura con `PATCH .../configure`.

## 1. Publicar configuración operativa en `default_setup.slots`

Hoy los slots devuelven nombres, orden, estado inicial y claves de credenciales,
pero no `triggerTypes`, `triggerConfig` ni el `guest_filter: foreign_only` de
SIRE. Copiar esos slots a `POST /properties` produce filas sin trigger; cuando el
PM las activa, el despachador las descarta en el gate 4 sin usage record ni error.

Pedido: que cada slot publique el payload operativo completo y versionado, o que
el backend exponga una operación transaccional para aprovisionar los defaults del
país. El frontend no debe inventar el mapping de triggers.

## 2. `after_automation` necesita un identificador público

El request exige `predecessor_automation_id` entero y de la misma propiedad,
pero `PropertyAutomation` expone UUID y no expone ese ID. Un campo numérico libre
obliga al PM a adivinar un valor interno.

Pedido preferido: aceptar `predecessor_automation_uuid`. Alternativa: devolver
un ID público expresamente seleccionable. Hasta entonces el frontend conserva
configuraciones existentes, pero no permite crear una nueva cadena.

## 3. Validar `guest_filter`

SIRE debe usar `foreign_only`; con `all` intenta reportar nacionales a Migración
Colombia. El frontend fuerza `foreign_only` visualmente y en el payload, pero la
API debe validar el enum y, para SIRE, rechazar cualquier otro valor.

## 4. Sanitizar providers en la respuesta

Las respuestas con `provider` sideloaded incluyen el modelo completo y sus
`parameters`, donde algunos providers guardan tokens/llaves. El frontend aplica
una allowlist profunda, blanquea valores de `default_setup.slots[].parameters`,
descarta el token de `PropertyAutomation` y no loguea payloads sensibles.

Pedido: un `ProviderResource` público que nunca serialice credenciales. Para el
token del override de listing, evaluar un contrato `hasToken` más un endpoint de
reemplazo: la UI actual todavía necesita el valor para editar y reenviar el draft.

## 5. Identificar filas de prueba

No filtrar por nombre. Agregar una señal estable como `environment`, `is_test` o
un status específico para que `TuFirma Test`/`tufirmaZ` no aparezca en catálogos
de producto sin bloquear futuros providers legítimos.

## 6. Pinear/validar `executionOrder` en `POST /property-automations`

La reescritura de `POST /properties` eliminó el secuestro del slot de identidad
(el servidor pina identidad a 1/2 y detecta identidad por provider). El store
directo quedó afuera: `executionOrder` es nullable y el contrato no documenta
pinning ni rango, pero la detección "ya creadas" sigue siendo `guest_type` +
`execution_order <= 2`. Caso real (2026-08-15): una fila de firma `main_guest`
quedó indesactivable (422 con mensaje de verificación) y primera en el listado —
lo que implica orden ≤ 2 o null. Esa fila no la creó el frontend desplegado
(verificado contra el build en producción); pedimos revisar en sus logs qué
camino la creó y con qué orden. La desactivación simultánea de la fila Didit
del mismo `guest_type` es consistente con la regla de auto-desactivación al
asignar provider, pero no está confirmada.

Pedido: en el store, rechazar (422) orden ≤ 2 —y null— para providers sin
`parameters.verification_type`, o renumerar igual que en `POST /properties`.
Mientras tanto el frontend envía siempre `executionOrder` explícito ≥ 3 tomado
del `slot.order` del `default_setup`, y una fila ya rota se repara con
`PATCH /property-automations/{uuid}` (`executionOrder ≥ 3`).

## Estado del frontend

- El alta omite `automations`: no elige Didit silenciosamente; el backend crea los
  dos slots estructurales y el PM elige proveedor por tipo de huésped.
- Esos dos slots son estructurales y pueden llegar inactivos: el PM puede asignar
  Didit o Textract y activarlos. Una vez activos, el contrato de `/configure`
  rechaza desactivarlos con 422; el frontend refleja ese bloqueo.
- IDs de providers resueltos exclusivamente desde `GET /providers?country=`.
- Catálogo paginado, filtrado por slug y sanitizado antes de entrar a React.
- Los slots aplicables que todavía no tienen fila muestran switch y formulario:
  se crean inactivos con `POST /property-automations` y luego se activan con
  `PATCH .../configure`.
- Activación operativa exige credenciales y al menos un trigger.
- SIRE fuerza `foreign_only`.
- `canDispatch`/`canRedispatch` son autoritativos.
- Reenvío PDF exige confirmación porque crea un consumo nuevo.
