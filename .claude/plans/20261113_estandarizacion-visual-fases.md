# Estandarización visual: lo que el gate no veía (2026-11-13)

`npm run design:check` en 0 significa que ninguna de sus reglas encuentra nada.
No significa que todo patrón repetido tenga primitiva: un inventario de las
composiciones de clases de los 174 archivos de pantalla (agrupadas por forma,
≥3 usos, sin las copias de Finder `Archivo 2.tsx`) encontró 13 huecos sin
regla ni componente. Este plan los cubre en cuatro fases. Cada fase termina
igual: primitiva con prueba, migración de TODOS los usos, regla nueva en
`scripts/check-design-system.mjs` para que no vuelva, y el contrato
(`docs/hitguest-design-system.md` §5 y §8) y el skill `hitguest-design-system`
al día.

**Cierre obligatorio de cada fase: auditoría de regresión** (pedido del
usuario, 2026-11-13). Una migración a primitivas no cambia comportamiento; hay
que demostrarlo, no afirmarlo:
1. `git diff -U0` de cada archivo migrado comparando handlers, `disabled`,
   `checked`, ids y textos visibles antes/después.
2. `grep` en `*.test.*` de los textos e ids que cambiaron.
3. Un revisor independiente (agente sin el contexto del autor) recibe el diff
   y la lista de riesgos concretos, nunca las conclusiones.
4. Lo que no se pudo ver en navegador se dice tal cual en el reporte.

Lo que el contrato sí permite y NO es hueco: texto secundario por utilidades
(`text-xs text-ink-3`, §3), divisores `border-t border-rule` (§2), opacidades
`/30 /50 /70` (DS-7f), y `Skeleton` con la forma real + `sr-only` «Cargando…»
(`PeriodActivity`).

Ruido local: ~75 copias de Finder (`* 2.tsx`, `* 3.ts`) en `src/`. Están en
`.gitignore`, fuera de `tsconfig`, de Vitest y del check; no se despliegan.
Al contar cualquier cosa con `grep`, excluir ` [0-9]\.tsx`.

## Fase 1 — accesibilidad y lo mecánico · HECHA 2026-11-13

| Hueco | Qué se hizo |
|---|---|
| 5 `Switch` sin nombre accesible; fila «título + texto + interruptor» armada de 4 formas | `ui/switch-field.tsx` (`SwitchField`, 6 pruebas). Migradas las 8 filas de ese tipo: `ConfigModal`, `AutomationOverrideModal`, `PropertiesUnits` ×5, `ReservationDialog`. Las 3 restantes (`AutomationCard`, `PropertyCard`, `AirbnbIcalPanel`) son un interruptor dentro de una fila con otro contenido y ya llevaban `aria-label`. Regla `unnamed-switch`; `Switch` y `Checkbox` entran en `primitive-override` |
| 19 cajas de ícono a mano (el collector exigía medida fija) | Collector de `handmade-icon-badge` acepta la forma «solo relleno» (`p-3`). Migradas las 19 a `IconBadge` (`SuccessScreen` ×4, `ContractRoutingSection`, `DocumentUpload`, `SecondaryGateScreen`, `VerifyScreen` ×3, `WelcomeScreen` ×2, `PropertiesAutomation` ×2, `PropertiesDocuments` ×2, `PropertyDocumentsCard`, `OperationsPanel`) y una a `EmptyState` (`GuestDocumentsCard`, que era un vacío). `IconBadge interactive` para la zona de carga que sigue el hover del contenedor |
| `bg-white` sólido ×16 (`white` no tiene tono numérico y escapaba a la regla de paleta) | → `bg-card` en 12 archivos. Regla `surface-white`. `text-white` y `bg-white/NN` sobre oscuro siguen permitidos |
| «Cargando...» como texto | `ListingOverridesPanel` → `LoadingState variant="inline" compact` |

Textos visibles que cambiaron (caso de oración, §3): «Estado del Alojamiento»
→ «Alojamiento activo»; «Heredar de Propiedad» → «Heredar de la propiedad».

Verificado: `design:check` 0, `tsc` 0, `lint:gate` sin errores nuevos, Vitest
de `ui`, `checkin`, `properties` y `reservations` (157 archivos, 1505 pruebas).
NO visto en navegador: las pantallas piden sesión de PM o una reserva.

