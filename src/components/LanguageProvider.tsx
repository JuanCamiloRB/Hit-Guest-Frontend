'use client';

import { useEffect } from 'react';
import { useLanguageStore } from '@/store/useLanguageStore';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const initLanguage = useLanguageStore((state) => state.initLanguage);

  useEffect(() => {
    initLanguage();
  }, [initLanguage]);

  return <>{children}</>;
}
