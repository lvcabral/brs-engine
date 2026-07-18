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
    ' boxed numbers truth-test like their intrinsic value in if/while conditions
    n = box(1)
    if n then print "boxed int true"
    z = box(0)
    if z then print "wrong" else print "boxed zero false"
    while n
        print "boxed int while"
        exit while
    end while
end sub