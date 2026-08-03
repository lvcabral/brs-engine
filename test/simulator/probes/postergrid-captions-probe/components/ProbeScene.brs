' PosterGrid caption-zone probe.
'
' Measures how much vertical space a device reserves per PosterGrid cell, isolating ONE unknown per
' case. Every poster is 100x100 with itemSpacing = [0,0], so a cell's reported height is entirely
' poster + whatever the caption zone contributes.
'
' Each case reports h1 (1 row), h2 (2 rows) and CELL = h2 - h1. Differencing the row counts is the
' point: it cancels the grid's own reported outset (rectMargins, HD 14) and any trailing-gap rule,
' both of which are already measured and are NOT what this probe is about. Read CELL, not h1.

sub init()
    m.holder = m.top.findNode("holder")
    m.results = []
end sub

' Called from Main (see source/main.brs) so the app can close the screen and exit afterwards.
function runProbe(unused as dynamic) as void
    print "=== PosterGrid Caption Zone Probe ==="
    print "resolution = "; m.top.currentDesignResolution.resolution; " "; m.top.currentDesignResolution.width; "x"; m.top.currentDesignResolution.height
    print "poster = 100x100, itemSpacing = [0,0], numColumns = 1"
    print ""

    ' --- Case 0: the baseline. No captions requested at all. -------------------------------------
    ' Device (HD) previously read CELL = 136 here, i.e. +36 over the poster. This case re-confirms
    ' that reading and anchors every case below.
    measure("0.  baseline, no captions", {})

    ' --- Case A: is the +36 a CAPTION zone at all? -----------------------------------------------
    ' `captionVertAlignment` = "center"/"top"/"bottom" draws the caption OVER the poster, so no
    ' zone is needed. If CELL is still 136 here, the +36 is cell padding, not a caption zone, and
    ' the fix belongs in the cell-height arithmetic rather than in computeCaptionMetrics.
    measure("A1. no captions, captionVertAlignment=center", { captionVertAlignment: "center" })
    measure("A2. no captions, captionVertAlignment=above", { captionVertAlignment: "above" })

    ' --- Case B: caption1NumLines 1..3 — the per-line increment. ---------------------------------
    ' Two data points (0 and 1) cannot separate a base zone from a per-line height. 3 points can:
    '   base + n*line   -> CELL differences are constant
    '   n*line only     -> CELL(1) - CELL(0) equals CELL(2) - CELL(1) AND CELL(0) == poster
    measure("B1. caption1NumLines=1", { caption1NumLines: 1 })
    measure("B2. caption1NumLines=2", { caption1NumLines: 2 })
    measure("B3. caption1NumLines=3", { caption1NumLines: 3 })

    ' --- Case C: does the zone depend on the TEXT being present? ---------------------------------
    ' The engine reserves purely from caption1NumLines and ignores whether the ContentNode actually
    ' has shortDescriptionLine1. If the device shrinks when the text is absent, reservation is
    ' content-driven and `resolveCaptionLines` is the wrong input.
    measure("C1. caption1NumLines=1, no text", { caption1NumLines: 1, noText: true })
    measure("C2. caption1NumLines=2, no text", { caption1NumLines: 2, noText: true })

    ' --- Case D: caption2 alone, and both together. ----------------------------------------------
    ' The engine sums height1 + height2 + one lineSpacing between the two blocks
    ' (computeCaptionMetrics). D1/D2 test whether caption2 costs the same as caption1; D3/D4 test
    ' whether stacking them costs exactly the sum, or adds a gap the engine models as lineSpacing
    ' (which defaults to 0, so any device gap here is currently unmodelled).
    measure("D1. caption2NumLines=1 only", { caption2NumLines: 1 })
    measure("D2. caption2NumLines=2 only", { caption2NumLines: 2 })
    measure("D3. caption1=1 + caption2=1", { caption1NumLines: 1, caption2NumLines: 1 })
    measure("D4. caption1=2 + caption2=2", { caption1NumLines: 2, caption2NumLines: 2 })

    ' --- Case E: captionLineSpacing. -------------------------------------------------------------
    ' The engine adds lineSpacing between lines WITHIN a block (n-1 times) and once BETWEEN the two
    ' blocks. E1 (single line) should therefore be unaffected by it; if the device changes anyway,
    ' the spacing is applied per line rather than per gap.
    measure("E1. caption1NumLines=1, lineSpacing=20", { caption1NumLines: 1, captionLineSpacing: 20 })
    measure("E2. caption1NumLines=2, lineSpacing=20", { caption1NumLines: 2, captionLineSpacing: 20 })
    measure("E3. caption1=1+caption2=1, lineSpacing=20", { caption1NumLines: 1, caption2NumLines: 1, captionLineSpacing: 20 })

    ' --- Case F: is the zone font-metric-driven? -------------------------------------------------
    ' Default caption font is SmallerBoldSystemFont (HD 20pt / FHD 30pt). LargestSystemFont is
    ' 3x that. If CELL is unchanged across F1/F2, the zone is a constant and the engine's
    ' measureFontHeight() term is wrong; if it tracks the font, compare the delta against the
    ' Label line heights printed at the end.
    measure("F1. caption1NumLines=1, caption1Font=Largest", { caption1NumLines: 1, caption1Font: "font:LargestSystemFont" })
    measure("F2. caption1NumLines=2, caption1Font=Largest", { caption1NumLines: 2, caption1Font: "font:LargestSystemFont" })
    measure("F3. caption1NumLines=1, caption1Font=Tiny", { caption1NumLines: 1, caption1Font: "font:TinySystemFont" })
    measure("F4. caption1=1+caption2=1, caption2Font=Largest", { caption1NumLines: 1, caption2NumLines: 1, caption2Font: "font:LargestSystemFont" })

    ' --- Case G: does the poster size scale the zone? --------------------------------------------
    ' If the base zone is a fraction of basePosterSize rather than a flat constant, that is a new
    ' axis and needs its own follow-up. Cheap to rule out here.
    measure("G1. baseline, poster 200x200", { basePosterSize: [200, 200] })
    measure("G2. caption1NumLines=1, poster 200x200", { caption1NumLines: 1, basePosterSize: [200, 200] })
    measure("G3. baseline, poster 100x300", { basePosterSize: [100, 300] })

    printSummary()
    printFontHeights()

    print ""
    print "=== PosterGrid Caption Zone Probe Complete ==="
