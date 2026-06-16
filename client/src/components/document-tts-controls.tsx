import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Play, Pause, Square, RotateCcw, Volume2, Loader2, ChevronDown, Zap, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { AZURE_VOICES, AZURE_LANGUAGES, getBrowserVoiceLanguage, azureAvailable, getSpeechPrefs, saveSpeechPrefs } from "@/hooks/use-speech";

interface DocumentTTSControlsProps {
  status: "idle" | "loading" | "playing" | "paused";
  progress: number;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onRestart: () => void;
  disabled?: boolean;
  showProgress?: boolean;
  compact?: boolean;
  className?: string;
  // Azure / engine optional props
  engineMode?: string;
  voiceName?: string;
  voices?: SpeechSynthesisVoice[];
  onEngineModeChange?: (m: string) => void;
  onVoiceChange?: (v: string) => void;
  azureVoices?: typeof AZURE_VOICES;
}

export function DocumentTTSControls({
  status,
  progress,
  onPlay,
  onPause,
  onResume,
  onStop,
  onRestart,
  disabled = false,
  showProgress = true,
  compact = false,
  className,
  engineMode,
  voiceName,
  voices = [],
  onEngineModeChange,
  onVoiceChange,
  azureVoices = AZURE_VOICES,
}: DocumentTTSControlsProps) {
  const { t } = useTranslation();
  const prefs0 = getSpeechPrefs();
  const [showVoices, setShowVoices] = useState(false);
  const [showLangs, setShowLangs] = useState(false);
  const [selectedLang, setSelectedLang] = useState(prefs0.language ?? "English");

  const isPlaying = status === "playing";
  const isPaused = status === "paused";
  const isIdle = status === "idle";
  const isLoading = status === "loading";
  const isAzure = engineMode === "azure" && azureAvailable;
  // Only show the azure/browser toggle when the active engine is already one of those two;
  // other engines (elevenlabs, voicerss, streamelements) are configured in Settings only.
  const showEngineToggle = azureAvailable && !!onEngineModeChange && (!engineMode || ["azure", "browser", undefined].includes(engineMode));

  const azureLangVoices = azureVoices.filter(v => v.language === selectedLang);
  const browserLangVoices = voices.filter(v => getBrowserVoiceLanguage(v) === selectedLang);
  const activeVoices = isAzure ? azureLangVoices : browserLangVoices;

  const browserLanguages = Array.from(new Set(voices.map(getBrowserVoiceLanguage))).sort();
  const activeLangList = isAzure ? AZURE_LANGUAGES : browserLanguages;
  const langFlag = azureVoices.find(v => v.language === selectedLang)?.flag ?? "";

  const handleLangSelect = (lang: string) => {
    setSelectedLang(lang);
    saveSpeechPrefs({ language: lang });
    setShowLangs(false);
    if (onVoiceChange) {
      if (isAzure) {
        const first = azureVoices.find(v => v.language === lang);
        if (first) { onVoiceChange(first.name); saveSpeechPrefs({ voiceName: first.name }); }
      } else {
        const first = voices.find(v => getBrowserVoiceLanguage(v) === lang);
        if (first) { onVoiceChange(first.name); saveSpeechPrefs({ voiceName: first.name }); }
      }
    }
  };

  let displayVoice = "Default";
  if (isAzure) {
    const av = azureVoices.find(v => v.name === voiceName);
    displayVoice = av ? av.label.split("—")[0].trim() : (azureLangVoices[0]?.label.split("—")[0].trim() || "Jenny");
  } else {
    const bv = voices.find(v => v.name === voiceName);
    displayVoice = bv ? bv.name.split("(")[0].trim() : (browserLangVoices[0]?.name.split("(")[0].trim() || t("components.tts.defaultShort"));
  }

  if (compact) {
    // Compact single-button mode for inline use
    return (
      <div className={cn("flex items-center gap-2 flex-wrap", className)}>
        {/* Azure HD toggle (compact) */}
        {showEngineToggle && onEngineModeChange && (
          <button
            onClick={() => onEngineModeChange(isAzure ? "browser" : "azure")}
            title={isAzure ? t("components.tts.hdActive") : t("components.tts.switchToHD")}
            className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors ${
              isAzure ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <Zap size={9} />{isAzure ? "HD" : "HD?"}
          </button>
        )}
        {isIdle && (
          <Button
            size="sm"
            variant="outline"
            onClick={onPlay}
            disabled={disabled}
            title={t("components.tts.readAloud")}
            data-testid="tts-play"
          >
            <Volume2 className="w-4 h-4 mr-1" />
            {t("components.tts.listen")}
          </Button>
        )}
        {isLoading && (
          <Button
            size="sm"
            variant="outline"
            disabled
            title={t("components.tts.loadingAudio")}
            data-testid="tts-loading"
          >
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            {t("common.loading")}
          </Button>
        )}
        {isPlaying && (
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={onPause}
              disabled={disabled}
              title={t("components.tts.pause")}
              className="h-8 w-8"
              data-testid="tts-pause"
            >
              <Pause className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onStop}
              disabled={disabled}
              title={t("components.tts.stop")}
              className="h-8 w-8"
              data-testid="tts-stop"
            >
              <Square className="w-4 h-4" />
            </Button>
          </div>
        )}
        {isPaused && (
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={onResume}
              disabled={disabled}
              title={t("components.tts.resume")}
              className="h-8 w-8"
              data-testid="tts-resume"
            >
              <Play className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onStop}
              disabled={disabled}
              title={t("components.tts.stop")}
              className="h-8 w-8"
              data-testid="tts-stop"
            >
              <Square className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Full control bar with progress
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Engine toggle + voice selector row */}
      {showEngineToggle && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("components.tts.voiceQuality")}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEngineModeChange!("browser")}
              className={`text-[10px] px-2 py-1 rounded transition-colors ${
                !isAzure ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >{t("components.tts.standard")}</button>
            <button
              onClick={() => onEngineModeChange!("azure")}
              className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-colors ${
                isAzure ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            ><Zap size={9} /> {t("components.tts.enhancedHD")}</button>
          </div>
          {activeLangList.length > 1 && (
            <div className="relative">
              <button
                onClick={() => { setShowLangs(p => !p); setShowVoices(false); }}
                className="flex items-center gap-1 border px-2 py-1 rounded text-[11px] hover:bg-muted transition-colors"
                title={t("components.tts.selectLanguage")}
              >
                <Globe size={10} className="opacity-60" />
                <span>{isAzure ? `${langFlag} ` : ""}{selectedLang}</span>
                <ChevronDown size={10} className="opacity-60" />
              </button>
              {showLangs && (
                <div className="absolute left-0 bottom-full mb-1.5 w-44 max-h-52 overflow-y-auto bg-card border rounded-xl z-50 shadow-xl">
                  {activeLangList.map(lang => {
                    const flag = isAzure ? (azureVoices.find(v => v.language === lang)?.flag ?? "") : "";
                    return (
                      <button key={lang} onClick={() => handleLangSelect(lang)}
                        className={`w-full text-left text-xs px-3 py-2 hover:bg-muted transition-colors ${lang === selectedLang ? "text-primary font-medium" : "text-muted-foreground"}`}>
                        {flag}{flag ? " " : ""}{lang}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {onVoiceChange && (
            <div className="relative ml-auto">
              <button
                onClick={() => { setShowVoices(p => !p); setShowLangs(false); }}
                className="flex items-center gap-1 border px-2 py-1 rounded text-[11px] hover:bg-muted transition-colors max-w-[130px]"
              >
                <span className="truncate">{displayVoice}</span>
                <ChevronDown size={10} className="flex-shrink-0 opacity-60" />
              </button>
              {showVoices && (
                <div className="absolute right-0 bottom-full mb-1.5 w-56 max-h-44 overflow-y-auto bg-card border rounded-xl z-50 shadow-xl">
                  {isAzure ? azureLangVoices.map(v => (
                    <button key={v.name} onClick={() => { onVoiceChange(v.name); saveSpeechPrefs({ voiceName: v.name }); setShowVoices(false); }}
                      className={`w-full text-left text-xs px-3 py-2 hover:bg-muted transition-colors ${voiceName === v.name ? "text-primary font-medium" : "text-muted-foreground"}`}>
                      {v.flag} {v.label}
                    </button>
                  )) : browserLangVoices.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-muted-foreground text-center">{t("components.tts.noVoices")}</div>
                  ) : browserLangVoices.map(v => (
                    <button key={v.name} onClick={() => { onVoiceChange(v.name); saveSpeechPrefs({ voiceName: v.name }); setShowVoices(false); }}
                      className={`w-full text-left text-xs px-3 py-2 hover:bg-muted transition-colors truncate ${voiceName === v.name ? "text-primary font-medium" : "text-muted-foreground"}`}>
                      {v.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {isIdle && (
            <Button
              size="sm"
              variant="outline"
              onClick={onPlay}
              disabled={disabled}
              title={t("components.tts.readDocAloud")}
              data-testid="tts-play"
            >
              <Volume2 className="w-4 h-4 mr-2" />
              {t("components.tts.readAloud")}
            </Button>
          )}

          {isLoading && (
            <Button
              size="sm"
              variant="outline"
              disabled
              title={t("components.tts.loadingAudio")}
              data-testid="tts-loading"
            >
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t("common.loading")}
            </Button>
          )}

          {isPlaying && (
            <>
              <Button
                size="icon"
                variant="outline"
                onClick={onPause}
                disabled={disabled}
                title={t("components.tts.pause")}
                data-testid="tts-pause"
              >
                <Pause className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={onStop}
                disabled={disabled}
                title={t("components.tts.stop")}
                data-testid="tts-stop"
              >
                <Square className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={onRestart}
                disabled={disabled}
                title={t("components.tts.restart")}
                data-testid="tts-restart"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </>
          )}

          {isPaused && (
            <>
              <Button
                size="icon"
                variant="outline"
                onClick={onResume}
                disabled={disabled}
                title={t("components.tts.resume")}
                data-testid="tts-resume"
              >
                <Play className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={onStop}
                disabled={disabled}
                title={t("components.tts.stop")}
                data-testid="tts-stop"
              >
                <Square className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={onRestart}
                disabled={disabled}
                title={t("components.tts.restart")}
                data-testid="tts-restart"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>

        {(isLoading || isPlaying || isPaused) && (
          <span className="text-xs text-muted-foreground ml-2">
            {isLoading ? t("common.loading") : isPaused ? t("components.tts.paused") : t("components.tts.reading")} {progress}%
          </span>
        )}
      </div>

      {showProgress && (isLoading || isPlaying || isPaused) && (
        <Progress value={isLoading ? undefined : progress} className="h-1" />
      )}
    </div>
  );
}
