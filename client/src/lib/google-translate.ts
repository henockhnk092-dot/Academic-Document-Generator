declare global {
  interface Window {
    doGTranslate?: (langPair: string) => void;
    googleTranslateElementInit?: () => void;
  }
}

// Maps our i18n codes to Google Translate language codes
const GT_CODE: Record<string, string> = {
  en: "en",
  fr: "fr",
  es: "es",
  pt: "pt",
  ar: "ar",
  zh: "zh-CN",
  de: "de",
  hi: "hi",
  ja: "ja",
  ko: "ko",
  sw: "sw",
  am: "am",
};

export function setGoogleTranslateLang(langCode: string): void {
  const gtCode = GT_CODE[langCode] ?? langCode;
  // "en|en" restores the original page language
  const pair = `en|${gtCode}`;

  if (window.doGTranslate) {
    window.doGTranslate(pair);
  } else {
    // GT not loaded yet — retry until the widget is ready
    retrySelect(gtCode, 0);
  }
}

function retrySelect(gtCode: string, attempt: number): void {
  const select = document.querySelector<HTMLSelectElement>(".goog-te-combo");
  if (select) {
    select.value = gtCode;
    select.dispatchEvent(new Event("change"));
    return;
  }
  if (attempt < 20) {
    setTimeout(() => retrySelect(gtCode, attempt + 1), 300);
  }
}
