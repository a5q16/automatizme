'use client';

/**
 * @fileoverview React context provider and hook for internationalization (i18n).
 *
 * Provides:
 * - LanguageProvider: wraps the app to supply language context
 * - useTranslation(): hook returning { t, lang, setLang, dir }
 *
 * Language detection priority:
 * 1. URL search param ?lang=xx
 * 2. localStorage persisted preference
 * 3. Browser navigator.language
 * 4. Default: 'en'
 */

import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import translations from './translations';

const SUPPORTED_LANGUAGES = ['en', 'fr', 'ar', 'ru', 'zh'];
const STORAGE_KEY = 'digideliver_lang';
const DEFAULT_LANG = 'en';

/** @type {React.Context<null|Object>} */
const LanguageContext = createContext(null);

/**
 * Normalizes and validates a language code.
 * Returns the language code if supported, otherwise null.
 *
 * @param {string|null|undefined} lang - Raw language code
 * @returns {string|null} Valid language code or null
 */
function normalizeLanguage(lang) {
  if (!lang || typeof lang !== 'string') return null;

  // Normalize: lowercase, trim, take the base language (e.g., 'fr-FR' -> 'fr')
  const base = lang.toLowerCase().trim().split('-')[0].split('_')[0];

  if (SUPPORTED_LANGUAGES.includes(base)) {
    return base;
  }

  return null;
}

/**
 * Detects the preferred language using the priority chain:
 * URL param > localStorage > navigator.language > default.
 *
 * @returns {string} Detected language code
 */
function detectLanguage() {
  // 1. Check URL search params
  try {
    if (typeof window !== 'undefined' && window.location) {
      const urlParams = new URLSearchParams(window.location.search);
      const urlLang = normalizeLanguage(urlParams.get('lang'));
      if (urlLang) return urlLang;
    }
  } catch (err) {
    // URLSearchParams may not be available in some environments
    console.warn('[i18n] Could not read URL params:', err.message);
  }

  // 2. Check localStorage
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedLang = normalizeLanguage(localStorage.getItem(STORAGE_KEY));
      if (storedLang) return storedLang;
    }
  } catch (err) {
    // localStorage may be disabled (private browsing, etc.)
    console.warn('[i18n] Could not read localStorage:', err.message);
  }

  // 3. Check browser navigator language
  try {
    if (typeof navigator !== 'undefined' && navigator.language) {
      const navLang = normalizeLanguage(navigator.language);
      if (navLang) return navLang;
    }
  } catch (err) {
    console.warn('[i18n] Could not read navigator.language:', err.message);
  }

  // 4. Default fallback
  return DEFAULT_LANG;
}

/**
 * Persists the selected language to localStorage.
 *
 * @param {string} lang - Language code to persist
 */
function persistLanguage(lang) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY, lang);
    }
  } catch (err) {
    console.warn('[i18n] Could not persist language to localStorage:', err.message);
  }
}

/**
 * LanguageProvider component.
 * Wraps the application (or a subtree) to provide language context.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components
 * @param {string} [props.defaultLang] - Optional override for the default language
 * @returns {React.ReactElement}
 */
export function LanguageProvider({ children, defaultLang }) {
  const [lang, setLangState] = useState(() => {
    // If a defaultLang prop is provided and valid, use it as initial
    const overrideLang = normalizeLanguage(defaultLang);
    if (overrideLang) return overrideLang;
    // Otherwise detect from environment (runs only on client)
    if (typeof window !== 'undefined') {
      return detectLanguage();
    }
    return DEFAULT_LANG;
  });

  // Re-detect language on mount (handles SSR -> client hydration)
  useEffect(() => {
    const detected = detectLanguage();
    setLangState((current) => {
      // Only update if URL param explicitly overrides, or if we're still on default
      // and detection found something better
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const urlLang = normalizeLanguage(urlParams.get('lang'));
        if (urlLang) return urlLang;
      }
      // If no override from default prop, use detected
      if (!normalizeLanguage(defaultLang)) {
        return detected;
      }
      return current;
    });
  }, [defaultLang]);

  /**
   * Sets the active language, validates it, and persists the choice.
   * @param {string} newLang - The new language code
   */
  const setLang = useCallback((newLang) => {
    const validated = normalizeLanguage(newLang);
    if (!validated) {
      console.warn(`[i18n] Unsupported language: "${newLang}", keeping current language.`);
      return;
    }
    setLangState(validated);
    persistLanguage(validated);
  }, []);

  // Compute text direction
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  // Memoize the translation function
  const t = useCallback(
    /**
     * Translates a key to the current language.
     * Falls back to English, then returns the key itself.
     *
     * @param {string} key - Translation key
     * @returns {string} Translated string
     */
    (key) => {
      if (!key || typeof key !== 'string') return '';

      // Try current language first
      const langTranslations = translations[lang];
      if (langTranslations && langTranslations[key] !== undefined) {
        return langTranslations[key];
      }

      // Fall back to English
      const enTranslations = translations[DEFAULT_LANG];
      if (enTranslations && enTranslations[key] !== undefined) {
        return enTranslations[key];
      }

      // Key not found in any language — return key for debugging
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[i18n] Missing translation: "${key}" (lang: ${lang})`);
      }
      return key;
    },
    [lang]
  );

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      t,
      lang,
      setLang,
      dir,
      supportedLanguages: SUPPORTED_LANGUAGES,
    }),
    [t, lang, setLang, dir]
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * Hook to access translation utilities.
 * Must be used within a LanguageProvider.
 *
 * @returns {{ t: (key: string) => string, lang: string, setLang: (lang: string) => void, dir: 'ltr' | 'rtl', supportedLanguages: string[] }}
 * @throws {Error} If used outside of LanguageProvider
 */
export function useTranslation() {
  const context = useContext(LanguageContext);

  if (context === null) {
    throw new Error(
      '[i18n] useTranslation() must be used within a <LanguageProvider>. ' +
      'Wrap your component tree with <LanguageProvider> in your layout.'
    );
  }

  return context;
}

export default LanguageProvider;
