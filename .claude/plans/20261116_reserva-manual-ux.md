# Rediseño del formulario «Crear reserva manual» — plan v3 (2026-11-16)

Estado: **implementado el 2026-11-16, sin commit** (fases 0–5 y pruebas; auditoría de
regresión independiente al cierre). Prototipo v3: canvas «Nueva reserva — rediseño»
(claude.ai/artifact/By4mRMCWfUX71sE6trCKXx).

Qué quedó en código:
- `reservation-form/payload.ts` (schema + payload congelado), `stay.ts` (noches, por noche,
  precarga solo de lo no tocado), `useReservationCatalogs.ts` (catálogos con espera propia y
  guardia de petición en alojamientos), secciones `StaySection`, `PrimaryGuestSection`,
  `ReservationValueSection`, `CheckinLinkSection`, `ReservationSummary`, `FormSection`.
- Primitivas nuevas: `ui/combobox.tsx`, `ui/number-stepper.tsx`, `ui/money-field.tsx`;
  `Dialog` gana `layout="panel"`, `DialogBody`, `DialogHeader/Footer divided`.
- Pruebas: `payload.test.ts`, `stay.test.ts`, `useReservationCatalogs.test.tsx`,
  `ReservationDialog.form.test.tsx` (crear, precarga, carrera, precio vacío/0, aviso y foco,
  descarte, editar sin interruptor y sin externalId); las dos pruebas previas siguen.
- Decisiones tomadas al implementar: borde de campo sin cambios (token `--input`);
  huéspedes se precargan con la capacidad (como hoy); sin selector de idioma.
- Segunda revisión externa (2026-11-16), cerrada: catálogos de propiedades, países y
  monedas que fallan avisan junto al campo con «Reintentar» (`CatalogError`); en edición
  el interruptor de envío sigue visible, deshabilitado y con la razón (no se quita ningún
  campo); esqueleto mientras carga la reserva a editar; «Ver reserva» en el aviso de
  «creada, pero el link no se envió» (`CreationOutcome.reservationUuid`); «Gestionar
  alojamientos» en «sin alojamientos activos». En creación los catálogos esperan dentro
  de cada control («Cargando…»), el resto del formulario es usable de inmediato.
- Revisión visual parcial (dev server, SIN sesión, catálogos en 401) a 1280, 768 y 375:
  pie fijo con la acción visible tras desplazar el cuerpo, sin desborde horizontal,
  aviso de propiedades fallidas con «Reintentar». Corregido ahí: la moneda mostraba el
  nombre largo cortado; ahora el código.
- **Pendiente: revisión visual con sesión de PM** (datos reales: crear completo, editar,
  error de validación, link fallido; teclado virtual en un teléfono).

v3 incorpora las dos revisiones externas del 2026-11-16. Cada afirmación sobre el código
se verificó contra el archivo; lo que choca con el sistema de diseño está en §9.

Restricción (confirmada por el usuario el 2026-11-16): **ni quitar ni agregar campos**;
ajustar lo que hay y hacerlo más cuidado. Sin endpoints nuevos ni cambios de backend.
El payload de `POST/PUT /reservations` y `POST /reservations/{uuid}/send-checkin-link`
queda idéntico. Los 13 campos del schema actual son los 13 del prototipo (§0).

## 0. Campos: hoy vs. prototipo (los mismos 13)

| Campo del schema | Hoy | Prototipo | Payload |
|---|---|---|---|
| `propertyUuid` | Select | Select con búsqueda | no viaja (solo filtra alojamientos), igual que hoy |
| `listingId` | Select | Select | `listingUuid` etc., igual |
| `reservationSourceId` | Select | Select | igual |
| `dates` | rango | rango | `arrivalDate`/`departureDate`, igual |
| `totalGuests` | input número | stepper (mismo valor numérico) | igual |
| `totalPrice` | input | input dentro del control de precio | igual |
| `currency` | Select | Select dentro del control de precio | igual |
| `guestName` | input | input | `extra.guest_name`, igual |
| `guestLastname` | input | input | `extra.guest_lastname`, igual |
| `guestCountry` | Select | Select con búsqueda | `extra.guest_country` + `guest_country_id`, igual |
| `emailGuest` | input | input («Correo del huésped») | igual |
| `guestPhone` | indicativo + número | indicativo + número («· opcional») | `extra.guest_phone`, igual |
| `sendLinkNow` | switch (crear y editar) | switch solo al crear | no viaja; en edición hoy ya vale `false` y no hace nada |

Lo demás (resumen, precio por noche, «Sin costo», «Capacidad: N», «Sugerido por el
alojamiento», confirmación al cerrar) es solo presentación de datos que el diálogo ya
tiene: no son campos ni viajan al backend.
Archivo: `src/features/reservations/components/ReservationDialog.tsx` (1127 líneas).

