/**
 * Política de carga de la lista de reservas, compartida por Operaciones, el
 * Calendario y el Tablero. Módulo sin React: Facturación la importa sin
 * depender de un hook.
 */

/** Reintentos ante un «todavía no» (202) de `GET /reservations`. */
export const NOT_READY_RETRIES = 3
/** Espera entre reintentos del 202. */
export const NOT_READY_RETRY_MS = 2500
