---
name: hitguest-standards
description: Reglas transversales de HitGuest Frontend — no inventar contratos, no mockear, no sobreingeniería, mantener patrones de diseño y arquitectura, verificación real (nunca simulada), y disciplina para mantener los skills del repo actualizados y vigentes. Activar en CUALQUIER tarea de código (feature, fix, review, auditoría), no solo al agregar features nuevas.
---

# HitGuest — Reglas de Ingeniería (transversal)

Este skill no describe un flujo de trabajo (para eso están `hitguest-add-feature` y
`hitguest-add-feature-tdd`) — describe las reglas que aplican **siempre**, sin
importar si la tarea es agregar algo, arreglar un bug, auditar código existente,
o revisar un plan que mandó backend. Es el fondo de la mesa, no un paso más.

## Cuándo invocar este skill

- Cualquier tarea de código en este repo, implícitamente.
- Explícitamente cuando el usuario diga "no supongas", "sé riguroso", "verificá",
  "mantené los patrones", o pida una auditoría.
- Antes de escribir o actualizar cualquier otro skill de este repo.

## Regla 1 — Nunca inventar el contrato del backend

Este repo tiene un historial real de bugs por inventar en vez de verificar:
`catalog-service.ts` → `getReservationSources()` tenía un fallback que devolvía
ids `14/15/16` cuando los reales eran `21/22/23` — enrutaba datos al canal
equivocado en silencio.

- Si hay un archivo de plan (`.claude/plans/*.md`, `docs/*.md`, o texto pegado
  por el usuario), leerlo completo antes de escribir una línea.
- **No confiar en nombres, slugs o rutas — verificar el contenido real.**
  Precedente reciente: se asumió que `hitguest.com/terminos-condiciones/` era
  el T&C del huésped y `terminos-servicio1/` el del PM, por lógica de nombre.
  Al hacer `WebFetch` sobre ambas, estaban cruzadas. Si algo se puede verificar
  con una herramienta, se verifica — no se infiere del nombre.
- Si el endpoint no existe todavía o el dato no se puede confirmar, decirlo y
  detenerse ahí. Nunca mockear una respuesta para "que compile".
- Si algo en el contrato es ambiguo, señalarlo explícitamente en vez de
  resolverlo por conveniencia (ver Regla 6).

## Regla 2 — Nunca mockear para que "se vea bien"

Un estado vacío correcto (loading, error, "no configurado") es siempre mejor
que un dato inventado. Si una pantalla no tiene datos reales que mostrar
todavía, se dice explícitamente, no se rellena con placeholders que parecen
reales.

## Regla 3 — Sin sobreingeniería

- No crear un archivo de lógica pura "por las dudas" — solo cuando el árbol de
  casos realmente lo justifica. Precedente correcto: `contract-routing-sync.ts`
  (2 modos × varios canales × conversión con creates/updates/deletes). Precedente
  de lo que NO amerita esto: un `if` de una condición no necesita su propio
  módulo.
- No instalar dependencias, frameworks o infraestructura "por si acaso" (E2E,
  MSW, i18n nuevo) sin que el usuario lo pida — es una decisión de arquitectura,
  no una que se tome sola dentro de una tarea más chica. Precedente: el toggle
  ES/EN del mockup de garantía se descartó porque **ningún** otro screen del
  checkin usa i18n hoy — agregarlo ahí solo habría sido inconsistente y no pedido.
- Tres líneas parecidas están bien. No adelantar abstracciones para
  "necesidades futuras" hipotéticas.

## Regla 4 — Mantener patrones de diseño y arquitectura existentes

Antes de escribir código nuevo, mirar cómo ya se resuelve algo parecido — y
copiarlo, no reinventarlo:

- **Rutas del portal de checkin**: cada pantalla nueva necesita 3 `page.tsx`
  (directa `[reference]`, externa `[reference]/[listingUuid]/[externalId]`,
  secundaria `[reference]/s/[guestToken]`) — mirroreando el wrapper exacto que
  ya existe para pantallas hermanas (ver `contact-challenge/page.tsx` × 3,
  copiado línea por línea de `verify/page.tsx` × 3).
- **Primitivos de UI**: `StatusPill`, `SectionCard`, `EmptyState`, `LoadingState`
  en `components/ui/` — no reinventar spinners o pastillas de estado a mano.
- **Tokens de diseño**: los colores de marca (`--color-brand-navy/purple/blue`)
  están registrados en `@theme inline` de `globals.css` — usar las clases
  Tailwind que genera (`bg-brand-purple`, `text-brand-navy`, etc.), nunca hex
  hardcodeado. Si un mockup HTML trae sus propios hex, primero comparar contra
  `globals.css` — si coinciden (como pasó con el mockup de garantía), es señal
  de que el diseño ya fue pensado para este sistema de tokens.
- **Patrones de componente repetidos**: el checkbox de aceptación con link
  (`ContractScreen` → `IdentifyScreen`/`RegisterForm`) se copió tal cual
  (misma estructura `<label>`/`<input type="checkbox">`/`peer-checked`) en vez
  de crear una versión distinta cada vez.
