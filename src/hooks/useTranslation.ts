"use client"

import { useCallback } from 'react';
import { useLanguageStore } from '@/store/useLanguageStore';
import { dictionaries, Dictionary } from '@/lib/i18n/dictionaries';

// Helper types for nested object dot notation
type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20, ...0[]]

type Join<K, P> = K extends string | number ?
    P extends string | number ?
    `${K}${"" extends P ? "" : "."}${P}`
    : never : never;

type Paths<T, D extends number = 10> = [D] extends [never] ? never : T extends object ?
    { [K in keyof T]-?: K extends string | number ?
        `${K}` | Join<K, Paths<T[K], Prev[D]>>
        : never
    }[keyof T] : "";

export type TranslationKey = Paths<Dictionary>;

export function useTranslation() {
  const language = useLanguageStore((state) => state.language);
  const dictionary = dictionaries[language];

  const t = useCallback((key: TranslationKey, params?: Record<string, string | number>) => {
    // Navigate through the nested dictionary object using the dot notation path
    const keys = key.split('.');
    let value: any = dictionary;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k as keyof typeof value];
      } else {
        console.warn(`Translation key not found: ${key} for language: ${language}`);
        return key;
      }
    }

    if (typeof value !== 'string') {
      console.warn(`Translation key does not resolve to a string: ${key}`);
      return key;
    }

    // Replace parameters if provided e.g., t('key', { name: 'John' })
    if (params) {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        value = value.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(paramValue));
      });
    }

    return value as string;
  }, [dictionary, language]);

  return { t, language };
}
