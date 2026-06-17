import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FullscreenPreviewButtonProps {
  isFullscreen: boolean;
  onToggle: () => void;
}

export function FullscreenPreviewButton({ isFullscreen, onToggle }: FullscreenPreviewButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onToggle}
      title={isFullscreen ? "Exit fullscreen" : "Fullscreen preview"}
      className="shrink-0 h-8 w-8"
    >
      {isFullscreen ? (
        <Minimize2 className="h-4 w-4" />
      ) : (
        <Maximize2 className="h-4 w-4" />
      )}
    </Button>
  );
}
