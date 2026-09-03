import { AUTOMATION_DEFINITIONS } from "../data/automation-definitions"
import { canonicalSlug } from "../services/automation-service"

/**
 * Cómo se llama un proveedor **en el vocabulario del PM**, indexado por slug
 * canónico.
 *
 * ## Por qué existe este módulo
 *
 * El nombre lo elige Propiedades: el PM configura "Verificación avanzada" o
 * "Verificación esencial" y nunca ve "Didit" ni "AWS Textract". Ese naming se
 * fijó en el commit `b8a21d3` (2026-08-04) y la fuente única es
 * `providerOptions[].label` en `data/automation-definitions.ts`.
 *
 * Cada pantalla que lo repetía a mano se quedó atrás cuando alguien renombró:
 * el detalle de reserva siguió mostrando "Verificado con Didit" durante un mes,
 * en la MISMA pantalla donde el panel de arriba ya decía "Verificación
 * avanzada". Por eso acá no se escribe ningún texto: se deriva. Renombrar una
 * opción en Propiedades arrastra a todos los consumidores solos.
 *
 * Presentación pura — sin fetch, sin React, sin estado.
 */

function indexBySlug(pick: (option: { label: string; shortLabel?: string }) => string) {
    return Object.fromEntries(
        AUTOMATION_DEFINITIONS.flatMap((definition) =>
            definition.providerOptions.map(
                // Las definiciones escriben los slugs con guion ("pdf-report") y el
                // backend los manda con guion bajo; sin canonicalizar, las claves
                // derivadas no cruzarían con las que llegan del API.
                (option) => [canonicalSlug(option.value), pick(option)] as const,
            ),
        ),
    ) as Record<string, string>
}

/** Nombre completo: "Verificación avanzada". */
export const PROVIDER_LABELS_BY_SLUG: Record<string, string> = indexBySlug((o) => o.label)

/**
 * Nombre para componer dentro de otra frase: "avanzada".
 *
 * Cae al `label` completo cuando la opción no declara uno corto: un proveedor
 * nuevo se lee redundante, pero nunca desaparece de la pantalla.
 */
export const PROVIDER_SHORT_LABELS_BY_SLUG: Record<string, string> = indexBySlug(
    (o) => o.shortLabel ?? o.label,
)

/**
 * `null` cuando el slug no corresponde a ninguna opción conocida.
 *
 * Es deliberado que no haya fallback al slug crudo: quien llama decide si
 * mostrar el identificador técnico (las insignias de propiedad lo hacen, para no
 * ocultar una fila que el backend sí tiene) o callar (el detalle de reserva, que
 * prefiere afirmar menos antes que nombrarle al PM un proveedor que no conoce).
 */
export function providerLabel(slug: string | null | undefined): string | null {
    return PROVIDER_LABELS_BY_SLUG[canonicalSlug(slug)] ?? null
}

/** Ver `PROVIDER_SHORT_LABELS_BY_SLUG`. `null` con el mismo criterio que `providerLabel`. */
export function providerShortLabel(slug: string | null | undefined): string | null {
    return PROVIDER_SHORT_LABELS_BY_SLUG[canonicalSlug(slug)] ?? null
}

/**
 * Los dos slots que el backend crea siempre. Sus ids ya se usan como literales
 * en el resto del feature (`AutomationCard`, `automation-catalog`).
 */
const IDENTITY_DEFINITION_IDS: ReadonlySet<string> = new Set([
    "identity-verification-main",
    "identity-verification-secondary",
])

/**
 * Qué proveedores verifican identidad, derivado de las definiciones.
 *
 * Se deriva y no se lista a mano para que agregar una tercera opción de
 * identidad en Propiedades no deje pantallas sin reconocerla.
 */
export const IDENTITY_PROVIDER_SLUGS: ReadonlySet<string> = new Set(
    AUTOMATION_DEFINITIONS
        .filter((definition) => IDENTITY_DEFINITION_IDS.has(definition.id))
        .flatMap((definition) => definition.providerOptions.map((o) => canonicalSlug(o.value))),
)
