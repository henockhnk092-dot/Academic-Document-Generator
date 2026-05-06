import { useState, useEffect, useRef, useCallback } from "react";

// ── LocalStorage prefs ────────────────────────────────────────────────────────

const PREFS_KEY = "humanizeai_speech_prefs";

export interface SpeechPrefs {
  rate?: number;
  voiceName?: string;
  engineMode?: string;
  language?: string;
}

export function getSpeechPrefs(): SpeechPrefs {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") || {}; }
  catch { return {}; }
}

export function saveSpeechPrefs(updates: Partial<SpeechPrefs>) {
  const p = getSpeechPrefs();
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...p, ...updates }));
}

// ── Azure TTS config ──────────────────────────────────────────────────────────

const AZURE_KEY    = (import.meta as any).env?.VITE_AZURE_TTS_KEY    || "";
const AZURE_REGION = (import.meta as any).env?.VITE_AZURE_TTS_REGION || "eastus";

export const azureAvailable = !!AZURE_KEY;

export const AZURE_VOICES = [
  // English
  { name: "en-US-JennyNeural",     label: "Jenny — US Female (Friendly)",      language: "English",    flag: "🇺🇸" },
  { name: "en-US-GuyNeural",       label: "Guy — US Male (Professional)",       language: "English",    flag: "🇺🇸" },
  { name: "en-US-AriaNeural",      label: "Aria — US Female (Natural)",         language: "English",    flag: "🇺🇸" },
  { name: "en-US-DavisNeural",     label: "Davis — US Male (Casual)",           language: "English",    flag: "🇺🇸" },
  { name: "en-US-JasonNeural",     label: "Jason — US Male (Calm)",             language: "English",    flag: "🇺🇸" },
  { name: "en-GB-SoniaNeural",     label: "Sonia — British Female",             language: "English",    flag: "🇬🇧" },
  { name: "en-GB-RyanNeural",      label: "Ryan — British Male",                language: "English",    flag: "🇬🇧" },
  { name: "en-AU-NatashaNeural",   label: "Natasha — Australian Female",        language: "English",    flag: "🇦🇺" },
  { name: "en-AU-WilliamNeural",   label: "William — Australian Male",          language: "English",    flag: "🇦🇺" },
  { name: "en-IN-NeerjaNeural",    label: "Neerja — Indian Female",             language: "English",    flag: "🇮🇳" },
  { name: "en-CA-ClaraNeural",     label: "Clara — Canadian Female",            language: "English",    flag: "🇨🇦" },
  // French
  { name: "fr-FR-DeniseNeural",    label: "Denise — French Female",             language: "French",     flag: "🇫🇷" },
  { name: "fr-FR-HenriNeural",     label: "Henri — French Male",                language: "French",     flag: "🇫🇷" },
  { name: "fr-CA-SylvieNeural",    label: "Sylvie — Canadian French Female",    language: "French",     flag: "🇨🇦" },
  { name: "fr-CA-JeanNeural",      label: "Jean — Canadian French Male",        language: "French",     flag: "🇨🇦" },
  // Spanish
  { name: "es-ES-ElviraNeural",    label: "Elvira — Spain Female",              language: "Spanish",    flag: "🇪🇸" },
  { name: "es-ES-AlvaroNeural",    label: "Alvaro — Spain Male",                language: "Spanish",    flag: "🇪🇸" },
  { name: "es-MX-DaliaNeural",     label: "Dalia — Mexican Female",             language: "Spanish",    flag: "🇲🇽" },
  { name: "es-MX-JorgeNeural",     label: "Jorge — Mexican Male",               language: "Spanish",    flag: "🇲🇽" },
  { name: "es-AR-ElenaNeural",     label: "Elena — Argentine Female",           language: "Spanish",    flag: "🇦🇷" },
  // Portuguese
  { name: "pt-BR-FranciscaNeural", label: "Francisca — Brazilian Female",       language: "Portuguese", flag: "🇧🇷" },
  { name: "pt-BR-AntonioNeural",   label: "Antonio — Brazilian Male",           language: "Portuguese", flag: "🇧🇷" },
  { name: "pt-PT-RaquelNeural",    label: "Raquel — Portugal Female",           language: "Portuguese", flag: "🇵🇹" },
  { name: "pt-PT-DuarteNeural",    label: "Duarte — Portugal Male",             language: "Portuguese", flag: "🇵🇹" },
  // German
  { name: "de-DE-KatjaNeural",     label: "Katja — German Female",              language: "German",     flag: "🇩🇪" },
  { name: "de-DE-ConradNeural",    label: "Conrad — German Male",               language: "German",     flag: "🇩🇪" },
  { name: "de-AT-IngridNeural",    label: "Ingrid — Austrian Female",           language: "German",     flag: "🇦🇹" },
  // Italian
  { name: "it-IT-ElsaNeural",      label: "Elsa — Italian Female",              language: "Italian",    flag: "🇮🇹" },
  { name: "it-IT-DiegoNeural",     label: "Diego — Italian Male",               language: "Italian",    flag: "🇮🇹" },
  // Arabic
  { name: "ar-SA-ZariyahNeural",   label: "Zariyah — Saudi Female",             language: "Arabic",     flag: "🇸🇦" },
  { name: "ar-SA-HamedNeural",     label: "Hamed — Saudi Male",                 language: "Arabic",     flag: "🇸🇦" },
  { name: "ar-EG-SalmaNeural",     label: "Salma — Egyptian Female",            language: "Arabic",     flag: "🇪🇬" },
  { name: "ar-MA-JamalNeural",     label: "Jamal — Moroccan Male",              language: "Arabic",     flag: "🇲🇦" },
  // Chinese
  { name: "zh-CN-XiaoxiaoNeural",  label: "Xiaoxiao — Mandarin Female",         language: "Chinese",    flag: "🇨🇳" },
  { name: "zh-CN-YunxiNeural",     label: "Yunxi — Mandarin Male",              language: "Chinese",    flag: "🇨🇳" },
  { name: "zh-TW-HsiaoChenNeural", label: "HsiaoChen — Taiwan Female",          language: "Chinese",    flag: "🇹🇼" },
  { name: "zh-HK-HiuGaaiNeural",   label: "HiuGaai — Hong Kong Female",         language: "Chinese",    flag: "🇭🇰" },
  // Japanese
  { name: "ja-JP-NanamiNeural",    label: "Nanami — Japanese Female",           language: "Japanese",   flag: "🇯🇵" },
  { name: "ja-JP-KeitaNeural",     label: "Keita — Japanese Male",              language: "Japanese",   flag: "🇯🇵" },
  // Korean
  { name: "ko-KR-SunHiNeural",     label: "SunHi — Korean Female",              language: "Korean",     flag: "🇰🇷" },
  { name: "ko-KR-InJoonNeural",    label: "InJoon — Korean Male",               language: "Korean",     flag: "🇰🇷" },
  // Hindi
  { name: "hi-IN-SwaraNeural",     label: "Swara — Hindi Female",               language: "Hindi",      flag: "🇮🇳" },
  { name: "hi-IN-MadhurNeural",    label: "Madhur — Hindi Male",                language: "Hindi",      flag: "🇮🇳" },
  // Russian
  { name: "ru-RU-SvetlanaNeural",  label: "Svetlana — Russian Female",          language: "Russian",    flag: "🇷🇺" },
  { name: "ru-RU-DmitryNeural",    label: "Dmitry — Russian Male",              language: "Russian",    flag: "🇷🇺" },
  // Dutch
  { name: "nl-NL-ColetteNeural",   label: "Colette — Dutch Female",             language: "Dutch",      flag: "🇳🇱" },
  { name: "nl-NL-MaartenNeural",   label: "Maarten — Dutch Male",               language: "Dutch",      flag: "🇳🇱" },
  // Turkish
  { name: "tr-TR-EmelNeural",      label: "Emel — Turkish Female",              language: "Turkish",    flag: "🇹🇷" },
  { name: "tr-TR-AhmetNeural",     label: "Ahmet — Turkish Male",               language: "Turkish",    flag: "🇹🇷" },
  // Polish
  { name: "pl-PL-ZofiaNeural",     label: "Zofia — Polish Female",              language: "Polish",     flag: "🇵🇱" },
  { name: "pl-PL-MarekNeural",     label: "Marek — Polish Male",                language: "Polish",     flag: "🇵🇱" },
  // Swedish
  { name: "sv-SE-SofieNeural",     label: "Sofie — Swedish Female",             language: "Swedish",    flag: "🇸🇪" },
  { name: "sv-SE-MattiasNeural",   label: "Mattias — Swedish Male",             language: "Swedish",    flag: "🇸🇪" },
  // Norwegian
  { name: "nb-NO-PernilleNeural",  label: "Pernille — Norwegian Female",        language: "Norwegian",  flag: "🇳🇴" },
  { name: "nb-NO-FinnNeural",      label: "Finn — Norwegian Male",              language: "Norwegian",  flag: "🇳🇴" },
  // Danish
  { name: "da-DK-ChristelNeural",  label: "Christel — Danish Female",           language: "Danish",     flag: "🇩🇰" },
  { name: "da-DK-JeppeNeural",     label: "Jeppe — Danish Male",                language: "Danish",     flag: "🇩🇰" },
  // Finnish
  { name: "fi-FI-NooraNeural",     label: "Noora — Finnish Female",             language: "Finnish",    flag: "🇫🇮" },
  { name: "fi-FI-HarriNeural",     label: "Harri — Finnish Male",               language: "Finnish",    flag: "🇫🇮" },
  // Greek
  { name: "el-GR-AthinaNeural",    label: "Athina — Greek Female",              language: "Greek",      flag: "🇬🇷" },
  { name: "el-GR-NestorasNeural",  label: "Nestoras — Greek Male",              language: "Greek",      flag: "🇬🇷" },
  // Romanian
  { name: "ro-RO-AlinaNeural",     label: "Alina — Romanian Female",            language: "Romanian",   flag: "🇷🇴" },
  { name: "ro-RO-EmilNeural",      label: "Emil — Romanian Male",               language: "Romanian",   flag: "🇷🇴" },
  // Ukrainian
  { name: "uk-UA-PolinaNeural",    label: "Polina — Ukrainian Female",          language: "Ukrainian",  flag: "🇺🇦" },
  { name: "uk-UA-OstapNeural",     label: "Ostap — Ukrainian Male",             language: "Ukrainian",  flag: "🇺🇦" },
  // Czech
  { name: "cs-CZ-VlastaNeural",    label: "Vlasta — Czech Female",              language: "Czech",      flag: "🇨🇿" },
  { name: "cs-CZ-AntoninNeural",   label: "Antonin — Czech Male",               language: "Czech",      flag: "🇨🇿" },
  // Hungarian
  { name: "hu-HU-NoemiNeural",     label: "Noemi — Hungarian Female",           language: "Hungarian",  flag: "🇭🇺" },
  { name: "hu-HU-TamasNeural",     label: "Tamas — Hungarian Male",             language: "Hungarian",  flag: "🇭🇺" },
  // Vietnamese
  { name: "vi-VN-HoaiMyNeural",    label: "HoaiMy — Vietnamese Female",         language: "Vietnamese", flag: "🇻🇳" },
  { name: "vi-VN-NamMinhNeural",   label: "NamMinh — Vietnamese Male",          language: "Vietnamese", flag: "🇻🇳" },
  // Thai
  { name: "th-TH-PremwadeeNeural", label: "Premwadee — Thai Female",            language: "Thai",       flag: "🇹🇭" },
  { name: "th-TH-NiwatNeural",     label: "Niwat — Thai Male",                  language: "Thai",       flag: "🇹🇭" },
  // Indonesian
  { name: "id-ID-GadisNeural",     label: "Gadis — Indonesian Female",          language: "Indonesian", flag: "🇮🇩" },
  { name: "id-ID-ArdiNeural",      label: "Ardi — Indonesian Male",             language: "Indonesian", flag: "🇮🇩" },
  // Malay
  { name: "ms-MY-YasminNeural",    label: "Yasmin — Malay Female",              language: "Malay",      flag: "🇲🇾" },
  { name: "ms-MY-OsmanNeural",     label: "Osman — Malay Male",                 language: "Malay",      flag: "🇲🇾" },
  // Hebrew
  { name: "he-IL-HilaNeural",      label: "Hila — Hebrew Female",               language: "Hebrew",     flag: "🇮🇱" },
  { name: "he-IL-AvriNeural",      label: "Avri — Hebrew Male",                 language: "Hebrew",     flag: "🇮🇱" },
  // Swahili
  { name: "sw-KE-ZuriNeural",      label: "Zuri — Swahili Female",              language: "Swahili",    flag: "🇰🇪" },
  { name: "sw-KE-RafikiNeural",    label: "Rafiki — Swahili Male",              language: "Swahili",    flag: "🇰🇪" },
  // Afrikaans
  { name: "af-ZA-AdriNeural",      label: "Adri — Afrikaans Female",            language: "Afrikaans",  flag: "🇿🇦" },
  { name: "af-ZA-WillemNeural",    label: "Willem — Afrikaans Male",            language: "Afrikaans",  flag: "🇿🇦" },
  // Amharic
  { name: "am-ET-MekdesNeural",    label: "Mekdes — Amharic Female",            language: "Amharic",    flag: "🇪🇹" },
  { name: "am-ET-AmehaNeural",     label: "Ameha — Amharic Male",               language: "Amharic",    flag: "🇪🇹" },
];

