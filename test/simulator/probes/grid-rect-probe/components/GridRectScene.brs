' Grid bounding-rect probe (issues #1318-#1321). Each case builds its nodes under the scene, then for every
' state applies a change (act), lets the device settle and prints rects (measure).
'   O*  a grid's own boundingRect outset: MarkupGrid / MarkupList / RowList / ZoomRowList variants.
'   X*  RowList `itemX` (row X) and `item<r>_<c>` for rows/columns outside the visible window.
'   A*  ancestorBoundingRect / ancestorSubBoundingRect through offset, scaled and rotated Groups.

sub init()
    m.nodes = []
    m.targets = []
end sub

function caseNames(unused as dynamic) as object
    return [
        "mg_base", "mg_2x2", "mg_3rows_1content", "mg_nofeedback", "mg_hidden", "mg_plainfocus", "mg_focused",
        "mg_scrolled", "ml_base",
        "rl_base", "rl_big", "rl_label", "rl_nofeedback", "rl_hidden", "rl_fewrows", "rl_small", "rl_rowwide",
        "rl_focused", "rl_scrolled",
        "x_float", "x_fixed", "x_wrap", "x_vfloat",
        "zr_base",
        "a_chain",
        "mg_1x1", "mg_1col_2rows_1content", "mg_3x2_full", "mg_tracks", "ml_1row", "ml_2rows", "ml_3rows_1content", "ml_gap0", "ml_gap30",
        "pg_3rows_1content", "rl_1row_1content", "rl_tracks",
        "lg_mg", "lg_rl", "lg_pg"
    ]
end function

' ---------- builders ----------

function flatContent(count as integer) as object
    content = CreateObject("roSGNode", "ContentNode")
    for i = 0 to count - 1
        item = content.createChild("ContentNode")
        item.title = "I" + i.toStr()
        item.hdGridPosterUrl = "pkg:/images/poster_grey.png"
        item.hdPosterUrl = "pkg:/images/poster_grey.png"
    end for
    return content
end function

function rowContent(rowLengths as object) as object
    content = CreateObject("roSGNode", "ContentNode")
    for r = 0 to rowLengths.count() - 1
        row = content.createChild("ContentNode")
        row.title = "Row " + r.toStr()
        for i = 0 to rowLengths[r] - 1
            item = row.createChild("ContentNode")
            item.title = "R" + r.toStr() + "I" + i.toStr()
            item.hdPosterUrl = "pkg:/images/poster_grey.png"
        end for
    end for
    return content
end function

function addNode(nodeType as string, fields as object, parent = invalid as dynamic) as object
    node = CreateObject("roSGNode", nodeType)
    node.setFields(fields)
    if parent = invalid then parent = m.top
    parent.appendChild(node)
    m.nodes.push(node)
    return node
end function

function markupGrid(fields as object, count as integer) as object
    base = {
        translation: [100, 100], itemComponentName: "ProbeItem", itemSize: [100, 100], numColumns: 3, numRows: 1,
        itemSpacing: [20, 0]
    }
    base.append(fields)
    node = addNode("MarkupGrid", base)
    node.content = flatContent(count)
    return node
end function

function rowList(fields as object, rowLengths as object) as object
    base = {
        translation: [100, 100], itemComponentName: "ProbeItem", itemSize: [600, 100], rowItemSize: [[100, 100]],
        rowItemSpacing: [[20, 0]], numRows: 1, showRowLabel: [false], showRowCounter: [false]
    }
    base.append(fields)
    node = addNode("RowList", base)
    node.content = rowContent(rowLengths)
    return node
end function

sub target(label as string, node as object, parts as object, ancestors = invalid as dynamic)
    if ancestors = invalid then ancestors = []
    m.targets.push({ label: label, node: node, parts: parts, ancestors: ancestors })
end sub

' ---------- case setup: builds nodes, returns the number of states ----------

