import { Fragment } from "react";

// Generated references mark journal/book titles with markdown italics (*Title* or _Title_).
// These helpers turn that into real italics instead of showing the asterisks.

const ITALIC = /\*([^*\n]+)\*|(?<![\w])_([^_\n]+)_(?![\w])/g;
const BOLD = /\*\*([^*\n]+)\*\*/g;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Safe HTML for exports: escaped text with <em> for italic titles. */
export function refHtml(ref: string): string {
  return escapeHtml(String(ref ?? ""))
    .replace(BOLD, "$1")
    .replace(ITALIC, (_m, a, b) => `<em>${a ?? b}</em>`);
}

/** Plain text without markdown markers (clipboard, TTS). */
export function refPlain(ref: string): string {
  return String(ref ?? "").replace(BOLD, "$1").replace(ITALIC, (_m, a, b) => a ?? b);
}

/** React rendering for previews. */
export function RefText({ text }: { text: string }) {
  const s = String(text ?? "").replace(BOLD, "$1");
  const out: (string | JSX.Element)[] = [];
  let last = 0;
  for (const m of Array.from(s.matchAll(ITALIC))) {
    if (m.index! > last) out.push(s.slice(last, m.index));
    out.push(<em key={m.index}>{m[1] ?? m[2]}</em>);
    last = m.index! + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return <Fragment>{out}</Fragment>;
}
