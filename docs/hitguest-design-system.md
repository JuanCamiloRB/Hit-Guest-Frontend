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
| `destructive` / `destructive-hover` | Acción destructiva, no mensajes de error |
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

Los valores hexadecimales solo se declaran en `globals.css`. Las marcas de
terceros pueden conservar su color oficial únicamente dentro del componente
compartido que las representa (`ChannelLogo`).

## 3. Tipografía

- **Gabarito (`font-sans`)**: títulos `h1`–`h4`, cifras protagonistas y marca.
- **Poppins (`font-secondary`)**: cuerpo, controles, tablas y metadatos.
- Escala permitida: utilidades Tailwind nombradas (`text-xs`, `text-sm`,
  `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`). No se agregan
  tamaños `text-[Npx]`.
- Pesos: `medium` para controles, `semibold` para énfasis y `bold` para títulos
  o cifras. Un párrafo completo no se presenta en bold.
- Cada pantalla tiene un solo `h1`; las secciones usan niveles consecutivos.

## 4. Espaciado, bordes y elevación

- Se usa la escala de espaciado de Tailwind; no se inventan valores arbitrarios
  para corregir una pantalla aislada.
- `rounded-xs`: casillas y microcontroles de 16 px.
- `rounded-md`: controles.
- `rounded-xl`: tarjetas, tablas, paneles y diálogos.
- `rounded-full`: avatar, indicador o pastilla; no contenedores generales.
- `border-input`: campos editables.
- `border-rule`: divisores y superficies.
- `shadow-xs`: control elevado.
- `shadow-sm`: tarjeta estándar.
- Sombra alta: solo overlays (`Dialog`, `AlertDialog`, `Sheet`).
- Las tablas y secciones de datos no llevan sombras decorativas.

No se permiten `rounded-[…]`, `shadow-[…]`, gradientes ni transformaciones de
escala en hover.

## 5. Componentes autorizados

| Necesidad | Componente |
|---|---|
| Acción | `Button` (`default`, `secondary`, `outline`, `ghost`, `link`, `destructive`) |
| Campo | `Input`, `Textarea`, `Select`, `PhoneInputField` |
| Etiqueta | `Label` asociada mediante `htmlFor`; texto auxiliar con `FormDescription` |
| Selección | `Checkbox`, `Switch`, `Tabs` |
| Superficie | `Card` o `SectionCard` |
| Modal | `Dialog`, `AlertDialog` o `Sheet` |
| Estado corto | `StatusPill` |
| Aviso | `FeedbackBanner` |
| Carga | `LoadingState`, `Skeleton`, `RefreshIndicator` o `Button loading` |
| Vacío | `EmptyState` (`empty` o `no-results`) |
| Tabla | `Table` para composición especial; `DataTable` para ordenar/paginar |
| Marca | `Logo`, `ChannelLogo`; iconos funcionales desde `lucide-react` |

No se crean botones, inputs, selects, textareas, avisos, spinners o pastillas a
mano dentro de una feature. Una excepción técnica debe quedar documentada junto
al código y no puede convertirse en un patrón visual alternativo.

## 6. Iconografía

- `lucide-react` es la biblioteca funcional única.
- Tamaño estándar: 16 px en controles, 20 px en navegación y 24 px en estados
  vacíos o mensajes destacados.
- Un icono decorativo lleva `aria-hidden`.
- Un botón que solo contiene un icono necesita nombre accesible y usa el tamaño
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

La migración termina cuando esa línea base llega a cero. Una excepción legítima
(por ejemplo, el color oficial de una OTA) se centraliza en una primitiva y se
documenta; no se aumenta silenciosamente la línea base.

Orden de migración:

1. primitivas y layout compartido;
2. Operaciones y Tablero;
3. Propiedades y configuración;
4. usuarios, soporte, billing e integraciones;
5. portal del huésped;
6. línea base en cero y gate estricto sin legado.
