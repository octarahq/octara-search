package main

import (
	"context"
	"crawler/config"
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	ctx := context.Background()
	database, err := config.Connect(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("Error: Cannot connect to DB: %v", err)
	}
	defer database.Pool.Close()

	fmt.Println("[Indexer] Backfilling search_vector for all pages...")

	if err := database.InitSearchIndex(ctx); err != nil {
		log.Fatalf("Failed: %v", err)
	}

	fmt.Println("[Indexer] Done.")
}
