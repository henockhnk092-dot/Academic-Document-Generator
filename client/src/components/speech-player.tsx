import { useState } from "react";
import { Play, Pause, Square, Volume2, ChevronDown, Zap, Globe } from "lucide-react";
import { azureAvailable, AZURE_VOICES, AZURE_LANGUAGES, getBrowserVoiceLanguage, getSpeechPrefs, saveSpeechPrefs } from "@/hooks/use-speech";

const SPEEDS = [0.5, 1, 1.5, 2];

interface SpeechPlayerProps {
  supported: boolean;
  speaking: boolean;
  paused: boolean;
  progress: number;
  voices: SpeechSynthesisVoice[];
  rate: number;
  voiceName: string;
  engineMode: string;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRateChange: (r: number) => void;
  onVoiceChange: (v: string) => void;
  onEngineModeChange: (m: string) => void;
}

export function SpeechPlayer({
  supported, speaking, paused, progress, voices,
  rate, voiceName, engineMode,
  onPlay, onPause, onStop, onRateChange, onVoiceChange, onEngineModeChange,
}: SpeechPlayerProps) {
  const prefs0 = getSpeechPrefs();
  const [showVoices, setShowVoices] = useState(false);
  const [showLangs, setShowLangs] = useState(false);
  const [selectedLang, setSelectedLang] = useState(prefs0.language ?? "English");

  if (!supported) {
    return (
      <div className="mt-4 rounded-xl px-4 py-3 text-xs text-muted-foreground border bg-muted/20">
        Text-to-speech is not supported in your browser. Use Chrome or Edge for the best experience.
      </div>
    );
  }

  const isAzure = engineMode === "azure" && azureAvailable;

  // Build language list and filtered voices for whichever engine is active
  const azureLangVoices = AZURE_VOICES.filter(v => v.language === selectedLang);
  const browserLangVoices = voices.filter(v => getBrowserVoiceLanguage(v) === selectedLang);
  const activeVoices = isAzure ? azureLangVoices : browserLangVoices;
  const langFlag = AZURE_VOICES.find(v => v.language === selectedLang)?.flag ?? "";

  // Available language list depends on engine
  const browserLanguages = Array.from(new Set(voices.map(getBrowserVoiceLanguage))).sort();
  const activeLangList = isAzure ? AZURE_LANGUAGES : browserLanguages;

  let displayVoice = "Default Voice";
  if (isAzure) {
    const av = AZURE_VOICES.find(v => v.name === voiceName);
    displayVoice = av ? av.label.split("—")[0].trim() : (azureLangVoices[0]?.label.split("—")[0].trim() || "Jenny");
  } else {
    const bv = voices.find(v => v.name === voiceName);
    displayVoice = bv ? bv.name.split("(")[0].trim() : (browserLangVoices[0]?.name.split("(")[0].trim() || "Default");
  }

  const handleLangSelect = (lang: string) => {
    setSelectedLang(lang);
    saveSpeechPrefs({ language: lang });
    setShowLangs(false);
    if (isAzure) {
      const first = AZURE_VOICES.find(v => v.language === lang);
      if (first) { onVoiceChange(first.name); saveSpeechPrefs({ voiceName: first.name }); }
    } else {
      const first = voices.find(v => getBrowserVoiceLanguage(v) === lang);
      if (first) { onVoiceChange(first.name); saveSpeechPrefs({ voiceName: first.name }); }
    }
  };

  const handleVoice = (name: string) => {
    onVoiceChange(name);
    saveSpeechPrefs({ voiceName: name });
    setShowVoices(false);
  };

  const handleRate = (r: number) => {
    onRateChange(r);
    saveSpeechPrefs({ rate: r });
  };

  const handleEngine = (m: string) => {
    onEngineModeChange(m);
    saveSpeechPrefs({ engineMode: m });
  };

  return (
    <div className="mt-4 border rounded-xl p-3 bg-muted/20">
      {/* Engine toggle — only when Azure key is configured */}
      {azureAvailable && (
        <div className="flex items-center gap-2 mb-3 pb-2 border-b">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Voice Quality</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleEngine("browser")}
              className={`text-[10px] px-2 py-1 rounded transition-colors ${
                !isAzure ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              Standard — Free
            </button>
            <button
              onClick={() => handleEngine("azure")}
              className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-colors ${
                isAzure ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Zap size={9} /> Enhanced HD
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Volume2 size={13} className="text-primary flex-shrink-0" />

        {/* Play / Pause */}
        <button
          onClick={speaking && !paused ? onPause : onPlay}
          title={speaking && !paused ? "Pause" : "Play"}
          className="w-8 h-8 rounded-lg bg-primary hover:bg-primary/90 flex items-center justify-center text-primary-foreground flex-shrink-0 transition-colors"
        >
          {speaking && !paused ? <Pause size={13} /> : <Play size={13} />}
        </button>

        {/* Stop */}
        <button
          onClick={onStop}
          disabled={!speaking && !paused}
          title="Stop"
          className="w-8 h-8 rounded-lg border hover:bg-muted flex items-center justify-center disabled:opacity-30 transition-colors flex-shrink-0"
        >
          <Square size={13} />
        </button>

        {/* Progress bar */}
        <div className="flex-1 min-w-[3rem] h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-200"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>

        {/* Speed buttons */}
        <div className="flex items-center gap-1">
          {SPEEDS.map(s => (
            <button
              key={s}
              onClick={() => handleRate(s)}
              className={`text-[10px] px-1.5 py-1 rounded font-mono transition-colors ${
                rate === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Language picker */}
        {activeLangList.length > 1 && (
          <div className="relative">
            <button
              onClick={() => { setShowLangs(p => !p); setShowVoices(false); }}
              className="flex items-center gap-1 border px-2 py-1.5 rounded-lg text-[11px] hover:bg-muted transition-colors"
              title="Select language"
            >
              <Globe size={11} className="opacity-60" />
              <span>{isAzure ? `${langFlag} ` : ""}{selectedLang}</span>
              <ChevronDown size={10} className="opacity-60" />
            </button>
            {showLangs && (
              <div className="absolute left-0 bottom-full mb-1.5 w-44 max-h-52 overflow-y-auto bg-card border rounded-xl z-50 shadow-2xl">
                {activeLangList.map(lang => {
                  const flag = isAzure ? (AZURE_VOICES.find(v => v.language === lang)?.flag ?? "") : "";
                  return (
                    <button key={lang} onClick={() => handleLangSelect(lang)}
                      className={`w-full text-left text-xs px-3 py-2.5 hover:bg-muted transition-colors ${lang === selectedLang ? "text-primary font-medium" : "text-muted-foreground"}`}>
                      {flag}{flag ? " " : ""}{lang}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Voice picker */}
        <div className="relative">
          <button
            onClick={() => { setShowVoices(p => !p); setShowLangs(false); }}
            className="flex items-center gap-1 border px-2.5 py-1.5 rounded-lg text-[11px] hover:bg-muted transition-colors max-w-[140px]"
          >
            <span className="truncate">{displayVoice}</span>
            <ChevronDown size={11} className="flex-shrink-0 opacity-60" />
          </button>

          {showVoices && (
            <div className="absolute right-0 bottom-full mb-1.5 w-64 max-h-52 overflow-y-auto bg-card border rounded-xl z-50 shadow-2xl custom-scrollbar">
              {isAzure ? (
                activeVoices.map(v => (
                  <button
                    key={v.name}
                    onClick={() => handleVoice(v.name)}
                    className={`w-full text-left text-xs px-3 py-2.5 hover:bg-muted transition-colors ${
                      voiceName === v.name ? "text-primary font-medium" : "text-muted-foreground"
                    }`}
                  >
                    {v.flag} {v.label}
                  </button>
                ))
              ) : (
                <>
                  {activeVoices.length === 0 && (
                    <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                      {voices.length === 0 ? <>Loading voices…<br />Try again in a moment.</> : "No voices for this language."}
                    </div>
                  )}
                  {activeVoices.map(v => (
                    <button
                      key={v.name}
                      onClick={() => handleVoice(v.name)}
                      className={`w-full text-left text-xs px-3 py-2 hover:bg-muted transition-colors truncate ${
                        voiceName === v.name ? "text-primary font-medium" : "text-muted-foreground"
                      }`}
                    >
                      {v.name}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
