sub main()
    sleep(4000)
    print "PROBE|start"
    print "PROBE|result|"; stray()
    print "PROBE|done"
    sleep(2000)
end sub

function stray() as integer
    exit while
    return 1
end function
