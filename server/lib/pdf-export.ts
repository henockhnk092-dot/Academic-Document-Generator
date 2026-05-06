import puppeteer from "puppeteer-core";
import { parseMarkdownToHtml } from "./markdown-html";

function buildReportHtml(content: any, imageUrls: Record<string, string> = {}): string {
  const sections = (content.sections ?? [])
    .map((s: any, i: number) => {
      const heading = s.heading ?? s.title ?? "";
      const body = parseMarkdownToHtml(s.content ?? "");
      const img = imageUrls[i]
        ? `<figure><img src="${imageUrls[i]}" alt="${s.image_caption ?? ""}" />${s.image_caption ? `<figcaption>${s.image_caption}</figcaption>` : ""}</figure>`
        : "";
      return `<section><h2>${heading}</h2>${body}${img}</section>`;
    })
    .join("");

  const abstract = content.abstract
    ? `<div class="abstract"><h2>Abstract</h2><p>${content.abstract}</p></div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  body { font-family: "Times New Roman", serif; margin: 0; padding: 40px; line-height: 1.7; color: #111; font-size: 12pt; }
  h1 { text-align: center; font-size: 20pt; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 24px; }
  h2 { font-size: 14pt; color: #1e3a8a; text-transform: uppercase; border-bottom: 1px solid #93c5fd; padding-bottom: 4px; margin-top: 32px; }
  h3 { font-size: 12pt; color: #1e40af; margin-top: 20px; }
  .abstract { background: #f3f4f6; border-left: 4px solid #1e3a8a; padding: 16px 20px; margin: 20px 0; border-radius: 4px; }
  .abstract h2 { margin-top: 0; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 11pt; }
  th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; }
  th { background: #e8edf5; font-weight: bold; }
  figure { text-align: center; margin: 20px 0; page-break-inside: avoid; }
  figure img { max-width: 80%; max-height: 300px; border: 1px solid #ddd; padding: 4px; }
  figcaption { font-size: 10pt; font-style: italic; margin-top: 8px; }
  code { background: #f3f4f6; padding: 2px 5px; border-radius: 3px; font-family: "Courier New", monospace; font-size: 10pt; }
  pre { background: #f3f4f6; padding: 14px; border-radius: 4px; overflow-x: auto; font-size: 10pt; }
  ul, ol { padding-left: 24px; }
  p { margin: 8px 0 12px; }
  section { page-break-inside: avoid; }
  @page { margin: 1in; }
</style>
</head>
<body>
  <h1>${content.title ?? "Technical Report"}</h1>
  ${abstract}
  ${sections}
</body>
</html>`;
}

function buildThesisHtml(content: any, imageUrls: Record<string, string> = {}): string {
  return buildReportHtml(content, imageUrls); // same structure
}

function buildPresentationHtml(content: any): string {
  const slides = (content.slides ?? [])
    .map((s: any, i: number) => {
      const bullets = Array.isArray(s.content)
        ? `<ul>${s.content.map((b: string) => `<li>${b}</li>`).join("")}</ul>`
        : `<p>${s.content ?? ""}</p>`;
      return `<div class="slide"><span class="slide-num">${i + 1}</span><h2>${s.title ?? ""}</h2>${bullets}${s.speakerNotes ? `<div class="notes"><strong>Notes:</strong> ${s.speakerNotes}</div>` : ""}</div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 30px; color: #111; }
  h1 { text-align: center; font-size: 22pt; margin-bottom: 30px; }
  .slide { border: 1px solid #ddd; border-radius: 8px; padding: 24px 30px; margin-bottom: 24px; page-break-inside: avoid; position: relative; }
  .slide-num { position: absolute; top: 12px; right: 16px; font-size: 9pt; color: #888; }
  .slide h2 { font-size: 16pt; color: #1e3a8a; margin-top: 0; border-bottom: 1px solid #93c5fd; padding-bottom: 6px; }
  .slide ul { padding-left: 20px; font-size: 12pt; line-height: 1.8; }
  .notes { margin-top: 16px; background: #fffbea; border-left: 3px solid #f59e0b; padding: 10px 14px; font-size: 10pt; color: #555; border-radius: 3px; }
  @page { margin: 0.75in; }
</style>
</head>
<body>
  <h1>${content.title ?? "Presentation"}</h1>
  ${slides}
</body>
</html>`;
}

export async function generatePdf(
  content: any,
  imageUrls: Record<string, string> = {},
  type: "report" | "thesis" | "powerpoint" | "conference" = "report"
): Promise<Buffer> {
  let html: string;
  if (type === "powerpoint") {
    html = buildPresentationHtml(content);
  } else if (type === "conference") {
    // Conference paper is already HTML
    html = typeof content === "string" ? content : content.html ?? buildReportHtml(content, imageUrls);
  } else {
    html = buildReportHtml(content, imageUrls);
  }

  // Try to find a system Chrome/Chromium installation
  const executablePaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ].filter(Boolean) as string[];

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  for (const executablePath of executablePaths) {
    try {
      browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
      });
      break;
    } catch {
      // try next path
    }
  }

  if (!browser) {
    throw new Error("Chrome/Chromium not found. Please install Google Chrome.");
  }

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "1in", bottom: "1in", left: "1in", right: "1in" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
