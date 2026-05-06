const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY || "";
const PIXABAY_API_URL = "https://pixabay.com/api/";

export interface PixabayImage {
  id: number;
  pageURL: string;
  type: string;
  tags: string;
  previewURL: string;
  webformatURL: string;
  largeImageURL: string;
  imageWidth: number;
  imageHeight: number;
  user: string;
}

export function extractKeywords(topic: string): string {
  const genericTerms = [
    "professional", "presentation", "slide", "corporate", "business",
    "technical", "report", "document", "paper", "research", "academic",
    "conference", "thesis", "dissertation", "study", "analysis",
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to",
    "for", "of", "with", "by", "from", "as", "is", "was", "are", "were"
  ];

  const words = topic
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3 && !genericTerms.includes(word))
    .slice(0, 8);

  return words.join(" ") + " technology";
}

export async function searchImages(query: string, perPage: number = 10): Promise<PixabayImage[]> {
  if (!PIXABAY_API_KEY) {
    console.warn("Pixabay API key not configured, returning empty results");
    return [];
  }

  const keywords = extractKeywords(query);
  const searchQuery = keywords.substring(0, 100);

  const url = new URL(PIXABAY_API_URL);
  url.searchParams.append("key", PIXABAY_API_KEY);
  url.searchParams.append("q", searchQuery);
  url.searchParams.append("image_type", "photo");
  url.searchParams.append("per_page", perPage.toString());
  url.searchParams.append("safesearch", "true");

  try {
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Pixabay API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.hits || [];
  } catch (error) {
    console.error("Pixabay API error:", error);
    return [];
  }
}

export async function getRandomImage(query: string): Promise<PixabayImage | null> {
  const images = await searchImages(query, 10);
  
  if (images.length === 0) {
    const fallbackImages = await searchImages("technology business", 10);
    if (fallbackImages.length === 0) return null;
    return fallbackImages[Math.floor(Math.random() * fallbackImages.length)];
  }

  return images[Math.floor(Math.random() * images.length)];
}

export async function urlToBase64(imageUrl: string): Promise<string> {
  try {
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.toString("base64");
  } catch (error) {
    console.error("Error converting image to base64:", error);
    throw error;
  }
}