**Auditoría de regresión (revisor independiente, 2026-11-13)** — 11 hallazgos,
0 de comportamiento. Corregidos: (1) `GuaranteeInfoCard:45` era un punto blanco
sobre navy, no una superficie: vuelve a `bg-white` y la regla lo exime por
archivo con motivo; (2) `SwitchField` pintaba la explicación de una fila
`tone="danger"` como error (`FieldHint invalid`): el tono solo tiñe la fila;
(3) `ListingOverridesPanel`: un `LoadingState` (región viva) por fila dentro de
un botón → `Spinner` decorativo + texto; (4) `unnamed-switch` daba falso
positivo con `FormControl`/`Label` envolvente/spread, y el collector de
`handmade-icon-badge` eximía por `w-full`. Pruebas añadidas: vacío de
`GuestDocumentsCard`, `SwitchField` con solo error / ícono en el título / tono
warning, nombre del interruptor en `AutomationOverrideModal`.
Cambios visuales intencionales que quedaron: tamaños de ícono a la escala
(32/44/64), `rounded-lg` y `font-medium` por contrato, íconos de fila de
documentos en tono neutro (coherencia Propiedades ↔ Reserva), tarjetitas
blancas con sombra de `WelcomeScreen` y CTA de `PropertiesAutomation` → tinte
`primary/10`. Pendiente de fase 4 (copy): el nombre del interruptor del
override cambia con su estado («Activa…»/«Desactivada…»); la forma correcta es
nombre estable + descripción. Límite conocido de `unnamed-switch`: un `id` sin
`Label htmlFor` pasa.

## Fase 2 — portal del huésped · HECHA 2026-11-13

| Hueco | Qué se hizo |
|---|---|
| Barra fija al pie: 13 copias en 10 pantallas (11 idénticas, `BOTTOM_BAR` en `WelcomeScreen`, y una sólida `z-40` en `SecondaryGuestFormScreen`) | `ui/bottom-bar.tsx` (`BottomBar`; `className` = layout del contenido). Migración con un script que busca el cierre por profundidad de `<div>`, no por regex. Regla `handmade-bottom-bar` |
| 7 enlaces «volver» como botón redondo, **sin nombre accesible** (solo un ícono) | `Button variant="ghost" size="icon" asChild` + `aria-label="Volver"` en el `Link`. Regla `link-icon-button` |
| Barras de progreso a mano: 4 del inventario + 1 que la regla destapó (`DocumentUpload`, clases en otro orden) | `ui/progress.tsx` (`Progress` sobre Radix: `role=progressbar`, `label` obligatorio, recorte a `[0,max]`, mínimo 2 px con avance). `checkin/ProgressBar` queda como composición (cuenta de pasos) sobre `Progress`. Regla `handmade-progress` |
| `details/summary` a mano: `GuaranteeInfoCard` ×7, `ContractRoutingSection` | `ui/disclosure.tsx` (`Disclosure` sobre Radix Collapsible: botón real, `aria-expanded`; `row` e `inline`). Regla `native-disclosure` |

Cambios intencionales: la barra de `SecondaryGuestFormScreen` pasa de sólida
`z-40` a vidrio `z-10` (nada vive entre 10 y 50 en el portal); la barra de
`TopNodesPanel` ya no cambia de color con el hover de la fila; la barra de
`DocumentUpload` pasa de `secondary` a `primary` como todas; la flecha del
plegable es `ChevronDown` que gira, no `ArrowRight`; cerrado, el contenido del
plegable no está en el DOM (Radix), así que las dos pruebas que lo leían
primero lo abren.

Verificado: `npm run verify` (tsc 0, lint:gate sin errores nuevos,
`design:check` 0, 216 archivos / 1904 pruebas) y `next build`. NO visto en
navegador: el portal pide una reserva.

