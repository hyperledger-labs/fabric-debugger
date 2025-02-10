package main

import "fmt"

func main() {
    fmt.Println("Starting the Go debugger test")

    counter := 0  
    
    for i := 0; i < 5; i++ {
        counter++
        fmt.Printf("Counter value at iteration %d: %d\n", i, counter)
    }

    fmt.Println("Final Counter value:", counter)
}
