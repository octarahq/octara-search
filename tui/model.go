package tui

import (
	"crawler/config"
	"crawler/crawler"
	"time"

	"github.com/charmbracelet/bubbles/textinput"
)

type Model struct {
	DB            *config.Database
	Status        crawler.CrawlerState
	PagesCrawled  int
	QueueSize     int
	WaitingSize   int
	ActiveWorkers int
	QueueDomains  int
	LastURL       string
	Uptime        time.Duration
	StartTS       time.Time
	LastError     string
	UniqueDomains int
	PPS           float64

	Engine    *crawler.Engine
	TickCount int

	Input     textinput.Model
	InputMode bool
}

func NewModel(engine *crawler.Engine) Model {
	ti := textinput.New()
	ti.Placeholder = "https://..."
	ti.Focus()
	ti.CharLimit = 156
	ti.Width = 40

	return Model{
		Engine:  engine,
		DB:      engine.DB,
		Status:  crawler.StateIdle,
		StartTS: time.Now(),
		Input:   ti,
	}
}

func (m *Model) RefreshStats() {
	m.Engine.Stats.Mu.Lock()
	crawled := m.Engine.Stats.PagesCrawled
	pushed := m.Engine.Stats.URLsPushed
	completed := m.Engine.Stats.URLsCompleted
	m.Engine.Stats.Mu.Unlock()

	m.PagesCrawled = m.Engine.BootStats.TotalPages + crawled
	m.QueueSize = m.Engine.BootStats.QueueSize + pushed - completed
	m.UniqueDomains = m.Engine.BootStats.UniqueDomains
	m.QueueDomains = m.Engine.BootStats.QueueDomains

	m.WaitingSize = 0
	if m.QueueSize < 0 {
		m.QueueSize = 0
	}
}
