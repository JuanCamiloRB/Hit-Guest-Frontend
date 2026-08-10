/**
 * Sustituto de `server-only` para las pruebas.
 *
 * Ese paquete lo provee Next en tiempo de build y no existe en `node_modules`,
 * así que Vitest no puede resolverlo y cualquier módulo marcado como de servidor
 * fallaba al importarse desde un test. Su única función es romper el build si un
 * módulo de servidor se importa desde el cliente — algo que `next build` sigue
 * verificando de verdad. Acá basta con un módulo vacío.
 */
export {}
