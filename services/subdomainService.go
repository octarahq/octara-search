package services

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os/exec"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type Subdomain struct {
	ID         int       `json:"id"`
	Subdomain  string    `json:"subdomain"`
	RootDomain string    `json:"root_domain"`
	CreatedAt  time.Time `json:"created_at"`
	HasSitemap *bool     `json:"has_sitemap"`
}

type PageInfo struct {
	URL         string    `json:"url"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	CrawledAt   time.Time `json:"crawled_at"`
}

type SubdomainService struct {
	db            *pgx.Conn
	searchService *SearchService
}

func NewSubdomainService(db *pgx.Conn, ss *SearchService) *SubdomainService {
	return &SubdomainService{db: db, searchService: ss}
}

func (s *SubdomainService) GetSubdomains(root string) ([]Subdomain, error) {
	rows, err := s.db.Query(context.Background(),
		"SELECT id, subdomain, created_at, has_sitemap FROM subdomains WHERE root_domain = $1 ORDER BY created_at DESC",
		root)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Subdomain
	for rows.Next() {
		var sub Subdomain
		err := rows.Scan(&sub.ID, &sub.Subdomain, &sub.CreatedAt, &sub.HasSitemap)
		if err != nil {
			continue
		}
		list = append(list, sub)
	}
	return list, nil
}

func (s *SubdomainService) CheckSitemap(host string) (string, []string, error) {
	parts := strings.Split(host, ".")
	root := strings.Join(parts[len(parts)-2:], ".")

	urlsToTry := []string{
		"https://" + host + "/sitemap.xml",
		"http://" + host + "/sitemap.xml",
		"https://" + host + "/sitemap_index.xml",
	}

	client := &http.Client{Timeout: 10 * time.Second}
	var foundUrls []string
	var foundAt string

	for _, u := range urlsToTry {
		req, _ := http.NewRequest("GET", u, nil)
		req.Header.Set("User-Agent", "OctaraBot/1.0")
		resp, err := client.Do(req)
		if err == nil && resp.StatusCode == 200 {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()

			re := regexp.MustCompile(`<loc>(.*?)</loc>`)
			matches := re.FindAllStringSubmatch(string(body), -1)
			for _, m := range matches {
				foundUrls = append(foundUrls, m[1])
			}

			if len(foundUrls) > 0 {
				foundAt = u
				s.db.Exec(context.Background(), "UPDATE subdomains SET has_sitemap = true WHERE root_domain = $1 AND subdomain = $2", root, host)
				return foundAt, foundUrls, nil
			}
		}
	}

	s.db.Exec(context.Background(), "UPDATE subdomains SET has_sitemap = false WHERE root_domain = $1 AND subdomain = $2", root, host)
	return "", nil, fmt.Errorf("sitemap not found")
}

func (s *SubdomainService) SpawnCrawler(urls []string, recursive bool) {
	args := []string{"run", "start", "--", "--worker", "--urls=" + strings.Join(urls, ",")}
	if !recursive {
		args = append(args, "--norecurse")
	}

	cmd := exec.Command("npm", args...)
	cmd.Dir = "../crawler"
	err := cmd.Start()
	if err != nil {
		fmt.Printf("Failed to spawn crawler: %v\n", err)
	}

	go cmd.Wait()
}
