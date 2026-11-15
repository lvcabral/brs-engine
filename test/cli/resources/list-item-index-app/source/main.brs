' List item interface: RowList/ZoomRowList items get their index and rowIndex, and MarkupGrid/MarkupList items
' their index (across sections), before their first itemContent; a RowList's rowTitleComponentName gets one
' title per row with the row's content (see test/simulator/probes/rowlist-internals-probe and
' markupgrid-item-index-probe).
sub Main()
    print "=== List Item Index Repro ==="

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()

    rows = scene.findNode("rows")
    rows.content = buildContent("L", [3, 3])
    zoom = scene.findNode("zoom")
    ' An empty middle row is still row 1: the next row's items report rowIndex 2.
    zoom.content = buildContent("Z", [3, 0, 3])

    grid = scene.findNode("grid")
    grid.content = buildSections()
    list = scene.findNode("list")
    list.content = buildItems("M", 3)

    ' Force a layout pass so the lists create their item and title components.
    rows.boundingRect()
    zoom.boundingRect()
    grid.boundingRect()
    list.boundingRect()

    print "=== List Item Index Repro Complete ==="
end sub

function buildContent(prefix as string, counts as object) as object
    root = CreateObject("roSGNode", "ContentNode")
    for r = 0 to counts.count() - 1
        row = root.createChild("ContentNode")
        row.title = prefix + "row" + r.toStr()
        for c = 0 to counts[r] - 1
            item = row.createChild("ContentNode")
            item.title = prefix + "R" + r.toStr() + "C" + c.toStr()
        end for
    end for
    return root
end function

function buildItems(prefix as string, count as integer) as object
    root = CreateObject("roSGNode", "ContentNode")
    for i = 0 to count - 1
        item = root.createChild("ContentNode")
        item.title = prefix + i.toStr()
    end for
    return root
end function

' Two sections of 2 items: the second section's first item is data index 2.
function buildSections() as object
    root = CreateObject("roSGNode", "ContentNode")
    for sec = 0 to 1
        section = root.createChild("ContentNode")
        section.contentType = "SECTION"
        section.title = "Section " + sec.toStr()
        for i = 0 to 1
            item = section.createChild("ContentNode")
            item.title = "G" + sec.toStr() + "." + i.toStr()
        end for
    end for
    return root
end function