**Empezar solo cuando el trabajo de credenciales esté corregido y separado en commits.**

## 1. Diagnóstico (con evidencia)

| # | Problema | Evidencia |
|---|---|---|
| D1 | Teléfono marcado «*» pero opcional | `guestPhone: z.string().optional()` (l. 92) vs label (l. 1049) |
| D2 | El correo promete «Se enviará el link ahora» siempre | label fijo (l. 1067) |
| D3 | En edición se muestra el switch de envío y no hace nada | `sendLinkNow` solo se usa al crear (l. 553); en edición vale `false` (l. 428) |
| D4 | Moneda desbordada del diálogo | grid de 3 columnas (l. 966) + captura |
| D5 | Pie dentro del scroll | `DialogFooter` dentro de `overflow-y-auto` (l. 637, 1102) |
| D6 | Selects con ancho del placeholder | captura |
| D7 | Title Case y dos separadores distintos | «Datos del Huésped»; `bg-sunk` (l. 665) vs `bg-rule` (l. 744) |
| D8 | ~250 países sin búsqueda | l. 715–731 |
| D9 | Precio vacío pasa como 0 | `z.coerce.number().min(0)` (l. 111): `""` → `0`, válido |
| D10 | Íconos morados decorativos en labels | l. 973, 995 |
| D11 | «Sin alojamientos» pintado pisando la primitiva | `text-primary` en el trigger (l. 813) |
| D12 | Alojamiento deshabilitado sin decir por qué | l. 808 |
| D13 | Orden contra el modelo mental | huésped primero; el alojamiento precarga después (l. 284) |
| D14 | Sin resumen | solo un badge de noches |
| D15 | Errores sin resumen ni foco | solo `FormMessage` por campo |
| R1 | **Carrera al cambiar de propiedad**: una respuesta vieja de alojamientos pisa la nueva | `loadListings` sin guardia de petición (l. 238–279) |
| R2 | **La precarga tardía pisa lo editado** | `handleListingChange` hace `await getById` y luego `setValue` sin mirar si el PM lo tocó (l. 284–302) |
| R3 | Cerrar descarta el borrador sin confirmar | `onOpenChange={setOpen}` (l. 626); al abrir en crear se resetea (l. 445) |
| R4 | Un solo `isLoading` para cargar la reserva y para enviar | l. 373 y l. 496; además deshabilita el teléfono (l. 1055) |
| R5 | Los errores globales solo viven en un toast | `notifyError` (l. 618) |
| R6 | «Creada pero link falló» | **ya se distingue** (tono `warning` de `createReservationWithFollowUp`, l. 559–563); falta la acción «Ver reserva» |

## 2. Arquitectura UX

Diálogo ancho (1040–1120 px), dos columnas, pie fijo. Móvil: una columna, altura en
`dvh`, barra inferior con `env(safe-area-inset-bottom)` que no tapa campos con el
teclado abierto.

1. **Estancia** (primera dependencia): Propiedad con búsqueda · Alojamiento
   (deshabilitado con «Elige primero una propiedad») · Canal · Fechas · Huéspedes.
   Muestra: inactivos deshabilitados en la lista, propiedad sin alojamientos activos,
   canales no disponibles, capacidad («Capacidad: N») cuando el alojamiento la trae.
   **Precarga solo lo no editado** (R2): huéspedes, precio, moneda.
2. **Huésped titular**: Nombres · Apellidos · Nacionalidad con búsqueda · **Correo del
   huésped** (sin promesas) · Teléfono «· opcional».
3. **Valor**: precio y moneda en un solo control. **Vacío = requerido** (bloquea);
   **0 escrito = válido**, con insignia «Sin costo». Precio por noche solo con fechas
   válidas. «Sugerido por el alojamiento» cuando vino de la precarga.
4. **Link de check-in** (solo crear): fila compacta «Enviar link después de crear» con
   descripción condicional al correo. Sin selector de idioma en v1: usa el de la
   propiedad (el endpoint lo admite; se puede sumar después).
   **Edición = la misma estructura que crear**, con todos los campos editables
   (propiedad, alojamiento, canal, fechas, huéspedes, titular, nacionalidad, correo,
   teléfono, precio y moneda), adaptando solo: la propiedad y el alojamiento originales
   se conservan aunque estén inactivos (con aviso), sin switch de envío (D3), aviso de
   sincronización PMS, nota «Guardar cambios no vuelve a enviar el link», acción
   «Guardar cambios».
