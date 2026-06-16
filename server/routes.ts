import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { lookup } from "node:dns/promises";
import net from "node:net";
import { storage } from "./storage";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { generateReportContent, generatePresentationContent, generateConferencePaperContent, generateThesisContent, extractTextFromImage, generateChatResponse, generateSpeechAudio, checkGrammar, generateContent, generateSectionContent } from "./lib/gemini";
import { generateAzureAudio, generateElevenLabsAudio, generateVoiceRSSAudio, generateStreamElementsAudio, ELEVENLABS_VOICES, STREAMELEMENTS_VOICES } from "./lib/tts";
import { searchImages, getRandomImage } from "./lib/pixabay";
import { extractTextFromFile } from "./lib/file-processor";
import { getRandomTopic } from "../shared/random-topics";
import { generatePdf } from "./lib/pdf-export";
import { firebaseSubscriptionStorage } from "./firebaseSubscriptionStorage";
import { USAGE_LIMITS, PRICING_TIERS } from "@shared/schema";
import { getBMCCheckoutUrl, getBMCProducts, isBMCConfigured } from "./bmcClient";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const PAYMENT_PROVIDERS = ["bmc", "yoco", "stripe", "none"] as const;
type PaymentProvider = typeof PAYMENT_PROVIDERS[number];
type PricingTier = keyof typeof PRICING_TIERS;

function isPricingTier(tier: unknown): tier is PricingTier {
  return typeof tier === "string" && tier in PRICING_TIERS;
}

function parseCsvEnv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

const ADMIN_EMAILS_SERVER = parseCsvEnv(process.env.ADMIN_EMAILS);

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function getAuthenticatedUid(req: Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const bodyToken = typeof req.body?.token === "string" ? req.body.token : undefined;
  const idToken = bearerToken ?? bodyToken;

  if (!idToken) return null;

  const { getApps, getApp } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");
  if (getApps().length === 0) return null;

  const decoded = await getAuth(getApp()).verifyIdToken(idToken);
  return decoded.uid;
}

async function requireMatchingUser(
  req: Request,
  res: Response,
  userId: string,
): Promise<string | null> {
  const uid = await getAuthenticatedUid(req).catch(() => null);
  if (!uid) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  if (uid !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return uid;
}

function isPrivateIp(address: string): boolean {
  if (net.isIPv4(address)) {
    const parts = address.split(".").map(Number);
    const [a, b] = parts;
    return (
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      address === "0.0.0.0"
    );
  }
  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return (
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:")
    );
  }
  return true;
}

async function assertPublicHttpUrl(url: string): Promise<URL> {
  const parsedUrl = new URL(url);
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported");
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("Local URLs are not allowed");
  }

  const addresses = await lookup(hostname, { all: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new Error("Private or internal network URLs are not allowed");
  }

  return parsedUrl;
}

// Rate limiters — protect AI generation endpoints from abuse
const generateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a minute before generating again." },
  skip: (req) => process.env.NODE_ENV === "development",
});

const exportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many export requests. Please wait a moment." },
  skip: (req) => process.env.NODE_ENV === "development",
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Apply rate limiters to AI and export routes
  app.use("/api/generate", generateLimiter);
  app.use("/api/export", exportLimiter);
  // ── PDF Export ────────────────────────────────────────────────────────────
  app.post("/api/export/pdf", async (req, res) => {
    try {
      const { content, imageUrls = {}, type = "report" } = req.body;
      if (!content) return res.status(400).json({ error: "Content required" });
      const pdfBuffer = await generatePdf(content, imageUrls, type);
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="academicgen-${type}.pdf"`,
        "Content-Length": pdfBuffer.length,
      });
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("PDF export error:", error);
      res.status(500).json({ error: error.message || "PDF generation failed" });
    }
  });

  // ── Section Regeneration ─────────────────────────────────────────────
  app.post("/api/generate/section", async (req, res) => {
    try {
      const { topic, sectionHeading, tone, language } = req.body;
      if (!topic || !sectionHeading) return res.status(400).json({ error: "topic and sectionHeading required" });
      const content = await generateSectionContent(topic, sectionHeading, tone || "academic", language);
      res.json({ success: true, content });
    } catch (error: any) {
      console.error("Section regeneration error:", error);
      res.status(500).json({ error: error.message || "Failed to regenerate section" });
    }
  });

  app.post("/api/generate/template-report", async (req, res) => {
    try {
      const { templateContent, topic, guidelines, tone = "academic", citationStyle = "auto", targetLength = "auto" } = req.body;
      if (!templateContent && !topic && !guidelines) return res.status(400).json({ error: "Provide a template, topic, or guidelines to generate a report" });

      const pageCount = targetLength === "auto" ? "5-8" : (targetLength.split("-")[0] || "5");

      const prompt = `You are an expert academic document writer. Generate a complete, high-quality academic report.

${templateContent ? `TEMPLATE TO FOLLOW:
The user provided this template document. Preserve its exact section headings and overall structure. Fill every section with detailed, relevant academic content.
---
${templateContent.slice(0, 5000)}
---
` : ""}
REPORT TOPIC: ${topic || (guidelines ? "Inferred from guidelines" : "Inferred from template")}
${guidelines ? `AUTHOR GUIDELINES & REQUIREMENTS:\n${guidelines}\n` : ""}
TONE: ${tone}
CITATION STYLE: ${citationStyle === "auto" ? "appropriate academic style" : citationStyle.toUpperCase()}
TARGET LENGTH: approximately ${pageCount} pages

RULES:
- Preserve every section heading from the template exactly as written
- Write comprehensive, detailed content for every section (no placeholders)
- Use markdown: ### for sub-headings, ** for bold, - for lists, markdown tables
- Include in-text citations and a References section
- All tables must have proper headers and real data (no placeholder dashes)

OUTPUT — return ONLY valid JSON, no markdown wrapper:
{
  "title": "Full Document Title",
  "date": "May 2026",
  "abstract": "150-word executive summary",
  "sections": [
    {
      "heading": "Section Heading",
      "content": "Full markdown content...",
      "image_prompt": "descriptive search query for a relevant academic image (e.g. 'neural network diagram', 'solar panel installation')",
      "image_caption": "Figure 1: Descriptive caption for the figure"
    }
  ],
  "references": ["[1] Author, A. (Year). Title. Journal, vol(issue), pages."]
}`;

      const raw = await generateContent(prompt, {
        systemInstruction: "You are an expert academic writer. Return only valid JSON.",
        temperature: 0.65,
        maxTokens: 16384,
        responseFormat: "json",
      });

      // Strip bare control characters (0x00-0x1F except tab/newline/CR) that invalidate JSON
      const sanitized = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
      let content;
      try {
        content = JSON.parse(sanitized);
      } catch {
        const m = sanitized.match(/\{[\s\S]*\}/);
        if (m) {
          try { content = JSON.parse(m[0]); }
          catch { throw new Error("Failed to parse AI response as JSON"); }
        } else {
          throw new Error("Failed to parse AI response as JSON");
        }
      }

      res.json({ success: true, content });
    } catch (error: any) {
      console.error("Template report generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate template report" });
    }
  });

  app.post("/api/generate/report", async (req, res) => {
    try {
      const { topic, targetLength, tone, generateImages, language } = req.body;

      if (!topic) {
        return res.status(400).json({ error: "Topic is required" });
      }

      const content = await generateReportContent(
        topic,
        targetLength || "auto",
        tone || "academic",
        generateImages !== false,
        language
      );

      // Images are now fetched client-side, so no server-side processing needed
      res.json({ success: true, content });
    } catch (error: any) {
      console.error("Report generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate report" });
    }
  });

  app.post("/api/generate/powerpoint", async (req, res) => {
    try {
      const { topic, slideCount, tone, language } = req.body;

      if (!topic) {
        return res.status(400).json({ error: "Topic is required" });
      }

      const content = await generatePresentationContent(
        topic,
        slideCount || "auto",
        tone || "professional",
        language
      );

      res.json({ success: true, content });
    } catch (error: any) {
      console.error("Presentation generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate presentation" });
    }
  });

  app.post("/api/generate/conference", async (req, res) => {
    try {
      const { topic, targetPages, citationStyle, tone, generateImages, authors, customFormat, language } = req.body;

      if (!topic) {
        return res.status(400).json({ error: "Topic is required" });
      }

      const result = await generateConferencePaperContent(
        topic,
        targetPages || "auto",
        citationStyle || "ieee",
        {
          generateImages: generateImages !== false,
          authors,
          tone: tone || "academic",
          customFormat,
          language,
        }
      );

      // Process figure placeholders if images are enabled
      if (generateImages !== false && result.html) {
        const processedHtml = await processConferenceFigures(result.html);
        res.json({ success: true, content: { html: processedHtml, type: 'html' } });
      } else {
        res.json({ success: true, content: result });
      }
    } catch (error: any) {
      console.error("Conference paper generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate conference paper" });
    }
  });

  // Helper function to process figure placeholders in conference paper HTML
  async function processConferenceFigures(html: string): Promise<string> {
    const figureRegex = /<!--\s*FIGURE:\s*([^|]+)\s*\|\s*([^>]+)\s*-->/g;
    const figures: Array<{ fullMatch: string; prompt: string; caption: string }> = [];
    let match;

    while ((match = figureRegex.exec(html)) !== null) {
      figures.push({
        fullMatch: match[0],
        prompt: match[1].trim(),
        caption: match[2].trim()
      });
    }

    if (figures.length === 0) return html;

    let processedHtml = html;

    for (const fig of figures) {
      try {
        const image = await getRandomImage(fig.prompt);
        if (image) {
          const figureHtml = `
            <figure style="text-align: center; margin: 1em auto; max-width: 100%; break-inside: avoid;">
              <img src="${image.largeImageURL}" alt="${fig.caption}" style="max-width: 320px; max-height: 240px; width: 100%; height: auto; object-fit: contain; border: 1px solid #ddd; display: block; margin: 0 auto;" onerror="this.style.display='none'" />
              <figcaption style="margin-top: 0.5em; font-size: 9pt; color: #555; text-align: center;">${fig.caption}</figcaption>
            </figure>
          `;
          processedHtml = processedHtml.replace(fig.fullMatch, figureHtml);
        } else {
          const errorHtml = `
            <figure style="text-align: center; margin: 1em auto; padding: 1em; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px;">
              <p style="color: #666; font-style: italic;">[Image: ${fig.caption}]</p>
            </figure>
          `;
          processedHtml = processedHtml.replace(fig.fullMatch, errorHtml);
        }
      } catch (error) {
        console.error(`Failed to generate image for ${fig.caption}:`, error);
        const errorHtml = `
          <figure style="text-align: center; margin: 1em auto; padding: 1em; background: #fee; border: 1px solid #fcc; border-radius: 4px;">
            <p style="color: #c00;">[Image generation failed: ${fig.caption}]</p>
          </figure>
        `;
        processedHtml = processedHtml.replace(fig.fullMatch, errorHtml);
      }
    }

    return processedHtml;
  }

  app.post("/api/generate/thesis", async (req, res) => {
    try {
      const { topic, targetPages, citationStyle, language } = req.body;

      if (!topic) {
        return res.status(400).json({ error: "Topic is required" });
      }

      const content = await generateThesisContent(
        topic,
        targetPages || "auto",
        citationStyle || "harvard",
        language
      );

      res.json({ success: true, content });
    } catch (error: any) {
      console.error("Thesis generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate thesis" });
    }
  });

  app.post("/api/images/search", async (req, res) => {
    try {
      const { query } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }

      const images = await searchImages(query, 10);
      res.json({ success: true, images });
    } catch (error: any) {
      console.error("Image search error:", error);
      res.status(500).json({ error: error.message || "Failed to search images" });
    }
  });

  app.post("/api/images/random", async (req, res) => {
    try {
      const { query } = req.body;

      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }

      const image = await getRandomImage(query);
      res.json({ success: true, image });
    } catch (error: any) {
      console.error("Random image error:", error);
      res.status(500).json({ error: error.message || "Failed to get random image" });
    }
  });

  app.post("/api/images/generate", async (req, res) => {
    try {
      const { prompt, size, style, quality } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      // For now, use Pixabay as a fallback since Gemini doesn't directly support image generation
      // In production, you would integrate with DALL-E, Stable Diffusion, or similar service
      const image = await getRandomImage(prompt);

      if (image) {
        res.json({
          success: true,
          imageUrl: image.largeImageURL || image.webformatURL,
          size: size || "1024x1024",
          style: style || "vivid",
          quality: quality || "standard"
        });
      } else {
        throw new Error("Failed to generate image");
      }
    } catch (error: any) {
      console.error("Image generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate image" });
    }
  });

  app.post("/api/tts/generate", async (req, res) => {
    try {
      const { text, tone } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      const audio = await generateSpeechAudio(text, tone || "professional");
      
      if (!audio) {
        return res.status(500).json({ error: "Failed to generate speech audio" });
      }

      res.json({ success: true, audio });
    } catch (error: any) {
      console.error("TTS generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate speech" });
    }
  });

  app.post("/api/tts/azure", async (req, res) => {
    try {
      const { text, voice = "en-US-JennyNeural", rate = 1 } = req.body;
      if (!text) return res.status(400).json({ error: "Text is required" });
      const buffer = await generateAzureAudio(text, voice, rate);
      res.set("Content-Type", "audio/mpeg");
      res.send(buffer);
    } catch (error: any) {
      console.error("Azure TTS error:", error?.response?.status ?? error.message);
      res.status(500).json({ error: error.message || "Azure TTS failed" });
    }
  });

  app.post("/api/tts/elevenlabs", async (req, res) => {
    try {
      const { text, voiceId = "21m00Tcm4TlvDq8ikWAM" } = req.body;
      if (!text) return res.status(400).json({ error: "Text is required" });
      const buffer = await generateElevenLabsAudio(text, voiceId);
      res.set("Content-Type", "audio/mpeg");
      res.send(buffer);
    } catch (error: any) {
      console.error("ElevenLabs TTS error:", error?.response?.status ?? error.message);
      res.status(500).json({ error: error.message || "ElevenLabs TTS failed" });
    }
  });

  app.post("/api/tts/voicerss", async (req, res) => {
    try {
      const { text, lang = "en-us", voice } = req.body;
      if (!text) return res.status(400).json({ error: "Text is required" });
      const buffer = await generateVoiceRSSAudio(text, lang, voice || undefined);
      res.set("Content-Type", "audio/mpeg");
      res.send(buffer);
    } catch (error: any) {
      console.error("VoiceRSS TTS error:", error?.response?.status ?? error.message);
      res.status(500).json({ error: error.message || "VoiceRSS TTS failed" });
    }
  });

  app.post("/api/tts/streamelements", async (req, res) => {
    try {
      const { text, voice = "Brian" } = req.body;
      if (!text) return res.status(400).json({ error: "Text is required" });
      const buffer = await generateStreamElementsAudio(text, voice);
      res.set("Content-Type", "audio/mpeg");
      res.send(buffer);
    } catch (error: any) {
      console.error("StreamElements TTS error:", error?.response?.status ?? error.message);
      res.status(500).json({ error: error.message || "StreamElements TTS failed" });
    }
  });

  app.get("/api/tts/providers", (_req, res) => {
    res.json({
      azure: Boolean(process.env.AZURE_TTS_KEY),
      elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
      voicerss: Boolean(process.env.VOICERSS_API_KEY),
      streamelements: true,
      gemini: Boolean(process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY),
      elevenLabsVoices: ELEVENLABS_VOICES,
      streamElementsVoices: STREAMELEMENTS_VOICES,
    });
  });

  app.post("/api/files/process", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const { buffer, mimetype } = req.file;

      if (mimetype.startsWith("image/")) {
        const base64 = buffer.toString("base64");
        const text = await extractTextFromImage(base64);
        return res.json({ success: true, text, type: "image" });
      }

      const text = await extractTextFromFile(buffer, mimetype);
      res.json({ success: true, text, type: "document" });
    } catch (error: any) {
      console.error("File processing error:", error);
      res.status(500).json({ error: error.message || "Failed to process file" });
    }
  });

  app.get("/api/random-topic", (req, res) => {
    try {
      const randomTopic = getRandomTopic();
      res.json({ success: true, ...randomTopic });
    } catch (error: any) {
      console.error("Random topic error:", error);
      res.status(500).json({ error: error.message || "Failed to get random topic" });
    }
  });

  // Projects API
  app.post("/api/projects", async (req, res) => {
    try {
      const { title, type, description, userId, language } = req.body;
      
      if (!title || !type || !userId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const project = await storage.createProject({
        title,
        type,
        description,
        userId,
        language: language || "en",
        status: "draft",
      });

      res.json({ success: true, project });
    } catch (error: any) {
      console.error("Project creation error:", error);
      res.status(500).json({ error: error.message || "Failed to create project" });
    }
  });

  app.get("/api/projects/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      const projects = await storage.getProjectsByUserId(userId);
      res.json({ success: true, projects });
    } catch (error: any) {
      console.error("Projects fetch error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(parseInt(id, 10));
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      res.json({ success: true, project });
    } catch (error: any) {
      console.error("Project fetch error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch project" });
    }
  });

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const project = await storage.updateProject(parseInt(id, 10), updates);
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      res.json({ success: true, project });
    } catch (error: any) {
      console.error("Project update error:", error);
      res.status(500).json({ error: error.message || "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({ error: "Project ID is required" });
      }

      await storage.deleteProject(parseInt(id, 10));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Project deletion error:", error);
      res.status(500).json({ error: error.message || "Failed to delete project" });
    }
  });

  // Documents API
  app.post("/api/documents", async (req, res) => {
    try {
      const { projectId, userId, type, title, topic, content, settings, language } = req.body;
      
      if (!userId || !type || !title) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const document = await storage.createDocument({
        projectId,
        userId,
        type,
        title,
        topic,
        content,
        settings,
        language: language || "en",
      });

      // Track analytics
      await storage.createAnalyticsEvent({
        userId,
        eventType: "generation",
        documentType: type,
        metadata: { title, language },
      });

      res.json({ success: true, document });
    } catch (error: any) {
      console.error("Document creation error:", error);
      res.status(500).json({ error: error.message || "Failed to create document" });
    }
  });

  app.get("/api/documents/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const documents = await storage.getDocumentsByUserId(userId);
      res.json({ success: true, documents });
    } catch (error: any) {
      console.error("Documents fetch error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch documents" });
    }
  });

  app.get("/api/documents/project/:projectId", async (req, res) => {
    try {
      const { projectId } = req.params;
      const documents = await storage.getDocumentsByProjectId(parseInt(projectId, 10));
      res.json({ success: true, documents });
    } catch (error: any) {
      console.error("Documents fetch error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch documents" });
    }
  });

  app.get("/api/documents/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const document = await storage.getDocument(parseInt(id, 10));
      
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      res.json({ success: true, document });
    } catch (error: any) {
      console.error("Document fetch error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch document" });
    }
  });

  app.delete("/api/documents/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteDocument(parseInt(id, 10));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Document deletion error:", error);
      res.status(500).json({ error: error.message || "Failed to delete document" });
    }
  });

  // Templates API
  // ── Built-in Templates (no DB needed — served from memory) ──────────────
  const BUILT_IN_TEMPLATES = [
    { id: 1,  name: "IEEE Conference Paper",        category: "paper",         type: "conference", usageCount: 1250, description: "Standard IEEE format for conference submissions with abstract, introduction, methodology, results, and conclusion sections.", structure: { sections: ["Abstract","Introduction","Related Work","Methodology","Results","Discussion","Conclusion","References"] }, prompt: "Write an IEEE conference paper on machine learning applications in healthcare with abstract, introduction, related work, methodology, results, discussion, and conclusion sections.", isDefault: true },
    { id: 2,  name: "Harvard Thesis",               category: "thesis",        type: "thesis",     usageCount: 890,  description: "Complete thesis structure following Harvard citation style with chapters for literature review, methodology, and findings.", structure: { chapters: ["Introduction","Literature Review","Methodology","Findings","Discussion","Conclusion","Bibliography"] }, prompt: "Write a comprehensive thesis on climate change impact on coastal ecosystems with introduction, literature review, methodology, findings, discussion, and conclusion chapters.", isDefault: true },
    { id: 3,  name: "Technical Report - BET",       category: "report",        type: "report",     usageCount: 720,  description: "Professional technical report format following BET standards with executive summary and detailed analysis sections.", structure: { sections: ["Executive Summary","Introduction","Technical Analysis","Implementation","Results","Recommendations","Appendices"] }, prompt: "Write a technical report on cybersecurity implementation in enterprise systems with executive summary, technical analysis, implementation details, and recommendations.", isDefault: true },
    { id: 4,  name: "Business Presentation",        category: "presentation",  type: "powerpoint", usageCount: 1580, description: "Professional presentation template with title slide, agenda, key points, data visualization, and call-to-action.", structure: { slides: ["Title","Agenda","Problem Statement","Solution Overview","Key Benefits","Implementation","Timeline","Q&A"] }, prompt: "Create a business presentation on digital transformation strategy with problem statement, solution overview, key benefits, and implementation timeline.", isDefault: true },
    { id: 5,  name: "Research Proposal",            category: "paper",         type: "conference", usageCount: 650,  description: "Academic research proposal template with problem statement, objectives, methodology, and timeline.", structure: { sections: ["Title","Abstract","Problem Statement","Research Objectives","Literature Review","Methodology","Timeline","Budget","References"] }, prompt: "Write a research proposal on artificial intelligence in education with problem statement, research objectives, literature review, methodology, and timeline.", isDefault: true },
    { id: 6,  name: "Lab Report",                   category: "report",        type: "report",     usageCount: 480,  description: "Scientific lab report template with hypothesis, materials, procedure, data, and analysis sections.", structure: { sections: ["Title","Abstract","Introduction","Hypothesis","Materials","Procedure","Data & Observations","Analysis","Conclusion","References"] }, prompt: "Write a lab report on chemical reaction kinetics experiment with hypothesis, materials, procedure, data observations, and analysis.", isDefault: true },
    { id: 7,  name: "Academic Essay",               category: "essay",         type: "report",     usageCount: 920,  description: "Standard academic essay format with thesis statement, body paragraphs, and conclusion.", structure: { sections: ["Introduction","Thesis Statement","Body Paragraph 1","Body Paragraph 2","Body Paragraph 3","Counterargument","Conclusion","Works Cited"] }, prompt: "Write an academic essay on the impact of social media on mental health with thesis statement, supporting arguments, counterargument, and conclusion.", isDefault: true },
    { id: 8,  name: "Pitch Deck",                   category: "presentation",  type: "powerpoint", usageCount: 1100, description: "Startup pitch deck template with problem, solution, market, business model, and ask slides.", structure: { slides: ["Title","Problem","Solution","Product Demo","Market Size","Business Model","Traction","Team","Financials","The Ask"] }, prompt: "Create a startup pitch deck for a sustainable food delivery platform with problem, solution, market size, business model, and funding ask.", isDefault: true },
    { id: 9,  name: "Nature Photography",           category: "image",         type: "images",     usageCount: 850,  description: "Beautiful nature and landscape photography prompts for stunning outdoor scenes.", structure: {}, prompt: "A breathtaking mountain landscape at golden hour with snow-capped peaks, a crystal clear alpine lake reflecting the sky, and wildflowers in the foreground, professional nature photography", isDefault: true },
    { id: 10, name: "Portrait Art",                 category: "image",         type: "images",     usageCount: 920,  description: "Artistic portrait templates for character design and portrait photography.", structure: {}, prompt: "Professional portrait of a person with soft natural lighting, shallow depth of field, warm tones, elegant composition, studio photography", isDefault: true },
    { id: 11, name: "Fantasy Scene",                category: "image",         type: "images",     usageCount: 1200, description: "Magical and fantastical scene templates with mystical elements.", structure: {}, prompt: "An enchanted forest with glowing mushrooms, bioluminescent plants, fairy lights dancing among ancient trees, magical mist, fantasy digital art", isDefault: true },
    { id: 12, name: "Modern Architecture",          category: "image",         type: "images",     usageCount: 680,  description: "Contemporary architectural designs and urban photography.", structure: {}, prompt: "Modern minimalist architecture with clean lines, glass facades, geometric shapes, dramatic shadows, professional architectural photography", isDefault: true },
    { id: 13, name: "Abstract Art",                 category: "image",         type: "images",     usageCount: 750,  description: "Abstract and creative art templates with vibrant colors and patterns.", structure: {}, prompt: "Abstract art with flowing colors, geometric patterns, vibrant gradients, modern digital art style, visually striking composition", isDefault: true },
  ];
  // In-memory usage counters (persist across requests, reset on redeploy — acceptable for display counts)
  const templateUsage: Record<number, number> = {};

  app.get("/api/templates", (req, res) => {
    const { category } = req.query;
    let list = BUILT_IN_TEMPLATES.map(t => ({ ...t, usageCount: t.usageCount + (templateUsage[t.id] ?? 0) }));
    if (category && category !== "all") list = list.filter(t => t.category === category);
    res.json({ success: true, templates: list });
  });

  app.get("/api/templates/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const template = BUILT_IN_TEMPLATES.find(t => t.id === id);
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json({ success: true, template: { ...template, usageCount: template.usageCount + (templateUsage[id] ?? 0) } });
  });

  app.post("/api/templates/:id/use", (req, res) => {
    const id = parseInt(req.params.id, 10);
    templateUsage[id] = (templateUsage[id] ?? 0) + 1;
    res.json({ success: true });
  });

  // Reference Auto-Fetch APIs

  // Fetch metadata from URL (proxy to avoid CORS)
  app.post("/api/references/fetch-url", async (req, res) => {
    try {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({ success: false, error: "URL is required" });
      }

      let parsedUrl: URL;
      try {
        parsedUrl = await assertPublicHttpUrl(url);
      } catch (error) {
        return res.status(400).json({ success: false, error: getErrorMessage(error) || "Invalid URL format" });
      }


      // Fetch the webpage with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(parsedUrl.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: controller.signal,
        redirect: 'error',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return res.status(400).json({ success: false, error: `Website returned error: ${response.status}` });
      }

      const html = await response.text();

      // Extract metadata from HTML
      const getMetaContent = (name: string): string => {
        const patterns = [
          new RegExp(`<meta[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'),
          new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*(?:name|property)=["']${name}["']`, 'i'),
        ];
        for (const pattern of patterns) {
          const match = html.match(pattern);
          if (match) return match[1];
        }
        return '';
      };

      // Extract title
      let title = getMetaContent('og:title') || getMetaContent('twitter:title');
      if (!title) {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        title = titleMatch ? titleMatch[1].trim() : '';
      }

      // Extract author
      let authors = getMetaContent('author') || getMetaContent('article:author') || getMetaContent('citation_author');

      // Extract date/year
      let dateStr = getMetaContent('article:published_time') || getMetaContent('publication_date') || getMetaContent('date') || getMetaContent('citation_publication_date');
      let year = '';
      if (dateStr) {
        const yearMatch = dateStr.match(/(\d{4})/);
        year = yearMatch ? yearMatch[1] : '';
      }

      // Extract description
      const description = getMetaContent('og:description') || getMetaContent('description') || getMetaContent('twitter:description');

      // Extract site name as source
      const source = getMetaContent('og:site_name') || getMetaContent('application-name') || parsedUrl.hostname;

      // Extract DOI if present
      let doi = getMetaContent('citation_doi') || getMetaContent('DC.identifier');
      if (!doi) {
        const doiMatch = html.match(/10\.\d{4,}\/[^\s"'<>]+/);
        doi = doiMatch ? doiMatch[0] : '';
      }

      res.json({
        success: true,
        metadata: {
          title: title.replace(/\s+/g, ' ').trim(),
          authors: authors.replace(/\s+/g, ' ').trim(),
          year,
          source,
          url: parsedUrl.toString(),
          doi,
          notes: description ? description.substring(0, 500) : '',
          type: 'website',
        }
      });
    } catch (error: any) {
      console.error("[references] URL fetch error:", error.message || error);

      let errorMessage = "Failed to fetch URL metadata";
      if (error.name === 'AbortError') {
        errorMessage = "Request timed out. The website took too long to respond.";
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = "Could not reach the website. Please check the URL.";
      } else if (error.code === 'CERT_HAS_EXPIRED' || error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
        errorMessage = "SSL certificate error with this website.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      res.status(500).json({ success: false, error: errorMessage });
    }
  });

  // Fetch metadata from DOI via CrossRef API
  app.post("/api/references/fetch-doi", async (req, res) => {
    try {
      const { doi } = req.body;

      if (!doi) {
        return res.status(400).json({ error: "DOI is required" });
      }

      // Clean the DOI
      let cleanDoi = doi.trim();
      cleanDoi = cleanDoi.replace(/^https?:\/\/doi\.org\//i, '');
      cleanDoi = cleanDoi.replace(/^doi:/i, '');

      // Fetch from CrossRef API
      const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`, {
        headers: {
          'User-Agent': 'AcademicGen/1.0 (mailto:support@academicgen.com)',
        },
      });

      if (!response.ok) {
        throw new Error(`DOI not found: ${response.status}`);
      }

      const data = await response.json();
      const work = data.message;

      // Extract authors
      const authors = work.author
        ? work.author.map((a: any) => `${a.family || ''}${a.given ? ', ' + a.given : ''}`).join('; ')
        : '';

      // Extract year
      const dateInfo = work.published?.['date-parts']?.[0] || work['published-print']?.['date-parts']?.[0] || work.created?.['date-parts']?.[0];
      const year = dateInfo ? dateInfo[0]?.toString() : '';

      // Determine type
      let type = 'article';
      if (work.type === 'book' || work.type === 'book-chapter') type = 'book';
      else if (work.type === 'proceedings-article') type = 'conference';
      else if (work.type === 'report') type = 'report';
      else if (work.type === 'dissertation') type = 'thesis';

      res.json({
        success: true,
        metadata: {
          title: work.title?.[0] || '',
          authors,
          year,
          source: work['container-title']?.[0] || work.publisher || '',
          url: work.URL || `https://doi.org/${cleanDoi}`,
          doi: cleanDoi,
          type,
          notes: work.abstract ? work.abstract.replace(/<[^>]*>/g, '').substring(0, 500) : '',
        }
      });
    } catch (error: any) {
      console.error("DOI fetch error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch DOI metadata" });
    }
  });

  // References API
  app.get("/api/references/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const refs = await storage.getReferences(userId);
      res.json({ success: true, references: refs });
    } catch (error: any) {
      console.error("References fetch error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch references" });
    }
  });

  app.post("/api/references", async (req, res) => {
    try {
      const { userId, title, authors, year, source, url, doi, type, notes, tags } = req.body;
      
      if (!userId || !title) {
        return res.status(400).json({ error: "User ID and title are required" });
      }

      const reference = await storage.createReference({
        userId,
        title,
        authors,
        year,
        source,
        url,
        doi,
        type: type || "article",
        notes,
        tags,
      });

      res.json({ success: true, reference });
    } catch (error: any) {
      console.error("Reference creation error:", error);
      res.status(500).json({ error: error.message || "Failed to create reference" });
    }
  });

  app.patch("/api/references/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const reference = await storage.updateReference(parseInt(id, 10), updates);
      
      if (!reference) {
        return res.status(404).json({ error: "Reference not found" });
      }

      res.json({ success: true, reference });
    } catch (error: any) {
      console.error("Reference update error:", error);
      res.status(500).json({ error: error.message || "Failed to update reference" });
    }
  });

  app.delete("/api/references/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteReference(parseInt(id, 10));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Reference deletion error:", error);
      res.status(500).json({ error: error.message || "Failed to delete reference" });
    }
  });

  // Citations API
  app.post("/api/citations/format", async (req, res) => {
    try {
      const { referenceId, userId, style } = req.body;
      
      if (!userId || !style) {
        return res.status(400).json({ error: "User ID and style are required" });
      }

      // Get reference if referenceId provided
      let reference = null;
      if (referenceId) {
        reference = await storage.getReference(referenceId);
      }

      // Format citation using AI
      const citationPrompt = reference 
        ? `Format this reference in ${style.toUpperCase()} style: Title: "${reference.title}", Authors: "${reference.authors || 'Unknown'}", Year: "${reference.year || 'n.d.'}", Source: "${reference.source || ''}", URL: "${reference.url || ''}", DOI: "${reference.doi || ''}". Return JSON with "formatted" (full citation) and "inText" (in-text citation) fields.`
        : `Provide an example ${style.toUpperCase()} citation format. Return JSON with "formatted" (full citation example) and "inText" (in-text citation example) fields.`;

      const response = await generateChatResponse(citationPrompt);
      
      let parsed;
      try {
        parsed = JSON.parse(response);
      } catch {
        parsed = { formatted: response, inText: "" };
      }

      if (reference) {
        await storage.createCitation({
          referenceId,
          userId,
          style,
          formattedCitation: parsed.formatted,
          inTextCitation: parsed.inText,
        });
      }

      res.json({ 
        success: true, 
        citation: {
          formatted: parsed.formatted,
          inText: parsed.inText,
          style,
        }
      });
    } catch (error: any) {
      console.error("Citation format error:", error);
      res.status(500).json({ error: error.message || "Failed to format citation" });
    }
  });

  // AI Assistant API
  app.post("/api/ai/session", async (req, res) => {
    try {
      const { userId, projectId, documentId, sessionType } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      const session = await storage.createAiSession({
        userId,
        projectId,
        documentId,
        sessionType: sessionType || "writing_assistant",
      });

      res.json({ success: true, session });
    } catch (error: any) {
      console.error("AI session creation error:", error);
      res.status(500).json({ error: error.message || "Failed to create AI session" });
    }
  });

  app.get("/api/ai/session/:id/messages", async (req, res) => {
    try {
      const { id } = req.params;
      const messages = await storage.getAiMessages(parseInt(id, 10));
      res.json({ success: true, messages });
    } catch (error: any) {
      console.error("AI messages fetch error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch messages" });
    }
  });

  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { sessionId, message, context, language } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      // Build context-aware prompt
      const systemContext = context
        ? `You are an academic writing assistant. The user is working on: ${context}. Help them improve their writing.`
        : "You are an academic writing assistant. Help the user improve their academic writing.";

      const response = await generateChatResponse(`${systemContext}\n\nUser: ${message}`, language);

      if (sessionId) {
        try {
          await storage.createAiMessage({ sessionId, role: "user", content: message });
          await storage.createAiMessage({ sessionId, role: "assistant", content: response });
        } catch (_dbError) {
          // non-critical — database unavailable
        }
      }

      res.json({ success: true, response });
    } catch (error: any) {
      console.error("[AI Chat] Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate response" });
    }
  });

  // Grammar Check API
  app.post("/api/ai/grammar", async (req, res) => {
    try {
      const { userId, documentId, text } = req.body;

      if (!text || !text.trim()) {
        return res.status(400).json({ error: "Please enter some text to check." });
      }

      const suggestions = await checkGrammar(text);

      // Save suggestions to DB only when user is authenticated
      if (userId && documentId && Array.isArray(suggestions)) {
        for (const s of suggestions) {
          if (s.original && s.suggested) {
            await storage.createGrammarSuggestion({
              userId,
              documentId,
              originalText: s.original,
              suggestedText: s.suggested,
              suggestionType: s.type,
              explanation: s.explanation,
            });
          }
        }
      }

      res.json({ success: true, suggestions });
    } catch (error: any) {
      console.error("Grammar check error:", error);
      res.status(500).json({ error: error.message || "Failed to check grammar" });
    }
  });

  app.post("/api/ai/grammar/:id/apply", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.applyGrammarSuggestion(parseInt(id, 10));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Grammar apply error:", error);
      res.status(500).json({ error: error.message || "Failed to apply suggestion" });
    }
  });

  // Analytics API
  app.get("/api/analytics/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const summary = await storage.getAnalyticsSummary(userId);
      const events = await storage.getAnalyticsByUser(userId);
      res.json({ success: true, summary, recentEvents: events.slice(0, 20) });
    } catch (error: any) {
      console.error("Analytics fetch error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch analytics" });
    }
  });

  // Languages API
  app.get("/api/languages", (req, res) => {
    const { SUPPORTED_LANGUAGES } = require("@shared/schema");
    res.json({ success: true, languages: SUPPORTED_LANGUAGES });
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { message, fileContent, fileName, language } = req.body;

      if (!message && !fileContent) {
        return res.status(400).json({ error: "Message is required" });
      }

      const fullMessage = fileContent
        ? `${message || "Please analyze this file."}\n\n--- Attached file: ${fileName || "document"} ---\n${fileContent}`
        : message;

      const response = await generateChatResponse(fullMessage, language);
      res.json({ success: true, response });
    } catch (error: any) {
      console.error("Chat error:", error);
      res.status(500).json({ error: error.message || "Failed to generate response" });
    }
  });

  app.get("/api/usage/:userId", async (req, res) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      const authenticatedUid = await requireMatchingUser(req, res, userId);
      if (!authenticatedUid) return;

      // Use getOrCreateSubscription to ensure usage persists across login/logout
      // This creates a record if it doesn't exist and returns the persisted data
      const subscription = await firebaseSubscriptionStorage.getOrCreateSubscription(userId);

      const hasActiveSubscription = subscription.subscriptionStatus === "active" &&
        subscription.subscriptionExpiry &&
        new Date(subscription.subscriptionExpiry) > new Date();

      // Prevent HTTP caching - always return fresh usage data
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      res.json({
        success: true,
        usage: {
          attemptsUsed: subscription.freeAttemptsUsed,
          maxAttempts: subscription.maxFreeAttempts,
          subscriptionStatus: subscription.subscriptionStatus,
          subscriptionTier: subscription.subscriptionTier,
          subscriptionExpiry: subscription.subscriptionExpiry,
          hasActiveSubscription,
        }
      });
    } catch (error: any) {
      console.error("Usage fetch error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch usage" });
    }
  });

  app.post("/api/usage/record", async (req, res) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      const authenticatedUid = await requireMatchingUser(req, res, userId);
      if (!authenticatedUid) return;

      // Use Firebase subscription storage
      const result = await firebaseSubscriptionStorage.incrementUsage(userId);

      if (!result.success) {
        return res.status(403).json({
          error: "Usage limit reached",
          attemptsUsed: result.attemptsUsed,
          maxAttempts: result.maxAttempts,
          requiresSubscription: true,
        });
      }

      res.json({
        success: true,
        attemptsUsed: result.attemptsUsed,
        maxAttempts: result.maxAttempts,
      });
    } catch (error: any) {
      console.error("Usage record error:", error);
      res.status(500).json({ error: error.message || "Failed to record usage" });
    }
  });

  // ============== BUY ME A COFFEE ROUTES ==============

  // Get BMC checkout URL
  app.get("/api/bmc/checkout-url", async (req, res) => {
    try {
      if (!isBMCConfigured()) {
        return res.status(503).json({ error: "Buy Me a Coffee is not configured" });
      }
      const tier = req.query.tier as string | undefined;
      if (tier && !isPricingTier(tier)) {
        return res.status(400).json({ error: "Invalid pricing tier" });
      }
      const url = getBMCCheckoutUrl(tier ? tier as PricingTier : undefined);
      res.json({ url });
    } catch (error: any) {
      console.error("BMC URL error:", error);
      res.status(500).json({ error: "Failed to get BMC URL" });
    }
  });

  // Get BMC products
  app.get("/api/bmc/products", async (req, res) => {
    try {
      if (!isBMCConfigured()) {
        return res.status(503).json({ error: "Buy Me a Coffee is not configured" });
      }
      const products = getBMCProducts();
      res.json({ products });
    } catch (error: any) {
      console.error("BMC products error:", error);
      res.status(500).json({ error: "Failed to get products" });
    }
  });

  // Get payment provider info
  app.get("/api/payment/provider", (_req, res) => {
    const bmc = isBMCConfigured();
    const preferred: PaymentProvider = bmc ? "bmc" : "none";
    res.json({ preferred, bmc, yoco: false, stripe: false });
  });

  // ============== HUMANIZER API ==============

  let _requirePaidCache: { value: boolean; at: number } | null = null;

  async function getRequirePaidForScan(): Promise<boolean> {
    const now = Date.now();
    if (_requirePaidCache && now - _requirePaidCache.at < 60000) return _requirePaidCache.value;
    try {
      const { getApps, getApp } = await import("firebase-admin/app");
      const { getFirestore: getAdminFs } = await import("firebase-admin/firestore");
      if (getApps().length === 0) return true;
      const snap = await getAdminFs(getApp()).collection("settings").doc("planLimits").get();
      const value = snap.data()?.requirePaidForScan !== false;
      _requirePaidCache = { value, at: now };
      return value;
    } catch { return true; }
  }

  async function checkPaidAccess(req: Request): Promise<{ allowed: boolean; uid: string | null; plan: string; isAdmin: boolean; reason?: string }> {
    const token = req.body?.token as string | undefined;
    if (!token) return { allowed: false, uid: null, plan: "none", isAdmin: false, reason: "not_authenticated" };
    try {
      const { getApps, getApp } = await import("firebase-admin/app");
      const { getAuth } = await import("firebase-admin/auth");
      const { getFirestore: getAdminFs } = await import("firebase-admin/firestore");
      if (getApps().length === 0) return { allowed: true, uid: null, plan: "unknown", isAdmin: false };

      const decoded = await getAuth(getApp()).verifyIdToken(token);
      const uid = decoded.uid;
      const db = getAdminFs(getApp());

      const userSnap = await db.collection("users").doc(uid).get();
      const userData = userSnap.data() ?? {};
      if (userData.isAdmin === true) return { allowed: true, uid, plan: "admin", isAdmin: true };

      const userPlan = (userData.plan as string) ?? "";
      const PAID_PLANS = ["pro", "business", "monthly", "yearly", "weekly", "day_pass"];
      if (PAID_PLANS.includes(userPlan)) {
        // Also check planExpiresAt if present (set by BMC frontend activation)
        const planExpiresAt = userData.planExpiresAt as string | undefined;
        if (!planExpiresAt || new Date(planExpiresAt) > new Date()) {
          return { allowed: true, uid, plan: userPlan, isAdmin: false };
        }
      }

      // Fallback: check subscriptions collection for any active paid subscription
      const subSnap = await db.collection("subscriptions").doc(uid).get();
      const sub = subSnap.data() ?? {};
      const isActive = sub.subscriptionStatus === "active" &&
        sub.subscriptionExpiry && new Date(sub.subscriptionExpiry.toDate?.() ?? sub.subscriptionExpiry) > new Date();
      if (isActive) return { allowed: true, uid, plan: (sub.subscriptionTier as string) ?? "paid", isAdmin: false };

      return { allowed: false, uid, plan: userPlan || "free", isAdmin: false, reason: "upgrade_required" };
    } catch (e: any) {
      console.warn(`[Access] Auth check failed: ${e.message}`);
      return { allowed: false, uid: null, plan: "none", isAdmin: false, reason: "auth_failed" };
    }
  }

  interface SentenceScore {
    idx: number;
    text: string;
    score: number;
    isAI: boolean;
  }

  async function detectAiContentFull(text: string): Promise<{ aiPercentage: number; sentenceScores: SentenceScore[] }> {
    const raw = text.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [text];
    const sentences = raw.slice(0, 50).map(s => s.trim()).filter(s => s.length > 8);

    // 1. GPTZero (primary)
    const gptzeroKey = process.env.GPTZERO_API_KEY;
    if (gptzeroKey) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 30000);
        const resp = await fetch("https://api.gptzero.me/v2/predict/text", {
          method: "POST",
          headers: { "x-api-key": gptzeroKey, "Content-Type": "application/json" },
          body: JSON.stringify({ document: text }),
          signal: ctrl.signal,
        });
        clearTimeout(tid);
        if (resp.ok) {
          const data = await resp.json();
          const docData = data.documents?.[0] ?? data;
          const aiPercentage = Math.round((docData.completely_generated_prob ?? 0) * 100);
          const sents: any[] = docData.sentences ?? [];
          const sentenceScores: SentenceScore[] = sents.map((s: any, idx: number) => ({
            idx,
            text: s.sentence ?? "",
            score: Math.round((s.generated_prob ?? 0) * 100),
            isAI: (s.generated_prob ?? 0) > 0.5,
          }));
          console.log("[Detection] GPTZero succeeded");
          return { aiPercentage: Math.max(0, Math.min(100, aiPercentage)), sentenceScores };
        }
      } catch (e: any) {
        console.warn(`[Detection] GPTZero failed: ${e.message}`);
      }
    }

    // 2. Gemini rotation (keys 1→2→3→4 via withKeyFallback in generateChatResponse)
    if (sentences.length === 0) return { aiPercentage: 50, sentenceScores: [] };
    const numbered = sentences.map((s, i) => `${i + 1}. ${s}`).join("\n");
    const prompt = `Analyze this text for AI-generated content. For each numbered sentence estimate probability (0-100) it was written by AI.
Factors: uniform tone, repetitive structures, lack of personal voice, overly formal/generic phrasing.
Return ONLY valid JSON: {"aiPercentage": 65, "scores": [72, 15, 88, 40]}
One score per sentence, overall aiPercentage as weighted average.

${numbered}`;

    try {
      const response = await generateChatResponse(prompt);
      const objMatch = response.match(/\{[\s\S]*?\}/);
      if (objMatch) {
        const parsed = JSON.parse(objMatch[0]);
        const rawScores: number[] = Array.isArray(parsed.scores) ? parsed.scores : [];
        const sentenceScores: SentenceScore[] = sentences.map((t, idx) => ({
          idx,
          text: t,
          score: Math.max(0, Math.min(100, rawScores[idx] ?? 50)),
          isAI: (rawScores[idx] ?? 50) >= 60,
        }));
        const overall = parsed.aiPercentage ?? Math.round(
          sentenceScores.reduce((s, x) => s + x.score, 0) / sentenceScores.length
        );
        console.log("[Detection] Gemini succeeded");
        return { aiPercentage: Math.max(0, Math.min(100, overall)), sentenceScores };
      }
    } catch (e: any) {
      console.warn(`[Detection] All Gemini keys failed: ${e.message}`);
    }

    // 3. DeepSeek (last resort)
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    if (deepseekKey) {
      try {
        const ctrl2 = new AbortController();
        const tid2 = setTimeout(() => ctrl2.abort(), 30000);
        const dsResp = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${deepseekKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: "Analyze text for AI-generated content. Return only valid JSON." },
              { role: "user", content: `For each numbered sentence, estimate probability (0-100) it was AI-written.\nReturn ONLY JSON: {"aiPercentage": 65, "scores": [72, 15, 88]}\n\n${numbered}` },
            ],
            temperature: 0.3,
            max_tokens: 1000,
          }),
          signal: ctrl2.signal,
        });
        clearTimeout(tid2);
        if (dsResp.ok) {
          const dsData = await dsResp.json();
          const content = dsData.choices?.[0]?.message?.content ?? "";
          const objM = content.match(/\{[\s\S]*?\}/);
          if (objM) {
            const parsed = JSON.parse(objM[0]);
            const rawScores = Array.isArray(parsed.scores) ? parsed.scores : [];
            const sentenceScores: SentenceScore[] = sentences.map((t, idx) => ({
              idx,
              text: t,
              score: Math.max(0, Math.min(100, rawScores[idx] ?? 50)),
              isAI: (rawScores[idx] ?? 50) >= 60,
            }));
            const overall = parsed.aiPercentage ?? Math.round(
              sentenceScores.reduce((s, x) => s + x.score, 0) / Math.max(sentenceScores.length, 1)
            );
            console.log("[Detection] DeepSeek succeeded");
            return { aiPercentage: Math.max(0, Math.min(100, overall)), sentenceScores };
          }
        }
      } catch (e: any) {
        console.warn(`[Detection] DeepSeek failed: ${e.message}`);
      }
    }

    // Final fallback: overall % only via Gemini
    const fallback = await generateChatResponse(
      `Estimate what % (0-100) of this text was written by AI. Return ONLY JSON: {"aiPercentage": 65}\n\n${text.substring(0, 2000)}`
    ).catch(() => '{"aiPercentage": 50}');
    const fm = fallback.match(/\{\s*"aiPercentage"\s*:\s*(\d+)/);
    const pct = fm ? Math.max(0, Math.min(100, Number(fm[1]))) : 50;
    return {
      aiPercentage: pct,
      sentenceScores: sentences.map((t, idx) => ({ idx, text: t, score: pct, isAI: pct >= 60 })),
    };
  }

  async function humanizeWithApi(
    text: string,
    mode: string,
    modelPref = "auto"
  ): Promise<{ text: string; modelUsed: string }> {
    const humanizeKey = process.env.HUMANIZE_API_KEY || "";
    const deepseekKey = process.env.DEEPSEEK_API_KEY || "";

    const modeHints: Record<string, string> = {
      academic: "maintaining academic vocabulary and formal scholarly tone",
      casual: "using everyday conversational language and a natural tone",
      creative: "with varied and expressive creative language",
      professional: "using clear, concise professional business language",
    };
    const hint = modeHints[mode] || modeHints.academic;

    const tryHumanizeAIPro = async (): Promise<string | null> => {
      if (!humanizeKey) return null;
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 30000);
        const apiRes = await fetch("https://thehumanizeai.pro/api/humanize", {
          method: "POST",
          headers: { "Authorization": `Bearer ${humanizeKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ text, mode: mode || "academic" }),
          signal: ctrl.signal,
        });
        clearTimeout(tid);
        if (apiRes.ok) {
          const data = await apiRes.json();
          return data.humanized_text || data.humanizedText || null;
        }
        return null;
      } catch { console.log("[Paraphrase] Humanize AI Pro unavailable"); return null; }
    };

    const tryGemini = async (): Promise<string | null> => {
      try {
        return await generateChatResponse(
          `Rewrite the following text to sound natural and human-written, ${hint}.\nVary sentence structure, use natural transitions, avoid repetitive phrasing. Preserve all factual information.\nReturn ONLY the rewritten text.\n\nText:\n${text}`
        );
      } catch { console.log("[Paraphrase] All Gemini keys failed"); return null; }
    };

    const tryDeepSeek = async (): Promise<string | null> => {
      if (!deepseekKey) return null;
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 60000);
        const resp = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${deepseekKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              {
                role: "system",
                content: "You are an expert text humanizer. Rewrite AI-generated text to sound completely natural and human-written. Rules: vary sentence length, use natural contractions, avoid robotic patterns, add natural transitions, preserve original meaning exactly, do not add new information, write as a human would naturally.",
              },
              { role: "user", content: `Humanize: ${text}` },
            ],
            temperature: 0.8,
            max_tokens: 2000,
          }),
          signal: ctrl.signal,
        });
        clearTimeout(tid);
        if (resp.ok) {
          const data = await resp.json();
          return data.choices?.[0]?.message?.content || null;
        }
        return null;
      } catch { console.log("[Paraphrase] DeepSeek unavailable"); return null; }
    };

    if (modelPref === "gemini") {
      const r = await tryGemini();
      if (r) return { text: r, modelUsed: "Gemini" };
      const r2 = await tryDeepSeek();
      if (r2) return { text: r2, modelUsed: "DeepSeek" };
      throw new Error("All paraphrasing services failed.");
    }

    if (modelPref === "deepseek") {
      const r = await tryDeepSeek();
      if (r) return { text: r, modelUsed: "DeepSeek" };
      const r2 = await tryGemini();
      if (r2) return { text: r2, modelUsed: "Gemini (fallback)" };
      throw new Error("All paraphrasing services failed.");
    }

    // "auto" or "humanize_ai" — try full chain in priority order
    const r1 = await tryHumanizeAIPro();
    if (r1) return { text: r1, modelUsed: "Humanize AI Pro" };

    const r2 = await tryGemini();
    if (r2) return { text: r2, modelUsed: "Gemini" };

    const r3 = await tryDeepSeek();
    if (r3) return { text: r3, modelUsed: "DeepSeek" };

    throw new Error("All paraphrasing services failed. Please try again.");
  }

  // Extract text from uploaded file
  app.post("/api/humanize/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const { buffer, mimetype, originalname } = req.file;
      const ext = (originalname || "").split(".").pop()?.toLowerCase() || "";

      let text = "";

      try {
        if (mimetype === "application/pdf" || ext === "pdf") {
          text = await extractTextFromFile(buffer, "application/pdf");
        } else if (
          mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          ext === "docx"
        ) {
          text = await extractTextFromFile(buffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        } else if (mimetype.startsWith("text/") || ["txt", "md", "pptx"].includes(ext)) {
          // For PPTX and text files, try reading as UTF-8 directly
          text = buffer.toString("utf-8").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, " ").trim();
        } else if (["jpg", "jpeg", "png", "webp"].includes(ext) || mimetype.startsWith("image/")) {
          text = await extractTextFromImage(buffer.toString("base64"));
        } else {
          return res.status(400).json({
            error: `Unsupported file type ".${ext}". Supported: PDF, DOCX, TXT, JPG, PNG, WEBP`,
          });
        }
      } catch (extractErr: any) {
        console.warn(`[Humanizer Upload] Primary extraction failed (${ext}):`, extractErr.message);
        return res.status(422).json({
          error: `Could not extract readable text from this ${ext.toUpperCase()} file. Please open the file, select all text (Ctrl+A), copy (Ctrl+C), then paste it here instead.`,
        });
      }

      if (!text.trim()) {
        return res.status(400).json({
          error: "No readable text found in this file. Try pasting the text directly.",
        });
      }

      res.json({ success: true, text, fileName: originalname });
    } catch (error: any) {
      console.error("[Humanizer Upload] Unexpected error:", error);
      res.status(500).json({ error: "Unexpected server error during file upload" });
    }
  });

  async function getParaphraseModel(uid: string | undefined): Promise<string> {
    if (!uid) return "auto";
    try {
      const { getApps, getApp } = await import("firebase-admin/app");
      const { getFirestore: getAdminFs } = await import("firebase-admin/firestore");
      const apps = getApps();
      if (apps.length === 0) return "auto";
      const snap = await getAdminFs(getApp()).collection("users").doc(uid).get();
      return (snap.data()?.paraphraseModel as string) ?? "auto";
    } catch {
      return "auto";
    }
  }

  app.post("/api/humanize", async (req, res) => {
    try {
      const { text, mode } = req.body;
      if (!text?.trim()) return res.status(400).json({ error: "Text is required" });

      const wordCount = text.trim().split(/\s+/).length;
      if (wordCount > 10000) return res.status(400).json({ error: "Text exceeds 10,000 word limit" });

      let accessUid: string | null | undefined = req.body?.uid;
      const requirePaid = await getRequirePaidForScan();
      if (requirePaid) {
        const access = await checkPaidAccess(req);
        if (!access.allowed) {
          return res.status(403).json({
            error: "upgrade_required",
            message: "AI detection and paraphrasing are available on Pro and Business plans only. Upgrade now to humanize your documents.",
            redirect: "/pricing",
            reason: access.reason,
          });
        }
        accessUid = access.uid ?? accessUid;
      }

      const modelPref = await getParaphraseModel(accessUid ?? undefined);
      const { text: humanizedText, modelUsed } = await humanizeWithApi(text, mode || "academic", modelPref);

      // Run detection on original and humanized in parallel
      const [originalResult, humanizedResult] = await Promise.all([
        detectAiContentFull(text),
        detectAiContentFull(humanizedText),
      ]);

      res.json({
        success: true,
        humanizedText,
        originalText: text,
        originalAiScore: originalResult.aiPercentage,
        humanizedAiScore: humanizedResult.aiPercentage,
        humanizedScores: humanizedResult.sentenceScores,
        originalScores: originalResult.sentenceScores,
        modelUsed,
      });
    } catch (error: any) {
      console.error("[Humanizer] Error:", error);
      res.status(500).json({ error: error.message || "Failed to humanize text" });
    }
  });

  app.post("/api/humanize/detect", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text?.trim()) return res.status(400).json({ error: "Text is required" });

      const requirePaid = await getRequirePaidForScan();
      if (requirePaid) {
        const access = await checkPaidAccess(req);
        if (!access.allowed) {
          return res.status(403).json({
            error: "upgrade_required",
            message: "AI detection requires a Pro or Business plan. Upgrade now.",
            redirect: "/pricing",
            reason: access.reason,
          });
        }
      }

      const result = await detectAiContentFull(text);
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("[Humanizer Detect] Error:", error);
      res.status(500).json({ error: error.message || "Failed to detect AI content" });
    }
  });

  // ── Citations Analyzer ──────────────────────────────────────────────────────
  app.post("/api/citations/analyze", async (req, res) => {
    try {
      const { text, style } = req.body;
      if (!text?.trim()) return res.status(400).json({ error: "Text is required" });

      // Split into paragraphs (non-empty)
      const rawParagraphs = text.split(/\n{2,}/).map((p: string) => p.trim()).filter(Boolean);
      const paragraphs = rawParagraphs.length ? rawParagraphs : [text.trim()];

      const styleHint = style && style !== "Auto-detect" ? `The document uses ${style} citation style.` : "Auto-detect the citation style.";

      const prompt = `You are an expert academic citation checker. Analyze the following document paragraphs for citations.

${styleHint}

For each paragraph, identify ALL citations (inline citations like [1], (Author, Year), Author (Year), etc.) and:
1. Determine if each citation is valid/properly formatted or fake/incorrect
2. For invalid citations: explain the issue and suggest a corrected version
3. Generate a full formatted reference for each citation

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "detectedStyle": "IEEE",
  "summary": "Brief 2-3 sentence summary of citation quality",
  "paragraphs": [
    {
      "paragraphIdx": 0,
      "hasFakeCitations": false,
      "citations": [
        {
          "raw": "the citation text as it appears",
          "style": "IEEE",
          "isValid": true,
          "correctedText": null,
          "issue": null,
          "formattedRef": "Full formatted reference string"
        }
      ]
    }
  ],
  "referenceSection": ["Full ref 1", "Full ref 2"]
}

Only include paragraphs that have citations. If a paragraph has no citations, omit it entirely.
detectedStyle must be one of: IEEE, APA, Harvard, MLA, Chicago, Vancouver, Mixed, None.

PARAGRAPHS TO ANALYZE:
${paragraphs.map((p: string, i: number) => `[Paragraph ${i}]\n${p}`).join("\n\n")}`;

      const raw = await generateContent(prompt, { responseFormat: "json", maxTokens: 8192, temperature: 0.3 });
      const parsed = JSON.parse(raw);

      // Merge back all paragraphs (including those without citations)
      const allParagraphs = paragraphs.map((p: string, i: number) => {
        const found = (parsed.paragraphs || []).find((x: any) => x.paragraphIdx === i);
        if (found) return { ...found, paragraphText: p };
        return { paragraphIdx: i, paragraphText: p, citations: [], hasFakeCitations: false };
      });

      const withCitations = allParagraphs.filter((p: any) => p.citations.length > 0);
      const totalCitations = withCitations.reduce((acc: number, p: any) => acc + p.citations.length, 0);
      const validCount = withCitations.reduce((acc: number, p: any) => acc + p.citations.filter((c: any) => c.isValid).length, 0);
      const fakeCount = totalCitations - validCount;

      res.json({
        success: true,
        paragraphs: allParagraphs,
        referenceSection: parsed.referenceSection || [],
        totalCitations,
        validCount,
        fakeCount,
        detectedStyle: parsed.detectedStyle || "None",
        summary: parsed.summary || "Analysis complete.",
      });
    } catch (error: any) {
      console.error("[Citations Analyze] Error:", error);
      res.status(500).json({ error: error.message || "Failed to analyze citations" });
    }
  });

  // ── Admin Config Routes ─────────────────────────────────────────────────────
  // All API keys exposed to admin, grouped by service
  const MANAGED_KEYS = [
    // ── AI Services ──
    { key: "GEMINI_API_KEY_1",              label: "Gemini Key 1",               group: "AI Services" },
    { key: "GEMINI_API_KEY_2",              label: "Gemini Key 2",               group: "AI Services" },
    { key: "GEMINI_API_KEY_3",              label: "Gemini Key 3",               group: "AI Services" },
    { key: "GEMINI_API_KEY_4",              label: "Gemini Key 4",               group: "AI Services" },
    { key: "GEMINI_API_KEY",                label: "Gemini Key (Legacy)",        group: "AI Services" },
    { key: "GPTZERO_API_KEY",               label: "GPTZero Detection Key",      group: "AI Services" },
    { key: "DEEPSEEK_API_KEY",              label: "DeepSeek API Key",           group: "AI Services" },
    { key: "HUMANIZE_API_KEY",              label: "HumanizeAI Pro Key",         group: "AI Services" },
    // ── Voice & Images ──
    { key: "AZURE_TTS_KEY",                 label: "Azure TTS Key 1",            group: "Voice & Images" },
    { key: "AZURE_TTS_KEY_2",               label: "Azure TTS Key 2",            group: "Voice & Images" },
    { key: "AZURE_TTS_REGION",              label: "Azure TTS Region",           group: "Voice & Images" },
    { key: "ELEVENLABS_API_KEY",            label: "ElevenLabs API Key",         group: "Voice & Images" },
    { key: "VOICERSS_API_KEY",              label: "VoiceRSS API Key",           group: "Voice & Images" },
    { key: "PIXABAY_API_KEY",               label: "Pixabay API Key",            group: "Voice & Images" },
    // ── Buy Me a Coffee ──
    { key: "BMC_USERNAME",                  label: "BMC Username",               group: "Buy Me a Coffee" },
    { key: "BMC_WEBHOOK_SECRET",            label: "Webhook Secret",             group: "Buy Me a Coffee" },
    // ── Firebase ──
    { key: "VITE_FIREBASE_API_KEY",         label: "Firebase API Key",           group: "Firebase" },
    { key: "FIREBASE_PROJECT_ID",           label: "Project ID",                 group: "Firebase" },
    { key: "VITE_FIREBASE_APP_ID",          label: "App ID",                     group: "Firebase" },
    { key: "FIREBASE_SERVICE_ACCOUNT_KEY",  label: "Service Account JSON",       group: "Firebase" },
    // ── Other ──
    { key: "VITE_FORMSPREE_ENDPOINT",       label: "Formspree Endpoint",         group: "Other" },
  ];

  async function isAdminRequest(req: Request): Promise<boolean> {
    try {
      const authHeader = req.headers["authorization"] as string;
      if (!authHeader?.startsWith("Bearer ")) return false;
      const idToken = authHeader.slice(7);
      const { getApps, getApp } = await import("firebase-admin/app");
      const { getAuth } = await import("firebase-admin/auth");
      const apps = getApps();
      if (apps.length === 0) return false;
      const decoded = await getAuth(getApp()).verifyIdToken(idToken);
      const email = (decoded.email || "").toLowerCase();
      return ADMIN_EMAILS_SERVER.includes(email);
    } catch {
      return false;
    }
  }

  function maskValue(val: string | undefined): string {
    if (!val) return "";
    if (val.length <= 8) return "••••••••";
    return val.slice(0, 4) + "••••••••" + val.slice(-4);
  }

  app.get("/api/admin/config", async (req, res) => {
    if (!await isAdminRequest(req)) return res.status(403).json({ error: "Forbidden" });
    const entries = MANAGED_KEYS.map(({ key, label, group }) => ({
      key,
      label,
      group,
      masked: maskValue(process.env[key]),
      hasValue: !!process.env[key],
    }));
    res.json({ success: true, entries });
  });

  app.post("/api/admin/config", async (req, res) => {
    if (!await isAdminRequest(req)) return res.status(403).json({ error: "Forbidden" });
    const updates: Record<string, string> = req.body.updates || {};
    const allowed = new Set(MANAGED_KEYS.map(k => k.key));
    const applied: string[] = [];
    for (const [k, v] of Object.entries(updates)) {
      if (!allowed.has(k)) continue;
      if (typeof v === "string" && v.trim()) {
        process.env[k] = v.trim();
        applied.push(k);
      }
    }
    console.log(`[Admin] Config updated: ${applied.join(", ")}`);
    res.json({ success: true, updated: applied });
  });

  const httpServer = createServer(app);

  return httpServer;
}
