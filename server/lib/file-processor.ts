import mammoth from "mammoth";
import PDFParser from "pdf2json";

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const pdfParser = new PDFParser();

      pdfParser.on("pdfParser_dataError", (errData: any) => {
        console.error("PDF extraction error:", errData.parserError);
        reject(new Error(`Failed to extract text from PDF: ${errData.parserError}`));
      });

      pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
        try {
          // Extract text from all pages
          const textContent = pdfData.Pages.map((page: any) => {
            return page.Texts.map((text: any) => {
              return text.R.map((r: any) => decodeURIComponent(r.T)).join("");
            }).join(" ");
          }).join("\n\n");

          resolve(textContent.trim());
        } catch (err) {
          reject(new Error(`Failed to parse PDF content: ${err}`));
        }
      });

      pdfParser.parseBuffer(buffer);
    } catch (error) {
      console.error("PDF extraction error:", error);
      reject(new Error(`Failed to extract text from PDF: ${error}`));
    }
  });
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
