---
name: hitguest-design-system
description: Manual de marca y sistema visual de HitGuest Frontend. Cubre qué primitivas existen y dónde, la regla de crear la primitiva antes de usarla cuando falta, tokens de color y su porqué, decisiones visuales vigentes (borde de campos, pestaña activa, hover de filas), logo, tipografía, cómo se sincroniza con Figma y cómo verificar. Activar en CUALQUIER tarea que toque UI, aunque sea un solo color o una clase: pantallas, componentes, estilos, revisiones visuales, y cada vez que el usuario pida «como el manual de marca», «los colores de marca» o un cambio de borde, hover, estado o tipografía.
---

# HitGuest — Manual de marca en código

`hitguest-standards` tiene las reglas generales de ingeniería. Este skill es la
parte visual: qué pieza usar, de qué color va y por qué. Las afirmaciones de
aquí apuntan a un archivo real; si un archivo citado ya no existe, se corrige
este skill en el momento (Regla 7 de `hitguest-standards`).

## Fuentes de verdad, en orden

1. `src/app/globals.css`: los valores. Los hex solo viven aquí (y en
   `src/lib/design-tokens.ts`, su espejo JS para Stripe y la firma, con prueba
   de alineación).
2. `docs/hitguest-design-system.md`: el contrato. §5 es el catálogo de
   primitivas; §8 son las reglas que rechaza `npm run design:check`.
3. `src/components/ui/`: las primitivas mismas.
4. `src/app/globals-contrast.test.ts`: los pares de contraste que no se
   pueden romper.
5. Figma «Hit-Hospitality» (fileKey `0DSAVQvwb4D0nKLPdKnKBn`), página «Manual
   de marca»: es un espejo y se regenera desde el código, nunca al revés. Ver
   «Figma» más abajo.

Si el documento y el CSS no coinciden, se corrige la inconsistencia. No se
agrega un estilo local para taparla.

## Regla 1 — Solo se usan componentes que existen; si falta, se crea primero

**Antes de usar un componente, comprobar que existe.** No basta con que el
nombre suene a algo de shadcn o de otra app: hay que confirmarlo.

```bash
ls src/components/ui/ src/components/shared/
grep -rnE "export (function|const) Nombre\b|export \{[^}]*\bNombre\b" src/components
```

Catálogo verificado el 2026-11-12. Varias primitivas viven dentro de otro
archivo:

| Necesidad | Primitiva | Archivo |
|---|---|---|
| Acción | `Button` (variante por intención, tamaño) | `ui/button.tsx` |
| Pulsable sin forma de botón | `UnstyledButton` | `ui/unstyled-button.tsx` |
| Enlace de dato | `TextLink` | `ui/text-link.tsx` |
| Campo | `Input`, `Textarea`, `PasswordInput`, `Select`, `PhoneInputField`, `FileInput` | `ui/input.tsx`, `ui/textarea.tsx`, `ui/password-input.tsx`, `ui/select.tsx`, `ui/phone-input-field.tsx`, `ui/file-input.tsx` |
| Campo de solo lectura | `ReadOnlyField` (`label`, `value`, `hint`, `locked`) | `ui/read-only-field.tsx` |
| Error y ayuda de campo | `FormMessage`, `FieldError`, `FieldHint` | `ui/form.tsx` |
| Etiqueta | `Label` | `ui/label.tsx` |
| Selección | `Checkbox`, `Radio`, `Switch`, `Tabs` (`TabsList size="default" \| "sm"`) | `ui/checkbox.tsx`, `ui/radio.tsx`, `ui/switch.tsx`, `ui/tabs.tsx` |
| Interruptor con texto | `SwitchField` (título = nombre del control; texto y error unidos; `variant`, `tone`, `size`) | `ui/switch-field.tsx` |
| Casilla con texto | `CheckboxField` (`label`, `action` fuera de la etiqueta) | `ui/checkbox-field.tsx` |
| Superficie | `Surface`, `Card`, `SectionCard` (`tone` inverse/selected/warning/danger/sunk, `interactive`, `dashed`, `flat`, `floating`; el título de una tarjeta es `Heading`, no hay `CardTitle`) | `ui/card.tsx`, `ui/section-card.tsx` |
| Pantalla | `Page`, `PageHeader`, `PageBreadcrumb` | `ui/page.tsx` |
| Barra fija al pie (portal) | `BottomBar` | `ui/bottom-bar.tsx` |
| Título y rótulo | `Heading`, `Overline` | `ui/heading.tsx`, `ui/overline.tsx` |
| Estado y etiqueta | `StatusPill`, `Badge` | `ui/status-pill.tsx`, `ui/badge.tsx` |
| Aviso | `FeedbackBanner` | `ui/feedback-banner.tsx` |
| Plegable | `Disclosure` (`row` | `inline`) | `ui/disclosure.tsx` |
| Nota | `Note` (`tone` neutral/accent, `density`, `icon`, `as`) | `ui/note.tsx` |
| Espera | `LoadingState`, `RefreshIndicator`, `Spinner`, `Skeleton`, `Button loading` | `ui/loading-state.tsx`, `ui/skeleton.tsx` |
| Progreso | `Progress` (`value`, `max`, `label` obligatorio, `size`, `tone`) | `ui/progress.tsx` |
| Cifra protagonista | `Figure` (`size`, `tone`, `kind`, `as`) | `ui/figure.tsx` |
| Término y definición | `DefinitionItem` (dentro de un `<dl>`) | `ui/definition-list.tsx` |
| Vacío | `EmptyState` | `ui/empty-state.tsx` |
| Tabla | `Table` (composición), `DataTable` (ordenar y paginar) | `ui/table.tsx`, `shared/data-table.tsx` |
| Modal | `Dialog`, `AlertDialog`, `Sheet`, `Popover`, `DropdownMenu` | `ui/dialog.tsx`, `ui/alert-dialog.tsx`, `ui/sheet.tsx`, `ui/popover.tsx`, `ui/dropdown-menu.tsx` |
| Ícono | `Icon`, `IconBadge` (`interactive` dentro de un pulsable con `group`) | `ui/icon.tsx`, `ui/icon-badge.tsx` |
| Persona | `Avatar` | `ui/avatar.tsx` |
| Marca | `Logo`, `ChannelLogo`, `ProviderMarks` | `ui/Logo.tsx`, `brand/ChannelLogo.tsx`, `brand/ProviderMarks.tsx` |

