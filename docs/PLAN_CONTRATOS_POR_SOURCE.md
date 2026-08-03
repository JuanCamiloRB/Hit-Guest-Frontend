# Plan de implementación — Contratos por canal, anexo de garantía y enrutamiento de firma

**Fuente de verdad:** el MD de backend entregado (contratos por source / garantía / firma digital).
**Alcance:** panel del PM + portal del huésped. No toca backend.
**Fecha:** 2026-08-01

---

## 0. El hallazgo que cambia el plan

Esto **no es una funcionalidad nueva sobre terreno limpio: es una migración**. Ya existe una
implementación parcial construida sobre una **spec anterior distinta**, y los dos modelos son
incompatibles en un punto concreto: dónde vive el proveedor de firma.

| | Spec anterior (lo que hay hoy en el código) | Spec nueva (el MD) |
|---|---|---|
| Proveedor de firma | En el **documento** (`signatureProviderSlug`) | En la **automatización** order 3 (`parameters.by_source[canal].provider_slug`) |
| Documentos por canal | Varios por canal, «máx. 1 **activo** por canal» | **Uno** por canal, sin noción de activo/inactivo para el modo |
| Modo | Implícito, no existe | Explícito: `all_sources` \| `per_source`, **no mezclables** |
| Tipo de contrato | No existe | `agreement_only` \| `guarantee_only` \| `agreement_and_guarantee` |
| Resolución en el portal | Heurística sobre `documents[]` | Endpoint autoritativo `contract/preview` |

Evidencia en el código:

