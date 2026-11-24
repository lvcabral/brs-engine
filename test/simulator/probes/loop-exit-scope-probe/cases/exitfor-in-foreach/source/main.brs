sub main()
    sleep(3000)
    print "PROBE|start"
    probeCase()
    print "PROBE|done"
    sleep(2000)
end sub

sub probeCase()
    for each v in [1, 2]
        print "PROBE|each v="; v
        exit for
    end for
    print "PROBE|after for each"
end sub
