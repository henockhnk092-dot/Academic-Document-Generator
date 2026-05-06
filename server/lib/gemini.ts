import { GoogleGenAI } from "@google/genai";

const AI_API_KEY = process.env.GEMINI_API_KEY || "";

const ai = new GoogleGenAI({ apiKey: AI_API_KEY });

const LANG_NAMES: Record<string, string> = {
  en: "English", fr: "French", es: "Spanish", pt: "Portuguese",
  ar: "Arabic", zh: "Chinese (Simplified)", de: "German", hi: "Hindi",
  ja: "Japanese", ko: "Korean", sw: "Swahili", am: "Amharic",
};

function langInstruction(langCode?: string): string {
  if (!langCode || langCode === "en") return "";
  const name = LANG_NAMES[langCode] ?? langCode;
  return `\n\nLANGUAGE REQUIREMENT: Write ALL content exclusively in ${name}. This includes the title, abstract, all headings, body text, table headers, captions, speaker notes, and reference entries. Do not use English anywhere.`;
}

function repairJson(jsonString: string): any {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.log("Attempting to repair truncated JSON...");
    console.log("Raw response length:", jsonString.length);
    console.log("First 500 chars:", jsonString.substring(0, 500));
    console.log("Last 500 chars:", jsonString.substring(jsonString.length - 500));

    let repaired = jsonString.trim();

    // Detect and remove repeating garbage patterns at the end
    const repeatingPattern = /(.{1,50})\1{3,}$/;
    if (repeatingPattern.test(repaired.substring(Math.max(0, repaired.length - 1000)))) {
      console.log("Detected repeating pattern at end, removing...");
      const match = repaired.substring(Math.max(0, repaired.length - 1000)).match(repeatingPattern);
      if (match) {
        const patternStartInSuffix = match.index!;
        const actualStartIndex = Math.max(0, repaired.length - 1000) + patternStartInSuffix;
        repaired = repaired.substring(0, actualStartIndex);
        console.log("Removed repeating pattern, new length:", repaired.length);
      }
    }

    // Remove trailing comma
    if (repaired.endsWith(',')) {
      repaired = repaired.slice(0, -1);
    }

    // Find the last complete JSON object/array by searching backwards for valid closing braces
    const attempts = [];

    // Try to find the last valid closing brace position
    for (let searchEnd = repaired.length - 1; searchEnd > repaired.length / 2; searchEnd--) {
      if (repaired[searchEnd] !== '}' && repaired[searchEnd] !== ']') continue;

      const candidate = repaired.substring(0, searchEnd + 1);

      let openBraces = 0;
      let openBrackets = 0;
      let inString = false;
      let escaped = false;

      for (let i = 0; i < candidate.length; i++) {
        const char = candidate[i];

        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === '\\') {
          escaped = true;
          continue;
        }

        if (char === '"' && !escaped) {
          inString = !inString;
          continue;
        }

        if (!inString) {
          if (char === '{') openBraces++;
          if (char === '}') openBraces--;
          if (char === '[') openBrackets++;
          if (char === ']') openBrackets--;
        }
      }

      // If balanced, try to parse
      if (openBraces === 0 && openBrackets === 0 && !inString) {
        try {
          const parsed = JSON.parse(candidate);
          console.log("Successfully repaired JSON at position", searchEnd);
          return parsed;
        } catch (e) {
          // Continue searching
        }
      }
    }

    console.error("JSON repair failed completely");
    throw new Error("Failed to parse AI response as JSON");
  }
}

export interface GenerateContentOptions {
  model?: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json";
}

export async function generateContent(
  prompt: string,
  options: GenerateContentOptions = {}
): Promise<string> {
  if (!AI_API_KEY) {
    console.warn("Gemini API key not configured");
    throw new Error("AI API key not configured. Please add GEMINI_API_KEY to your environment variables.");
  }

  const {
    model = "gemini-2.5-flash",
    systemInstruction,
    temperature = 0.7,
    maxTokens = 8192,
    responseFormat = "text",
  } = options;

  try {
    const config: any = {
      temperature,
      maxOutputTokens: maxTokens,
    };

    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }

    if (responseFormat === "json") {
      config.responseMimeType = "application/json";
    }

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config,
    });

    return response.text || "";
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error(`Failed to generate content: ${error}`);
  }
}

