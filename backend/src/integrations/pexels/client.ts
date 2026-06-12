import { getConfigValue } from "../../services/systemConfig.ts";

export interface StockImageResult {
  url: string;
  license: {
    source: "pexels";
    photographer: string;
    photographerUrl: string;
    originalUrl: string;
  };
}

interface PexelsPhoto {
  src: { landscape: string; original: string };
  photographer: string;
  photographer_url: string;
  url: string;
}

interface PexelsSearchResponse {
  photos: PexelsPhoto[];
}

export async function searchPexels(query: string): Promise<StockImageResult | null> {
  const apiKey = await getConfigValue("pexels_api_key");
  if (!apiKey) return null;

  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "1");
  url.searchParams.set("orientation", "landscape");

  const res = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
  });

  if (!res.ok) return null;

  const body = (await res.json()) as PexelsSearchResponse;
  const photo = body.photos[0];
  if (!photo) return null;

  return {
    url: photo.src.landscape,
    license: {
      source: "pexels",
      photographer: photo.photographer,
      photographerUrl: photo.photographer_url,
      originalUrl: photo.url,
    },
  };
}

export async function pexelsConfigured(): Promise<boolean> {
  return Boolean(await getConfigValue("pexels_api_key"));
}
