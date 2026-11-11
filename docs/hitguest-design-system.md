# Sistema visual de HitGuest

Este documento es el contrato visual del frontend. No es una colección de
recomendaciones: cualquier interfaz nueva debe construirse con los tokens y las
primitivas descritas aquí. Una pantalla puede componer estas piezas, pero no
crear una segunda versión local de ellas.

La fuente ejecutable de los tokens es `src/app/globals.css`. Si este documento y
el CSS difieren, primero se corrige la inconsistencia; no se agrega un estilo
local para resolverla.

## 1. Principios

1. **Marca e interacción son trabajos distintos.** Los colores oficiales de
   marca identifican a HitGuest; `primary` y `secondary` son sus versiones con
   contraste AA para botones, enlaces, foco y selección.
2. **El color tiene un significado.** Morado para interacción y selección;
   navy para jerarquía y datos; verde, ámbar, azul y rojo únicamente para
   estados semánticos.
3. **Una necesidad, una primitiva.** Botones, campos, avisos, estados, tarjetas,
   diálogos y tablas se consumen desde `src/components/ui`.
4. **La jerarquía nace de tipografía, espacio y contraste.** No se agregan
   gradientes, sombras intensas, líneas decorativas o colores por pantalla.
5. **Los estados son parte del componente.** Hover, focus, active, disabled,
   loading, error, vacío y actualización no se reconstruyen en cada vista.

## 2. Color

### Marca

| Token | Valor | Uso |
|---|---:|---|
| `brand-navy` | `#222755` | Logo, identidad y acentos institucionales |
| `brand-purple` | `#9D4CF2` | Logo, ilustración y acentos no textuales |
| `brand-blue` | `#5467FA` | Identidad secundaria |
| `brand-white` | `#F9FBFA` | Fondo oficial |

### Interacción

| Token | Uso |
|---|---|
| `primary` / `primary-hover` | Acción principal, enlaces, selección y foco |
| `secondary` / `secondary-hover` | Acción secundaria con relleno |
| `destructive` / `destructive-hover` | Relleno del botón destructivo. Mismo rojo que `danger` (un solo rojo en pantalla); el texto de error va siempre en `danger` |
| `accent` | Hover neutro de controles ghost, menús y opciones |

Nunca se usa `brand-purple` como relleno de un botón con texto: `primary` es la
variante que cumple contraste.

### Tinta, superficies y estado

- `ink`: títulos, nombres, importes y datos principales.
- `ink-2`: descripción y texto de apoyo.
- `ink-3`: metadatos y encabezados pequeños.
- `ink-4`: ausencia visual (`—`), nunca texto informativo.
- `rule`: divisores y bordes de superficie.
- `sunk`: encabezados de tabla, pistas y superficies hundidas.
- `card` / `background`: superficies base.
- `success`, `warning`, `info`, `danger` y sus pares `*-sunk`: estados. No son
  colores decorativos ni series de gráficos.

