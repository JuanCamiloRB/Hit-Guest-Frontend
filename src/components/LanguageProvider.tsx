'use client';

import { useEffect, useState } from 'react';
import { useLanguageStore } from '@/store/useLanguageStore';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const initLanguage = useLanguageStore((state) => state.initLanguage);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    initLanguage();
    setMounted(true);
  }, [initLanguage]);

  // Optionally, to prevent hydration mismatch entirely, you could return null if !mounted,
  // but since we want SSR to work well for most of the page, returning children is better.
  // The translations themselves might suddenly "flip" on client load if the server rendered
  // one language but the client detects another, which is a common tradeoff for static pages.

  return <>{children}</>;
}
