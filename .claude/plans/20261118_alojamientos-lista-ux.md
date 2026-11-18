# Lista de alojamientos (Propiedades → pestaña «Alojamientos») — plan UX v2

Estado: **implementado el 2026-11-18 (fases 0–4), sin commit; pendiente auditoría independiente y captura con sesión.** v2 incorpora la revisión UX del 2026-11-18 (§8). Sin endpoints nuevos ni cambios de backend: todo lo que
se muestra ya viene en el agregado del portafolio (`portfolioCache`, `properties-cache.ts`).

## 1. Diagnóstico (captura 2026-11-18, 29 alojamientos de 15 propiedades)

| # | Qué pasa hoy | Evidencia | Por qué importa |
|---|---|---|---|
| D1 | Las 29 filas en una sola pantalla, sin paginar ni ordenar; es una `Table` armada a mano | `PropertiesList.tsx:275-327` | Con 50+ alojamientos es una pared; el orden es «como llegó del backend», invisible para quien mira. `DataTable` (ordenar + paginar) ya existe y la usan Operaciones, el Tablero y Usuarios |
| D2 | «Precio» dice **$0** en 17 de 29 filas y mezcla monedas con el mismo `$` (850.000 COP junto a 150 USD) | `pricePerNight: price` con `\|\| 0`; la celda escribe `$` fijo | Un 0 no es un precio, es «sin precio». La moneda viaja en `extra.currency` del listing (la edita el diálogo de alojamiento) y no se lee |
| D3 | «Capacidad» dice **2 Huéspedes** en casi todas | `capacity: Number(… \|\| 2)` | Un valor inventado se lee como dato. Donde no hay capacidad declarada debería verse «—» |
| D4 | «Número» vacío en 18 de 29 filas; donde existe va en morado y negrita como si fuera un enlace, pero no lleva a ningún lado | `TableCell className="font-bold text-primary"` | El morado es el color de lo pulsable (manual §3). Y el número es opcional: no merece la primera columna |
| D5 | Las filas no llevan a nada: para editar un alojamiento hay que ir a la propiedad → pestaña Alojamientos → buscarlo | sin `Link` en las filas | La lista es un índice que no indexa |
| D6 | Dos niveles de filtro: barra (buscar, estado) y, dentro de la tarjeta, «Todas las Propiedades» | líneas 160-180 y 260-272 | El filtro de propiedad vive aparte del resto y la tarjeta tiene un «Listado de Alojamientos» que repite la pestaña |
| D7 | Sin conteo del resultado: «15 propiedades · 21 alojamientos activos» arriba, pero la tabla no dice cuántas filas muestra tras filtrar | — | Al filtrar no se sabe si quedaron 3 o 30 |
| D8 | Móvil: seis columnas con scroll horizontal | — | Número y Propiedad caben en la misma celda que el nombre |

## 2. Arquitectura UX (fijado)

1. **`DataTable`** reemplaza a la tabla a mano: orden por columna (alojamiento, propiedad,
   estado, capacidad, precio) con `defaultSorting` **nombre ascendente** (revisión: el orden
   más evidente; agrupar por propiedad lo resuelve el filtro de propiedad, sin inventar
   grupos que no se ordenan ni paginan).
2. **Paginación de 10 filas**, sin selector de tamaño por ahora (revisión: con 10 la
   pantalla conserva una altura razonable). Pie: «Mostrando 1–10 de 28 alojamientos» con
   «Página 1 de 3» como dato secundario y Anterior/Siguiente compactos; **oculto con una
   sola página**. Página 1 al cambiar búsqueda, filtro u orden; durante una actualización se
   conservan página y filas (ya lo hace la primitiva, `autoResetPageIndex: false`).
3. **Fila = enlace** al alojamiento: el nombre es un `TextLink` a
   `propertyEditHref(property.uuid, "units")` y la fila entera es pulsable (patrón de
   Operaciones: `getRowHref`). Fase 2 opcional: `?tab=units&unit={uuid}` para que la
   pestaña abra el diálogo de ese alojamiento directamente (cambio solo en
   `PropertiesUnits`, lectura de un query param; sin backend).
4. **Columnas** (escritorio): Alojamiento (nombre + número interno debajo en `ink-3`, como
   «Suite Junior · SUI-JUN») · Propiedad · Estado (`StatusPill`) · Capacidad · Precio por
   noche (derecha, `tabular-nums`, con el código de moneda: «850.000 COP», «150 USD»).
   Sin precio → «—» en `ink-4`; sin capacidad declarada → «—».
