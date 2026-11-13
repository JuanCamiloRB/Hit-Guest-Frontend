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

## Fase 2 — portal del huésped (sin decisiones pendientes)

| Hueco | Primitiva / regla |
|---|---|
| Barra inferior fija: 11 copias idénticas + `BOTTOM_BAR` en `WelcomeScreen` (`fixed bottom-0 … bg-white/80 backdrop-blur-md border-t border-rule/50`) | `BottomBar` en `ui/`. Regla: `fixed bottom-0` fuera de `ui/` |
| 7 `<Link className="p-2 -ml-2 rounded-full hover:bg-sunk">` («volver») | `Button variant="ghost" size="icon" asChild`. Regla: `Link`/`a` con `rounded-full` + `hover:bg-` |
| 4 barras de progreso a mano (`TopNodesPanel:56`, `WelcomeScreen:352`, `ProgressBar:27`, `VerifyScreen:932`) | `Progress` en `ui/` (subir `checkin/ProgressBar` y generalizarlo). Regla: `h-1…2 w-full rounded-full bg-sunk` |
| `details/summary` a mano: `GuaranteeInfoCard` ×7, `ContractRoutingSection:665` | `Disclosure` sobre `radix-ui` Collapsible/Accordion (ya instalado, sin dependencia nueva). Regla: `<details`/`<summary` fuera de `ui/` |

## Fase 3 — datos (una decisión)

| Hueco | Primitiva / regla |
|---|---|
| Cifras KPI: 11 usos en 8 variantes de clase; solo `AccountHistorySummary` en Gabarito aunque §3 lo exige | `Figure` (Gabarito, `tabular-nums`, tamaños `lg`/`xl`, tono `ink`/`muted`). Regla: `text-2xl|3xl font-bold|semibold` fuera de `ui/` |
| 9 `CardTitle` con `className` de texto | Regla `card-title-override` (como `heading-override`) |
| `dt/dd` en 3 variantes (`OperationsPanel` 684 y 712, `CheckinLinkDeliveryCard` 153) | `DefinitionList` / `DefinitionItem` |
| 10 `Card` con clases de superficie: redundantes (`border-rule shadow-sm` ya es el default), anuladas (`border-none shadow-none bg-transparent` ×2: entonces no es una Card), vidrio (`SettingsContent:102`), punteada (`PropertiesAutomation:358`) | Regla `surface-override` (solo layout en `Card`/`Surface`). **Decisión:** `OperationsPanel:507` (`bg-primary text-white`) → ¿`Surface tone="inverse"` o excepción documentada? |

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
