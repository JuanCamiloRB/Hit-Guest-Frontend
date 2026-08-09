import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_LANGUAGE,
  isAvailableLanguage,
  type Language,
} from '@/lib/i18n/dictionaries';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
  initLanguage: () => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      // Español, igual que el `<html lang="es">` que emite app/layout.tsx.
      // Antes era 'en': la app arrancaba declarando un idioma que no sabe
      // renderizar, así que el chip del header decía "EN" sobre una interfaz
      // entera en español.
      language: DEFAULT_LANGUAGE,

      setLanguage: (lang: Language) => {
        // Un idioma sin librería dejaría la interfaz a medio traducir.
        const next = isAvailableLanguage(lang) ? lang : DEFAULT_LANGUAGE;
        set({ language: next });
        if (typeof document !== 'undefined') {
          document.documentElement.lang = next;
        }
      },

      initLanguage: () => {
        if (typeof window === 'undefined') return;

        // El middleware `persist` ya rehidrató lo guardado; aquí solo se
        // resuelve el caso sin preferencia previa y se sincroniza el atributo
        // `lang` del documento.
        const savedData = localStorage.getItem('language-store');

        if (!savedData) {
          // Se respeta el idioma del navegador solo si lo tenemos disponible.
          // Antes caía a 'en' para cualquier navegador no español, que era
          // justo el caso que no podemos servir.
          const browserLang = navigator.language.split('-')[0].toLowerCase();
          const supportedLang = isAvailableLanguage(browserLang)
            ? browserLang
            : DEFAULT_LANGUAGE;

          set({ language: supportedLang });
          document.documentElement.lang = supportedLang;
          return;
        }

        try {
          const parsed = JSON.parse(savedData);
          const saved = parsed?.state?.language;
          const effective = isAvailableLanguage(saved) ? saved : DEFAULT_LANGUAGE;
          set({ language: effective });
          document.documentElement.lang = effective;
        } catch {
          set({ language: DEFAULT_LANGUAGE });
          document.documentElement.lang = DEFAULT_LANGUAGE;
        }
      },
    }),
    {
      name: 'language-store',
      // v0 guardaba 'en' a todo el mundo (era el valor por defecto). Sin esta
      // migración, quien ya tenga 'en' en localStorage se queda atrapado ahí
      // aunque el idioma ya no se ofrezca.
      version: 1,
      migrate: (persisted) => {
        const state = persisted as Partial<LanguageState> | undefined;
        return {
          ...state,
          language: isAvailableLanguage(state?.language)
            ? state.language
            : DEFAULT_LANGUAGE,
        } as LanguageState;
      },
    }
  )
);
