import * as cheerio from "cheerio";
import crypto from "crypto";

export interface ParseResult {
  title: string;
  description: string;
  snippet: string;
  language: string;
  contentHash: string;
  links: string[];
  sitemaps: string[];
}

export function normalizeUrl(url: string, baseUrl?: string): string {
  try {
    const u = new URL(url, baseUrl);
    u.hash = "";
    const params = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
    ];
    params.forEach((p) => u.searchParams.delete(p));

    u.searchParams.sort();

    let res = u.toString();
    return res;
  } catch (e) {
    return url;
  }
}

export function parseHtml(html: string, baseUrl: string): ParseResult {
  const $ = cheerio.load(html);

  $(
    "script, style, nav, footer, header, noscript, .cookie-banner, .ads",
  ).remove();

  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("title").text() ||
    $("h1").first().text() ||
    "";

  const description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    "";

  let snippet = "";
  $("p").each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, " ");
    if (text.length > 40 && !snippet) {
      snippet = text;
    }
  });

  if (!snippet)
    snippet = $("body").text().trim().substring(0, 500).replace(/\s+/g, " ");

  let language = $("html").attr("lang")?.split("-")[0] || "en";
  if (language.length > 2) language = language.substring(0, 2);

  const cleanTitle = title.trim().substring(0, 300).replace(/\s+/g, " ");
  const cleanDesc = description.trim().substring(0, 300).replace(/\s+/g, " ");
  const cleanSnippet = snippet.trim().substring(0, 500);

  const hash = crypto
    .createHash("sha256")
    .update(html)
    .digest("hex")
    .substring(0, 16);

  const links: string[] = [];
  const sitemaps: string[] = [];

  $('link[rel="sitemap"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) sitemaps.push(normalizeUrl(href, baseUrl));
  });

  $("a[href]").each((_, el) => {
    let href = $(el).attr("href");
    if (!href) return;

    if (
      href.startsWith("#") ||
      href.startsWith("javascript:") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:")
    )
      return;

    const normalized = normalizeUrl(href, baseUrl);
    if (normalized.startsWith("http")) {
      if (normalized.endsWith(".xml") && normalized.includes("sitemap")) {
        sitemaps.push(normalized);
      } else {
        links.push(normalized);
      }
    }
  });

  return {
    title: cleanTitle,
    description: cleanDesc,
    snippet: cleanSnippet,
    language: language.toLowerCase(),
    contentHash: hash,
    links: [...new Set(links)],
    sitemaps: [...new Set(sitemaps)],
  };
}

export function parseSitemap(xml: string) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const urls: string[] = [];
  const nestedSitemaps: string[] = [];

  $("url > loc").each((_, el) => {
    const url = $(el).text().trim();
    if (url) urls.push(url);
  });

  $("sitemap > loc").each((_, el) => {
    const url = $(el).text().trim();
    if (url) nestedSitemaps.push(url);
  });

  return {
    urls: [...new Set(urls)],
    nestedSitemaps: [...new Set(nestedSitemaps)],
  };
}
