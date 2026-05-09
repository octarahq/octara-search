package services

import (
	"api/config"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/mmcdole/gofeed"
	"github.com/redis/go-redis/v9"
	"github.com/robfig/cron/v3"
)

type NewsSource struct {
	Name string `json:"name"`
	Url  string `json:"url"`
}
type NewsSourceList map[string][]NewsSource

var emptyNewsSource = map[string][]NewsSource{}

type FinancialData struct {
	Name   string `json:"name"`
	Value  string `json:"value"`
	Change string `json:"change"`
}
type Symbol struct {
	Name   string
	Symbol string
	Type   string
	Unit   string
}

type YahooFinanceResponse struct {
	Chart struct {
		Result []struct {
			Meta struct {
				RegularMarketPrice float64 `json:"regularMarketPrice"`
				ChartPreviousClose float64 `json:"chartPreviousClose"`
			} `json:"meta"`
		} `json:"result"`
	} `json:"chart"`
}

var (
	NewsSourcePath = "../data/news_sources.json"
	rds            *redis.Client
	rssParser      = gofeed.NewParser()
	ctx            = context.Background()
)

func connectRedis() {
	url := config.GetEnv("REDIS_URL")
	pass := config.GetEnv("REDIS_PASSWORD")

	fmt.Printf("[Redis] Tentative de connexion à %s\n", url)

	rds = redis.NewClient(&redis.Options{
		Addr:     url,
		Password: pass,
		DB:       0,
	})

	if err := rds.Ping(ctx).Err(); err != nil {
		fmt.Printf("[Redis] Erreur: %v\n", err)
	}
}

func GetNewsSource() (NewsSourceList, error) {
	file, err := os.Open(NewsSourcePath)
	if err != nil {
		return emptyNewsSource, errors.New("Error while getting news source")
	}
	defer file.Close()

	byteValue, err := io.ReadAll(file)
	if err != nil {
		return emptyNewsSource, errors.New("Error while parsing news source")
	}

	var sources NewsSourceList

	err = json.Unmarshal(byteValue, &sources)
	if err != nil {
		return emptyNewsSource, errors.New("Error unmarshalling JSON : " + err.Error())
	}

	return sources, nil
}

type RSSResponse struct {
	Source         string `json:"source"`
	Title          string `json:"title"`
	Url            string `json:"url"`
	PubDate        string `json:"pubDate"`
	Image          string `json:"image"`
	ContentSnippet string `json:"contentSnippet"`
	Category       string `json:"category"`
}

func ParseRSSUrl(url string) (RSSResponse, error) {
	feed, err := rssParser.ParseURL(url)
	if err != nil {
		return RSSResponse{}, err
	}

	image := ""
	if feed.Image != nil {
		image = feed.Image.URL
	}

	source := ""
	if feed.Author != nil {
		source = feed.Author.Name
	}

	return RSSResponse{
		Source:         source,
		Title:          feed.Title,
		Url:            feed.Link,
		PubDate:        feed.Published,
		Image:          image,
		ContentSnippet: feed.Description,
		Category:       "Général",
	}, nil
}

func UpdateNewsForContry(country string, feeds []NewsSource) {
	uniqueArticles := make(map[string]RSSResponse)

	for _, source := range feeds {
		feed, err := rssParser.ParseURL(source.Url)
		if err != nil {
			continue
		}

		for _, item := range feed.Items {
			if item.Link == "" {
				continue
			}

			pubDate := ""
			if item.PublishedParsed != nil {
				pubDate = item.PublishedParsed.Format(time.RFC3339)
			}

			img := ""
			if len(item.Enclosures) > 0 {
				img = item.Enclosures[0].URL
			}

			uniqueArticles[item.Link] = RSSResponse{
				Source:         source.Name,
				Title:          item.Title,
				Url:            item.Link,
				PubDate:        pubDate,
				Image:          img,
				ContentSnippet: item.Description,
				Category:       "Général",
			}
		}
	}

	articles := []RSSResponse{}

	for _, art := range uniqueArticles {
		articles = append(articles, art)
	}

	sort.Slice(articles, func(i, j int) bool {
		t1, err1 := time.Parse(time.RFC3339, articles[i].PubDate)
		t2, err2 := time.Parse(time.RFC3339, articles[j].PubDate)
		if err1 != nil || err2 != nil {
			return articles[i].PubDate > articles[j].PubDate
		}

		return t1.After(t2)
	})

	if len(articles) > 400 {
		articles = articles[:400]
	}

	if len(articles) > 0 {
		jsonData, err := json.Marshal(articles)
		if err != nil {
			fmt.Printf("Error redis: cannot marshal articles for %s: %v\n", country, err)
			return
		}

		key := fmt.Sprintf("news:articles:%s", strings.ToLower(country))

		err = rds.Set(ctx, key, jsonData, 0).Err()
		if err != nil {
			fmt.Printf("Error redis: cannot save %s: %v\n", country, err)
		}
	}
}

