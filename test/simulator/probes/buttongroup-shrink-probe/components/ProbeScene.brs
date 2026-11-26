' Shrinking a ButtonGroup's `buttons` array: what happens to the surplus Button children?
sub init()
    m.step = 0
    m.changes = []
    m.timer = CreateObject("roSGNode", "Timer")
    m.timer.duration = 0.5
    m.timer.repeat = true
    m.timer.observeField("fire", "onTick")
    m.timer.control = "start"
end sub

sub onChange(event as object)
    c = event.getData()
    m.changes.push(c.Operation + "(" + c.Index1.toStr() + "," + c.Index2.toStr() + ")")
end sub

function changesStr() as string
    s = m.changes.join(" ")
    m.changes = []
    if s = "" then return "-"
    return s
end function

function parentStr(node as object) as string
    p = node.getParent()
    if p = invalid then return "invalid"
    if p.isSameNode(m.bg) then return "group"
    return p.subtype()
end function

' The node holding key focus, found by walking focusedChild down from the scene.
function focusedStr() as string
    node = m.top
    while node <> invalid
        if node.hasFocus()
            name = node.subtype()
            if node.hasField("text") then name = name + ":" + node.text
            return name
        end if
        node = node.focusedChild
    end while
    return "none"
end function

sub dump(label as string)
    ids = []
    for i = 0 to m.bg.getChildCount() - 1
        c = m.bg.getChild(i)
        name = c.subtype()
        if c.hasField("text") then name = name + ":" + c.text
        ids.push(name)
    end for
    print "PROBE|"; label; "|count="; m.bg.getChildCount(); "|children="; ids.join(","); "|changes="; changesStr()
end sub