5. **Barra de filtros única**: buscar (nombre, número interno **y propiedad**), estado,
   propiedad — los tres juntos arriba, en la misma `Surface` que las pestañas. **La barra
   muestra solo los filtros de la pestaña activa** (Propiedades: buscar + estado;
   Alojamientos: buscar + estado + propiedad). «Limpiar filtros» **solo cuando hay alguno
   aplicado**. La tarjeta pierde el título «Listado de Alojamientos» y el selector duplicado.
6. **Conteo** sobre la tabla: «28 alojamientos» sin filtros, «8 de 28 alojamientos» con
   filtros, en un `role="status"` (se anuncia sin interrumpir). Sin resultados:
   `EmptyState kind="no-results"` + «Limpiar filtros», como hoy.
7. **Responsivo**: escritorio, tabla completa; tablet, nombre + número en la celda
   «Alojamiento» y las demás columnas; **móvil, fila apilada** (nombre + estado en la
   primera línea; número y propiedad debajo; capacidad y precio en la última), con la
   misma paginación debajo. Nada de scroll horizontal de seis columnas.
8. **Estados**: carga inicial = esqueleto de 10 filas con la geometría final;
   actualización = datos a la vista + `RefreshIndicator` (ya existe en el encabezado);
   vacío real, sin resultados y error como hoy.

## 3. Dirección visual

- Sin morado en datos: el número interno es metadato (`ink-3`), no enlace. Lo pulsable
  es el nombre (`TextLink`) y el hover de fila (`primary/5`, de la primitiva).
- Precio en `Figure`/`tabular-nums`, alineado a la derecha; estado con `StatusPill`
  (sin cambios).
- Densidad: la de `DataTable` (misma que Operaciones). Nada de `text-xs` ni alturas
  propias en celdas.

## 4. Primitivas

| Necesidad | Hoy | Decisión |
|---|---|---|
| Pie de paginación con rango | `DataTable` dice solo «Página 1 de 2» | **extender `DataTable`**: `pageSize` (prop; 10 aquí) y «Mostrando a–b de N {unidad}» en el pie (`itemLabel`), con «Página a de b» secundario. Beneficia a Operaciones y Usuarios |
| Fila pulsable | Operaciones pone un `Link` en la celda | `getRowHref?: (row) => string` en `DataTable`: la fila entera navega, con el nombre como enlace real (teclado) |
| Fila apilada en móvil | `DataTable` siempre pinta `<table>` | **extender `DataTable`**: `renderMobileRow?: (row) => ReactNode`; bajo `md` pinta una lista (`<ul>`) con esa fila y la MISMA paginación, orden y filtro. Sin ella, la tabla con scroll como hoy |
| Esqueleto con la geometría final | `LoadingState rows={5}` | `LoadingState rows={10}` (ya existe) |
| Celda nombre + metadato | — | composición local (`<div>` con dos líneas), no primitiva |
| Moneda | `pricePerNight` número sin moneda | `properties-cache.ts` lee `extra.currency` → `currency` en `Unit`; `formatMoney` (ya existe en `lib/money`) |

## 5. Fases

0. **Contrato**: prueba que congela el mapeo de `properties-cache.ts` (nombre, número,
   estado, capacidad, precio) antes de tocarlo; prueba de `DataTable` con `pageSize` y rango.
1. **Primitiva**: `DataTable` con `pageSize`, rango en el pie, `getRowHref` y
   `renderMobileRow` (+ pruebas, docs §5, skill).
2. **Datos**: `currency` y «sin capacidad/sin precio» como ausencia (`null`) en el mapeo,
   con las pruebas de la fase 0 ajustadas a propósito.
3. **Pantalla**: `PropertiesList` → `DataTable`, columnas, filtros unificados por pestaña,
   conteo anunciado, enlace a la propiedad, fila móvil. Sin cambios de datos en la pestaña
   «Propiedades» (solo la barra de filtros compartida).
4. **Opcional**: `?unit=` abre el diálogo del alojamiento en la pestaña Alojamientos.
5. **Regresión**: pruebas de `PropertiesList` (orden por defecto, paginación 10, vuelta a
   la página 1 al filtrar, conteo, filtros por pestaña, búsqueda por propiedad, «—» sin
   precio, enlace, fila móvil), teclado y foco, auditoría independiente, capturas a
   375/768/1280/1920.

## 6. Qué NO cambia

Endpoints, el agregado del portafolio, la pestaña «Propiedades», el formulario y el
diálogo de alojamiento.

## 7. Decisiones que son del usuario

- **P1** Sin precio: «—» (propuesto) ¿o «Sin precio» en texto?
- **P2** Capacidad no declarada: «—» (propuesto) ¿o seguir asumiendo 2 como hasta ahora?
- **P3** Destino de la fila: pestaña Alojamientos de la propiedad (fase 3) ¿y además abrir
  el diálogo del alojamiento con `?unit=` (fase 4)?