end function

' Builds a PosterGrid with `rows` content items and returns its reported boundingRect height.
function gridHeight(rows as integer, fields as object) as float
    grid = CreateObject("roSGNode", "PosterGrid")
    grid.basePosterSize = [100, 100]
    grid.itemSpacing = [0, 0]
    grid.numColumns = 1
    grid.numRows = rows

    noText = false
    for each key in fields
        if key = "noText"
            noText = fields[key]
        else if key = "caption1Font"
            ' Dot assignment, not setField: a font-typed field takes a "font:<Name>" string only
            ' through the assignment path, which converts it to a Font node. setField type-checks
            ' first and rejects the string outright.
            grid.caption1Font = fields[key]
        else if key = "caption2Font"
            grid.caption2Font = fields[key]
        else
            grid.setField(key, fields[key])
        end if
    end for

    content = CreateObject("roSGNode", "ContentNode")
    for i = 0 to rows - 1
        item = content.createChild("ContentNode")
        if not noText
            ' Single short words: nothing here can wrap, so a measured height change is the
            ' reserved zone and never an extra wrapped line.
            item.shortDescriptionLine1 = "One"
            item.shortDescriptionLine2 = "Two"
        end if
    end for
    grid.content = content

    m.holder.appendChild(grid)
    height = grid.boundingRect().height
    m.holder.removeChild(grid)
    return height
end function

' Measures one case at 1 and 2 rows and prints h1, h2 and the differenced cell height.
sub measure(label as string, fields as object)
    h1 = gridHeight(1, fields)
    h2 = gridHeight(2, fields)
    cell = h2 - h1
    print label
    print "    h1 = "; h1; "   h2 = "; h2; "   CELL = "; cell
    m.results.push({ label: label, h1: h1, h2: h2, cell: cell })
end sub

' Re-prints every CELL against the case-0 baseline, so the increments read off directly.
sub printSummary()
    print ""
    print "--- CELL summary (poster height = 100 unless noted) ---"
    base = m.results[0].cell
    for each r in m.results
        print "    CELL = "; r.cell; "   over baseline = "; r.cell - base; "   "; r.label
    end for
end sub

' The device's own line height for each font used above. If the caption zone is font-metric-driven,
' the per-line increment must be expressible in these numbers; if it is not, it is a constant.
sub printFontHeights()
    print ""
    print "--- Label line heights (device font metrics) ---"
    fonts = ["font:SmallerBoldSystemFont", "font:LargestSystemFont", "font:TinySystemFont"]
    for each f in fonts
        label = CreateObject("roSGNode", "Label")
        label.font = f
        label.text = "One"
        m.holder.appendChild(label)
        rect = label.boundingRect()
        print "    "; f; "  height = "; rect.height
        m.holder.removeChild(label)
    end for
end sub
