package services

import (
	"context"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/blugelabs/bluge"
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
	db          *pgx.Conn
	writer      *bluge.Writer
	reader      *bluge.Reader
	indexLoaded bool
	mu          sync.RWMutex
}

func NewSearchService(dbConn *pgx.Conn) *SearchService {
	config := bluge.InMemoryOnlyConfig()

	writer, err := bluge.OpenWriter(config)
	if err != nil {
		panic(fmt.Sprintf("Impossible d'ouvrir le writer Bluge: %v", err))
	}

	return &SearchService{
		db:     dbConn,
		writer: writer,
	}
}

func (s *SearchService) LoadIndex() error {
	rows, err := s.db.Query(context.Background(), "SELECT url, title, language, nsfw FROM pages")
	if err != nil {
		return err
	}
	defer rows.Close()

	s.mu.Lock()
	defer s.mu.Unlock()

	batch := bluge.NewBatch()
	for rows.Next() {
		var doc SearchDocument
		if err := rows.Scan(&doc.URL, &doc.Title, &doc.Language, &doc.NSFW); err != nil {
			continue
		}

		bDoc := bluge.NewDocument(doc.URL).
			AddField(bluge.NewTextField("title", doc.Title).StoreValue()).
			AddField(bluge.NewTextField("url", doc.URL).StoreValue()).
			AddField(bluge.NewKeywordField("language", doc.Language).StoreValue()).
			AddField(bluge.NewStoredOnlyField("nsfw", []byte(fmt.Sprintf("%t", doc.NSFW))))

		batch.Update(bDoc.ID(), bDoc)
	}

	if err := s.writer.Batch(batch); err != nil {
		return err
	}

	s.reader, _ = s.writer.Reader()
	s.indexLoaded = true
	fmt.Println("[Search] Index chargé avec succès")
	return nil
}

func (s *SearchService) Search(query string, page, limit int, safeSearch string) (map[string]interface{}, error) {
	startTime := time.Now()
	s.mu.RLock()
	if !s.indexLoaded {
		s.mu.RUnlock()
		return map[string]interface{}{"results": []interface{}{}, "total": 0}, nil
	}
	reader := s.reader
	s.mu.RUnlock()

	q := bluge.NewBooleanQuery()
	tq := bluge.NewMatchQuery(query).SetField("title").SetBoost(5)
	uq := bluge.NewMatchQuery(query).SetField("url").SetBoost(10)
	q.AddShould(tq, uq)

	req := bluge.NewTopNSearch(400, q)
	dmi, err := reader.Search(context.Background(), req)
	if err != nil {
		return nil, err
	}

	var all []*SearchDocument
	next, err := dmi.Next()
	for err == nil && next != nil {
		var doc SearchDocument
		next.VisitStoredFields(func(field string, value []byte) bool {
			switch field {
			case "title":
				doc.Title = string(value)
			case "url":
				doc.URL = string(value)
			case "nsfw":
				doc.NSFW = string(value) == "true"
			}
			return true
		})

		doc.Score = next.Score
		lq := strings.ToLower(query)
		if strings.Contains(strings.ToLower(doc.URL), lq) {
			doc.Score *= 5
		}

		if safeSearch == "strict" && doc.NSFW {
		} else {
			if safeSearch == "moderate" && doc.NSFW {
				doc.Blur = true
			}
			all = append(all, &doc)
		}
		next, err = dmi.Next()
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
	offset := (page - 1) * limit
	if offset > total {
		offset = total
	}
	end := offset + limit
	if end > total {
		end = total
	}

	paged := grouped[offset:end]

	final := s.HydrateResults(paged)
	endTime := time.Now()

	durationMs := endTime.UnixMilli() - startTime.UnixMilli()

	return map[string]interface{}{
		"total":       total,
		"total_pages": (total + limit - 1) / limit,
		"timeMs":      durationMs,
		"results":     final,
	}, nil
}

func (s *SearchService) HydrateResults(results []*SearchDocument) []*SearchDocument {
	if len(results) == 0 {
		return results
	}

	urls := []string{}
	for _, r := range results {
		urls = append(urls, r.URL)
		for _, sl := range r.Sitelinks {
			urls = append(urls, sl.URL)
		}
	}

	rows, err := s.db.Query(context.Background(), "SELECT url, description, snippet FROM pages WHERE url = ANY($1)", urls)
	if err != nil {
		return results
	}
	defer rows.Close()

	data := make(map[string][2]string)
	for rows.Next() {
		var u, d, sn string
		rows.Scan(&u, &d, &sn)
		data[u] = [2]string{d, sn}
	}

	for _, r := range results {
		r.Description = data[r.URL][0]
		r.Snippet = data[r.URL][1]
		for _, sl := range r.Sitelinks {
			sl.Description = data[sl.URL][0]
			sl.Snippet = data[sl.URL][1]
		}
	}
	return results
}

func (s *SearchService) Autocomplete(query string, limit int) []string {
	s.mu.RLock()
	if !s.indexLoaded || len(query) < 2 {
		s.mu.RUnlock()
		return []string{}
	}
	reader := s.reader
	s.mu.RUnlock()

	prefixQuery := bluge.NewPrefixQuery(strings.ToLower(query)).SetField("title")
	req := bluge.NewTopNSearch(limit, prefixQuery)

	dmi, err := reader.Search(context.Background(), req)
	if err != nil {
		return []string{}
	}

	var suggestions []string
	seen := make(map[string]struct{})

	next, err := dmi.Next()
	for err == nil && next != nil && len(suggestions) < limit {
		var title string
		next.VisitStoredFields(func(field string, value []byte) bool {
			if field == "title" {
				title = string(value)
			}
			return true
		})

		if title != "" {
			key := strings.ToLower(title)
			if _, ok := seen[key]; !ok {
				seen[key] = struct{}{}
				suggestions = append(suggestions, title)
			}
		}

		next, err = dmi.Next()
	}

	return suggestions
}

func (s *SearchService) GetStats(ctx context.Context) map[string]interface{} {
	var pagesCount int
	var indexSize int

	err := s.db.QueryRow(ctx, "SELECT COUNT(*)::int FROM pages").Scan(&pagesCount)
	if err != nil {
		pagesCount = 0
	}

	err = s.db.QueryRow(ctx, "SELECT LENGTH(index_data)::int FROM search_index WHERE id = 1").Scan(&indexSize)
	if err != nil {
		indexSize = 0
	}

	s.mu.RLock()
	count, _ := s.reader.Count()
	ready := s.indexLoaded
	s.mu.RUnlock()

	return map[string]interface{}{
		"total_pages":   pagesCount,
		"index_ready":   ready,
		"index_size":    indexSize,
		"total_indexed": count,
	}
}
