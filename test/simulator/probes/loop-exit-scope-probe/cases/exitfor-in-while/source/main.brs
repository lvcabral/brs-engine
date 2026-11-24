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
        print "PROBE|while w="; w
        exit for
    end while
end sub
