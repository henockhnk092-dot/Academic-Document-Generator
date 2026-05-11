import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";

const KEY = "academicgen_cookie_consent";
const GA_ID = "G-D7WVG8HKKR";

function injectGA() {
  if (document.getElementById("ga-script")) return;
  const s = document.createElement("script");
  s.id = "ga-script";
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  s.async = true;
  document.head.appendChild(s);
  (window as any).dataLayer = (window as any).dataLayer || [];
  function gtag(...args: any[]) { (window as any).dataLayer.push(args); }
  gtag("js", new Date());
  gtag("config", GA_ID);
}

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    if (!stored) {
      setShow(true);
    } else if (stored === "accepted") {
      injectGA();
    }
  }, []);

  const accept = () => {
    localStorage.setItem(KEY, "accepted");
    setShow(false);
    injectGA();
  };

  const decline = () => {
    localStorage.setItem(KEY, "declined");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm shadow-lg">
      <div className="container mx-auto max-w-5xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Cookie className="h-5 w-5 text-primary flex-shrink-0 mt-0.5 sm:mt-0" />
        <p className="text-sm text-muted-foreground flex-1">
          We use Google Analytics to understand how people use AcademicGen and improve it.
          No personal data is sold. See our{" "}
          <a href="/about" className="underline underline-offset-2 hover:text-foreground">
            privacy policy
          </a>.
        </p>
        <div className="flex gap-2 flex-shrink-0">
          <Button size="sm" variant="outline" onClick={decline} className="h-8 text-xs">
            Decline
          </Button>
          <Button size="sm" onClick={accept} className="h-8 text-xs">
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
