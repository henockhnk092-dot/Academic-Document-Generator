import { useState } from "react";
import { Link } from "wouter";
import { PlayCircle, ScanSearch, Wand2, Sparkles, Youtube, ListVideo } from "lucide-react";
import { GeneratorLayout } from "@/components/generator-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Light-theme tutorials (v2, recorded on the real site with a demo account). Files in /videos/v2.
const TOOL_TUTS = [
  { file: "technical_report", title: "Technical Report", desc: "A full structured report from one topic.", href: "/generate/report" },
  { file: "conference_paper", title: "Conference Paper", desc: "IEEE format with abstract, keywords and references.", href: "/generate/conference" },
  { file: "thesis", title: "Thesis", desc: "Plan every chapter, from introduction to conclusion.", href: "/generate/thesis" },
  { file: "powerpoint", title: "PowerPoint", desc: "Slides with images and speaker notes.", href: "/generate/powerpoint" },
  { file: "custom_report", title: "Custom Report", desc: "Design your own sections.", href: "/generate/custom-report" },
  { file: "ai_images", title: "AI Images", desc: "Illustrations from a short description.", href: "/generate/images" },
  { file: "citation_checker", title: "Citation Checker", desc: "Find made-up or wrongly formatted references.", href: "/citations" },
  { file: "grammar_check", title: "Grammar Check", desc: "Grammar, spelling and style suggestions.", href: "/grammar-check" },
  { file: "ai_check", title: "AI Check", desc: "Score and flagged sentences, free.", href: "/ai-check" },
  { file: "humanizer_premium", title: "AI Humanizer", desc: "Clear academic wording, Premium rounds and Review with AI.", href: "/humanize" },
  { file: "rewrite_verify", title: "Rewrite & Verify", desc: "Recorded live on a 5-page report: Word file in, automatic rounds, fact and meaning checks, layout kept, final AI and plagiarism report.", href: "/rewrite-verify" },
  { file: "ai_assistant", title: "AI Assistant", desc: "Ask about writing, structure and references.", href: "/ai-assistant" },
  { file: "community", title: "Community", desc: "Chat with students, reviewed by AI.", href: "/community" },
  { file: "templates_projects", title: "Templates and projects", desc: "Ready structures and your saved work.", href: "/templates" },
  { file: "download_app", title: "Download the app", desc: "Android, Windows, iPhone and Mac.", href: "/download" },
  { file: "pricing", title: "Pricing", desc: "Start free; plans from R19 a day.", href: "/pricing" },
];

// Earlier walkthroughs on the LearnHub YouTube channel (embedded, so views count on YouTube)
const PLAYLIST = "https://www.youtube.com/playlist?list=PLrZbkNpNVSwx7457nVSCrT3VntP8MJD7D";
const YT = [
  { id: "VMkf9ZzRm2k", title: "AcademicGen overview", desc: "A tour of the AI academic document generator.", href: "/" },
  { id: "lknyKeFCehI", title: "Technical reports", desc: "Generate a structured technical report, then edit and export it.", href: "/generate/report" },
  { id: "LdfhykNKtH8", title: "Conference papers", desc: "Draft an IEEE-style conference paper with references.", href: "/generate/conference" },
  { id: "ND1Q07WzJ-8", title: "PowerPoint presentations", desc: "Build slides with images and speaker notes.", href: "/generate/powerpoint" },
  { id: "-Mc6NijLx5w", title: "AcademicGen walkthrough", desc: "Another look at the main features.", href: "/" },
];

