sub main()
    sleep(3000)
    print "PROBE|start"
    probeCase()
    print "PROBE|done"
    sleep(2000)
end sub

sub probeCase()
    for i = 1 to 2
        print "PROBE|for i="; i
        continue while
    end for
end sub
