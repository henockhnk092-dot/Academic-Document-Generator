import { Link } from "wouter";
import { PlayCircle, ScanSearch, Wand2, Sparkles } from "lucide-react";
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
          <h2 className="text-xl font-semibold mb-4">Short videos</h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {SHORTS.map((s) => (
              <Card key={s.file} className="overflow-hidden">
                <video className="w-full bg-black aspect-[9/16] max-h-[640px] object-contain" controls preload="none" playsInline
                  poster={`/videos/${s.file}.jpg`} data-testid={`video-${s.file}`}>
                  <source src={`/videos/${s.file}.mp4`} type="video/mp4" />
                </video>
                <CardContent className="pt-4 space-y-2">
                  <p className="font-medium">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                  <Link href={s.href}><Button size="sm" variant="outline">Open the tool</Button></Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </GeneratorLayout>
  );
}
