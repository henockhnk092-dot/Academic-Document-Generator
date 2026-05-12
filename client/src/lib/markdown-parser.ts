export function parseMarkdownToHtml(markdown: string): string {
  if (!markdown) return "";
  
  let html = markdown;
  
  html = html
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\')
    .replace(/\\\$/g, '$')
    .replace(/\\#/g, '#')
    .replace(/\\\*/g, '*')
    .replace(/\\_/g, '_')
    .replace(/\\`/g, '`');

  const lines = html.split('\n');
  const processedLines: string[] = [];
  let inTable = false;
  let tableRows: string[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLang = '';
  let inList = false;
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' = 'ul';

  const processInlineFormatting = (text: string): string => {
    let result = text;
    result = result.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
    result = result.replace(/__(.+?)__/g, '<strong>$1</strong>');
    result = result.replace(/_(.+?)_/g, '<em>$1</em>');
    result = result.replace(/`([^`]+)`/g, '<code class="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 px-1 py-0.5 rounded text-sm font-mono">$1</code>');
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline">$1</a>');
    return result;
  };

  const flushList = () => {
    if (listItems.length > 0) {
      const tag = listType === 'ol' ? 'ol' : 'ul';
      const listClass = listType === 'ol' ? 'list-decimal' : 'list-disc';
      processedLines.push(`<${tag} class="${listClass} pl-6 space-y-1 my-3">`);
      listItems.forEach(item => {
        processedLines.push(`<li>${processInlineFormatting(item)}</li>`);
      });
      processedLines.push(`</${tag}>`);
      listItems = [];
      inList = false;
    }
  };

  const flushTable = () => {
    if (tableRows.length > 0) {
      processedLines.push('<div class="overflow-x-auto my-4">');
      processedLines.push('<table class="min-w-full border-collapse border border-border">');

      // Filter out separator rows before processing
      const validRows = tableRows.filter(row => {
        const cells = row.split('|').filter(cell => cell.trim() !== '');
        // Skip rows where all cells are just dashes, colons, and spaces (separator rows)
        return cells.length > 0 && !cells.every(cell => /^[\s\-:]+$/.test(cell));
      });

      validRows.forEach((row, rowIndex) => {
        const cells = row.split('|').filter(cell => cell.trim() !== '');
        if (cells.length === 0) return;

        const isHeader = rowIndex === 0;
        const tag = isHeader ? 'th' : 'td';
        const cellClass = isHeader
          ? 'border border-border px-3 py-2 bg-muted font-semibold text-left'
          : 'border border-border px-3 py-2';

        processedLines.push('<tr>');
        cells.forEach(cell => {
          processedLines.push(`<${tag} class="${cellClass}">${processInlineFormatting(cell.trim())}</${tag}>`);
        });
        processedLines.push('</tr>');
      });

      processedLines.push('</table>');
      processedLines.push('</div>');
      tableRows = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('```')) {
      if (!inCodeBlock) {
        flushList();
        flushTable();
        inCodeBlock = true;
        codeBlockLang = trimmedLine.slice(3).trim();
        codeBlockContent = [];
      } else {
        processedLines.push(`<pre class="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 p-4 rounded-lg overflow-x-auto my-4 border"><code class="text-sm font-mono">${codeBlockContent.join('\n').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`);
        inCodeBlock = false;
        codeBlockContent = [];
        codeBlockLang = '';
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Check if it's a table separator line (e.g., |---|---|, |-----|, etc.)
    const isTableSeparator = trimmedLine.includes('|') && /^\|?[\s\-:|]+\|?$/.test(trimmedLine);

    if (trimmedLine.includes('|') && !isTableSeparator) {
      flushList();
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      tableRows.push(trimmedLine);
      continue;
    } else if (isTableSeparator && inTable) {
      // Skip table separator lines
      continue;
    } else if (inTable && !trimmedLine.includes('|')) {
      flushTable();
    }

    if (/^(\d+)\.\s/.test(trimmedLine)) {
      if (!inList || listType !== 'ol') {
        flushList();
        flushTable();
        inList = true;
        listType = 'ol';
      }
      listItems.push(trimmedLine.replace(/^\d+\.\s*/, ''));
      continue;
    }

    if (/^[-*+]\s/.test(trimmedLine)) {
      if (!inList || listType !== 'ul') {
        flushList();
        flushTable();
        inList = true;
        listType = 'ul';
      }
      listItems.push(trimmedLine.replace(/^[-*+]\s*/, ''));
      continue;
    }

    if (inList && trimmedLine !== '') {
      flushList();
    }

    if (trimmedLine.startsWith('#### ')) {
      flushList();
      flushTable();
      processedLines.push(`<h4 class="text-base font-semibold mt-4 mb-2">${processInlineFormatting(trimmedLine.slice(5))}</h4>`);
    } else if (trimmedLine.startsWith('### ')) {
      flushList();
      flushTable();
      processedLines.push(`<h3 class="text-lg font-semibold mt-5 mb-3">${processInlineFormatting(trimmedLine.slice(4))}</h3>`);
    } else if (trimmedLine.startsWith('## ')) {
      flushList();
      flushTable();
      processedLines.push(`<h2 class="text-xl font-bold mt-6 mb-3 border-b pb-2">${processInlineFormatting(trimmedLine.slice(3))}</h2>`);
    } else if (trimmedLine.startsWith('# ')) {
      flushList();
      flushTable();
      processedLines.push(`<h1 class="text-2xl font-bold mt-6 mb-4">${processInlineFormatting(trimmedLine.slice(2))}</h1>`);
    } else if (trimmedLine.startsWith('> ')) {
      flushList();
      flushTable();
      processedLines.push(`<blockquote class="border-l-4 border-primary pl-4 italic my-4 text-muted-foreground">${processInlineFormatting(trimmedLine.slice(2))}</blockquote>`);
    } else if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmedLine) && !inTable) {
      flushList();
      flushTable();
      processedLines.push('<hr class="my-6 border-border" />');
    } else if (trimmedLine === '') {
      if (!inList && !inTable) {
        processedLines.push('<br />');
      }
    } else {
      flushList();
      flushTable();
      processedLines.push(`<p class="my-2 leading-relaxed">${processInlineFormatting(trimmedLine)}</p>`);
    }
  }

  flushList();
  flushTable();

  if (inCodeBlock) {
    processedLines.push(`<pre class="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 p-4 rounded-lg overflow-x-auto my-4 border"><code class="text-sm font-mono">${codeBlockContent.join('\n').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`);
  }

  return processedLines.join('\n');
}

export function sanitizeHtml(html: string): string {
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  return sanitized;
}
