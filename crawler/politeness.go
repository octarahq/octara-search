package crawler

import (
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/temoto/robotstxt"
	"golang.org/x/time/rate"
)

type PolitenessManager struct {
	limiters     map[string]*rate.Limiter
	robotsCache  map[string]robotstxt.RobotsData
	mu           sync.Mutex
	defaultDelay time.Duration
}

func NewPolitenessManager(delay time.Duration) *PolitenessManager {
	return &PolitenessManager{
		limiters:     make(map[string]*rate.Limiter),
		robotsCache:  make(map[string]robotstxt.RobotsData),
		defaultDelay: delay,
	}
}

func (p *PolitenessManager) CheckWait(domain string) (time.Duration, bool) {
	p.mu.Lock()
	limiter, exist := p.limiters[domain]
	if !exist {
		limiter = rate.NewLimiter(rate.Every(p.defaultDelay), 1)
		p.limiters[domain] = limiter
	}
	p.mu.Unlock()

	r := limiter.Reserve()
	if !r.OK() {
		return 0, false
	}

	delay := r.Delay()
	if delay > 0 {
		r.Cancel()
		return delay, false
	}

	return 0, true
}

func (p *PolitenessManager) IsAllowed(urlStr string) bool {
	u, _ := url.Parse(urlStr)
	domain := u.Hostname()

	p.mu.Lock()
	data, exists := p.robotsCache[domain]
	p.mu.Unlock()

	if !exists {
		robots := fetchRobots(domain)
		p.robotsCache[domain] = robots
		data = robots
	}

	return data.TestAgent(urlStr, "OctaraBot")
}

func fetchRobots(domain string) robotstxt.RobotsData {
	client := &http.Client{Timeout: 5 * time.Second}
	urls := []string{"https://" + domain + "/robots.txt", "http://" + domain + "/robots.txt"}

	for _, u := range urls {
		resp, err := client.Get(u)
		if err != nil || resp == nil {
			continue
		}
		rd, err := robotstxt.FromResponse(resp)
		resp.Body.Close()
		if err == nil && rd != nil {
			return *rd
		}
	}

	return robotstxt.RobotsData{}
}