**Auditoría de regresión (revisor independiente, 2026-11-13)** — 10 hallazgos.
Corregidos: (1) **bug** `TopNodesPanel`: el template del `label` perdió la
interpolación (el shell se comió `${node.name}`) y toda barra se llamaba
«:  ejecuciones»; (2) **a11y** `ProgressBar` decía «Paso 1 de 5» mientras la
pantalla muestra «Paso 2 de 6» (la barra cuenta pasos internos): nombre neutro
«Avance del check-in»; (3) **visual** `BottomBar` fijó la variante equivocada
de relleno (`p-4` afuera): el contenido medía 512 px contra los 480 del `main`
y el botón sobresalía 16 px por lado desde 544 px; `WelcomeScreen` era la única
correcta y la primitiva la había regresado. Ahora `py-4` afuera y `max-w-lg
px-4` adentro; (4) **a11y** el disparador de `Disclosure` usaba el anillo
`ring-ring/50` que el repo ya rechazó (2,01:1): outline sólido como `Button`, y
`cursor-pointer`; (5) `Progress` con `max` inválido mostraba N % de 100: ahora
barra vacía; (6) doble `mt-1` en «Información técnica»; (7) cierres
`</BottomBar>` reindentados; (8) clase `group` muerta en `TopNodesPanel`.
Verificados sin regresión: las 13 barras con contenido byte a byte idéntico y
sin hermanos tragados, `pb-24` en todas las raíces, 7 hrefs intactos,
`Button asChild` → un solo `<a>`, el ícono conserva `size-5`, API de
`ProgressBar` idéntica en 11 llamadas, 6 `<b>` del FAQ conservados.
Para fase 4: el bloque «Procesando documento» de `DocumentUpload` está
tematizado en `secondary` (texto, fondos, borde) y la barra ahora es `primary`:
revisar el bloque entero, no la barra. Límites documentados de las reglas:
`handmade-bottom-bar` no ve `fixed` y `bottom-0` repartidos en dos literales;
`link-icon-button` marcaría un enlace-pastilla legítimo (hoy no hay).

## Fase 3 — datos · HECHA 2026-11-13

| Hueco | Qué se hizo |
|---|---|
| Cifras KPI: 8 reales en 5 variantes, solo 2 en Gabarito (§3 lo exige). Los otros 5 hits del inventario no eran cifras (un input OTP, el wordmark «Didit.», tres títulos) | `ui/figure.tsx` (`Figure`: Gabarito bold tabular; `md`/`lg`/`xl`; `ink`/`absent`/`warning`/`danger`; `kind="code"` para el código de la cerradura). Migradas 9 (`ReservationPriceCard`, `ActivitySummary`, `AccountBalanceStrip` ×2, `BillingSettings` ×2, `AccountHistorySummary` ×2, `SmartlockCodes`). Regla `handmade-figure` (grande + bold + `tabular-nums`\|`tracking-*`) |
| 9 `CardTitle` con override: `CardTitle` era un `div`, **ningún título de tarjeta tenía semántica de encabezado** | → `Heading level={2} size="title"`; `CardTitle` retirado de `card.tsx` (nadie más lo usaba). 4 `DialogTitle`/`SheetTitle` con tipografía propia → la primitiva tal cual. Regla `title-override` |
| `dt/dd` en 3 variantes, una con el ícono fuera del grupo (HTML inválido en un `<dl>`) | `ui/definition-list.tsx` (`DefinitionItem`: ícono dentro del `dt`, definición alineada, `prominent`, `hint`). Migrados `DetailCell`, `ContactRow` (OperationsPanel) y `ChannelRow` (CheckinLinkDeliveryCard). Regla `native-definition` |
| 14 `Card`/`Surface` con clases de superficie (la regla destapó 4 más que el inventario) | `Surface`/`Card`: `tone` (`inverse` → «Acciones rápidas»; `selected` → automatización activa; `warning`/`danger` → `ContractChannelCard`; `muted` → documento eliminado, sin `opacity-70`), `interactive` (`PropertyCard`, `CheckinLinkDeliveryCard`, `AutomationCard`, `AutomationStatusItem`, `DocumentUpload`: borde `input-hover`, §4), `dashed` (CTA de automatizaciones y el vacío de la lista de propiedades, que era un `div` a mano). Redundantes quitadas (`border-rule shadow-sm`, vidrio de `SettingsContent`); las dos «Card» que anulaban su superficie son ahora un `<header>`. Regla `surface-override` |

Decisión tomada sin preguntar (precedente: `Heading`/`Button`/`Avatar` ya
tienen `inverse`): la tarjeta invertida es `tone="inverse"`, no una excepción.

