import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Language, dictionaries } from '@/lib/i18n/dictionaries';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
  initLanguage: () => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      // Default to English initially
      language: 'en',
      
      setLanguage: (lang: Language) => {
        set({ language: lang });
        // Update html lang attribute for accessibility/SEO
        if (typeof document !== 'undefined') {
          document.documentElement.lang = lang;
        }
      },

      initLanguage: () => {
        if (typeof window === 'undefined') return;

        // Try to get saved language from localStorage (handled by persist middleware automatically)
        const savedData = localStorage.getItem('language-store');
        
        if (!savedData) {
          // If no saved preference, set explicit default to Spanish to not overwrite potential backend settings later
          const defaultLang = 'es';
            
          set({ language: defaultLang });
          document.documentElement.lang = defaultLang;
        } else {
           // Ensure html lang matches saved state on initial load
           try {
             const parsed = JSON.parse(savedData);
             if (parsed.state && parsed.state.language) {
               document.documentElement.lang = parsed.state.language;
             }
           } catch (e) {
             console.error('Failed to parse language store', e);
           }
        }
      },
    }),
    {
      name: 'language-store',
    }
  )
);
