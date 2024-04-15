sub main()
	fruits = ["orange", "lemon", "lime"]
	for each fruit in fruits
		if fruit = "lemon"
            continue for
        end if
		? fruit
	end for

	counter = 0
	while counter < 3
		if counter = 1
			counter++
			continue while
		end if
		? counter
		counter++
	end while
end sub