Cambios intencionales: títulos de tarjeta a `xl` (tres eran `2xl`) y en
Gabarito; cifras del Tablero de `semibold` a `bold`; «— USD» en ink-4 (§2: el
«—» es ausencia); las tarjetas con hover pierden la sombra y el borde morado al
pasar (ahora `input-hover`); `AccountHistorySummary` deja `text-brand-navy`
por `ink`; títulos de diálogo al tamaño de la primitiva (`ReservationDialog`
era 2xl).

**Auditoría de regresión (revisor independiente, 2026-11-13)** — 13 hallazgos,
0 de comportamiento. Corregidos: (1) `interactive` + `tone="selected"`: la
tarjeta activa perdía el borde morado al pasar (gris `input-hover` encima);
ahora una tarjeta elegida refuerza el borde (`hover:border-primary`); (2) el
collector de `handmade-figure` nunca admitía `dd` (puerta externa) y dejaba
pasar `text-lg`: corregido; (3) `cn` sin uso en `PropertiesDocuments`; (4) los
documentos de `PropertiesDocuments` saltaban de h2 a h4: ahora h3; (5)
`DefinitionItem prominent` recupera `mt-1.5`; (6) `surface-override` ya no
marca `border-t`/`rounded-t-none` (layout) y sí `opacity`/`scale`;
`title-override` exime `text-start|end|justify`. Intencionales y documentados:
`ContactRow` pasa a término/definición apilados (estructura `dl` válida);
«— USD» en ink-4 (§2); `AccountHistorySummary` en `ink` en vez de
`brand-navy`; `transition-colors` en toda superficie. Renombrado
`tone="muted"` → `tone="sunk"` (es la superficie hundida del §2, no «apagada»).
Backlog: 5 `CardHeader className="border-b bg-sunk/50"` (franja de cabecera a
mano) → variante de `CardHeader`; `ReservationCostsList:302` total en
`text-brand-navy` (color de marca como énfasis de tabla; su prueba lo fija).

## Fase 4 — notas y cajas · HECHA 2026-11-13

Decisión tomada (el usuario pidió continuar sin elegir): la que estandariza
sin cambiar significado. `Note tone="neutral"` para la nota hundida y
`Note tone="accent"` para la caja destacada en morado que ya existía (no
`FeedbackBanner info`: una nota no anuncia nada).

| Hueco | Qué se hizo |
|---|---|
| 23 notas a mano + 7 cajas destacadas | `ui/note.tsx` (`Note`: tone, density, icon, as). 30 migradas en 20 archivos |
| 16 paneles hundidos + 8 que destapó la regla (`PropertiesUnits` ×5, `PropertyForm`, `ParameterField`, `SmartlockCodes`→`IconBadge`) | `Surface tone="sunk"` (y `dashed` para el hueco). La fila seleccionable de automatizaciones de la unidad usa `tone={isInactive ? "danger" : hasParams ? "selected" : "sunk"}` |
| Chip de pestaña en `PropertyForm` | `Badge tone="neutral"` |
| Filtro segmentado del calendario | `Tabs` con `TabsList size="sm"` (antes 3 `UnstyledButton` con clases de pestaña a mano) |
| Barra «Preparando…» con Cancelar; «Verificando el consumo…»; línea de conteo de `DeactivationConfirmDialog` | `FeedbackBanner mode="dynamic"` con `action`; `LoadingState inline`; `FeedbackBanner` `danger`/`info` |
| Bloques tematizados en `secondary` (`DocumentUpload` escaneo, `WelcomeScreen` requisitos y tiles) | `secondary` es «acción secundaria con relleno» (§2), no un tema: pasan a `primary`/`Note accent` |

Reglas: `handmade-note`, `handmade-sunk-surface`. Quedan fuera a propósito:
`GuaranteePreview` (`prose`: un documento, no una nota), `ReadOnlyField` y
`DynamicCheckinFields` (campo de solo lectura: candidato a primitiva propia),
`GuaranteeCardForm:509` (nodo host de Stripe con `ref`: no se envuelve),
`AccessInstructionsPanel:68` (enlaces-fila con hover: pulsable, no panel).

