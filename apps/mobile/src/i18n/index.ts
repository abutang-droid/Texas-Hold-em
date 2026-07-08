import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import zh from '../locales/zh-CN.json';
import en from '../locales/en-US.json';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from '@texas-holdem/shared';

function detectLocale(): SupportedLocale {
  const sys = Localization.getLocales()[0]?.languageTag ?? 'en-US';
  if (SUPPORTED_LOCALES.includes(sys as SupportedLocale)) return sys as SupportedLocale;
  if (sys.startsWith('zh')) return 'zh-CN';
  return DEFAULT_LOCALE;
}

i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: zh },
    'en-US': { translation: en },
  },
  lng: detectLocale(),
  fallbackLng: 'en-US',
  interpolation: { escapeValue: false },
});

export default i18n;
