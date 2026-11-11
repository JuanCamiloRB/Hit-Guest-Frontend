/**
 * Espejo en JS de los tokens de `globals.css`, para lo que no puede leer clases
 * ni variables CSS: el iframe de Stripe Elements (y cualquier librería que pida
 * colores como texto). Es el ÚNICO lugar fuera del CSS con colores escritos:
 * `design-tokens.test.ts` falla si alguno deja de coincidir con globals.css.
 */
export const tokens = {
    ink: "#1B2047",
    ink3: "#636B8D",
    danger: "#BF2E1B",
} as const
