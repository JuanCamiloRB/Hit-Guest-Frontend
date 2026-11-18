# Operaciones: celdas de automatización con ícono, estado y detalle

Fecha: 2026-11-19. Aprobado por el usuario sobre la maqueta
https://claude.ai/artifact/V453yD6oiDjqjyKsnkDWje (versión «Propuesta»).

## Objetivo

Cambiar las columnas de automatización de la tabla de Operaciones de píldoras
de texto a celdas de ancho fijo: ícono de la automatización, marca de estado
(✓, reloj, ✕) además del color, contador cuando aplica y el detalle al pasar
el mouse, enfocar con teclado o tocar. El nombre de cada columna se lee en su
encabezado. Encabezados agrupados «Automatizaciones» y «Reportes». La columna
del huésped queda fija al desplazar la tabla.

## Restricciones

- Sin endpoints nuevos ni campos inventados. Solo lo que ya llega.
- Ningún cambio de payloads, escrituras ni lógica de carga por fila visible.
- Primitivas nuevas en `components/ui` antes de usarlas, con pruebas, catálogo
  (§5 del doc y skill) y plugin de Figma.
- Se mantiene la decisión de producto del 2026-08-21: Check-in cuenta
  check-ins COMPLETOS; la verificación de identidad va al detalle, no cambia
  el color de la celda.
- Commit solo cuando el usuario lo pida.

## Datos verificados (2026-11-19, sesión de PM, solo nombres de campos)

| Dato | Fuente | Estado |
|---|---|---|
| Envío por correo: `checkinLinkSentAt`, `checkinLinkSentTo`, `mailDeliveryStatus` (`delivered`) | `extra` de cada reserva en `GET /reservations` | ✅ observado |
| Envío por WhatsApp: `checkinLinkWhatsappSentAt`, `whatsappDeliveryStatus` (`sent`, `delivered`, `read`), `whatsappDeliveryReason` | `extra` en la lista | ✅ observado |
| Mensaje en la OTA: `checkinLinkOtaSentAt`, `checkinLinkOtaVia` | `extra` | ⚠️ documentado, no apareció en esta cuenta |
| Contrato: `extra.digitalContract` `{provider: hitguest\|tufirma, status: completed, signedAt, contractType: agreement_only\|guarantee_only\|…, requestedAt}` o `{notIssued: {reason, detectedAt}}` | `extra` en la lista | ✅ observado, **no documentado** salvo `requestedAt` |
| Por automatización: `providerSlug`, `automationName`, `status` (`not_started`, `pending`, `completed`, `failed`), `lastRunAt`, `lastSuccessAt`, `lastError`, `wasSuccessful`, `isPerGuest`, `guests[]` | `GET /reservations/{uuid}/automation-status` (ya se pide por fila visible) | ✅ observado |
| Garantía con tarjeta capturada | — | ❌ no llega en la lista; fuera de alcance |
| Ruido, temperatura, energía, limpieza | — | ❌ no existen en el backend; no se dibujan |

## Defectos de hoy que se corrigen

1. **La luz de Link no mide el envío del link**: `buildTrafficLight` la pone en
   verde si corrió CUALQUIER automatización. Pasa a salir del envío real por
   canal (`extra`) y de la automatización `whatsapp_checkin_link`.
2. **El envío del link contaba como check-in**: «Check-in Link Delivery»
   coincide con `CHECKIN_NAME_RE` y entraba en la luz de Check-in.
3. **«Aún no corre» se veía como «no configurada»**: `not_started` caía en
   `none` («—»). Pasa a un estado propio (`idle`): ícono en gris, sin marca.
4. **Un fallo se pintaba como pendiente**: `failed` caía en `pending`. Pasa a
   rojo con ✕.

## Fases

0. **Modelo puro** `features/reservations/lib/automation-cells.ts`: de los
   ítems de estado, el envío del link, el contrato y el conteo de check-ins a
   una celda por columna `{state, count?, channels?, summary, lines, note?}`.
   Estados: `success`, `pending`, `failed`, `idle`, `none`. Severidad para
   ordenar: falló → pendiente → aún no corre → completado → no configurado.
   Lectores de `extra.digitalContract` y del envío (reutiliza
   `readCheckinLinkDelivery`). Pruebas exhaustivas.
1. **Primitivas** `ui/status-tile.tsx` (celda de ancho fijo, tono, ícono,
   contador, marca automática) y `ui/toggletip.tsx` (detalle sobre Popover:
   abre al pasar el mouse, al enfocar con teclado y al tocar; Escape y clic
   fuera cierran; no roba el foco). Pruebas, doc §5, skill y plugin.
