#!/usr/bin/env node

/**
 * Gate incremental del sistema visual de HitGuest.
 *
 * El baseline registra deuda heredada por archivo y regla. El check permite que
 * esa deuda disminuya, pero falla si aumenta. Cuando la migración termine, el
 * baseline queda vacío y las mismas reglas pasan a ser absolutas sin cambiar el
 * flujo de CI.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const srcRoot = join(root, "src")
const baselinePath = join(root, "scripts", "design-system-baseline.json")
const writeBaseline = process.argv.includes("--write-baseline")

const PALETTE = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose"

/**
 * Únicos lugares donde un color escrito es legítimo, y por qué:
 * - components/brand: el color oficial de marcas ajenas (Airbnb, Booking…),
 *   que no es un token de HitGuest.
 * - lib/design-tokens.ts: espejo JS de globals.css para lo que no lee CSS
 *   (Stripe); su prueba falla si se desalinea.
 */
const UI_ONLY = (path) => path.startsWith("src/components/ui/") || path.startsWith("src/components/brand/")
const COLOR_EXCEPTIONS = (path) => path.startsWith("src/components/brand/") || path === "src/lib/design-tokens.ts"

const rules = [
    {
        id: "tailwind-palette-color",
        description: "usa un color de paleta en vez de un token semántico",
        pattern: new RegExp(`\\b(?:text|bg|border|ring|outline|fill|stroke|shadow)-(?:${PALETTE})-(?:950|900|800|700|600|500|400|300|200|100|50)(?:/[0-9]+)?(?![\\w-])`, "g"),
        ignore: COLOR_EXCEPTIONS,
    },
    {
        id: "arbitrary-color",
        description: "usa un color arbitrario en una utilidad Tailwind",
        pattern: /\b(?:text|bg|border|ring|outline|fill|stroke|shadow)-\[(?:#|rgb|rgba|hsl|hsla|oklch|var\()[^\]]+\]/g,
        ignore: COLOR_EXCEPTIONS,
    },
    {
        id: "raw-color-literal",
        description: "inyecta un color hexadecimal directamente en código de interfaz",
        pattern: /#[0-9a-fA-F]{3,8}\b/g,
        ignore: COLOR_EXCEPTIONS,
    },
    {
        id: "arbitrary-type-size",
        description: "usa un tamaño tipográfico fuera de la escala",
        pattern: /\btext-\[(?!#|rgb|hsl|oklch|var\()[^\]]+\]/g,
    },
    {
        id: "arbitrary-radius",
        description: "usa un radio fuera de la escala",
        pattern: /\brounded-\[(?!inherit\])[^\]]+\]/g,
    },
    {
        id: "arbitrary-shadow",
        description: "usa una sombra fuera de la escala",
        pattern: /\bshadow-\[[^\]]+\]/g,
    },
    {
        id: "gradient",
        description: "usa un gradiente fuera del lenguaje visual",
        pattern: /\bbg-gradient-[\w-]+/g,
    },
    {
        // El morado y el azul de marca son para logo e ilustración. Como texto o
        // como relleno de un control con texto no llegan a AA (brand-purple con
        // blanco da 4,42:1): la interacción va con primary / secondary.
        id: "brand-color-interaction",
        description: "usa un color de marca como interacción; la interacción va con primary o secondary",
        pattern: /(?<![\w-])(?:text|bg|border|ring|outline|fill|stroke|decoration|divide)-brand-(?:purple|blue)(?:\/[0-9]+)?(?![\w-])/g,
        ignore: (path) => path === "src/components/ui/Logo.tsx" || path.startsWith("src/components/brand/"),
    },
    {
        id: "arbitrary-font",
        description: "usa una fuente fuera de los tokens tipográficos",
        pattern: /\bfont-\[[^\]]+\]/g,
    },
    {
        id: "native-control",
        description: "crea un control nativo fuera de components/ui",
        pattern: /<(?:button|input|textarea|select)\b/g,
        input: "elements",
        ignore: (path) => path.startsWith("src/components/ui/") || path.endsWith(".test.tsx"),
    },
    {
        id: "native-label",
        description: "crea un label local en vez de la primitiva Label",
        pattern: /<label\b/g,
        input: "elements",
        ignore: (path) => path.startsWith("src/components/ui/") || path.endsWith(".test.tsx"),
    },
    {
        // Una tinta con opacidad (`text-ink/60`) cae por debajo de AA según el
        // fondo: el texto usa el paso de la escala (ink-2, ink-3) a opacidad
        // completa. `text-white/N` sobre superficies oscuras sí se permite.
        id: "text-token-opacity",
        description: "baja la opacidad de una tinta; usa el paso de la escala (ink-2, ink-3)",
        pattern: /(?<![\w-])(?:text|placeholder)-(?:ink(?:-[234])?|muted-foreground|foreground|primary|secondary|success|warning|danger|info|brand-navy)\/[0-9]+(?![\w-])/g,
    },
    {
        id: "color-function-literal",
        description: "escribe un color con rgb()/hsl()/oklch() en código de interfaz",
        pattern: /\b(?:rgba?|hsla?|oklch)\(/g,
        ignore: COLOR_EXCEPTIONS,
    },
    {
        // `style={{ color: … }}` y similares esquivan las clases: el estilo
        // visual va en clases con tokens. Se permiten medidas dinámicas
        // (width, height, transform) y patrones decorativos (backgroundImage).
        id: "inline-visual-style",
        description: "pone color, tipografía, radio o sombra en `style` en vez de clases con tokens",
        pattern: /\b(?:color|backgroundColor|background|borderColor|fontSize|fontWeight|fontFamily|lineHeight|letterSpacing|borderRadius|boxShadow)\b/g,
        input: "styles",
        ignore: COLOR_EXCEPTIONS,
    },
    {
        // Cuatro radios (decisión 2026-11-11): md controles, lg avisos y piezas
        // dentro de tarjetas, xl tarjetas/tablas/diálogos, full pastillas y
        // avatares; xs para microcontroles. Sin `rounded` suelto, sm, 2xl, 3xl.
        id: "radius-scale",
        description: "usa un radio fuera de la escala (xs, md, lg, xl, full)",
        pattern: /(?<![\w-])rounded(?:-[trblse]{1,2})?(?:-(?:sm|2xl|3xl|4xl))?(?![\w-])/g,
        ignore: UI_ONLY,
    },
    {
        id: "shadow-scale",
        description: "usa una sombra alta fuera de un overlay (lg, xl, 2xl)",
        pattern: /(?<![\w-])shadow-(?:lg|xl|2xl)(?![\w/-])/g,
        ignore: UI_ONLY,
    },
    {
        id: "arbitrary-length",
        description: "usa una medida en px/rem fuera de la escala de espaciado (`w-45`, no `w-[180px]`)",
        pattern: /-\[[0-9.]+(?:px|rem|em)\]/g,
        ignore: UI_ONLY,
    },
    {
        id: "font-weight-scale",
        description: "usa un peso fuera de la escala (medium, semibold, bold)",
        pattern: /(?<![\w-])font-(?:black|extrabold|thin|extralight|light)(?![\w-])/g,
        ignore: UI_ONLY,
    },
    {
        // La interfaz va en caso de oración. Las mayúsculas solo existen en la
        // primitiva Overline (rótulos de grupo de navegación).
        id: "uppercase-text",
        description: "pone texto en mayúsculas; usa caso de oración o la primitiva Overline",
        // El tracking de la escala sí se permite (dígitos de un código de acceso).
        pattern: /(?<![\w-])(?:uppercase|tracking-\[[^\]]+\])(?![\w-])/g,
        ignore: UI_ONLY,
    },
    {
        // Fondo, borde, radio, sombra, anillo y foco de un campo son de la
        // primitiva (borde 3:1, hover y foco comunes). Desde la pantalla solo
        // layout: alto de densidad, ancho, relleno para un ícono.
        id: "primitive-override",
        description: "pisa la apariencia de un control (Input, Textarea, SelectTrigger, PhoneInputField, Switch, Checkbox); solo se permite layout",
        pattern: /(?<![\w-])(?:[a-z-]+:)*(?:bg|border|rounded|shadow|ring|outline)(?:-[\w/\[\].%-]+)?(?![\w-])/g,
        input: "fieldClasses",
        // Las primitivas que componen otras (PhoneInputField sobre Input) sí ajustan.
        ignore: (path) => path.startsWith("src/components/ui/"),
    },
    {
        // Color, forma, alto, relleno, tipografía y transición de un botón son
        // de su variante y su tamaño. Desde la pantalla solo layout: ancho,
        // márgenes, posición, alineación del contenido, visibilidad.
        id: "button-override",
        description: "pisa la apariencia de un Button; elige variant/size (solo se permite layout)",
        pattern: /(?<![\w-])(?:[a-z-]+:)*(?:bg|border|rounded|shadow|ring|outline|font|h|min-h|max-h|size|p|px|py|pt|pb|pl|pr|gap|transition|duration|opacity|leading|tracking|decoration|underline)(?:-[\w/\[\].%()-]+)?(?![\w-])|(?<![\w-])(?:[a-z-]+:)*text-(?!left\b|center\b|right\b|wrap\b|nowrap\b)[\w/\[\].-]+/g,
        input: "buttonClasses",
        ignore: UI_ONLY,
    },
    {
        // Las pestañas traen forma, color, densidad y el estado activo (morado de
        // selección) de la primitiva. Desde la pantalla solo layout: grilla,
        // columnas, ancho, márgenes. La densidad va por `TabsList size="sm"`.
        id: "tabs-override",
        description: "pisa la apariencia de un TabsList o TabsTrigger; usa la primitiva (size=\"sm\" para densidad) y solo layout",
        pattern: /(?<![\w-])(?:[a-z-]+:)*(?:bg|border|rounded|shadow|ring|outline|font|h|min-h|max-h|size|p|px|py|pt|pb|pl|pr|gap|transition|duration|opacity|leading|tracking|decoration|underline)(?:-[\w/\[\].%()-]+)?(?![\w-])|(?<![\w-])(?:[a-z-]+:)*text-(?!left\b|center\b|right\b|wrap\b|nowrap\b)[\w/\[\].-]+/g,
        input: "tabsClasses",
        ignore: UI_ONLY,
    },
    {
        // Badge (etiqueta) y StatusPill (estado) traen forma y color por `tone`.
        id: "label-override",
        description: "pisa la apariencia de un Badge, StatusPill, Avatar o IconBadge; elige `tone`/`size` (solo se permite layout)",
        pattern: /(?<![\w-])(?:[a-z-]+:)*(?:bg|border|rounded|shadow|ring|outline|font|h|min-h|max-h|size|p|px|py|pt|pb|pl|pr|gap|transition|duration|opacity|leading|tracking|decoration|underline)(?:-[\w/\[\].%()-]+)?(?![\w-])|(?<![\w-])(?:[a-z-]+:)*text-(?!left\b|center\b|right\b|wrap\b|nowrap\b)[\w/\[\].-]+/g,
        input: "labelClasses",
        ignore: UI_ONLY,
    },
    {
        // Una pastilla armada a mano (texto xs, radio, relleno y fondo de estado)
        // es un Badge o un StatusPill que esquiva la primitiva.
        id: "handmade-pill",
        description: "arma una pastilla a mano; usa Badge (etiqueta) o StatusPill (estado)",
        pattern: /^.+$/gm,
        input: "pillElements",
        ignore: UI_ONLY,
    },
    {
        // Un pulsable con relleno sólido ES un botón: va con Button y su variante
        // (un enlace, con `Button asChild`). La navegación lateral es la única
        // excepción: su ítem activo es un estado de navegación, no una acción.
        id: "pressable-fill",
        description: "rellena un UnstyledButton, Link o <a> como si fuera un botón; usa Button (asChild para enlaces)",
        pattern: /(?<![\w-])(?:[a-z-]+:)*bg-(?:primary|secondary|success|destructive|danger|warning|info|ink|black|brand-[a-z]+)(?![\w/-])/g,
        input: "pressableClasses",
        ignore: (path) => UI_ONLY(path) || path === "src/components/layout/Sidebar.tsx",
    },
    {
        // Un ícono se pinta con la primitiva Icon (escala de tamaños, trazo y
        // aria-hidden comunes): `<Icon icon={Mail} />`, nunca `<Mail />`.
        id: "icon-direct",
        description: "pinta un ícono de lucide directamente; usa <Icon icon={…} size=…>",
        pattern: /^.+$/gm,
        input: "lucideElements",
        ignore: UI_ONLY,
    },
    {
        // El tamaño de un ícono es su `size` (xs…4xl), no una clase.
        id: "icon-size-override",
        description: "da tamaño a un Icon con clases; usa la prop size de la escala",
        pattern: /(?<![\w-])(?:[a-z-]+:)*(?:h|w|size|min-h|min-w|max-h|max-w)-[\w.\[\]/-]+(?![\w-])/g,
        input: "iconClasses",
        ignore: UI_ONLY,
    },
    {
        // Un solo juego de tokens (DS-7a): los nombres de shadcn tenían otros
        // valores (#71717a frente a ink-3, #C81E1E frente a danger) y dejaban dos
        // grises y dos rojos. En globals.css quedan como alias de los HIT para
        // librerías de terceros; el código usa ink/sunk/rule/danger. `dark:` se
        // ignora: el tema oscuro es infraestructura sin contrato todavía.
        id: "legacy-token",
        description: "usa un token heredado de shadcn; usa ink-3, ink, sunk, rule o danger",
        pattern: /(?<=^|[\s"'`])(?:(?!dark:)[^\s:"'`]+:)*(?:text-(?:muted-foreground|foreground|popover-foreground|card-foreground|accent-foreground|destructive)|bg-(?:muted|foreground|border)|border-(?:border|destructive)|ring-destructive)(?:\/\d+)?(?![\w-])/gm,
    },
    {
        // Un título es `Heading` (escala cerrada de cinco tamaños y tres tonos) y
        // el de la pantalla, `PageHeader` (DS-7b). Había 95 títulos nativos con 35
        // combinaciones de tamaño y peso, y seis pantallas sin h1.
        id: "heading-direct",
        description: "usa un título nativo (<h1>…<h4>); usa Heading o PageHeader",
        pattern: /<h[1-6]\b/g,
        input: "elements",
        ignore: UI_ONLY,
    },
    {
        id: "heading-override",
        description: "pisa la tipografía o el color de un Heading; elige size/tone (solo se permite layout)",
        pattern: /(?<![\w-])(?:[a-z-]+:)*(?:font|leading|tracking|drop-shadow)(?:-[\w/\[\].-]+)?(?![\w-])|(?<![\w-])(?:[a-z-]+:)*text-(?!left\b|center\b|right\b|wrap\b|nowrap\b|balance\b|pretty\b|ellipsis\b|clip\b)[\w/\[\].-]+/g,
        input: "headingClasses",
        ignore: UI_ONLY,
    },
    {
        // DS-7c: había 32 avisos a mano en 22 variantes (radio xl o lg, borde al
        // /20 o al /30, siete rellenos). `FeedbackBanner` trae tono, ícono, título,
        // acción, densidad, `layout="bar"` y cómo se anuncia.
        id: "handmade-notice",
        description: "arma un aviso a mano (fondo de estado + borde); usa FeedbackBanner",
        pattern: /^.+$/gm,
        input: "noticeElements",
        ignore: UI_ONLY,
    },
    {
        // DS-7c: 47 tarjetas copiaban la superficie a mano. `Surface` es la
        // superficie sola; `Card`/`SectionCard`, con encabezado y cuerpo.
        id: "handmade-card",
        description: "copia la superficie de tarjeta a mano; usa Surface, Card o SectionCard",
        pattern: /^.+$/gm,
        input: "cardElements",
        ignore: UI_ONLY,
    },
    {
        // DS-7d: un spinner es `Button loading` (acción), `LoadingState` (carga,
        // en bloque o en línea), `RefreshIndicator` (datos ya en pantalla) o
        // `Spinner` (el indicador solo). Había 93 armados con <Icon animate-spin>.
        id: "handmade-spinner",
        description: "gira un Icon a mano; usa Button loading, LoadingState, RefreshIndicator o Spinner",
        pattern: /(?<![\w-])(?:[a-z-]+:)*animate-spin(?![\w-])/g,
        input: "iconClasses",
        ignore: UI_ONLY,
    },
    {
        id: "handmade-skeleton",
        description: "arma un skeleton a mano (bloque gris con animate-pulse); usa Skeleton",
        pattern: /^.+$/gm,
        input: "skeletonElements",
        ignore: UI_ONLY,
    },
    {
        // DS-7e: un enlace que se pinta como acción («Regístrate aquí») es
        // `Button variant="link" asChild`; un dato que navega, `TextLink`.
        id: "text-link",
        description: "pinta un Link/<a> como acción (color o subrayado); usa Button variant=\"link\" asChild o TextLink",
        pattern: /(?<=^|[\s"'`])(?:text-(?:primary|secondary|danger)|underline)(?![\w/-])/gm,
        input: "linkClasses",
        ignore: (path) => UI_ONLY(path) || path === "src/components/layout/Sidebar.tsx",
    },
    {
        // Un UnstyledButton con texto subrayado, rojo o azul es un Button
        // (`link`, `ghost-destructive`). El morado sí se permite: marca la opción
        // elegida en tarjetas y chips seleccionables.
        id: "text-action",
        description: "pinta un UnstyledButton como acción de texto; usa Button (link, ghost, ghost-destructive)",
        pattern: /(?<=^|[\s"'`])(?:text-(?:secondary|danger)|underline)(?![\w/-])/gm,
        input: "unstyledClasses",
        ignore: UI_ONLY,
    },
    {
        // DS-7e: 32 errores de campo a mano en tres variantes. `FieldError`
        // (o `FormMessage` con react-hook-form) los pinta igual.
        id: "handmade-field-error",
        description: "pinta un texto de error a mano; usa FieldError (o FormMessage con react-hook-form)",
        pattern: /^.+$/gm,
        input: "fieldErrorElements",
        ignore: UI_ONLY,
    },
    {
        // DS-7f: había 16 opacidades distintas. Escala: 5, 10, 20, 30, 50, 70, 80
        // (y 0/100 en `opacity-`). 5–10 tintes de selección, 20–30 bordes de
        // estado, 50 superficies hundidas y hover, 70–80 texto y vidrio sobre
        // oscuro.
        id: "opacity-scale",
        description: "usa una opacidad fuera de la escala (5, 10, 20, 30, 50, 70, 80)",
        pattern: /(?<![\w/-])(?:[a-z-]+:)*(?:(?:bg|border|text|ring|outline|divide|from|to|shadow|fill|stroke)-[a-z][a-z0-9-]*\/(?!(?:5|10|20|30|50|70|80)(?![\w%]))\d+|opacity-(?!(?:0|5|10|20|30|50|70|80|100)(?!\w))\d+)(?![\w%])/g,
        ignore: UI_ONLY,
    },
    {
        // La escala de texto llega a 3xl (manual §3): una cifra protagonista
        // también. Más grande es un tamaño de display que el sistema no tiene.
        id: "type-scale-max",
        description: "usa un texto mayor que 3xl; la escala termina en text-3xl",
        pattern: /(?<![\w-])(?:[a-z-]+:)*text-[4-9]xl(?![\w-])/g,
        ignore: UI_ONLY,
    },
    {
        // DS-7f: una tabla es `Table` (o `DataTable` para ordenar y paginar): el
        // encabezado, el separador y el hover de fila son del sistema.
        id: "native-table",
        description: "usa una tabla nativa (<table>, <tr>, <td>…); usa Table o DataTable",
        pattern: /<(?:table|thead|tbody|tfoot|tr|th|td)(?=\s|$)/gm,
        input: "elements",
        ignore: UI_ONLY,
    },
    {
        // DS-7f: el visor de documentos era una capa `fixed inset-0` sin foco
        // atrapado, sin Esc y sin devolver el foco. Un modal es Dialog o Sheet.
        id: "handmade-overlay",
        description: "arma una capa modal a mano (fixed inset-0); usa Dialog, AlertDialog o Sheet",
        pattern: /^.+$/gm,
        input: "overlayElements",
        ignore: UI_ONLY,
    },
    {
        // DS-7f: el círculo o recuadro con un ícono estaba a mano 21 veces, con
        // cinco tamaños y bordes distintos.
        id: "handmade-icon-badge",
        description: "centra un ícono en una forma con fondo a mano; usa IconBadge",
        pattern: /^.+$/gm,
        input: "iconBadgeElements",
        ignore: UI_ONLY,
    },
    {
        // DS-8a: cinco interruptores quedaron sin nombre porque su título era un
        // `span` o un Label sin `htmlFor`. La fila «título + texto + interruptor»
        // es `SwitchField`; un interruptor suelto lleva `aria-label`.
        id: "unnamed-switch",
        description: "deja un Switch sin nombre accesible; usa SwitchField (título, texto y error unidos) o aria-label",
        pattern: /^.+$/gm,
        input: "unnamedSwitchElements",
        ignore: UI_ONLY,
    },
    {
        // `white` no tiene tono numérico y escapaba a `tailwind-palette-color`. La
        // superficie es el token `card` (hoy también #ffffff): si cambia, cambia
        // en todas partes. `text-white` y `bg-white/NN` sobre oscuro sí se permiten.
        id: "surface-white",
        description: "usa bg-white como superficie; la superficie es bg-card",
        pattern: /(?<![\w-])(?:[a-z-]+:)*bg-white(?![\w/-])/g,
        // La regla no puede ver sobre qué fondo está el blanco. Única excepción
        // conocida: el nodo «Registrada» de la línea de tiempo de la garantía,
        // un punto blanco sobre la tarjeta navy (GuaranteeInfoCard). Si aparece
        // otra, se agrega acá con su motivo; no se cambia el token para callar la regla.
        ignore: (path) => COLOR_EXCEPTIONS(path) || path === "src/features/checkin/components/GuaranteeInfoCard.tsx",
    },
    {
        // DS-8b: la barra fija al pie del portal estaba copiada 13 veces con tres
        // variantes. Es `BottomBar`.
        id: "handmade-bottom-bar",
        description: "arma la barra fija al pie a mano (fixed + bottom-0); usa BottomBar",
        pattern: /^(?=.*(?<![\w-])fixed(?![\w-]))(?=.*(?<![\w-])bottom-0(?![\w-])).*$/gm,
        ignore: UI_ONLY,
    },
    {
        // Un enlace redondo con solo un ícono es un botón de ícono: `Button
        // size="icon" asChild` sobre el Link (y con `aria-label`, que un ícono no da nombre).
        id: "link-icon-button",
        description: "pinta un Link/<a> como botón de ícono (rounded-full); usa Button size=\"icon\" asChild con aria-label",
        pattern: /(?<![\w-])rounded-full(?![\w-])/g,
        input: "linkClasses",
        ignore: UI_ONLY,
    },
    {
        // Pista `sunk` fina y a todo el ancho con un relleno adentro: es `Progress`
        // (role=progressbar y nombre obligatorio).
        id: "handmade-progress",
        description: "arma una barra de progreso a mano (h-1…3 w-full rounded-full bg-sunk); usa Progress",
        pattern: /^.+$/gm,
        input: "progressElements",
        ignore: UI_ONLY,
    },
    {
        // `<details>` a mano esconde el marcador nativo de siete formas; `Disclosure`
        // trae botón, flecha, foco y aria-expanded.
        id: "native-disclosure",
        description: "usa <details>/<summary> fuera de components/ui; usa Disclosure",
        pattern: /<(?:details|summary)\b/g,
        input: "elements",
        ignore: UI_ONLY,
    },
    {
        // DS-8c: la superficie es de la primitiva (`tone`, `interactive`, `dashed`,
        // `flat`, `floating`). Desde la pantalla solo layout: relleno, overflow, grilla.
        id: "surface-override",
        description: "pisa la superficie de un Card, Surface o SectionCard; elige tone/interactive/dashed/flat (solo se permite layout)",
        // Layout que sí se permite: un divisor (`border-t`, `border-b-0`) y un radio
        // recortado contra un borde (`rounded-t-none`). Opacidad y escala no son layout.
        pattern: /(?<![\w-])(?:[a-z-]+:)*(?!border-[trblxy](?:-\d+)?(?![\w-]))(?!rounded-(?:[trbl]|tl|tr|bl|br)-none(?![\w-]))(?:bg|border|rounded|shadow|ring|outline|backdrop-blur|opacity|scale)(?:-[\w/\[\].%-]+)?(?![\w-])/g,
        input: "surfaceClasses",
        ignore: UI_ONLY,
    },
    {
        // DS-8c: el título de un diálogo o cajón es el de la primitiva; `CardTitle`
        // (un div sin semántica) se retiró: el título de una tarjeta es `Heading`.
        id: "title-override",
        description: "pisa la tipografía de un DialogTitle, SheetTitle o AlertDialogTitle (solo se permite layout)",
        pattern: /(?<![\w-])(?:[a-z-]+:)*(?:font|leading|tracking|uppercase|italic|line-clamp)(?:-[\w/\[\].-]+)?(?![\w-])|(?<![\w-])(?:[a-z-]+:)*text-(?!left\b|center\b|right\b|start\b|end\b|justify\b|wrap\b|nowrap\b|balance\b|pretty\b|ellipsis\b|clip\b)[\w/\[\].-]+/g,
        input: "titleClasses",
        ignore: UI_ONLY,
    },
    {
        // DS-8c: una cifra grande y bold con dígitos tabulares o tracking es `Figure`
        // (Gabarito, §3). Fuera del radar: una cifra sin ninguna de esas dos marcas.
        id: "handmade-figure",
        description: "arma una cifra protagonista a mano (text-2xl/3xl bold); usa Figure",
        pattern: /^.+$/gm,
        input: "figureElements",
        ignore: UI_ONLY,
    },
    {
        // DS-8c: un término con su definición es `DefinitionItem` (ícono dentro del dt,
        // definición alineada). El `<dl>` y su layout sí los pone la pantalla.
        id: "native-definition",
        description: "arma un dt/dd a mano; usa DefinitionItem dentro del <dl>",
        pattern: /<(?:dt|dd)\b/g,
        input: "elements",
        ignore: UI_ONLY,
    },
    {
        // DS-8d: 23 notas a mano en 14 combinaciones (más 7 en tinte morado). `Note`
        // trae tono, densidad e ícono; no es un aviso (eso es `FeedbackBanner`).
        id: "handmade-note",
        description: "arma una nota a mano (caja sunk o primary/5 con texto xs/sm); usa Note",
        pattern: /^.+$/gm,
        input: "noteElements",
        ignore: UI_ONLY,
    },
    {
        // DS-8d: el panel hundido que agrupa contenido dentro de una tarjeta es
        // `Surface tone="sunk"` (y el hueco punteado, `Surface dashed`).
        id: "handmade-sunk-surface",
        description: "arma un panel hundido a mano (bg-sunk + borde + rounded-xl); usa Surface tone=\"sunk\"",
        pattern: /^.+$/gm,
        input: "sunkSurfaceElements",
        ignore: UI_ONLY,
    },
    {
        id: "nonstandard-icon-library",
        description: "importa iconos fuera de lucide-react o las primitivas de marca",
        pattern: /^(?:react-icons|@heroicons|phosphor-react|@mui\/icons-material)/g,
        input: "imports",
    },
]

function filesUnder(dir) {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name)
        return statSync(path).isDirectory() ? filesUnder(path) : [path]
    })
}

function inspect() {
    const result = {}
    const files = filesUnder(srcRoot).filter(
        // Fuera: pruebas y las copias de Finder («Archivo 2.tsx»), que .gitignore
        // ya excluye y no son código del proyecto.
        (path) => /\.(?:ts|tsx)$/.test(path) && !/\.(?:test|spec)\.(?:ts|tsx)$/.test(path) && !/ \d+\.(?:ts|tsx)$/.test(path),
    )
    for (const absolute of files) {
        const path = relative(root, absolute).replaceAll("\\", "/")
        const source = readFileSync(absolute, "utf8")
        const sourceFile = ts.createSourceFile(
            path,
            source,
            ts.ScriptTarget.Latest,
            true,
            path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        )
        const strings = []
        const elements = []
        const imports = []
        const styles = []
        const fieldClasses = []
        const lucideElements = []
        const iconClasses = []
        const buttonClasses = []
        const pressableClasses = []
        const linkClasses = []
        const unstyledClasses = []
        const labelClasses = []
        const tabsClasses = []
        const headingClasses = []
        const pillElements = []
        const noticeElements = []
        const cardElements = []
        const skeletonElements = []
        const fieldErrorElements = []
        const overlayElements = []
        const iconBadgeElements = []
        const unnamedSwitchElements = []
        const progressElements = []
        const surfaceClasses = []
        const titleClasses = []
        const figureElements = []
        const noteElements = []
        const sunkSurfaceElements = []
        const lucideNames = new Set()
        for (const statement of sourceFile.statements) {
            if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)
                && statement.moduleSpecifier.text === "lucide-react") {
                const bindings = statement.importClause?.namedBindings
                if (bindings && ts.isNamedImports(bindings)) for (const el of bindings.elements) lucideNames.add(el.name.text)
            }
        }
        const classTexts = (node) => {
            const texts = []
            for (const attr of node.attributes.properties) {
                if (!ts.isJsxAttribute(attr) || attr.name.getText(sourceFile) !== "className" || !attr.initializer) continue
                const init = attr.initializer
                if (ts.isStringLiteral(init)) texts.push(init.text)
                else if (ts.isJsxExpression(init) && init.expression) {
                    // Todos los literales del `className`, también dentro de cn(…) y ternarios.
                    const collect = (n) => {
                        if (ts.isStringLiteralLike(n) || ts.isNoSubstitutionTemplateLiteral(n)) texts.push(n.text)
                        else if (ts.isTemplateExpression(n)) texts.push(n.head.text, ...n.templateSpans.map((sp) => sp.literal.text))
                        ts.forEachChild(n, collect)
                    }
                    collect(init.expression)
                }
            }
            return texts
        }

        function visit(node) {
            if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
                strings.push(node.text)
            }
            // Los trozos fijos de un template con variables (`text-x ${y}`) también
            // son clases: sin esto se escapaban del control.
            if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
                strings.push(node.text)
            }
            if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
                const tag = node.tagName.getText(sourceFile)
                if (/^[a-z]/.test(tag)) elements.push(`<${tag}`)
            }
            // `className` de los campos: su apariencia es de la primitiva.
            if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
                && /^(?:Input|Textarea|SelectTrigger|PhoneInputField|Switch|Checkbox)$/.test(node.tagName.getText(sourceFile))) {
                for (const attr of node.attributes.properties) {
                    if (!ts.isJsxAttribute(attr) || attr.name.getText(sourceFile) !== "className" || !attr.initializer) continue
                    const init = attr.initializer
                    if (ts.isStringLiteral(init)) fieldClasses.push(init.text)
                    else if (ts.isJsxExpression(init) && init.expression) {
                        const e = init.expression
                        if (ts.isStringLiteralLike(e) || ts.isNoSubstitutionTemplateLiteral(e)) fieldClasses.push(e.text)
                        else if (ts.isTemplateExpression(e)) fieldClasses.push(e.head.text, ...e.templateSpans.map((sp) => sp.literal.text))
                    }
                }
            }
            if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
                const tag = node.tagName.getText(sourceFile)
                // Un componente de lucide importado, o uno elegido por dato (`<item.icon />`).
                if (lucideNames.has(tag) || /\.icon$/i.test(tag)) lucideElements.push(`<${tag}>`)
                if (tag === "Icon") iconClasses.push(...classTexts(node))
                if (tag === "Button") buttonClasses.push(...classTexts(node))
                // Un Switch sin nombre: un lector de pantalla dice solo «interruptor».
                // El nombre llega por `id` (un Label con htmlFor, o SwitchField) o por aria-label.
                // También lo nombra un `FormControl` (inyecta el id del FormLabel) o un
                // `Label` que lo envuelve. Un spread (`{...field}`) puede traer el id:
                // no se afirma nada. Lo que no se puede ver: que exista el `Label
                // htmlFor` del `id` dado.
                if (tag === "Switch") {
                    const attrs = node.attributes.properties
                    const names = attrs.filter((a) => ts.isJsxAttribute(a)).map((a) => a.name.getText(sourceFile))
                    const hasSpread = attrs.some((a) => ts.isJsxSpreadAttribute(a))
                    let parent = node.parent
                    while (parent && !ts.isJsxElement(parent)) parent = parent.parent
                    const wrapper = parent && ts.isJsxElement(parent) ? parent.openingElement.tagName.getText(sourceFile) : ""
                    const named = names.some((n) => /^(?:id|aria-label|aria-labelledby)$/.test(n)) || hasSpread || /^(?:FormControl|Label|label)$/.test(wrapper)
                    if (!named) unnamedSwitchElements.push("<Switch>")
                }
                if (tag === "UnstyledButton" || tag === "Link" || tag === "a") pressableClasses.push(...classTexts(node))
                if (tag === "Link" || tag === "a") linkClasses.push(...classTexts(node))
                if (tag === "UnstyledButton") unstyledClasses.push(...classTexts(node))
                if (tag === "Badge" || tag === "StatusPill") labelClasses.push(...classTexts(node))
                if (tag === "Heading") headingClasses.push(...classTexts(node))
                if (tag === "TabsList" || tag === "TabsTrigger") tabsClasses.push(...classTexts(node))
                if (tag === "Avatar" || tag === "AvatarFallback" || tag === "IconBadge") labelClasses.push(...classTexts(node))
                if (tag === "Card" || tag === "Surface" || tag === "SectionCard") surfaceClasses.push(...classTexts(node))
                if (tag === "DialogTitle" || tag === "SheetTitle" || tag === "AlertDialogTitle") titleClasses.push(...classTexts(node))
                if (/^(?:div|p|span|section|aside|li|article|header|form|dd|dt|strong)$/.test(tag)) {
                    const joined = ` ${classTexts(node).join(" ")} `
                    // Aviso: fondo de estado pleno (sin opacidad) con borde. Las filas
                    // que solo se tiñen (`bg-danger-sunk/40`) son estado de fila, no aviso.
                    if (/\sbg-(?:(?:success|warning|danger|info)-sunk|(?:success|warning|danger|info|destructive)\/\d+)\s/.test(joined) && /\sborder(?:-[a-z]+\/\d+)?\s/.test(joined)
                        && !/\srounded-full\s/.test(joined)) {
                        noticeElements.push(`<${tag} class="${joined.trim().slice(0, 60)}">`)
                    }
                    // Error de campo: texto chico en rojo, sin fondo de aviso.
                    if ((tag === "p" || tag === "span") && /\stext-danger\s/.test(joined) && /\stext-(?:xs|sm)\s/.test(joined)
                        && !/\sbg-/.test(joined)) {
                        fieldErrorElements.push(`<${tag} class="${joined.trim().slice(0, 60)}">`)
                    }
                    // Capa a pantalla completa armada a mano (sin foco atrapado ni Esc).
                    if (/\sfixed\s/.test(joined) && /\sinset-0\s/.test(joined)) {
                        overlayElements.push(`<${tag} class="${joined.trim().slice(0, 60)}">`)
                    }
                    // Nota a mano: caja hundida (o tinte primary/5 con borde primary/20) con
                    // relleno y tamaño de texto propio. Es `Note`.
                    const sunkBox = /\sbg-sunk(?:\/\d+)?\s/.test(joined)
                    const accentBox = /\sbg-primary\/5\s/.test(joined) && /\sborder-primary\/20\s/.test(joined)
                    if ((sunkBox || accentBox) && /\srounded-(?:md|lg|xl)\s/.test(joined) && /\sp[xy]?-\d/.test(joined)
                        // Un documento renderizado (`prose`) es otra pieza: contenido, no nota.
                        && /^(?:p|div|span|ul|li)$/.test(tag) && /\stext-(?:xs|sm)\s/.test(joined) && !/\sprose\s/.test(joined)) {
                        noteElements.push(`<${tag} class="${joined.trim().slice(0, 60)}">`)
                    }
                    // Panel hundido a mano: superficie sunk con borde y relleno, sin tamaño de
                    // texto propio (agrupa contenido). Es `Surface tone="sunk"`.
                    // Un nodo que recibe foco por dentro (`focus-within:`) es el host de un campo
                    // ajeno (Stripe monta ahí su iframe): es un campo, no un panel, y no se envuelve.
                    if (sunkBox && /\srounded-xl\s/.test(joined) && /\sborder(?:-rule(?:\/\d+)?)?\s/.test(joined) && /\sp[xy]?-\d/.test(joined)
                        && /^(?:div|li|section|article)$/.test(tag) && !/\stext-(?:xs|sm|base)\s/.test(joined) && !/\sfocus-within:/.test(joined)) {
                        sunkSurfaceElements.push(`<${tag} class="${joined.trim().slice(0, 60)}">`)
                    }
                    // Cifra protagonista: grande, bold y con dígitos tabulares o tracking.
                    if (/^(?:p|span|div|dd|strong)$/.test(tag) && /\stext-(?:lg|2xl|3xl|4xl)\s/.test(joined) && /\sfont-(?:bold|semibold)\s/.test(joined)
                        && /\s(?:tabular-nums|tracking-tight|tracking-widest)\s/.test(joined)) {
                        figureElements.push(`<${tag} class="${joined.trim().slice(0, 60)}">`)
                    }
                    // Barra de progreso: pista sunk fina a todo el ancho.
                    if (tag === "div" && /\sw-full\s/.test(joined) && /\srounded-full\s/.test(joined) && /\sbg-sunk(?:\/\d+)?\s/.test(joined)
                        && /\sh-(?:1|1\.5|2|2\.5|3)\s/.test(joined)) {
                        progressElements.push(`<${tag} class="${joined.trim().slice(0, 60)}">`)
                    }
                    // Skeleton: bloque gris que pulsa.
                    if (/\sanimate-pulse\s/.test(joined) && /\sbg-(?:sunk|accent|muted|rule)(?:\/\d+)?\s/.test(joined)) {
                        skeletonElements.push(`<${tag} class="${joined.trim().slice(0, 60)}">`)
                    }
                    // Tarjeta: la superficie de `Surface` copiada a mano.
                    if (/\srounded-xl\s/.test(joined) && /\sborder(?:-rule)?\s/.test(joined) && /\sbg-(?:white|card)\s/.test(joined)
                        && !/\sborder-dashed\s/.test(joined)) {
                        cardElements.push(`<${tag} class="${joined.trim().slice(0, 60)}">`)
                    }
                }
                if (tag === "span" || tag === "div" || tag === "p") {
                    const joined = ` ${classTexts(node).join(" ")} `
                    if (/\stext-xs\s/.test(joined) && /\srounded-(?:full|md)\s/.test(joined) && /\spx-/.test(joined)
                        && /\sbg-(?:(?:success|warning|danger|info|neutral)-sunk|primary\/10|sunk|white)\s/.test(joined)) {
                        pillElements.push(`<${tag} class="${joined.trim().slice(0, 60)}">`)
                    }
                }
            }
            // Un ícono solo, centrado en una forma con fondo: es un IconBadge.
            if (ts.isJsxElement(node) && /^(?:div|span)$/.test(node.openingElement.tagName.getText(sourceFile))) {
                const joined = ` ${classTexts(node.openingElement).join(" ")} `
                const kids = node.children.filter((k) => !(ts.isJsxText(k) && !k.getText(sourceFile).trim()))
                const onlyGlyph = kids.length > 0 && kids.every((k) => ts.isJsxSelfClosingElement(k) && /^(?:Icon|Spinner)$/.test(k.tagName.getText(sourceFile)))
                // Dos formas de armarlo: con medida fija y centrado, o solo con relleno
                // alrededor del ícono (`p-3`), que lo centra por construcción.
                // Desde 32 px, donde empieza la escala de IconBadge; los nodos de una
                // línea de tiempo (26 px, la garantía) son otra pieza.
                const sized = /\sitems-center\s/.test(joined) && /\sjustify-center\s/.test(joined)
                    && /\s(?:size|h|w)-(?:8|9|10|11|12|14|16|20|24)\s/.test(joined)
                // `w-full` o `h-auto` no son una medida: solo exime una medida numérica.
                const padded = /\sp-(?:1\.5|2|2\.5|3|4)\s/.test(joined) && !/\s(?:size|h|w)-(?:\d|\[)/.test(joined)
                if (onlyGlyph && /\sbg-/.test(joined) && /\srounded-(?:full|xl|lg)\s/.test(joined) && (sized || padded)) {
                    iconBadgeElements.push(`<${node.openingElement.tagName.getText(sourceFile)} class="${joined.trim().slice(0, 60)}">`)
                }
            }
            // Claves de los objetos en `style={{…}}`.
            if (ts.isJsxAttribute(node) && node.name.getText(sourceFile) === "style" && node.initializer
                && ts.isJsxExpression(node.initializer) && node.initializer.expression
                && ts.isObjectLiteralExpression(node.initializer.expression)) {
                for (const prop of node.initializer.expression.properties) {
                    if (prop.name) styles.push(prop.name.getText(sourceFile).replace(/^["']|["']$/g, ""))
                }
            }
            if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
                imports.push(node.moduleSpecifier.text)
            }
            ts.forEachChild(node, visit)
        }
        visit(sourceFile)
        const inputs = {
            strings: strings.join("\n"),
            elements: elements.join("\n"),
            imports: imports.join("\n"),
            styles: styles.join("\n"),
            fieldClasses: fieldClasses.join("\n"),
            lucideElements: lucideElements.join("\n"),
            iconClasses: iconClasses.join("\n"),
            buttonClasses: buttonClasses.join("\n"),
            pressableClasses: pressableClasses.join("\n"),
            linkClasses: linkClasses.join("\n"),
            unstyledClasses: unstyledClasses.join("\n"),
            labelClasses: labelClasses.join("\n"),
            tabsClasses: tabsClasses.join("\n"),
            headingClasses: headingClasses.join("\n"),
            pillElements: pillElements.join("\n"),
            noticeElements: noticeElements.join("\n"),
            cardElements: cardElements.join("\n"),
            skeletonElements: skeletonElements.join("\n"),
            fieldErrorElements: fieldErrorElements.join("\n"),
            overlayElements: overlayElements.join("\n"),
            iconBadgeElements: iconBadgeElements.join("\n"),
            unnamedSwitchElements: unnamedSwitchElements.join("\n"),
            progressElements: progressElements.join("\n"),
            surfaceClasses: surfaceClasses.join("\n"),
            titleClasses: titleClasses.join("\n"),
            figureElements: figureElements.join("\n"),
            noteElements: noteElements.join("\n"),
            sunkSurfaceElements: sunkSurfaceElements.join("\n"),
        }
        for (const rule of rules) {
            if (rule.ignore?.(path)) continue
            const matches = inputs[rule.input ?? "strings"].match(rule.pattern) ?? []
            if (matches.length === 0) continue
            result[path] ??= {}
            result[path][rule.id] = matches.reduce((counts, match) => {
                counts[match] = (counts[match] ?? 0) + 1
                return counts
            }, {})
        }
    }
    return result
}

