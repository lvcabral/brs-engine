' Does a channel component named after a built-in node type (ButtonGroup, RSGPalette) replace the
' built-in everywhere, and what do type queries, clone, a Task round-trip, a channel subclass and the
' firmware's own internal nodes (Dialog.buttonGroup, StdDlgButtonArea) report? See README.md.
sub Main()
    m.seq = 0
    say("boot", "start")
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    di = CreateObject("roDeviceInfo")
    say("env", "os=" + di.GetOSVersion().major + "." + di.GetOSVersion().minor)

    ' S1: CreateObject of the shadowed name.
    bg = CreateObject("roSGNode", "ButtonGroup")
    typeInfo("S1", bg)
    say("S1.shadowTag", fmt(bg.shadowTag))
    say("S1.describe", fmt(bg.callFunc("describe")))
    say("S1.hasField(buttons)", fmt(bg.hasField("buttons")))
    say("S1.hasField(layoutDirection)", fmt(bg.hasField("layoutDirection")))
    say("S1.parentSubtype(ButtonGroup)", fmt(bg.parentSubtype("ButtonGroup")))

    ' S2: the shadowed name as an XML child.
    xbg = scene.findNode("xmlBg")
    typeInfo("S2", xbg)
    say("S2.shadowTag", fmt(xbg.shadowTag))

    ' S3: the firmware's own ButtonGroup inside a built-in Dialog.
    dlg = CreateObject("roSGNode", "Dialog")
    dlg.buttons = ["A", "B"]
    ibg = dlg.buttonGroup
    say("S3.type", type(ibg))
    if ibg <> invalid
        typeInfo("S3", ibg)
        say("S3.hasField(shadowTag)", fmt(ibg.hasField("shadowTag")))
        say("S3.hasField(buttons)", fmt(ibg.hasField("buttons")))
    end if

    ' S4: a built-in that extends ButtonGroup.
    area = CreateObject("roSGNode", "StdDlgButtonArea")
    say("S4.type", type(area))
    if area <> invalid
        typeInfo("S4", area)
        say("S4.isSubtype(ButtonGroup)", fmt(area.isSubtype("ButtonGroup")))
        say("S4.parentSubtype(StdDlgButtonArea)", fmt(area.parentSubtype("StdDlgButtonArea")))
        say("S4.hasField(shadowTag)", fmt(area.hasField("shadowTag")))
        say("S4.hasField(buttons)", fmt(area.hasField("buttons")))
    end if

    ' S5: a Node-rooted shadow (RSGPalette extends Node) and its clone.
    pal = CreateObject("roSGNode", "RSGPalette")
    typeInfo("S5", pal)
    say("S5.hasField(marker)", fmt(pal.hasField("marker")))
    say("S5.hasField(colors)", fmt(pal.hasField("colors")))
    say("S5.fieldCount", fmt(pal.getFields().count()))
    cl = pal.clone(false)
    say("S5.clone.subtype", fmt(cl.subtype()))
    say("S5.clone.hasField(marker)", fmt(cl.hasField("marker")))
    say("S5.clone.fieldCount", fmt(cl.getFields().count()))
    bgc = bg.clone(false)
    say("S5.bgClone.subtype", fmt(bgc.subtype()))
    say("S5.bgClone.shadowTag", fmt(bgc.shadowTag))
    say("S5.bgClone.describe", fmt(bgc.callFunc("describe")))

    ' S6: the shadow crossing to a Task thread and one created there.
    task = CreateObject("roSGNode", "ShadowTask")
    task.observeField("report", port)
    task.nodeIn = bg
    task.control = "run"
    report = "timeout"
    while true
        msg = wait(5000, port)
        if msg = invalid then exit while
        if type(msg) = "roSGNodeEvent" and msg.getField() = "report"
            report = msg.getData()
            exit while
        end if
    end while
    for each part in report.split("|")
        say("S6", part)
    end for

    ' S7: a channel component that extends the shadow. Last: if the base scope is missing, init crashes.
    lb = CreateObject("roSGNode", "LoginButtons")
    typeInfo("S7", lb)
    say("S7.isSubtype(ButtonGroup)", fmt(lb.isSubtype("ButtonGroup")))
    say("S7.parentSubtype(LoginButtons)", fmt(lb.parentSubtype("LoginButtons")))
    say("S7.shadowTag", fmt(lb.shadowTag))
    say("S7.loginTag", fmt(lb.loginTag))
    say("S7.describe", fmt(lb.callFunc("describe")))

    ' S8: inherited onKeyEvent on the subclass.
    scene.appendChild(lb)
    lb.setFocus(true)
    say("S8.hasFocus", fmt(lb.hasFocus()))
    say("await", "Right")
    deadline = CreateObject("roTimespan")
    while deadline.totalMilliseconds() < 4000
        wait(200, port)
    end while
    say("done", "end")
end sub

sub typeInfo(tag as String, n as Object)
    say(tag + ".subtype", fmt(n.subtype()))
    say(tag + ".isSubtype(Group)", fmt(n.isSubtype("Group")))
    say(tag + ".isSubtype(LayoutGroup)", fmt(n.isSubtype("LayoutGroup")))
end sub

sub say(tag as String, value as String)
    m.seq++
    s = m.seq.toStr()
    while len(s) < 3
        s = "0" + s
    end while
    if tag = "boot" then s = "000"
    print "PROBE|" + s + "|" + tag + "|" + value + "|"
end sub

function fmt(v as Dynamic) as String
    if v = invalid then return "invalid"
    t = type(v)
    if t = "roBoolean" or t = "Boolean" or t = "roInt" or t = "Integer" then return v.toStr()
    if t = "roString" or t = "String" then return v
    return t
end function
