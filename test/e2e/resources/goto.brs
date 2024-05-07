sub main()
    counter = 0
    10:
    print "counter:"; counter
    counter++
    if counter < 2
        print "goto 10"
        goto 10
    else if counter = 2
        print "goto 20"
        goto 20
    end if
    return
    if counter >= 5
        20:
        for x = 1 to 2
            if x = 2
                goto 30
            end if
            for i = 1 to 2
                print "nested:"; x; " -"; i
            end for
            30:
            if x = 2
                print "back to 10"
                goto 10
            end if
        end for
    end if
end sub
