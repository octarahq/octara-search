package main

import (
	"api/config"
	"api/services"
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

func main() {
	config.Init()
	services.StartScheduler()

	r := gin.Default()

	r.GET("/news", func(c *gin.Context) {
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

	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "pong",
		})
	})

	port := config.GetEnv("PORT")
	r.Run(":" + port)
}
