' Which coordinate space do subBoundingRect / localSubBoundingRect / sceneSubBoundingRect use for
' a grid's item sub parts? Every grid has 3 items, 100x100, 20px apart, at a non-zero translation;
' three of them sit inside a Group at [700,40], so parent, local and scene spaces all differ.
' Measured before and after moving focus to the second item, so the item rects differ.

sub init()
    m.ids = ["pgScene", "pgHolder", "mgHolder", "rlHolder", "pgScaled", "rl2"]
    for each id in m.ids
        grid = m.top.findNode(id)
        if Left(id, 2) = "rl"
            content = CreateObject("roSGNode", "ContentNode")
            for r = 0 to 1
                row = content.createChild("ContentNode")
                for i = 0 to 2
                    row.createChild("ContentNode").title = "I" + i.toStr()
                end for
            end for
        else
            content = CreateObject("roSGNode", "ContentNode")
            for i = 0 to 2
                item = content.createChild("ContentNode")
                item.hdGridPosterUrl = "pkg:/images/poster_grey.png"
                item.title = "I" + i.toStr()
            end for
        end if
        grid.content = content
    end for
    m.top.findNode("pgHolder").setFocus(true)
end sub

function fmt(r as object) as string
    return "{" + r.x.toStr() + "," + r.y.toStr() + "," + r.width.toStr() + "," + r.height.toStr() + "}"
end function

function measure(phase as dynamic) as void
    parts = ["item0", "item1", "item2", "item0_0", "item0_1", "item1_0", "item1_2", "focusItem", "focusIndicator", "bogus"]
    for each id in m.ids
        grid = m.top.findNode(id)
        print "PROBE|"; phase; "|"; id; "|own|parent="; fmt(grid.boundingRect()); " local="; fmt(grid.localBoundingRect()); " scene="; fmt(grid.sceneBoundingRect())
        for each p in parts
            print "PROBE|"; phase; "|"; id; "|"; p; "|parent="; fmt(grid.subBoundingRect(p)); " local="; fmt(grid.localSubBoundingRect(p)); " scene="; fmt(grid.sceneSubBoundingRect(p))
        end for
    end for
    r = m.top.findNode("rectNode")
    for each p in ["item0", "focusIndicator", "bogus"]
        print "PROBE|"; phase; "|rectNode|"; p; "|parent="; fmt(r.subBoundingRect(p)); " local="; fmt(r.localSubBoundingRect(p)); " scene="; fmt(r.sceneSubBoundingRect(p))
    end for
end function

function jump(unused as dynamic) as void
    for each id in m.ids
        grid = m.top.findNode(id)
        if id = "rl2"
            grid.jumpToRowItem = [1, 2]
        else if id = "rlHolder"
            grid.jumpToRowItem = [0, 1]
        else
            grid.jumpToItem = 1
        end if
    end for
end function
