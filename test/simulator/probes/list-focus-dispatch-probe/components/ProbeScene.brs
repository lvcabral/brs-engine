sub init()
    m.clock = CreateObject("roTimespan")
    m.list = m.top.findNode("list")
    m.other = m.top.findNode("other")
    m.list.observeField("itemFocused", "onListField")
    m.list.observeField("itemUnfocused", "onListField")
    plog("S init: content")
    m.list.content = buildContent("I", 10)
    plog("S init: setFocus")
    m.list.setFocus(true)
    plog("S init: end")
    m.timer = CreateObject("roSGNode", "Timer")
    m.timer.observeField("fire", "onStep")
    after(1.0, "R1")
end sub

function buildContent(prefix as string, count as integer) as object
    content = CreateObject("roSGNode", "ContentNode")
    for i = 0 to count - 1
        item = content.createChild("ContentNode")
        item.title = prefix + i.toStr()
    end for
    return content
end function

sub plog(msg as string)
    print "PROBE|" + m.clock.TotalMilliseconds().toStr() + "|" + msg
end sub

sub onListField(event as object)
    node = event.getRoSGNode()
    name = "L"
    if node.id <> "" then name = node.id
    plog(name + "." + event.getField() + "=" + event.getData().toStr())
end sub

sub after(seconds as float, nextStep as string)
    m.next = nextStep
    m.timer.duration = seconds
    m.timer.control = "start"
end sub

' A list created, filled, attached and focused inside the current handler (never rendered yet).
function freshList(id as string) as object
    list = CreateObject("roSGNode", "MarkupList")
    list.id = id
    list.itemComponentName = "ProbeItem"
    list.itemSize = [300, 40]
    list.translation = [600, 200]
    list.observeField("itemFocused", "onListField")
    list.observeField("itemUnfocused", "onListField")
    list.content = buildContent(id + "_", 6)
    m.top.appendChild(list)
    return list
end function

sub runStep(s as string)
    if s = "R1"
        plog("case|R1 focus away and back, same item")
        m.list.jumpToItem = 2
        m.other.setFocus(true)
        plog("R1 call setFocus")
        m.list.setFocus(true)
        plog("R1 returned")
        after(0.5, "R2")
    else if s = "R2"
        plog("case|R2 unfocused jumpToItem to another item, then focus")
        m.other.setFocus(true)
        m.list.jumpToItem = 4
        plog("R2 call setFocus")
        m.list.setFocus(true)
        plog("R2 returned")
        after(0.5, "R3")
    else if s = "R3"
        plog("case|R3 unfocused jumpToItem to the same item, then focus")
        m.other.setFocus(true)
        m.list.jumpToItem = 4
        plog("R3 call setFocus")
        m.list.setFocus(true)
        plog("R3 returned")
        after(0.5, "R4")
    else if s = "R4"
        plog("case|R4 unfocused jumpToItem away and back, then focus")
        m.other.setFocus(true)
        m.list.jumpToItem = 1
        m.list.jumpToItem = 4
        plog("R4 call setFocus")
        m.list.setFocus(true)
        plog("R4 returned")
        after(0.5, "D1")
    else if s = "D1"
        plog("case|D1 timer: live list jumpToItem")
        m.list.jumpToItem = 7
        plog("D1 returned")
        after(0.5, "D2")
    else if s = "D2"
        plog("case|D2 timer: fresh list setFocus + jumpToItem")
        m.f1 = freshList("F1")
        m.f1.setFocus(true)
        plog("D2 setFocus returned")
        m.f1.jumpToItem = 3
        plog("D2 returned")
        after(0.5, "D5")
    else if s = "D5"
        plog("case|D5 timer: live list new content + jumpToItem")
        m.list.setFocus(true)
        plog("D5 setFocus returned")
        m.list.content = buildContent("J", 10)
        plog("D5 content returned")
        m.list.jumpToItem = 2
        plog("D5 returned")
        after(0.5, "T3")
    else if s = "T3"
        m.top.wantTrigger = "D3"
    else if s = "D3"
        plog("case|D3 main-thread field observer: live list setFocus + jumpToItem")
        m.list.setFocus(true)
        plog("D3 setFocus returned")
        m.list.jumpToItem = 6
        plog("D3 returned")
        after(0.5, "T4")
    else if s = "T4"
        m.top.wantTrigger = "D4"
    else if s = "D4"
        plog("case|D4 main-thread field observer: fresh list setFocus + jumpToItem")
        m.f2 = freshList("F2")
        m.f2.translation = [900, 200]
        m.f2.setFocus(true)
        plog("D4 setFocus returned")
        m.f2.jumpToItem = 3
        plog("D4 returned")
        after(1.0, "END")
    else if s = "END"
        plog("done")
    end if
end sub

sub onStep()
    runStep(m.next)
end sub

sub onTrigger()
    runStep(m.top.trigger)
end sub
