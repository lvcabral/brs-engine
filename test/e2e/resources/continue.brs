sub main()
	for x = 1 to 5
		if x = 3
			continue for
		end if
		? x
	end for
	for x  = 5 to 1 step -1
		if x = 3
			continue for
		end if
		? x
	end for
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