**Si la pantalla necesita una pieza que no está en el catálogo, primero se
crea como primitiva y después se usa.** No se arma a mano dentro de la feature
ni se inventa un import. Pasos:

1. Confirmar que de verdad falta: ninguna primitiva ni variante existente
   resuelve la necesidad. Una variante nueva de `Button` o un `tone` nuevo de
   `Badge` casi siempre basta.
2. Crearla en `src/components/ui/<nombre>.tsx`, con el mismo esquema de las
   hermanas:
   - `cva` con variantes por intención (no por color);
   - solo tokens;
   - estados completos: hover, active, focus-visible, disabled y, si aplica,
     loading, error y vacío;
   - `data-slot`;
   - `className` solo para layout.
3. Probarla en `src/components/ui/<nombre>.test.tsx` (Vitest + RTL), siguiendo
   `button.test.tsx` y `selection-controls.test.tsx`.
4. Agregarla al catálogo de `docs/hitguest-design-system.md` §5 y a la tabla
   de arriba.
5. Si `design:check` debe impedir su versión hecha a mano, agregar la regla en
   `scripts/check-design-system.mjs`, como `handmade-notice` o `handmade-pill`.
6. Recién entonces llamarla desde la pantalla.
7. Si tiene una forma que el manual de Figma debe mostrar, agregarla al
   plugin (ver «Figma»).

Si una pieza solo existe en un archivo de `features/` y otra pantalla también
la necesita, se sube a `components/ui` antes de reutilizarla. No se importa de
la feature hermana.

**Por qué importa (precedente real).** `SearchableSelect`
(`src/features/checkin/components/SearchableSelect.tsx`) es un campo hecho a
mano. Cuando el borde de los campos cambió el 2026-11-12, todas las primitivas
lo tomaron solas por el token, pero ese archivo se quedó con el borde gris y
hubo que corregirlo a mano. Una pieza a mano no recibe los cambios del sistema.

## Regla 2 — La primitiva se usa tal cual

Desde una pantalla, `className` solo lleva layout: ancho, márgenes, posición,
alineación. No se reemplazan colores, hover, radios ni estados. Así lo
impone `design:check` (`primitive-override`, `button-override`,
`label-override`, `tabs-override`).

Si la pantalla necesita otra densidad u otro tamaño, eso es una variante de
la primitiva, no clases propias (Regla 1). Precedente de pestañas
(2026-11-12): Propiedades/Alojamientos (`PropertiesList.tsx`) pintaba la
activa en `bg-brand-navy` con texto blanco, el formulario de propiedad
(`PropertyForm.tsx`) en `bg-primary` con texto blanco e íconos coloreados a
mano, y el editor de alojamiento (`PropertiesUnits.tsx`) bajaba el texto a
`text-xs font-bold`. Al cambiar la primitiva, la mezcla dejó texto morado
sobre navy. Hoy las tres usan `Tabs` tal cual, como Lista/Calendario en
Operaciones. La densidad del editor quedó como `TabsList size="sm"`, y
`tabs-override` impide volver a pisarlas.