export const AZURE_LANGUAGES: string[] = Array.from(
  new Set(AZURE_VOICES.map(v => v.language))
);

// Map BCP-47 language codes to human-readable names (used for browser/Google voice grouping)
export const LANG_CODE_TO_NAME: Record<string, string> = {
  af: "Afrikaans", am: "Amharic", ar: "Arabic", cs: "Czech", da: "Danish",
  de: "German", el: "Greek", en: "English", es: "Spanish", fi: "Finnish",
  fr: "French", he: "Hebrew", hi: "Hindi", hu: "Hungarian", id: "Indonesian",
  it: "Italian", ja: "Japanese", ko: "Korean", ms: "Malay", nb: "Norwegian",
  nl: "Dutch", pl: "Polish", pt: "Portuguese", ro: "Romanian", ru: "Russian",
  sv: "Swedish", sw: "Swahili", th: "Thai", tr: "Turkish", uk: "Ukrainian",
  vi: "Vietnamese", zh: "Chinese",
};

export function getBrowserVoiceLanguage(voice: SpeechSynthesisVoice): string {
  const code = voice.lang.split("-")[0].toLowerCase();
  return LANG_CODE_TO_NAME[code] || voice.lang;
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function langFromVoice(voiceName: string): string {
  const parts = voiceName.split("-");
  return parts.length >= 2 ? `${parts[0]}-${parts[1]}` : "en-US";
}

export async function fetchAzureAudio(text: string, voiceName: string, rate = 1): Promise<Blob> {
  const rateAttr =
    rate === 1 ? "" : ` rate="${rate >= 1 ? "+" : ""}${Math.round((rate - 1) * 100)}%"`;
  const lang = langFromVoice(voiceName);
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}">\
<voice name="${voiceName}"><prosody${rateAttr}>${escapeXml(text)}</prosody></voice></speak>`;

  const res = await fetch(
    `https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": AZURE_KEY,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      },
      body: ssml,
    }
  );
  if (!res.ok) throw new Error(`Azure TTS error ${res.status}`);
  return res.blob();
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSpeech() {
  const [voices, setVoices]             = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking]         = useState(false);
  const [paused, setPaused]             = useState(false);
  const [currentSentIdx, setCurrentSentIdx] = useState(-1);
  const [progress, setProgress]         = useState(0);

  const browserSupported = typeof window !== "undefined" && !!window.speechSynthesis;
  const supported        = browserSupported || azureAvailable;

  const voicesRef  = useRef<SpeechSynthesisVoice[]>([]);
  const cancelRef  = useRef(false);
  const resolveRef = useRef<(() => void) | null>(null);
  const audioRef   = useRef<HTMLAudioElement | null>(null);

  // Load browser voices
  useEffect(() => {
    if (!window.speechSynthesis) return;
    const load = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length) { voicesRef.current = v; setVoices(v); }
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  // Chrome bug: browser TTS silently stops after ~15 s — keep it alive
  useEffect(() => {
    if (!speaking || paused) return;
    if (getSpeechPrefs().engineMode === "azure") return;
    const id = setInterval(() => {
      if (window.speechSynthesis?.speaking && !window.speechSynthesis?.paused) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 14000);
    return () => clearInterval(id);
  }, [speaking, paused]);

  // ── stop ─────────────────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    cancelRef.current = true;
    resolveRef.current?.();
    resolveRef.current = null;
    window.speechSynthesis?.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setSpeaking(false);
    setPaused(false);
    setCurrentSentIdx(-1);
    setProgress(0);
  }, []);

  const pause = useCallback(() => {
    if (getSpeechPrefs().engineMode === "azure") {
      audioRef.current?.pause();
    } else {
      window.speechSynthesis?.pause();
    }
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    if (getSpeechPrefs().engineMode === "azure") {
      audioRef.current?.play?.();
    } else {
      window.speechSynthesis?.resume();
    }
    setPaused(false);
  }, []);

  // ── Browser TTS ───────────────────────────────────────────────────────────────
  const speakBrowser = useCallback((sentences: string[], rate: number, voiceName: string | null) => {
    window.speechSynthesis.cancel();
    cancelRef.current = false;
    setCurrentSentIdx(-1);
    setProgress(0);

    let fullText = "";
    const bounds: Array<{ start: number; idx: number }> = [];
    sentences.forEach((s, idx) => {
      bounds.push({ start: fullText.length, idx });
      fullText += (s || "").trim() + " ";
    });
    const totalLen = fullText.length || 1;

    const utt = new SpeechSynthesisUtterance(fullText.trim());
    utt.rate = rate;
    if (voiceName) {
      const v = voicesRef.current.find(v => v.name === voiceName);
      if (v) utt.voice = v;
    }
    utt.onboundary = (e) => {
      const ci = (e as SpeechSynthesisEvent).charIndex;
      let sentIdx = 0;
      for (let i = bounds.length - 1; i >= 0; i--) {
        if (ci >= bounds[i].start) { sentIdx = bounds[i].idx; break; }
      }
      setCurrentSentIdx(sentIdx);
      setProgress(Math.min(99, Math.round((ci / totalLen) * 100)));
    };
    utt.onstart = () => { setSpeaking(true); setPaused(false); };
    utt.onend   = () => { setSpeaking(false); setPaused(false); setCurrentSentIdx(-1); setProgress(100); };
    utt.onerror = () => { setSpeaking(false); setPaused(false); };
    window.speechSynthesis.speak(utt);
  }, []);

  // ── Azure TTS (sentence-by-sentence for accurate highlighting) ────────────────
  const speakAzure = useCallback(async (sentences: string[], rate: number, voiceName: string) => {
    cancelRef.current = false;
    setSpeaking(true);
    setPaused(false);
    setCurrentSentIdx(-1);
    setProgress(0);

    for (let i = 0; i < sentences.length; i++) {
      if (cancelRef.current) break;
      setCurrentSentIdx(i);
      setProgress(Math.round((i / sentences.length) * 100));
      try {
        const blob = await fetchAzureAudio(sentences[i], voiceName, rate);
        if (cancelRef.current) break;
        const url = URL.createObjectURL(blob);
        await new Promise<void>((resolve) => {
          resolveRef.current = resolve;
          const audio = new Audio(url);
          audioRef.current = audio;
          const done = () => { URL.revokeObjectURL(url); resolveRef.current = null; resolve(); };
          audio.onended = done;
          audio.onerror = done;
          audio.play().catch(done);
        });
      } catch { /* skip failed sentence */ }
    }

    if (!cancelRef.current) {
      setSpeaking(false);
      setCurrentSentIdx(-1);
      setProgress(100);
    }
  }, []);

  // ── Public: speak array of sentence strings ───────────────────────────────────
  const speak = useCallback(
    (sentences: string[], rate = 1, voiceName: string | null = null) => {
      stop();
      const prefs = getSpeechPrefs();
      const useAzure = prefs.engineMode === "azure" && azureAvailable;
      setTimeout(() => {
        if (useAzure) {
          speakAzure(sentences, rate, voiceName || AZURE_VOICES[0].name);
        } else {
          speakBrowser(sentences, rate, voiceName);
        }
      }, 60);
    },
    [stop, speakBrowser, speakAzure]
  );

  return { supported, browserSupported, voices, speaking, paused, currentSentIdx, progress, speak, stop, pause, resume };
}
