' Launch parameters (see README): `only=<Node>.<field>` limits the render pass to that one case,
' `layout=<names>` skips to the RowList/PosterGrid layout pass with only those nodes.
sub Main(args as dynamic)
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    if args <> invalid and args.only <> invalid
        screen.getGlobalNode().addFields({ probeOnly: args.only })
    end if
    if args <> invalid and args.run <> invalid
        screen.getGlobalNode().addFields({ probeRun: args.run })
    end if
    if args <> invalid and args.layout <> invalid
        screen.getGlobalNode().addFields({ probeLayout: args.layout })
    end if
    screen.CreateScene("MainScene")
    screen.show()

    while true
        msg = wait(0, port)
        if type(msg) = "roSGScreenEvent"
            if msg.isScreenClosed() then return
        end if
    end while
end sub