Precedente: la tabla «Detalle por reserva» del Tablero
(`src/features/dashboard/components/ReservationCostsList.tsx`) reemplazaba el
hover de `TableRow` con `hover:bg-sunk/50`. Las filas se veían grises mientras
las de Operaciones se veían moradas. Se quitó el reemplazo. Única excepción en
esa tabla: la fila «Consumo no disponible», que conserva el ámbar
(`bg-warning-sunk/30 hover:bg-warning-sunk/50`) porque el color ES el aviso.

## Regla 3 — Color: marca, interacción y estado son trabajos distintos

| Token | Valor | Trabajo |
|---|---|---|
| `brand-navy` | `#222755` | Logo, sidebar (`--sidebar`), identidad. No como borde fino: a 1 px se lee gris. |
| `brand-purple` | `#9D4CF2` | Logo, ilustración, `--ring` (foco). Nunca relleno de botón con texto. |
| `brand-blue` | `#5467FA` | Identidad secundaria y **borde de los campos** (`--input`). |
| `brand-white` | `#F9FBFA` | Fondo (`--background`). |
| `primary` / `-hover` | `#8B3EE0` / `#7B30CF` | Acción principal, enlaces, selección, hover de campo. 5.44:1 con blanco. |
| `secondary` / `-hover` | `#4A5BEF` / `#3F4CD6` | Acción secundaria con relleno. |
| `ink` … `ink-4` | `#1B2047` … `#A2A8C4` | Texto: dato, apoyo, metadato, ausencia (`—`). |
| `rule`, `sunk`, `card` | | Divisores, superficie hundida, tarjeta. |
| `success`, `warning`, `info`, `danger` (+ `-sunk`) | | Solo estado; nunca decoración ni series de gráficos. |

Las utilidades de marca (`bg-brand-purple`, `text-brand-blue`…) no se usan en
controles: `design:check` las rechaza (`brand-color-interaction`). La marca
llega a los controles a través de tokens semánticos como `--input` o `--ring`.

### Decisiones vigentes (2026-11-12)

| Pieza | Decisión | Por qué / dónde |
|---|---|---|
| Borde de campo | `--input` = `#5467FA` (brand-blue). 4.47 card · 4.27 fondo · 4.01 sunk. | El usuario lo pidió en azul de marca. El navy `#222755` se probó primero (commit 3252ef1): a 1 px se leía gris, aunque en el sidebar se ve azul porque es una superficie grande. `globals.css`, fijado en `globals-contrast.test.ts`. |
| Hover de campo | `hover:border-primary`, solo habilitado, sin foco, sin error | `fieldStates` en `ui/input.tsx`, `ui/select.tsx`, variante `field` de `ui/button.tsx`. El foco se distingue porque suma el anillo `ring` de 3 px. |
| `--input-hover` | `#636B8D`, solo para tarjetas y opciones seleccionables (borde `rule` → hover) | Ya no es el hover de los campos. |
| Pestaña activa (`Tabs`, variante default) | card + `text-primary` + `border-primary/30`, en TODAS las pestañas de la app | `ui/tabs.tsx`. Sin relleno `primary/10`: sobre la pista `sunk` el texto primary bajaría a 4.25:1. Los íconos dentro de la pestaña toman su color (`currentColor`); no se colorean a mano. |
| Hover de fila | `hover:bg-primary/5` en `TableRow` | `ui/table.tsx`. Ninguna tabla lo reemplaza (Regla 2). |
| Botón conmutador | `outline` o `ghost` con `aria-pressed` → `border-primary bg-primary/10 text-primary` | `ui/button.tsx` («Solo con consumo» en el Tablero). |

**Morado claro = selección o interacción.** Cuando el usuario pide «morado
claro» para algo activo o en hover, la escala ya existe: `primary/5` para el
hover de una fila, `primary/10` para el fondo de algo seleccionado y
`primary/30` para un borde de selección. Opacidades permitidas: 5, 10, 20, 30,
50, 70, 80.

**Antes de fijar un color de texto sobre un tinte, calcular el contraste
compuesto** (el tinte mezclado con la superficie de abajo), no contra blanco.
Así se descartó `primary/10` en la pestaña activa.

