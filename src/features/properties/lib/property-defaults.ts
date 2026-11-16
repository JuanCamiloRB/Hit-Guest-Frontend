/**
 * Valores por omisión del formulario de propiedad y del diálogo de alojamiento
 * que VIAJAN al backend aunque el PM no los toque. Viven aquí para que las
 * pruebas de contrato (fase 0 del rediseño, plan `20261116_propiedad-form-ux.md`)
 * los fijen y el rediseño no los cambie sin una decisión explícita.
 */

/** Portada predeterminada de una propiedad nueva: se envía en `extra.thumbnailUrl` y como `picturesUrl[0]`. */
export const DEFAULT_PROPERTY_THUMBNAIL_URL =
    "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&auto=format&fit=crop&q=60"

/** Portada predeterminada de un alojamiento nuevo: se envía en `thumbnailUrl`. */
export const DEFAULT_LISTING_THUMBNAIL_URL =
    "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&auto=format&fit=crop&q=60"

/** Política de cancelación con la que nace un alojamiento (`extra.cancellationPolicy`). */
export const DEFAULT_CANCELLATION_POLICY = "STANDARD"
