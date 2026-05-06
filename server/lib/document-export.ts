import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun } from "docx";

export interface DocumentSection {
  title: string;
  content: string;
  subsections?: DocumentSection[];
}

export interface ExportDocxOptions {
  title: string;
  author?: string;
  abstract?: string;
  sections: DocumentSection[];
  references?: string[];
}

export function createDocxDocument(options: ExportDocxOptions): Document {
  const { title, author = "AI Generated", abstract, sections, references } = options;

  const children: any[] = [];

  children.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  if (author) {
    children.push(
      new Paragraph({
        text: author,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      })
    );
  }

  if (abstract) {
    children.push(
      new Paragraph({
        text: "Abstract",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );
    children.push(
      new Paragraph({
        text: abstract,
        spacing: { after: 400 },
      })
    );
  }

  sections.forEach((section, index) => {
    children.push(
      new Paragraph({
        text: section.title,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        numbering: {
          reference: "default-numbering",
          level: 0,
        },
      })
    );

    const contentParagraphs = section.content.split("\n\n");
    contentParagraphs.forEach((para) => {
      if (para.trim()) {
        children.push(
          new Paragraph({
            text: para.trim(),
            spacing: { after: 200 },
          })
        );
      }
    });

    if (section.subsections) {
      section.subsections.forEach((subsection) => {
        children.push(
          new Paragraph({
            text: subsection.title,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          })
        );
        
        const subContentParagraphs = subsection.content.split("\n\n");
        subContentParagraphs.forEach((para) => {
          if (para.trim()) {
            children.push(
              new Paragraph({
                text: para.trim(),
                spacing: { after: 200 },
              })
            );
          }
        });
      });
    }
  });

  if (references && references.length > 0) {
    children.push(
      new Paragraph({
        text: "References",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );
    
    references.forEach((ref, idx) => {
      children.push(
        new Paragraph({
          text: `[${idx + 1}] ${ref}`,
          spacing: { after: 100 },
        })
      );
    });
  }

  return new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });
}

export async function exportToDocxBuffer(options: ExportDocxOptions): Promise<Buffer> {
  const doc = createDocxDocument(options);
  return await Packer.toBuffer(doc);
}

// Note: PptxGenJS is loaded from CDN in the browser
// This is a placeholder for the server-side export logic
export interface SlideData {
  type: "title" | "content" | "image" | "quote";
  title: string;
  content?: string[];
  speakerNotes?: string;
  imageUrl?: string;
}

export interface ExportPptxOptions {
  title: string;
  slides: SlideData[];
}

// This function will be implemented client-side with PptxGenJS from CDN
export function createPptxPresentation(options: ExportPptxOptions): any {
  return options;
}
