import pptxgen from "pptxgenjs";

export interface SlideData {
  type: "title" | "content" | "image_split" | "chart" | "quote";
  title: string;
  content?: (string | { header: string; bullets?: string[] })[];
  speakerNotes?: string;
  speaker_script?: string;
  speaker_tone?: string;
  layout_guide?: string;
  visual_prompt?: string;
  visual_type?: "figure" | "table";
  visual_caption?: string;
  imgData?: string; // Base64 or URL
}

export interface PresentationData {
  title: string;
  meta?: {
    title?: string;
    theme?: string;
    date?: string;
    author?: string;
  };
  slides: SlideData[];
}

// Helper: Convert image URL to base64 (works with CORS-friendly images)
const urlToBase64 = async (url: string): Promise<string | null> => {
  try {
    // If already base64, return as is
    if (url.startsWith('data:image/')) {
      return url;
    }

    const response = await fetch(url);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('❌ Base64 conversion error:', error);
    return null;
  }
};

export async function exportToPPTX(
  data: PresentationData,
  filename: string = "presentation.pptx",
  onProgress?: (message: string) => void
) {
  try {
    onProgress?.('Creating PowerPoint presentation...');

    const pptx = new pptxgen();

    // Set presentation properties
    pptx.layout = "LAYOUT_16x9";
    pptx.author = data.meta?.author || "Academic Document Generator";
    pptx.title = data.meta?.title || data.title;

    onProgress?.('Converting images for PowerPoint...');

    // Process each slide
    for (let index = 0; index < data.slides.length; index++) {
      const slideData = data.slides[index];
      const slide = pptx.addSlide();

      // Add white background (default)
      slide.background = { color: "FFFFFF" };

      // Handle different slide types
      if (slideData.type === "title" || index === 0) {
        // ========== TITLE SLIDE ==========
        slide.background = { color: "1E3A8A" }; // Dark blue background

        // Add background image if available
        if (slideData.imgData) {
          try {
            const imgBase64 = await urlToBase64(slideData.imgData);
            if (imgBase64) {
              slide.addImage({
                data: imgBase64,
                x: 0,
                y: 0,
                w: "100%",
                h: "100%",
                sizing: { type: "cover", w: "100%", h: "100%" },
                transparency: 35,
              });
            }
          } catch (err) {
            console.error(`Failed to embed background image in title slide ${index + 1}:`, err);
          }
        } else {
        }

        // Add semi-transparent overlay for text readability
        slide.addShape(pptx.ShapeType.rect, {
          x: 0,
          y: 0,
          w: "100%",
          h: "100%",
          fill: { color: "1E3A8A", transparency: 40 },
          line: { type: "none" },
        });

        // Title text
        slide.addText(slideData.title, {
          x: 0.5,
          y: 1.8,
          w: "90%",
          h: 1.5,
          fontSize: 44,
          bold: true,
          color: "FFFFFF",
          align: "center",
          valign: "middle",
          shadow: {
            type: "outer",
            angle: 45,
            blur: 8,
            color: "000000",
            offset: 3,
            opacity: 0.8,
          },
        });

        // Subtitle/content on title slide
        if (slideData.content && slideData.content.length > 0) {
          const subtitleText = slideData.content
            .map(item => typeof item === 'string' ? item : item.header)
            .join('\n');

          slide.addText(subtitleText, {
            x: 0.5,
            y: 3.5,
            w: "90%",
            fontSize: 18,
            color: "E0E0E0",
            align: "center",
            shadow: {
              type: "outer",
              angle: 45,
              blur: 5,
              color: "000000",
              offset: 2,
              opacity: 0.7,
            },
          });
        }
      } else {
        // ========== CONTENT SLIDES ==========

        // Header background (light gray)
        slide.addShape(pptx.ShapeType.rect, {
          x: 0,
          y: 0,
          w: "100%",
          h: 0.8,
          fill: { color: "F9FAFB" },
          line: { color: "E5E7EB", width: 1 },
        });

        // Title
        slide.addText(slideData.title, {
          x: 0.5,
          y: 0.2,
          w: "90%",
          h: 0.5,
          fontSize: 28,
          bold: true,
          color: "1E3A8A",
        });

        // Content area
        if (slideData.content && slideData.content.length > 0) {
          const hasImagePlaceholder =
            (slideData.type === "image_split" || slideData.type === "chart");
          const contentWidth = hasImagePlaceholder ? "45%" : "90%";

          // Format content - handle both string and nested bullet formats
          const contentText: any[] = [];
          slideData.content.forEach((item) => {
            if (typeof item === "string") {
              // Simple bullet point
              contentText.push({
                text: item,
                options: { bullet: true, breakLine: true },
              });
            } else if (typeof item === "object" && item.header) {
              // Nested bullet: header + sub-bullets
              contentText.push({
                text: item.header,
                options: { bold: true, bullet: true, breakLine: true },
              });
              if (item.bullets && Array.isArray(item.bullets)) {
                item.bullets.forEach((bullet) => {
                  contentText.push({
                    text: "  • " + bullet,
                    options: { breakLine: true, indentLevel: 1 },
                  });
                });
              }
            }
          });

          // Handle quote slides differently (centered, no bullets)
          if (slideData.type === "quote") {
            const quoteText = slideData.content
              .map(item => typeof item === 'string' ? item : item.header)
              .join('\n');

            slide.addText(quoteText, {
              x: 0.5,
              y: 2.5,
              w: "90%",
              h: 2,
              fontSize: 24,
              color: "374151",
              align: "center",
              valign: "middle",
              italic: true,
            });
          } else {
            // Regular content slide
            slide.addText(contentText, {
              x: 0.5,
              y: 1.2,
              w: contentWidth,
              h: 4,
              fontSize: 16,
              color: "374151",
              valign: "top",
            });
          }

          // ========== IMAGE/CHART SECTION ==========
          if (hasImagePlaceholder && slideData.type !== "quote") {
            if (slideData.imgData) {
              try {
                const imgBase64 = await urlToBase64(slideData.imgData);
                if (imgBase64) {
                  slide.addImage({
                    data: imgBase64,
                    x: "52%",
                    y: 1.2,
                    w: "45%",
                    h: 4,
                    sizing: { type: "contain", w: "45%", h: 4 },
                  });
                } else {
                  throw new Error("Base64 conversion returned null");
                }
              } catch (err) {
                console.error(`Failed to embed image in slide ${index + 1}:`, err);
                // Fallback to placeholder if image embedding fails
                slide.addText("[Image unavailable]", {
                  x: "52%",
                  y: 2.5,
                  w: "45%",
                  fontSize: 14,
                  bold: true,
                  color: "CC0000",
                  align: "center",
                });
              }

              // Add caption (top for tables, bottom for figures)
              if (slideData.visual_caption) {
                const captionY = slideData.visual_type === "table" ? 1.0 : 5.3;
                slide.addText(slideData.visual_caption, {
                  x: "52%",
                  y: captionY,
                  w: "45%",
                  fontSize: 10,
                  bold: true,
                  color: "6B7280",
                  align: "center",
                });
              }
            } else {
              // No image data - show placeholder
              slide.addShape(pptx.ShapeType.rect, {
                x: "52%",
                y: 1.2,
                w: "45%",
                h: 4,
                fill: { color: "F3F4F6" },
                line: { color: "D1D5DB", width: 2, dashType: "dash" },
              });

              slide.addText('[Click "Generate Figure" to add image]', {
                x: "52%",
                y: 2.5,
                w: "45%",
                fontSize: 12,
                bold: true,
                color: "9CA3AF",
                align: "center",
              });

              // Caption placeholder
              if (slideData.visual_caption) {
                const captionY = slideData.visual_type === "table" ? 1.0 : 5.3;
                slide.addText(slideData.visual_caption, {
                  x: "52%",
                  y: captionY,
                  w: "45%",
                  fontSize: 10,
                  bold: true,
                  color: "6B7280",
                  align: "center",
                });
              }
            }
          }
        }

        // ========== FOOTER ==========
        // Slide number (right)
        slide.addText(`${index + 1} / ${data.slides.length}`, {
          x: "85%",
          y: "92%",
          w: "12%",
          fontSize: 10,
          color: "9CA3AF",
          align: "right",
        });

        // Generated text (left)
        slide.addText("Generated Presentation", {
          x: "5%",
          y: "92%",
          w: "40%",
          fontSize: 10,
          color: "9CA3AF",
        });

        // Layout guide (if available) - optional footer info
        if (slideData.layout_guide) {
          slide.addText(`Layout: ${slideData.layout_guide}`, {
            x: "35%",
            y: "92%",
            w: "30%",
            fontSize: 8,
            color: "D1D5DB",
            align: "center",
          });
        }
      }

      // ========== SPEAKER NOTES ==========
      const speakerScript = slideData.speaker_script || slideData.speakerNotes;
      if (speakerScript) {
        const tone = slideData.speaker_tone || "Professional";
        slide.addNotes(`Speaker Notes:\n\n${speakerScript}\n\nTone: ${tone}`);
      }
    }

    // Download the file
    onProgress?.('Finalizing PowerPoint file...');
    await pptx.writeFile({ fileName: filename });
    onProgress?.('PowerPoint exported successfully!');

    return true;
  } catch (error) {
    console.error("PPTX Export Error:", error);
    throw error;
  }
}

