import { useState, useCallback, useRef, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { azureAvailable, AZURE_VOICES, fetchAzureAudio, getSpeechPrefs, saveSpeechPrefs } from "@/hooks/use-speech";

type TTSStatus = "idle" | "loading" | "playing" | "paused";

interface UseGeminiTTSOptions {
  tone?: string;
}

interface UseGeminiTTSReturn {
  status: TTSStatus;
  currentSectionIndex: number;
  progress: number;
  play: (content: DocumentContent) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  restart: () => void;
  isSupported: boolean;
  // Azure / engine state
  engineMode: string;
  voiceName: string;
  voices: SpeechSynthesisVoice[];
  setEngineMode: (m: string) => void;
  setVoiceName: (v: string) => void;
  azureAvailable: boolean;
  azureVoices: typeof AZURE_VOICES;
}

interface DocumentContent {
  title?: string;
  abstract?: string;
  sections?: Array<{
    heading?: string;
    title?: string;
    content?: string;
  }>;
  html?: string;
  references?: string[];
}

// Strip HTML tags, markdown, and formatting instructions from text for TTS
function stripFormatting(text: string): string {
  if (!text) return "";

  return text
    // FIRST: Remove entire style blocks (CSS content)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    // Remove entire script blocks
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    // Remove SVG elements
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, "")
    // Remove head section
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    // Remove noscript elements
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
    // Remove comments
    .replace(/<!--[\s\S]*?-->/g, "")
    // Remove figure captions (usually just "Figure X")
    .replace(/<figcaption[^>]*>[\s\S]*?<\/figcaption>/gi, "")
    // Remove nav, aside, footer elements (UI elements)
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    // Now remove remaining HTML tags
    .replace(/<[^>]+>/g, " ")
    // Remove markdown formatting
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^[\s]*[•\-\*]\s*/gm, "")
    // Remove HTML entities
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, " ")
    .replace(/&[a-zA-Z]+;/g, " ")
    // Remove UI labels and preview text that shouldn't be read
    .replace(/\bPaper\s*Preview\b/gi, "")
    .replace(/\b(IEEE|APA|MLA|Chicago)[\s-]?formatted\s*(conference\s*)?(paper|document|report)?\s*preview\b/gi, "")
    .replace(/\bconference\s*paper\s*preview\b/gi, "")
    .replace(/\bdocument\s*preview\b/gi, "")
    .replace(/\breport\s*preview\b/gi, "")
    .replace(/\bthesis\s*preview\b/gi, "")
    .replace(/\bpreview\s*mode\b/gi, "")
    // Remove formatting/styling instructions that shouldn't be read aloud
    .replace(/CUSTOM FORMATTING:[^\n]*/gi, "")
    .replace(/\bFont:\s*[^,\n]+,?/gi, "")
    .replace(/\bSize:\s*\d+\s*pt,?/gi, "")
    .replace(/\bLine Spacing:\s*[\d.]+,?/gi, "")
    .replace(/\bMargins?:\s*[\d.]+\s*cm,?/gi, "")
    .replace(/\bText Align:\s*\w+,?/gi, "")
    .replace(/\bColor:\s*#?[a-zA-Z0-9]+/gi, "")
    .replace(/\bPadding:\s*[\d.]+\s*(cm|px|em|rem)?/gi, "")
    .replace(/font-family:\s*[^;]+;?/gi, "")
    .replace(/font-size:\s*[^;]+;?/gi, "")
    .replace(/text-align:\s*[^;]+;?/gi, "")
    .replace(/line-height:\s*[^;]+;?/gi, "")
    .replace(/padding:\s*[^;]+;?/gi, "")
    .replace(/margin:\s*[^;]+;?/gi, "")
    .replace(/style\s*=\s*"[^"]*"/gi, "")
    .replace(/class\s*=\s*"[^"]*"/gi, "")
    // Remove common styling keywords when they appear as standalone descriptions
    .replace(/\b(Times New Roman|Arial|Helvetica|Georgia|Calibri|Verdana)\b/gi, "")
    .replace(/\b\d+\s*(pt|px|em|rem|cm|mm)\b/gi, "")
    .replace(/\b(left|right|center|justify)\s*align(ed|ment)?\b/gi, "")
    .replace(/\b(single|double|1\.5)\s*spac(e|ing|ed)\b/gi, "")
    // Remove IEEE/document format descriptions
    .replace(/\bIEEE\s*(format|style|template|standard)s?\b/gi, "")
    .replace(/\b(two|2)[\s-]?column\s*(layout|format)?\b/gi, "")
    .replace(/\b(single|one|1)[\s-]?column\s*(layout|format)?\b/gi, "")
    .replace(/\bA4\s*(paper|size|format)?\b/gi, "")
    .replace(/\bLetter\s*(paper|size|format)?\b/gi, "")
    .replace(/\b(paper|page)\s*(size|format|layout|margins?)\b/gi, "")
    .replace(/\bcolumn[\s-]?(count|gap|span|width)\b/gi, "")
    .replace(/\b(page|section|column)[\s-]?break\b/gi, "")
    // Remove document structure labels that shouldn't be read
    .replace(/\bRoman\s*numeral(s)?\b/gi, "")
    .replace(/\b(section|chapter)\s*(heading|title|number)s?\b/gi, "")
    .replace(/\b(header|footer|footnote|endnote)s?\b/gi, "")
    .replace(/\btable\s*of\s*contents\b/gi, "")
    // Remove CSS selectors and properties that might have leaked through
    .replace(/\.[a-zA-Z_-]+[a-zA-Z0-9_-]*\s*\{[^}]*\}/g, "")
    .replace(/#[a-zA-Z_-]+[a-zA-Z0-9_-]*\s*\{[^}]*\}/g, "")
    .replace(/[a-zA-Z-]+\s*:\s*[^;]+;/g, "")
    .replace(/\{[^}]*\}/g, "")
    // Remove CSS keywords
    .replace(/\b(display|flex|grid|block|inline|none|auto|inherit|initial|unset)\b/gi, "")
    .replace(/\b(width|height|max-width|min-width|max-height|min-height)\b/gi, "")
    .replace(/\b(border|background|opacity|overflow|position|top|bottom|left|right)\b/gi, "")
    .replace(/\b(solid|dashed|dotted|hidden|visible|absolute|relative|fixed|sticky)\b/gi, "")
    .replace(/\b(serif|sans-serif|monospace|cursive|fantasy)\b/gi, "")
    .replace(/\brgba?\s*\([^)]+\)/gi, "")
    .replace(/#[0-9a-fA-F]{3,8}\b/g, "")
    // Remove print-related terms
    .replace(/\bprint[\s-]?(ready|format|preview|mode)\b/gi, "")
    .replace(/\b@(media|page|font-face)\b/gi, "")
    // Remove section labels/prefixes (but keep the content after them)
    .replace(/^(Title|Abstract|Introduction|Conclusion|References|Section \d+):\s*/gim, "")
    .replace(/^(I{1,3}V?|IV|V?I{0,3})\.\s*/gm, "") // Roman numerals like I. II. III. IV.
    .replace(/^Figure \d+[.:]\s*/gim, "")
    .replace(/^Table \d+[.:]\s*/gim, "")
    .replace(/^Listing \d+[.:]\s*/gim, "")
    .replace(/^Algorithm \d+[.:]\s*/gim, "")
    // Remove formatting instructions in parentheses
    .replace(/\(\s*\d+\s*pt\s*\)/gi, "")
    .replace(/\(\s*(Times New Roman|Arial|Calibri|Helvetica)\s*\)/gi, "")
    .replace(/\(\s*(justified?|centered?|left|right)\s*\)/gi, "")
    // Remove single letter artifacts and standalone punctuation that shouldn't be read
    .replace(/\b[a-zA-Z]\b(?!\w)/g, " ") // Single letters not part of words
    .replace(/\s+[.,;:!?]+\s+/g, " ") // Standalone punctuation
    // Clean up multiple spaces and trim
    .replace(/\s+/g, " ")
    .trim();
}

