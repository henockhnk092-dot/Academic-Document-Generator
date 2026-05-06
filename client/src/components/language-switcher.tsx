import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe, ChevronDown, Check } from "lucide-react";
import { SUPPORTED_LANGUAGES } from "@/i18n";
import { AZURE_VOICES, saveSpeechPrefs } from "@/hooks/use-speech";
import { setGoogleTranslateLang } from "@/lib/google-translate";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);

  const current = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language)
    ?? SUPPORTED_LANGUAGES[0];

  const handleSelect = (lang: typeof SUPPORTED_LANGUAGES[number]) => {
    i18n.changeLanguage(lang.code);
    setOpen(false);

    // Translate all page content via Google Translate
    setGoogleTranslateLang(lang.code);

    // Auto-select the first Azure voice matching this language
    const firstVoice = AZURE_VOICES.find(v => v.language === lang.ttsLang);
    if (firstVoice) {
      saveSpeechPrefs({ language: lang.ttsLang, voiceName: firstVoice.name });
    } else {
      saveSpeechPrefs({ language: lang.ttsLang });
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm hover:bg-muted transition-colors w-full ${
          compact ? "justify-center" : "justify-between"
        }`}
        title={t("common.language")}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <Globe className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          <span className="text-base leading-none">{current.flag}</span>
          {!compact && (
            <span className="truncate text-xs font-medium">{current.name}</span>
          )}
        </span>
        <ChevronDown className={`h-3 w-3 flex-shrink-0 opacity-50 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Dropdown */}
          <div className="absolute bottom-full mb-2 left-0 w-52 max-h-72 overflow-y-auto bg-card border rounded-xl z-50 shadow-2xl py-1">
            <p className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
              {t("common.language")}
            </p>
            {SUPPORTED_LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted transition-colors ${
                  lang.code === current.code ? "text-primary" : "text-foreground"
                }`}
              >
                <span className="text-base">{lang.flag}</span>
                <span className="flex-1 text-left">{lang.name}</span>
                {lang.code === current.code && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
