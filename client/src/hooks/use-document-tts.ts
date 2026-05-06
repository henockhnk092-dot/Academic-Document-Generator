import { useState, useCallback, useEffect, useRef } from "react";

type TTSStatus = "idle" | "playing" | "paused";

interface UseDocumentTTSOptions {
  rate?: number;
  pitch?: number;
  voice?: SpeechSynthesisVoice | null;
}

interface UseDocumentTTSReturn {
  status: TTSStatus;
  currentSectionIndex: number;
  progress: number; // 0-100
  play: (content: DocumentContent) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  restart: () => void;
  isSupported: boolean;
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

// Strip HTML tags and markdown from text for TTS
function stripFormatting(text: string): string {
  if (!text) return "";

  return text
    // Remove HTML tags
    .replace(/<[^>]+>/g, " ")
    // Remove markdown bold/italic
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    // Remove markdown headers
    .replace(/^#{1,6}\s+/gm, "")
    // Remove markdown links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove markdown images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    // Remove bullet points
    .replace(/^[\s]*[•\-\*]\s*/gm, "")
    // Remove HTML entities
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    // Clean up extra whitespace
    .replace(/\s+/g, " ")
    .trim();
}

// Convert document content to array of readable sections
function contentToSections(content: DocumentContent): string[] {
  const sections: string[] = [];

  if (content.title) {
    sections.push(`Title: ${stripFormatting(content.title)}`);
  }

  if (content.abstract) {
    sections.push(`Abstract: ${stripFormatting(content.abstract)}`);
  }

  if (content.html) {
    // For HTML content (like conference papers), just strip and read
    const plainText = stripFormatting(content.html);
    if (plainText.length > 0) {
      // Split into chunks of ~500 words for better TTS handling
      const words = plainText.split(" ");
      for (let i = 0; i < words.length; i += 500) {
        sections.push(words.slice(i, i + 500).join(" "));
      }
    }
    return sections;
  }

  if (content.sections && Array.isArray(content.sections)) {
    content.sections.forEach((section, index) => {
      const heading = section.heading || section.title || `Section ${index + 1}`;
      const sectionText = stripFormatting(section.content || "");
      if (sectionText) {
        sections.push(`${stripFormatting(heading)}. ${sectionText}`);
      }
    });
  }

  if (content.references && Array.isArray(content.references)) {
    const refsText = content.references.map(ref => stripFormatting(ref)).join(". ");
    if (refsText) {
      sections.push(`References. ${refsText}`);
    }
  }

  return sections.filter(s => s.length > 0);
}

export function useDocumentTTS(options: UseDocumentTTSOptions = {}): UseDocumentTTSReturn {
  const { rate = 1, pitch = 1, voice = null } = options;

  const [status, setStatus] = useState<TTSStatus>("idle");
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const sectionsRef = useRef<string[]>([]);
  const contentRef = useRef<DocumentContent | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const isSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSupported]);

  // Update progress when section changes
  useEffect(() => {
    if (sectionsRef.current.length > 0) {
      setProgress(Math.round((currentSectionIndex / sectionsRef.current.length) * 100));
    }
  }, [currentSectionIndex]);

  const speakSection = useCallback((index: number) => {
    if (!isSupported || index >= sectionsRef.current.length) {
      setStatus("idle");
      setCurrentSectionIndex(0);
      setProgress(100);
      return;
    }

    const text = sectionsRef.current[index];
    const utterance = new SpeechSynthesisUtterance(text);

    utterance.rate = rate;
    utterance.pitch = pitch;
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onend = () => {
      // Move to next section
      const nextIndex = index + 1;
      if (nextIndex < sectionsRef.current.length) {
        setCurrentSectionIndex(nextIndex);
        speakSection(nextIndex);
      } else {
        // Finished all sections
        setStatus("idle");
        setCurrentSectionIndex(0);
        setProgress(100);
      }
    };

    utterance.onerror = (event) => {
      // "interrupted" is expected when stopping/cancelling TTS - not a real error
      if (event.error === "interrupted" || event.error === "canceled") {
        return;
      }
      console.error("TTS error:", event.error);
      setStatus("idle");
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [rate, pitch, voice, isSupported]);

  const play = useCallback((content: DocumentContent) => {
    if (!isSupported) return;

    // Cancel any existing speech
    window.speechSynthesis.cancel();

    // Convert content to sections
    const sections = contentToSections(content);
    if (sections.length === 0) return;

    sectionsRef.current = sections;
    contentRef.current = content;
    setCurrentSectionIndex(0);
    setProgress(0);
    setStatus("playing");

    speakSection(0);
  }, [isSupported, speakSection]);

  const pause = useCallback(() => {
    if (!isSupported || status !== "playing") return;
    window.speechSynthesis.pause();
    setStatus("paused");
  }, [isSupported, status]);

  const resume = useCallback(() => {
    if (!isSupported || status !== "paused") return;
    window.speechSynthesis.resume();
    setStatus("playing");
  }, [isSupported, status]);

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setStatus("idle");
    setCurrentSectionIndex(0);
    setProgress(0);
  }, [isSupported]);

  const restart = useCallback(() => {
    if (!isSupported || !contentRef.current) return;

    // Cancel current speech
    window.speechSynthesis.cancel();

    // Restart from beginning
    setCurrentSectionIndex(0);
    setProgress(0);
    setStatus("playing");

    speakSection(0);
  }, [isSupported, speakSection]);

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
  };
}
