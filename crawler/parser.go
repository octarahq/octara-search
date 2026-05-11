package crawler

import (
	"crawler/config"
	"crypto/sha256"
	"encoding/xml"
	"fmt"
	"io"
	"net/url"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

type SitemapURL struct {
	Loc     string `xml:"loc"`
	LastMod string `xml:"lastmod"`
}

type Sitemap struct {
	XMLName xml.Name     `xml:"urlset"`
	URLs    []SitemapURL `xml:"url"`
}

type SitemapIndex struct {
	XMLName  xml.Name     `xml:"sitemapindex"`
	Sitemaps []SitemapURL `xml:"sitemap"`
}

func ParseHTML(rawURL string, body io.Reader) (config.PageData, []string, []string, error) {
	doc, err := goquery.NewDocumentFromReader(body)
	if err != nil {
		return config.PageData{}, nil, nil, err
	}

	data := config.PageData{URL: rawURL}
	data.Title = strings.TrimSpace(doc.Find("title").Text())

	doc.Find("meta").Each(func(i int, s *goquery.Selection) {
		name, _ := s.Attr("name")
		property, _ := s.Attr("property")
		content, _ := s.Attr("content")

		if strings.ToLower(name) == "description" || strings.ToLower(property) == "og:description" {
			if data.Description == "" {
				data.Description = strings.TrimSpace(content)
			}
		}
	})

	doc.Find("script, style, nav, footer, header").Remove()
	bodyText := strings.TrimSpace(doc.Find("body").Text())
	bodyText = strings.Join(strings.Fields(bodyText), " ")
	if len(bodyText) > 250 {
		data.Snippet = bodyText[:247] + "..."
	} else {
		data.Snippet = bodyText
	}

	lang, exists := doc.Find("html").Attr("lang")
	if exists {
		data.Language = strings.ToLower(strings.Split(lang, "-")[0])
	} else {
		data.Language = "en"
	}

	nsfwTags := []string{"porn", "xxx", "sex", "adult", "nude"}
	fullText := strings.ToLower(data.Title + " " + data.Description)
	for _, tag := range nsfwTags {
		if strings.Contains(fullText, tag) {
			data.NSFW = true
			break
		}
	}

	var links []string
	var sitemaps []string
	baseURL, _ := url.Parse(rawURL)

	if baseHref, exists := doc.Find("base").Attr("href"); exists {
		if baseURLExtracted, err := url.Parse(baseHref); err == nil {
			baseURL = baseURL.ResolveReference(baseURLExtracted)
		}
	}

	doc.Find("a").Each(func(i int, s *goquery.Selection) {
		link, exists := s.Attr("href")
		if exists {
			resolved := resolveURL(baseURL, link)
			if resolved != "" {
				links = append(links, resolved)
			}
		}
	})

	doc.Find("link").Each(func(i int, s *goquery.Selection) {
		rel, _ := s.Attr("rel")
		if strings.ToLower(rel) == "sitemap" {
			href, exists := s.Attr("href")
			if exists {
				resolved := resolveURL(baseURL, href)
				if resolved != "" {
					sitemaps = append(sitemaps, resolved)
				}
			}
		}
	})

	data.ContentHash = generateHash(data)

	return data, links, sitemaps, nil
}

func resolveURL(base *url.URL, link string) string {
	u, err := url.Parse(link)
	if err != nil {
		return ""
	}

	resolved := base.ResolveReference(u)

	if resolved.Scheme != "http" && resolved.Scheme != "https" {
		return ""
	}

	resolved.Fragment = ""

	return resolved.String()
}

func generateHash(data config.PageData) string {
	h := sha256.New()
	h.Write([]byte(data.Title + data.Description))

	return fmt.Sprintf("%x", h.Sum(nil))
}

func ParseSitemap(body io.Reader) ([]SitemapURL, error) {
	data, err := io.ReadAll(body)
	if err != nil {
		return nil, err
	}

	var urlset Sitemap
	if err := xml.Unmarshal(data, &urlset); err == nil && len(urlset.URLs) > 0 {
		return urlset.URLs, nil
	}

	var index SitemapIndex
	if err := xml.Unmarshal(data, &index); err == nil && len(index.Sitemaps) > 0 {
		return index.Sitemaps, nil
	}

	return nil, fmt.Errorf("unknown sitemap format")
}