- ~~**P4** Tamaño de página~~ → **10** (revisión UX 2026-11-18).

## 8. Revisión UX (2026-11-18) — qué se tomó y qué sigue abierto

Tomado: 10 por página sin selector; orden inicial por nombre; filtros por pestaña con
«Limpiar» solo si hay alguno; conteo «8 de 28 alojamientos» anunciado; fila apilada en
móvil (nueva capacidad de `DataTable`); esqueleto de 10 filas; paginador oculto con una
página; página conservada durante una actualización.

No lo cubre la revisión (su maqueta mantiene «$150» y «2 huéspedes»), así que P1, P2 y P3
siguen siendo decisiones del usuario: el «$0» y el «2» inventados, la moneda, y a dónde
lleva la fila.

Aviso de la revisión que se comparte: esto reduce la sobrecarga visual, no lo
descargado; el portafolio completo sigue llegando en una sola respuesta. Correcto dentro
del alcance (sin backend).

## 9. Implementación (2026-11-18)

Decisiones tomadas con los valores propuestos (el usuario dijo «implementar» sin
contestar P1–P3): sin precio y sin capacidad → «—»; precio con `formatMoney` (el ÚNICO
formateador: «$ 850.000» / «US$ 150», distingue monedas por el locale es-CO en vez de un
código suelto); la fila lleva a `?tab=units&unit={uuid}` y la pestaña abre ese alojamiento.

- `hooks/useMediaQuery.ts` (nuevo, `useSyncExternalStore`): `SMALL_SCREEN_QUERY`.
- `shared/data-table.tsx`: `pageSize` (10), `itemLabel` → «Mostrando 1–10 de 28
  alojamientos» + «Página 1 de 3», `getRowHref` (la fila reenvía el clic al enlace real de
  la celda; sin `useRouter`, que rompía a todo consumidor sin App Router en pruebas) y
  `renderMobileRow` (lista apilada bajo `md`, misma página/orden). Docs §5 y skill.
- `types.Unit`: `capacity: number | null`, `pricePerNight: number | null`, `currency`;
  `properties-cache.toListing` ya no inventa 2 ni 0.
- `PropertiesList`: pestaña Alojamientos sobre `DataTable` con columnas Alojamiento
  (nombre `TextLink` + número en `ink-3`), Propiedad, Estado, Capacidad, Precio por noche;
  orden inicial por nombre; barra de filtros por pestaña (propiedad solo en Alojamientos,
  búsqueda también por propiedad), «Limpiar» solo con filtro activo; conteo `role="status"`;
  esqueleto de 10 filas.
- `PropertiesUnits`: `?unit=<uuid>` abre el diálogo de ese alojamiento una vez, al tick
  siguiente de tener las filas.

Pruebas: `data-table.features.test.tsx` (5), `PropertiesList.listings.test.tsx` (6),
`PropertiesUnits.query.test.tsx` (2), `properties-cache.test.ts` (+1, uno adaptado a
propósito). Mutaciones: ver el reporte de la sesión.

## 10. Revisión del 2026-11-18 (4 + 1 puntos)

1. **Precio 0 ≠ «sin precio» — NO se aplicó, con motivo.** El diálogo de alojamiento guarda
   `Number(price) || 0`: todo alojamiento con el precio vacío llega como 0 (17 de 29 en la
   cuenta real). Mientras el formulario escriba 0 por «vacío», un 0 no puede leerse como
   cortesía. Queda congelado en `properties-cache.test.ts` con el porqué; si algún día se
   quiere «Sin costo», primero hay que dejar de escribir 0 por omisión (cambio de escritura,
   con backend al tanto).
2. Ausentes al final en los dos sentidos: `undefined` + `sortUndefined: "last"`; además
   `sortDescFirst: false` para que el primer clic ordene de menor a mayor como en las
   columnas de texto. Prueba de orden con presentes y ausentes, asc y desc.
3. Pie apilado en móvil (`flex-col` → `sm:flex-row`); comprobado con el CSS real a 375
   (columna, sin desborde) y 768 (fila).
4. Cerrar el diálogo quita solo `unit` de la URL (queda `tab=units`) por Escape, X,
   Cancelar o tras guardar, con `history.replaceState` (el App Router lo sincroniza; sin
   router ni entrada nueva en el historial). Volver a `?unit=` (atrás) lo reabre. Pruebas.
5. `isInteractive` cubre `label`, `contenteditable`, `role=button/link/radio/combobox/
   tab/option` y `data-row-interactive`. Prueba.
