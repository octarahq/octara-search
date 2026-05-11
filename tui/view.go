package tui

import (
	"context"
	"crawler/crawler"
	"fmt"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

func InitialModel(engine *crawler.Engine) Model {
	return NewModel(engine)
}

func (m Model) Init() tea.Cmd {
	return tick()
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd

	if m.InputMode {
		switch msg := msg.(type) {
		case tea.KeyMsg:
			switch msg.String() {
			case "enter":
				url := m.Input.Value()
				if url != "" {
					m.Engine.DB.PushQueue(context.Background(), url, 10)
					m.Input.SetValue("")
					m.InputMode = false
				}
			case "esc":
				m.InputMode = false
			}
		}
		m.Input, cmd = m.Input.Update(msg)
		return m, cmd
	}

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "q", "ctrl+c":
			return m, tea.Quit
		case "s":
			m.Engine.Status = crawler.StateActive
		case "x":
			m.Engine.Status = crawler.StateIdle
		case "a":
			m.InputMode = true
			m.Input.Focus()
			return m, nil
		}

	case TickMsg:
		m.TickCount++
		m.RefreshStats()

		m.Uptime = time.Since(m.StartTS)
		if m.Uptime.Seconds() > 0 {
			m.Engine.Stats.Mu.Lock()
			crawled := m.Engine.Stats.PagesCrawled
			m.Engine.Stats.Mu.Unlock()
			m.PPS = float64(crawled) / m.Uptime.Seconds()
		}

		return m, tick()
	}
	return m, nil
}

func (m Model) View() string {
	statusStr := "IDLE (En attente)"
	if m.Engine.Status == crawler.StateActive {
		statusStr = "ACTIVE (Crawl en cours...)"
	}

	s := "--- OCTARA SEARCH ENGINE CRAWLER ---\n\n"
	s += fmt.Sprintf("Statut actuel : %s\n\n", statusStr)
	m.Engine.Stats.Mu.Lock()
	pagesCrawled := m.Engine.Stats.PagesCrawled
	lastURL := m.Engine.Stats.LastURL
	lastError := m.Engine.Stats.LastError
	busyWorkersCount := len(m.Engine.Stats.BusyWorkers)
	
	workerLines := "Activités des Workers :\n"
	count := 0
	if busyWorkersCount == 0 {
		workerLines += " [Aucun worker actif]\n"
	} else {
		for id, u := range m.Engine.Stats.BusyWorkers {
			if count >= 10 {
				workerLines += fmt.Sprintf(" ... et %d autres\n", busyWorkersCount-10)
				break
			}
			displayURL := u
			if len(displayURL) > 50 {
				displayURL = displayURL[:47] + "..."
			}
			workerLines += fmt.Sprintf(" [%02d] %s\n", id, displayURL)
			count++
		}
	}
	m.Engine.Stats.Mu.Unlock()

	s += fmt.Sprintf("Pages crawlées : %d (Total DB: %d)\n", pagesCrawled, m.PagesCrawled)
	s += fmt.Sprintf("Débit : %.2f pages/sec\n", m.PPS)
	s += fmt.Sprintf("Domaines indexés : %d\n", m.UniqueDomains)
	s += fmt.Sprintf("Dernière URL : %s\n", lastURL)
	s += fmt.Sprintf("Queue (prêts)   : %d URLs / %d domaines distincts\n", m.QueueSize, m.QueueDomains)
	s += fmt.Sprintf("Queue (en attente politeness) : %d\n", m.WaitingSize)
	s += fmt.Sprintf("Workers actifs  : %d / %d\n\n", busyWorkersCount, m.Engine.MaxWorker)
	if m.LastError != "" {
		s += fmt.Sprintf("ERREUR TUI : %s\n\n", m.LastError)
	}
	if lastError != nil {
		s += fmt.Sprintf("ERREUR MOTEUR : %v\n\n", lastError)
	}

	s += workerLines
	s += "\n"

	if m.InputMode {
		s += "Ajouter une URL :\n"
		s += m.Input.View() + "\n"
		s += " [Enter] Valider | [Esc] Annuler\n"
	} else {
		s += "Commandes :\n"
		s += " [s] Start | [x] Stop | [a] Ajouter URL | [q] Quitter\n"
	}

	return s
}
