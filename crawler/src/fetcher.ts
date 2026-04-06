import { fetch } from "undici";

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

export async function fetchPage(
  url: string,
  retries = MAX_RETRIES,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
        Referer: "https://www.google.fr/",
        "Sec-Ch-Ua":
          '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
      },
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if ((response.status === 429 || response.status >= 500) && retries > 0) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY));
        return fetchPage(url, retries - 1);
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain") &&
      !contentType.includes("xml")
    ) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    return await response.text();
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (retries > 0 && e.name !== "AbortError") {
      await new Promise((r) => setTimeout(r, RETRY_DELAY));
      return fetchPage(url, retries - 1);
    }
    throw e;
  }
}