- [`types/document.ts:101-107`](../src/features/properties/types/document.ts#L101) —
  `signatureProviderSlug` con el comentario *«The signature belongs to the CONTRACT, not to a
  separate automation node»*. La spec nueva dice exactamente lo contrario.
- [`DocumentFormModal.tsx:141`](../src/features/properties/components/documents/DocumentFormModal.tsx#L141) —
  envía `{ reservationSourceId, signatureProviderSlug }` al crear.
- [`DocumentFormModal.tsx:130`](../src/features/properties/components/documents/DocumentFormModal.tsx#L130) —
  «Ya existe un contrato ACTIVO para este canal» → modelo de varios docs por canal.
- [`ContractScreen.tsx:39-64`](../src/features/checkin/components/ContractScreen.tsx#L39) —
  heurística `resolveContractDocument` sobre `documents[]`, que el MD §4.1 declara inválida.

**Consecuencia para el plan:** hay una fase de retirada del modelo viejo, no solo de adición.

---

## 1. Otros dos hallazgos previos a implementar

### 1.1 🔴 El catálogo de canales puede devolver ids **falsos**

[`catalog-service.ts:235-245`](../src/features/auth/services/catalog-service.ts#L235):

```ts
async getReservationSources(): Promise<CatalogOption[]> {
    const sources = await this.fetchCatalog("reservation_source")
    if (sources.length === 0) {
        return [ { id: "14", name: "Airbnb" }, { id: "15", name: "Booking.com" }, { id: "16", name: "Directo" } ]
    }
    return sources
}
```

Dos problemas:

1. Usa `/catalogs?catalogCategoryName[eq]=reservation_source`, **no** el endpoint que documenta el
   MD §3.1 (`GET /reservation-sources`).
2. El fallback inventa los ids **14/15/16**. Los reales del MD son **Direct=21, Airbnb=22,
   Booking.com=23**. Si la llamada al catálogo falla, la UI escribe `reservationSourceId`
   equivocados y **enruta contratos al canal incorrecto en silencio**.

**Decisión:** servicio nuevo contra `GET /reservation-sources`. **Sin fallback inventado** — si
falla, la pantalla muestra error y no deja guardar. Un id equivocado aquí es peor que un error visible.

### 1.2 Capacidades de proveedor hardcodeadas

[`automation-definitions.ts:87-105`](../src/features/properties/data/automation-definitions.ts#L87)
codifica a mano los dos proveedores del order 3. El MD §3.2 es explícito: **no hardcodear** qué
proveedor soporta qué `contract_type`; leerlo de `parameters.signature.contract_types` de
`GET /providers`.

**Decisión:** la pantalla de enrutamiento construye su selector dinámicamente desde `/providers`.
La definición estática del order 3 deja de aportar `providerOptions` para esta pantalla.

### 1.3 `configure()` mergea superficial

Ya conocido (mismo caso que `parameters.locks` de TTLock). Todo guardado debe ser
**leer → modificar en memoria → enviar `by_source` completo**. Se encapsula en el servicio para que
ningún componente pueda olvidarlo.

---

## 2. Arquitectura

### 2.1 Principio rector

La complejidad real de esta funcionalidad **no está en la UI: está en la regla de lockstep del
§1.4/§3.5** — qué documentos deben existir antes de llamar a `configure()`. Esa regla se aísla en un
**módulo puro sin React ni fetch**, porque es donde vivirían los bugs y es lo único que merece
pruebas.

Todo lo demás es composición de piezas que ya existen.

### 2.2 Archivos

**Tipos** — `features/properties/types/contract-routing.ts` *(nuevo)*
Separado de `document.ts` a propósito: el enrutamiento es de la automatización, no del documento.

```ts
export type ContractMode = "all_sources" | "per_source"
export type ContractType = "agreement_only" | "guarantee_only" | "agreement_and_guarantee"
export interface SourceRouting { contract_type: ContractType; provider_slug: string }
export interface ContractRoutingParameters {
    contract_mode: ContractMode
    by_source: Record<string, SourceRouting>   // clave "all" | id de source como string
}
/** Los tipos que exigen texto de contrato en property_documents (MD §1.4). */
export function requiresAgreementDocument(t: ContractType): boolean
export const ALL_SOURCES_KEY = "all"
```

**Servicios**

| Archivo | Qué agrega |
|---|---|
| `features/properties/services/reservation-source-service.ts` *(nuevo)* | `list()` → `GET /reservation-sources`. Filtra Calry(845) y Unknown(107) por ser fallbacks técnicos (MD §3.1). |
| `features/properties/services/system-document-service.ts` *(nuevo)* | `getBySlug(slug)` → `GET /system-documents/slug/{slug}`. Solo lectura. |
| `features/properties/services/automation-service.ts` *(extender)* | `getContractRouting(uuid)` y `saveContractRouting(uuid, params)` — este último encapsula el read-modify-write del merge superficial. |
| `features/checkin/services/checkin-service.ts` *(extender)* | `getContractPreview(reservationUuid)` → `GET /checkin/{uuid}/contract/preview`. |

**Lógica pura** — `features/properties/lib/contract-routing-sync.ts` *(nuevo)*

```ts
/**
 * Traduce "estado actual de property_documents" + "enrutamiento deseado"
 * en la secuencia de escrituras del MD §3.5, en orden.
 */
export function planDocumentSync(
    current: PropertyDocument[],       // solo tipo 92
    desired: ContractRoutingParameters,
    texts: Record<string, string>,     // clave de by_source → contenido
): DocumentSyncPlan                    // { creates[], updates[], deletes[] }

/** Detecta el modo actual a partir del conjunto de filas (MD §3.3). */
export function detectMode(docs: PropertyDocument[]): ContractMode | null

/** Canales que van a fallar el lockstep — para avisar ANTES de guardar (MD §3.6). */
export function findLockstepGaps(
    current: PropertyDocument[],
    desired: ContractRoutingParameters,
): string[]
```

Sin React, sin red. ~80 líneas. Es el corazón del feature.

**UI del PM** — `features/properties/components/contracts/` *(nuevo)*

- `ContractRoutingSection.tsx` — orquesta: carga los 4 GET del §3.5, mantiene el estado del
  formulario, ejecuta la secuencia de guardado.
- `ContractModeToggle.tsx` — el toggle `all_sources` / `per_source`.
- `SourceRoutingRow.tsx` — un canal: selector de `contract_type`, selector de proveedor
  (habilitación derivada de `contract_types` del proveedor), editor de texto condicional.
- `GuaranteePreview.tsx` — texto de garantía en solo lectura + aviso si detecta `{{` sin resolver
  (MD §2).

Reutiliza el `DocumentEditor` existente. Los selectores usan los primitivos ya presentes.

**UI del huésped** — `ContractScreen.tsx` *(modificar)*
Pasa a `contract/preview` como fuente de verdad. Se **borra** `resolveContractDocument`
(líneas 39-64): el endpoint ya responde de forma autoritativa, la heurística sobra.

### 2.3 Dónde vive la pantalla del PM

El MD §3.6 describe **una** pantalla que configura texto + enrutamiento. Hoy eso está partido entre
la pestaña **Documentos** (texto) y **Automatizaciones** (proveedor del order 3).

**Recomendación:** la pantalla vive en **Documentos**, que es donde ya está el editor de texto y el
grueso de la UI. La tarjeta «Firma Digital» de Automatizaciones deja de ofrecer selector de
proveedor y enlaza a esa sección. Un solo lugar donde se configura, sin duplicar controles.

---

## 3. Fases

Cada fase cierra con `tsc --noEmit` y `next build` en verde.

**Fase 1 — Tipos y servicios.** Sin UI. Los 4 archivos de servicio + `contract-routing.ts`.
Verificable: compila y los servicios se pueden llamar desde consola.

**Fase 2 — Módulo puro de sincronización.** `contract-routing-sync.ts` + sus casos:
`all_sources`→`per_source`, `per_source`→`all_sources`, canal que pasa a `guarantee_only`, canal
nuevo. Es la fase con más densidad de reglas y la que conviene revisar con cuidado.

**Fase 3 — Pantalla del PM.** Los 4 componentes + enganche en la pestaña Documentos + enlace desde
la tarjeta del order 3.

**Fase 4 — Portal del huésped.** `getContractPreview` + reescritura del árbol de decisión de
`ContractScreen` según MD §4.5. Incluye el manejo del 422 de routing no configurado.

**Fase 5 — Retirada del modelo viejo.** Dejar de enviar `signatureProviderSlug` desde
`DocumentFormModal`; quitar el selector de firma de ese modal (ahora vive en el enrutamiento);
simplificar `document.ts`. Se hace al final para no romper nada mientras las fases 3-4 no estén.

---

## 4. Lo que hay que confirmar (no lo voy a asumir)

1. **¿El backend sigue aceptando `signatureProviderSlug` en POST/PATCH de documentos?**
   El MD no lo lista en el payload ni en la tabla de 422. Plan seguro: **dejar de enviarlo** en la
   fase 5 (si lo ignoraba, no cambia nada; si lo validaba, deja de haber riesgo). Se seguirá
   *leyendo* como fallback legacy en el portal hasta confirmar que ya no llega.

2. **`GET /reservation-sources` — ¿requiere token de sesión o sirve el app token?** El MD dice
   «Authorization: Bearer {token}» en la sección del PM. Se implementa con token de sesión, como el
   resto de datos de cuenta.

3. **Filtro de Calry(845) y Unknown(107).** El MD dice que «probablemente» no deberían ofrecerse.
   Los filtro por id, con comentario citando el MD. Si prefieres mostrarlos, es una línea.

---

## 5. Lo que este plan NO hace

- **No construye la herramienta interna de `system-documents` (MD §5).** Es para `super_admin` de
  HitGuest, no para el PM. Solo se consume el `GET /slug/{slug}` de lectura.
- **No inventa el filtro de canales por flag de backend** — se filtra por los dos ids que el MD
  nombra explícitamente, nada más.
- **No toca** identificación, verificación Didit, huéspedes secundarios ni el formulario dinámico:
  el MD dice que no cambian.
- **No agrega** una capa de estado global ni un store nuevo. La pantalla es autocontenida; el
  estado del formulario vive en ella.