**Auditoría de regresión (revisor independiente, 2026-11-13)** — 11 hallazgos,
0 de comportamiento. Corregidos: (1) el filtro del calendario como `Tabs` sin
paneles emitía `aria-controls` a nada y cambiaba el teclado (tabindex rotativo,
activación al mover flechas): ahora son conmutadores `Button ghost` con
`aria-pressed` en un `role="group"` (§5: «outline/ghost con aria-pressed son
conmutadores»); (2) la línea de conteo de `DeactivationConfirmDialog` como
`FeedbackBanner info` ponía tinte azul y un ícono junto al `Spinner`: un conteo
sin alarma es `Note role="status"`, y solo el alarmante es `FeedbackBanner
danger`; (3) las filas de automatizaciones de la unidad mezclaban tarjeta
elevada (`danger`/`selected`) y panel plano (`sunk`): todas `flat`; (4) `Note`
ya no admite `icon` con `as="ul"|"li"` (tipos) y la prueba cubre el cuerpo
`div`; (5) doc de `interactive` + `selected`, id de prueba, y
`handmade-sunk-surface` acepta `px-/py-`. Aceptados y documentados: el escudo
verde de `IdentifyScreen` pasa a ink-4 (una nota tranquilizadora no es un
estado `success`), la caja de `SecondaryGateScreen` pasa a `accent` («qué debes
hacer» es el siguiente paso), «Cancelar orden» hereda el color del aviso
(`link-inherit`, §5), y la deriva de relleno/radio/opacidad que impone la
escala (p-3→px-3 py-2, rounded-xl→lg en notas, sunk/30 y /70 → /50).
Límite documentado: una caja hundida con `text-base` no la ve ninguna de las
dos reglas.

## Fase 5 — backlog sin decisiones · HECHA 2026-11-13

| Hueco | Qué se hizo |
|---|---|
| `CardHeader className="border-b bg-sunk/50"` ×5 + `border-b border-rule pb-6` ×1 | `CardHeader divided` (divisor del sistema; la franja hundida se retiró: la jerarquía la da el título). El hack `[.border-b]:pb-6` se quitó. `CardHeader`/`CardContent`/`CardFooter` entran en `surface-override` |
| Campo de solo lectura (`checkin/ReadOnlyField` ×2, correo de `RegisterForm` a mano) | `ui/read-only-field.tsx` (`ReadOnlyField`: `Surface sunk`, `role="textbox"` + `aria-readonly`, `aria-labelledby`, `hint`, `locked`). El de `checkin/` se borra |
| 3 filas de casilla `Label variant="plain" … bg-sunk/50 hover:border-primary/30` | `CheckboxField` (`ui/checkbox-field.tsx`, hecho en paralelo por otra herramienta y adoptado): `Label htmlFor` explícito, el enlace a los términos fuera de la etiqueta, superficie `sunk` interactiva. Reemplaza la primera versión de esta fase (`Label` envolviendo una `Surface`), que dejaba un enlace anidado dentro de un `<label>` |
| Enlaces-fila de `AccessInstructionsPanel` | `Link` (`group block`) + `Surface tone="sunk" interactive` adentro. `Label`/`Link`/`a` entran en el collector de `handmade-sunk-surface` |
| 2 filas de opción con tres estados a mano (`IdentityOverrideSelector`, `ClientUsersDrawer`: deshabilitada sunk + `opacity-70`, elegida `border-primary bg-primary/5`, normal con hover) | `Surface tone={disabled ? "sunk" : checked ? "selected" : "default"} interactive={!disabled}` dentro del `Label`. Sin `opacity` (la superficie hundida ya dice «deshabilitada», §: no opacidad para deshabilitado); la elegida lleva el borde de selección `primary/30` |
| Fichas de reserva del calendario (enlaces teñidos por estado) | Quedan como están: un enlace teñido es un pulsable, no un aviso; `handmade-notice` deja fuera `Link`/`a` |

**Auditoría del árbol combinado (2026-11-14).** Otra herramienta trabajó en
paralelo sobre el mismo árbol (`CheckboxField`, validación de credenciales del
modal, accesibilidad de `ParameterField` = A5); el usuario indicó adoptarlo.
Un revisor independiente revisó el diff combinado: 15 hallazgos, **2 bugs
reales en la validación de credenciales**, corregidos con pruebas que fallan
sin el arreglo (comprobado revirtiendo la lógica):