func StartScheduler() {
	connectRedis()
	c := cron.New()

	_, err := c.AddFunc("*/30 * * * *", func() {
		err := FullRefresh()
		if err != nil {
			fmt.Println("Error cron:", err)
			return
		}
	})

	if err != nil {
		fmt.Println("Error cron:", err)
		return
	}

	c.Start()
}

func FullRefresh() error {
	sources, err := GetNewsSource()
	if err != nil {
		return err
	}

	for contry, feeds := range sources {
		UpdateNewsForContry(contry, feeds)
	}

	return nil
}

func GetNewsContry(country string) []RSSResponse {
	if rds == nil {
		return []RSSResponse{}
	}

	key := fmt.Sprintf("news:articles:%s", strings.ToLower(country))
	data, err := rds.Get(ctx, key).Result()
	if err != nil {
		return []RSSResponse{}
	}

	var articles []RSSResponse
	err = json.Unmarshal([]byte(data), &articles)
	if err != nil {
		fmt.Println("Error unmarshaling news data:", err)
		return []RSSResponse{}
	}

	return articles
}

func FetchSymbol(symbol Symbol) FinancialData {
	client := &http.Client{Timeout: 10 * time.Second}

	req, _ := http.NewRequest("GET", fmt.Sprintf("https://query1.finance.yahoo.com/v8/finance/chart/%s", symbol.Symbol), nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	resp, err := client.Do(req)
	if err != nil {
		return FinancialData{Name: symbol.Name, Value: "N/A", Change: "0%"}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return FinancialData{Name: symbol.Name, Value: "N/A", Change: "0%"}
	}

	var yahooData YahooFinanceResponse
	if err := json.NewDecoder(resp.Body).Decode(&yahooData); err != nil {
		return FinancialData{Name: symbol.Name, Value: "Parse Err", Change: "0%"}
	}

	if len(yahooData.Chart.Result) == 0 {
		return FinancialData{Name: symbol.Name, Value: "No Data", Change: "0%"}
	}

	meta := yahooData.Chart.Result[0].Meta
	price := meta.RegularMarketPrice
	prevClose := meta.ChartPreviousClose

	changePercent := 0.0
	if prevClose != 0 {
		changePercent = ((price - prevClose) / prevClose) * 100
	}

	return FinancialData{
		Name:   symbol.Name,
		Value:  fmt.Sprintf("%.2f", price),
		Change: fmt.Sprintf("%+.2f%%", changePercent),
	}
}

func GetFinancialData() []FinancialData {
	var data []FinancialData

	if rds != nil {
		key := "news:finance:data"
		cache, err := rds.Get(ctx, key).Result()
		if err == nil {
			err = json.Unmarshal([]byte(cache), &data)
			if err == nil {
				return data
			}
		}
	}

	symbols := []Symbol{
		{Name: "S&P 500", Symbol: "^GSPC", Type: "index", Unit: ""},
		{Name: "NASDAQ", Symbol: "^IXIC", Type: "index", Unit: ""},
		{Name: "CAC 40", Symbol: "^FCHI", Type: "index", Unit: ""},
		{Name: "DAX", Symbol: "^GDAXI", Type: "index", Unit: ""},
		{Name: "BTC", Symbol: "BTC-EUR", Type: "currency", Unit: "EUR"},
		{Name: "ETH", Symbol: "ETH-EUR", Type: "currency", Unit: "EUR"},
		{Name: "SOL", Symbol: "SOL-EUR", Type: "currency", Unit: "EUR"},
		{Name: "XRP", Symbol: "XRP-EUR", Type: "currency", Unit: "EUR"},
		{Name: "AAPL", Symbol: "AAPL", Type: "currency", Unit: "USD"},
		{Name: "NVDA", Symbol: "NVDA", Type: "currency", Unit: "USD"},
		{Name: "TSLA", Symbol: "TSLA", Type: "currency", Unit: "USD"},
		{Name: "MSFT", Symbol: "MSFT", Type: "currency", Unit: "USD"},
		{Name: "EUR/USD", Symbol: "EURUSD=X", Type: "forex", Unit: ""},
		{Name: "EUR/GBP", Symbol: "EURGBP=X", Type: "forex", Unit: ""},
		{Name: "GOLD", Symbol: "GC=F", Type: "currency", Unit: "USD"},
		{Name: "OIL", Symbol: "CL=F", Type: "currency", Unit: "USD"},
	}

	for _, symbol := range symbols {
		data = append(data, FetchSymbol(symbol))
	}

	if rds != nil {
		if payload, err := json.Marshal(data); err == nil {
			_ = rds.Set(ctx, "news:finance:data", payload, 0).Err()
		}
	}

	return data
}
