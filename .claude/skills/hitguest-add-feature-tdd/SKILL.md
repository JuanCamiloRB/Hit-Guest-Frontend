---
name: hitguest-add-feature-tdd
description: Agrega un feature completo a HitGuest Frontend con Test-Driven Development (RED-GREEN-REFACTOR), usando el harness real del repo (Vitest + React Testing Library, configurado y verificado — sin Jest, sin Prisma, sin NestJS, sin Playwright). Activar cuando el usuario diga "hacelo con TDD", "quiero tests primero" o "desarrollo guiado por pruebas" para un feature nuevo.
---

# HitGuest — Agregar Feature con TDD

Variante de `hitguest-add-feature` con tests primero. Mismo terreno (Next.js
App Router, sin backend propio, API Laravel real) — la diferencia es que cada
pieza de lógica se escribe DESPUÉS de un test que falla, no antes.

**No lo actives si el usuario no pidió TDD explícitamente.** Para el flujo
normal (sin énfasis en tests), usar `hitguest-add-feature`.

## El harness real de este repo

Instalado y verificado corriendo la suite real, no asumido:

- **Vitest** `^4.1.10` — no Jest. La sintaxis de mocks es `vi.fn()`/`vi.mock()`,
  no `jest.fn()`.
- **React Testing Library** `^16.3.2` (soporta React 19) + `@testing-library/jest-dom`
  (matchers vía `@testing-library/jest-dom/vitest`) + `@testing-library/user-event`.
- **jsdom** como entorno.
- Config en `vitest.config.mts` (raíz del repo) — plugins `@vitejs/plugin-react`
  y `vite-tsconfig-paths` (lee el alias `@/*` de `tsconfig.json`, no lo duplica).
- Scripts: `npm run test` (una corrida) y `npm run test:watch`.
- **No hay Playwright ni MSW instalados.** Si un feature necesita E2E de
  verdad, es una conversación aparte — no lo agregues por tu cuenta.

⚠️ **Trampa real que ya mordió esta config**: un comentario `/** ... */` que
contenga la secuencia `features/*/lib/*.ts` (glob con asterisco seguido de
slash) **cierra el bloque de comentario antes de tiempo** — el `*/` de la ruta
se interpreta como el cierre del JSDoc, y el resto del comentario queda como
código suelto. Rompió `vitest.config.mts` de forma intermitente y confusa
(parecía caché corrupto, no lo era). Usar `//` línea por línea en vez de
`/** */` si el comentario va a mencionar rutas con `*/` dentro.

## Cuándo invocar este skill

- "Agregá X con TDD"
- "Quiero tests primero para este feature"
- "Desarrollo guiado por pruebas para la sección de Y"

## Paso 0 — Contrato del backend, nunca inventado

Igual que `hitguest-add-feature`: si hay un archivo de plan
(`.claude/plans/*.md`, `docs/*.md`), leerlo completo antes de escribir un solo
test. Los tests documentan un contrato — si el contrato real no se conoce,
el test estaría documentando una suposición, no un hecho.

## Paso 1 — Qué se testea y cómo, por capa

| Capa | Dónde | Qué mockear | Ejemplo real |
|---|---|---|---|
| Lógica pura | `features/<dominio>/lib/*.ts` | Nada — sin React, sin fetch, entrada/salida pura | `contract-routing-sync.test.ts` |
| Servicio | `features/<dominio>/services/*-service.ts` | `global.fetch` con `vi.fn()`, o `vi.mock("@/lib/api-client")` | — |
| Componente | `features/<dominio>/components/**/*.tsx` | El servicio que consume, vía `vi.mock(...)`; render con RTL | — |

