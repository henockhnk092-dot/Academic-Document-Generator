import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import fr from "./locales/fr.json";
import es from "./locales/es.json";
import pt from "./locales/pt.json";
import ar from "./locales/ar.json";
import zh from "./locales/zh.json";
import de from "./locales/de.json";
import hi from "./locales/hi.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import sw from "./locales/sw.json";
import am from "./locales/am.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English",    flag: "🇺🇸", ttsLang: "English",    dir: "ltr" },
  { code: "fr", name: "Français",   flag: "🇫🇷", ttsLang: "French",     dir: "ltr" },
  { code: "es", name: "Español",    flag: "🇪🇸", ttsLang: "Spanish",    dir: "ltr" },
  { code: "pt", name: "Português",  flag: "🇧🇷", ttsLang: "Portuguese", dir: "ltr" },
  { code: "ar", name: "العربية",    flag: "🇸🇦", ttsLang: "Arabic",     dir: "rtl" },
  { code: "zh", name: "中文",        flag: "🇨🇳", ttsLang: "Chinese",    dir: "ltr" },
  { code: "de", name: "Deutsch",    flag: "🇩🇪", ttsLang: "German",     dir: "ltr" },
  { code: "hi", name: "हिन्दी",      flag: "🇮🇳", ttsLang: "Hindi",      dir: "ltr" },
  { code: "ja", name: "日本語",      flag: "🇯🇵", ttsLang: "Japanese",   dir: "ltr" },
  { code: "ko", name: "한국어",      flag: "🇰🇷", ttsLang: "Korean",     dir: "ltr" },
  { code: "sw", name: "Kiswahili",  flag: "🇰🇪", ttsLang: "Swahili",    dir: "ltr" },
  { code: "am", name: "አማርኛ",       flag: "🇪🇹", ttsLang: "Amharic",    dir: "ltr" },
] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, fr: { translation: fr }, es: { translation: es },
                 pt: { translation: pt }, ar: { translation: ar }, zh: { translation: zh },
                 de: { translation: de }, hi: { translation: hi }, ja: { translation: ja },
                 ko: { translation: ko }, sw: { translation: sw }, am: { translation: am } },
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGUAGES.map(l => l.code),
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "academicgen_lang",
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false },
  });

const PAGE_TITLES: Record<string, string> = {
  en: "AcademicGen – AI Academic Document Generator",
  fr: "AcademicGen – Générateur de Documents Académiques IA",
  es: "AcademicGen – Generador de Documentos Académicos IA",
  pt: "AcademicGen – Gerador de Documentos Acadêmicos IA",
  ar: "AcademicGen – مولّد الوثائق الأكاديمية بالذكاء الاصطناعي",
  zh: "AcademicGen – AI 学术文档生成器",
  de: "AcademicGen – KI-Akademischer Dokumentengenerator",
  hi: "AcademicGen – AI अकादमिक दस्तावेज़ जनरेटर",
  ja: "AcademicGen – AI 学術文書ジェネレーター",
  ko: "AcademicGen – AI 학술 문서 생성기",
  sw: "AcademicGen – Kizalishi cha Hati za Kitaaluma cha AI",
  am: "AcademicGen – AI አካዳሚክ ሰነድ ጄነሬተር",
};

// Sync document direction and title on language change
i18n.on("languageChanged", (lng) => {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === lng);
  document.documentElement.dir = lang?.dir ?? "ltr";
  document.documentElement.lang = lng;
  document.title = PAGE_TITLES[lng] ?? PAGE_TITLES.en;
});

export default i18n;