function setup(name as string) as integer
    m.nodes = []
    m.targets = []
    m.case = name
    states = 1
    gridParts = ["item0", "item1", "focusItem"]
    rowParts = ["item0", "item1", "item0_0", "item0_1", "item1_0", "focusItem"]
    if name = "mg_base"
        target("g", markupGrid({}, 3), gridParts)
    else if name = "mg_2x2"
        target("g", markupGrid({ itemSize: [200, 50], numColumns: 2, numRows: 2, itemSpacing: [10, 10] }, 4), gridParts)
    else if name = "mg_3rows_1content"
        target("g", markupGrid({ numRows: 3, itemSpacing: [20, 20] }, 3), gridParts)
    else if name = "mg_nofeedback"
        target("g", markupGrid({ drawFocusFeedback: false }, 3), gridParts)
    else if name = "mg_hidden"
        target("g", markupGrid({ visible: false }, 3), gridParts)
    else if name = "mg_plainfocus"
        target("g", markupGrid({ focusBitmapUri: "pkg:/images/poster_grey.png" }, 3), gridParts)
    else if name = "mg_focused"
        target("g", markupGrid({}, 3), gridParts)
        states = 2
    else if name = "mg_scrolled"
        target("g", markupGrid({ itemSize: [300, 60], numColumns: 1, numRows: 2, itemSpacing: [0, 10] }, 5), ["item0", "item3", "item4", "focusItem"])
        states = 2
    else if name = "rl_base"
        target("g", rowList({}, [3, 3]), rowParts)
    else if name = "rl_big"
        target("g", rowList({ itemSize: [800, 200], rowItemSize: [[300, 150]], itemSpacing: [0, 30], numRows: 2 }, [3, 3, 3]), rowParts)
    else if name = "rl_label"
        target("g", rowList({ showRowLabel: [true] }, [3, 3]), rowParts)
    else if name = "rl_nofeedback"
        target("g", rowList({ drawFocusFeedback: false }, [3, 3]), rowParts)
    else if name = "rl_hidden"
        target("g", rowList({ visible: false }, [3, 3]), rowParts)
    else if name = "rl_fewrows"
        target("g", rowList({ numRows: 3, itemSpacing: [0, 20] }, [3, 3]), rowParts)
    else if name = "rl_small"
        target("g", rowList({ rowItemSize: [[50, 50]] }, [3, 3]), rowParts)
    else if name = "rl_rowwide"
        target("g", rowList({ rowItemSize: [[600, 100]] }, [3, 3]), rowParts)
    else if name = "rl_focused"
        target("g", rowList({}, [3, 3]), rowParts)
        states = 2
    else if name = "rl_scrolled"
        target("g", rowList({ numRows: 2, itemSpacing: [0, 20] }, [3, 3, 3, 3, 3]), rowParts)
        states = 3
    else if Left(name, 2) = "x_"
        fields = { translation: [100, 200], numRows: 2, itemSpacing: [0, 20] }
        if name = "x_fixed" then fields.rowFocusAnimationStyle = "fixedFocus"
        if name = "x_wrap" then fields.rowFocusAnimationStyle = "fixedFocusWrap"
        if name = "x_vfloat" then fields.vertFocusAnimationStyle = "floatingFocus"
        parts = ["item0", "item1", "item2", "item3", "item4", "item5", "item6", "focusItem"]
        for r = 0 to 5
            for each c in [0, 1, 5, 9]
                parts.push("item" + r.toStr() + "_" + c.toStr())
            end for
        end for
        target("g", rowList(fields, [10, 10, 2, 10, 10, 10]), parts)
        states = 4
    else if name = "zr_base"
        node = addNode("ZoomRowList", {
            translation: [100, 100], itemComponentName: "ProbeItem", rowWidth: 600, rowHeight: [100], rowZoomHeight: [100],
            rowItemHeight: [100], rowItemZoomHeight: [100], rowItemAspectRatio: [1.0], spacingAfterRowItem: [20],
            spacingAfterRow: 20, numRows: 2, showRowTitle: [false], showRowCounter: [false]
        })
        node.content = rowContent([5, 5, 5, 5])
        target("g", node, ["item0", "item1", "item2", "item0_1", "item1_2", "item3_0", "focusItem"])
        states = 2
    else if name = "a_chain"
        setupAncestors()
    else if name = "mg_1x1"
        target("g", markupGrid({ numColumns: 1 }, 1), gridParts)
    else if name = "mg_1col_2rows_1content"
        target("g", markupGrid({ numColumns: 1, numRows: 2, itemSpacing: [0, 10] }, 1), gridParts)
    else if name = "mg_3x2_full"
        target("g", markupGrid({ numRows: 2, itemSpacing: [20, 20] }, 6), ["item0", "item1", "item4", "focusItem"])
    else if name = "mg_tracks"
        target("g", markupGrid({ numColumns: 2, numRows: 2, itemSpacing: [10, 10], columnWidths: [150, 80], rowHeights: [60, 90] }, 4), ["item0", "item1", "item2", "item3"])
    else if Left(name, 3) = "ml_"
        mlRows = { ml_1row: [1, 1, 10], ml_2rows: [2, 2, 10], ml_3rows_1content: [3, 1, 10], ml_base: [3, 3, 10], ml_gap0: [2, 2, 0], ml_gap30: [2, 2, 30] }
        rows = mlRows[name]
        node = addNode("MarkupList", { translation: [100, 100], itemComponentName: "ProbeItem", itemSize: [300, 60], numRows: rows[0], itemSpacing: [0, rows[2]] })
        node.content = flatContent(rows[1])
        target("g", node, gridParts)
    else if name = "pg_3rows_1content"
        node = addNode("PosterGrid", { translation: [100, 100], basePosterSize: [100, 100], numColumns: 3, numRows: 3, itemSpacing: [20, 20] })
        node.content = flatContent(3)
        target("g", node, gridParts)
    else if name = "rl_1row_1content"
        target("g", rowList({}, [3]), rowParts)
    else if name = "rl_tracks"
        target("g", rowList({ numRows: 3, rowHeights: [150, 80], rowSpacings: [10, 40] }, [3, 3, 3]), ["item0", "item1", "item2", "item0_0", "item1_0", "item2_0"])
    else if Left(name, 3) = "lg_"
        lg = addNode("LayoutGroup", { translation: [100, 100], layoutDirection: "vert", itemSpacings: [10] })
        a = addNode("Rectangle", { width: 300, height: 40 }, lg)
        if name = "lg_mg"
            g = CreateObject("roSGNode", "MarkupGrid")
            g.setFields({ itemComponentName: "ProbeItem", itemSize: [100, 100], numColumns: 3, numRows: 1, itemSpacing: [20, 0] })
            g.content = flatContent(3)
        else if name = "lg_rl"
            g = CreateObject("roSGNode", "RowList")
            g.setFields({ itemComponentName: "ProbeItem", itemSize: [600, 100], rowItemSize: [[100, 100]], rowItemSpacing: [[20, 0]], numRows: 1, showRowLabel: [false], showRowCounter: [false] })
            g.content = rowContent([3])
        else
            g = CreateObject("roSGNode", "PosterGrid")
            g.setFields({ basePosterSize: [100, 100], numColumns: 3, numRows: 1, itemSpacing: [20, 0] })
            g.content = flatContent(3)
        end if
        lg.appendChild(g)
        b = addNode("Rectangle", { width: 300, height: 40 }, lg)
        target("lg", lg, [])
        target("a", a, [])
        target("grid", g, ["item0"])
        target("b", b, [])
    end if
    return states
