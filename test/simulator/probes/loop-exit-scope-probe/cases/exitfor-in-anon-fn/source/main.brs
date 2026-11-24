sub main()
    sleep(3000)
    print "PROBE|start"
    probeCase()
    print "PROBE|done"
    sleep(2000)
end sub

sub probeCase()
    for i = 1 to 2
        f = function()
            exit for
            return 0
        end function
        print "PROBE|for i="; i
    end for
end sub
