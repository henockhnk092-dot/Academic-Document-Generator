import { useState, useCallback } from "react";

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggle = useCallback(() => setIsFullscreen(f => !f), []);
  const exit = useCallback(() => setIsFullscreen(false), []);

  const containerClassName = isFullscreen
    ? "fixed inset-0 z-50 bg-background overflow-auto p-4 flex flex-col"
    : "";

  return { isFullscreen, toggle, exit, containerClassName };
}
