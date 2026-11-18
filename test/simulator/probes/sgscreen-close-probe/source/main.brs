' roSGScreen Close Probe - entry point.
'
' What keeps running after roSGScreen.close(), and how an app continues on an roScreen or a second roSGScreen.
' The launch parameter `mode` picks the scenario (see README.md; drive.sh answers the PROBE|<seq>|await| lines):
'
'     solo            close() with no other screen, then heartbeat until the app ends
'     roscreen-after  close(), then create an roScreen right away
'     roscreen-before create an roScreen while the roSGScreen is shown, then close() the roSGScreen; no node
'                     reads until the end (each one is marked, as one may block)
'     sgscreen-after  close(), then create a second roSGScreen right away
'
' Trace record shape:
'
'     PROBE|<seq>|<phase>|<case>|<key=value ...>
sub Main(args as object)
    print "PROBE|000|boot|start|"
    ' Gives a telnet client time to reattach after the launch drops the console connections.
    sleep(8000)
    mode = "solo"
    if args.mode <> invalid then mode = args.mode
    di = CreateObject("roDeviceInfo")
    print "PROBE|001|boot|device|model=" + di.GetModelDisplayName() + " os=" + di.GetOSVersion().major + "." + di.GetOSVersion().minor + " mode=" + mode

    s = {}
    s.clock = CreateObject("roTimespan")
    ' ---- Phase A: a live SceneGraph screen ----
    s.screen = CreateObject("roSGScreen")
    s.port = CreateObject("roMessagePort")
    s.screen.setMessagePort(s.port)
    ' A second port created while the screen is live; never given to setMessagePort.
    s.obsPort = CreateObject("roMessagePort")
    s.g = s.screen.getGlobalNode()
    s.g.addFields({ beat: 0 })
    s.g.observeField("beat", s.obsPort)
    s.scene = s.screen.CreateScene("ProbeScene")
    s.screen.show()
    s.scene.observeField("ticks", s.obsPort)
    s.audio = s.scene.findNode("audio")
    s.audio.observeField("state", s.obsPort)

    t = CreateObject("roTimespan")
    while s.scene.ticks < 3 and t.TotalMilliseconds() < 5000
        wait(50, s.port)
    end while
    print "PROBE|010|A|live|ticks=" + s.scene.ticks.toStr() + " audio=" + s.audio.state

    s.task = CreateObject("roSGNode", "BeatTask")
    s.task.id = "task1"
    s.task.beats = 150
    s.task.observeField("beat", s.obsPort)
    s.task.observeField("state", s.obsPort)
    s.task.control = "RUN"
    print "PROBE|011|A|obs-before-close|" + drain(s.obsPort, 1000)
    print "PROBE|012|await|shot|name=" + mode + "-A-before-close"
    print "PROBE|013|A|screen-port-before-close|" + drain(s.port, 3000)

    if mode = "roscreen-before"
        runRoScreenBefore(s, mode)
        return
    end if

    s.ticksAtClose = s.scene.ticks
    s.beatAtClose = s.task.beat
    s.closeAt = s.clock.TotalMilliseconds()
    s.screen.close()
    print "PROBE|020|A|close|ticks=" + s.ticksAtClose.toStr() + " taskBeat=" + s.beatAtClose.toStr()

    if mode = "roscreen-after"
        createRoScreen(s, "roScreen after close")
    else if mode = "sgscreen-after"
        createSecondScreen(s)
    end if

    s.screen.close()
    print "PROBE|021|A|close-again|"
    print "PROBE|022|A|screen-port-after-close|" + drain(s.port, 1000)

    if mode = "solo"
        ' Nothing else holds the app: report what still runs until the device ends it.
        for i = 1 to 50
            print "PROBE|030|A|heartbeat|" + since(s) + " " + drain(s.obsPort, 200) + stateOf(s)
        end for
        print "PROBE|999|done|survived"
        sleep(3000)
        return
    end if

    print "PROBE|023|A|obs-after-close|" + drain(s.obsPort, 2000)
    print "PROBE|024|A|state-after-close|" + since(s) + " " + stateOf(s)

    task2 = CreateObject("roSGNode", "BeatTask")
    task2.id = "task2"
    task2.beats = 5
    task2.observeField("state", s.obsPort)
    task2.observeField("beat", s.obsPort)
    task2.control = "RUN"
    print "PROBE|026|A|task-started-after-close|" + drain(s.obsPort, 2000) + "task2=" + task2.state + " task2Beat=" + task2.beat.toStr()
    print "PROBE|027|await|shot|name=" + mode + "-after-close"
    drain(s.obsPort, 4000)

    print "PROBE|030|await|Left|"
    keyPorts = "port=[" + drain(s.port, 1500) + "] obs=[" + drain(s.obsPort, 300) + "]"
    if s.rsPort <> invalid then keyPorts = keyPorts + " rs=[" + drain(s.rsPort, 300) + "]"
    if s.port2 <> invalid then keyPorts = keyPorts + " port2=[" + drain(s.port2, 300) + "]"
    print "PROBE|031|A|key-after-close|" + keyPorts + " " + stateOf(s)

    if s.rs <> invalid
        ' ---- Phase B: the roScreen, then a second roSGScreen once it is released ----
        print "PROBE|043|await|Right|"
        print "PROBE|044|B|key-on-roscreen|rs=[" + drain(s.rsPort, 1500) + "] port=[" + drain(s.port, 300) + "] " + stateOf(s)
        s.rs = invalid
        s.rsPort = invalid
        print "PROBE|045|B|roscreen-released|" + drain(s.obsPort, 500) + stateOf(s)
        createSecondScreen(s)
    end if

    ' ---- Phase C: the second roSGScreen ----
    ' Only the pre-close port is read: does the new Scene advance?
    print "PROBE|051|C|obs-only|" + drain(s.obsPort, 2000) + "ticks2=" + s.scene2.ticks.toStr() + " " + stateOf(s)
    print "PROBE|052|await|shot|name=" + mode + "-second-screen"
    drain(s.obsPort, 4000)
    print "PROBE|053|await|Down|"
    print "PROBE|054|C|key-on-screen2|obs=[" + drain(s.obsPort, 1500) + "] scene2LastKey=" + s.scene2.lastKey + " sceneLastKey=" + s.scene.lastKey
    print "PROBE|055|C|screen2-port|" + drain(s.port2, 500)

    print "PROBE|999|done|"
    sleep(3000)