5. **Resumen** (confirmar, no completar): alojamiento como dato principal, propiedad,
   fechas y noches, huéspedes, canal, total y por noche, estado del link. Sin lista
   permanente de faltantes. Altura según contenido (sticky, nunca a toda altura):
   vacío es una línea «Completa la estancia para ver el resumen»; crece al elegir
   alojamiento. En móvil no hay columna: el resumen se condensa en la barra inferior
   (noches y huéspedes, total, acción), sin duplicar.
6. **Errores**: inline junto al campo; tras un envío inválido, aviso arriba («Faltan
   N campos. Los marcamos abajo.») y foco al primer inválido. Los globales (R5) también
   en el aviso de arriba, no solo en toast.
7. **Pie**: «* Campos obligatorios» (escritorio) · Cancelar · acción contextual:
   «Crear y enviar link» (con ícono de envío), «Crear reserva», «Guardar cambios».
   Cancelar con cambios → confirmación «¿Descartar la reserva?» (R3).

## 3. Dirección visual: «neutro para estructurar, morado para actuar, semánticos para informar»

| Elemento | Regla |
|---|---|
| Campos | Los estados de la primitiva, sin cambios: reposo `--input`, hover `primary`, foco `primary` + anillo, error `danger`, deshabilitado `sunk` + `ink-3`. Completado = normal (sin verde) |
| Título | 24 px Gabarito **700** (es el peso más liviano que carga la app) |
| Sección | 16 px Poppins 600 `ink` + ayuda 12 px `ink-3` solo si aporta. **Sin números**: parecían un stepper y todas las secciones están a la vista |
| Label | 14 px Poppins 500 `ink-2`; asterisco `danger` 12 px |
| Ritmo | 32 px entre secciones, sin cajas por sección, sin divisores entre todas; padding 24–28 px; pie fijo de 64–72 px |
| Campos y acciones | 44 px; acciones compactas nunca < 32 px; cerrar 40 px; − y + con área de 44 px; móvil con `padding-bottom: env(safe-area-inset-bottom)` |
| CTA | 44 px, padding 22 px, ícono de envío solo si envía; en curso «Creando reserva…» y luego «Solicitando envío…» (son dos llamadas: `POST /reservations` y `send-checkin-link`) |
| Resumen | `bg-sunk`, radio `lg`, sin sombra; total Gabarito 800 26 px con numerales tabulares; un solo acento morado (estado del link) |
| Precio | una envolvente, divisor vertical, cifra a la derecha y tabular, moneda de ancho fijo |
| Fila del link | fondo `primary/5` encendido, neutro apagado; sin borde morado |
| Íconos | solo búsqueda y calendario dentro de controles, estado semántico y envío. 14–16 px vía `Icon`. Fuera de labels |
| Pie | `card` casi opaco + sombra mínima hacia arriba, solo en el pie |
| Proporción | ~75–80 % neutros, 15–20 % tinta/bordes/superficies, ~5 % morado |

Sin hex nuevos: todo sale de `globals.css`.

### 3b. Matriz de estados (todos van a pruebas; no todos a pantalla)

| Estado | Forma | En el prototipo |
|---|---|---|
| Carga inicial de catálogos | `Skeleton` con la forma de cada campo; el formulario no bloquea | Estados A |
| Carga de alojamientos | spinner dentro del selector, resto usable | Estados A/H |
| Respuesta tardía al cambiar de propiedad | se descarta (guardia de petición) | Estados H |
| Precarga del alojamiento en curso | nada visible; al llegar, «Sugerido por el alojamiento» solo en lo no editado | Estados E |
| Precio sugerido vs. modificado | la etiqueta «Sugerido…» desaparece al editar | Main |
| Alojamiento sin propiedad | deshabilitado + «Elige primero una propiedad» | Estados A |
| Propiedad sin alojamientos activos | `FeedbackBanner` warning + «Gestionar alojamientos» | Estados B |
| Canales no cargaron | `FeedbackBanner` danger + Reintentar; CTA deshabilitado | Estados C |
| Países o monedas no cargaron | igual que canales, junto al campo; bloquea solo si el campo es requerido | — (misma forma que C) |
| Envío inválido | aviso arriba + inline + foco al primero | Estados D |
| Envío en curso | CTA `loading`, Cancelar deshabilitado, doble envío bloqueado | Estados G |
| Creada, link falló | toast warning con «Ver reserva» | Estados F |
| Cierre con cambios | `AlertDialog` «¿Descartar la reserva?» | Main (Cancelar) |
| Edición con propiedad/alojamiento original inactivo | se conserva, con aviso bajo el campo | Edit |
| Recurso inactivo en el 422 | igual que hoy (mensaje del backend + «Gestionar») | — |

## 4. Componentes

