import React, { useState, useEffect, useRef } from 'react';
import {
  Presentation,
  MonitorPlay,
  Image as ImageIcon,
  LayoutTemplate,
  RefreshCw,
  Settings,
  Plus,
  PlusCircle,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  Copy,
  Type,
  Palette,
  Loader2,
  Info,
  FileText,
  Paperclip,
  Table as TableIcon,
  Rows,
  GalleryVerticalEnd,
  FileBox,
  Mic,
  MessageSquare,
  Volume2,
  Pause,
  Play,
  Github,
  Twitter,
  Youtube,
  Instagram,
  Mail,
  Send,
  MessageCircle,
  Sparkles,
  CheckCircle2,
  Zap,
  Layout,
  AlertTriangle,
  Menu,
  Cloud,
  Save,
  Trash2,
  LogOut,
  LogIn,
  Home,
  User,
  UserCircle
} from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy
} from "firebase/firestore";

// --- API Configuration ---
const DEFAULT_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY || "").trim();
const GEMINI_MODEL = (import.meta.env.VITE_GEMINI_MODEL || "gemini-2.5-flash-preview-09-2025").trim();
const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";
const PPTX_LIB_URL = "https://cdn.jsdelivr.net/gh/gitbrent/pptxgenjs@3.12.0/dist/pptxgen.bundle.js";

// --- No Backend Required - Runs fully on client side ---

// --- Firebase Configuration (from environment variables) ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Helper: Dynamic Script Loader for PPTX ---
const loadScript = (src) => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

// --- Helper: PCM to WAV Converter ---
const pcmToWav = (base64PCM, sampleRate = 24000) => {
  const binaryString = atob(base64PCM);
  const len = binaryString.length;
  const buffer = new ArrayBuffer(44 + len);
  const view = new DataView(buffer);

  const writeString = (view, offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + len, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, len, true);

  const pcmData = new Uint8Array(buffer, 44);
  for (let i = 0; i < len; i++) {
    pcmData[i] = binaryString.charCodeAt(i);
  }

  return new Blob([view], { type: 'audio/wav' });
};