// Thumbnail first; the YouTube player loads only after a click (faster page, no tracking until then).
function YouTubeCard({ id, title }: { id: string; title: string }) {
  const [play, setPlay] = useState(false);
  return play ? (
    <iframe className="w-full aspect-video" src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`} title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
  ) : (
    <button onClick={() => setPlay(true)} className="relative w-full aspect-video group bg-black" aria-label={`Play ${title}`} data-testid={`yt-${id}`}>
      <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" loading="lazy" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="w-14 h-10 rounded-xl bg-red-600 group-hover:bg-red-500 flex items-center justify-center shadow-lg"><span className="ml-1 border-y-[9px] border-y-transparent border-l-[15px] border-l-white" /></span>
      </span>
    </button>
  );
}

// Video tutorials recorded on the real site (demo account). Files are served from /videos.
export default function Tutorials() {
  return (
    <GeneratorLayout
      title="Video tutorials"
      description="Short videos of every AcademicGen tool, recorded on the real site, step by step."
      icon={<PlayCircle className="w-6 h-6 text-white" />}
      gradient="from-rose-500 to-orange-500"
    >
      <div className="space-y-8">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg">What AcademicGen does (under 2 minutes)</CardTitle>
            <CardDescription>From a 2 a.m. deadline to a finished report: every tool, shown on the real site.</CardDescription>
          </CardHeader>
          <CardContent>
            <video className="w-full rounded-lg border bg-black aspect-video" controls preload="metadata" playsInline
              poster="/videos/v2/academicgen_what_we_do.jpg" data-testid="video-what-we-do">
              <source src="/videos/v2/academicgen_what_we_do.mp4" type="video/mp4" />
            </video>
            <div className="pt-3"><Link href="/"><Button size="sm"><Sparkles className="w-4 h-4 mr-1" />Start free</Button></Link></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Full tour: every tool in 4 minutes</CardTitle>
            <CardDescription>Generators, checking tools, Premium rounds, the AI Assistant, Community and pricing.</CardDescription>
          </CardHeader>
          <CardContent>
            <video className="w-full rounded-lg border bg-black aspect-video" controls preload="metadata" playsInline
              poster="/videos/v2/academicgen_tour_full.jpg" data-testid="video-full">
              <source src="/videos/v2/academicgen_tour_full.mp4" type="video/mp4" />
            </video>
            <div className="flex flex-wrap gap-2 mt-4">
              <Link href="/ai-check"><Button size="sm" variant="outline"><ScanSearch className="w-4 h-4 mr-1" />Try AI Check</Button></Link>
              <Link href="/humanize"><Button size="sm" variant="outline"><Wand2 className="w-4 h-4 mr-1" />Try the Humanizer</Button></Link>
              <Link href="/rewrite-verify"><Button size="sm"><Sparkles className="w-4 h-4 mr-1" />Rewrite & Verify, first document R29</Button></Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border-violet-500/40">
          <CardHeader>
            <CardTitle className="text-lg flex flex-wrap items-center gap-2"><Sparkles className="w-5 h-5 text-violet-600" />Premium rounds: a real result</CardTitle>
            <CardDescription>A typical AI-written paragraph, recorded live: 100% AI-like before, then 0% on ZeroGPT and 0.06% on Quetext after five rounds, with the plagiarism report and Review with AI.</CardDescription>
          </CardHeader>
          <CardContent>
            <video className="w-full rounded-lg border bg-black aspect-video" controls preload="metadata" playsInline
              poster="/videos/v2/tut_premium_rounds.jpg" data-testid="video-premium">
              <source src="/videos/v2/tut_premium_rounds.mp4" type="video/mp4" />
            </video>
            <p className="text-xs text-muted-foreground mt-3">Scores come from independent detectors and vary from text to text; they are estimates, not a guarantee.</p>
            <div className="pt-3"><Link href="/humanize"><Button size="sm"><Wand2 className="w-4 h-4 mr-1" />Try Premium rounds</Button></Link></div>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-lg sm:text-xl font-semibold mb-1">User guides: step by step</h2>
          <p className="text-sm text-muted-foreground mb-4">Every click explained, with numbered steps.</p>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {[{ file: "guide_ai_check", title: "How to use AI Check", desc: "6 steps: add your text, check it, read the score, export and improve.", href: "/ai-check" },
              { file: "guide_humanizer", title: "How to use the AI Humanizer", desc: "7 steps plus Premium rounds: rewrite, compare, Review with AI, export.", href: "/humanize" }].map((v) => (
              <Card key={v.file} className="overflow-hidden flex flex-col">
                <video className="w-full bg-black aspect-video" controls preload="none" playsInline poster={`/videos/v2/${v.file}.jpg`} data-testid={`video-${v.file}`}>
                  <source src={`/videos/v2/${v.file}.mp4`} type="video/mp4" />
                </video>
                <CardContent className="pt-4 space-y-2 flex flex-col flex-1">
                  <p className="font-medium">{v.title}</p>
                  <p className="text-sm text-muted-foreground">{v.desc}</p>
                  <div className="pt-2 mt-auto"><Link href={v.href}><Button size="sm" variant="outline">Open the tool</Button></Link></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg sm:text-xl font-semibold mb-1">Tool tutorials</h2>
          <p className="text-sm text-muted-foreground mb-4">One short video for every tool.</p>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {TOOL_TUTS.map((v) => (
              <Card key={v.file} className="overflow-hidden flex flex-col">
                <video className="w-full bg-black aspect-video" controls preload="none" playsInline poster={`/videos/series/${v.file}.jpg`} data-testid={`video-${v.file}`}>
                  <source src={`/videos/series/${v.file}.mp4`} type="video/mp4" />
                </video>
                <CardContent className="pt-4 space-y-2 flex flex-col flex-1">
                  <p className="font-medium">{v.title}</p>
                  <p className="text-sm text-muted-foreground">{v.desc}</p>
                  <div className="pt-2 mt-auto"><Link href={v.href}><Button size="sm" variant="outline">Open the tool</Button></Link></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2"><Youtube className="w-5 h-5 text-red-600" />From our YouTube channel</h2>
              <p className="text-sm text-muted-foreground">Walkthroughs of the report, conference paper and PowerPoint generators.</p>
            </div>
            <a href={PLAYLIST} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="w-full sm:w-auto"><ListVideo className="w-4 h-4 mr-1" />Watch the full playlist</Button></a>
          </div>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {YT.map((v) => (
              <Card key={v.id} className="overflow-hidden flex flex-col">
                <YouTubeCard id={v.id} title={v.title} />
                <CardContent className="pt-4 space-y-2 flex flex-col flex-1">
                  <p className="font-medium">{v.title}</p>
                  <p className="text-sm text-muted-foreground flex-1">{v.desc}</p>
                  <div className="pt-2 mt-auto"><Link href={v.href}><Button size="sm" variant="outline">Open the tool</Button></Link></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

      </div>
    </GeneratorLayout>
  );
}
