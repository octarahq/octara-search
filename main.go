package main

import (
	"api/config"
	"api/services"
	"context"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

func main() {
	config.Init()
	services.StartScheduler()

	ctx := context.Background()

	db, err := pgx.Connect(ctx, config.GetEnv("DATABASE_URL"))
	if err != nil {
		fmt.Println("Error: Cannont connect to DB")
	}
	defer db.Close(ctx)

	searchService := services.NewSearchService(db)

	r := gin.Default()

	r.GET("/api/search", func(c *gin.Context) {
		q := c.Query("q")
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
		safe := c.DefaultQuery("safe", "moderate")

		res, err := searchService.Search(q, page, limit, safe)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, res)
	})

	r.GET("/api/search/autocomplete", func(c *gin.Context) {
		q := c.Query("q")
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "8"))

		suggestions := searchService.Autocomplete(q, limit)
		c.JSON(http.StatusOK, suggestions)
	})

	r.GET("/api/stats", func(c *gin.Context) {
		stats := searchService.GetStats(context.Background())
		if stats == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "stats unavailable"})
			return
		}
		c.JSON(http.StatusOK, stats)
	})

	r.GET("/api/news", func(c *gin.Context) {
		country := c.DefaultQuery("country", "france")

		pageStr := c.DefaultQuery("page", "1")
		limitStr := c.DefaultQuery("limit", "10")
		q := c.Query("q")

		page, err := strconv.Atoi(pageStr)
		if err != nil || page < 1 {
			page = 1
		}
		limit, err := strconv.Atoi(limitStr)
		if err != nil || limit < 1 {
			limit = 10
		}

		var articles []services.RSSResponse
		articles = services.GetNewsContry(country)

		q = strings.ToLower(q)
		var filteredArticles []services.RSSResponse

		for _, a := range articles {
			titleMatch := strings.Contains(strings.ToLower(a.Title), q)
			sourceMatch := strings.Contains(strings.ToLower(a.Source), q)

			if titleMatch || sourceMatch {
				filteredArticles = append(filteredArticles, a)
			}
		}

		total := len(filteredArticles)
		offset := (page - 1) * limit
		pagedArticles := filteredArticles[offset : offset+limit]

		var finance []services.FinancialData
		finance = services.GetFinancialData()

		c.JSON(http.StatusOK, gin.H{
			"country":       country,
			"q":             q,
			"page":          page,
			"limit":         limit,
			"total_pages":   math.Ceil(float64(total / limit)),
			"total_results": total,
			"finance":       finance,
			"articles":      pagedArticles,
		})
	})

	subService := services.NewSubdomainService(db, searchService)
	subGroup := r.Group("/api/subdomains")
	{
		subGroup.GET("/", func(c *gin.Context) {
			root := c.Query("root_domain")
			if root == "" {
				c.JSON(400, gin.H{"error": "root_domain is required"})
				return
			}
			list, _ := subService.GetSubdomains(root)
			c.JSON(200, gin.H{"subdomains": list})
		})

		subGroup.GET("/pages", func(c *gin.Context) {
			host := c.Query("host")
			exactHttp := "http://" + host
			exactHttps := "https://" + host

			rows, _ := db.Query(ctx,
				"SELECT url, title, description, crawled_at FROM pages WHERE url LIKE $1 OR url LIKE $2 OR url = $3 OR url = $4 LIMIT 100",
				"http://"+host+"/%", "https://"+host+"/%", exactHttp, exactHttps)
			defer rows.Close()

			var pages []services.PageInfo
			for rows.Next() {
				var p services.PageInfo
				rows.Scan(&p.URL, &p.Title, &p.Description, &p.CrawledAt)
				pages = append(pages, p)
			}
			c.JSON(200, gin.H{"pages": pages})
		})

		subGroup.GET("/sitemap", func(c *gin.Context) {
			host := c.Query("host")
			url, urls, err := subService.CheckSitemap(host)
			if err != nil {
				c.JSON(404, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, gin.H{"success": true, "url": url, "urls": urls})
		})

		subGroup.POST("/recrawl", func(c *gin.Context) {
			c.JSON(http.StatusNotImplemented, gin.H{"error": "this feature is in development"})
			return

			var body struct {
				Urls      []string `json:"urls"`
				Recursive bool     `json:"recursive"`
			}
			if err := c.ShouldBindJSON(&body); err != nil {
				c.JSON(400, gin.H{"error": "invalid body"})
				return
			}
			subService.SpawnCrawler(body.Urls, body.Recursive)
			c.JSON(200, gin.H{"success": true, "count": len(body.Urls)})
		})

		subGroup.DELETE("/pages", func(c *gin.Context) {
			url := c.Query("url")
			_, err := db.Exec(ctx, "DELETE FROM pages WHERE url = $1", url)
			if err != nil {
				c.JSON(500, gin.H{"error": "delete failed"})
				return
			}

			c.JSON(200, gin.H{"success": true})
		})
	}

	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "pong",
		})
	})

	port := config.GetEnv("PORT")
	r.Run(":" + port)
}
