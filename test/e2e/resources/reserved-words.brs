sub main()
    hasReservedWords = {
        createObject: true,
        in: true,
        stop: true,
        run: true,
        then: "useful for promises!"
    }

    for each word in hasReservedWords
        print word
    end for

    print "Hello from line " LINE_NUM
end sub