// Helper to split text into chunks for TTS
function splitIntoChunks(text: string, maxLength: number = 400): string[] {
  const chunks: string[] = [];
  const words = text.split(" ");
  let currentChunk = "";

  for (const word of words) {
    if ((currentChunk + " " + word).length > maxLength) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = word;
    } else {
      currentChunk = currentChunk ? currentChunk + " " + word : word;
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());

  return chunks;
}

// Convert document content to array of readable sections
// Only reads the actual generated content, no labels or prefixes
function contentToSections(content: DocumentContent): string[] {
  const sections: string[] = [];

  // For HTML content (conference papers), just read the text
  if (content.html) {
    const plainText = stripFormatting(content.html);
    if (plainText.length > 0) {
      sections.push(...splitIntoChunks(plainText));
    }
    return sections;
  }

  // For structured content (reports/thesis), read title, abstract, sections content only
  if (content.title) {
    const title = stripFormatting(content.title);
    if (title) sections.push(title);
  }

  if (content.abstract) {
    const abstract = stripFormatting(content.abstract);
    if (abstract) {
      sections.push(...splitIntoChunks(abstract));
    }
  }

  if (content.sections && Array.isArray(content.sections)) {
    content.sections.forEach((section) => {
      const sectionText = stripFormatting(section.content || "");
      if (sectionText) {
        sections.push(...splitIntoChunks(sectionText));
      }
    });
  }

  // Skip references - users typically don't want to hear citation lists read aloud

  return sections.filter(s => s.length > 0);
}

