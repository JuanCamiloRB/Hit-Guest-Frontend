# Calendario de Operaciones: ocupación — 2026-11-25

Pedido: «primero si no existen los componentes crear, estandarizar los
componentes y después ajustar manual de marca y aplicar los cambios», con el
diseño `work/hitguest-calendario-rangos-v1.html` (barras de estadía, check-in
verde y checkout naranja con ícono blanco y borde blanco, la misma leyenda,
detalle para estadías cortas).

## 1. Primitivas creadas (components/ui)

- `MovementMark`: check-in `success` / checkout `warning`, ícono blanco,
  `bordered`, `sm`/`md`.
- `Timeline` + `TimelineRow` + `TimelineBar` + `TimelineLegend`.
- `SearchField`; regla `handmade-search` en `design:check`.
- `Surface tone="brand"` (navy) e `IconBadge tone="strong"`.

## 2. Estandarizado

Seis buscadores a mano pasan a `SearchField`: Alojamientos, Operaciones (Lista),
Tablero (consumo por reserva), Soporte, el selector con búsqueda del portal y el
calendario. Antes: lupa en primary, ink-3 o ink-4; alto 36, 40 o 44 px.

## 3. Calendario

- Vista «Ocupación» (por omisión) y «Mes», con `Tabs`.
- Barra del centro del check-in al centro del checkout; marca solo del extremo
  que cae en la vista; una noche, solo marcas; carriles si dos se cruzan.
- Canceladas y eliminadas no ocupan. Pie: «Mostrando N de M alojamientos con
  reservas» (la lista de reservas no trae los alojamientos sin reservas: no se
  dice «de 33» como si fuera el portafolio).
- Sin código de reserva en el detalle: la reserva no lo trae (no se inventa).

## Desviaciones del HTML

- Checkout en `warning` (#9D5C15), no #C76A0A: un solo naranja en el sistema.
- Mes/Ocupación con `Tabs` estándar (activa card + primary), no relleno morado.
- Texto 12 px mínimo (el HTML usa 10 y 11 px).
- Búsqueda por alojamiento, propiedad o huésped (no por código: no existe).

## Verificación

verify verde (2474), build, mutaciones 15/15 (una escapó y se cubrió),
navegador a 1440 con datos reales: ocupación, detalle y mes.

## Revisión externa (2026-11-25) — corregido

1. Alta: se habían quitado los filtros múltiples de propiedades y alojamientos.
   Recuperados con la primitiva nueva `MultiSelect` (el filtro anterior estaba
   armado a mano dentro del calendario); se suman a la búsqueda.
2. Media: un error de carga se mostraba como «no hay estadías». Ahora la escala
   de la Lista: esqueleto, sincronizando (info), error (bloqueante con
   «Reintentar»), actualización fallida (aviso con la lista anterior), vacío solo
   con lista cargada; `RefreshIndicator` mientras actualiza.
3. Media: en táctil no había detalle antes de navegar. Decisión del usuario: el
   primer toque abre el detalle con «Ver reserva» (`Popover`); con mouse sigue
   el `Tooltip` y el clic navega.
4. Baja: `handmade-search` decía más de lo que hace. Ahora también detecta
   `<Search />` y alias; la documentación dice qué NO detecta.

## Segunda revisión (2026-11-25) — corregido

1. Alta: un filtro podía quedar activo diciendo «Todos». `pruneSelection` limpia
   las selecciones con cada lista nueva (ajuste durante el render); prueba de
   elegir → refrescar sin ese alojamiento → filtro limpio y sin reactivarse.
2. Media: barras de medio día recortaban los íconos. Decisión del usuario: una
   sola marca sin relleno en medio día; el mismo día ocupa el día entero.
3. Media: un listener de media query por barra. Ahora una consulta por tablero.
4. Baja: el vacío nombra los tres filtros.


## Barra por estado de la reserva (2026-11-25, propuesta B aprobada)

Prototipo con tres opciones en `work/hitguest-calendario-estados-v1.html`; el usuario eligió la B.

- Primitiva: `TimelineBar tone` (`default | progress | past | attention | unknown`) + `status {label, tone}`; `TimelineLegend tones`.
- Mapeo de estado → trazo en `barTone` (`lib/occupancy.ts`); la etiqueta y el tono del `StatusPill` salen de `getReservationStatusMeta` (respeta el nombre del backend para un estado sin mapear).
- Patrones como utilidades de `globals.css`: `pattern-progress`, `pattern-unknown`.
- Pruebas: `timeline.test.tsx` (trazo, hover, ícono, compacta sin ícono, nombre accesible, Popover táctil, leyenda), `occupancy.test.ts` (`barTone`, leyenda, sin fila «Estado»), `ReservationsCalendar.test.tsx` (trazo y nombre por estado, estado sin mapear), `globals-contrast.test.ts` (8 pares).
- Abierto con backend: qué dispara «En progreso»; si Abandonada e Incompleta son terminales. Canceladas siguen sin dibujarse.

### Ajuste de tonos (2026-11-26, aprobado sobre `work/hitguest-calendario-estados-v2.html`)

- Morado más suave: tokens nuevos `--timeline-bar` `#E4D3F8` y `--timeline-bar-strong` `#D3B8F3` (hover y rayas), texto `ink`, borde `primary/30`. Un morado sólido más claro con texto blanco no llega a 4.5:1.
- Finalizada en verde muy suave (`success-sunk`, borde `success/30`, texto `success`). La pastilla del detalle y la Lista no cambian (Finalizada sigue gris).
