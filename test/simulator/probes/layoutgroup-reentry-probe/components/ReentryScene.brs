' Each case builds one LayoutGroup of three children (Rectangles 100x40, Watchers 80x40), appends it
' to the scene, lets it render for a while, then prints the settled layout and removes it.
'
'   kids     W = Watcher, R = Rectangle, in child order
'   mode     what a Watcher's translation observer does (see Watcher.xml)
'   wrap     put the LayoutGroup inside a plain Group (the "ancestor" target)
sub init()
    m.cases = [
        { id: "c1", dir: "horiz", align: "left", kids: "RWR", mode: "measure" },
        { id: "c2", dir: "horiz", align: "left", kids: "RWR", mode: "log" },
        { id: "c3", dir: "horiz", align: "center", kids: "WRR", mode: "measure" },
        { id: "c4", dir: "vert", align: "top", kids: "RWR", mode: "measure" },
        { id: "c5", dir: "horiz", align: "left", kids: "RWR", mode: "ancestor", wrap: true },
        { id: "c6", dir: "horiz", align: "left", kids: "RWW", mode: "measure" },
        { id: "c7", dir: "horiz", align: "right", kids: "WWR", mode: "measure" },
        { id: "c8", dir: "horiz", align: "left", kids: "RWW", mode: "ancestor", wrap: true },
        { id: "c9", dir: "horiz", align: "left", kids: "RWR", mode: "respace" },
        { id: "c10", dir: "horiz", align: "center", kids: "WRR", mode: "respace" },
        { id: "c11", dir: "horiz", align: "left", kids: "RWR", mode: "append" },
        { id: "c12", dir: "vert", align: "top", kids: "WRR", mode: "append" }
    ]
    m.index = -1
    m.current = invalid
    m.timer = m.top.findNode("step")
    m.timer.observeField("fire", "onStep")
    m.timer.duration = 3
    m.timer.control = "start"
end sub

sub onStep()
    if m.current <> invalid then finishCase()
    m.index++
    if m.index >= m.cases.count()
        print "PROBE|done"
        m.top.probeExit = true
        return
    end if
    startCase(m.cases[m.index])
    m.timer.duration = 1
    m.timer.control = "start"
end sub

sub startCase(c as object)
    lg = CreateObject("roSGNode", "LayoutGroup")
    lg.id = "lg"
    lg.layoutDirection = c.dir
    if c.dir = "horiz"
        lg.horizAlignment = c.align
    else
        lg.vertAlignment = c.align
    end if
    lg.itemSpacings = [20]
    for i = 0 to 2
        if Mid(c.kids, i + 1, 1) = "W"
            kid = CreateObject("roSGNode", "Watcher")
            kid.caseId = c.id
            kid.mode = c.mode
        else
            kid = CreateObject("roSGNode", "Rectangle")
            kid.width = 100
            kid.height = 40
            kid.color = "0xF08030FF"
        end if
        kid.id = "k" + i.toStr()
        lg.appendChild(kid)
    end for
    root = lg
    if c.wrap = true
        root = CreateObject("roSGNode", "Group")
        root.id = "wrap"
        root.appendChild(lg)
    end if
    root.translation = [600, 400]
    m.current = { c: c, root: root, lg: lg }
    print "PROBE|" + c.id + "|config|dir=" + c.dir + " align=" + c.align + " kids=" + c.kids + " mode=" + c.mode
    m.top.appendChild(root)
    print "PROBE|" + c.id + "|appended|" + fmtKids(lg)
end sub

sub finishCase()
    c = m.current.c
    lg = m.current.lg
    print "PROBE|" + c.id + "|settled|" + fmtKids(lg) + " | rect(lg)=" + fmtRect(lg.boundingRect())
    m.top.removeChild(m.current.root)
    m.current = invalid
end sub