**Un solo juego de tokens (DS-7a, 2026-11-12).** Los nombres heredados de
shadcn (`muted-foreground`, `foreground`, `muted`, `border`, `card-foreground`,
`popover-foreground`, `accent-foreground`) son alias de los HIT en
`globals.css` y no se escriben en el código: antes tenían otros valores y
dejaban dos grises (#71717a y `ink-3`) y dos rojos. En su lugar: `text-ink-3`,
`text-ink`, `bg-sunk`, `border-rule`, `text-danger`.

Los valores hexadecimales solo se declaran en `globals.css`. Las marcas de
terceros pueden conservar su color oficial únicamente dentro del componente
compartido que las representa (`ChannelLogo`).

## 3. Tipografía

- **Gabarito (`font-sans`)**: títulos `h1`–`h4`, cifras protagonistas y marca.
- **Poppins (`font-secondary`)**: cuerpo, controles, tablas y metadatos.
- Escala permitida (decisión A, 2026-11-11): utilidades Tailwind nombradas
  (`text-xs` 12 px, `text-sm` 14 px, `text-base` 16 px, `text-lg`, `text-xl`,
  `text-2xl`, `text-3xl`). No hay tamaños intermedios: lo que era 9–11 px es
  `text-xs` y lo que era 13 px es `text-sm`. No se agregan `text-[Npx]`.
- Pesos: `medium` para controles, `semibold` para énfasis y `bold` para títulos
  o cifras. Un párrafo completo no se presenta en bold. Sin `black`,
  `extrabold`, `light` ni `thin`.
- **Caso de oración en toda la interfaz** (decisión 2026-11-11): datos,
  estados, insignias, encabezados de tabla y botones. Las mayúsculas solo
  existen en la primitiva `Overline`, para rótulos de grupo de navegación de
  una o dos palabras («Sistema»). El tracking de la escala se permite para
  dígitos de un código; no el arbitrario.
- Cada pantalla tiene un solo `h1` (`PageHeader`); las secciones usan niveles
  consecutivos. Los títulos salen de `Heading`, con cinco tamaños: `page`
  (2xl, 3xl desde `sm`), `title` (xl), `section` (base), `subsection` (sm) y
  `group` (xs). Todos en Gabarito bold (DS-7b).

## 4. Espaciado, bordes y elevación

- Se usa la escala de espaciado de Tailwind; no se inventan valores arbitrarios
  para corregir una pantalla aislada.
Radios (cuatro, decisión 2026-11-11), y `xs` para microcontroles:

- `rounded-xs`: casillas y microcontroles de 16 px.
- `rounded-md`: controles (botones, campos, selectores).
- `rounded-lg`: avisos y piezas dentro de una tarjeta.
- `rounded-xl`: tarjetas, tablas, paneles y diálogos.
- `rounded-full`: avatar, indicador o pastilla; no contenedores generales.

Sin `rounded` suelto, `rounded-sm`, `rounded-2xl` ni `rounded-3xl`.
- `border-input`: campos editables.
- `border-rule`: divisores y superficies.
- `shadow-xs`: control elevado.
- `shadow-sm`: tarjeta estándar.
- `shadow-md`: un panel flotante propio (lista desplegable), nunca una tarjeta.
- Sombra alta (`lg`, `xl`, `2xl`): solo overlays de `components/ui`
  (`Dialog`, `AlertDialog`, `Sheet`, `Popover`).
- Medidas: la escala de espaciado (`w-45` = 180 px, `max-w-12` = 3 rem). Las
  medidas relativas a la pantalla (`max-h-[90vh]`, `w-[95vw]`, `%`) se permiten
  porque no tienen equivalente en la escala.
- Las tablas y secciones de datos no llevan sombras decorativas.
- **Opacidad (DS-7f):** solo `5`, `10`, `20`, `30`, `50`, `70` y `80` (y `0`/`100`
  en `opacity-`). 5–10 para tintes de selección (`bg-primary/5`), 20–30 para
  bordes de estado (`border-warning/30`), 50 para superficies hundidas y hover
  (`bg-sunk/50`), 70–80 para texto y vidrio sobre oscuro (`text-white/70`).

No se permiten `rounded-[…]`, `shadow-[…]`, gradientes ni transformaciones de
escala en hover.

## 5. Componentes autorizados

| Necesidad | Componente |
|---|---|
| Acción | `Button`, eligiendo la variante por intención: `default` (principal, una por vista), `secondary`, `outline`, `ghost`, `link`; `destructive`, `outline-destructive` y `ghost-destructive` para eliminar o desconectar; `outline-warning` para lo que pide atención sin destruir («Configurar (requerido)», exonerar); `link-inherit` para la acción dentro de un aviso; `inverse` sobre superficies oscuras; `overlay` sobre una foto; `field` para un disparador con forma de campo (fecha, mes) con `data-placeholder` sin valor. `outline`/`ghost` con `aria-pressed` son conmutadores. Tamaños: `sm` 32, `default` 40, `lg` 44 y `xl` 48 (solo portal del huésped); `icon-sm`/`icon`/`icon-lg`; `inline` toma el tamaño del texto. Un enlace con forma de botón es `Button asChild` sobre `Link`. Desde la pantalla, `className` solo lleva layout (ancho, márgenes, posición, alineación). |
| Enlace de dato | `TextLink`: un dato que navega (nombre del huésped, contacto, reserva), en tinta y morado al pasar. Una acción con forma de enlace es `Button variant="link" asChild` |
| Pulsable sin forma de botón | `UnstyledButton` (tarjetas seleccionables, filas, ítems de menú, encabezados que ordenan): `type="button"` y el foco del sistema; la forma, con tokens. Nunca con relleno sólido: eso es un `Button` |
| Campo | `Input`, `PasswordInput` (contraseña o secreto, con mostrar/ocultar accesible), `Textarea`, `Select`, `PhoneInputField`, `FileInput` (oculto; lo abre un Button o una zona de carga) |
| Error y ayuda de campo | `FormMessage` con react-hook-form; sin él, `FieldError` (error; `compact` en filas densas) y `FieldHint` (la ayuda que pasa a error con `invalid`, mismo nodo y mismo `id`) |
| Etiqueta de campo | `Label` asociada mediante `htmlFor`; `Label variant="plain"` cuando envuelve otra cosa (casilla + texto largo, zona de carga); texto auxiliar con `FormDescription` |
| Selección | `Checkbox`, `Radio` (nativo, grupo por `name`), `Switch`, `Tabs` |
| Superficie | `SectionCard` (sección con título), `Card` (encabezado y cuerpo estándar) o `Surface` (la superficie sola; el interior lo arma la pantalla). `Surface as=` para la etiqueta semántica, `flat` sin sombra (cuadrículas densas, dentro de otra superficie), `floating` para un panel flotante propio (radio y sombra `md`, como `Select`) |
| Modal | `Dialog`, `AlertDialog` o `Sheet` |
| Estado corto | `StatusPill tone=…` (`success`, `warning`, `info`, `danger`, `idle`, `accent`, `none`): punto + palabra; un estado nunca va solo por color |
| Etiqueta corta (clasificación) | `Badge tone=…` (`neutral`, `accent`, `success`, `warning`, `danger`, `info`, `surface` sobre foto o mapa): clasifica, no es un estado (sin punto). Misma forma que StatusPill |
| Pantalla | `Page` (contenedor: ancho máximo y espacio entre bloques; el relleno lo da `<main>`) y `PageHeader` (el único `h1`: `title`, `description`, `actions`, `eyebrow` con `PageBreadcrumb`, `titleAddon`) |
| Título | `Heading level={1–4}`: el nivel es la jerarquía y `size` cómo se ve (`page`, `title`, `section`, `subsection`, `group`; por omisión según el nivel). `tone`: `ink`, `muted` (rótulo pequeño), `inverse` (superficie oscura). Desde la pantalla solo layout |
| Rótulo de grupo | `Overline` (único uso de mayúsculas) |
| Aviso | `FeedbackBanner tone=… mode=…`: `title`, `action`, `density="compact"` en tarjetas y filas, `icon` cuando el ícono tiene significado propio (cámara, reloj, correo), `layout="bar"` para una franja a todo el ancho (aviso de saldo, cabecera de un cajón). Una fila que solo se tiñe por su estado (`bg-danger-sunk/40`) no es un aviso |
| Carga | Una forma por espera: acción → `Button loading` (`loadingLabel` opcional; el indicador ocupa el lugar del ícono y el botón conserva color y foco, sin `disabled`); carga inicial → `LoadingState` (`rows`, `spinner` en bloque —`page` para la pantalla entera, `showLabel` para ver el texto— o `inline` junto a un texto, `compact` en xs) o `Skeleton` (`inline` dentro de texto o de un botón); datos ya en pantalla → `RefreshIndicator`; el indicador solo (junto a un interruptor, sobre una foto) → `Spinner size tone label` |
| Vacío | `EmptyState` (`empty` o `no-results`; `icon` recibe el componente de lucide y lo pinta en `2xl` light) |
| Tabla | `Table` para composición especial; `DataTable` para ordenar/paginar |
| Ícono | `Icon icon={…}` (escala `xs`…`4xl`, trazo `light`/`regular`/`bold`, decorativo salvo `label`) |
| Ícono con fondo | `IconBadge icon tone size shape`: el círculo que encabeza una pantalla de resultado o el recuadro de una categoría. `size` sm 32 · md 44 · lg 64 · xl 96; `shape` `circle` (estado) o `square` (categoría); sin borde |
| Persona o cuenta | `Avatar size tone` (`sm`, `default`, `lg`, `xl`; `neutral`, `primary`, `inverse` sobre la navegación) con `AvatarFallback` |
| Marca | `Logo`, `ChannelLogo` |

No se crean botones, inputs, selects, textareas, avisos, spinners o pastillas a
mano dentro de una feature. Una excepción técnica debe quedar documentada junto
al código y no puede convertirse en un patrón visual alternativo.

## 6. Iconografía

- `lucide-react` es la biblioteca funcional única, y un ícono se pinta siempre
  con la primitiva `Icon`: `<Icon icon={Mail} />`, nunca `<Mail />` ni
  `<item.icon />`. Los componentes de lucide se importan solo para pasarlos
  como valor (`icon={Mail}`).
- Escala única (prop `size`, nunca clases `h-*`/`w-*`/`size-*`):

  | Paso | px | Uso |
  |---|---|---|
  | `xs` | 12 | dentro de una pastilla o de texto `text-xs` |
  | `sm` | 14 | junto a un rótulo o dato pequeño |
  | `md` | 16 | predeterminado: texto, campos y todo ícono dentro de `Button`, menús, `Tabs` y `Select` |
  | `lg` | 20 | navegación y encabezados de tarjeta |
  | `xl` | 24 | mensajes destacados |
  | `2xl` | 32 | estado vacío (`EmptyState`), ilustración de una tarjeta |
  | `3xl` | 40 | resultado de un paso del portal (éxito, espera, error) |
  | `4xl` | 48 | pantalla final del portal |

- Trazo: `regular` (2) siempre; `bold` (3) solo para el check de un paso
  completado; `light` (1,5) para los pasos de ilustración.
- Decorativo por omisión (`aria-hidden`). Si el ícono es el único portador del
  significado, `label` lo convierte en imagen con nombre. El color va en
  `className` con tokens; la posición también (`absolute left-3`).
- Un botón que solo contiene un ícono necesita nombre accesible y usa el tamaño
  `icon`, `icon-sm` o `icon-lg` de `Button`.
- Logos de canales se resuelven mediante `ChannelLogo`, nunca mediante texto,
  emojis o dibujos aproximados.

## 7. Interacción y accesibilidad

- Todos los controles tienen hover, active, focus-visible y disabled.
- El foco lo pinta la primitiva con el contorno `ring`; ninguna pantalla lo
  elimina.
- Objetivo mínimo: 40 px por defecto y 32 px en densidad compacta.
- El estado no depende solo del color: se acompaña de palabra, icono o forma.
- Texto normal: contraste mínimo 4.5:1. Controles y foco: 3:1.
- Carga inicial, actualización, vacío, sin resultados, error, datos parciales y
  éxito siguen la escala documentada en `hitguest-standards`.

## 8. Aplicación y control

`npm run design:check` revisa el árbol y rechaza deuda visual nueva. La línea
base en `scripts/design-system-baseline.json` describe únicamente deuda
preexistente; no es una lista de estilos aprobados.

Qué rechaza (cada regla tiene su `id` en el reporte):

| Regla | Ejemplo prohibido | Qué usar |
|---|---|---|
| `tailwind-palette-color` | `text-slate-500`, `bg-amber-50` | `text-ink-3`, `bg-warning-sunk` |
| `arbitrary-color`, `raw-color-literal` | `bg-[#8b3ee0]`, `text-[var(--x)]` | la utilidad del token |
| `brand-color-interaction` | `bg-brand-purple`, `text-brand-blue` | `primary`, `secondary` (los de marca, solo logo e ilustración) |
| `arbitrary-type-size`, `arbitrary-font` | `text-[13px]` | la escala (`text-xs`, `text-sm`…) |
| `arbitrary-radius`, `arbitrary-shadow`, `gradient` | `rounded-[13px]`, `bg-gradient-to-r` | los radios y sombras del §4; sin degradados |
| `native-control`, `native-label` | `<button>`, `<label>` fuera de `components/ui` | `Button`, `Label` y demás primitivas |
| `color-function-literal` | `"rgb(0 0 0 / .1)"` en código | un token |
| `inline-visual-style` | `style={{ color: … }}`, `style={{ borderRadius: 8 }}` | clases con tokens (se permiten medidas dinámicas como `width`) |
| `radius-scale` | `rounded`, `rounded-2xl` | `rounded-xs`, `md`, `lg`, `xl`, `full` |
| `shadow-scale` | `shadow-lg` en una tarjeta | `shadow-sm` (`md` si flota) |
| `arbitrary-length` | `w-[180px]`, `h-[2.5rem]` | `w-45`, `h-10` |
| `font-weight-scale` | `font-black` | `font-bold` |
| `uppercase-text` | `uppercase`, `tracking-[0.2em]` | caso de oración; `Overline` para rótulos de grupo |
| `primitive-override` | `<Input className="rounded-xl bg-sunk">` | la primitiva tal cual; solo layout (ancho, relleno para un ícono) |
| `button-override` | `<Button className="bg-primary h-11 font-bold">` | `variant`/`size` (`lg`); solo layout en `className` |
| `pressable-fill` | `<UnstyledButton className="bg-primary">`, `<Link className="h-12 bg-primary">` | `Button`, `Button asChild` |
| `label-override` | `<Badge className="bg-success-sunk text-success">` | `tone="success"` |
| `handmade-pill` | `<span className="rounded-full bg-success-sunk px-2 text-xs">` | `Badge` o `StatusPill` |
| `icon-direct` | `<Mail />`, `<item.icon />` | `<Icon icon={Mail} />` |
| `icon-size-override` | `<Icon className="h-5 w-5" />` | `<Icon size="lg" />` |
| `nonstandard-icon-library` | `react-icons` | `lucide-react` |
| `heading-direct` | `<h2 className="text-3xl font-bold">` | `Heading level={2}` o `PageHeader` |
| `heading-override` | `<Heading className="font-semibold text-primary">` | `size`/`tone` |
| `handmade-notice` | `<div className="rounded-xl border border-danger/30 bg-danger-sunk px-4">` | `FeedbackBanner tone="danger"` |
| `handmade-card` | `<div className="rounded-xl border border-rule bg-white p-5 shadow-sm">` | `Surface className="p-5"`, `Card`, `SectionCard` |
| `handmade-spinner` | `<Icon icon={Loader2} className="animate-spin" />` | `Button loading`, `LoadingState`, `RefreshIndicator`, `Spinner` |
| `handmade-skeleton` | `<div className="h-4 animate-pulse bg-sunk" />` | `Skeleton` |
| `handmade-field-error` | `<p className="text-xs text-danger">` | `FieldError`, `FieldHint invalid`, `FormMessage` |
| `text-link` | `<Link className="text-primary underline">` | `Button variant="link" asChild`, `TextLink` |
| `text-action` | `<UnstyledButton className="text-danger">Eliminar` | `Button variant="ghost-destructive"` (el morado de selección sí se permite) |
| `opacity-scale` | `bg-sunk/60`, `opacity-40` | la escala del §4 |
| `type-scale-max` | `text-4xl` | `text-3xl` (el máximo) |
| `native-table` | `<table>`, `<td>` | `Table`, `DataTable` |
| `handmade-overlay` | `<div className="fixed inset-0 bg-black/70">` | `Dialog`, `AlertDialog`, `Sheet` |
| `handmade-icon-badge` | `<div className="flex size-16 items-center justify-center rounded-full bg-success-sunk"><Icon … /></div>` | `IconBadge` |
| `legacy-token` | `text-muted-foreground`, `text-destructive`, `bg-muted`, `border-border` | `text-ink-3`, `text-danger`, `bg-sunk`, `border-rule` |

Revisa los textos fijos y también los trozos fijos de los template literals
(`` `p-2 ${x}` ``). Las pruebas y las copias de Finder («Archivo 2.tsx») quedan
fuera.

**Estado (2026-11-11): la línea base está en cero y el gate es estricto.** Las
2511 desviaciones heredadas se migraron; `scripts/design-system-baseline.json`
es `{}`. Cualquier estilo fuera de este manual hace fallar `npm run verify`.
Nunca se vuelve a escribir la línea base para hacer pasar un cambio.

Excepciones legítimas, centralizadas y documentadas en el verificador
(`COLOR_EXCEPTIONS`):

- `src/components/brand/`: colores oficiales de marcas ajenas (OTAs, PMS) en
  `ChannelLogo` y `ProviderMarks`.
- `src/lib/design-tokens.ts`: espejo JS de los tokens para lo que no lee CSS
  (Stripe Elements, la firma); su prueba falla si se desalinea de globals.css.
