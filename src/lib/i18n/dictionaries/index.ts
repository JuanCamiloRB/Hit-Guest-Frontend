import { en } from './en';
import { es } from './es';

export const dictionaries = {
  en,
  es,
} as const;

export type Language = keyof typeof dictionaries;
export type Dictionary = typeof dictionaries.en;

/**
 * El idioma del producto. HitGuest es español-first y `app/layout.tsx` ya
 * declara `<html lang="es">`; el store decía 'en' y se contradecían.
 */
export const DEFAULT_LANGUAGE: Language = "es";

/**
 * Idiomas que la interfaz puede RENDERIZAR de verdad hoy.
 *
 * Ojo: NO se deriva de `dictionaries`. Existe una entrada `en`, pero solo cubre
 * lo que ya pasa por `t()` (header, login, facturación, títulos de pestaña).
 * Todo lo demás está escrito en español directamente en el JSX, así que elegir
 * inglés hoy no traduce la app: dejaría al PM en una interfaz mezclada.
 *
 * Regla para textos nuevos que pasen por aquí: se escriben en `es` y en `en` a
 * la vez (la prueba de paridad lo exige).
 *
 * Para habilitar inglés cuando exista la librería: añadir "en" a esta lista.
 * Es el único cambio necesario — el selector y la detección de idioma leen de
 * aquí.
 */
export const AVAILABLE_LANGUAGES = ["es"] as const satisfies readonly Language[];

export function isAvailableLanguage(value: unknown): value is Language {
  return typeof value === "string"
    && (AVAILABLE_LANGUAGES as readonly string[]).includes(value);
}