2. **DataTable**: `colSpan` en encabezados agrupados, `meta.headerClassName`,
   `meta.cellClassName` y `meta.sticky: "left"` (columna fija con el mismo
   hover de fila). Pruebas.
3. **Cargador y columnas**: el cargador conserva los ítems (también los de la
   foto de orden); la fila de la lista conserva `checkinLinkDelivery` y
   `digitalContract`. Columnas: Link, Check-in, Contrato, Acceso │ TRA, SIRE in,
   SIRE out, cada una con su orden por severidad. Cargando y «No disponible»
   con la misma forma de celda. `buildTrafficLight` se deja como está: la tabla
   ya no lo lee para pintar ni ordenar (los defectos 1 y 2 se corrigen en el
   modelo de celdas).
4. **Móvil**: `renderMobileRow` con las celdas en una fila que se ajusta.
5. **Verificación**: `verify`, build, mutaciones, navegador con sesión de PM,
   y revisión independiente (agentes) de todo lo implementado.

## Fuera de alcance (anotado para después)

- Garantía con tarjeta en el detalle de Contrato: no llega en la lista.
- Pregunta a Didier: ¿una verificación de identidad fallida debe poner la
  celda de Check-in en rojo? Hoy la decisión vigente dice que no.

## Implementación (2026-11-19)

- **Fase 0.** `lib/automation-cells.ts` (estados, clasificación, detalle,
  severidad) y `lib/digital-contract.ts` (lector sin dependencias: el servicio
  lo usa al mapear la lista; si importara el modelo de celdas cargaría las
  etiquetas de proveedor y rompía los mocks de otra suite).
- **Fase 1.** `ui/status-tile.tsx` (+ `StatusTileSkeleton`), `ui/toggletip.tsx`
  (sobre `Popover`: hover con 120 ms, foco de teclado detectado por la ausencia
  de un `pointerdown` previo, toque; el clic con hover abierto lo fija),
  `brand/DeliveryChannelIcon.tsx`. Doc §5, skill y plugin de Figma (23 pasos).
- **Fase 2.** `DataTable`: `colSpan`, `meta.headerClassName/cellClassName`,
  `meta.sticky: "left"` (capa `before:` detrás del contenido para el hover);
  `TableRow` con `group/row`. La fila vacía usa las columnas hoja.
- **Fase 3.** `loadAutomationStatus` devuelve `{ status, items }`; el cargador
  guarda los ítems (y los de la foto de orden); la fila de la lista conserva
  `checkinLinkDelivery` y `digitalContract`. Columnas agrupadas
  «Automatizaciones» (Link, Check-in, Contrato, Acceso) y «Reportes» (TRA,
  SIRE in, SIRE out), orden por severidad; las tres de reportes entran en
  `STATUS_SORT_COLUMNS`. `buildTrafficLight` queda como estaba: la tabla ya no
  lo lee para pintar ni ordenar.
- **Fase 4.** `ReservationMobileRow` (bajo `md`) con las siete celdas y su
  nombre debajo, y el mismo menú de acciones (`ReservationActions`).

## Verificación

| Qué | Resultado |
|---|---|
| `npm run verify` dos veces | 260 archivos, 2297 pruebas; `design:check` 0 |
| `next build` | verde |
| Mutaciones | 23/23 detectadas (4 vivas en la primera pasada → 4 pruebas nuevas) |
| Navegador con sesión de PM | 70 celdas, grupos con colSpan 4 y 3, detalle al pasar, huésped fijo al desplazar 400 px, móvil apilado sin desborde |

Pruebas viejas que se reescribieron a propósito (no se relajaron): la de
Reportes (fijaba la celda combinada de siglas) y la del orden por Contrato (el
orden sale de los ítems y ahora prueba falló → pendiente → firmado).

## Auditoría del modelo (revisor independiente, 2026-11-19)

12 defectos confirmados con pruebas, todos corregidos con una prueba cada uno:
estado de entrega desconocido salía verde (ahora pide revisión); Link sin
envío decía «no configurado» (ahora «todavía no se envía»: el correo sale
siempre); credenciales rechazadas sobre algo completado se pintaban en pausa
(misma regla que `isPausedRow`); por huésped se ignoraba la pausa; SIRE con
todos «no aplica» decía «no configurado»; Check-in sin conteo podía salir verde
o rojo por la identidad (ahora en curso / sin empezar); «enviado a firmar»
pisaba una firma completada y faltaba sin automatización activa; estados de
contrato desconocidos se leían como firmado o enviado (ahora «por revisar»);
fechas en dos zonas (ahora todo en Bogotá, la hora de pared sin pasar por
`Date`); códigos traducibles se perdían (ahora `errorMessage`); correo
marcado como spam decía «no se entregó».