export async function generateReportContent(
  topic: string,
  targetLength: string,
  tone: string,
  generateImages: boolean = true,
  language?: string
): Promise<any> {
  const pageCount = targetLength === "auto" ? "5-10" : targetLength.split("-")[0] || "5";

  const systemInstruction = `You are an expert BET technical report writer. Generate a comprehensive academic technical report.

STRICT FORMATTING & STRUCTURAL RULES:

1. **Length & Depth Constraint**:
   * The user has requested a report of approximately **${pageCount} pages**.
   * To meet this, you MUST expand heavily on technical details.
   * Generate deep subsections (e.g., 1.1, 1.2, 4.1, 4.2) and extensive paragraphs.
   * Ensure the "Methodology" and "Results" sections are very detailed.

2. **Mandatory Section Structure**:
   * **Introduction**: Context (### 1.1), Problem Statement (### 1.2), Objectives (### 1.3).
   * **Project Plan**: MUST include a Project Timeline/Schedule table with columns: Phase, Task, Start Week, End Week, Duration. DO NOT use "[----]" or similar symbols - use actual week numbers.
   * **Project Budget**: MUST include a detailed cost breakdown in a Markdown Table.
   * **Methodology/Design**: Technical approach, components (### 4.1), architecture.
   * **Results/Analysis**: Performance metrics, validation (### 5.1).
   * **Conclusion**: Summary and Future Work.
   * **References**: List citations.
   * **Appendix A**: MUST include Appendix A for supplementary material.

3. **Tables & Figures Protocol (CRITICAL)**:
   * **Intro First**: You MUST introduce every figure or table in the text **BEFORE** you place it.
   * **Tables**: Use standard Markdown tables with clear data. NEVER use symbols like "[----]", "----", "XXX", or ASCII art.
     * Schedule Table Example:
     | Phase | Task | Start | End | Duration |
     |---|---|---|---|---|
     | Planning | Requirements | Week 1 | Week 2 | 2 weeks |
     | Development | Implementation | Week 3 | Week 6 | 4 weeks |
     * Budget Table Example:
     | Item | Quantity | Unit Cost | Total |
     |---|---|---|---|
     | Hardware | 5 | $200 | $1,000 |
     * The Caption MUST be **ABOVE** the table text in Bold (e.g., "**Table 1: Budget**").
   * **Figures**: The Caption MUST be provided in the JSON 'image_caption' field.

4. **Content Integrity and Formatting**:
   * Use '###' for sub-headings.
   * Use '**' for bold text.
   * Use '-' for lists.
   * **CODE/ALGORITHMS**: Use Markdown code fences (\`\`\`pseudocode).
   * **EQUATIONS**: Use single backticks (\`E=mc^2\`) for inline math.
   * Ensure all paragraphs, sub-sections, and tables are fully completed.

${generateImages ? `5. **Image Requirements**:
   * Add "image_prompt" and "image_caption" for 2-3 key sections (Methodology, Results, etc.)
   * image_prompt: Simple search terms (e.g., "network architecture diagram")
   * image_caption: "Figure X: Description"` : ''}

OUTPUT JSON STRUCTURE:
{
  "title": "Report Title",
  "date": "Current Date",
  "author": "Student Name",
  "abstract": "Executive summary (150 words)",
  "sections": [
    {
      "heading": "Section Name",
      "content": "Markdown content...",
      "image_prompt": "Visual description (or null)",
      "image_caption": "Figure X: Descriptive Title"
    }
  ]
}`;

  const prompt = `Topic: ${topic}. Citation Style: IEEE. Target Length: ${pageCount} Pages. Tone: ${tone}.${langInstruction(language)}

Generate a complete technical report following ALL formatting rules above. ${generateImages ? 'Include image_prompt and image_caption for 2-3 sections.' : ''}`;

  const response = await generateContent(prompt, {
    systemInstruction,
    responseFormat: "json",
    maxTokens: 65536,
  });

  return repairJson(response);
}

export async function generatePresentationContent(topic: string, slideCount: string, tone: string, language?: string): Promise<any> {
  const systemInstruction = `You are an elite Presentation Designer and Communication Coach.
Create a professional PowerPoint presentation on the given topic.

STRICT DESIGN & CONTENT RULES:
1. **6x6 Rule**: Maximum 6 bullet points per slide. Maximum 6-7 words per bullet point. NO paragraphs.
2. **One Idea Per Slide**: Each slide must focus on a single core message.
3. **Readability**: Content must be designed for large projection. Short, punchy keywords.
4. **Layout Instructions**: For every slide, specify the layout (e.g., "Split: Text Left / Image Right", "Center: Big Statement").

VISUAL GENERATION:
5. **visual_prompt**: For slides that need images, provide a detailed, specific image search prompt (e.g., "modern office meeting team collaboration", "technology artificial intelligence neural network"). Keep prompts concrete and searchable.

COACHING SESSION:
6. **speaker_script**: Provide a verbatim script or detailed talking points for what the speaker should say. 2-3 sentences that expand on the bullet points.
7. **speaker_tone**: Provide specific vocal direction (e.g., "Enthusiastic and engaging", "Professional and authoritative", "Conversational and friendly").

MANDATORY STRUCTURE:
- **Slide 1**: Title Slide (type: "title")
- **Slide 2**: Agenda/Roadmap (type: "content")
- **Middle Slides**: Core content with visuals (type: "image_split" for visual slides, "content" for text-only)
- **Second to Last**: Key Takeaways or Summary (type: "content")
- **Last Slide**: Thank You / Q&A (type: "title")

OUTPUT JSON FORMAT:
{
  "title": "Presentation title",
  "slides": [
    {
      "type": "title" | "content" | "image_split" | "quote",
      "title": "Slide title",
      "content": ["Bullet 1", "Bullet 2", "Bullet 3"],
      "layout_guide": "Text left, Image right",
      "visual_prompt": "Detailed prompt for image search (specific, concrete terms)",
      "speaker_script": "Full script of what to say for this slide...",
      "speaker_tone": "Confident and professional",
      "speakerNotes": "Brief notes summary"
    }
  ]
}`;

  const prompt = `Generate a ${slideCount} presentation on: ${topic}. Style: ${tone}. Follow the 6x6 rule strictly. Include visual_prompt for image slides, speaker_script and speaker_tone for every slide.${langInstruction(language)}`;

  const response = await generateContent(prompt, {
    systemInstruction,
    responseFormat: "json",
    maxTokens: 16384,
  });

  return repairJson(response);
}

