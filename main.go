package main

import (
	"context"
	"crawler/config"
	"crawler/crawler"
	"crawler/tui"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/ssh"
	"github.com/charmbracelet/wish"
	bm "github.com/charmbracelet/wish/bubbletea"
	"github.com/joho/godotenv"
)

var host string = "0.0.0.0"
var port int = 4047

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	reindex := flag.Bool("reindex", false, "Backfill search_vector for all pages and exit")
	flag.Parse()

	ctx := context.Background()
	database, err := config.Connect(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("Could not connect to database: %v", err)
	}

	if err := database.InitDB(ctx); err != nil {
		log.Printf("Warning: InitDB failed: %v", err)
	}

	if err := database.InitSearchIndex(ctx); err != nil {
		log.Printf("Warning: InitSearchIndex failed: %v", err)
	}

	if *reindex {
		fmt.Println("[Reindex] Done — all existing pages now have a search_vector.")
		return
	}

	engine := crawler.NewEngine(database, 100)
	go engine.Start()

	s, err := wish.NewServer(
		wish.WithAddress(fmt.Sprintf("%s:%d", host, port)),
		wish.WithHostKeyPath(".ssh/id_ed25519"),
		wish.WithMiddleware(
			bm.Middleware(func(s ssh.Session) (tea.Model, []tea.ProgramOption) {
				return tui.InitialModel(engine), []tea.ProgramOption{tea.WithAltScreen()}
			}),
		),
	)
	if err != nil {
		log.Fatalln(err)
	}

	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	log.Printf("Starting SSH server on %s:%d", host, port)
	go func() {
		if err = s.ListenAndServe(); err != nil {
			log.Fatalln(err)
		}
	}()

	<-done
	log.Println("Stopping SSH server...")
	s.Shutdown(context.Background())
}