La lógica pura es la que más vale la pena testear primero — es determinista,
no necesita mocks, y es donde vive la complejidad real de un feature (ver
`contract-routing-sync.ts`: la regla de "qué documentos deben existir antes de
poder guardar" tiene más ramas que cualquier componente del mismo feature).

## Paso 2 — Ciclo RED → GREEN → REFACTOR

**🔴 RED — escribir el test que falla:**

1. Crear `<archivo>.test.ts` (o `.test.tsx` para componentes) junto al código
   que todavía no existe.
2. Importar de `"vitest"` explícitamente (`describe`, `it`, `expect`, `vi`) —
   no hay `globals: true`, así que no asumas que están disponibles sin importar.
3. Para lógica pura: escribir cada caso borde real como un `it()` — no un test
   genérico de "funciona", sino uno por transición/rama (ver
   `contract-routing-sync.test.ts`: un test por cada uno de los cuatro modos
   de transición que describe el contrato, no un solo test gigante).
4. Correr `npm run test` y **confirmar que falla** por la razón correcta (el
   código no existe / no está implementado) — no por un error de sintaxis en
   el test mismo. Si falla por lo segundo, arreglar el test antes de seguir.

**🟢 GREEN — implementar lo mínimo:**

5. Escribir solo el código necesario para que ese test pase. No adelantar
   funcionalidad que ningún test todavía pide.
6. Correr `npm run test` de nuevo. Si un test falla, corregir la
   implementación — nunca el test, salvo que el test mismo tuviera un error
   real (no "para que pase más fácil").

**🔵 REFACTOR — limpiar sin romper:**

7. Con los tests en verde como red de seguridad, extraer lo repetido, mejorar
   nombres, simplificar. El contrato público (firmas exportadas) no cambia.
8. Correr `npm run test` una vez más para confirmar que sigue en verde.

## Paso 3 — Verificación completa (no solo los tests)

Los tests no reemplazan la verificación estática — la preceden:

```bash
npm run test
./node_modules/.bin/tsc --noEmit
rm -rf .next && ./node_modules/.bin/next build
./node_modules/.bin/eslint <archivos tocados>
```

Los cuatro en verde, siempre. Un feature con tests pasando pero `tsc` roto no
está terminado.

## Qué NO hacer

- **No escribir la implementación antes que el test.** El test define el
  contrato esperado; si ya existe la implementación, el test solo la describe,
  no la dirige.
- **No corregir el test para que pase.** Si falla, el problema está en la
  implementación — salvo que el test mismo esté mal planteado, lo cual se
  corrige explícitamente, no en silencio.
- **No usar sintaxis de Jest.** Es Vitest — `vi.fn()`, `vi.mock()`,
  `vi.spyOn()`, no sus equivalentes de `jest`.
- **No instalar Playwright, MSW ni nada de E2E "por si acaso".** No está en
  el repo; si hace falta, es una decisión aparte, no una que este skill tome solo.
- **No asumir NestJS, Prisma, Supertest ni tests de backend.** Este repo no
  tiene backend propio — no hay nada de eso que testear acá.
- **No escribir un test por escribir.** Un componente puramente presentacional
  sin lógica condicional no necesita un test — priorizar lógica pura y
  servicios, que es donde los bugs reales de este repo han vivido esta sesión.

## Skills relacionados

- `hitguest-add-feature` — el mismo flujo sin TDD, para cuando no se pidió
  explícitamente desarrollo guiado por pruebas.
- `hitguest-standards` — reglas transversales (no inventar, no mockear,
  patrones, verificación real, mantener skills al día). Aplican acá también.

## Nota de mantenimiento — cleanup entre tests

`vitest.setup.ts` necesita `afterEach(() => cleanup())` explícito (importado de
`@testing-library/react`) porque la config no usa `globals: true` — sin eso, RTL
no engancha su cleanup automático solo, y cada `render()` se acumula sobre el
DOM del test anterior. Síntoma: queries que son únicas en el primer test de un
archivo empiezan a fallar con "multiple elements found" a partir del segundo.
Si en algún momento se reescribe `vitest.setup.ts`, no perder esta línea.