Decisiones que se mantienen:
- WhatsApp `sent` y correo sin estado de entrega cuentan como enviados (verde
  con «enviado»): la columna mide que el link salió.
- Durante «Preparando…» el orden de Link, Contrato y Check-in usa la foto de
  ítems más los campos vivos de la lista. Impacto bajo; fuera de la
  preparación el valor es el vivo, como antes.
- La identidad secundaria en una reserva de un huésped se ve «todavía no corre»
  en el detalle. Bajo; pendiente de `isSecondaryGuestAutomation`.

## Auditoría visual e interacción (revisor independiente, 2026-11-19)

Corregido, con prueba (o medido en el build de producción con sesión):
- «No disponible» se veía idéntico a «no configurada» (y una prueba se había
  debilitado al cambiarla): ahora tono `idle` con su ícono, y la prueba vuelve
  a mirar lo visible.
- El detalle tapaba la celda de la fila de abajo: sin fijar, ni el panel ni el
  envoltorio posicionado de Radix capturan el puntero (regla en `globals.css`;
  el envoltorio solo se veía en producción). Medido: bajar por Check-in abre
  las cuatro celdas seguidas.
- Clic dentro del detalle navegaba la fila (burbujeo de React a través del
  portal): `stopPropagation`.
- Detalle fijado encima de la columna fija al desplazar: se cierra con
  cualquier desplazamiento (medido: página y tabla de lado).
- Uno a la vez; nombre accesible del panel; transición del hover de la columna
  fija; borde derecho de la columna fija.
- Móvil: nombre del canal junto al logo, «Origen no informado», precarga de la
  ficha.

Decisiones que quedan: `rowSpan` en la fila de grupos, mosaico 3+3+1 en
375 px, guion `ink-4` en «no configurada» (deshabilitado).

Mutaciones tras las dos auditorías: 41/41. `verify` dos veces: 260 archivos,
2318 pruebas.

## Reporte PDF (2026-11-19, pedido del usuario)

Octava celda dentro de «Reportes» (`pdf`, ícono `FileText`, encabezado «PDF»,
detalle «Reporte PDF de huéspedes»). Sale de la fila `pdf_report` del estado
por reserva. Nota: «Se envía por correo a los destinatarios de la propiedad»;
si falló con el check-in completo, «Puedes reenviarlo desde la ficha de la
reserva» (el panel tiene «Reenviar»). `buildTrafficLight` deja de avisar en
consola que no tiene columna. Mutaciones 4/4.

## Detalle del Link más informativo (2026-11-19, pedido del usuario)

Pregunta: ¿se puede saber a dónde salió el link (WhatsApp, OTA, correo) sin
revisar la configuración de cada alojamiento, y ver si WhatsApp falló?

- Cada canal enviado dice su entrega, la hora (Bogotá) y a quién salió
  (`checkinLinkSentTo`, `checkinLinkWhatsappTo`); la OTA dice por dónde
  (`checkinLinkOtaVia`: Kunas o Calry). Todo del `extra` de la lista.
- Un canal que FALLÓ con registro en la reserva (p. ej. WhatsApp `failed`) se
  ve en rojo con el motivo y la celda pasa a «un canal necesita revisión».
- Un canal que el backend SALTÓ (sin teléfono, WhatsApp no habilitado, sin
  conversación en la OTA, …) no queda en la reserva sino en el historial
  (`automation-records` de `whatsapp_checkin_link`, `responsePayload.channel`
  + `skipped`). Se pide al ABRIR el detalle del Link (`useLinkAttempts`), una
  vez por reserva, filtrado por la automatización, 2 minutos en memoria. Nunca
  una petición por fila. Motivos con el mismo mapa cerrado del historial
  (movido a `lib/skipped-reasons.ts`).
- Sin la automatización de envío en el estado de la reserva: «Esta reserva
  envía el link solo por correo» (tabla de verdad del contrato), salvo que ya
  haya salido por WhatsApp u OTA.

Límite: el backend no expone los canales EFECTIVOS de una reserva (gap #4).
Si un canal estaba configurado y no hay ni envío ni registro de salto, el
detalle no puede afirmar que «falta»: no lo menciona.

Verificación: mutaciones 8/8; verify dos veces 261 archivos / 2334 pruebas;
con sesión, 0 peticiones de historial al cargar la tabla y 3 al abrir cinco
detalles (las dos sin automatización no piden nada).
