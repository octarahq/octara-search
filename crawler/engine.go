package crawler

import (
	"context"
	"crawler/config"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

type CrawlerState int

const (
	StateIdle CrawlerState = iota
	StateActive
)

type workItem struct {
	url string
}

type Engine struct {
	DB         *config.Database
	Fetcher    *Fetcher
	Politeness *PolitenessManager

	MaxWorker int
	Status    CrawlerState

	BootStats struct {
		TotalPages    int
		UniqueDomains int
		QueueSize     int
		QueueDomains  int
	}

	Stats struct {
		Mu            sync.Mutex
		PagesCrawled  int
		URLsPushed    int
		URLsCompleted int
		LastURL       string
		LastError     error
		BusyWorkers   map[int]string
		PageBySec     int
	}

	workCh chan workItem

	ctx    context.Context
	cancel context.CancelFunc
}

func NewEngine(database *config.Database, workers int) *Engine {
	ctx, cancel := context.WithCancel(context.Background())

	e := &Engine{
		DB:         database,
		Fetcher:    NewFetcher(),
		Politeness: NewPolitenessManager(2 * time.Second),
		MaxWorker:  workers,
		Status:     StateIdle,
		workCh:     make(chan workItem, workers*4),
		ctx:        ctx,
		cancel:     cancel,
	}
	e.Stats.BusyWorkers = make(map[int]string)
	e.FetchBootStats()

	if e.BootStats.QueueSize > 1200000 {
		fmt.Printf("[Engine] Startup: Queue is too large (%d), pruning to 1M...\n", e.BootStats.QueueSize)
		e.DB.PruneQueue(ctx, 1000000)
		e.FetchBootStats()
	}

	return e
}

func (e *Engine) FetchBootStats() {
	ctx := context.Background()
	e.BootStats.TotalPages = int(e.DB.GetApproxCount(ctx, "pages"))
	e.BootStats.UniqueDomains = e.DB.GetDistinctDomainsCount(ctx, "pages")
	e.BootStats.QueueSize = int(e.DB.GetApproxCount(ctx, "crawl_queue"))
	e.BootStats.QueueDomains = e.DB.GetDistinctDomainsCount(ctx, "crawl_queue")
}

func (e *Engine) Start() {
	go e.Dispatcher()
	for i := 0; i < e.MaxWorker; i++ {
		go e.Worker(i)
	}
	go e.RefreshDispatcher()
}

func (e *Engine) Dispatcher() {

	for {
		select {
		case <-e.ctx.Done():
			return
		default:
		}

		if e.Status != StateActive {
			time.Sleep(200 * time.Millisecond)
			continue
		}

		space := cap(e.workCh) - len(e.workCh)
		if space <= 0 {
			time.Sleep(10 * time.Millisecond)
			continue
		}

		candidates, err := e.DB.PopQueue(e.ctx, space)
		if err != nil {
			e.Stats.Mu.Lock()
			e.Stats.LastError = err
			e.Stats.Mu.Unlock()
			time.Sleep(500 * time.Millisecond)
			continue
		}

		if len(candidates) == 0 {
			time.Sleep(200 * time.Millisecond)
			continue
		}

		dispatched := 0
		for _, u := range candidates {
			parsedURL, _ := url.Parse(u)
			domain := parsedURL.Hostname()

			delay, ok := e.Politeness.CheckWait(domain)
			if ok && delay == 0 {
				select {
				case e.workCh <- workItem{url: u}:
					dispatched++
				default:
					e.DB.RequeueWait(e.ctx, u, time.Second)
				}
			} else {
				reqDelay := delay
				if !ok || reqDelay < 2*time.Second {
					reqDelay = 2 * time.Second
				}
				e.DB.RequeueWait(e.ctx, u, reqDelay)
			}
		}

		if dispatched == 0 {
			time.Sleep(200 * time.Millisecond)
		}
	}
}

func (e *Engine) Worker(id int) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("[Worker %d] Recovered from panic: %v\n", id, r)
			go e.Worker(id)
		}
	}()

	for {
		select {
		case <-e.ctx.Done():
			return
		case item, ok := <-e.workCh:
			if !ok {
				return
			}

			if e.Status != StateActive {
				e.DB.RequeueWait(e.ctx, item.url, time.Second)
				continue
			}

			u := item.url

			e.Stats.Mu.Lock()
			e.Stats.BusyWorkers[id] = u
			e.Stats.Mu.Unlock()

			resp, err := e.Fetcher.Fetch(u)
			if err != nil {
				e.DB.RetryEntry(e.ctx, u)
				e.Stats.Mu.Lock()
				e.Stats.LastError = fmt.Errorf("fetch failed %s: %v", u, err)
				delete(e.Stats.BusyWorkers, id)
				e.Stats.Mu.Unlock()
				continue
			}

			e.ProcessPage(resp.Request.URL.String(), resp)

			e.Stats.Mu.Lock()
			delete(e.Stats.BusyWorkers, id)
			e.Stats.Mu.Unlock()
		}
	}
}

