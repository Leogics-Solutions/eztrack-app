'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Language, Translations } from './types';
import { en } from './translations/en';

const translations: Record<Language, Translations> = {
  en,
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  // Force English by default while other languages are disabled.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    localStorage.setItem('language', 'en');
    document.documentElement.setAttribute('lang', 'en');
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', lang);
      // Update HTML lang attribute
      document.documentElement.setAttribute('lang', lang);
    }
  };

  // Update HTML lang attribute when language changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.setAttribute('lang', language);
    }
  }, [language]);

  const value: LanguageContextType = {
    language,
    setLanguage,
    t: translations[language],
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
