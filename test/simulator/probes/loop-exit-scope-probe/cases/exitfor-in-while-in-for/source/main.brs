sub main()
    sleep(3000)
    print "PROBE|start"
    probeCase()
    print "PROBE|done"
    sleep(2000)
end sub

sub probeCase()
    for i = 1 to 2
        w = 0
        while w < 2
            w = w + 1
            print "PROBE|i="; i; " w="; w
            exit for
        end while
        print "PROBE|after while i="; i
    end for
    print "PROBE|after for"
end sub