function createWavFromPcm(pcmData: Buffer, sampleRate: number = 24000, numChannels: number = 1, bitsPerSample: number = 16): Buffer {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;
  
  const wavBuffer = Buffer.alloc(totalSize);
  
  wavBuffer.write('RIFF', 0);
  wavBuffer.writeUInt32LE(totalSize - 8, 4);
  wavBuffer.write('WAVE', 8);
  wavBuffer.write('fmt ', 12);
  wavBuffer.writeUInt32LE(16, 16);
  wavBuffer.writeUInt16LE(1, 20);
  wavBuffer.writeUInt16LE(numChannels, 22);
  wavBuffer.writeUInt32LE(sampleRate, 24);
  wavBuffer.writeUInt32LE(byteRate, 28);
  wavBuffer.writeUInt16LE(blockAlign, 32);
  wavBuffer.writeUInt16LE(bitsPerSample, 34);
  wavBuffer.write('data', 36);
  wavBuffer.writeUInt32LE(dataSize, 40);
  pcmData.copy(wavBuffer, 44);
  
  return wavBuffer;
}

export async function generateSpeechAudio(text: string, tone: string): Promise<{ audioBase64: string; mimeType: string } | null> {
  try {
    const cleanText = text.replace(/[*#]/g, '').substring(0, 500);
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [
        {
          parts: [{ text: `Say in a ${tone || 'professional'} tone: ${cleanText}` }]
        }
      ],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" }
          }
        }
      }
    });

    const audioData = response?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (audioData && audioData.data) {
      const mimeType = audioData.mimeType || "";
      
      if (mimeType.includes("L16") || mimeType.includes("pcm") || mimeType === "audio/raw") {
        const pcmBuffer = Buffer.from(audioData.data, 'base64');
        const wavBuffer = createWavFromPcm(pcmBuffer, 24000, 1, 16);
        return {
          audioBase64: wavBuffer.toString('base64'),
          mimeType: "audio/wav"
        };
      }
      
      return {
        audioBase64: audioData.data,
        mimeType: mimeType || "audio/wav"
      };
    }
    return null;
  } catch (error) {
    console.error("TTS generation error:", error);
    return null;
  }
}

