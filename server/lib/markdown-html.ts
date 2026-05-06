/** Minimal server-side Markdown → HTML (no external deps). */
export function parseMarkdownToHtml(md: string): string {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^\|(.+)\|$/gm, (row) => {
      const cells = row.split("|").slice(1, -1).map(c => c.trim());
      return `<tr>${cells.map(c => `<td>${c}</td>`).join("")}</tr>`;
    })
    .replace(/(<tr>.*<\/tr>)/gs, (tbl) => `<table>${tbl}</table>`)
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
    .replace(/\n\n+/g, "</p><p>")
    .replace(/^(?!<[hHulptico])/gm, "<p>")
    .replace(/([^>])\n(?=[^<])/g, "$1<br/>");
}