end sub

sub runRoScreenBefore(s as object, mode as string)
    createRoScreen(s, "roScreen before close")
    print "PROBE|014|await|shot|name=" + mode + "-roscreen-over-scene"
    sleep(4000)
    print "PROBE|015|B|obs-under-roscreen|" + drain(s.obsPort, 1000)
    print "PROBE|016|B|port-under-roscreen|" + drain(s.port, 500)
    s.closeAt = s.clock.TotalMilliseconds()
    s.screen.close()
    print "PROBE|020|A|close|"
    s.screen.close()
    print "PROBE|021|A|close-again|"
    print "PROBE|022|A|screen-port-after-close|" + drain(s.port, 1000)
    print "PROBE|023|A|obs-after-close|" + drain(s.obsPort, 2000)
    print "PROBE|030|await|Left|"
    print "PROBE|031|B|key-after-close|rs=[" + drain(s.rsPort, 1500) + "] port=[" + drain(s.port, 300) + "] obs=[" + drain(s.obsPort, 300) + "]"
    font = CreateObject("roFontRegistry").GetDefaultFont()
    for i = 1 to 2
        s.rs.Clear(&h206030FF)
        s.rs.DrawText("roScreen after close " + since(s), 120, 180, &hFFFFFFFF, font)
        s.rs.SwapBuffers()
    end for
    print "PROBE|032|await|shot|name=" + mode + "-after-close"
    sleep(4000)
    print "PROBE|033|B|alive|" + since(s)
    ' A second roSGScreen once the roScreen is released, touching none of the first screen's nodes.
    s.rs = invalid
    s.rsPort = invalid
    s.screen2 = CreateObject("roSGScreen")
    s.port2 = CreateObject("roMessagePort")
    s.screen2.setMessagePort(s.port2)
    s.scene2 = s.screen2.CreateScene("SecondScene")
    s.screen2.show()
    s.scene2.observeField("ticks", s.port2)
    print "PROBE|050|C|screen2|" + since(s)
    print "PROBE|051|C|old-ports|port=[" + drain(s.port, 1000) + "] obs=[" + drain(s.obsPort, 1000) + "] ticks2=" + s.scene2.ticks.toStr()
    print "PROBE|052|await|shot|name=" + mode + "-second-screen"
    print "PROBE|053|C|port2|" + drain(s.port2, 4000)
    print "PROBE|054|await|Down|"
    print "PROBE|055|C|key-on-screen2|port2=[" + drain(s.port2, 1500) + "] scene2LastKey=" + s.scene2.lastKey + " ticks2=" + s.scene2.ticks.toStr()
    ' Node reads last: each may block on the closed screen's render thread.
    print "PROBE|060|B|read|what=task.beat"
    print "PROBE|061|B|read|task.beat=" + s.task.beat.toStr() + " " + since(s)
    print "PROBE|062|B|read|what=global.beat"
    print "PROBE|063|B|read|global.beat=" + s.g.beat.toStr() + " " + since(s)
    print "PROBE|064|B|read|what=scene.ticks"
    print "PROBE|065|B|read|scene.ticks=" + s.scene.ticks.toStr() + " " + since(s)
    print "PROBE|999|done|"
    sleep(3000)
