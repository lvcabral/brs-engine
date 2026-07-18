sub Main()
    ' Join on an array with a non-string element warns with the source location.
    mixed = ["a", 1, "c"]
    print "join result: [" mixed.join(",") "]"

    ' Sort with invalid flags warns with the source location.
    letters = ["b", "a", "c"]
    letters.sort("x")

    ' SortBy with invalid flags warns with the source location.
    items = [{ name: "b" }, { name: "a" }]
    items.sortBy("name", "x")

    print "done"
end sub