// Browser-based TTS fallback
function speakWithBrowserTTS(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('Browser TTS not supported'));
      return;
    }

    const speak = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Try to use a good voice
      const voices = speechSynthesis.getVoices();
      const preferredVoice = voices.find(v =>
        v.name.includes('Google') ||
        v.name.includes('Microsoft') ||
        v.lang.startsWith('en')
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onend = () => resolve();
      utterance.onerror = (e) => reject(e);

      speechSynthesis.speak(utterance);
    };

    // Voices may be loaded asynchronously, wait for them if needed
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      speak();
    } else {
      speechSynthesis.onvoiceschanged = () => {
        speechSynthesis.onvoiceschanged = null;
        speak();
      };
      // Fallback: if voices don't load within 500ms, speak anyway
      setTimeout(() => {
        if (speechSynthesis.speaking || speechSynthesis.pending) return;
        speak();
      }, 500);
    }
  });
}

export function useGeminiTTS(options: UseGeminiTTSOptions = {}): UseGeminiTTSReturn {
  const { tone = "professional" } = options;

  const [status, setStatus] = useState<TTSStatus>("idle");
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  // Engine / voice state
  const prefs0 = getSpeechPrefs();
  const [engineMode, setEngineModeRaw] = useState(prefs0.engineMode ?? "azure");
  const [voiceName, setVoiceNameRaw]   = useState(prefs0.voiceName ?? (AZURE_VOICES[0]?.name ?? ""));
  const [voices, setVoices]            = useState<SpeechSynthesisVoice[]>([]);

  // Load browser voices
  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis?.getVoices() ?? []);
    load();
    window.speechSynthesis?.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", load);
  }, []);

  const setEngineMode = (m: string) => { setEngineModeRaw(m); saveSpeechPrefs({ engineMode: m }); };
  const setVoiceName  = (v: string) => { setVoiceNameRaw(v);  saveSpeechPrefs({ voiceName: v }); };

  const sectionsRef = useRef<string[]>([]);
  const contentRef = useRef<DocumentContent | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isStoppedRef = useRef(false);
  const usingBrowserTTSRef = useRef(false);
  const rateLimitHitRef = useRef(false);
  const engineModeRef = useRef(engineMode);
  const voiceNameRef  = useRef(voiceName);
  useEffect(() => { engineModeRef.current = engineMode; }, [engineMode]);
  useEffect(() => { voiceNameRef.current  = voiceName; },  [voiceName]);

  const isSupported = true;

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    // Also stop browser TTS if active
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
  }, []);

  const speakSection = useCallback(async (index: number) => {
    if (isStoppedRef.current || index >= sectionsRef.current.length) {
      setStatus("idle");
      setCurrentSectionIndex(0);
      setProgress(100);
      cleanup();
      return;
    }

    const text = sectionsRef.current[index];
    setStatus("loading");
    setCurrentSectionIndex(index);
    setProgress(Math.round((index / sectionsRef.current.length) * 100));

    // If we already hit rate limit, use browser TTS directly
    if (rateLimitHitRef.current) {
      try {
        // Clean up any previous audio before starting browser TTS
        cleanup();
        setStatus("playing");
        usingBrowserTTSRef.current = true;
        await speakWithBrowserTTS(text);

        if (!isStoppedRef.current) {
          const nextIndex = index + 1;
          if (nextIndex < sectionsRef.current.length) {
            speakSection(nextIndex);
          } else {
            setStatus("idle");
            setCurrentSectionIndex(0);
            setProgress(100);
          }
        }
      } catch (error) {
        console.error("Browser TTS error:", error);
        if (!isStoppedRef.current && index + 1 < sectionsRef.current.length) {
          speakSection(index + 1);
        } else {
          setStatus("idle");
        }
      }
      return;
    }

    // ── Azure TTS path ───────────────────────────────────────────────────────
    if (engineModeRef.current === "azure" && azureAvailable) {
      try {
        const blob = await fetchAzureAudio(text, voiceNameRef.current || AZURE_VOICES[0].name, 1);
        if (isStoppedRef.current) return;
        const audioUrl = URL.createObjectURL(blob);
        cleanup();
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        usingBrowserTTSRef.current = false;
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          if (!isStoppedRef.current) {
            const nextIndex = index + 1;
            if (nextIndex < sectionsRef.current.length) {
              speakSection(nextIndex);
            } else {
              setStatus("idle");
              setCurrentSectionIndex(0);
              setProgress(100);
            }
          }
        };
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          if (!isStoppedRef.current && index + 1 < sectionsRef.current.length) {
            speakSection(index + 1);
          } else {
            setStatus("idle");
          }
        };
        setStatus("playing");
        await audio.play();
        return;
      } catch (azureErr) {
        console.warn("Azure TTS error, falling back to Gemini:", azureErr);
        // fall through to Gemini / browser fallback below
      }
    }

    try {
      // Try Gemini TTS (high quality)
      const response = await apiRequest("POST", "/api/tts/generate", {
        text,
        tone,
      }) as { success?: boolean; audio?: { audioBase64: string; mimeType: string }; error?: string };

      if (isStoppedRef.current) return;

      // Check if we got audio data
      if (response.audio && response.audio.audioBase64) {
        // Convert base64 to blob
        const binaryString = atob(response.audio.audioBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const mimeType = response.audio.mimeType || "audio/wav";
        const audioBlob = new Blob([bytes], { type: mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);

        cleanup();
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        usingBrowserTTSRef.current = false;

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          if (!isStoppedRef.current) {
            const nextIndex = index + 1;
            if (nextIndex < sectionsRef.current.length) {
              speakSection(nextIndex);
            } else {
              setStatus("idle");
              setCurrentSectionIndex(0);
              setProgress(100);
            }
          }
        };

        audio.onerror = () => {
          console.error("Audio playback error");
          URL.revokeObjectURL(audioUrl);
          if (!isStoppedRef.current && index + 1 < sectionsRef.current.length) {
            speakSection(index + 1);
          } else {
            setStatus("idle");
          }
        };

        setStatus("playing");
        await audio.play();
      } else {
        // TTS generation failed, fall back to browser TTS
        console.warn("Gemini TTS failed, using browser TTS fallback");
        // Clean up any previous audio before starting browser TTS
        cleanup();
        setStatus("playing");
        usingBrowserTTSRef.current = true;

        try {
          await speakWithBrowserTTS(text);

          if (!isStoppedRef.current) {
            const nextIndex = index + 1;
            if (nextIndex < sectionsRef.current.length) {
              speakSection(nextIndex);
            } else {
              setStatus("idle");
              setCurrentSectionIndex(0);
              setProgress(100);
            }
          }
        } catch (browserError) {
          console.error("Browser TTS also failed:", browserError);
          if (index + 1 < sectionsRef.current.length) {
            speakSection(index + 1);
          } else {
            setStatus("idle");
            setProgress(100);
          }
        }
      }
    } catch (error: any) {
      console.error("TTS API error:", error);

      // Check if it's a rate limit or server error - switch to browser TTS for remaining
      // Server returns 500 when Gemini API fails (including rate limits)
      if (error?.status === 429 || error?.status === 500 ||
          error?.message?.includes('429') || error?.message?.includes('500') ||
          error?.message?.includes('rate') || error?.message?.includes('quota') ||
          error?.message?.includes('Failed to generate')) {
        console.log("API error detected, switching to browser TTS for remaining sections");
        rateLimitHitRef.current = true;
      }

      // Fall back to browser TTS
      try {
        // Clean up any previous audio before starting browser TTS
        cleanup();
        setStatus("playing");
        usingBrowserTTSRef.current = true;
        await speakWithBrowserTTS(text);

        if (!isStoppedRef.current) {
          const nextIndex = index + 1;
          if (nextIndex < sectionsRef.current.length) {
            speakSection(nextIndex);
          } else {
            setStatus("idle");
            setCurrentSectionIndex(0);
            setProgress(100);
          }
        }
      } catch (browserError) {
        console.error("Browser TTS also failed:", browserError);
        if (!isStoppedRef.current && index + 1 < sectionsRef.current.length) {
          speakSection(index + 1);
        } else {
          setStatus("idle");
        }
      }
    }
  }, [tone, cleanup]);

  const play = useCallback((content: DocumentContent) => {
    isStoppedRef.current = false;
    rateLimitHitRef.current = false; // Reset rate limit flag on new play
    usingBrowserTTSRef.current = false;
    cleanup();

    const sections = contentToSections(content);
    if (sections.length === 0) return;

    sectionsRef.current = sections;
    contentRef.current = content;
    setCurrentSectionIndex(0);
    setProgress(0);

    speakSection(0);
  }, [speakSection, cleanup]);

  const pause = useCallback(() => {
    if (status === "playing") {
      if (usingBrowserTTSRef.current) {
        speechSynthesis.pause();
      } else if (audioRef.current) {
        audioRef.current.pause();
      }
      setStatus("paused");
    }
  }, [status]);

  const resume = useCallback(() => {
    if (status === "paused") {
      if (usingBrowserTTSRef.current) {
        speechSynthesis.resume();
      } else if (audioRef.current) {
        audioRef.current.play();
      }
      setStatus("playing");
    }
  }, [status]);

  const stop = useCallback(() => {
    isStoppedRef.current = true;
    cleanup();
    setStatus("idle");
    setCurrentSectionIndex(0);
    setProgress(0);
  }, [cleanup]);

  const restart = useCallback(() => {
    if (!contentRef.current) return;
    isStoppedRef.current = false;
    rateLimitHitRef.current = false;
    usingBrowserTTSRef.current = false;
    cleanup();
    setCurrentSectionIndex(0);
    setProgress(0);
    speakSection(0);
  }, [speakSection, cleanup]);

  return {
    status,
    currentSectionIndex,
    progress,
    play,
    pause,
    resume,
    stop,
    restart,
    isSupported,
    engineMode,
    voiceName,
    voices,
    setEngineMode,
    setVoiceName,
    azureAvailable,
    azureVoices: AZURE_VOICES,
  };
}
