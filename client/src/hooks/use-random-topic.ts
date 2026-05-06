import { useState } from "react";
import { getRandomTopic } from "@/lib/random-topics";

export function useRandomTopic() {
  const [isLoading, setIsLoading] = useState(false);

  const generateTopic = async () => {
    setIsLoading(true);

    // Simulate a brief delay for UX
    await new Promise(resolve => setTimeout(resolve, 300));

    setIsLoading(false);
    return getRandomTopic();
  };

  return {
    generateTopic,
    isLoading,
  };
}
