// SEO + social previews for a single-page app.
// Social crawlers (WhatsApp, Facebook, LinkedIn, X) and many search bots do not run JavaScript, so each public
// route gets its own copy of index.html with the right <title>, description, canonical URL, Open Graph / Twitter
// tags and JSON-LD. Cloudflare Pages serves /ai-check from ai-check.html (no redirect), so links stay clean.
// Also writes sitemap.xml and robots.txt. Run after `vite build`:  node scripts/seo-prerender.mjs
import fs from "node:fs";
import path from "node:path";

const SITE = "https://www.academicgen.com";
const OUT = path.resolve("dist/public");
const today = new Date().toISOString().slice(0, 10);
const IMG = (name) => `${SITE}/og/${name}.jpg`;

// title <= 60 chars, description <= 160 chars. No em dashes.
const PAGES = [
  { route: "/", title: "AcademicGen | AI Academic Writing Assistant for Students", desc: "Draft structured technical reports, theses and IEEE papers, check grammar, format references and build slides with speaker notes. Free to start.", img: "home", priority: "1.0" },
  { route: "/ai-check", title: "Free AI Check: See How AI-Like Your Text Reads | AcademicGen", desc: "Paste or upload your text and see an AI-likeness score with every flagged sentence highlighted, before you hand it in.", img: "ai_check", priority: "0.9" },
  { route: "/humanize", title: "AI Humanizer for Academic Writing | AcademicGen", desc: "Rewrite AI-assisted drafts in a natural academic style, then let AI review the meaning, numbers and citations before you submit.", img: "humanize", priority: "0.9" },
  { route: "/rewrite-verify", title: "Rewrite & Verify: Rewrite, Fact Check and Report | AcademicGen", desc: "Premium rewrite with a fact guard for numbers and citations, AI-likeness checks and a final plagiarism report. First document R29.", img: "rewrite_verify", priority: "0.9" },
  { route: "/pricing", title: "Pricing: Start Free, Plans from R19 a Day | AcademicGen", desc: "Day Pass R19, Weekly R49, Monthly R149, Yearly R1,499. Pay with card, Instant EFT or SnapScan through Payfast.", img: "pricing", priority: "0.8" },
  { route: "/generate/report", title: "Technical Report Generator | AcademicGen", desc: "Generate a fully structured technical report with sections, tables, figures and references, ready to edit and export to Word or PDF.", img: "home", priority: "0.9" },
  { route: "/generate/conference", title: "IEEE Conference Paper Generator | AcademicGen", desc: "Two-column IEEE structure with abstract, keywords and numbered references. Draft your conference paper in minutes.", img: "home", priority: "0.9" },
  { route: "/generate/thesis", title: "Thesis Generator: Chapters, Methodology, References | AcademicGen", desc: "Plan and draft your thesis chapter by chapter with methodology, results structure and Harvard references.", img: "home", priority: "0.9" },
  { route: "/generate/powerpoint", title: "PowerPoint Generator with Speaker Notes | AcademicGen", desc: "Build presentation slides with images and speaker notes, then export to PowerPoint in one click.", img: "home", priority: "0.8" },
  { route: "/generate/custom-report", title: "Custom Report Generator | AcademicGen", desc: "Design your own report sections and let AcademicGen draft each one for you, ready to edit and export.", img: "home", priority: "0.7" },
  { route: "/generate/template-report", title: "Report from Your Template | AcademicGen", desc: "Upload your university or company template and generate a report that follows its structure.", img: "home", priority: "0.7" },
  { route: "/generate/images", title: "AI Image Generator for Reports and Slides | AcademicGen", desc: "Create illustrations for your reports and presentations from a simple text description.", img: "home", priority: "0.6" },
  { route: "/citations", title: "Citation Checker: Find Fake or Wrong References | AcademicGen", desc: "Check citations in IEEE, APA, Harvard or MLA, spot made-up references and get corrected entries.", img: "home", priority: "0.8" },
  { route: "/grammar-check", title: "Grammar and Style Checker for Academic Writing | AcademicGen", desc: "Fix grammar, spelling and style in your report or thesis with clear suggestions you can accept one by one.", img: "home", priority: "0.7" },
  { route: "/references", title: "Reference Library: DOI, URL and BibTeX | AcademicGen", desc: "Save sources from a DOI or link, format them in any style and export BibTeX or RIS.", img: "home", priority: "0.6" },
  { route: "/templates", title: "Academic Document Templates | AcademicGen", desc: "Start from templates for technical reports, IEEE papers, theses and presentations.", img: "home", priority: "0.6" },
  { route: "/ai-assistant", title: "AI Writing Assistant Chat | AcademicGen", desc: "Ask questions about academic writing, structure, references and presentations, and listen to answers read aloud.", img: "home", priority: "0.6" },
  { route: "/tutorials", title: "Video Tutorials: AI Check, Humanizer, Rewrite & Verify | AcademicGen", desc: "Watch short video tutorials of AcademicGen tools recorded on real text: AI Check, the AI Humanizer with Review with AI, and Rewrite & Verify.", img: "home", priority: "0.7" },
  { route: "/about", title: "About AcademicGen | Built in Cape Town by HNK IoT Solutions", desc: "AcademicGen is an AI academic writing assistant built in Cape Town by HNK IoT Solutions (Pty) Ltd.", img: "home", priority: "0.5" },
  { route: "/contact", title: "Contact AcademicGen | Support and WhatsApp", desc: "Questions about AcademicGen? Email support@hnkiot.com or WhatsApp +27 61 471 9400.", img: "home", priority: "0.5" },
  { route: "/legal", title: "Terms and Privacy | AcademicGen", desc: "Terms of use, privacy policy and fair use for AcademicGen by HNK IoT Solutions (Pty) Ltd.", img: "home", priority: "0.3" },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const org = { "@type": "Organization", "@id": `${SITE}/#org`, name: "HNK IoT Solutions (Pty) Ltd", alternateName: "HNK IoT Solutions", url: "https://hnkiot.com", logo: `${SITE}/icons/icon-512x512.png`, email: "support@hnkiot.com", telephone: "+27614719400", address: { "@type": "PostalAddress", addressLocality: "Cape Town", addressCountry: "ZA" } };

function jsonLd(p) {
  const url = SITE + (p.route === "/" ? "/" : p.route);
  const graph = [
    org,
    { "@type": "WebSite", "@id": `${SITE}/#website`, name: "AcademicGen", url: `${SITE}/`, publisher: { "@id": `${SITE}/#org` } },
    { "@type": "WebPage", "@id": `${url}#page`, url, name: p.title, description: p.desc, isPartOf: { "@id": `${SITE}/#website` }, primaryImageOfPage: IMG(p.img), inLanguage: "en" },
  ];
  if (p.route === "/" || p.route === "/pricing") {
    graph.push({
      "@type": "SoftwareApplication", name: "AcademicGen", url: `${SITE}/`, applicationCategory: "EducationalApplication", operatingSystem: "Web",
      description: "AI academic writing assistant: technical reports, theses, IEEE papers, slides, references, grammar check, AI check and rewriting.",
      publisher: { "@id": `${SITE}/#org` },
      offers: [
        { "@type": "Offer", name: "Free", price: "0", priceCurrency: "ZAR" },
        { "@type": "Offer", name: "Day Pass", price: "19", priceCurrency: "ZAR" },
        { "@type": "Offer", name: "Weekly", price: "49", priceCurrency: "ZAR" },
        { "@type": "Offer", name: "Monthly", price: "149", priceCurrency: "ZAR" },
        { "@type": "Offer", name: "Yearly", price: "1499", priceCurrency: "ZAR" },
      ],
    });
  }
  if (p.route !== "/") {
    graph.push({ "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: p.title.split(" | ")[0], item: url },
    ] });
  }
  return `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": graph })}</script>`;
}