// Legacy function for backward compatibility
export async function exportToHTML(
  data: PresentationData,
  filename: string = "presentation.html"
) {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f0f0f0;
    }
    .slide {
      background: white;
      padding: 40px;
      margin: 20px auto;
      max-width: 960px;
      min-height: 540px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      page-break-after: always;
    }
    .slide-title {
      font-size: 32px;
      font-weight: bold;
      margin-bottom: 20px;
      color: #333;
    }
    .slide-content {
      font-size: 18px;
      line-height: 1.6;
    }
    .slide-content ul {
      list-style-type: disc;
      padding-left: 30px;
    }
    .slide-content li {
      margin: 10px 0;
    }
    .speaker-notes {
      margin-top: 20px;
      padding: 15px;
      background: #f9f9f9;
      border-left: 4px solid #007bff;
      font-size: 14px;
      font-style: italic;
    }
    img {
      max-width: 100%;
      height: auto;
      display: block;
    }
    @media print {
      body { background: white; }
      .slide {
        box-shadow: none;
        page-break-inside: avoid;
      }
      img {
        max-width: 100%;
        page-break-inside: avoid;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <h1 style="text-align: center; margin-bottom: 40px;">${data.title}</h1>
`;

  data.slides.forEach((slideData, idx) => {
    const isTitle = slideData.type === 'title' || idx === 0;
    const hasImage = (slideData.type === 'image_split' || slideData.type === 'chart') && slideData.imgData;

    html += `
  <div class="slide" ${isTitle && slideData.imgData ? `style="background-image: linear-gradient(rgba(30, 58, 138, 0.3), rgba(30, 58, 138, 0.4)), url(${slideData.imgData}); background-size: cover; background-position: center; color: white; text-shadow: 0 2px 4px rgba(0,0,0,0.8);"` : ''}>
    <div class="slide-title" ${isTitle && slideData.imgData ? `style="text-shadow: 0 2px 8px rgba(0,0,0,0.9);"` : ''}>${slideData.title}</div>
    <div class="slide-content" style="display: flex; gap: 20px;">`;

    // Content section
    html += `<div style="flex: ${hasImage ? '1' : 'auto'};">`;
    if (slideData.content && slideData.content.length > 0) {
      html += `<ul>`;
      slideData.content.forEach((item) => {
        if (typeof item === "string") {
          html += `<li>${item}</li>`;
        } else if (item.header) {
          html += `<li><strong>${item.header}</strong>`;
          if (item.bullets && item.bullets.length > 0) {
            html += `<ul>`;
            item.bullets.forEach((bullet) => {
              html += `<li>${bullet}</li>`;
            });
            html += `</ul>`;
          }
          html += `</li>`;
        }
      });
      html += `</ul>`;
    }
    html += `</div>`;

    // Image section for image_split and chart slides
    if (hasImage) {
      html += `
      <div style="flex: 1;">
        <img src="${slideData.imgData}" alt="Slide Visual" style="width: 100%; height: auto; max-height: 400px; object-fit: contain; border-radius: 8px;" />
        ${slideData.visual_caption ? `<p style="text-align: center; font-size: 12px; margin-top: 8px; font-style: italic;">${slideData.visual_caption}</p>` : ''}
      </div>`;
    }

    html += `</div>`;

    const speakerScript = slideData.speaker_script || slideData.speakerNotes;
    if (speakerScript) {
      html += `
    <div class="speaker-notes">
      <strong>Speaker Notes:</strong> ${speakerScript}
      ${slideData.speaker_tone ? `<br><strong>Tone:</strong> ${slideData.speaker_tone}` : ''}
    </div>`;
    }

    html += `
  </div>`;
  });

  html += `
</body>
</html>`;

  // Create download
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportToPDF(data: PresentationData) {
  // Export to HTML for PDF printing
  exportToHTML(data, "presentation-print.html");
}
