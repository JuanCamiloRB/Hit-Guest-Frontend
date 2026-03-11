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
          // If no saved preference, try to detect from browser
          const browserLang = navigator.language.split('-')[0].toLowerCase();
          const supportedLang = Object.keys(dictionaries).includes(browserLang) 
            ? (browserLang as Language) 
            : 'en';
            
          set({ language: supportedLang });
          document.documentElement.lang = supportedLang;
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