end sub

sub createRoScreen(s as object, text as string)
    s.rs = CreateObject("roScreen", true)
    print "PROBE|040|B|roscreen|" + since(s) + " type=" + type(s.rs)
    if s.rs = invalid then return
    s.rsPort = CreateObject("roMessagePort")
    s.rs.setMessagePort(s.rsPort)
    font = CreateObject("roFontRegistry").GetDefaultFont()
    for i = 1 to 2
        s.rs.Clear(&h103060FF)
        s.rs.DrawRect(100, 100, 500, 200, &hE0C020FF)
        s.rs.DrawText(text, 120, 180, &h000000FF, font)
        s.rs.SwapBuffers()
    end for
    print "PROBE|041|B|roscreen-drawn|" + since(s) + " pending=[" + drain(s.rsPort, 500) + "]"
end sub

sub createSecondScreen(s as object)
    s.screen2 = CreateObject("roSGScreen")
    s.port2 = CreateObject("roMessagePort")
    s.screen2.setMessagePort(s.port2)
    g2 = s.screen2.getGlobalNode()
    print "PROBE|050|C|screen2|" + since(s) + " sameGlobal=" + g2.isSameNode(s.g).toStr() + " hasBeat=" + g2.hasField("beat").toStr()
    s.scene2 = s.screen2.CreateScene("SecondScene")
    s.screen2.show()
    s.scene2.observeField("ticks", s.obsPort)
end sub

function since(s as object) as string
    if s.closeAt = invalid then return "t=-"
    return "t=" + (s.clock.TotalMilliseconds() - s.closeAt).toStr()
end function

function stateOf(s as object) as string
    r = "ticks=" + s.scene.ticks.toStr() + " taskBeat=" + s.task.beat.toStr() + " globalBeat=" + s.g.beat.toStr()
    r = r + " task=" + s.task.state + " audio=" + s.audio.state + " lastKey=" + s.scene.lastKey
    if s.ticksAtClose <> invalid then r = r + " ticksAtClose=" + s.ticksAtClose.toStr() + " beatAtClose=" + s.beatAtClose.toStr()
    return r
end function

' Reads a port for `ms` milliseconds and returns a count per event kind, in arrival order.
function drain(p as object, ms as integer) as string
    counts = {}
    order = []
    t = CreateObject("roTimespan")
    while t.TotalMilliseconds() < ms
        msg = wait(50, p)
        if msg <> invalid
            k = type(msg)
            if k = "roSGNodeEvent"
                k = k + ":" + msg.getNode() + "." + msg.getField()
                if msg.getField() = "state" then k = k + "=" + msg.getData()
            else if k = "roSGScreenEvent"
                if msg.isScreenClosed() then k = k + ":closed"
            else if k = "roUniversalControlEvent"
                k = k + ":" + msg.getInt().toStr()
            end if
            if counts[k] = invalid
                counts[k] = 0
                order.push(k)
            end if
            counts[k] = counts[k] + 1
        end if
    end while
    r = ""
    for each k in order
        r = r + k + "x" + counts[k].toStr() + " "
    end for
    return r
end function
