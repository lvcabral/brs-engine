sub main()
    hasReservedWords = {
        createObject: true,
        in: true,
        stop: true,
        run: true
    }

    for each word in hasReservedWords
        print word
    end for
end sub