sub onTick()
    m.step++
    if m.step = 1
        m.bg = CreateObject("roSGNode", "ButtonGroup")
        m.bg.translation = [200, 200]
        m.bg.observeField("change", "onChange")
        m.top.appendChild(m.bg)
        m.bg.buttons = ["A", "B", "C", "D"]
        dump("set4-immediate")
    else if m.step = 2
        dump("set4-frame")
        m.b0 = m.bg.getChild(0)
        m.b2 = m.bg.getChild(2)
        m.b3 = m.bg.getChild(3)
        m.b3.setFocus(true)
        print "PROBE|focusD|D.hasFocus="; m.b3.hasFocus(); "|bg.buttonFocused="; m.bg.buttonFocused
        m.bg.buttons = ["A", "B"]
        dump("set2-immediate")
        print "PROBE|removed-immediate|C.parent="; parentStr(m.b2); "|D.parent="; parentStr(m.b3); "|D.hasFocus="; m.b3.hasFocus(); "|bg.isInFocusChain="; m.bg.isInFocusChain()
        print "PROBE|identity|child0.isSameA="; m.bg.getChild(0).isSameNode(m.b0); "|A.parent="; parentStr(m.b0); "|focused="; focusedStr()
    else if m.step = 3
        dump("set2-frame")
        print "PROBE|removed-frame|C.parent="; parentStr(m.b2); "|D.parent="; parentStr(m.b3); "|D.hasFocus="; m.b3.hasFocus(); "|bg.isInFocusChain="; m.bg.isInFocusChain(); "|bg.buttonFocused="; m.bg.buttonFocused
        m.bg.buttons = ["X", "Y", "Z"]
        dump("set3-immediate")
        print "PROBE|regrow|C.parent="; parentStr(m.b2); "|child2.isSameC="; m.bg.getChild(2).isSameNode(m.b2)
    else if m.step = 4
        dump("set3-frame")
        ' A custom child appended after the buttons: does a shrink leave it alone?
        r = CreateObject("roSGNode", "Rectangle")
        r.id = "rect"
        m.bg.appendChild(r)
        dump("append-rect")
        m.bg.buttons = ["X"]
        dump("set1-with-rect-immediate")
    else if m.step = 5
        dump("set1-with-rect-frame")
        ' The group itself focused, then its buttons replaced.
        m.bg.buttons = ["P", "Q", "R"]
        changesStr()
        m.bg.setFocus(true)
        print "PROBE|group-focus|focused="; focusedStr(); "|bg.buttonFocused="; m.bg.buttonFocused
        m.bg.focusButton = 2
        print "PROBE|focusButton2|focused="; focusedStr(); "|bg.buttonFocused="; m.bg.buttonFocused
        m.bg.buttons = ["S", "T"]
        dump("set2-group-focused")
        print "PROBE|after-replace|focused="; focusedStr(); "|bg.buttonFocused="; m.bg.buttonFocused; "|bg.hasFocus="; m.bg.hasFocus(); "|bg.isInFocusChain="; m.bg.isInFocusChain()
    else if m.step = 6
        print "PROBE|after-replace-frame|focused="; focusedStr(); "|bg.buttonFocused="; m.bg.buttonFocused
        m.t0 = m.bg.getChild(0)
        m.bg.buttons = ["S", "T"]
        dump("same-array")
        print "PROBE|same-array|child0.isSameS="; m.bg.getChild(0).isSameNode(m.t0); "|focused="; focusedStr()
    else if m.step = 7
        ' Control: a plain removeChild of the focused node, outside any ButtonGroup.
        holder = CreateObject("roSGNode", "Group")
        m.top.appendChild(holder)
        leaf = CreateObject("roSGNode", "Group")
        leaf.id = "leaf"
        holder.appendChild(leaf)
        leaf.setFocus(true)
        print "PROBE|plain-before|leaf.hasFocus="; leaf.hasFocus(); "|focused="; focusedStr()
        holder.removeChild(leaf)
        print "PROBE|plain-removed|leaf.hasFocus="; leaf.hasFocus(); "|focused="; focusedStr(); "|holder.isInFocusChain="; holder.isInFocusChain()
    else if m.step = 8
        ' Control: the focused node moved to another parent (appendChild reparents).
        first = CreateObject("roSGNode", "Group")
        second = CreateObject("roSGNode", "Group")
        m.top.appendChild(first)
        m.top.appendChild(second)
        moved = CreateObject("roSGNode", "Group")
        first.appendChild(moved)
        moved.setFocus(true)
        second.appendChild(moved)
        print "PROBE|reparent|moved.hasFocus="; moved.hasFocus(); "|focused="; focusedStr(); "|first.isInFocusChain="; first.isInFocusChain(); "|second.isInFocusChain="; second.isInFocusChain()
        ' Control: the focused node replaced in place.
        old = CreateObject("roSGNode", "Group")
        first.appendChild(old)
        old.setFocus(true)
        first.replaceChild(CreateObject("roSGNode", "Group"), first.getChildCount() - 1)
        print "PROBE|replaced|old.hasFocus="; old.hasFocus(); "|focused="; focusedStr(); "|first.isInFocusChain="; first.isInFocusChain()
        ' Control: a focused grandchild, its parent removed.
        branch = CreateObject("roSGNode", "Group")
        first.appendChild(branch)
        twig = CreateObject("roSGNode", "Group")
        branch.appendChild(twig)
        twig.setFocus(true)
        first.removeChild(branch)
        print "PROBE|ancestor-removed|twig.hasFocus="; twig.hasFocus(); "|focused="; focusedStr(); "|branch.isInFocusChain="; branch.isInFocusChain()
    else if m.step = 9
        ' reparent() of the focused node, or of its ancestor: onto its own parent (a router library's
        ' mount: appendChild then reparent to the same target), and onto another parent.
        home = CreateObject("roSGNode", "Group")
        away = CreateObject("roSGNode", "Group")
        m.top.appendChild(home)
        m.top.appendChild(away)
        view = CreateObject("roSGNode", "Group")
        view.id = "view"
        inner = CreateObject("roSGNode", "Group")
        inner.id = "inner"
        view.appendChild(inner)
        sibling = CreateObject("roSGNode", "Group")
        sibling.id = "sibling"
        home.appendChild(view)
        home.appendChild(sibling)
        inner.setFocus(true)
        ok = view.reparent(home, true)
        order = []
        for i = 0 to home.getChildCount() - 1
            order.push(home.getChild(i).id)
        end for
        print "PROBE|reparent-same-ancestor|ok="; ok; "|inner.hasFocus="; inner.hasFocus(); "|focused="; focusedStr(); "|home.isInFocusChain="; home.isInFocusChain(); "|order="; order.join(",")
        inner.setFocus(true)
        ok = view.reparent(away, true)
        print "PROBE|reparent-other-ancestor|ok="; ok; "|inner.hasFocus="; inner.hasFocus(); "|focused="; focusedStr(); "|away.isInFocusChain="; away.isInFocusChain(); "|view.parent="; view.getParent().isSameNode(away)
        inner.setFocus(true)
        ok = inner.reparent(view, true)
        print "PROBE|reparent-same-focused|ok="; ok; "|inner.hasFocus="; inner.hasFocus(); "|focused="; focusedStr()
        inner.setFocus(true)
        ok = inner.reparent(home, true)
        print "PROBE|reparent-other-focused|ok="; ok; "|inner.hasFocus="; inner.hasFocus(); "|focused="; focusedStr(); "|home.isInFocusChain="; home.isInFocusChain()
    else if m.step = 10
        ' The router mount: a view whose child focused itself in init() (tree still detached),
        ' appended to the outlet, then reparent()ed onto that same outlet.
        outlet = CreateObject("roSGNode", "Group")
        m.top.appendChild(outlet)
        view = CreateObject("roSGNode", "RoutedView")
        list = view.findNode("list")
        print "PROBE|mount-created|list.hasFocus="; list.hasFocus(); "|focused="; focusedStr()
        outlet.appendChild(view)
        print "PROBE|mount-appended|list.hasFocus="; list.hasFocus(); "|focused="; focusedStr(); "|view.isInFocusChain="; view.isInFocusChain()
        view.reparent(outlet, true)
        print "PROBE|mount-reparented|list.hasFocus="; list.hasFocus(); "|focused="; focusedStr(); "|view.isInFocusChain="; view.isInFocusChain()
        view.setFocus(true)
        print "PROBE|mount-view-focus|list.hasFocus="; list.hasFocus(); "|view.hasFocus="; view.hasFocus(); "|focused="; focusedStr()
        ' Same view type, reparented straight from detached (no appendChild first).
        view2 = CreateObject("roSGNode", "RoutedView")
        list2 = view2.findNode("list")
        view2.reparent(outlet, true)
        print "PROBE|mount2-reparented|list.hasFocus="; list2.hasFocus(); "|focused="; focusedStr()
        ' A child focused while attached, then the same appendChild + reparent.
        view3 = CreateObject("roSGNode", "Group")
        leaf3 = CreateObject("roSGNode", "Group")
        view3.appendChild(leaf3)
        outlet.appendChild(view3)
        leaf3.setFocus(true)
        view3.reparent(outlet, true)
        print "PROBE|attached-reparented|leaf.hasFocus="; leaf3.hasFocus(); "|focused="; focusedStr()
    else if m.step = 11
        print "PROBE|done"
        m.timer.control = "stop"
    end if
end sub
