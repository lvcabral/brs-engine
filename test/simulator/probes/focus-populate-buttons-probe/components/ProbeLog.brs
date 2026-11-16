' Shared trace helper: one monotonic sequence across every component.
sub plog(caseName as string, eventName as string, detail = "" as string)
    seq = m.global.seq + 1
    m.global.seq = seq
    s = seq.toStr()
    while len(s) < 3
        s = "0" + s
    end while
    print "PROBE|" + s + "|" + caseName + "|" + eventName + "|" + detail
end sub
