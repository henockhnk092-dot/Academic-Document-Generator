import { useEffect } from "react";

export function useUnsavedWarning(hasUnsavedWork: boolean) {
  useEffect(() => {
    if (!hasUnsavedWork) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedWork]);
}
