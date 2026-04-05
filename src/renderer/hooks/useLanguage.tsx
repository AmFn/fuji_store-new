import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, locales, getNestedValue, LocaleStrings } from '../lib/i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  locale: LocaleStrings;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('fuji-language') as Language;
    return saved || 'zh';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('fuji-language', lang);
  };

  useEffect(() => {
    const saved = localStorage.getItem('fuji-language') as Language;
    if (saved && saved !== language) {
      setLanguageState(saved);
    }
  }, []);

  const t = (key: string): string => {
    return getNestedValue(locales[language], key);
  };

  const locale = locales[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, locale }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
