sub main()
    sleep(3000)
    print "PROBE|start"
    probeCase()
    print "PROBE|done"
    sleep(2000)
end sub

sub probeCase()
    w = 0
    while w < 2
        w = w + 1
        for i = 1 to 2
            print "PROBE|w="; w; " i="; i
            continue while
        end for
        print "PROBE|after for w="; w
    end while
    print "PROBE|after while"
end sub
