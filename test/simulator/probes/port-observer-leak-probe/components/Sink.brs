sub init()
    m.port = createObject("roMessagePort")
    m.top.observeFieldScoped("entry", m.port)
    m.top.observeFieldScoped("save", m.port)
    m.top.functionName = "runTask"
    m.top.control = "RUN"
end sub

sub runTask()
    received = 0
    while true
        msg = wait(0, m.port)
        if msg.getField() = "save" then
            while wait(3, m.port) <> invalid
                received++
            end while
            print "saving, received " ; received
            m.top.received = received
            m.top.done = true
            return
        end if
        received++
    end while
end sub
