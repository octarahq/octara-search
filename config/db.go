package config

import (
	"context"
	"fmt"
	urlpkg "net/url"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Database struct {
	Pool *pgxpool.Pool
}

type PageData struct {
	URL         string
	Title       string
	Description string
	Snippet     string
	ContentHash string
	Language    string
	NSFW        bool
}

func Connect(ctx context.Context, connString string) (*Database, error) {
	pool, err := pgxpool.New(ctx, connString)
	if err != nil {
		return nil, fmt.Errorf("unable to connect to database: %v", err)
	}
	return &Database{Pool: pool}, nil
}

func (db *Database) PushQueue(ctx context.Context, url string, priority int) error {
	domain := ""
	if u, err := urlpkg.Parse(url); err == nil {
		domain = u.Hostname()
	}

	count := db.GetApproxCount(ctx, "crawl_queue")
	if count > 1000000 {
		if priority <= 5 {
			return nil
		}
	}

	query := `
		INSERT INTO crawl_queue (url, domain, priority, status, next_attempt_at, attempts)
		SELECT $1, $2, $3, 'pending', NOW(), 0
		WHERE NOT EXISTS (SELECT 1 FROM pages WHERE url = $1)
		ON CONFLICT (url) DO NOTHING`
	_, err := db.Pool.Exec(ctx, query, url, domain, priority)
	return err
}

func (db *Database) PopQueue(ctx context.Context, limit int) ([]string, error) {
	query := `
		UPDATE crawl_queue
		SET status = 'processing', last_attempt_at = NOW()
		WHERE id IN (
			SELECT id FROM (
				SELECT DISTINCT ON (domain) id
				FROM crawl_queue
				WHERE status = 'pending' 
				  AND next_attempt_at <= NOW() 
				  AND attempts < 5
				ORDER BY domain, priority DESC
				LIMIT 2000 -- Sample size for diversity
			) sample
			ORDER BY RANDOM() -- Shuffle the diverse domains
			LIMIT $1
		)
		AND status = 'pending'
		RETURNING url`

	rows, err := db.Pool.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var urls []string
	for rows.Next() {
		var u string
		if err := rows.Scan(&u); err != nil {
			return nil, err
		}
		urls = append(urls, u)
	}
	return urls, nil
}

func (db *Database) CompleteEntry(ctx context.Context, url string) error {
	_, err := db.Pool.Exec(ctx, "DELETE FROM crawl_queue WHERE url = $1", url)
	return err
}

func (db *Database) RetryEntry(ctx context.Context, url string) error {
	query := `
		UPDATE crawl_queue
		SET 
			status = 'pending',
			next_attempt_at = CASE 
				WHEN attempts = 0 THEN NOW() + INTERVAL '1 minute'
				WHEN attempts = 1 THEN NOW() + INTERVAL '10 minutes'
				WHEN attempts = 2 THEN NOW() + INTERVAL '1 hour'
				WHEN attempts = 3 THEN NOW() + INTERVAL '24 hours'
				ELSE NOW() + INTERVAL '100 years'
			END,
			attempts = attempts + 1
		WHERE url = $1`
	_, err := db.Pool.Exec(ctx, query, url)
	return err
}

func (db *Database) RequeueWait(ctx context.Context, url string, delay time.Duration) error {
	query := `
		UPDATE crawl_queue
		SET status = 'pending',
		    next_attempt_at = NOW() + $2::interval
		WHERE url = $1`
	_, err := db.Pool.Exec(ctx, query, url, fmt.Sprintf("%d seconds", int(delay.Seconds())))
	return err
}

func (db *Database) SavePage(ctx context.Context, data PageData) error {
	domain := ""
	if u, err := urlpkg.Parse(data.URL); err == nil {
		domain = u.Hostname()
	}

	query := `
		INSERT INTO pages (
			url, 
			domain,
			title, 
			description, 
			snippet,
			content_hash, 
			language,
			nsfw,
			crawled_at,
			search_vector
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(),
			to_tsvector('simple',
				coalesce($3, '') || ' ' ||
				coalesce($4, '') || ' ' ||
				coalesce($1, '')
			)
		)
		ON CONFLICT (url) DO UPDATE SET
			title = EXCLUDED.title,
			description = EXCLUDED.description,
			snippet = EXCLUDED.snippet,
			content_hash = EXCLUDED.content_hash,
			language = EXCLUDED.language,
			nsfw = EXCLUDED.nsfw,
			crawled_at = NOW(),
			search_vector = to_tsvector('simple',
				coalesce(EXCLUDED.title, '') || ' ' ||
				coalesce(EXCLUDED.description, '') || ' ' ||
				coalesce(EXCLUDED.url, '')
			);
	`

	_, err := db.Pool.Exec(ctx, query,
		data.URL,
		domain,
		data.Title,
		data.Description,
		data.Snippet,
		data.ContentHash,
		data.Language,
		data.NSFW,
	)

	if err != nil {
		return fmt.Errorf("failed to save page: %v", err)
	}
	return nil
}
func (db *Database) RequeueFromSitemap(ctx context.Context, url string, lastmod interface{}) error {
	query := `
		INSERT INTO crawl_queue (url, priority, status, next_attempt_at, attempts)
		VALUES ($1, 10, 'pending', NOW(), 0)
		ON CONFLICT (url) DO UPDATE SET
			priority = 10,
			status = 'pending',
			next_attempt_at = NOW(),
			attempts = 0
		WHERE 
			(EXISTS (SELECT 1 FROM pages WHERE url = $1 AND crawled_at < $2)) -- Sitemap says it's newer
			OR 
			(EXISTS (SELECT 1 FROM pages WHERE url = $1 AND crawled_at < NOW() - INTERVAL '1 week')) -- Older than 1 week
			OR 
			(NOT EXISTS (SELECT 1 FROM pages WHERE url = $1)) -- New URL`
	_, err := db.Pool.Exec(ctx, query, url, lastmod)
	return err
}

func (db *Database) InitDB(ctx context.Context) error {
	queries := []string{
		`ALTER TABLE crawl_queue ADD COLUMN IF NOT EXISTS url TEXT`,
		`CREATE UNIQUE INDEX IF NOT EXISTS crawl_queue_url_key ON crawl_queue (url)`,
		`ALTER TABLE crawl_queue ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending'`,
		`ALTER TABLE crawl_queue ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0`,
		`ALTER TABLE crawl_queue ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`,
		`ALTER TABLE crawl_queue ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMP WITH TIME ZONE`,
		`ALTER TABLE crawl_queue ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0`,
		`ALTER TABLE crawl_queue ADD COLUMN IF NOT EXISTS added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`,

		`ALTER TABLE pages ALTER COLUMN url TYPE TEXT`,
		`ALTER TABLE pages ALTER COLUMN title TYPE TEXT`,
		`ALTER TABLE pages ALTER COLUMN description TYPE TEXT`,
		`ALTER TABLE pages ALTER COLUMN content_hash TYPE VARCHAR(64)`,
		`ALTER TABLE pages ADD COLUMN IF NOT EXISTS snippet TEXT`,
		`ALTER TABLE pages ADD COLUMN IF NOT EXISTS language VARCHAR(10)`,
		`ALTER TABLE pages ADD COLUMN IF NOT EXISTS nsfw BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE pages ADD COLUMN IF NOT EXISTS crawled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`,
		`ALTER TABLE crawl_queue ADD COLUMN IF NOT EXISTS domain TEXT`,
		`CREATE INDEX IF NOT EXISTS crawl_queue_domain_idx ON crawl_queue (domain)`,
		`ALTER TABLE pages ADD COLUMN IF NOT EXISTS domain TEXT`,
		`CREATE INDEX IF NOT EXISTS pages_domain_idx ON pages (domain)`,

		`CREATE INDEX IF NOT EXISTS crawl_queue_pop_v3_idx ON crawl_queue (status, next_attempt_at) WHERE status = 'pending'`,
		`CREATE INDEX IF NOT EXISTS crawl_queue_domain_priority_idx ON crawl_queue (domain, priority DESC)`,
		`CREATE INDEX IF NOT EXISTS crawl_queue_prune_idx ON crawl_queue (priority, added_at)`,
	}
	for _, q := range queries {
		_, err := db.Pool.Exec(ctx, q)
		if err != nil {
			fmt.Printf("InitDB warning on query %s: %v\n", q, err)
		}
	}

	db.Pool.Exec(ctx, "UPDATE crawl_queue SET status = 'pending' WHERE status IS NULL")
	db.Pool.Exec(ctx, "UPDATE crawl_queue SET attempts = 0 WHERE attempts IS NULL")
	db.Pool.Exec(ctx, "UPDATE crawl_queue SET next_attempt_at = NOW() WHERE next_attempt_at IS NULL")
	db.Pool.Exec(ctx, "UPDATE crawl_queue SET priority = 0 WHERE priority IS NULL")

	return nil
}

func (db *Database) RequeueExpiredPages(ctx context.Context, interval string) (int64, error) {
	query := `
		INSERT INTO crawl_queue (url, priority, status, next_attempt_at, attempts)
		SELECT url, 1, 'pending', NOW(), 0
		FROM pages
		WHERE crawled_at < NOW() - $1::interval
		ON CONFLICT (url) DO NOTHING`
	tag, err := db.Pool.Exec(ctx, query, interval)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

func (db *Database) InitSearchIndex(ctx context.Context) error {
	setup := []string{
		`ALTER TABLE pages ADD COLUMN IF NOT EXISTS search_vector tsvector`,
		`CREATE INDEX IF NOT EXISTS pages_search_vector_idx ON pages USING GIN(search_vector)`,
	}
	for _, q := range setup {
		if _, err := db.Pool.Exec(ctx, q); err != nil {
			fmt.Printf("[SearchIndex] Warning: %v\n", err)
		}
	}

	_, err := db.Pool.Exec(ctx, `
		UPDATE pages
		SET search_vector = to_tsvector('simple',
			coalesce(title, '') || ' ' ||
			coalesce(description, '') || ' ' ||
			coalesce(url, '')
		)
		WHERE search_vector IS NULL`)
	if err != nil {
		fmt.Printf("[SearchIndex] Backfill warning: %v\n", err)
	} else {
		fmt.Println("[SearchIndex] search_vector column and GIN index ready.")
	}
	return nil
}

func (db *Database) GetApproxCount(ctx context.Context, table string) int64 {
	var count int64
	query := fmt.Sprintf("SELECT reltuples::bigint FROM pg_class WHERE relname = '%s'", table)
	db.Pool.QueryRow(ctx, query).Scan(&count)
	return count
}

func (db *Database) GetDistinctDomainsCount(ctx context.Context, table string) int {
	var count int
	query := fmt.Sprintf("SELECT COUNT(DISTINCT domain) FROM %s", table)
	db.Pool.QueryRow(ctx, query).Scan(&count)
	return count
}

func (db *Database) PruneQueue(ctx context.Context, maxItems int) (int64, error) {
	query := `
		DELETE FROM crawl_queue 
		WHERE id IN (
			SELECT id FROM crawl_queue
			ORDER BY priority ASC, added_at ASC
			LIMIT (SELECT GREATEST(0, COUNT(*) - $1) FROM crawl_queue)
		)`
	tag, err := db.Pool.Exec(ctx, query, maxItems)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}
