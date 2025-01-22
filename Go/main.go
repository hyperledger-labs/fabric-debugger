package main

import "fmt"

func main() {
    fmt.Println("Starting the Go debugger test")

    counter := 0
    for i := 0; i < 5; i++ {
        counter++
        fmt.Println("Counter value:", counter)

        // Set a breakpoint here to step through the loop
    }

    fmt.Println("Final Counter value:", counter)
}