- **Servicio**: clase con instancia exportada al final
  (`export const xService = new XService()`), JSDoc de cabecera listando cada
  endpoint real, distinción explícita token de sesión vs. token de app.

Cuando un patrón se repite una tercera vez en lugares distintos, es momento de
evaluar si merece extraerse — no antes (ver Regla 3).

## Regla 5 — Verificación real, nunca simulada

- `tsc --noEmit`, `next build`, `eslint`, y `npm run test` (si el cambio toca
  algo testeable) antes de reportar cualquier cosa como terminada.
- **Un error de eslint en un archivo tocado no es automáticamente tuyo.**
  Antes de reportarlo, correr eslint sobre el mismo patrón en un archivo
  hermano NO tocado (ej. comparar `ContactChallengeScreen.tsx` nuevo contra
  `VerifyScreen.tsx` existente) — si el mismo error aparece igual ahí, es
  baseline del repo, no una regresión.
- **No declarar algo "estable" tras una sola corrida exitosa** cuando hay algo
  no determinístico de por medio (config de build, tests, timing). Precedente:
  el bug de `vitest.config.mts` con el comentario `/** */` pareció resuelto tras
  un run, y no lo estaba — se confirmó real recién en la 2ª corrida. Mismo caso
  con la falta de `cleanup()` entre tests en `vitest.setup.ts`: solo se vio al
  encadenar tests, no en el primero. Ante cualquier duda, correr 3-4 veces.
- Si algo requiere backend vivo, credenciales o datos que no se tienen para
  probarse en un navegador real, decirlo explícitamente en el reporte — no
  reportar como "funciona" algo que solo se verificó de forma estática o por
  `curl`. Un test con React Testing Library sobre un componente puro es un
  sustituto honesto parcial, no un reemplazo de haberlo visto en pantalla.

## Regla 6 — Ante ambigüedad arquitectónica, preguntar

No resolver una decisión de diseño por conveniencia cuando el costo de
equivocarse es real. Preguntar de forma concreta, con opciones concretas —
no "¿cómo querés que lo haga?" en abstracto. Precedentes de esta sesión:
dónde va el checkbox del huésped (¿`WelcomeScreen` a nivel reserva o
`IdentifyScreen` por huésped? — cambiaba el significado de la funcionalidad),
si el consentimiento necesita persistirse en backend o alcanza con gate de
frontend (cambiaba si la tarea estaba bloqueada o no).

No hace falta preguntar para decisiones mecánicas (nombres de archivo, orden
de imports) — solo cuando la decisión tiene consecuencia real y no está en
ningún contrato ya documentado.

## Regla 7 — Mantener los skills de este repo actualizados

Los skills de este repo no son estáticos — el código cambia y los skills
tienen que seguirlo, igual que la memoria persistente.

- **Cuándo actualizar un skill**: después de arreglar un bug sistémico que
  afecta a cualquier trabajo futuro similar (ej. la falta de `cleanup()` en
  `vitest.setup.ts` debería quedar documentada en `hitguest-add-feature-tdd`
  la próxima vez que se toque, no solo arreglada una vez y olvidada); después
  de establecer un patrón nuevo que se espera reusar (ej. el patrón de "gate
  antes de una llamada sensible" usado en `GuaranteeCardForm` para el
  tokenización); después de que un plan de backend cambie una convención que
  ya estaba documentada como cierta en un skill.
- **Cómo actualizar**: ediciones chirurgicas, no reescrituras completas. Cada
  afirmación nueva en un skill debe poder señalar un archivo/línea real como
  precedente — igual que cualquier afirmación en el código. Un skill que dice
  "esto se hace así" sin un ejemplo real verificable es tan peligroso como
  inventar un endpoint.
- **Antes de citar algo de un skill existente como verdad**, confirmar que el
  archivo/función que cita todavía existe — los skills pueden quedar
  desactualizados exactamente igual que la memoria. "El skill dice que X
  existe" no es lo mismo que "X existe ahora".
- Si una tarea revela que un skill existente tiene una afirmación incorrecta
  o un ejemplo que ya no aplica (renombrado, eliminado, reemplazado), corregirlo
  en el momento — no dejarlo para después.

## Qué NO hacer

- No inventar ids, endpoints, shapes de respuesta, ni asumir qué URL/documento
  corresponde a qué cosa sin verificarlo.
- No mockear datos para que una pantalla "se vea terminada".
- No crear abstracciones, dependencias o pasos nuevos que nadie pidió.
- No reportar una verificación estática como si fuera una prueba en navegador.
- No declarar algo estable tras una sola corrida cuando hay algo no
  determinístico de por medio.
- No dejar un skill desactualizado sabiendo que ya no refleja el código real.

## Skills relacionados

- `hitguest-add-feature` — flujo paso a paso para agregar un feature completo.
- `hitguest-add-feature-tdd` — la misma variante con TDD (Vitest + RTL).

Estas reglas aplican dentro de ambos flujos, no los reemplazan.
