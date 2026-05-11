package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

func Init() {
	err := godotenv.Load()
	if err != nil {
		fmt.Println("Error: cannot load env file")
	}
}

func GetEnv(key string) string {
	value, ok := os.LookupEnv(key)

	if ok {
		return value
	}

	return ""
}
