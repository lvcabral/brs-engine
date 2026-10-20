sub main(args as dynamic)
    screen = createObject("roSGScreen")
    port = createObject("roMessagePort")
    screen.setMessagePort(port)
    m.global = screen.getGlobalNode()
    m.global.addFields({ finished: false })
    m.global.observeField("finished", port)
    scene = screen.createScene("ReproScene")
    screen.show()
    while true
        msg = wait(0, port)
        if type(msg) = "roSGNodeEvent" and msg.getField() = "finished" then return
        if type(msg) = "roSGScreenEvent" and msg.isScreenClosed() then return
    end while
end sub