// --- Helper: Generate Speech (TTS) ---
const generateSpeech = async (text, tone, apiKey) => {
  const keyToUse = apiKey || DEFAULT_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent?key=${keyToUse}`;

  const cleanText = text.replace(/[*#]/g, '');

  const payload = {
    contents: [{ parts: [{ text: `Say in a ${tone || 'professional'} tone: ${cleanText}` }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: "Kore" }
        }
      }
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let errorText = "TTS API request failed.";
    try { errorText = await response.text(); } catch (e) {}
    throw new Error(`TTS Error: ${errorText.substring(0, 100)}`);
  }

  const data = await response.json();
  const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;

  if (inlineData) {
    const blob = pcmToWav(inlineData.data, 24000);
    return URL.createObjectURL(blob);
  }
  throw new Error("No audio data returned");
};

// --- Helper: Presentation Generation (Gemini) ---
const generatePresentationContent = async (topic, slideCount, style, attachedFiles, apiKey) => {
  const keyToUse = apiKey || DEFAULT_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${keyToUse}`;

  const systemPrompt = `
    You are an elite Presentation Designer and Communication Coach.
    Create a professional PowerPoint presentation on: "${topic}".

    STRICT DESIGN & CONTENT RULES:
    1.  **6x6 Rule**: Maximum 6 bullet points per slide. Maximum 6-7 words per bullet point. NO paragraphs.
    2.  **One Idea Per Slide**: Each slide must focus on a single core message.
    3.  **Readability**: Content must be designed for large projection. Short, punchy keywords.
    4.  **Layout Instructions**: For every slide, specify the layout (e.g., "Split: Text Left / Image Right", "Center: Big Statement").

    CRITICAL LABELING GUIDELINES:
    5.  **Figures**: Must have a numbered caption **BELOW** the image (e.g., "Figure 1: Market Growth").
    6.  **Tables**: Must have a numbered caption **ABOVE** the table (e.g., "Table 1: Budget Breakdown").
    7.  **Visuals**: Explicitly categorize visual elements as 'figure' or 'table'.

    COACHING SESSION:
    8.  **Script**: Provide a verbatim script or detailed talking points for what the speaker should say.
    9.  **Tone**: Provide specific vocal direction (e.g., "Enthusiastic and fast-paced", "Somber and serious").

    MANDATORY STRUCTURE:
    - **Slide 1**: Title Slide.
    - **Slide 2**: Agenda/Roadmap.
    - **Middle Slides**: Core content (must cover technical details).
    - **Second to Last Slide**: References/Bibliography (List sources).
    - **Last Slide**: Thank You / Q&A.

    OUTPUT JSON FORMAT:
    {
      "meta": { "title": "Title", "theme": "Professional", "date": "YYYY-MM-DD" },
      "slides": [
        {
          "type": "title" | "content" | "image_split" | "chart" | "quote",
          "title": "Slide Title",
          "content": ["Bullet 1", "Bullet 2"],
          "layout_guide": "Text left, Image right",
          "visual_prompt": "Detailed prompt for AI image generation",
          "visual_type": "figure" | "table",
          "visual_caption": "Figure X: Description",
          "speaker_script": "Words to say...",
          "speaker_tone": "Confident"
        }
      ]
    }
  `;

  const userParts = [
    { text: `Topic: ${topic}. Target Slides: ${slideCount}. Style: ${style}.` }
  ];

  if (attachedFiles && attachedFiles.length > 0) {
    attachedFiles.forEach((file, index) => {
        if (file.type === 'text') {
            userParts.push({ text: `\n\n[Context File ${index + 1}: ${file.name}]\n${file.data}` });
        } else if (file.type === 'binary') {
             userParts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
             userParts.push({ text: `\n[File Attachment ${index + 1}: ${file.name}] (Visual Context)` });
        }
    });
    userParts.push({ text: "\n\nUse the attached context to inform the slide content." });
  }

  const payload = {
    contents: [{ parts: userParts }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { responseMimeType: "application/json" }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let errorText = "API request failed.";
    try { errorText = await response.text(); } catch (e) {}
    throw new Error(`Generation Error (${response.status}): ${errorText.substring(0, 100)}...`);
  }

  const data = await response.json();
  let rawJsonText = data.candidates[0].content.parts[0].text;
  rawJsonText = rawJsonText.replace(/\\(?!["\/bfnrtu])/g, '\\\\');
  return JSON.parse(rawJsonText);
};

// --- Helper: Image Generation (via Pixabay API - High Quality & CORS-Friendly) ---
const generateSlideImage = async (prompt) => {
  const pixabayApiKey = import.meta.env.VITE_PIXABAY_API_KEY?.trim();

  if (!pixabayApiKey) {
    console.error('❌ Pixabay API key not found in environment variables');
    return null;
  }

  try {
    // Step 1: Remove only very generic presentation-related words, keep descriptive content
    let cleanedPrompt = prompt
      .toLowerCase()
      .replace(/\b(professional|presentation|slide|corporate|style|showing)\b/gi, '')
      .trim();

    // Step 2: Extract meaningful words (keep words > 3 chars, preserve specific terms)
    const words = cleanedPrompt
      .split(/\s+/)
      .filter(w => w.length > 3)
      .filter(w => !/^(this|that|with|from|have|will|should|could|would)$/.test(w)); // Remove only common stop words

    // Step 3: Take up to 6-8 keywords to preserve specificity
    const keywords = words.slice(0, Math.min(8, words.length)).join(' ');

    // Step 4: If still too short, use a larger excerpt from original
    const finalKeywords = keywords.length > 15 ? keywords : cleanedPrompt.substring(0, 80).trim();

    // Step 5: Add variety by including slide-specific context
    const searchKeywords = finalKeywords || prompt.substring(0, 60);

    // Search Pixabay for relevant images (get 10 for more variety)
    const searchUrl = `https://pixabay.com/api/?key=${pixabayApiKey}&q=${encodeURIComponent(searchKeywords)}&image_type=photo&per_page=10&safesearch=true&orientation=horizontal&order=popular`;

    console.log(`🔍 Searching Pixabay for: "${searchKeywords}"`);

    const response = await fetch(searchUrl);
    const data = await response.json();

    if (!data.hits || data.hits.length === 0) {
      console.warn('⚠️ No Pixabay results, trying fallback search');
      // Fallback to generic business/tech images
      const fallbackUrl = `https://pixabay.com/api/?key=${pixabayApiKey}&q=business+technology&image_type=photo&per_page=10&safesearch=true&orientation=horizontal`;
      const fallbackResponse = await fetch(fallbackUrl);
      const fallbackData = await fallbackResponse.json();

      if (!fallbackData.hits || fallbackData.hits.length === 0) {
        throw new Error('No images found');
      }

      data.hits = fallbackData.hits;
    }

    // Get a random high-quality image from results for variety (largeImageURL = 1280px max, CORS-friendly)
    const randomIndex = Math.floor(Math.random() * data.hits.length);
    const imageUrl = data.hits[randomIndex].largeImageURL;
    console.log('✅ Pixabay image found:', imageUrl.substring(0, 80) + '...');

    // Return URL only - base64 conversion happens on-the-fly during PPTX export
    return {
      url: imageUrl,
      source: 'pixabay'
    };
  } catch (error) {
    console.error('❌ Pixabay image generation error:', error);
    return null;
  }
};

// Helper: Convert image URL to base64 (works with CORS-friendly images like Pixabay)
const urlToBase64 = async (url) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('❌ Base64 conversion error:', error);
    return null;
  }
};

// --- Common Components ---

const Message = ({ type, message, icon: Icon, onClose }) => (
  <div className={`p-4 rounded-lg shadow-md flex items-start space-x-3 ${
    type === 'error' ? 'bg-red-100 text-red-800' :
    type === 'success' ? 'bg-green-100 text-green-800' :
    'bg-blue-100 text-blue-800'
  }`}>
    {Icon && <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />}
    <div className="text-sm flex-1">{message}</div>
    {onClose && (
      <button onClick={onClose} className="text-current opacity-70 hover:opacity-100 ml-4">
        <X className="w-4 h-4" />
      </button>
    )}
  </div>
);

const Button = ({ onClick, children, loading = false, disabled = false, className = '', variant = 'primary', type = "button" }) => {
  const baseStyles = "px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 shadow-md flex items-center justify-center gap-2";

  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300 border border-gray-200",
    outline: "bg-transparent border-2 border-blue-600 text-blue-600 hover:bg-blue-50"
  };

  const disabledStyles = "bg-gray-400 cursor-not-allowed text-white border-none";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyles} ${loading || disabled ? disabledStyles : variants[variant]} ${className}`}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
};

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, type === 'info' ? 5000 : 3000);
    return () => clearTimeout(timer);
  }, [onClose, type]);

  const styles = {
    error: 'bg-red-50 border-red-100 text-red-800',
    success: 'bg-green-50 border-green-100 text-green-800',
    info: 'bg-blue-50 border-blue-100 text-blue-800'
  };

  const icons = {
    error: <AlertTriangle size={20} />,
    success: <CheckCircle2 size={20} />,
    info: <Loader2 size={20} className="animate-spin" />
  };

  return (
    <div className={`fixed bottom-6 right-6 z-[110] px-6 py-3 rounded-lg shadow-xl border flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 ${
      styles[type] || 'bg-gray-900 border-gray-800 text-white'
    }`}>
      {icons[type] || <CheckCircle2 size={20} />}
      <span className="font-medium text-sm">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><X size={16} /></button>
    </div>
  );
};

// --- Slide Renderer ---
const Slide = ({ data, index, total, onImageUpdate, apiKey }) => {
  const [loadingImg, setLoadingImg] = useState(false);

  useEffect(() => {
    // Image auto-generation with Pixabay API - high quality stock photos
    const shouldGen = true; // Images will auto-generate for all slides
    if (shouldGen && data.visual_prompt && !data.imgData && (data.type === 'image_split' || data.type === 'title' || data.type === 'chart')) {
      setLoadingImg(true);
      console.log(`🎨 Auto-generating image for slide ${index + 1}:`, data.visual_prompt.substring(0, 50) + '...');
      generateSlideImage(data.visual_prompt)
        .then(imageData => {
          if (imageData) {
            console.log(`✅ Image generated for slide ${index + 1}:`, imageData.url.substring(0, 80) + '...');
            onImageUpdate(index, imageData);
          } else {
            console.warn(`⚠️ No image data returned for slide ${index + 1}`);
          }
        })
        .catch(e => {
          console.error(`❌ Image generation error for slide ${index + 1}:`, e);
          // Silently fail - user can try manual generation button
        })
        .finally(() => setLoadingImg(false));
    }
  }, [data.visual_prompt, data.imgData, index, onImageUpdate]);

  const isSplit = data.type === 'image_split' || data.type === 'chart';
  const isTitle = data.type === 'title';
  const isQuote = data.type === 'quote';
  const isTable = data.visual_type === 'table';

  const Caption = ({ text, position }) => {
    if (!text) return null;
    return (
      <div className={`text-xs md:text-sm font-bold text-gray-700 tracking-wide ${position === 'top' ? 'mb-2 md:mb-3 text-center' : 'mt-2 md:mt-3 text-center'}`}>
        {text}
      </div>
    );
  };

  return (
    <div className="w-full max-w-full bg-white shadow-xl rounded-lg flex flex-col relative border border-gray-200 print:shadow-none print:border-2 print:break-after-page print:mb-8 transition-all duration-300 overflow-hidden">
      <div
        className={`px-2 py-3 sm:px-4 sm:py-4 md:px-8 md:py-6 ${isTitle ? 'text-white flex-grow flex flex-col justify-start md:justify-center items-center text-center py-4 sm:py-6 md:py-8 lg:py-12 rounded-t-lg relative' : 'bg-gray-50 border-b border-gray-200 rounded-t-lg'}`}
        style={isTitle && data.imgData ? {
          backgroundImage: `linear-gradient(rgba(30, 58, 138, 0.7), rgba(30, 58, 138, 0.7)), url(${data.imgData})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        } : isTitle ? { backgroundColor: '#1E3A8A' } : {}}
      >
        <h2 className={`${isTitle ? 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl' : 'text-lg sm:text-xl md:text-2xl lg:text-3xl'} font-bold tracking-tight leading-tight ${isTitle ? 'text-white relative z-10' : 'text-blue-900'} break-words w-full`}>
          {data.title}
        </h2>
        {isTitle && data.content && (
           <div className="mt-4 md:mt-8 text-base sm:text-lg md:text-xl opacity-90 font-light space-y-2 relative z-10">
             {data.content.map((line, i) => <p key={i}>{line}</p>)}
           </div>
        )}
      </div>

      {!isTitle && (
        <div className="flex-grow p-2 sm:p-3 md:p-4 lg:p-6 xl:p-8 flex flex-col md:flex-row gap-3 sm:gap-4 md:gap-6 lg:gap-8">
          <div className={`flex-1 flex flex-col justify-start md:justify-center ${isQuote ? 'items-center text-center italic' : ''}`}>
            <ul className="space-y-2 sm:space-y-3 md:space-y-4 lg:space-y-6">
              {data.content.map((point, i) => {
                // Handle both string and object formats
                if (typeof point === 'string') {
                  return (
                    <li key={i} className="flex items-start gap-2 sm:gap-3 text-sm sm:text-base md:text-lg lg:text-2xl text-gray-800 leading-snug font-medium break-words">
                      {!isQuote && <span className="text-blue-500 mt-1 sm:mt-1.5 flex-shrink-0 text-sm sm:text-base">•</span>}
                      <span>{point}</span>
                    </li>
                  );
                } else if (typeof point === 'object' && point.header) {
                  // Handle object format with header and bullets
                  return (
                    <li key={i} className="flex flex-col gap-2">
                      <div className="flex items-start gap-2 sm:gap-3 text-sm sm:text-base md:text-lg lg:text-2xl text-gray-800 leading-snug font-bold break-words">
                        {!isQuote && <span className="text-blue-500 mt-1 sm:mt-1.5 flex-shrink-0 text-sm sm:text-base">•</span>}
                        <span className="break-words">{point.header}</span>
                      </div>
                      {point.bullets && Array.isArray(point.bullets) && (
                        <ul className="ml-4 sm:ml-6 md:ml-8 space-y-1">
                          {point.bullets.map((bullet, j) => (
                            <li key={j} className="flex items-start gap-1 sm:gap-2 text-xs sm:text-sm md:text-base text-gray-700">
                              <span className="text-blue-400 mt-0.5 sm:mt-1 flex-shrink-0 text-xs sm:text-sm">◦</span>
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                } else {
                  // Fallback for unexpected formats
                  return (
                    <li key={i} className="flex items-start gap-2 sm:gap-3 text-sm sm:text-base md:text-lg lg:text-2xl text-gray-800 leading-snug font-medium break-words">
                      {!isQuote && <span className="text-blue-500 mt-1 sm:mt-1.5 flex-shrink-0 text-sm sm:text-base">•</span>}
                      <span>{JSON.stringify(point)}</span>
                    </li>
                  );
                }
              })}
            </ul>

            {data.layout_guide && (
               <div className="mt-6 pt-4 md:mt-auto md:pt-8 text-[10px] md:text-xs text-gray-400 uppercase tracking-wider font-bold flex items-center gap-2">
                 <LayoutTemplate size={14} />
                 <span className="hidden sm:inline">Layout Note:</span> {data.layout_guide}
               </div>
            )}
          </div>

          {isSplit && (
            <div className="flex-1 flex flex-col justify-start md:justify-center w-full md:w-auto mt-4 md:mt-0">
              {isTable && <Caption text={data.visual_caption} position="top" />}
              <div className="flex-grow bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-300 relative group min-h-[150px] sm:min-h-[200px] md:min-h-[250px]">
                {data.imgData ? (
                  <img src={data.imgData} alt="Slide Visual" className="w-full h-full object-contain bg-gray-50 print:object-scale-down" />
                ) : (
                  <div className="text-center p-4 md:p-6 print:hidden">
                    {loadingImg ? (
                      <Loader2 className="animate-spin mx-auto text-blue-600 mb-2" size={32} />
                    ) : isTable ? (
                      <TableIcon className="mx-auto text-gray-400 mb-2" size={40} />
                    ) : (
                      <ImageIcon className="mx-auto text-gray-400 mb-2" size={40} />
                    )}
                    <p className="text-xs md:text-sm text-gray-500 font-medium px-2 md:px-4">
                      {loadingImg ? "Designing Visual..." : isTable ? "Table Placeholder" : "Figure Placeholder"}
                    </p>
                    {!loadingImg && (
                        <button
                          onClick={() => {
                            if (data.visual_prompt) {
                              setLoadingImg(true);
                              generateSlideImage(data.visual_prompt)
                                .then(imageData => {
                                  if (imageData) {
                                    onImageUpdate(index, imageData);
                                  }
                                })
                                .catch(e => console.error("Image generation error:", e))
                                .finally(() => setLoadingImg(false));
                            }
                          }}
                          className="mt-3 md:mt-4 px-3 py-1.5 md:px-4 md:py-2 bg-blue-600 hover:bg-blue-700 text-white border border-blue-700 shadow-md rounded-full text-xs md:text-sm font-bold cursor-pointer transition-colors"
                          title="Click to generate image"
                        >
                          Generate {isTable ? 'Table View' : 'Figure'}
                        </button>
                    )}
                  </div>
                )}
              </div>
              {!isTable && <Caption text={data.visual_caption} position="bottom" />}
            </div>
          )}
        </div>
      )}

      <div className="bg-white px-4 md:px-6 py-2 flex justify-between items-center text-[10px] md:text-xs text-gray-400 border-t border-gray-100 mt-auto rounded-b-lg">
        <span>Generated Presentation</span>
        <span>{index + 1} / {total}</span>
      </div>
    </div>
  );
};

// --- Presentation Coach ---
const PresentationCoach = ({ script, tone, apiKey }) => {
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const audioRef = useRef(null);

  const handleTogglePlay = async () => {
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (audioUrl) {
        audioRef.current.play();
        setIsPlaying(true);
      } else {
        setIsLoadingAudio(true);
        try {
          const url = await generateSpeech(script, tone, apiKey);
          setAudioUrl(url);
          setTimeout(() => {
             const audio = new Audio(url);
             audio.onended = () => setIsPlaying(false);
             audio.play();
             audioRef.current = audio;
             setIsPlaying(true);
          }, 100);
        } catch (e) {
          console.error("Audio Gen Error", e);
          // Silently fail - audio generation is optional
        } finally {
          setIsLoadingAudio(false);
        }
      }
    }
  };

  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.pause();
    }
    setAudioUrl(null);
    setIsPlaying(false);
  }, [script]);

  return (
    <div className="mt-4 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden print:hidden">
      <div className="bg-blue-50 px-4 py-2 border-b border-blue-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic size={16} className="text-blue-700" />
          <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wide">Presentation Coach</h4>
        </div>
        <button
          onClick={handleTogglePlay}
          disabled={isLoadingAudio || !script}
          className="flex items-center gap-2 px-3 py-1 bg-white border border-blue-200 hover:bg-blue-100 rounded-full transition-colors disabled:opacity-50"
        >
          {isLoadingAudio ? (
            <Loader2 size={12} className="animate-spin text-blue-600" />
          ) : isPlaying ? (
            <Pause size={12} className="text-blue-600" />
          ) : (
            <Play size={12} className="text-blue-600" />
          )}
          <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">
            {isLoadingAudio ? "Loading Voice..." : isPlaying ? "Pause Coach" : "Play Voice"}
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
        <div className="p-4 md:col-span-2">
          <div className="flex items-center gap-2 mb-2 text-gray-500">
            <MessageSquare size={14} />
            <span className="text-xs font-bold uppercase tracking-wider">What to Say</span>
          </div>
          <p className="text-sm text-gray-800 leading-relaxed font-serif text-justify">
            {script || "No specific script generated for this slide."}
          </p>
        </div>
        <div className="p-4 bg-gray-50/50">
          <div className="flex items-center gap-2 mb-2 text-gray-500">
            <Volume2 size={14} />
            <span className="text-xs font-bold uppercase tracking-wider">Tone & Delivery</span>
          </div>
          <div className="text-sm text-gray-700 font-medium italic">
              "{tone || "Natural and conversational"}"
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Core Panels ---

const SettingsPanel = ({ apiKey, setApiKey }) => {
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    setLocalApiKey(apiKey);
  }, [apiKey]);

  const handleSave = () => {
    setApiKey(localApiKey);
    setSaveStatus('success');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto pt-0 pb-1 sm:py-4 md:py-6 px-2 sm:px-4">
      <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-900 mb-1 sm:mb-3 md:mb-4 lg:mb-6 border-b pb-1 sm:pb-2 text-center flex items-center justify-center gap-2">
        <Settings className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" />
        Application Settings
      </h2>
      <div className="bg-white p-2 sm:p-4 md:p-6 lg:p-8 rounded-xl shadow-lg space-y-2 sm:space-y-4 md:space-y-6">
        {saveStatus === 'success' && (
          <Message type="success" message="API Key saved successfully!" icon={CheckCircle2} onClose={() => setSaveStatus(null)} />
        )}
        <div className="space-y-2">
          <label htmlFor="api-key" className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-600" />
            Gemini API Key
          </label>
          <input
            id="api-key"
            type="password"
            value={localApiKey}
            onChange={(e) => {
              setLocalApiKey(e.target.value);
              setSaveStatus(null);
            }}
            placeholder="Enter your Google AI Studio API Key"
            className="w-full p-3 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
          />
          <p className="text-xs text-gray-500 mt-1">Required only if you need to override the system quota.</p>
        </div>
        <Button onClick={handleSave} className="w-full">Save Settings</Button>

        {/* System Status */}
        <div className="space-y-3 pt-4">
          <h4 className="font-bold text-gray-900 text-sm uppercase tracking-wider border-t pt-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            System Status
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
              <span className="text-xs font-medium text-gray-700">Gemini AI</span>
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">Active</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
              <span className="text-xs font-medium text-gray-700">Imagen 3.0</span>
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">Running</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
              <span className="text-xs font-medium text-gray-700">Cloud Storage</span>
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">Connected</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
              <span className="text-xs font-medium text-gray-700">Voice TTS</span>
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">Ready</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ContactPanel = () => (
  <div className="max-w-4xl mx-auto pt-0 pb-1 sm:py-4 md:py-6 px-2 sm:px-4">
    <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-900 mb-1 sm:mb-3 md:mb-4 lg:mb-6 border-b pb-1 sm:pb-2 flex items-center justify-center gap-1.5 sm:gap-2">
       <Mail className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-blue-600 flex-shrink-0" /> <span className="truncate">Contact & Support</span>
    </h2>
    <div className="bg-white p-2 sm:p-4 md:p-6 lg:p-8 rounded-xl shadow-lg space-y-2 sm:space-y-4 md:space-y-6">
      <p className="text-gray-600">Questions or feedback? We'd love to hear from you.</p>
      <form onSubmit={(e) => e.preventDefault()} className="space-y-3">
         <input type="email" placeholder="Your Email" className="w-full p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-500" />
         <textarea placeholder="Your Message..." rows="4" className="w-full p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-500"></textarea>
         <Button className="w-full">Send Message</Button>
      </form>
      <div className="space-y-4 border-t pt-4">
        <h4 className="font-bold text-gray-900 text-sm uppercase tracking-wider">Connect with the Creator</h4>
        <div className="flex flex-wrap gap-4">
           <a href="https://github.com/HorizonHnk/Presentation-Generator.git " target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-900 text-sm flex items-center gap-1"><Github size={16}/> GitHub Repo</a>
           <a href="#" className="text-gray-600 hover:text-blue-500 text-sm flex items-center gap-1"><Twitter size={16}/> @HnkHorizon</a>
           <a href="#" className="text-gray-600 hover:text-red-500 text-sm flex items-center gap-1"><Youtube size={16}/> @HNK2005</a>
           <a href="#" className="text-gray-600 hover:text-pink-500 text-sm flex items-center gap-1"><Instagram size={16}/> hhnk.3693</a>
        </div>
      </div>
    </div>
  </div>
);

const AboutPanel = () => (
  <div className="max-w-4xl mx-auto pt-0 pb-1 sm:py-4 md:py-6 px-2 sm:px-4">
      <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-900 mb-1 sm:mb-3 md:mb-4 lg:mb-6 border-b pb-1 sm:pb-2 flex items-center justify-center gap-1.5 sm:gap-2">
         <Info className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-blue-600 flex-shrink-0" /> <span className="truncate">About</span>
      </h2>
      <div className="bg-white p-2 sm:p-4 md:p-6 lg:p-8 rounded-xl shadow-lg space-y-2 sm:space-y-4 md:space-y-6">
          <p className="text-lg font-semibold text-gray-700">
              BET Slides AI is an advanced tool for generating professional presentation decks with AI-powered speaker notes and coaching.
          </p>

          <div className="space-y-4">
              <h4 className="font-bold text-gray-900 text-sm uppercase tracking-wider border-t pt-4">Powered By</h4>
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Zap className="w-5 h-5 text-indigo-600 mt-1" />
                  <div>
                      <h5 className="font-semibold text-gray-800">Gemini 2.5 Flash</h5>
                      <p className="text-sm text-gray-600">Core generation engine for slides, content structuring, and speech synthesis.</p>
                  </div>
              </div>
          </div>

          <div className="space-y-4">
              <h4 className="font-bold text-gray-900 text-sm uppercase tracking-wider border-t pt-4">Source Code</h4>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-900 text-white rounded-xl shadow-md gap-4">
                  <div className="flex items-center gap-3">
                      <Github className="w-8 h-8 text-gray-300" />
                      <div>
                          <div className="font-bold text-sm">Presentation-Generator</div>
                          <div className="text-xs text-gray-400 break-all">https://github.com/HorizonHnk/Presentation-Generator.git </div>
                      </div>
                  </div>
                  <a
                    href="https://github.com/HorizonHnk/Presentation-Generator.git "
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <Github size={14} />
                    View Repo
                  </a>
              </div>
          </div>
      </div>
  </div>
);

const HomePanel = () => (
  <div className="max-w-4xl mx-auto pt-0 pb-1 sm:py-4 md:py-6 px-2 sm:px-4">
    <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-900 mb-1 sm:mb-3 md:mb-4 lg:mb-6 border-b pb-1 sm:pb-2 flex items-center justify-center gap-1.5 sm:gap-2">
      <Home className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-blue-600 flex-shrink-0" /> <span className="truncate">Welcome to BET Slides AI</span>
    </h2>

    <div className="bg-white p-2 sm:p-4 md:p-6 lg:p-8 rounded-xl shadow-lg space-y-2 sm:space-y-4 md:space-y-6">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white p-3 sm:p-5 md:p-6 lg:p-8 rounded-xl">
        <h3 className="text-base sm:text-lg md:text-xl font-bold mb-1 sm:mb-2">Create Professional Presentations in Seconds</h3>
        <p className="text-sm sm:text-base text-blue-100 mb-2 sm:mb-4">
          Transform your ideas into stunning PowerPoint presentations with AI-powered content generation,
          professional speaker notes, and voice coaching.
        </p>
        <div className="flex justify-center">
          <button
            onClick={() => document.querySelector('[data-view="presentation"]')?.click()}
            className="px-5 py-2 bg-white text-blue-600 rounded-lg font-bold hover:bg-blue-50 transition-colors flex items-center gap-2 text-sm"
          >
            <Sparkles size={18} />
            Start Creating Now
          </button>
        </div>
      </div>

      {/* Key Features */}
      <div className="space-y-1 sm:space-y-3 md:space-y-4">
        <h4 className="font-bold text-gray-900 text-xs sm:text-sm uppercase tracking-wider border-t pt-1 sm:pt-3 md:pt-4">Key Features</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 sm:gap-3">
          <div className="flex items-start gap-2 sm:gap-3">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h5 className="font-semibold text-gray-800 text-xs sm:text-sm">AI-Powered Generation</h5>
              <p className="text-xs text-gray-600">Professional content with Gemini AI</p>
            </div>
          </div>

          <div className="flex items-start gap-2 sm:gap-3">
            <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <h5 className="font-semibold text-gray-800 text-xs sm:text-sm">Voice Coaching</h5>
              <p className="text-xs text-gray-600">AI speaker notes and voice synthesis</p>
            </div>
          </div>

          <div className="flex items-start gap-2 sm:gap-3">
            <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 mt-0.5 flex-shrink-0" />
            <div>
              <h5 className="font-semibold text-gray-800 text-xs sm:text-sm">Custom Images</h5>
              <p className="text-xs text-gray-600">Imagen 3.0 generated visuals</p>
            </div>
          </div>

          <div className="flex items-start gap-2 sm:gap-3">
            <Cloud className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 mt-0.5 flex-shrink-0" />
            <div>
              <h5 className="font-semibold text-gray-800 text-xs sm:text-sm">Cloud Sync</h5>
              <p className="text-xs text-gray-600">Save and access from anywhere</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// --- Sidebar Section Component ---
const SidebarSection = ({ title, children, isOpen, toggleOpen, Icon, isSidebarVisible }) => {
    // Icon-only mode on mobile OR when sidebar is collapsed on desktop
    return (
        <>
            {/* Mobile: Always icon-only */}
            <div className="mb-2 md:hidden">
                <div className="flex flex-col items-center space-y-1">
                    {children}
                </div>
            </div>

            {/* Desktop: Collapsible sections */}
            <div className="mb-2 hidden md:block">
                {!isSidebarVisible ? (
                    // Icon-only mode on desktop
                    <div className="flex flex-col items-center space-y-1">
                        {children}
                    </div>
                ) : (
                    // Full mode on desktop
                    <>
                        <button
                            onClick={toggleOpen}
                            className="w-full flex items-center justify-between p-3 rounded-lg text-gray-800 hover:bg-gray-100 transition-colors group focus:outline-none"
                        >
                            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 group-hover:text-blue-600">
                                <Icon className="w-4 h-4" />
                                {title}
                            </span>
                            {isOpen ? (
                                <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
                            ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
                            )}
                        </button>
                        {isOpen && (
                            <div className="mt-1 space-y-1 pl-2 border-l-2 border-gray-100 ml-3">
                                {children}
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    );
};

// --- Main Logic Wrapped as a Component ---
const PresentationSession = ({ apiKey, user, savedPresentation }) => {
  const [step, setStep] = useState('input');
  const [topic, setTopic] = useState('');
  const [slideCount, setSlideCount] = useState(8);
  const [style, setStyle] = useState('Corporate');
  const [presentation, setPresentation] = useState(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [viewMode, setViewMode] = useState('slideshow');
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [projectName, setProjectName] = useState('');
  const fileInputRef = useRef(null);

  // Load saved presentation if passed from parent
  useEffect(() => {
    if (savedPresentation) {
      setPresentation(savedPresentation);
      setTopic(savedPresentation.meta?.title || '');
      setStep('results');
      setCurrentSlideIndex(0);
    }
  }, [savedPresentation]);

  const handleSurpriseMe = () => {
    const topics = [
      // Technology & Innovation
      "Future of Artificial Intelligence", "Quantum Computing Revolution", "Blockchain Beyond Cryptocurrency",
      "5G and 6G Networks", "Internet of Things Ecosystem", "Cybersecurity Best Practices",
      "Edge Computing Architecture", "Neural Networks and Deep Learning", "Augmented Reality Applications",
      "Virtual Reality in Education", "Autonomous Vehicles Technology", "Robotics and Automation",

      // Business & Marketing
      "Q3 Marketing Strategy", "Digital Transformation Roadmap", "E-commerce Growth Strategies",
      "Customer Experience Optimization", "Brand Identity Development", "Social Media Marketing Trends",
      "Data-Driven Decision Making", "Agile Project Management", "Remote Work Best Practices",
      "Startup Pitch Deck", "Product Launch Strategy", "Supply Chain Optimization",

      // Science & Environment
      "Sustainable Energy Solutions", "Climate Change Mitigation", "Circular Economy Models",
      "Renewable Energy Technologies", "Ocean Conservation Strategies", "Urban Green Spaces",
      "Biodiversity Preservation", "Carbon Footprint Reduction", "Zero Waste Living",

      // Space & Exploration
      "Space Colonization Challenges", "Mars Exploration Timeline", "Satellite Technology",
      "Asteroid Mining Potential", "Space Tourism Industry", "Lunar Base Development",

      // Health & Wellness
      "Mental Health Awareness", "Preventive Healthcare", "Telemedicine Revolution",
      "Nutrition and Longevity", "Fitness Technology Trends", "Personalized Medicine",
      "Sleep Science and Productivity", "Mindfulness in Workplace",

      // Education & Learning
      "Future of Online Education", "Gamification in Learning", "STEM Education Strategies",
      "Lifelong Learning Culture", "Educational Technology Tools", "Student Engagement Techniques",

      // Finance & Economics
      "Cryptocurrency Investment", "Decentralized Finance (DeFi)", "Financial Literacy Programs",
      "Stock Market Analysis", "Economic Recovery Strategies", "Personal Finance Management",

      // Social & Culture
      "Diversity and Inclusion", "Work-Life Balance", "Generation Z Trends",
      "Cultural Heritage Preservation", "Social Impact Initiatives", "Community Building Strategies"
    ];
    setTopic(topics[Math.floor(Math.random() * topics.length)]);
  };

  const handleGenerate = async () => {
    if (!topic) return;
    setStep('generating');
    try {
      const data = await generatePresentationContent(topic, slideCount, style, files, apiKey);
      setPresentation(data);
      setStep('results');
      setCurrentSlideIndex(0);
    } catch (e) {
      console.error(e);
      setToast({ type: 'error', message: 'Generation failed: ' + e.message });
      setStep('input');
    }
  };

  const updateSlideImage = (index, imageData) => {
    setPresentation(prev => {
      const newSlides = [...prev.slides];
      // Store only URL for display - base64 conversion happens on-the-fly during PPTX export
      newSlides[index] = {
        ...newSlides[index],
        imgData: imageData?.url || imageData // Support both new object format and old URL string
      };
      return { ...prev, slides: newSlides };
    });
  };

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files);
    Promise.all(selected.map(file => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve({
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            type: file.type.startsWith('image') ? 'binary' : 'text',
            mimeType: file.type,
            data: file.type.startsWith('image') ? ev.target.result.split(',')[1] : ev.target.result
        });
        if (file.type.startsWith('image')) reader.readAsDataURL(file);
        else reader.readAsText(file);
    }))).then(loaded => setFiles(prev => [...prev, ...loaded]));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id) => setFiles(prev => prev.filter(f => f.id !== id));

  const copySlideContent = () => {
     const slide = presentation.slides[currentSlideIndex];
     const text = `TITLE: ${slide.title}\n\nCONTENT:\n${slide.content.join('\n')}\n\nSCRIPT:\n${slide.speaker_script}`;
     navigator.clipboard.writeText(text);
     setToast({ type: 'success', message: 'Copied to clipboard!' });
  };

  // Removed Print PDF functionality - only PPTX export is supported

  const handleExportPPTX = async () => {
    try {
      setExporting(true);
      setToast({ type: 'info', message: 'Creating PowerPoint presentation...' });

      await loadScript(PPTX_LIB_URL);
      if (!window.PptxGenJS) throw new Error("PPTX Lib failed");
      const pptx = new window.PptxGenJS();
      pptx.layout = 'LAYOUT_16x9';
      pptx.author = 'BET Slides AI';
      pptx.title = presentation.meta.title;

      // Convert images to base64 on-the-fly during export
      setToast({ type: 'info', message: 'Converting images for PowerPoint...' });

      for (let index = 0; index < presentation.slides.length; index++) {
        const slide = presentation.slides[index];
        const slideObj = pptx.addSlide();

        // Add white background
        slideObj.background = { color: 'FFFFFF' };

        if (slide.type === 'title') {
          // Title Slide - Dark blue background with centered text
          slideObj.background = { color: '1E3A8A' };
          slideObj.addText(slide.title, {
            x: 0.5,
            y: 1.8,
            w: '90%',
            h: 1.5,
            fontSize: 44,
            bold: true,
            color: 'FFFFFF',
            align: 'center',
            valign: 'middle'
          });
          if (slide.content && slide.content.length > 0) {
            slideObj.addText(slide.content.join('\n'), {
              x: 0.5,
              y: 3.5,
              w: '90%',
              fontSize: 18,
              color: 'E0E0E0',
              align: 'center'
            });
          }

          // Add background image for title slide if available
          if (slide.imgData) {
            try {
              // Convert URL to base64 on-the-fly for PPTX embedding
              const imgBase64 = await urlToBase64(slide.imgData);
              if (imgBase64) {
                slideObj.addImage({
                  data: imgBase64,
                  x: 0,
                  y: 0,
                  w: '100%',
                  h: '100%',
                  sizing: { type: 'cover', w: '100%', h: '100%' },
                  transparency: 60 // Make it semi-transparent so text is readable
                });
                console.log(`✅ Background image embedded in title slide ${index + 1}`);
              }
            } catch (err) {
              console.error(`❌ Failed to embed background image in title slide ${index + 1}:`, err);
            }
          }
        } else {
          // Content Slides
          // Header background (light gray)
          slideObj.addShape(pptx.shapes.RECTANGLE, {
            x: 0, y: 0, w: '100%', h: 0.8,
            fill: { color: 'F9FAFB' },
            line: { color: 'E5E7EB', width: 1 }
          });

          // Title
          slideObj.addText(slide.title, {
            x: 0.5,
            y: 0.2,
            w: '90%',
            h: 0.5,
            fontSize: 28,
            bold: true,
            color: '1E3A8A'
          });

          // Content area
          if (slide.content && slide.content.length > 0) {
            const hasImagePlaceholder = (slide.type === 'image_split' || slide.type === 'chart') && slide.visual_caption;
            const contentWidth = hasImagePlaceholder ? '45%' : '90%';

            // Format content
            const contentText = slide.content.map(item => {
              if (typeof item === 'string') {
                return { text: item, options: { bullet: true, breakLine: true } };
              } else if (typeof item === 'object' && item.header) {
                const lines = [{ text: item.header, options: { bold: true, breakLine: true } }];
                if (item.bullets && Array.isArray(item.bullets)) {
                  item.bullets.forEach(bullet => {
                    lines.push({ text: '  • ' + bullet, options: { breakLine: true } });
                  });
                }
                return lines;
              }
              return { text: String(item), options: { bullet: true, breakLine: true } };
            }).flat();

            slideObj.addText(contentText, {
              x: 0.5,
              y: 1.2,
              w: contentWidth,
              h: 4,
              fontSize: 16,
              color: '374151',
              valign: 'top'
            });

            // Add image from Pixabay (CORS-friendly, can embed in PPTX)
            if (hasImagePlaceholder) {
              if (slide.imgData) {
                // Convert URL to base64 on-the-fly for PPTX embedding
                try {
                  const imgBase64 = await urlToBase64(slide.imgData);
                  if (imgBase64) {
                    slideObj.addImage({
                      data: imgBase64,
                      x: '52%',
                      y: 1.2,
                      w: '45%',
                      h: 4,
                      sizing: { type: 'contain', w: '45%', h: 4 }
                    });
                    console.log(`✅ Image embedded in PPTX for slide ${index + 1}`);
                  } else {
                    throw new Error('Base64 conversion returned null');
                  }
                } catch (err) {
                  console.error(`❌ Failed to embed image in slide ${index + 1}:`, err);
                  // Fallback to placeholder if image embedding fails
                  slideObj.addText('[Image unavailable]', {
                    x: '52%',
                    y: 2.5,
                    w: '45%',
                    fontSize: 14,
                    bold: true,
                    color: 'CC0000',
                    align: 'center'
                  });
                }

                // Add caption below image
                if (slide.visual_caption) {
                  const captionY = slide.visual_type === 'table' ? 1.0 : 5.3;
                  slideObj.addText(slide.visual_caption, {
                    x: '52%',
                    y: captionY,
                    w: '45%',
                    fontSize: 10,
                    bold: true,
                    color: '6B7280',
                    align: 'center'
                  });
                }
              } else {
                // No base64 data available - show placeholder
                slideObj.addShape(pptx.shapes.RECTANGLE, {
                  x: '52%',
                  y: 1.2,
                  w: '45%',
                  h: 4,
                  fill: { color: 'F3F4F6' },
                  line: { color: 'D1D5DB', width: 2, dashType: 'dash' }
                });

                slideObj.addText('[Click "Generate Figure" to add image]', {
                  x: '52%',
                  y: 2.5,
                  w: '45%',
                  fontSize: 12,
                  bold: true,
                  color: '9CA3AF',
                  align: 'center'
                });

                if (slide.visual_caption) {
                  const captionY = slide.visual_type === 'table' ? 1.0 : 5.3;
                  slideObj.addText(slide.visual_caption, {
                    x: '52%',
                    y: captionY,
                    w: '45%',
                    fontSize: 10,
                    bold: true,
                    color: '6B7280',
                    align: 'center'
                  });
                }
              }
            }
          }

          // Footer
          slideObj.addText(`${index + 1} / ${presentation.slides.length}`, {
            x: '85%',
            y: '92%',
            w: '12%',
            fontSize: 10,
            color: '9CA3AF',
            align: 'right'
          });

          slideObj.addText('Generated Presentation', {
            x: '5%',
            y: '92%',
            w: '40%',
            fontSize: 10,
            color: '9CA3AF'
          });
        }

        // Add speaker notes
        if (slide.speaker_script) {
          slideObj.addNotes(`Speaker Notes:\n\n${slide.speaker_script}\n\nTone: ${slide.speaker_tone || 'Professional'}`);
        }
      }

      pptx.writeFile({ fileName: `${presentation.meta.title || 'Presentation'}.pptx` });
      setToast({ type: 'success', message: 'PowerPoint exported successfully!' });
    } catch (e) {
      console.error('PPTX Export Error:', e);
      setToast({ type: 'error', message: 'Export failed: ' + e.message });
    } finally {
      setExporting(false);
    }
  };

  const openSaveDialog = () => {
    setProjectName(presentation.meta?.title || topic || '');
    setShowSaveDialog(true);
  };

  const saveProject = async () => {
    if (!user) return;
    setSaving(true);
    setShowSaveDialog(false);
    try {
      // Serialize presentation data to avoid nested arrays
      const serializedPresentation = {
        meta: presentation.meta,
        slides: presentation.slides.map(slide => ({
          type: slide.type,
          title: slide.title,
          content: JSON.stringify(slide.content || []), // Serialize arrays as strings
          layout_guide: slide.layout_guide || '',
          visual_prompt: slide.visual_prompt || '',
          visual_type: slide.visual_type || '',
          visual_caption: slide.visual_caption || '',
          speaker_script: slide.speaker_script || '',
          speaker_tone: slide.speaker_tone || '',
          imgData: slide.imgData || ''
          // Note: imgBase64 is NOT stored in Firestore to avoid 1MB document limit
          // Images will be converted to base64 on-the-fly during PPTX export
        })),
        userId: user.uid,
        createdAt: serverTimestamp(),
        topic: projectName.trim() || presentation.meta?.title || topic || 'Untitled'
      };

      await addDoc(collection(db, "projects"), serializedPresentation);
      setToast({ type: 'success', message: 'Project saved to cloud!' });
      setProjectName('');
    } catch (e) {
      console.error("Save error:", e);
      setToast({ type: 'error', message: 'Failed to save: ' + e.message });
    } finally {
      setSaving(false);
    }
  };

  // Input Step
  if (step === 'input') {
    return (
      <div className="max-w-4xl mx-auto pt-0 pb-1 sm:py-4 md:py-6 px-2 sm:px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-900 mb-1 sm:mb-3 md:mb-4 lg:mb-6 border-b pb-1 sm:pb-2 text-center">
            Create perfect slides, <span className="text-blue-600">instantly.</span>
        </h2>

        <div className="bg-white p-2 sm:p-4 md:p-6 lg:p-8 rounded-xl shadow-lg border border-gray-200 space-y-2 sm:space-y-4 md:space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5 sm:mb-3">Topic</label>
            <div className="relative">
               <input type="text" value={topic} onChange={e => setTopic(e.target.value)} className="w-full p-4 md:p-5 pr-12 md:pr-14 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-base md:text-lg text-gray-900" placeholder="e.g. Q3 Marketing Strategy..." />
               <button onClick={handleSurpriseMe} className="absolute right-3 md:right-4 top-3 md:top-4 p-2 text-purple-500 hover:bg-purple-50 rounded-full" title="Surprise Me"><Sparkles size={20}/></button>
            </div>
          </div>

          <div>
             <div className="flex justify-between mb-2"><label className="text-sm font-bold text-gray-700">Reference Files</label><span className="text-xs text-gray-400">PDF, Text, Images</span></div>
             <div className="flex flex-wrap gap-2 mb-2">
                {files.map((f, i) => (
                    <span key={f.id || i} className="bg-blue-50 text-blue-800 text-xs px-2 py-1 rounded flex items-center gap-1">
                        <FileText size={12}/> {f.name.substring(0, 15)}...
                        <button onClick={() => removeFile(f.id)} className="ml-1 text-red-500"><X size={12}/></button>
                    </span>
                ))}
             </div>
             <button onClick={() => fileInputRef.current.click()} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-600 flex items-center justify-center gap-2"><Paperclip size={18}/> Attach Files</button>
             <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5 sm:mb-3">Length</label>
              <select value={slideCount} onChange={e => setSlideCount(Number(e.target.value))} className="w-full p-3 md:p-4 bg-gray-50 border border-gray-200 rounded-xl text-base md:text-lg text-gray-900">
                <option value={5}>5 Slides</option>
                <option value={8}>8 Slides</option>
                <option value={10}>10 Slides</option>
                <option value={12}>12 Slides</option>
                <option value={15}>15 Slides</option>
                <option value={20}>20 Slides</option>
                <option value={25}>25 Slides</option>
                <option value={30}>30 Slides</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5 sm:mb-3">Style</label>
              <select value={style} onChange={e => setStyle(e.target.value)} className="w-full p-3 md:p-4 bg-gray-50 border border-gray-200 rounded-xl text-base md:text-lg text-gray-900"><option value="Corporate">Corporate</option><option value="Creative">Creative</option><option value="Academic">Academic</option></select>
            </div>
          </div>

          <button onClick={handleGenerate} disabled={!topic} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 md:py-5 rounded-xl font-bold text-lg md:text-xl shadow-lg flex items-center justify-center gap-2 md:gap-3 disabled:opacity-50"><MonitorPlay size={24}/> Generate Deck</button>
        </div>
      </div>
    );
  }

  // Generating Step
  if (step === 'generating') {
    return (
       <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <Loader2 size={64} className="text-blue-600 animate-spin mb-6" />
          <h2 className="text-2xl font-bold text-gray-900">Drafting Presentation...</h2>
          <p className="text-gray-500 mt-2">Applying design rules and generating speaker notes.</p>
       </div>
    );
  }

  // Results Step
  return (
    <div className="animate-in fade-in duration-500 flex flex-col h-full">
       {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

       {/* Save Dialog */}
       {showSaveDialog && (
         <>
           <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowSaveDialog(false)} />
           <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
             <h3 className="text-xl font-bold text-gray-900 mb-4">Save Project</h3>
             <div className="space-y-4">
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-2">Project Name</label>
                 <input
                   type="text"
                   value={projectName}
                   onChange={(e) => setProjectName(e.target.value)}
                   placeholder="Enter project name..."
                   className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
                   onKeyDown={(e) => e.key === 'Enter' && saveProject()}
                   autoFocus
                 />
               </div>
               <div className="flex gap-3">
                 <button
                   onClick={() => setShowSaveDialog(false)}
                   className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                 >
                   Cancel
                 </button>
                 <button
                   onClick={saveProject}
                   disabled={!projectName.trim()}
                   className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                 >
                   Save
                 </button>
               </div>
             </div>
           </div>
         </>
       )}

       {/* Toolbar */}
       <div className="flex justify-between items-center mb-2 sm:mb-4 md:mb-6 pb-2 sm:pb-3 md:pb-4 border-b border-gray-200 print:hidden">
           <button onClick={() => { setPresentation(null); setStep('input'); }} className="text-[10px] sm:text-xs md:text-sm font-bold text-gray-500 hover:text-gray-900 flex items-center gap-0.5 sm:gap-1"><ChevronLeft size={14} className="sm:w-4 sm:h-4"/> <span className="hidden sm:inline">Back to Edit</span><span className="sm:hidden">Back</span></button>
           <div className="flex gap-1 sm:gap-2">
              {user && (
                <button
                  onClick={openSaveDialog}
                  disabled={saving}
                  className="px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 bg-green-600 text-white rounded-lg text-[10px] sm:text-xs font-bold flex items-center gap-1 sm:gap-2 hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={12} className="sm:w-3.5 sm:h-3.5 animate-spin"/> : <Save size={12} className="sm:w-3.5 sm:h-3.5"/>}
                  <span className="hidden sm:inline">Save</span>
                </button>
              )}
              <div className="flex bg-gray-100 rounded-lg p-0.5 sm:p-1">
                 <button onClick={() => setViewMode('slideshow')} className={`px-1.5 py-1 sm:px-2 sm:py-1 md:px-3 md:py-1.5 text-[10px] sm:text-xs font-bold rounded ${viewMode === 'slideshow' ? 'bg-white shadow text-blue-900' : 'text-gray-500'}`}><span className="hidden sm:inline">Slideshow</span><span className="sm:hidden">Show</span></button>
                 <button onClick={() => setViewMode('scroll')} className={`px-1.5 py-1 sm:px-2 sm:py-1 md:px-3 md:py-1.5 text-[10px] sm:text-xs font-bold rounded ${viewMode === 'scroll' ? 'bg-white shadow text-blue-900' : 'text-gray-500'}`}>Scroll</button>
              </div>
              <button
                onClick={handleExportPPTX}
                disabled={exporting}
                className={`px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 rounded-lg text-[10px] sm:text-xs font-bold flex items-center gap-1 sm:gap-2 ${exporting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-900 hover:bg-blue-800'} text-white print:hidden`}
              >
                {exporting ? <Loader2 size={12} className="sm:w-3.5 sm:h-3.5 animate-spin" /> : <FileBox size={12} className="sm:w-3.5 sm:h-3.5"/>}
                <span className="hidden sm:inline">{exporting ? 'Exporting...' : 'Export PPTX'}</span>
                <span className="sm:hidden">{exporting ? 'Export' : 'PPTX'}</span>
              </button>
           </div>
       </div>

       {/* Slideshow View */}
       {viewMode === 'slideshow' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
             <div className="lg:col-span-3 overflow-y-auto custom-scrollbar pr-2 space-y-2 max-h-[calc(100vh-10rem)] hidden lg:block print:hidden">
                {presentation.slides.map((slide, idx) => (
                   <button key={idx} onClick={() => setCurrentSlideIndex(idx)} className={`w-full text-left p-3 rounded-lg border-2 transition-all ${idx === currentSlideIndex ? 'border-blue-600 bg-blue-50' : 'border-transparent hover:bg-white'}`}>
                      <div className="flex items-center gap-2"><span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${idx === currentSlideIndex ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>{idx + 1}</span><span className="text-xs font-bold truncate text-gray-900">{slide.title}</span></div>
                   </button>
                ))}
             </div>
             <div className="lg:col-span-9 print:col-span-12 flex flex-col gap-4 pb-24 print:pb-0">
                 {/* Navigation Controls - Always Visible */}
                 <div className="flex justify-between bg-white p-3 rounded-lg shadow-sm border mb-2 print:hidden">
                    <button
                      onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
                      disabled={currentSlideIndex === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-gray-100 transition-colors"
                    >
                      <ChevronLeft size={20} className="text-blue-700"/>
                      <span className="text-sm font-semibold text-blue-700 hidden sm:inline">Previous</span>
                    </button>

                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
                      <span className="text-sm font-bold text-gray-700">Slide</span>
                      <span className="text-lg font-bold text-blue-700">{currentSlideIndex + 1}</span>
                      <span className="text-sm font-bold text-gray-500">of</span>
                      <span className="text-lg font-bold text-gray-700">{presentation.slides.length}</span>
                    </div>

                    <button
                      onClick={() => setCurrentSlideIndex(Math.min(presentation.slides.length - 1, currentSlideIndex + 1))}
                      disabled={currentSlideIndex === presentation.slides.length - 1}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-gray-100 transition-colors"
                    >
                      <span className="text-sm font-semibold text-blue-700 hidden sm:inline">Next</span>
                      <ChevronRight size={20} className="text-blue-700"/>
                    </button>
                 </div>

                 <Slide data={presentation.slides[currentSlideIndex]} index={currentSlideIndex} total={presentation.slides.length} onImageUpdate={updateSlideImage} apiKey={apiKey} />
                 <PresentationCoach script={presentation.slides[currentSlideIndex].speaker_script} tone={presentation.slides[currentSlideIndex].speaker_tone} apiKey={apiKey} />
             </div>
          </div>
       )}

       {/* Scroll View */}
       {viewMode === 'scroll' && (
          <div className="space-y-10 pb-24">
             {presentation.slides.map((slide, idx) => (
                <div key={idx}>
                   <Slide data={slide} index={idx} total={presentation.slides.length} onImageUpdate={updateSlideImage} apiKey={apiKey} />
                   <PresentationCoach script={slide.speaker_script} tone={slide.speaker_tone} apiKey={apiKey} />
                </div>
             ))}
          </div>
       )}
    </div>
  );
};

// --- App Shell ---
const App = () => {
  const [currentView, setCurrentView] = useState('home');
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY);
  const [isToolsOpen, setIsToolsOpen] = useState(true);
  const [isAppOpen, setIsAppOpen] = useState(true);
  const [isLibraryOpen, setIsLibraryOpen] = useState(true); // Default open for visibility
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true); // Sidebar visibility state
  const [toast, setToast] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Auth & Data State
  const [user, setUser] = useState(null);
  const [savedProjects, setSavedProjects] = useState([]);
  const [activePresentation, setActivePresentation] = useState(null); // To load saved data

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Projects
  useEffect(() => {
    if (!user) {
      setSavedProjects([]);
      return;
    }
    // Firestore real-time listener (without orderBy to avoid index requirement)
    const q = query(collection(db, "projects"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by createdAt on client side
      projs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA; // Newest first
      });
      setSavedProjects(projs);
    }, (error) => {
      console.error("Firestore query error:", error);
      if (error.code === 'failed-precondition') {
        console.warn("⚠️ Firestore index required. Create it in Firebase Console to load saved projects.");
      }
    });
    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      setToast({ type: 'error', message: 'Login failed: ' + e.message });
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleDeleteProject = async (id, e) => {
    e.stopPropagation(); // Prevent loading when clicking delete
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteDoc(doc(db, "projects", deleteConfirmId));
      setToast({ type: 'success', message: 'Project deleted successfully!' });
    } catch (e) {
      console.error("Delete error:", e);
      setToast({ type: 'error', message: 'Failed to delete project' });
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleLoadProject = (project) => {
    // Deserialize the project data
    const deserializedProject = {
      ...project,
      slides: project.slides.map(slide => ({
        ...slide,
        content: typeof slide.content === 'string' ? JSON.parse(slide.content) : slide.content
      }))
    };
    setActivePresentation(deserializedProject);
    setCurrentView('presentation');
    setIsMobileMenuOpen(false);
  };

  const closeSidebarOnMobile = () => {
    setIsMobileMenuOpen(false);
  };

  const renderNavItem = (title, view, Icon) => (
      <button
        key={view}
        data-view={view}
        onClick={() => {
            setCurrentView(view);
            closeSidebarOnMobile();
            setActivePresentation(null); // Clear active project if switching views manually
        }}
        className={`w-full flex items-center p-2 rounded-lg transition-colors justify-center ${isSidebarVisible ? 'md:space-x-3 md:text-left md:justify-start' : ''} ${currentView === view ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
        title={title}
      >
        <Icon className={`w-4 h-4 ${currentView === view ? 'text-blue-600' : 'text-gray-400'}`} />
        {isSidebarVisible && <span className="text-sm hidden md:inline">{title}</span>}
      </button>
  );

  return (
    <div className="min-h-screen bg-gray-100 font-sans antialiased md:flex md:flex-row overflow-x-hidden">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setDeleteConfirmId(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Project?</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to delete this project? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </>
      )}

      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b px-2 py-2 sm:px-4 sm:py-3 flex items-center justify-between sticky top-0 z-50 shadow-sm min-w-0">
        <div
          className="font-bold text-blue-800 flex items-center gap-1 sm:gap-2 cursor-pointer hover:opacity-80 transition-opacity text-sm sm:text-base truncate flex-1 min-w-0"
          onClick={() => {
            setCurrentView('home');
            setActivePresentation(null);
            setIsMobileMenuOpen(false);
          }}
        >
           <Presentation className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
           <span className="truncate">BET Slides AI</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(prev => !prev)}
          className="p-2 hover:bg-gray-100 rounded-lg flex-shrink-0 ml-2 border border-gray-200 bg-white shadow-sm"
          aria-label="Toggle menu"
        >
           {isMobileMenuOpen ? <X className="w-6 h-6 text-blue-600" /> : <Menu className="w-6 h-6 text-blue-600" />}
        </button>
      </div>

      {/* Sidebar (Responsive & Collapsible with Icon Mode) */}
      <aside className={`
          fixed left-0 top-0 bottom-0 bg-white shadow-xl transition-all duration-300 ease-in-out z-30
          ${isMobileMenuOpen ? 'translate-x-0 w-20' : '-translate-x-full md:translate-x-0'}
          ${isSidebarVisible ? 'md:w-64' : 'md:w-16'}
          md:relative md:flex md:flex-col md:border-r md:border-gray-200 md:h-screen md:sticky md:z-40
      `}>
        <div className={`border-b border-gray-200 hidden md:flex items-center ${isSidebarVisible ? 'p-6 justify-between' : 'p-4 justify-center flex-col gap-3'}`}>
          {isSidebarVisible ? (
            <>
              <button
                onClick={() => {
                  setCurrentView('home');
                  setActivePresentation(null);
                }}
                className="text-2xl font-black text-blue-800 flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <Presentation className="w-6 h-6" /> BET Slides AI
              </button>
              <button
                onClick={() => setIsSidebarVisible(prev => !prev)}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-900 transition-colors"
                title="Collapse Sidebar"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setCurrentView('home');
                  setActivePresentation(null);
                }}
                className="p-2 hover:bg-blue-100 rounded-lg text-blue-800 transition-colors"
                title="BET Slides AI"
              >
                <Presentation className="w-6 h-6" />
              </button>
              <button
                onClick={() => setIsSidebarVisible(true)}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-900 transition-colors"
                title="Expand Sidebar"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        <div className={`flex flex-col space-y-0.5 flex-1 overflow-y-auto justify-center pt-16 sm:pt-20 md:pt-0 p-1.5 ${isSidebarVisible ? 'md:p-4' : 'md:p-2'}`}>

          <SidebarSection title="Creation Tools" isOpen={isToolsOpen} toggleOpen={() => setIsToolsOpen(!isToolsOpen)} Icon={Zap} isSidebarVisible={isSidebarVisible}>
            {renderNavItem('Create Slides', 'presentation', PlusCircle)}
          </SidebarSection>

          {/* MY LIBRARY SECTION */}
          <SidebarSection title="My Library" isOpen={isLibraryOpen} toggleOpen={() => setIsLibraryOpen(!isLibraryOpen)} Icon={Cloud} isSidebarVisible={isSidebarVisible}>
             {user ? (
               <div className="space-y-2">
                  <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                    {savedProjects.length === 0 && <p className="text-xs text-gray-400 text-center py-2 hidden md:block">No saved projects yet.</p>}
                    {savedProjects.map(p => (
                       <div key={p.id} className="group relative">
                          {/* Mobile: Vertical stack with name and delete */}
                          <div className="md:hidden flex flex-col items-center p-1 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200">
                             <FileText size={14} className="text-blue-500 mb-1" onClick={() => handleLoadProject(p)}/>
                             <span className="text-[8px] font-medium text-gray-700 text-center leading-tight mb-0.5 max-w-full px-0.5 line-clamp-2" onClick={() => handleLoadProject(p)}>{p.topic || "Untitled"}</span>
                             <button onClick={(e) => handleDeleteProject(p.id, e)} className="text-red-500 hover:text-red-700 p-0.5 rounded" title="Delete">
                                <Trash2 size={10} />
                             </button>
                          </div>
                          {/* Desktop: Horizontal layout */}
                          <div className="hidden md:flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200" onClick={() => handleLoadProject(p)} title={p.topic || "Untitled"}>
                             <div className="flex items-center gap-2 overflow-hidden">
                                <FileText size={14} className="text-blue-500 flex-shrink-0"/>
                                <span className="text-xs font-medium text-gray-700 truncate">{p.topic || "Untitled"}</span>
                             </div>
                             <button onClick={(e) => handleDeleteProject(p.id, e)} className="text-gray-300 hover:text-red-500 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 size={12} />
                             </button>
                          </div>
                       </div>
                    ))}
                  </div>
               </div>
             ) : isSidebarVisible ? (
               <div className="p-2 hidden md:block">
                 <p className="text-xs text-gray-400 text-center py-2">Sign in to access your saved projects.</p>
               </div>
             ) : null}
          </SidebarSection>

          <SidebarSection title="Application Info" isOpen={isAppOpen} toggleOpen={() => setIsAppOpen(!isAppOpen)} Icon={Layout} isSidebarVisible={isSidebarVisible}>
            {renderNavItem('Home', 'home', Home)}
            {renderNavItem('Settings', 'settings', Settings)}
            {renderNavItem('Contact', 'contact', Mail)}
            {renderNavItem('About', 'about', Info)}
          </SidebarSection>
        </div>

        {/* Footer with User Profile/Sign In */}
        <div className="border-t border-gray-200 bg-gray-50">
          {/* Mobile: Always icon-only */}
          <div className="p-3 flex justify-center md:hidden">
            {user ? (
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                title="Log Out"
              >
                <LogOut size={20} />
              </button>
            ) : (
              <button
                onClick={handleLogin}
                className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                title="Sign In with Google"
              >
                <LogIn size={20} />
              </button>
            )}
          </div>

          {/* Desktop: Full or icon-only based on isSidebarVisible */}
          <div className="hidden md:block">
            {isSidebarVisible ? (
              /* Full view */
              user ? (
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <UserCircle className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-bold text-gray-900 truncate">{user.displayName || 'User'}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full py-2 bg-white hover:bg-red-50 text-red-600 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border border-red-200 transition-colors"
                  >
                    <LogOut size={14} /> Log Out
                  </button>
                </div>
              ) : (
                <div className="p-4">
                  <p className="text-xs text-gray-500 mb-3 text-center">Sign in to save and manage your presentations.</p>
                  <button
                    onClick={handleLogin}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors"
                  >
                    <LogIn size={14} /> Sign In with Google
                  </button>
                </div>
              )
            ) : (
              /* Icon-only view */
              <div className="p-3 flex justify-center">
                {user ? (
                  <button
                    onClick={handleLogout}
                    className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                    title="Log Out"
                  >
                    <LogOut size={20} />
                  </button>
                ) : (
                  <button
                    onClick={handleLogin}
                    className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                    title="Sign In with Google"
                  >
                    <LogIn size={20} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className={`transition-all duration-300 overflow-y-auto bg-gray-100
        ${isMobileMenuOpen ? 'ml-20 w-[calc(100%-5rem)]' : 'ml-0 w-full'}
        md:ml-0 md:flex-1 md:w-auto
        min-h-[calc(100vh-4rem)] sm:min-h-[calc(100vh-5rem)] md:h-screen
      `}>
        <div className="p-0 sm:p-2 md:p-3 lg:p-4 max-w-[1600px] mx-auto h-full min-w-0">
          {currentView === 'presentation' && (
             <PresentationSession
                apiKey={apiKey}
                user={user}
                savedPresentation={activePresentation}
             />
          )}
          {currentView === 'home' && <HomePanel />}
          {currentView === 'settings' && <SettingsPanel apiKey={apiKey} setApiKey={setApiKey} />}
          {currentView === 'contact' && <ContactPanel />}
          {currentView === 'about' && <AboutPanel />}
        </div>
      </main>
    </div>
  );
};

export default App;