export async function generateConferencePaperContent(
  topic: string,
  targetPages: string,
  citationStyle: string,
  options?: {
    generateImages?: boolean;
    authors?: Array<{ name: string; affiliation: string; email: string }>;
    tone?: string;
    customFormat?: any;
    language?: string;
  }
): Promise<{ html: string; type: 'html' }> {
  const toneInstructions: Record<string, string> = {
    academic: 'Formal, objective, and scholarly. Use passive voice where appropriate. Avoid colloquialisms. Focus on rigor, evidence, and precise terminology.',
    professional: 'Business-like, concise, and action-oriented. Clear, direct language suitable for industry reports.',
    essay: 'Narrative flow with persuasive arguments. Personal voice is allowed where appropriate.',
    creative: 'Descriptive, engaging, and varied sentence structure while maintaining subject matter.'
  };
  
  const tone = options?.tone || 'academic';
  const toneInstruction = toneInstructions[tone] || toneInstructions.academic;

  const refStyle = citationStyle === 'harvard' ? 'Harvard' : 'IEEE';
  const referenceInstruction = refStyle === 'Harvard'
    ? `REFERENCE STYLE: Harvard (Author-Date)
       - In-text citations: (Author, Year) e.g., (Smith, 2023)
       - Reference list: Author, A.A. (Year) Title of work. Publisher.`
    : `REFERENCE STYLE: IEEE (Numeric)
       - In-text citations: [1], [2], [3] in order of appearance
       - Reference list: [1] A. Author, "Title," Journal, vol. X, no. Y, pp. 1-10, Year.`;

  const lengthInstruction = targetPages === 'auto'
    ? "Content Length: Generate comprehensive content appropriate for the topic."
    : `Content Length: Generate enough detailed text to fill approximately ${targetPages} when printed.`;

  const customFormat = options?.customFormat;
  const customFormatInstruction = customFormat
    ? `CUSTOM FORMATTING: Font: ${customFormat.fontFamily}, Size: ${customFormat.fontSize}pt, Line Spacing: ${customFormat.lineSpacing}, Margins: ${customFormat.padding}cm, Text Align: ${customFormat.textAlign}, Color: ${customFormat.textColor}`
    : '';

  const imageInstruction = options?.generateImages
    ? `
    CRITICAL FIGURE INSTRUCTIONS FOR IEEE CONFERENCE PAPER:
    
    DO NOT USE:
    - NO <img> tags with src attributes
    - NO placeholder URLs
    - NO external image URLs
    
    INSTEAD USE THIS EXACT HTML COMMENT FORMAT:
    <!-- FIGURE: [detailed 20-50 word description] | Fig. X. Caption text -->
    
    EXAMPLES:
    <!-- FIGURE: professional flowchart diagram showing system architecture with components connected by arrows | Fig. 1. System architecture overview -->
    <!-- FIGURE: colorful bar chart comparing performance metrics with labeled axes | Fig. 2. Performance comparison -->
    
    RULES:
    - Include 2-4 figure placeholders at appropriate locations
    - Each placeholder must be on its own line
    - Reference figures in text: "As shown in Fig. 1..." or "Fig. 2 illustrates..."
    - Use "Fig." abbreviation (IEEE standard)
    - Caption format: "Fig. 1." then description
    `
    : '';

  const authorInfo = options?.authors?.some(a => a.name?.trim())
    ? `\n\nAUTHOR INFORMATION:\n${options.authors.map((a, i) => 
        `Author ${i + 1}: ${a.name}${a.affiliation ? `\nAffiliation: ${a.affiliation}` : ''}${a.email ? `\nEmail: ${a.email}` : ''}`
      ).join('\n\n')}`
    : '';

  const systemInstruction = `You are an expert academic paper formatter.
Generate a COMPLETE, styled HTML document for an IEEE conference paper.

HTML STRUCTURE REQUIREMENTS:
- Use a .title-area div for title, authors, abstract, keywords (single column, column-span: all)
- Use a .columns div for body content (two-column layout with column-count: 2; column-gap: 0.6cm)
- References section inside .columns div

PAGE LAYOUT:
1. Width: 100% of container - NEVER use max-width or fixed widths like 210mm
2. Columns: Two-column layout for body text ONLY
3. Margins: 1cm padding on all sides
4. Font: Times New Roman, 10pt for body text
5. CRITICAL: Do NOT add any inline styles with width or max-width properties

TITLE AREA (Single column, centered):
1. Title: 24pt, centered, bold
2. Authors: Arranged in columns below title with name, affiliation (italic), email

ABSTRACT AND KEYWORDS:
1. Abstract: Start with bold "Abstract—" followed by italic text (150-250 words)
2. Keywords: Start with bold "Keywords—" followed by italic comma-separated terms

SECTION HEADINGS (Roman numerals):
- I. INTRODUCTION (10pt, small-caps, centered)
- A. Subsection Title (italic, left-aligned)
- 1) Sub-subsection (italic)

REQUIRED STRUCTURE:
1. Title
2. Author Information
3. Abstract
4. Keywords
5. I. INTRODUCTION
6. II. RELATED WORK
7. III. METHODOLOGY
8. IV. RESULTS
9. V. DISCUSSION
10. VI. CONCLUSION
11. ACKNOWLEDGMENT (optional)
12. REFERENCES

FIGURES AND TABLES:
1. Figure Captions: BELOW figure, format "Fig. 1. Description"
2. Table Titles: ABOVE table, format "TABLE I. TITLE" (Roman numerals)
3. Use break-inside: avoid for figures/tables

EQUATIONS:
- Number with right-aligned (1), (2), (3)
- Center equations
- Italicize variables, not Greek symbols

BET PROJECT GUIDELINES:
1. MUST introduce figures/tables with context BEFORE presenting them
2. Use "TABLE I illustrates..." or "As shown in Fig. 4,..."
3. NEVER use "the table below" or "the figure above"

${referenceInstruction}

CRITICAL REFERENCE RULES:
- Each reference MUST be a COMPLETE, REALISTIC academic citation
- NEVER generate repeating patterns like "S. S. S. S." or "A. A. A. A."
- Each reference MUST have: unique author name(s), year, title, and publication venue
- IEEE format: [1] A. B. Lastname, "Full Title of the Paper," Journal Name, vol. X, no. Y, pp. 1-10, Year.
- Harvard format: Lastname, A.B. (Year) Full Title of the Paper. Journal Name, Vol(Issue), pp.1-10.
- Generate 8-15 DIVERSE, REALISTIC references with varied author names and publications
- NEVER abbreviate names as just initials - use "A. Smith" not "A. S."

${lengthInstruction}

${customFormatInstruction}

TONE: ${toneInstruction}

${imageInstruction}

CSS REQUIREMENTS:
<style>
* {
  box-sizing: border-box;
  max-width: none !important;
}
body {
  font-family: 'Times New Roman', serif;
  font-size: 10pt;
  line-height: 1.4;
  padding: 1cm;
  width: 100% !important;
  max-width: none !important;
  margin: 0 !important;
  color: #000;
}
.title-area {
  column-span: all;
  text-align: center;
  margin-bottom: 1.2cm;
  width: 100% !important;
  max-width: none !important;
}
.title-area h1 {
  font-size: 24pt;
  font-weight: bold;
  margin-bottom: 0.8cm;
  line-height: 1.2;
}
.authors {
  display: flex;
  justify-content: center;
  gap: 2cm;
  margin-bottom: 0.8cm;
  flex-wrap: wrap;
}
.author {
  text-align: center;
  font-size: 10pt;
}
.author-name { font-weight: normal; margin-bottom: 0.2em; }
.author-affiliation { font-style: italic; font-size: 9pt; }
.columns {
  column-count: 2;
  column-gap: 0.6cm;
  text-align: justify;
  column-fill: balance;
  width: 100% !important;
  max-width: none !important;
}
h2 {
  font-size: 10pt;
  font-variant: small-caps;
  text-align: center;
  font-weight: bold;
  margin-top: 0.8em;
  margin-bottom: 0.5em;
}
h3 {
  font-size: 10pt;
  font-style: italic;
  text-align: left;
  font-weight: bold;
  margin-top: 0.6em;
  margin-bottom: 0.4em;
}
figure {
  text-align: center;
  margin: 1em auto;
  break-inside: avoid;
}
figcaption {
  font-size: 9pt;
  text-align: center;
  margin-top: 0.5em;
}
table {
  margin: 1em auto;
  border-collapse: collapse;
  font-size: 9pt;
  break-inside: avoid;
}
table th, table td {
  border: 1px solid #000;
  padding: 0.3em 0.5em;
}
.table-title {
  text-align: center;
  font-size: 9pt;
  font-weight: bold;
  margin-bottom: 0.5em;
}
.references {
  font-size: 9pt;
}
.references p {
  text-indent: -1em;
  padding-left: 1em;
  margin-bottom: 0.3em;
}
</style>

OUTPUT: Return ONLY the complete HTML document. Do NOT use markdown code fences.
DO NOT include any <script> tags or JavaScript.`;

  const prompt = `Topic: ${topic}${authorInfo}${langInstruction(options?.language)}

Generate a complete IEEE conference paper HTML document following all the guidelines.`;

  const response = await generateContent(prompt, {
    systemInstruction,
    responseFormat: "text",
    maxTokens: 32768,
  });

  // Clean the response - remove markdown code fences if present
  let html = response
    .replace(/^```html\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  // CRITICAL FIX: Extract ONLY body content and add inline styles
  // Do NOT wrap in <body> tags - that causes nested layout issues

  // Extract body content (everything between <body> tags or the whole thing if no body tags)
  let bodyContent = html;
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    bodyContent = bodyMatch[1];
  }

  // AGGRESSIVE CLEANUP: Remove ALL inline styles completely
  // Then remove any style attributes that contain problematic properties
  bodyContent = bodyContent
    // Remove entire style attributes
    .replace(/\s+style="[^"]*"/gi, '')
    .replace(/\s+style='[^']*'/gi, '')
    // Remove any remaining width/max-width in HTML
    .replace(/<([^>]+)(?:max-)?width[^>]*>/gi, '<$1>')
    // Remove wrapper divs with container/wrapper class names that might constrain width
    .replace(/<div\s+class="[^"]*(?:container|wrapper|content-wrapper|page-wrapper)[^"]*"[^>]*>/gi, '<div>');

  // FIX DUPLICATE IMAGES: Remove any img tags that have placeholder/external URLs
  // Keep only FIGURE comments which will be processed client-side
  // This prevents the AI from generating both img tags AND figure comments
  bodyContent = bodyContent
    // Remove img tags with placeholder/example URLs
    .replace(/<img[^>]*src\s*=\s*["'][^"']*(?:placeholder|example|picsum|lorempixel|via\.placeholder|dummyimage)[^"']*["'][^>]*\/?>/gi, '')
    // Remove img tags with empty or broken src
    .replace(/<img[^>]*src\s*=\s*["']\s*["'][^>]*\/?>/gi, '')
    // Remove img tags with data-placeholder attribute
    .replace(/<img[^>]*data-placeholder[^>]*\/?>/gi, '')
    // Remove duplicate consecutive img tags (keep only the first one)
    .replace(/(<figure[^>]*>[\s\S]*?<img[^>]*>[\s\S]*?)(<img[^>]*>[\s\S]*?)(<\/figure>)/gi, '$1$3')
    // Clean up empty figure tags
    .replace(/<figure[^>]*>\s*<figcaption>/gi, '<figure><figcaption>')
    // Remove any img tags that don't have a valid http/https src (likely broken)
    .replace(/<img[^>]*src\s*=\s*["'](?!https?:\/\/)[^"']*["'][^>]*\/?>/gi, '');

  // FIX CORRUPTED REFERENCES: Remove repeating patterns in references
  // This fixes issues like "S. S. S. S. S." or "A. A. A. A."
  bodyContent = bodyContent
    // Remove repeating single letter patterns (e.g., "S. S. S. S.")
    .replace(/(\b[A-Z]\.\s*){4,}/g, '')
    // Remove repeating word patterns (e.g., "word word word word")
    .replace(/\b(\w+)\s+(\1\s+){3,}/gi, '$1 ')
    // Remove corrupted reference entries that are just patterns
    .replace(/<p>\s*(?:\[\d+\]\s*)?(?:[A-Z]\.\s*){3,}[^<]*<\/p>/gi, '')
    // Remove empty reference paragraphs
    .replace(/<p>\s*(?:\[\d+\]\s*)?\s*<\/p>/gi, '')
    // Clean up excessive whitespace in references section
    .replace(/(<div[^>]*class="references"[^>]*>[\s\S]*?)(\s{3,})([\s\S]*?<\/div>)/gi, '$1 $3');

  // Log the cleaned content for debugging
  console.log('📄 Conference paper body content length:', bodyContent.length);

  // Return ONLY the content with inline CSS - NO body/html wrapper
  // The parent div will handle the layout
  html = `<style>
.ieee-paper-preview,
.ieee-paper-preview * {
  box-sizing: border-box;
  max-width: none !important;
}
.ieee-paper-preview {
  font-family: 'Times New Roman', serif;
  font-size: 10pt;
  line-height: 1.4;
  padding: 1cm;
  width: 100% !important;
  margin: 0 !important;
  color: #000;
}
.ieee-paper-preview .title-area {
  column-span: all;
  text-align: center;
  margin-bottom: 1.2cm;
  width: 100% !important;
  max-width: none !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
}
.ieee-paper-preview .title-area h1 {
  font-size: 24pt;
  font-weight: bold;
  margin-bottom: 0.8cm;
  line-height: 1.2;
}
.ieee-paper-preview .authors {
  display: flex;
  justify-content: center;
  gap: 2cm;
  margin-bottom: 0.8cm;
  flex-wrap: wrap;
}
.ieee-paper-preview .author {
  text-align: center;
  font-size: 10pt;
}
.ieee-paper-preview .author-name { font-weight: normal; margin-bottom: 0.2em; }
.ieee-paper-preview .author-affiliation { font-style: italic; font-size: 9pt; }
.ieee-paper-preview .columns {
  column-count: 2;
  column-gap: 0.6cm;
  text-align: justify;
  column-fill: balance;
  width: 100% !important;
  max-width: none !important;
  margin: 0 !important;
}
.ieee-paper-preview h2 {
  font-size: 10pt;
  font-variant: small-caps;
  text-align: center;
  font-weight: bold;
  margin-top: 0.8em;
  margin-bottom: 0.5em;
}
.ieee-paper-preview h3 {
  font-size: 10pt;
  font-style: italic;
  text-align: left;
  font-weight: bold;
  margin-top: 0.6em;
  margin-bottom: 0.4em;
}
.ieee-paper-preview figure {
  text-align: center;
  margin: 1em auto;
  break-inside: avoid;
}
.ieee-paper-preview figcaption {
  font-size: 9pt;
  text-align: center;
  margin-top: 0.5em;
}
.ieee-paper-preview table {
  margin: 1em auto;
  border-collapse: collapse;
  font-size: 8pt;
  break-inside: avoid;
  width: 100%;
  max-width: 100%;
  table-layout: fixed;
  word-wrap: break-word;
  overflow-wrap: break-word;
}
.ieee-paper-preview table th,
.ieee-paper-preview table td {
  border: 1px solid #000;
  padding: 0.2em 0.3em;
  word-wrap: break-word;
  overflow-wrap: break-word;
  text-align: center;
  font-size: 8pt;
}
.ieee-paper-preview .table-title {
  text-align: center;
  font-size: 9pt;
  font-weight: bold;
  margin-bottom: 0.5em;
}
.ieee-paper-preview .references {
  font-size: 9pt;
}
.ieee-paper-preview .references p {
  text-indent: -1em;
  padding-left: 1em;
  margin-bottom: 0.3em;
}
</style>
${bodyContent}`;

  return { html, type: 'html' };
}

export async function generateThesisContent(topic: string, targetPages: string, citationStyle: string, language?: string): Promise<any> {
  const pageCount = targetPages === "auto" ? "10-15" : targetPages;
  const refStyle = citationStyle === 'harvard' ? 'Harvard' : citationStyle.toUpperCase();

  const systemInstruction = `You are an expert thesis/dissertation writer. Generate a CONCISE academic thesis/dissertation.

STRICT FORMATTING & STRUCTURAL RULES:

1. **Length & Depth Constraint - CRITICAL**:
   * The user has requested a thesis of approximately **${pageCount} pages**.
   * Generate MINIMAL but academically sound content.
   * Each chapter: EXACTLY 2 SHORT paragraphs (3-4 sentences each).
   * Each chapter: EXACTLY 2 subsections only.
   * ABSOLUTE REQUIREMENT: Keep TOTAL JSON response under 25KB.

2. **Mandatory Chapter Structure (5 CHAPTERS ONLY)**:
   * **Chapter 1 - Introduction**: Background, Research Question (### 1.1, ### 1.2).
   * **Chapter 2 - Literature Review**: Theoretical Framework, Research Gaps (### 2.1, ### 2.2).
   * **Chapter 3 - Methodology**: Research Design, Data Collection (### 3.1, ### 3.2).
   * **Chapter 4 - Results**: Key findings, data analysis (### 4.1, ### 4.2).
   * **Chapter 5 - Conclusion**: Summary, Future Work (### 5.1, ### 5.2).

3. **Content Integrity and Formatting**:
   * Use '###' for chapter sub-headings (e.g., ### 1.1 Background).
   * Use '**' for bold text.
   * Use '-' for lists.
   * **TABLES**: Use standard Markdown tables where appropriate.
   * **CITATIONS**: Use ${refStyle} style throughout - ${refStyle === 'Harvard' ? '(Author, Year)' : refStyle === 'APA' ? '(Author, Year)' : '[1]'}.
   * Ensure all paragraphs, sub-sections are fully completed with real academic content.
   * NO placeholder text like "[content here]" or "[to be continued]".

4. **Image Requirements**:
   * Add "image_prompt" and "image_caption" for 2-3 key chapters (Methodology, Results, etc.)
   * image_prompt: Simple search terms (e.g., "research methodology diagram", "data analysis charts")
   * image_caption: "Figure X: Descriptive Title" (will be placed BELOW the figure)
   * For chapters without images, set both to null
   * **CRITICAL - FIGURE INTRODUCTION**: Introduce each figure with comprehensive information and context BEFORE it appears
   * INSUFFICIENT: Merely stating "see Figure 2" or "refer to Figure 3" - this is NOT acceptable
   * REQUIRED: Provide 2-3 sentences explaining what the figure shows, why it's important, and how it relates to your discussion
   * Example: "The research methodology employed a mixed-methods approach combining quantitative surveys with qualitative interviews. As illustrated in Figure 1, the methodology framework consists of four interconnected phases: data collection, analysis, validation, and synthesis. This systematic approach ensures comprehensive coverage of the research objectives."
   * Use direct references like "As illustrated in Figure 1..." or "Figure 2 demonstrates..." within the comprehensive introduction
   * NEVER use indirect references like "the figure below" or "the figure above"
   * NEVER insert a figure without first introducing it with comprehensive context

5. **Reference Integrity (CRITICAL - ZERO TOLERANCE)**:
   * Generate 10-15 REAL, VERIFIABLE academic references in ${refStyle} format
   * Use realistic author names, publication years, journal/conference names, titles
   * Every in-text citation MUST have a corresponding reference in the reference list
   * Every reference in the list MUST be cited at least once in the text
   * Include journal articles, books, and conference papers relevant to the topic
   * NO AI-generated or fake references - this is academic misconduct

OUTPUT JSON STRUCTURE (5 CHAPTERS ONLY):
{
  "title": "Thesis Title",
  "date": "Current Date",
  "author": "Researcher Name",
  "abstract": "Brief abstract (100-150 words max)",
  "sections": [
    {
      "heading": "Chapter 1: Introduction",
      "content": "2 SHORT paragraphs with ### 1.1 and ### 1.2 subsections...",
      "image_prompt": null,
      "image_caption": null
    },
    {
      "heading": "Chapter 2: Literature Review",
      "content": "2 SHORT paragraphs with ### 2.1 and ### 2.2 subsections...",
      "image_prompt": "research framework diagram",
      "image_caption": "Figure 1: Research Framework"
    },
    {
      "heading": "Chapter 3: Methodology",
      "content": "2 SHORT paragraphs with ### 3.1 and ### 3.2 subsections...",
      "image_prompt": null,
      "image_caption": null
    },
    {
      "heading": "Chapter 4: Results",
      "content": "2 SHORT paragraphs with ### 4.1 and ### 4.2 subsections...",
      "image_prompt": null,
      "image_caption": null
    },
    {
      "heading": "Chapter 5: Conclusion",
      "content": "2 SHORT paragraphs with ### 5.1 and ### 5.2 subsections...",
      "image_prompt": null,
      "image_caption": null
    }
  ],
  "references": ["Ref 1", "Ref 2", ... (8-12 refs total)]
}`;

  const prompt = `Topic: ${topic}. Citation Style: ${refStyle}. Target Length: ${pageCount} Pages.${langInstruction(language)}

Generate a complete academic thesis/dissertation following ALL formatting rules above.

CRITICAL REQUIREMENTS:
1. ONLY 5 CHAPTERS (not 6!) - Introduction, Literature Review, Methodology, Results, Conclusion
2. Each chapter: EXACTLY 2 SHORT paragraphs (3-4 sentences), EXACTLY 2 subsections
3. Add 1-2 image prompts ONLY - introduce briefly BEFORE they appear
4. REFERENCE INTEGRITY: 8-12 REALISTIC references - every citation must be in reference list
5. ABSOLUTE SIZE LIMIT: Keep JSON response under 25KB - prioritize brevity over depth`;

  const response = await generateContent(prompt, {
    systemInstruction,
    responseFormat: "json",
    maxTokens: 65536,
  });

  return repairJson(response);
}

export async function extractTextFromImage(imageBase64: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            data: imageBase64,
            mimeType: "image/jpeg",
          },
        },
        "Extract and transcribe all text from this image. Provide only the extracted text without any additional commentary.",
      ],
    });

    return response.text || "";
  } catch (error) {
    console.error("Image OCR error:", error);
    throw new Error(`Failed to extract text from image: ${error}`);
  }
}

export async function checkGrammar(text: string): Promise<any[]> {
  const systemInstruction = `You are an expert academic writing editor and proofreader.
Analyze the provided text for grammar, spelling, punctuation, style, and clarity issues.

For each issue found, provide:
1. "original" - The exact problematic text (word, phrase, or sentence)
2. "suggested" - The corrected version
3. "type" - One of: "grammar", "spelling", "punctuation", "style", "clarity", "word_choice"
4. "explanation" - A brief explanation of why this change improves the text

IMPORTANT RULES:
- Find ALL issues, not just the first few
- Be thorough but accurate - don't suggest changes that aren't improvements
- For style issues, consider academic writing conventions
- Keep explanations concise (1-2 sentences max)
- If the text has no issues, return an empty array []
- Return ONLY valid JSON array, no markdown code fences

EXAMPLE OUTPUT:
[
  {
    "original": "their going",
    "suggested": "they're going",
    "type": "grammar",
    "explanation": "Use 'they're' (they are) instead of 'their' (possessive)."
  },
  {
    "original": "alot",
    "suggested": "a lot",
    "type": "spelling",
    "explanation": "'A lot' should be written as two separate words."
  }
]`;

  const prompt = `Analyze this text for grammar, style, and clarity issues. Return a JSON array of suggestions.

Text to analyze:
"${text}"

Return ONLY the JSON array of suggestions. If no issues found, return []`;

  const response = await generateContent(prompt, {
    systemInstruction,
    responseFormat: "json",
    temperature: 0.3,
    maxTokens: 4096,
  });

  try {
    const parsed = JSON.parse(response);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return [];
      }
    }
    return [];
  }
}

export async function generateChatResponse(message: string): Promise<string> {
  const systemInstruction = `You are AcademicGen Assistant - a helpful guide for the AcademicGen academic document generation website.

WEBSITE KNOWLEDGE - MEMORIZE THESE PAGES AND PATHS:

**Document Generators (MAIN FEATURES):**
• Technical Report → /generate/report - BET-standard reports with Gantt charts, budget tables, equations
• Custom Report → /generate/custom-report - Fully customizable reports with flexible sections
• PowerPoint → /generate/powerpoint - Professional slides with speaker notes, TTS coaching
• Conference Paper → /generate/conference - IEEE-format academic papers with citations
• Thesis → /generate/thesis - Harvard-style thesis with chapters, bibliography
• AI Images → /generate/images - FREE AI image generation from text prompts
• Reference Library → /references - Citation manager, URL/DOI import, BibTeX export
• AI Humanizer → /humanize - Bypass AI detection (GPTZero, Turnitin), per-sentence scoring, Azure HD voice
• Citation Checker → /citations - Detect fake/incorrect citations, auto-correct, IEEE/APA/Harvard/MLA support

**Other Pages:**
• Home → / - Overview of all features
• My Projects → /my-projects - View saved documents (requires Google sign-in)
• AI Assistant → /ai-assistant - Writing help & grammar checker
• About → /about - Features and capabilities
• Contact → /contact - Support and FAQ
• Settings → /settings - Theme preferences

**KEYWORD TO PAGE MAPPING (USE THIS):**
- image/picture/photo/visual → /generate/images
- report/technical → /generate/report
- custom/flexible → /generate/custom-report
- slides/presentation/powerpoint/ppt → /generate/powerpoint
- paper/conference/ieee/academic → /generate/conference
- thesis/dissertation/research → /generate/thesis
- citation/reference/bibliography/doi → /references
- save/saved/projects/history → /my-projects
- grammar/writing/proofread/check → /ai-assistant
- help/support/contact → /contact
- settings/theme/dark → /settings
- humanize/human/ai detection/bypass/turnitin/gptzero/undetectable → /humanize
- citation check/fake citation/verify reference/citation error → /citations

**CRITICAL RESPONSE RULES:**
1. ALWAYS include at least ONE clickable link using format: **[Page Name](/path)**
2. Understand user INTENT - if they mention ANY keyword above, suggest that page
3. Keep responses SHORT (2-4 bullet points, under 80 words)
4. Be DIRECT - tell users exactly WHERE to go
5. Use bullet points with • character

**LINK FORMAT (MANDATORY):**
Use this EXACT format for clickable links: **[Display Text](/path)**
Examples:
• **[AI Images](/generate/images)** - for image generation
• **[Technical Report](/generate/report)** - for reports
• **[Reference Library](/references)** - for citations
• **[My Projects](/my-projects)** - for saved work

**EXAMPLE CONVERSATIONS:**

User: "I want to create an image"
Response: "AcademicGen has free AI image generation!
• Go to **[AI Images](/generate/images)** to create images from text
• Enter any description and generate instantly
• Download as PNG, JPEG, or WEBP"

User: "make a presentation"
Response: "You can create professional slides here:
• Use **[PowerPoint Generator](/generate/powerpoint)** to create presentations
• AI generates speaker notes and follows 6x6 rule
• Export as PPTX or PDF"

User: "thesis"
Response: "For thesis/dissertation writing:
• Use **[Thesis Generator](/generate/thesis)** for complete academic documents
• Includes chapters, methodology, results, citations
• Harvard citation style with bibliography"

User: "how do I cite sources"
Response: "For citations and references:
• Go to **[Reference Library](/references)** to manage citations
• Import via URL, DOI, or manually enter
• Export as BibTeX, RIS, or formatted text"

User: "where are my saved documents"
Response: "Your saved work is in:
• **[My Projects](/my-projects)** shows all saved documents
• Sign in with Google to access cloud saves
• Export, view, or delete anytime"

REMEMBER: EVERY response MUST contain at least one **[Link Text](/path)** format link!`;

  const response = await generateContent(message, {
    systemInstruction,
    temperature: 0.5,  // Lower temperature for more consistent responses
    maxTokens: 512,
  });

  return response;
}

export async function generateSectionContent(
  documentTopic: string,
  sectionHeading: string,
  tone: string = "academic",
  language?: string
): Promise<string> {
  const systemInstruction = `You are an expert academic writer. Generate detailed, well-researched content for a single section of an academic document. Use proper academic tone and structure. Write in Markdown format with appropriate headings, bullet points, and emphasis where relevant.`;

  const prompt = `Document topic: "${documentTopic}"
Section to write: "${sectionHeading}"
Tone: ${tone}
${langInstruction(language)}

Write comprehensive, detailed content for this specific section. Include:
- Clear explanations and analysis
- Supporting evidence and examples
- Proper academic language
- 300-600 words of well-structured content

Return ONLY the section content in Markdown format, no title heading needed.`;

  const response = await generateContent(prompt, {
    systemInstruction,
    temperature: 0.7,
    maxTokens: 2048,
  });

  return response;
}
