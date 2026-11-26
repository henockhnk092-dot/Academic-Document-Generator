// Readable page content for crawlers, placed inside <div id="root"> of each prerendered page.
// React (createRoot) replaces it as soon as the app starts, so visitors never see it twice.
// Search Console flagged pages as "Soft 404" (Nov 2026) because the HTML body was empty before JavaScript ran.
// Keep it true to what each tool does. No em dashes, no personal details.
export const CONTENT = {
  "/": { h1: "AI academic writing assistant for students", points: [
    "Generate technical reports, IEEE conference papers, theses and PowerPoint slides from one topic.",
    "Check grammar and style, find fake or wrongly formatted citations, and build a reference list.",
    "See how AI-like a text reads with AI Check, and rewrite drafts with the AI Humanizer or Rewrite & Verify.",
    "Export to Word, PDF or PowerPoint. Start free; plans from R19 a day.",
  ] },
  "/ai-check": { h1: "Free AI Check", points: [
    "Paste text or upload a Word or PDF file.",
    "Get an AI-likeness score with every flagged sentence highlighted.",
    "Copy or export the result, then improve the flagged parts in your own words.",
    "Detector scores are estimates, not proof. Follow your university's rules on AI use.",
  ] },
  "/humanize": { h1: "AI Humanizer for academic writing", points: [
    "Rewrite an AI-assisted draft in a natural academic tone, or choose casual or professional.",
    "Compare the rewrite with your original and read the report.",
    "Review with AI checks that facts, numbers and citations did not change.",
    "Premium rounds rewrite in several passes, checked by independent detectors.",
  ] },
  "/rewrite-verify": { h1: "Rewrite & Verify", points: [
    "Upload a Word file; the layout, figures and tables are kept.",
    "Every passage is rewritten and its numbers and citations are compared with your original.",
    "A meaning check puts back anything that changed what you wrote.",
    "Ends with an independent AI-likeness and plagiarism report.",
  ] },
  "/pricing": { h1: "AcademicGen pricing", points: [
    "Free plan to start, no card needed.",
    "Day Pass R19, Weekly R49, Monthly R149, Yearly R1,499.",
    "Credit packs for Premium tools such as Rewrite & Verify.",
  ] },
  "/generate/report": { h1: "Technical report generator", points: [
    "Enter a topic and choose the number of pages.",
    "Get a structured report with sections, tables, figures and references.",
    "Edit every section, then export to Word or PDF.",
  ] },
  "/generate/conference": { h1: "IEEE conference paper generator", points: [
    "Two-column IEEE structure with title, abstract and keywords.",
    "Numbered IEEE references and section headings.",
    "Edit the draft and export it to Word or PDF.",
  ] },
  "/generate/thesis": { h1: "Thesis generator", points: [
    "Plan every chapter, from the introduction to the conclusion.",
    "Methodology and results structure with Harvard references.",
    "Draft chapter by chapter and export to Word.",
  ] },
  "/generate/powerpoint": { h1: "PowerPoint generator with speaker notes", points: [
    "Enter a topic and the number of slides.",
    "Each slide gets clear bullet points, an image and speaker notes.",
    "Practise with the notes read aloud, then export to PowerPoint (.pptx) or PDF.",
    "Edit any slide before you download.",
  ] },
  "/generate/custom-report": { h1: "Custom report generator", points: [
    "Name your own sections and set the order.",
    "AcademicGen drafts each section for you.",
    "Edit the result and export it to Word or PDF.",
    "Save your structure as a template to reuse later.",
  ] },
  "/generate/template-report": { h1: "Report from your template", points: [
    "Upload your university or company template.",
    "The report follows its headings and structure.",
    "Edit and export to Word.",
  ] },
  "/generate/images": { h1: "AI image generator for reports and slides", points: [
    "Describe the illustration you need.",
    "Download it as PNG, JPEG or WEBP for your report or presentation.",
  ] },
  "/citations": { h1: "Citation Checker", points: [
    "Paste your text or upload your document; IEEE, APA, Harvard, MLA and more.",
    "Each citation is checked, with the problem and a suggested correction.",
    "Made-up or impossible sources are flagged.",
    "Missing reference list? Build one from your valid citations, then check each entry against the real source.",
  ] },
  "/grammar-check": { h1: "Grammar and style checker", points: [
    "Paste text or upload a Word or PDF file.",
    "Each suggestion shows the mistake, the correction and why.",
    "Apply suggestions one by one, or all at once, then copy your corrected text.",
  ] },
  "/references": { h1: "Reference library", points: [
    "Save sources from a DOI or a link, or enter them by hand.",
    "Format them in APA, Harvard, IEEE or MLA.",
    "Export BibTeX, RIS or formatted text.",
  ] },
  "/templates": { h1: "Academic document templates", points: [
    "Ready structures for technical reports, IEEE papers, theses and presentations.",
    "Open a template, fill in your topic and generate.",
    "Save your own templates in My Templates.",
  ] },
  "/ai-assistant": { h1: "AI writing assistant", points: [
    "Ask about structure, academic style, grammar and references.",
    "Attach a Word file, PDF or image and get feedback on it.",
    "Copy answers or listen to them read aloud.",
  ] },
  "/tutorials": { h1: "Video tutorials and user guides", points: [
    "Step-by-step guides for AI Check, the AI Humanizer, the AI Assistant, Grammar Check and the Citation Checker.",
    "Short tool tutorials for every generator.",
    "A live Rewrite & Verify demo on a 5-page report.",
  ] },
  "/community": { h1: "Student community", points: [
    "Chat with other students about reports, theses, research and references.",
    "Every message is reviewed by AI.",
    "Ask @AcademicGen a study question in any channel.",
  ] },
  "/download": { h1: "Download AcademicGen", points: [
    "Android app and Windows and Linux desktop apps.",
    "Add to Home Screen on iPhone, iPad and Mac.",
    "The same account and projects on every device.",
  ] },
  "/about": { h1: "About AcademicGen", points: [
    "An AI academic writing assistant built in Cape Town by HNK IoT Solutions (Pty) Ltd.",
    "Tools to plan, draft, check and reference academic work.",
    "Use it to support your own writing and follow your university's rules on AI.",
  ] },
  "/contact": { h1: "Contact AcademicGen", points: [
    "Email: support@hnkiot.com",
    "WhatsApp: +27 61 471 9400",
    "HNK IoT Solutions (Pty) Ltd, Cape Town, South Africa.",
    "Questions about plans, payments, your account or a tool? Email or WhatsApp us.",
  ] },
  "/legal": { h1: "Terms and privacy", points: [
    "Terms of use, privacy policy and fair use for AcademicGen.",
    "HNK IoT Solutions (Pty) Ltd, Cape Town, South Africa.",
  ] },
};

const LINKS = [
  ["/generate/report", "Technical Report"], ["/generate/conference", "Conference Paper"], ["/generate/thesis", "Thesis"],
  ["/generate/powerpoint", "PowerPoint"], ["/ai-check", "AI Check"], ["/humanize", "AI Humanizer"],
  ["/rewrite-verify", "Rewrite & Verify"], ["/citations", "Citation Checker"], ["/grammar-check", "Grammar Check"],
  ["/tutorials", "Tutorials"], ["/pricing", "Pricing"], ["/contact", "Contact"],
];

export function bodyFor(p, esc) {
  const c = CONTENT[p.route];
  if (!c) return "";
  const li = c.points.map((x) => `<li>${esc(x)}</li>`).join("");
  const nav = LINKS.filter(([r]) => r !== p.route).map(([r, t]) => `<a href="${r}">${esc(t)}</a>`).join(" | ");
  return `<main style="max-width:760px;margin:40px auto;padding:0 16px;font-family:system-ui,sans-serif;line-height:1.6;color:#0B1220">` +
    `<h1>${esc(c.h1)}</h1><p>${esc(p.desc)}</p><ul>${li}</ul><nav><a href="/">AcademicGen home</a> | ${nav}</nav></main>`;
}
