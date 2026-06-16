import mammoth from "mammoth";
import { createRequire } from "node:module";
const _require = createRequire(import.meta.url);
// pdf-parse is CJS-only; use createRequire to avoid ESM default-export mismatch
const pdfParse: (buf: Buffer) => Promise<{ text: string; numpages: number }> = _require("pdf-parse");

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    const text = data.text?.trim() ?? "";
    if (!text) throw new Error("No text layer found in this PDF.");
    return text;
  } catch (error) {
    throw new Error(`Failed to extract text from PDF: ${error}`);
  }
}

export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  } catch (error) {
    console.error("DOCX extraction error:", error);
    throw new Error(`Failed to extract text from DOCX: ${error}`);
  }
}

export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (mimeType === "application/pdf") {
    return extractTextFromPDF(buffer);
  } else if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractTextFromDOCX(buffer);
  } else if (mimeType.startsWith("text/")) {
    return buffer.toString("utf-8");
  } else {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }
}
