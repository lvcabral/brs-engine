sub main()
    ' Simple Loop
    fruits = ["orange", "lemon", "lime"]
	for each fruit in fruits
		? fruit
	end for
    ' Nested Loop
    animals = ["dog", "cat", "bird"]
    for each animal in animals
        for each fruit in fruits
            ? animal; " eats "; fruit
        end for
    end for
    ' Nested Loop with Same Collection
    for each animal1 in animals
        for each animal2 in animals
            ? animal1; " likes "; animal2
        end for
    end for
    print animals.isNext()
    ' Using Associative Array
    person = { name: "Alice", age: 30, city: "Wonderland" }
    for each key in person
        ? key; ": "; person[key]
    end for
end sub