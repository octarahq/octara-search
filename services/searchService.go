package services

import (
	"context"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type SearchDocument struct {
	URL         string            `json:"url"`
	Title       string            `json:"title"`
	Description string            `json:"description"`
	Snippet     string            `json:"snippet"`
	Language    string            `json:"language"`
	NSFW        bool              `json:"nsfw"`
	Score       float64           `json:"score"`
	Blur        bool              `json:"blur"`
	Sitelinks   []*SearchDocument `json:"sitelinks"`
}

type SearchService struct {
	db *pgx.Conn
}

func NewSearchService(dbConn *pgx.Conn) *SearchService {
	return &SearchService{db: dbConn}
}

func (s *SearchService) Search(query string, page, limit int, safeSearch string) (map[string]interface{}, error) {
	startTime := time.Now()

	if strings.TrimSpace(query) == "" {
		return map[string]interface{}{"results": []interface{}{}, "total": 0, "timeMs": 0}, nil
	}

	offset := (page - 1) * limit

	rows, err := s.db.Query(context.Background(), `
		SELECT
			url, title, description, snippet, language, nsfw,
			ts_rank(search_vector, plainto_tsquery('simple', $1)) AS rank
		FROM pages
		WHERE search_vector @@ plainto_tsquery('simple', $1)
		ORDER BY
			CASE WHEN url ILIKE '%' || $1 || '%' THEN 2 ELSE 0 END +
			CASE WHEN title ILIKE '%' || $1 || '%' THEN 1 ELSE 0 END +
			ts_rank(search_vector, plainto_tsquery('simple', $1)) DESC
		LIMIT $2 OFFSET $3
	`, query, limit*20, offset)
	if err != nil {
		return nil, fmt.Errorf("search query failed: %v", err)
	}
	defer rows.Close()

	var all []*SearchDocument
	for rows.Next() {
		var doc SearchDocument
		var rank float64
		err := rows.Scan(
			&doc.URL, &doc.Title, &doc.Description, &doc.Snippet,
			&doc.Language, &doc.NSFW, &rank,
		)
		if err != nil {
			continue
		}
		doc.Score = rank

		if safeSearch == "strict" && doc.NSFW {
			continue
		}
		if safeSearch == "moderate" && doc.NSFW {
			doc.Blur = true
		}
		all = append(all, &doc)
	}

	sort.Slice(all, func(i, j int) bool { return all[i].Score > all[j].Score })

	var grouped []*SearchDocument
	domainMap := make(map[string]*SearchDocument)

	for _, r := range all {
		u, _ := url.Parse(r.URL)
		domain := u.Hostname()
		if parent, exists := domainMap[domain]; !exists {
			r.Sitelinks = []*SearchDocument{}
			grouped = append(grouped, r)
			domainMap[domain] = r
		} else if len(parent.Sitelinks) < 4 {
			parent.Sitelinks = append(parent.Sitelinks, r)
		}
	}

	total := len(grouped)
	start := 0
	end := limit
	if end > total {
		end = total
	}

	durationMs := time.Since(startTime).Milliseconds()

	return map[string]interface{}{
		"total":       total,
		"total_pages": (total + limit - 1) / limit,
		"timeMs":      durationMs,
		"results":     grouped[start:end],
	}, nil
}

func (s *SearchService) Autocomplete(query string, limit int) []string {
	if len(strings.TrimSpace(query)) < 2 {
		return []string{}
	}

	rows, err := s.db.Query(context.Background(), `
		SELECT DISTINCT title
		FROM pages
		WHERE title ILIKE $1 || '%'
		ORDER BY title
		LIMIT $2
	`, query, limit)
	if err != nil {
		return []string{}
	}
	defer rows.Close()

	var suggestions []string
	for rows.Next() {
		var title string
		if err := rows.Scan(&title); err == nil && title != "" {
			suggestions = append(suggestions, title)
		}
	}
	return suggestions
}

func (s *SearchService) GetStats(ctx context.Context) map[string]interface{} {
	var pagesCount int
	var indexedCount int

	s.db.QueryRow(ctx, "SELECT COUNT(*)::int FROM pages").Scan(&pagesCount)
	s.db.QueryRow(ctx, "SELECT COUNT(*)::int FROM pages WHERE search_vector IS NOT NULL").Scan(&indexedCount)

	return map[string]interface{}{
		"total_pages":   pagesCount,
		"total_indexed": indexedCount,
		"index_ready":   indexedCount > 0,
	}
}
