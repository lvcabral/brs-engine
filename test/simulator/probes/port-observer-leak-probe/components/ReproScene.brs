sub init()
    count = 200000
    sink = createObject("roSGNode", "Sink")
    m.global.addFields({ sink: sink })
    print "sending " ; count ; " entry writes"
    t = createObject("roTimespan")
    for i = 1 to count
        m.global.sink.entry = { "f": 1, "l": i mod 500, "r": 1 }
    end for
    print "writes done in " ; t.totalMilliseconds() ; "ms"
    m.global.sink.observeField("done", "onDone")
    m.global.sink.save = true
end sub

sub onDone()
    print "RESULT received=" ; m.global.sink.received
    m.global.finished = true
end sub