## Tipografía, forma e íconos (resumen; el detalle está en el doc §3, §4 y §6)

- Gabarito (`font-sans`, carga 700/800) para títulos (`Heading`) y cifras
  protagonistas. Poppins (`font-secondary`) para cuerpo y controles.
- Escala cerrada: `text-xs` (12) a `text-3xl` (30). Sin `text-[13px]`.
- Caso de oración en toda la interfaz. Las mayúsculas solo van en `Overline`.
- Radios: `xs` microcontroles, `md` controles, `lg` dentro de tarjeta, `xl`
  tarjetas/tablas/diálogos, `full` avatar o punto.
- Sombras: `xs` control, `sm` tarjeta, `md` panel flotante; `lg`/`xl` solo
  overlays de `components/ui`.
- Íconos: solo `lucide-react` a través de `Icon` (`size` de `xs` 12 a `4xl`
  48). Logos de canales con `ChannelLogo`.

## Logo

- `Logo` (`src/components/ui/Logo.tsx`) con los PNG oficiales
  `public/logos/hit-icon-navy.png` y `hit-icon-white.png`. No existe un
  archivo del wordmark: «GUEST» se tipografía.
- Sidebar: ícono HIT blanco, `h-11`. Header interno: lockup HIT GUEST, ícono
  `h-8`, más chico que el del sidebar.
- No se deforma, rota, recolorea ni lleva sombra o contorno. Mínimo digital:
  35 px el ícono y 56 px el logotipo.

## Figma (espejo del código)

- Archivo «Hit-Hospitality», página «Manual de marca»: variables `Marca`,
  `Color` (modo «Claro») y `Forma`; estilos `Titular/*`, `Cuerpo/*`,
  `Overline` y `Sombra/*`; componentes en «Componentes · maestros».
- Se genera con un plugin local que está en `build/figma-manual-de-marca/`
  (git lo ignora, no está versionado). Se edita `code.src.js` y se regenera
  `code.js` con `node build/figma-manual-de-marca/build.mjs`. El usuario lo
  corre en Figma de escritorio (Plugins → Development). Es idempotente por
  nombre y regenera la documentación en cada corrida.
- **Cuando cambia un token o una primitiva que el manual muestra, se
  actualiza también el plugin**: la tabla `COLOR`/`MARCA` y el componente
  afectado, incluida la reparación del componente si ya existe en el archivo.
- Gotchas del Plugin API: con `documentAccess: dynamic-page`, los estilos se
  aplican con `setEffectStyleIdAsync`/`setTextStyleIdAsync`; el setter
  directo lanza un error. Una propiedad TEXT es compartida por todas las
  variantes, así que la frase de cada tono va en la instancia. El MCP de
  Figma del plan Starter se queda sin llamadas enseguida: no construir
  pantallas con él.

## Verificación

1. `npm run verify` (typecheck, lint, `design:check`, Vitest). Si cambia un
   par de colores, agregar o ajustar el caso en `globals-contrast.test.ts`.
2. Mirarlo en el navegador. Con Playwright, medir el estilo sobre el elemento
   **visible** (`locator("input:visible")`): el login tiene un input
   invisible antes del visible, y medir el primero del DOM ya dio un falso
   «el hover no funciona».
3. Para pantallas que piden sesión, se puede montar una página de prueba que
   cargue el CSS del servidor de desarrollo con el mismo marcado y las mismas
   clases de la primitiva.
4. Si el usuario dice que un color «no se ve», medir los píxeles de su
   captura antes de cambiar nada. Así se supo que el borde sí era `#222755` y
   que el problema era de percepción, no de despliegue.

## Qué NO hacer

- No usar un componente sin comprobar que existe, ni importar uno inventado.
- No armar a mano un botón, campo, aviso, pastilla, spinner, tarjeta, tabla o
  modal dentro de una feature: si falta, se crea en `components/ui` (Regla 1).
- No reemplazar estados ni colores de una primitiva desde la pantalla.
- No escribir hex, colores de paleta (`slate-500`) ni valores arbitrarios
  fuera de `globals.css`.
- No usar opacidad para hover o deshabilitado: hover = token `*-hover` o
  `primary`; deshabilitado = `sunk` + `ink-3`.
- No usar un color de estado como decoración o serie de gráfico.
- No editar a mano la documentación del manual en Figma: se regenera.

## Skills relacionados

- `hitguest-standards`: reglas transversales (verificación real, no
  sobreingeniería, mantener los skills al día).
- `hitguest-add-feature` / `hitguest-add-feature-tdd`: el flujo de una
  feature; la parte de UI sigue este skill.
