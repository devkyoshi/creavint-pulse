import { getConfigValue } from "../../services/systemConfig.ts";

export interface StockImageResult {
  url: string;
  license: {
    source: "unsplash";
    photographer: string;
    photographerUrl: string;
    originalUrl: string;
  };
}

interface UnsplashUser { name: string; links: { html: string }; }
interface UnsplashPhoto { urls: { regular: string }; links: { html: string }; user: UnsplashUser; }
interface UnsplashSearchResponse { results: UnsplashPhoto[]; }

export async function searchUnsplash(query: string): Promise<StockImageResult | null> {
  const accessKey = await getConfigValue("unsplash_access_key");
  if (!accessKey) return null;

  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "1");
  url.searchParams.set("orientation", "landscape");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Client-ID ${accessKey}` },
  });

  if (!res.ok) return null;

  const body = (await res.json()) as UnsplashSearchResponse;
  const photo = body.results[0];
  if (!photo) return null;

  return {
    url: photo.urls.regular,
    license: {
      source: "unsplash",
      photographer: photo.user.name,
      photographerUrl: photo.user.links.html,
      originalUrl: photo.links.html,
    },
  };
}

export async function unsplashConfigured(): Promise<boolean> {
  return Boolean(await getConfigValue("unsplash_access_key"));
}
