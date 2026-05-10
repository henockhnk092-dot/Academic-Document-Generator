import { useRef } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { motion, useInView } from "framer-motion";
import {
  FileText, FileSignature, Presentation, BookOpen, GraduationCap,
  Image, Library, Wand2, BookMarked, PenLine, BrainCircuit, Download,
  ArrowRight, Sparkles, FolderOpen, BarChart2, FileImage, LayoutTemplate,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── animation variants ───────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const cardVariant = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

// ─── data ─────────────────────────────────────────────────────────────────────
const tools = [
  {
    id: "report", title: "Technical Report",
    description: "Generate structured, data-driven reports with executive summaries, methodology sections, and precise conclusions.",
    icon: FileText, exports: "PDF, DOCX", action: "Generate",
    iconBg: "bg-primary/10", iconColor: "text-primary",
    href: "/generate/report",
  },
  {
    id: "custom-report", title: "Custom Report",
    description: "Flexible document generation tailored to your specific academic discipline's rubrics and standards.",
    icon: FileSignature, exports: "DOCX, TXT", action: "Generate",
    iconBg: "bg-chart-4/10", iconColor: "text-chart-4",
    href: "/generate/custom-report",
  },
  {
    id: "template-report", title: "Template Report",
    description: "Upload your own document template and generate a report that follows your exact structure and guidelines.",
    icon: LayoutTemplate, exports: "DOCX, TXT", action: "Generate",
    iconBg: "bg-chart-2/10", iconColor: "text-chart-2",
    href: "/generate/template-report",
  },
  {
    id: "powerpoint", title: "PowerPoint",
    description: "Transform long-form research into compelling, structured slide decks with automated speaker notes.",
    icon: Presentation, exports: "PPTX, PDF", action: "Generate",
    iconBg: "bg-chart-3/10", iconColor: "text-chart-3",
    href: "/generate/powerpoint",
  },
  {
    id: "conference", title: "Conference Paper",
    description: "Format your findings to match stringent double-blind peer review formatting guidelines.",
    icon: BookOpen, exports: "LaTeX, DOCX", action: "Generate",
    iconBg: "bg-chart-5/10", iconColor: "text-chart-5",
    href: "/generate/conference",
  },
  {
    id: "thesis", title: "Thesis Draft",
    description: "Outline and generate comprehensive chapters, ensuring logical flow and sustained argumentation.",
    icon: GraduationCap, exports: "DOCX, PDF", action: "Generate",
    iconBg: "bg-chart-2/10", iconColor: "text-chart-2",
    href: "/generate/thesis",
  },
  {
    id: "images", title: "AI Image Generator",
    description: "Create accurate, academic-style diagrams, charts, and conceptual illustrations for your text.",
    icon: Image, exports: "PNG, SVG", action: "Generate",
    iconBg: "bg-chart-4/10", iconColor: "text-chart-4",
    href: "/generate/images",
  },
  {
    id: "references", title: "Reference Library",
    description: "Curate, summarize, and extract key quotes from thousands of imported PDFs automatically.",
    icon: Library, exports: "BibTeX, RIS", action: "Organize",
    iconBg: "bg-primary/10", iconColor: "text-primary",
    href: "/references",
  },
  {
    id: "humanize", title: "AI Humanizer",
    description: "Refine AI-generated text to ensure an authentic scholarly tone that bypasses generic detection.",
    icon: Wand2, exports: "Text Editor", action: "Refine",
    iconBg: "bg-chart-5/10", iconColor: "text-chart-5",
    href: "/humanize",
  },
  {
    id: "citations", title: "Citation Checker",
    description: "Verify every claim against your library to prevent hallucinations and ensure academic integrity.",
    icon: BookMarked, exports: "Report", action: "Check",
    iconBg: "bg-chart-2/10", iconColor: "text-chart-2",
    href: "/citations",
  },
];

const steps = [
  { icon: PenLine,      num: "1", title: "Enter Topic",   desc: "Provide your thesis statement, key variables, and select your desired citation style." },
  { icon: BrainCircuit, num: "2", title: "AI Generates",  desc: "Our specialized models synthesize literature, structure arguments, and draft high-fidelity content." },
  { icon: Download,     num: "3", title: "Download",      desc: "Export your complete document in pristine formatting, ready for final review and submission." },
];

const stats = [
  { value: "10",  label: "AI Tools" },
  { value: "66+", label: "Topic Templates" },
  { value: "10+", label: "Export Formats" },
  { value: "5",   label: "Citation Styles" },
];

// ─── component ────────────────────────────────────────────────────────────────
export default function Home() {
  const { t } = useTranslation();

  const statsRef = useRef(null);
  const howRef   = useRef(null);
  const toolsRef = useRef(null);

  const statsInView = useInView(statsRef, { once: true, margin: "-80px" });
  const howInView   = useInView(howRef,   { once: true, margin: "-80px" });
  const toolsInView = useInView(toolsRef, { once: true, margin: "-80px" });

  return (
    <div className="min-h-screen bg-background" data-testid="page-home">

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section className="w-full px-4 sm:px-6 md:px-10 xl:px-16 pt-10 sm:pt-14 md:pt-16 pb-10 sm:pb-12">
        <div className="max-w-screen-xl mx-auto flex flex-col items-center text-center">
          <motion.div
            className="flex flex-col items-center gap-4 sm:gap-6 w-full max-w-4xl"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {/* badge */}
            <motion.span
              variants={fadeUp}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-semibold uppercase tracking-widest"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              AI-Powered Research
            </motion.span>

            {/* title — scales from 2xl on mobile to 6xl on large desktop */}
            <motion.h1
              variants={fadeUp}
              className="font-playfair text-2xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-foreground leading-tight tracking-tight"
            >
              The Future of Academic Writing,{" "}
              <span className="text-primary">Powered by AI</span>
            </motion.h1>

            {/* subtitle */}
            <motion.p
              variants={fadeUp}
              className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-xs sm:max-w-lg md:max-w-2xl leading-relaxed"
            >
              Elevate your scholarly work with high-fidelity document generation. From technical
              reports to entire theses, build rigorous academic documents in minutes.
            </motion.p>

            {/* buttons */}
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 mt-1 sm:mt-2 w-full sm:w-auto">
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto px-6"
                data-testid="button-get-started"
                onClick={() => document.getElementById("tools-grid")?.scrollIntoView({ behavior: "smooth" })}
              >
                Get Started
              </Button>
              <Link href="/projects" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto px-6" data-testid="button-my-projects">
                  <FolderOpen className="w-4 h-4 mr-2" />
                  View Saved Projects
                </Button>
              </Link>
            </motion.div>
          </motion.div>

          {/* ── floating document cards ─── */}
          <motion.div
            className="flex items-center justify-center gap-2 sm:gap-4 md:gap-5 w-full mt-8 sm:mt-12 md:mt-14 pb-4 sm:pb-6"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            {/* left card — PDF */}
            <motion.div
              variants={{
                hidden: { opacity: 0, rotate: -18, y: 20 },
                visible: { opacity: 1, rotate: -8, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
              }}
              className="flex w-24 sm:w-40 md:w-48 lg:w-52 shrink-0 bg-card border border-border shadow-lg rounded-lg flex-col p-2 sm:p-3 md:p-4 self-end mb-4 sm:mb-6"
              style={{ height: "clamp(120px, 18vw, 240px)" }}
            >
              <div className="flex items-center gap-1 sm:gap-1.5 mb-2 text-chart-5">
                <FileImage className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                <span className="text-[8px] sm:text-[10px] font-semibold uppercase tracking-wide truncate">Research_Paper.pdf</span>
              </div>
              <div className="space-y-1 sm:space-y-1.5 flex-grow">
                <div className="h-1 sm:h-1.5 bg-muted rounded w-full" />
                <div className="h-1 sm:h-1.5 bg-muted rounded w-5/6" />
                <div className="h-1 sm:h-1.5 bg-muted rounded w-4/6" />
                <div className="h-6 sm:h-10 md:h-12 bg-muted/70 rounded mt-2 sm:mt-3 w-full" />
                <div className="h-1 sm:h-1.5 bg-muted rounded w-full mt-1 sm:mt-2" />
                <div className="h-1 sm:h-1.5 bg-muted rounded w-3/4" />
              </div>
            </motion.div>

            {/* center card — Word doc (tallest) */}
            <motion.div
              variants={{
                hidden: { opacity: 0, scale: 0.9, y: 30 },
                visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.65, ease: "easeOut", delay: 0.1 } },
              }}
              className="flex w-32 sm:w-48 md:w-56 lg:w-64 shrink-0 bg-card border border-border shadow-2xl rounded-lg flex-col p-2 sm:p-4"
              style={{ height: "clamp(160px, 22vw, 320px)" }}
            >
              <div className="flex items-center gap-1 sm:gap-1.5 mb-2 sm:mb-3 text-primary">
                <FileText className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                <span className="text-[8px] sm:text-[10px] font-semibold uppercase tracking-wide truncate">Technical_Report.docx</span>
              </div>
              <div className="space-y-1.5 sm:space-y-2 flex-grow">
                <div className="h-2 sm:h-3 bg-primary/20 rounded w-3/4" />
                <div className="h-1 sm:h-1.5 bg-muted rounded w-full" />
                <div className="h-1 sm:h-1.5 bg-muted rounded w-full" />
                <div className="h-1 sm:h-1.5 bg-muted rounded w-5/6" />
                <div className="h-8 sm:h-14 md:h-20 bg-muted/60 rounded mt-2 sm:mt-4 w-full flex items-center justify-center">
                  <BarChart2 className="w-5 h-5 sm:w-7 sm:h-7 md:w-8 md:h-8 text-muted-foreground/30" />
                </div>
                <div className="h-1 sm:h-1.5 bg-muted rounded w-full mt-1 sm:mt-2" />
                <div className="h-1 sm:h-1.5 bg-muted rounded w-4/5" />
              </div>
            </motion.div>

            {/* right card — Presentation */}
            <motion.div
              variants={{
                hidden: { opacity: 0, rotate: 18, y: 20 },
                visible: { opacity: 1, rotate: 8, y: 0, transition: { duration: 0.7, ease: "easeOut", delay: 0.05 } },
              }}
              className="flex w-24 sm:w-40 md:w-48 lg:w-52 shrink-0 bg-card border border-border shadow-lg rounded-lg flex-col p-2 sm:p-3 md:p-4 self-end mb-4 sm:mb-6"
              style={{ height: "clamp(120px, 18vw, 240px)" }}
            >
              <div className="flex items-center gap-1 sm:gap-1.5 mb-2 text-chart-3">
                <Presentation className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                <span className="text-[8px] sm:text-[10px] font-semibold uppercase tracking-wide truncate">Conference.pptx</span>
              </div>
              <div className="space-y-1 sm:space-y-1.5 flex-grow">
                <div className="h-6 sm:h-10 md:h-12 bg-muted/70 rounded w-full flex items-center justify-center">
                  <BarChart2 className="w-5 h-5 sm:w-7 sm:h-7 text-muted-foreground/30" />
                </div>
                <div className="h-1 sm:h-1.5 bg-muted rounded w-full mt-2" />
                <div className="h-1 sm:h-1.5 bg-muted rounded w-4/6" />
                <div className="h-1 sm:h-1.5 bg-muted rounded w-5/6" />
              </div>
            </motion.div>
          </motion.div>

        </div>
      </section>

      {/* ── STATS ROW ──────────────────────────────────────────────────────── */}
      <motion.section
        ref={statsRef}
        variants={staggerContainer}
        initial="hidden"
        animate={statsInView ? "visible" : "hidden"}
        className="border-y border-border bg-muted/30 py-6 sm:py-8"
      >
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 md:px-10 xl:px-16
                        grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-4 text-center">
          {stats.map((s, i) => (
            <motion.div key={i} variants={fadeUp} className="flex flex-col gap-1">
              <span className="font-playfair text-2xl sm:text-3xl md:text-4xl font-bold text-primary">{s.value}</span>
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-muted-foreground">{s.label}</span>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── HOW IT WORKS ───────────────────────────────────────────────────── */}
      <motion.section
        ref={howRef}
        variants={staggerContainer}
        initial="hidden"
        animate={howInView ? "visible" : "hidden"}
        className="w-full px-4 sm:px-6 md:px-10 xl:px-16 py-14 sm:py-16 md:py-20"
      >
        <div className="max-w-screen-xl mx-auto">
          <motion.div variants={fadeUp} className="text-center mb-10 sm:mb-12 md:mb-14">
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-2 sm:mb-3">
              Seamless Generation Process
            </h2>
            <p className="text-muted-foreground max-w-xs sm:max-w-sm md:max-w-xl mx-auto text-xs sm:text-sm leading-relaxed">
              A streamlined workflow designed to keep you focused on research while the AI handles
              the structuring and drafting.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 relative">
            {/* connector line — only on sm+ */}
            <div className="hidden sm:block absolute top-10 left-[20%] right-[20%] h-px bg-border z-0" />

            {steps.map(({ icon: Icon, num, title, desc }, i) => (
              <motion.div
                key={num}
                variants={cardVariant}
                className="flex sm:flex-col items-start sm:items-center gap-4 sm:gap-0 sm:text-center relative z-10"
              >
                {/* circle icon */}
                <div className={`w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 shrink-0 rounded-full border-2 flex items-center justify-center sm:mb-5 shadow-sm ${
                  i === 1
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-card border-border text-primary"
                }`}>
                  <Icon className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm sm:text-base text-foreground mb-1 sm:mb-2">{num}. {title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed sm:max-w-xs">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ── TOOLS GRID ─────────────────────────────────────────────────────── */}
      <section className="bg-muted/20 py-14 sm:py-16 md:py-20" id="tools-grid">
        <motion.div
          ref={toolsRef}
          variants={staggerContainer}
          initial="hidden"
          animate={toolsInView ? "visible" : "hidden"}
          className="max-w-screen-xl mx-auto px-4 sm:px-6 md:px-10 xl:px-16"
        >
          <motion.div variants={fadeUp} className="mb-8 sm:mb-10">
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-1 sm:mb-2">Academic Toolkit</h2>
            <p className="text-muted-foreground text-xs sm:text-sm max-w-xs sm:max-w-xl leading-relaxed">
              Explore our comprehensive suite of specialized generative tools tailored for scholarly excellence.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-5">
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <motion.div key={tool.id} variants={cardVariant}>
                  <Link href={tool.href}>
                    <div
                      className="bg-card border border-border rounded-lg p-4 sm:p-5 flex flex-col shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer h-full"
                      data-testid={`card-document-${tool.id}`}
                    >
                      <div className="flex items-center gap-3 mb-2 sm:mb-3">
                        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg ${tool.iconBg} flex items-center justify-center shrink-0`}>
                          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${tool.iconColor}`} />
                        </div>
                        <h3 className="font-semibold text-foreground text-sm sm:text-base">{tool.title}</h3>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed flex-grow mb-3 sm:mb-4">
                        {tool.description}
                      </p>
                      <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-border mt-auto">
                        <span className="text-[10px] sm:text-xs font-medium text-muted-foreground/70 uppercase tracking-wide">
                          {tool.exports}
                        </span>
                        <motion.button
                          whileHover={{ x: 3 }}
                          className="text-primary text-xs sm:text-sm font-medium inline-flex items-center gap-1 hover:gap-2 transition-all"
                          data-testid={`button-generate-${tool.id}`}
                        >
                          {tool.action}
                          <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </motion.button>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </section>

    </div>
  );
}
