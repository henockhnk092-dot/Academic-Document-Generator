import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Presentation, GraduationCap, Wand2, FolderOpen, Download, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";

const STORAGE_KEY = "academicgen_onboarded_v1";

const STEPS = [
  {
    icon: Sparkles,
    color: "text-purple-500",
    title: "Welcome to AcademicGen",
    description: "Your all-in-one AI platform for generating professional academic documents. Powered by Google Gemini 2.5 Flash.",
    bullets: [
      "9 AI-powered document tools",
      "12 supported languages",
      "Export to PDF, DOCX, PPTX, HTML",
      "Free image generation included",
    ],
  },
  {
    icon: FileText,
    color: "text-blue-500",
    title: "Generate in Seconds",
    description: "Pick a tool from the sidebar, enter your topic (or use a template), and let AI do the writing.",
    bullets: [
      "Technical Reports — BET-standard format",
      "Conference Papers — full IEEE structure",
      "Thesis / Dissertation — 5 chapters, citations",
      "PowerPoint — speaker notes included",
    ],
  },
  {
    icon: FolderOpen,
    color: "text-green-500",
    title: "Save, Export & Share",
    description: "Sign in with Google to save documents to the cloud. Export in any format anytime.",
    bullets: [
      "My Projects stores all your documents",
      "PDF, Word, HTML and Print exports",
      "My Templates — save your favourite prompts",
      "TTS voice reader on every document",
    ],
  },
];

export function OnboardingModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      // Small delay so the page renders first
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
  };

  const S = STEPS[step];
  const Icon = S.icon;

  return (
    <Dialog open={open} onOpenChange={dismiss}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {/* Progress bar */}
        <div className="flex gap-1 p-4 pb-0">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        <div className="p-6 pt-4 space-y-4">
          {/* Icon + Title */}
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl bg-muted flex items-center justify-center ${S.color}`}>
              <Icon className="w-7 h-7" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Step {step + 1} of {STEPS.length}</p>
              <h2 className="text-xl font-bold">{S.title}</h2>
            </div>
          </div>

          <p className="text-muted-foreground text-sm leading-relaxed">{S.description}</p>

          <ul className="space-y-2">
            {S.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                {b}
              </li>
            ))}
          </ul>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" size="sm" onClick={dismiss} className="text-muted-foreground text-xs">
              Skip
            </Button>
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="outline" size="sm" onClick={() => setStep(s => s - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button size="sm" onClick={() => setStep(s => s + 1)} className="gap-1">
                  Next <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button size="sm" onClick={dismiss} className="bg-gradient-to-r from-primary to-purple-600 hover:opacity-90">
                  Get Started!
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
