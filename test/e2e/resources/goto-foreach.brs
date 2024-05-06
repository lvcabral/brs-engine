sub main()
    print "starting goto test"
    abort = 0
    jump = 0
    m.paused = true
    array = ["a", "b", "c", "d", "e", "f"]
    while true
        for each letter in array
            if letter = "c"
                jump++
                goto end_of_For_Loop
            end if
            abort++
            print "not jumped: "; letter
            end_of_for_loop:
            if jump = 1
                print "did jump! "; letter
                jump = -1
            else if abort > 5
                print "error: aborting"
                exit while
            end if
        end for
        if letter = "f"
            print "successful goto test!"
            exit while
        else
            print "error the for each loop was cut short!", letter
            exit while
        end if
    end while
    print "finished goto test"
end sub


