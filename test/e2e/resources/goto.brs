sub main()
    counter = 0
    start:
    print "counter:"; counter
    counter++
    if counter < 2
        print "goto start"
        goto start
    else if counter = 2
        print "goto insideIf"
        goto insideif
    end if
    return
    if counter >= 5
        insideIf:
        for x = 1 to 2
            if x = 2
                goto back
            end if
            for i = 1 to 2
                print "nested:"; x; " -"; i
            end for
            back:
            if x = 2
                print "back to start"
                goto start
            end if
        end for
    end if
end sub
