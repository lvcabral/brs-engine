sub main()
    x = true
    y = box(false)
    if not y
        print x; " "; y
        if x and y
            print "both true"
        else
            print "one false"
        end if
        if x or y
            print "one true"
        else
            print "both false"
        end if
    end if
end sub