**Primitivas** (en `components/ui`, se crean y auditan antes de usarse — Regla 1):
- `Combobox`: escrito de cero con semántica ARIA de combobox (`role="combobox"`,
  `aria-expanded`, `aria-activedescendant`, flechas, Enter, Escape, Home/End), carga,
  vacío, sin resultados y error. **No** se copia `SearchableSelect` del check-in:
  verificado que no tiene ningún `role`, `aria-*` ni manejo de teclado.
- `NumberStepper` (huéspedes) y `MoneyField` (precio + moneda).
- Pie fijo de `Dialog` (variante de `DialogFooter` o `DialogBody` con scroll propio).
- Existentes: `Input`, `Button`, `FeedbackBanner`, `FieldError`, `SwitchField`, `Skeleton`, `AlertDialog`.

**Específicos de Reservas** (`features/reservations/components/reservation-form/`):
`StaySection`, `PrimaryGuestSection`, `ReservationValueSection`, `CheckinLinkSection`,
`ReservationSummary`. React Hook Form sigue siendo la única fuente del formulario.

## 5. Fases

0. **Contrato de comportamiento** (pruebas antes de mover nada): matriz crear/editar,
   requeridos/opcionales, reglas de precarga, **payload congelado**, activos/inactivos,
   creada-con-link-fallido.
1. **Correcciones sin rediseño**: D1, D2, D3, D4, D5, R1 (guardia de petición), R2
   (precarga solo de lo no editado), R3 (confirmar descarte), R4 (estados separados).
2. **Primitivas**: `Combobox`, `NumberStepper`, `MoneyField`, pie fijo. Teclado, lector
   de pantalla, carga, vacío, error, deshabilitado, móvil.
3. **Estructura**: dividir el componente, reordenar, separar estados de catálogos,
   precarga y envío. D9 (precio vacío) entra aquí porque cambia el schema.
4. **Composición visual** (§3).
5. **Móvil, estados y accesibilidad**: barra inferior, teclado, safe-area, foco al
   primer error, skeleton inicial, refresco sin borrar datos, sin desbordes a 375, 768
   y 1280 px.
6. **Regresión** (§6) + auditoría independiente, como cada fase.

## 6. Pruebas obligatorias

Payload de crear y editar sin cambios · reserva importada conserva su vínculo PMS ·
en edición no se restablecen estado ni `externalId` · cambio rápido entre propiedades ·
precarga que no pisa lo editado · propiedad o alojamiento inactivo · canales fallidos ·
precio vacío y 0 explícito · creada con link fallido · doble envío bloqueado ·
navegación completa con teclado · revisión visual de crear, editar, error y móvil.

## 7. Qué NO cambia

Payload (l. 503–540), `externalId MANUAL-…` y estado 27 solo al crear,
`createReservationWithFollowUp`, manejo de 422 por campo y de recurso inactivo,
`reservationOperability`/`bookingBlock`.

## 8. Criterio de cierre

Un PM lo completa en orden natural, siempre sabe qué falta, no pierde datos por una
respuesta tardía y la acción principal queda visible; con los endpoints, tokens y
primitivas existentes (más las cuatro nuevas de §4).

## 9. Decisiones abiertas (del usuario)

1. **Borde de los campos.** Las dos revisiones piden «bordes neutros en reposo» y ven
   morado. El borde en reposo es el token `--input` = `#5467FA` (azul de marca),
   decisión del 2026-11-12 en el manual (`hitguest-design-system`), tras probar el
   navy y verlo gris. El prototipo tiene un ajuste **«borde: marca | neutro»** (Tweaks,
   en Crear y en Editar) para compararlo en pantalla. Elegir «neutro» es cambiar
   `--input` a `rule` en TODA la app (y el hover a `input-hover`), no solo aquí: es
   una decisión del manual, no de este formulario.
2. **Hover de los campos.** La revisión propone `input-hover`; el sistema usa
   `primary` (`ui/input.tsx` l. 21) y reserva `--input-hover` para tarjetas
   seleccionables. El prototipo sigue al sistema.
3. **«accent-sunk»** no existe como token. La fila del link usa `primary/5`
   (opacidad permitida).
4. **Precarga de huéspedes**: hoy pone la capacidad máxima del alojamiento (l. 296).
   El prototipo lo conserva. ¿Debería quedar en 1 y solo mostrar «Capacidad: N»?
5. **Tipografía**: la revisión la vio pequeña en una captura del canvas reducido. Los
   tamaños reales coinciden con lo que pide (24/14/16/14/12, total 26). Se subió la
   sección de 15 a 16 px y el ritmo a 32 px; si en pantalla real sigue comprimido, se
   ajusta en la fase 4 con el navegador, no en el canvas.
