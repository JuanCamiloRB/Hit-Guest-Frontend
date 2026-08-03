---
name: hitguest-add-feature
description: Agrega un feature completo a HitGuest Frontend (Next.js App Router, sin backend propio — consume la API Laravel de guest.hit.tools). Orquesta tipos, servicio, lógica pura si aplica, componentes y su conexión a una pantalla o pestaña existente, siguiendo los patrones ya establecidos en el repo (contract-routing, billing dashboard, garantía Stripe). Activar cuando el usuario pida agregar una sección, pantalla o flujo nuevo que necesite tipos + servicio + UI conectados de punta a punta.
---

# HitGuest — Agregar Feature

Este repo **no genera backend**: es un frontend Next.js que consume la API Laravel
ya construida en `https://guest.hit.tools/api/v1`. No hay Prisma, no hay NestJS,
no hay Nx, no hay migraciones. "Feature completo" acá significa: tipos → servicio
→ (lógica pura si la complejidad lo amerita) → componentes → conectarlo a una
pantalla o pestaña que ya existe → verificación estática. Un solo flujo, no dos
capas en paralelo.

## Cuándo invocar este skill

- "Agregá la sección de X al panel"
- "Necesito un feature nuevo que hable con el endpoint Y"
- "Conectá esta pantalla a datos reales"

No lo actives para un cambio de una sola línea o un fix puntual — es para cuando
hace falta tipos + servicio + UI juntos. Si el usuario pide explícitamente TDD
("hacelo con TDD", "tests primero"), usar `hitguest-add-feature-tdd` en su lugar
— el repo tiene Vitest + React Testing Library configurado para eso.

Las reglas de `hitguest-standards` (no inventar, no mockear, sin sobreingeniería,
mantener patrones, verificación real) aplican en todos los pasos de abajo — no
están repetidas acá, léelas ahí.

## Paso 0 — Contrato del backend, nunca inventado

Este repo tiene un historial de bugs por **inventar** en vez de verificar contra
el contrato real (ver `catalog-service.ts` → `getReservationSources()`: un
fallback que devolvía ids `14/15/16` cuando los reales son `21/22/23` — enrutaba
datos al canal equivocado en silencio). La regla no negociable de este skill:

- Si el usuario menciona un archivo de plan (`.claude/plans/*.md`, `docs/*.md`),
  **leerlo completo** con la herramienta Read antes de escribir una sola línea.
  Esos documentos son el contrato — endpoints, payloads, tablas de errores 422.
- Si no hay archivo, preguntar por el endpoint, el payload exacto y la forma de
  la respuesta antes de asumir nada. Nunca mockear una respuesta para "que
  compile" — si el endpoint no existe todavía, decirlo y detenerse ahí.
- Si algo en el contrato es ambiguo, señalarlo explícitamente en vez de resolverlo
  por conveniencia (ver el patrón de esta sesión: el plan de contratos-por-canal
  tenía una firma de función pendiente que se corrigió con una decisión razonada,
  no copiada a ciegas).

## Paso 1 — Detectar convenciones ya en uso

Antes de escribir, mirar cómo ya se resuelve algo parecido en el repo:

```bash
# ¿Existe ya una feature/servicio similar?
ls src/features/*/services/*.ts | xargs -I{} basename {}

# ¿El dominio ya tiene tipos, o hay que crear la carpeta?
ls src/features/<dominio>/types/ 2>/dev/null

# Primitivos de UI reutilizables ya construidos (StatusPill, SectionCard,
# EmptyState, LoadingState viven en components/ui — no reinventarlos)
ls src/components/ui/

# ¿La pantalla destino ya existe (pestaña de un Tabs, o una screen del portal)?
grep -rn "TabsContent value=" src/features/properties/components/PropertyForm.tsx
```

Determinar:
- **Dominio** (`properties`, `reservations`, `billing`, `checkin`, …) — si no
  encaja en ninguno existente, es una carpeta nueva bajo `src/features/`.
- **¿Necesita token de sesión o token de app?** Datos de cuenta (propiedades,
  reservas, documentos) → token de sesión, nunca fallback al app token
  compartido (fuga cross-account ya documentada en este repo). Portal de
  huésped (checkin) → token de app compartido vía `getWithAppToken`/
  `postWithAppToken`.