func (e *Engine) ProcessPage(u string, resp *http.Response) {
	defer resp.Body.Close()

	contentType := strings.ToLower(resp.Header.Get("Content-Type"))
	if strings.Contains(contentType, "xml") {
		urls, err := ParseSitemap(resp.Body)
		if err != nil {
			e.DB.RetryEntry(e.ctx, u)
			e.Stats.Mu.Lock()
			e.Stats.LastError = fmt.Errorf("sitemap parse failed %s: %v", u, err)
			e.Stats.Mu.Unlock()
			return
		}
		pushed := 0
		for _, surl := range urls {
			var lastmod interface{}
			if surl.LastMod != "" {
				layouts := []string{time.RFC3339, "2006-01-02", "2006-01-02T15:04:05Z07:00"}
				for _, layout := range layouts {
					if t, err := time.Parse(layout, surl.LastMod); err == nil {
						lastmod = t
						break
					}
				}
			}
			if err := e.DB.RequeueFromSitemap(e.ctx, surl.Loc, lastmod); err == nil {
				pushed++
			}
		}
		e.Stats.Mu.Lock()
		e.Stats.URLsPushed += pushed
		e.Stats.URLsCompleted++
		e.Stats.Mu.Unlock()

		e.DB.CompleteEntry(e.ctx, u)
		return
	}

	data, links, sitemaps, err := ParseHTML(u, resp.Body)
	if err != nil {
		e.DB.RetryEntry(e.ctx, u)
		e.Stats.Mu.Lock()
		e.Stats.LastError = fmt.Errorf("parse failed %s: %v", u, err)
		e.Stats.Mu.Unlock()
		return
	}

	if err = e.DB.SavePage(e.ctx, data); err != nil {
		e.DB.RetryEntry(e.ctx, u)
		e.Stats.Mu.Lock()
		e.Stats.LastError = fmt.Errorf("save failed %s: %v", u, err)
		e.Stats.Mu.Unlock()
		return
	}

	pushed := 0
	for _, link := range links {
		if err := e.DB.PushQueue(e.ctx, link, 0); err == nil {
			pushed++
		}
	}
	for _, smap := range sitemaps {
		if err := e.DB.PushQueue(e.ctx, smap, 5); err == nil {
			pushed++
		}
	}

	e.Stats.Mu.Lock()
	e.Stats.PagesCrawled++
	e.Stats.URLsPushed += pushed
	e.Stats.URLsCompleted++
	e.Stats.LastURL = u
	e.Stats.Mu.Unlock()

	e.DB.CompleteEntry(e.ctx, u)
}

func (e *Engine) RefreshDispatcher() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-e.ctx.Done():
			return
		case <-ticker.C:
			if e.Status == StateActive {
				e.DB.RequeueExpiredPages(e.ctx, "30 days")

				count := e.DB.GetApproxCount(e.ctx, "crawl_queue")
				if count > 1000000 {
					fmt.Printf("[Engine] Queue too large (%d), pruning to 1M...\n", count)
					e.DB.PruneQueue(e.ctx, 1000000)
				}
			}
		}
	}
}
