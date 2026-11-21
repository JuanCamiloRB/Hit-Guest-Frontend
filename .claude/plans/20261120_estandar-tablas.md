# Estándar de tablas — 2026-11-20

Pedido: «debemos estandarizar todo, iconos, así mismo el toggletip, las tablas
deben funcionar de la misma manera, aunque muestran diferente información el
comportamiento debe ser muy parecido».

La referencia es Operaciones (fases del plan 20261119): `DataTable`,
`StatusTile` 64 × 32 con `Toggletip`, encabezado de ícono sobre nombre, primera
columna fija, pie «Mostrando X–Y de N».

## Inventario (verificado por grep)

| Tabla | Archivo | Hoy |
|---|---|---|
| Operaciones | reservations/ReservationsList + columns | DataTable, tiles, toggletip (referencia) |
| Alojamientos | properties/PropertiesList | DataTable; capacidad con íconos sueltos y `title` |
| Alojamientos de la propiedad | properties/PropertiesUnits | `<Table>` a mano; «0 huéspedes», «$0» sin moneda |
| Detalle por reserva | dashboard/ReservationCostsList | `<Table>` a mano, paginación propia |
| Historial de transacciones | billing/TransactionHistory | `<Table>` a mano, paginación de servidor |
| Clientes (soporte) | support/SupportConsole | `<Table>` a mano + tarjetas, paginación de servidor |
| Usuarios (Configuración) | users/UserManagement | `<Table>` a mano |
| Equipo | users/UserList (`/dashboard/team`) | DataTable con DATOS INVENTADOS, en inglés, sin enlace en la app — no se toca, se reporta |

## Contrato

1. Toda tabla de listado es `DataTable`. Paginación de servidor con
   `serverPagination`. Mismo pie en todas.
2. Primera columna = identidad (nombre, `TextLink` si la fila navega, línea
   secundaria xs), fija a la izquierda.
3. Estado de un registro = `StatusPill`. Estado de un proceso = `StatusTile`.
   Un dato contable con ícono = `StatusTile tone="neutral"`. Columna de ícono:
   `ColumnHeader` (ícono sobre nombre, centrado).
4. Detalle de una celda: siempre `Toggletip`. Nunca `title` en una celda.
5. Canal u origen: `ChannelCell` (logo + nombre). Ausente: «—» en ink-4.
   Dinero: derecha, tabular, semibold, con su moneda.
6. Acciones: última columna, encabezado `sr-only` «Acciones».
7. Móvil: `renderMobileRow`.

## Fases

1. Primitivas: `StatusTile` tono `neutral`; `ToggletipLine` con ícono neutro;
   `DataTable` con `serverPagination`, `getRowTone`, `isRowSelected`; piezas
   compartidas `components/shared/table-cells.tsx`. Pruebas, doc §5, skill,
   plugin de Figma.
2. Alojamientos y Alojamientos de la propiedad con las mismas columnas.
3. Operaciones con las piezas compartidas (sin cambiar lo que se ve).
4. Detalle por reserva, Historial, Clientes y Usuarios a `DataTable`.
5. Auditoría: verify ×2, build, mutaciones, revisor independiente, navegador.

## Estado (2026-11-20)

Fases 1–4 hechas, sin commit. Las 8 tablas: siete en `DataTable`; Equipo
(`/dashboard/team`) no se tocó (datos inventados, sin enlace en la app).

- Íconos: un solo mapa, `shared/automation-icons.ts` (Operaciones y Tablero).
- `handmade-table` en `design:check`: importar `ui/table` fuera de la primitiva falla.
- Plugin de Figma: tono «Dato» de `StatusTile` (reparación si ya existe) y
  descripción del Toggletip; simulador: 23 pasos, dos corridas sin duplicados.

### Auditoría

Revisor independiente: 4 regresiones reales, todas corregidas con prueba.

1. Paginar dentro del formulario de la propiedad lo enviaba → `type="button"`.
2. Carga en paralelo del Tablero devolvía a la página 1 → `resetPageOn` y regla
   de «desapareció una fila» (insertar en cualquier posición no reinicia).
3. El editor mostraba la capacidad 2/1/1 que rellena el formulario →
   `declaredCapacity` (`lib/declared-capacity.ts`), solo para mostrar.
4. Editar o borrar en la página 2 volvía a la 1 → id por uuid + `resetPageOn`.

Menores corregidos: desglose en la fila móvil del Tablero, avance visible desde
el principio, «Siguiente» tras una página fallida en Facturación, la tile de
reintento de Operaciones sin Toggletip (un clic reintentaba y lo fijaba).

Aceptado como estándar: con una sola página no hay pie (antes Facturación decía
«Mostrando 1–5 de 5»). Clientes (soporte) dice solo la página: el backend no
manda «por página» y el rango sería inventado.

Mutaciones: 22/22 detectadas.

### Abierto (no es de esta tarea)

- El formulario de la propiedad guarda 2/1/1 por omisión al editar un
  alojamiento que no los tenía (`apiResponseToFormData` + `toListingPayload`).
- `initialsOf` quedó sin uso en producción (solo su prueba).

## Ajuste (2026-11-21)

Pedido: más color y la capacidad en una sola columna, «como el amarillo pero morado».

- `StatusTile` tono `neutral` → `data`: `bg-primary/10`, borde `primary/30`,
  ícono y cifra en `primary-hover` (con `primary` quedaba en 4.41:1 sobre una
  fila en hover; así, 5.38:1). Es el mismo tinte que `Badge accent`.
- Alojamientos (las dos tablas): huéspedes, habitaciones y baños pasan a ser UNA
  columna «Capacidad». La celda muestra los huéspedes y el Toggletip las tres
  cosas. Sin huéspedes pero con otro dato: solo el ícono. Sin nada: punteada.
- La columna Propiedad es un enlace a la ficha, con el edificio en `primary`.