- **¿Hace falta una ruta BFF?** Solo si un componente cliente necesita evitar
  CORS con una llamada de sesión — ver `src/app/api/bff/properties/route.ts`
  como precedente. La mayoría de los features llaman al servicio directo, sin BFF.

## Paso 2 — Plan antes de escribir código

Mostrar un plan corto, no una lista de archivos genérica:

```
Feature: <Nombre>

Tipos:      src/features/<dominio>/types/<nombre>.ts
Servicio:   src/features/<dominio>/services/<nombre>-service.ts
            GET/POST reales, con el header JSDoc que lista cada endpoint
Lógica pura: src/features/<dominio>/lib/<nombre>.ts (solo si hay una regla con
            varios casos borde que merezca aislarse y poder razonar sin React)
Componentes: src/features/<dominio>/components/<subcarpeta>/*.tsx
Conexión:   dónde se monta (qué Tabs/pestaña, o qué screen del portal)

¿Avanzo?
```

Esperar confirmación antes de tocar archivos si el plan tiene alguna decisión
de arquitectura no obvia (dónde vive la pantalla, si se retira un modelo viejo,
etc.) — no hace falta pedir permiso para cosas mecánicas como nombres de archivo.

## Paso 3 — Implementar, en este orden

1. **Tipos** — interfaces + funciones puras pequeñas junto a ellas (ver
   `contract-routing.ts`: el tipo y `requiresAgreementDocument()`,
   `isNativeSignatureAllowed()` viven en el mismo archivo, no separados).
2. **Servicio** — clase con instancia exportada al final
   (`export const xService = new XService()`), JSDoc de cabecera listando
   cada endpoint real que toca, manejo de 401/404 explícito cuando aplica.
3. **Lógica pura, si aplica** — sin React, sin fetch. Solo cuando hay una regla
   con ramas reales que vale la pena poder probar aisladas (ver
   `contract-routing-sync.ts`). No crear este archivo "por las dudas" si la
   lógica es una condición simple.
4. **Componentes** — function components, `"use client"` cuando haga falta
   estado/efectos, Tailwind + primitivos de `components/ui`. Reusar
   `StatusPill`/`SectionCard`/`EmptyState`/`LoadingState` en vez de escribir
   spinners o pastillas de estado a mano.
5. **Conectar** — a una pestaña existente (`TabsContent` en un `PropertyForm`-like)
   o a una screen del portal. Preferir extender lo que existe sobre crear una
   ruta nueva, salvo que el feature genuinamente sea una pantalla nueva.
6. **i18n** — si hay copy visible al huésped, agregarlo a
   `src/lib/i18n/dictionaries/{en,es}.ts`, no hardcodear un solo idioma.

## Paso 4 — Verificación (nunca opcional, nunca simulada)

```bash
./node_modules/.bin/tsc --noEmit
rm -rf .next && ./node_modules/.bin/next build
./node_modules/.bin/eslint <archivos tocados>
```

- `tsc` y `next build` en verde son mínimo indispensable, no un "nice to have".
- Antes de reportar un error de `eslint` como propio, confirmar que no es parte
  del baseline preexistente del repo (correr `eslint` sobre el archivo completo
  y comparar con el diff de lo que realmente se tocó).
- Si algo requiere backend vivo o credenciales reales (Stripe, OAuth, un
  endpoint que Ricardo todavía no desplegó) para probarse en runtime, decirlo
  explícitamente en el reporte final — no reportar como "funciona" algo que
  solo se verificó de forma estática.

## Qué NO hacer

- **No inventar ids, endpoints ni shapes de respuesta.** Si no está en el
  contrato ni se puede verificar, preguntar.
- **No mockear datos para que la pantalla "se vea bien".** Un estado vacío
  correcto es mejor que un dato falso.
- **No asumir NestJS, Prisma, Nx o un backend propio.** Este repo no los tiene.
- **No saltarse la verificación estática** aunque el cambio parezca trivial.
- **No crear un archivo de lógica pura para todo.** Solo cuando el árbol de
  casos realmente lo justifica — la mayoría de los features de este repo no
  necesitan uno.