function totals(inventory) {
    const result = Object.fromEntries(rules.map((rule) => [rule.id, 0]))
    for (const file of Object.values(inventory)) {
        for (const [rule, matches] of Object.entries(file)) {
            result[rule] += Object.values(matches).reduce((sum, count) => sum + count, 0)
        }
    }
    return result
}

const current = inspect()

if (writeBaseline) {
    writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`)
    console.log(`design-system: baseline actualizado (${Object.keys(current).length} archivos).`)
    process.exit(0)
}

let baseline
try {
    baseline = JSON.parse(readFileSync(baselinePath, "utf8"))
} catch {
    console.error("design-system: falta scripts/design-system-baseline.json; créalo con --write-baseline.")
    process.exit(1)
}

const regressions = []
for (const [path, findings] of Object.entries(current)) {
    for (const [rule, matches] of Object.entries(findings)) {
        for (const [match, count] of Object.entries(matches)) {
            const before = baseline[path]?.[rule]?.[match] ?? 0
            if (count > before) regressions.push({ path, rule, match, before, count })
        }
    }
}

const currentTotals = totals(current)
const baselineTotals = totals(baseline)
const remaining = Object.values(currentTotals).reduce((sum, count) => sum + count, 0)
const removed = Object.keys(currentTotals).reduce(
    (sum, rule) => sum + Math.max(0, baselineTotals[rule] - currentTotals[rule]),
    0,
)

console.log(`design-system: ${remaining} usos heredados en ${Object.keys(current).length} archivos; ${removed} eliminados desde la línea base.`)

if (regressions.length === 0) process.exit(0)

console.error("Deuda visual nueva (no permitida):")
for (const item of regressions) {
    const description = rules.find((rule) => rule.id === item.rule)?.description ?? item.rule
    console.error(`  ${item.path}: ${item.rule} ${item.before} → ${item.count} · ${JSON.stringify(item.match)} (${description})`)
}
console.error("Usa tokens/primitivas existentes; no actualices el baseline para ocultar una regresión.")
process.exit(1)
