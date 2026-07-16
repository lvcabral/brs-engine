sub Main()
    print "=== RowList SubRect Repro ==="

    grid = CreateObject("roSGNode", "RowList")
    grid.itemComponentName = "RowItem"
    grid.itemSize = [300, 200]
    grid.rowItemSize = [[300, 200]]
    grid.itemSpacing = [0, 0]
    grid.numRows = 2

    content = CreateObject("roSGNode", "ContentNode")
    for r = 0 to 1
        row = content.createChild("ContentNode")
        item = row.createChild("ContentNode")
        item.title = "R" + r.toStr()
    end for
    grid.content = content

    ' Force an initial render so both rows' item components are created and cached.
    discard = grid.boundingRect()

    band = grid.subBoundingRect("item0_0")
    print "band row0 y = "; band.y

    ' Move focus down to row 1. A real device keeps the focused row at the fixed focus
    ' band, so an app that measures the newly focused item from its rowItemFocused
    ' observer reads the settled band position, not the pre-scroll stacked position.
    grid.jumpToRowItem = [1, 0]

    rect1 = grid.subBoundingRect("item1_0")
    print "focused row1 y = "; rect1.y

    same = Abs(rect1.y - band.y) < 50
    print "SAME BAND: "; same
    print "=== RowList SubRect Repro Complete ==="
end sub