end function

sub setupAncestors()
    g1 = addNode("Group", { id: "g1", translation: [100, 50] })
    addNode("Rectangle", { id: "sib1", translation: [-20, 0], width: 10, height: 10 }, g1)
    g2 = addNode("Group", { id: "g2", translation: [50, 60], scale: [0.5, 0.5] }, g1)
    addNode("Rectangle", { id: "sib2", translation: [-30, -10], width: 10, height: 10 }, g2)
    g3 = addNode("Group", { id: "g3", translation: [30, 40] }, g2)
    r = addNode("Rectangle", { id: "r", translation: [5, 5], width: 40, height: 30 }, g3)
    mg = addNode("MarkupGrid", {
        translation: [10, 20], itemComponentName: "ProbeItem", itemSize: [100, 100], numColumns: 3, numRows: 1,
        itemSpacing: [20, 0]
    }, g3)
    mg.content = flatContent(3)
    h1 = addNode("Group", { id: "h1", translation: [600, 300], rotation: 1.5707963 })
    h2 = addNode("Group", { id: "h2", translation: [20, 0] }, h1)
    rr = addNode("Rectangle", { id: "rr", translation: [10, 0], width: 40, height: 20 }, h2)
    k1 = addNode("Group", { id: "k1", translation: [800, 100], scale: [2, 2], scaleRotateCenter: [50, 50] })
    kr = addNode("Rectangle", { id: "kr", translation: [10, 10], width: 20, height: 20 }, k1)
    abc = [{ l: "g3", n: g3 }, { l: "g2", n: g2 }, { l: "g1", n: g1 }, { l: "scene", n: m.top }, { l: "other", n: h1 }]
    withSelf = [{ l: "self", n: r }]
    withSelf.append(abc)
    target("r", r, [], withSelf)
    target("mg", mg, ["item0", "item1"], abc)
    target("g3", g3, [], [{ l: "g2", n: g2 }, { l: "g1", n: g1 }, { l: "scene", n: m.top }])
    target("rr", rr, [], [{ l: "h2", n: h2 }, { l: "h1", n: h1 }, { l: "scene", n: m.top }])
    target("kr", kr, [], [{ l: "k1", n: k1 }, { l: "scene", n: m.top }])
