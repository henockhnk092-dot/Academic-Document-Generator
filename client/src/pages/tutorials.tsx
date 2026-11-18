import { useState } from "react";
import { Link } from "wouter";
import { PlayCircle, ScanSearch, Wand2, Sparkles, Youtube, ListVideo } from "lucide-react";
import { GeneratorLayout } from "@/components/generator-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const SHORTS = [
  { file: "short_ai_check", title: "AI Check in 30 seconds", desc: "Score and flagged sentences, export, full screen and voices.", href: "/ai-check" },
  { file: "short_humanizer_v2", title: "AI Humanizer + Review with AI", desc: "Natural academic rewrite, then AI checks meaning, numbers and citations.", href: "/humanize" },
  { file: "short_rewrite_verify", title: "Rewrite & Verify", desc: "Premium rewrite with fact guard, AI check rounds and a plagiarism report.", href: "/rewrite-verify" },
  { file: "short_feature_montage", title: "6 tools in 20 seconds", desc: "A quick look at the student writing toolkit.", href: "/" },
  { file: "short_getting_started", title: "Getting started", desc: "Open academicgen.com, find every tool and see the plans.", href: "/pricing" },
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
      description="Watch how AI Check, the AI Humanizer and Rewrite & Verify work on real text, step by step."
      icon={<PlayCircle className="w-6 h-6 text-white" />}
      gradient="from-rose-500 to-orange-500"
    >
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Full tutorial (2 minutes)</CardTitle>
            <CardDescription>From opening the site to the final Rewrite & Verify report.</CardDescription>
          </CardHeader>
          <CardContent>
            <video className="w-full rounded-lg border bg-black aspect-video" controls preload="metadata" playsInline
              poster="/videos/academicgen_tutorial_full.jpg" data-testid="video-full">
              <source src="/videos/academicgen_tutorial_full.mp4" type="video/mp4" />
            </video>
            <div className="flex flex-wrap gap-2 mt-4">
              <Link href="/ai-check"><Button size="sm" variant="outline"><ScanSearch className="w-4 h-4 mr-1" />Try AI Check</Button></Link>
              <Link href="/humanize"><Button size="sm" variant="outline"><Wand2 className="w-4 h-4 mr-1" />Try the Humanizer</Button></Link>
              <Link href="/rewrite-verify"><Button size="sm"><Sparkles className="w-4 h-4 mr-1" />Rewrite & Verify, first document R29</Button></Link>
            </div>
          </CardContent>
        </Card>

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

        <div>
          <h2 className="text-lg sm:text-xl font-semibold mb-4">Short videos</h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {SHORTS.map((s) => (
              <Card key={s.file} className="overflow-hidden flex flex-col">
                <video className="w-full bg-black aspect-[9/16] max-h-[640px] object-contain" controls preload="none" playsInline
                  poster={`/videos/${s.file}.jpg`} data-testid={`video-${s.file}`}>
                  <source src={`/videos/${s.file}.mp4`} type="video/mp4" />
                </video>
                <CardContent className="pt-4 space-y-2 flex flex-col flex-1">
                  <p className="font-medium">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                  <div className="pt-2 mt-auto"><Link href={s.href}><Button size="sm" variant="outline">Open the tool</Button></Link></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </GeneratorLayout>
  );
}
