import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer, Table, TableRow, TableCell, WidthType, convertInchesToTwip, ImageRun } from 'docx';
import { saveAs } from 'file-saver';

interface ExportOptions {
  title?: string;
  twoColumn?: boolean;
}

interface PendingImage {
  src: string;
  alt: string;
  index: number;
}

async function fetchImageAsBuffer(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch image');
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.error('Error fetching image:', error);
    return null;
  }
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function extractTextContent(html: string): string {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  return tempDiv.textContent || tempDiv.innerText || '';
}

async function parseHtmlToDocxChildren(html: string): Promise<Paragraph[]> {
  const children: Paragraph[] = [];
  const pendingImages: PendingImage[] = [];
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  const processNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text })],
            spacing: { after: 200 },
            alignment: AlignmentType.JUSTIFIED,
          })
        );
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    const tagName = element.tagName.toLowerCase();

    switch (tagName) {
      case 'h1':
        children.push(
          new Paragraph({
            text: extractTextContent(element.innerHTML),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          })
        );
        break;

      case 'h2':
        children.push(
          new Paragraph({
            text: extractTextContent(element.innerHTML),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
          })
        );
        break;

      case 'h3':
        children.push(
          new Paragraph({
            text: extractTextContent(element.innerHTML),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 100 },
          })
        );
        break;

      case 'p':
        const pText = extractTextContent(element.innerHTML);
        if (pText) {
          const textRuns: TextRun[] = [];
          const processInlineElements = (el: Element) => {
            el.childNodes.forEach((child) => {
              if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent || '';
                if (text) textRuns.push(new TextRun({ text }));
              } else if (child.nodeType === Node.ELEMENT_NODE) {
                const childEl = child as Element;
                const childTag = childEl.tagName.toLowerCase();
                const childText = extractTextContent(childEl.innerHTML);
                
                if (childTag === 'b' || childTag === 'strong') {
                  textRuns.push(new TextRun({ text: childText, bold: true }));
                } else if (childTag === 'i' || childTag === 'em') {
                  textRuns.push(new TextRun({ text: childText, italics: true }));
                } else if (childTag === 'sup') {
                  textRuns.push(new TextRun({ text: childText, superScript: true }));
                } else if (childTag === 'sub') {
                  textRuns.push(new TextRun({ text: childText, subScript: true }));
                } else {
                  textRuns.push(new TextRun({ text: childText }));
                }
              }
            });
          };
          processInlineElements(element);
          
          if (textRuns.length > 0) {
            children.push(
              new Paragraph({
                children: textRuns,
                spacing: { after: 200 },
                alignment: AlignmentType.JUSTIFIED,
              })
            );
          }
        }
        break;

      case 'ul':
      case 'ol':
        element.querySelectorAll('li').forEach((li, idx) => {
          const bullet = tagName === 'ol' ? `${idx + 1}. ` : '• ';
          children.push(
            new Paragraph({
              children: [new TextRun({ text: bullet + extractTextContent(li.innerHTML) })],
              spacing: { after: 100 },
              indent: { left: 720 },
            })
          );
        });
        break;

      case 'table':
        try {
          const rows: TableRow[] = [];
          element.querySelectorAll('tr').forEach((tr, rowIdx) => {
            const cells: TableCell[] = [];
            tr.querySelectorAll('th, td').forEach((cell) => {
              const isHeader = cell.tagName.toLowerCase() === 'th';
              cells.push(
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: extractTextContent(cell.innerHTML),
                          bold: isHeader,
                        }),
                      ],
                    }),
                  ],
                  shading: isHeader ? { fill: 'EEEEEE' } : undefined,
                })
              );
            });
            if (cells.length > 0) {
              rows.push(new TableRow({ children: cells }));
            }
          });
          if (rows.length > 0) {
            children.push(
              new Table({
                rows,
                width: { size: 100, type: WidthType.PERCENTAGE },
              }) as unknown as Paragraph
            );
            children.push(new Paragraph({ spacing: { after: 200 } }));
          }
        } catch (e) {
          console.error('Error processing table:', e);
        }
        break;

      case 'img':
        try {
          const src = element.getAttribute('src');
          const altText = element.getAttribute('alt') || 'Figure';
          if (src) {
            if (src.startsWith('data:image/')) {
              // Extract base64 data
              const base64Data = src.split(',')[1];
              const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

              children.push(
                new Paragraph({
                  children: [
                    new ImageRun({
                      type: 'png',
                      data: imageBuffer,
                      transformation: {
                        width: 600,
                        height: 400,
                      },
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 200, after: 200 },
                })
              );
            } else if (src.startsWith('http://') || src.startsWith('https://')) {
              // Mark position for external image to be fetched later
              pendingImages.push({ src, alt: altText, index: children.length });
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `[Loading image: ${altText}...]`,
                      italics: true,
                      color: "999999",
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 200, after: 200 },
                })
              );
            }
          }
        } catch (e) {
          console.error('Error processing image:', e);
        }
        break;

      case 'figure':
        // Process image inside figure
        const img = element.querySelector('img');
        if (img) {
          try {
            const src = img.getAttribute('src');
            const figAltText = img.getAttribute('alt') || 'Figure';
            if (src) {
              if (src.startsWith('data:image/')) {
                const base64Data = src.split(',')[1];
                const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

                children.push(
                  new Paragraph({
                    children: [
                      new ImageRun({
                        type: 'png',
                        data: imageBuffer,
                        transformation: {
                          width: 600,
                          height: 400,
                        },
                      }),
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 200, after: 100 },
                  })
                );
              } else if (src.startsWith('http://') || src.startsWith('https://')) {
                // Mark position for external image to be fetched later
                pendingImages.push({ src, alt: figAltText, index: children.length });
                children.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `[Loading image: ${figAltText}...]`,
                        italics: true,
                        color: "999999",
                      }),
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 200, after: 100 },
                  })
                );
              }
            }
          } catch (e) {
            console.error('Error processing figure image:', e);
          }
        }

        const figcaption = element.querySelector('figcaption');
        if (figcaption) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: extractTextContent(figcaption.innerHTML),
                  italics: true,
                  size: 20,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 100, after: 300 },
            })
          );
        }
        break;

      case 'div':
        element.childNodes.forEach(child => processNode(child));
        break;

      case 'code':
        // Handle inline code
        const codeText = extractTextContent(element.innerHTML);
        if (codeText) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: codeText,
                  font: 'Courier New',
                  shading: { fill: 'F3F4F6' },
                }),
              ],
              spacing: { after: 100 },
            })
          );
        }
        break;

      case 'pre':
        // Handle code blocks
        const preText = extractTextContent(element.innerHTML);
        if (preText) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: preText,
                  font: 'Courier New',
                  size: 18,
                }),
              ],
              spacing: { before: 200, after: 200 },
              shading: { fill: 'F3F4F6' },
              indent: { left: 360, right: 360 },
            })
          );
        }
        break;

      case 'blockquote':
        const quoteText = extractTextContent(element.innerHTML);
        if (quoteText) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: quoteText,
                  italics: true,
                }),
              ],
              spacing: { before: 200, after: 200 },
              indent: { left: 720 },
              border: {
                left: {
                  color: '3B82F6',
                  space: 1,
                  style: 'single',
                  size: 24,
                },
              },
            })
          );
        }
        break;

      case 'br':
        children.push(new Paragraph({ spacing: { after: 100 } }));
        break;

      default:
        element.childNodes.forEach(child => processNode(child));
        break;
    }
  };

  tempDiv.childNodes.forEach(node => processNode(node));

  // Fetch all pending external images and replace placeholders
  if (pendingImages.length > 0) {
    const fetchPromises = pendingImages.map(async (pending) => {
      const imageBuffer = await fetchImageAsBuffer(pending.src);
      return { ...pending, buffer: imageBuffer };
    });

    const results = await Promise.all(fetchPromises);

    for (const result of results) {
      if (result.buffer) {
        children[result.index] = new Paragraph({
          children: [
            new ImageRun({
              type: 'png',
              data: result.buffer,
              transformation: {
                width: 500,
                height: 350,
              },
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
        });
      }
    }
  }

  return children;
}

export async function exportHtmlToDocx(html: string, options: ExportOptions = {}): Promise<void> {
  const { title = 'Conference Paper' } = options;

  const docChildren = await parseHtmlToDocxChildren(html);

  if (docChildren.length === 0) {
    docChildren.push(
      new Paragraph({
        text: 'No content to export',
        alignment: AlignmentType.CENTER,
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `${title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}.docx`;
  saveAs(blob, fileName);
}

export async function exportConferencePaperToDocx(html: string): Promise<void> {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  const titleEl = tempDiv.querySelector('.title-area h1, h1');
  const title = titleEl ? extractTextContent(titleEl.innerHTML) : 'Conference Paper';

  await exportHtmlToDocx(html, { title, twoColumn: true });
}