end sub

' ---------- per-state changes ----------

function act(args as object) as void
    name = args.name
    s = args.s
    if s = 0 then return
    g = m.targets[0].node
    if name = "mg_focused" or name = "rl_focused"
        g.setFocus(true)
    else if name = "mg_scrolled"
        g.jumpToItem = 4
    else if name = "rl_scrolled"
        if s = 1 then g.jumpToRowItem = [3, 0] else g.jumpToRowItem = [4, 2]
    else if Left(name, 2) = "x_"
        if s = 1
            g.jumpToRowItem = [0, 5]
        else if s = 2
            g.jumpToRowItem = [3, 7]
        else
            g.jumpToRowItem = [5, 9]
        end if
    else if name = "zr_base"
        g.jumpToRowItem = [1, 2]
    end if
end function

' ---------- measurement ----------

function fmt(r as object) as string
    return "{" + r.x.toStr() + "," + r.y.toStr() + "," + r.width.toStr() + "," + r.height.toStr() + "}"
end function

function measure(args as object) as void
    tag = "PROBE|" + args.name + "|s" + args.s.toStr() + "|"
    for each t in m.targets
        n = t.node
        print tag; t.label; "|tr|"; n.translation[0].toStr(); ","; n.translation[1].toStr()
        print tag; t.label; "|own|p="; fmt(n.boundingRect()); " l="; fmt(n.localBoundingRect()); " s="; fmt(n.sceneBoundingRect())
        for each p in t.parts
            print tag; t.label; "|"; p; "|p="; fmt(n.subBoundingRect(p)); " l="; fmt(n.localSubBoundingRect(p)); " s="; fmt(n.sceneSubBoundingRect(p))
        end for
        for each a in t.ancestors
            print tag; t.label; "|anc:"; a.l; "|"; fmt(n.ancestorBoundingRect(a.n))
            for each p in t.parts
                print tag; t.label; "|ancsub:"; p; ":"; a.l; "|"; fmt(n.ancestorSubBoundingRect(p, a.n))
            end for
        end for
    end for
end function

function teardown(name as string) as void
    for each n in m.nodes
        parent = n.getParent()
        if parent <> invalid then parent.removeChild(n)
    end for
    m.nodes = []
    m.targets = []
end function
