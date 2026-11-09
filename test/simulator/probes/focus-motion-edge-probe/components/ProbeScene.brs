sub init()
    m.clock = CreateObject("roTimespan")
    m.list = m.top.findNode("list")
    m.other = m.top.findNode("other")
    content = CreateObject("roSGNode", "ContentNode")
    for i = 0 to 9
        item = content.createChild("ContentNode")
        item.title = "I" + i.toStr()
    end for
    m.list.content = content
    for each field in ["itemFocused", "itemUnfocused", "scrollingStatus"]
        m.list.observeField(field, "onListField")
    end for
    for each id in ["pW", "pH", "pNone", "pBoth"]
        m.top.findNode(id).observeField("loadStatus", "onPosterStatus")
    end for
    m.timer = CreateObject("roSGNode", "Timer")
    m.timer.observeField("fire", "onStep")
    m.list.setFocus(true)
    plog("start")
    after(1.0, "A1")
end sub

sub plog(msg as string)
    print "PROBE|" + m.clock.TotalMilliseconds().toStr() + "|" + msg
end sub

sub sample(tag as string)
    plog(tag + "|itemFocused=" + m.list.itemFocused.toStr() + " currFocusRow=" + m.list.currFocusRow.toStr() + " scrolling=" + m.list.scrollingStatus.toStr() + " listFocus=" + m.list.hasFocus().toStr() + " otherFocus=" + m.other.hasFocus().toStr())
end sub

sub onListField(event as object)
    plog("L." + event.getField() + "=" + event.getData().toStr())
end sub

sub onPosterStatus(event as object)
    poster = event.getRoSGNode()
    if event.getData() <> "ready" then return
    rect = poster.boundingRect()
    plog("poster|" + poster.id + "|bitmap=" + poster.bitmapWidth.toStr() + "x" + poster.bitmapHeight.toStr() + " size=" + poster.width.toStr() + "x" + poster.height.toStr() + " rect=" + rect.width.toStr() + "x" + rect.height.toStr())
end sub

sub after(seconds as float, nextStep as string)
    m.next = nextStep
    m.timer.duration = seconds
    m.timer.control = "start"
end sub

sub onStep()
    s = m.next
    if s = "A1"
        plog("case|A focus taken mid-motion")
        sample("A1 pre")
        m.list.animateToItem = 3
        after(0.15, "A2")
    else if s = "A2"
        sample("A2 pre")
        m.other.setFocus(true)
        sample("A2 post")
        after(1.2, "A3")
    else if s = "A3"
        sample("A3 end")
        m.list.setFocus(true)
        sample("A3 regained")
        after(1.0, "A4")
    else if s = "A4"
        sample("A4 settled")
        m.list.jumpToItem = 0
        sample("A4 reset")
        after(1.0, "B1")
    else if s = "B1"
        plog("case|B focus taken and regained mid-motion")
        sample("B1 pre")
        m.list.animateToItem = 3
        after(0.15, "B2")
    else if s = "B2"
        m.other.setFocus(true)
        sample("B2 post")
        after(0.1, "B3")
    else if s = "B3"
        m.list.setFocus(true)
        sample("B3 post")
        after(1.2, "B4")
    else if s = "B4"
        sample("B4 end")
        m.list.jumpToItem = 0
        sample("B4 reset")
        after(1.0, "C1")
    else if s = "C1"
        plog("case|C hidden list loses focus to another node")
        sample("C1 pre")
        m.list.visible = false
        m.other.setFocus(true)
        sample("C1 post")
        after(0.8, "C2")
    else if s = "C2"
        sample("C2 hidden")
        m.list.visible = true
        after(0.8, "C3")
    else if s = "C3"
        sample("C3 shown")
        m.list.setFocus(true)
        sample("C3 refocused")
        after(0.8, "D1")
    else if s = "D1"
        plog("case|D hidden list setFocus(false)")
        m.list.visible = false
        m.list.setFocus(false)
        sample("D1 post")
        after(0.8, "D2")
    else if s = "D2"
        sample("D2 hidden")
        m.list.visible = true
        after(0.8, "D3")
    else if s = "D3"
        sample("D3 shown")
        m.list.setFocus(true)
        plog("shot")
        after(3.0, "E1")
    else if s = "E1"
        plog("done")
    end if
end sub
