import { en } from './en';
import { es } from './es';

export const dictionaries = {
  en,
  es,
} as const;

export type Language = keyof typeof dictionaries;
export type Dictionary = typeof dictionaries.en;
