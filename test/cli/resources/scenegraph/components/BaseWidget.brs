sub init()
    print "INIT: BaseWidget"
    m.something = "in"
    m.top.observeField("baseUri", "onUriChange", ["baseStringField", "baseIntField"])
    m.top.setField("baseUri", "http://www.example.com/base.jpg")
    print "INIT: "; m.global.uri
    print "INIT: "; m.global.bitmapWidth
    print "INIT: "; m.global.bitmapHeight
    print "INIT: "; m.top.baseUri
    print "INIT: "; m
    runChangeFieldTest()
end sub

sub onNormalStringFieldChange(event as Object)
    print "EVENT: BaseWidget onNormalStringFieldChange", m
    print "EVENT: "; event.getData()
end sub

sub onUriChange(event as Object)
    print "EVENT: BaseWidget onUriChange "; m.something
    print "EVENT: ====="
    x = 1
    y = 2
    print "EVENT: "; x + y
    ' print "EVENT: "; event.getData(); event.getInfo().baseIntField
end sub

sub runChangeFieldTest()
    print "Change field test start"

    m.node = CreateObject("roSGNode", "Node")
    m.node.observeField("change", "OnChangeChange")

    childA = CreateObject("roSGNode", "Node")
    m.node.appendChild(childA)
    childB = CreateObject("roSGNode", "Node")
    m.node.insertChild(childB, 0)

    m.node.insertChild(childA, 0)

    childC = CreateObject("roSGNode", "Node")
    m.node.replaceChild(childC, 1)

    m.node.removeChildIndex(0)
    m.node.removeChild(childC)

    newChild = []
    for i = 0 to 3
        extraChild = CreateObject("roSGNode", "Node")
        m.node.appendChild(extraChild)
        newChild.push(extraChild)
    end for

    m.node.removeChildrenIndex(3, 1)
    newChild.pop()

    m.node.removeChildren(newChild)

    contentChild = CreateObject("roSGNode", "ContentNode")
    m.node.appendChild(contentChild)
    contentChild.title = "Updated content title"

    for i = 0 to 1
        m.node.appendChild(CreateObject("roSGNode", "Node"))
    end for

    replacementChildren = []
    childCount = m.node.getChildCount()
    for i = 0 to childCount - 1
        replacementChildren.push(CreateObject("roSGNode", "Node"))
    end for
    m.node.replaceChildren(replacementChildren, 0)

    print "Change field test complete"
end sub

sub OnChangeChange(event as Object)
    data = event.getData()
    op = data.Operation
    idx1 = data.Index1
    idx2 = data.Index2
    print op + ":" + idx1.toStr() + ":" + idx2.toStr()
end sub