1. **Bug** — reabrir un borrador (unidad nueva) y guardar sin tocar el secreto
   lo perdía: el secreto no se precarga y la rama del borrador no lo
   arrastraba; el POST posterior salía sin token (422 en modo por
   alojamiento, pérdida silenciosa en modo propiedad). Ahora el borrador
   arrastra sus secretos locales.
2. **Bug** — escribir en un secreto y borrarlo enviaba `token: null` y borraba
   el guardado, contra el aviso «déjalo vacío para conservarlo». Vacío ya
   nunca es `null` en un secreto.
3. **Seguridad** — los campos secretos vacíos invitaban al gestor de
   contraseñas a rellenar el login de HIT (SIRE: número + clave = login);
   eso marcaba el campo y lo enviaba como credencial. `autoComplete=
   "new-password"` + `data-1p-ignore`/`data-lpignore`.
4. **Bug** — una clave faltante sin campo (desconocida o en camelCase) dejaba
   un error sin campo que enfocar y Guardar no hacía nada: se exige solo lo
   que el modal muestra (normalizando camelCase), lo demás lo valida el 422.

También: `CheckboxField` vuelve a activarse desde toda la fila de texto
(`block`), no admite un `ref` externo que rompía el clic, y deshabilitado se
ve en ink-3; `tone="selected"` recupera el tinte `primary/5` (la fila elegida
apenas se distinguía); el borrador de credenciales dice «Se envían al guardar
la unidad» o «Faltan: …» en vez de «No pudimos confirmar…»; la fila de la
unidad ya no repite el estado dos veces; `aria-required` y nombre por fila en
`ParameterField`; sin hover en usuarios mientras `busy`.

⚠️ **Abierto con backend, no resoluble en front:** conservar un secreto
OMITIÉNDOLO del `PATCH /listing-automation-overrides/{uuid}` presupone que el
backend hace merge de `parameters`. Para `PATCH /property-automations` el skill
dice que **reemplaza** el objeto entero; para overrides no está verificado.
Si también reemplaza, cambiar el RNT borraría el token guardado. Verificar con
curl antes de desplegar (registrado en `hitguest-api-contracts`).

## Pendiente (backlog con decisión)

- `DynamicCheckinFields:159`: `LoadingState` con clases de campo (cargando
  opciones) → ¿`ReadOnlyField` con un `Spinner` o `Skeleton` con forma de campo?
- `ReservationCostsList:302` total en `text-brand-navy` (color de marca como
  énfasis de tabla; su prueba lo fija).
- El wordmark «Didit.» tipografiado en `VerifyScreen` → marca en
  `components/brand`.
- Nombre estable del interruptor del override (`AutomationOverrideModal`):
  hoy cambia con el estado («Activa…»/«Desactivada…»).
- Duplicados de Finder en `src/` (~75 archivos `* 2.tsx`): borrar en local.

## Fase 4 — notas y cajas (dos decisiones)

| Hueco | Qué falta decidir |
|---|---|
| 43 cajas neutras `bg-sunk + rounded + padding` en ~25 combinaciones | Triage: cuáles son una nota («Guarda la unidad para…», «Configura los overrides ahora…») y cuáles otra pieza (control segmentado, bloque de código, zona de carga, progreso). Para las notas: `FeedbackBanner tone="neutral"` o una `Note`. Regla: `handmade-notice` extendida a `bg-sunk` |
| `bg-primary/5 border-primary/20`: 12 usos | 5 son selección (permitido, §4). **Decisión:** los 7 estáticos (`RegisterForm:148`, `ReservationDialog:1083`, `DocumentEditor:149`, `ContractScreen:1021`, `WelcomeScreen:433`, `SuccessScreen:263`, `AccessInstructionsPanel:68`) son un tercer significado («destacado») que el contrato no define: ¿`FeedbackBanner tone="info"` o un tono nuevo? |

## Cómo repetir el inventario

Script de la sesión (scratchpad, no versionado): agrupa cada `className` de un
elemento nativo por sus utilidades visuales (`bg|border|rounded|shadow|ring|
text-<tamaño|tinta>|font-<peso>`) y lista las formas con ≥3 usos. Vale la pena
versionarlo en `scripts/` si se vuelve a usar: es lo que diferencia «el gate
está en 0» de «no quedan patrones sin primitiva».
