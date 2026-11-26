sub init()
    m.list = m.top.findNode("list")
    root = CreateObject("roSGNode", "ContentNode")
    row = root.createChild("ContentNode")
    for each id in ["same-update", "same-assign", "new-assign", "external-same", "external-new"]
        item = row.createChild("ContentNode")
        item.id = id
        item.title = "fixed"
    end for
    m.row = row
    ' A plain node holding the external-new item in a node field: does a write to the item notify it?
    m.holderCalls = 0
    m.holder = CreateObject("roSGNode", "Node")
    m.holder.addField("ref", "node", false)
    m.holder.ref = row.getChild(4)
    m.holder.observeField("ref", "onHolderRef")
    m.list.content = root
    m.list.setFocus(true)
    m.step = 0
    m.timer = m.top.findNode("stepTimer")
    m.timer.observeField("fire", "onStep")
    m.timer.control = "start"
end sub

sub onHolderRef()
    m.holderCalls = m.holderCalls + 1
    print "PROBE|holder|calls=" + m.holderCalls.toStr()
end sub

sub onStep()
    m.step = m.step + 1
    if m.step = 2
        print "PROBE|step|external writes"
        m.row.getChild(3).title = "fixed"
        m.row.getChild(4).title = "changed"
    else if m.step = 4
        print "PROBE|step|external update same"
        m.row.getChild(3).update({ title: "fixed" })
    else if m.step = 6
        print "PROBE|done"
        m.timer.control = "stop"
    end if
end sub