function headFor(p) {
  const url = SITE + (p.route === "/" ? "/" : p.route);
  return [
    `<title>${esc(p.title)}</title>`,
    `<meta name="description" content="${esc(p.desc)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="AcademicGen" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${esc(p.title)}" />`,
    `<meta property="og:description" content="${esc(p.desc)}" />`,
    `<meta property="og:image" content="${IMG(p.img)}" />`,
    `<meta property="og:image:secure_url" content="${IMG(p.img)}" />`,
    `<meta property="og:image:type" content="image/jpeg" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(p.title)}" />`,
    `<meta property="og:locale" content="en_ZA" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:site" content="@HnkIotSolutions" />`,
    `<meta name="twitter:title" content="${esc(p.title)}" />`,
    `<meta name="twitter:description" content="${esc(p.desc)}" />`,
    `<meta name="twitter:image" content="${IMG(p.img)}" />`,
    `<meta name="twitter:image:alt" content="${esc(p.title)}" />`,
    jsonLd(p),
  ].join("\n    ");
}

const base = fs.readFileSync(path.join(OUT, "index.html"), "utf8");
// Remove the generic tags from the template; the per-page block replaces them.
const stripped = base
  .replace(/<title>[\s\S]*?<\/title>\s*/i, "")
  .replace(/<meta\s+name="description"[^>]*>\s*/gi, "")
  .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, "")
  .replace(/<meta\s+property="og:[^"]*"[^>]*>\s*/gi, "")
  .replace(/<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi, "")
  .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/gi, "");
if (!stripped.includes("</head>")) throw new Error("index.html has no </head>");

for (const p of PAGES) {
  const html = stripped.replace("</head>", `    ${headFor(p)}\n  </head>`);
  const file = p.route === "/" ? path.join(OUT, "index.html") : path.join(OUT, p.route.slice(1) + ".html");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

fs.writeFileSync(path.join(OUT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
  PAGES.map((p) => `  <url>\n    <loc>${SITE}${p.route}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${p.priority}</priority>\n    <image:image><image:loc>${IMG(p.img)}</image:loc></image:image>\n  </url>`).join("\n") +
  `\n</urlset>\n`);

fs.writeFileSync(path.join(OUT, "robots.txt"),
  `User-agent: *\nAllow: /\nDisallow: /my-projects\nDisallow: /projects\nDisallow: /my-templates\nDisallow: /analytics\nDisallow: /settings\nDisallow: /checkout\nDisallow: /checkout-success\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`);

console.log(`SEO: ${PAGES.length} pages prerendered, sitemap.xml and robots.txt written`);
