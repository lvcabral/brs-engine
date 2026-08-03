' PosterGrid outset-axis probe.
'
' Follow-up to the margins probe (postergrid-margins-probe), whose case M4 turned up a divergence
' neither probe was designed to look for. A PosterGrid's reported rect is asymmetric on Y — 14 above the
' first row and 50 below the last (HD; 21/75 FHD), all four values device-measured — EXCEPT that the one
' 3-column case reported the plain symmetric 14 at the bottom:
'
'     1 col x 1 row, poster 100x100     bottom = 50    h = 164
'     1 col x 2 rows                    bottom = 50    h = 264
'     1 col x 1 row, poster 200x200     bottom = 50    h = 264
'     1 col x 1 row, itemSpacing=[0,40] bottom = 50    h = 204
'     3 cols x 1 row                    bottom = 14    h = 128   <-- the odd one out
'
' So the extra 36 (HD) / 54 (FHD) below the last row is NOT unconditional. The problem is that M4 is the
' only wide case in that set, so it confounds at least four candidate causes at once — the probe cannot
' say which, and a fix based on any single guess would be a coin flip.
'
' This probe crosses the axes so each one is isolated. The decisive pair is A2 vs B1: both are 3 columns
' and 1 row, differing ONLY in whether the content extent is taller than it is wide. If A2 (wide) drops
' the outset and B1 (tall, same column count) keeps it, the governing variable is the SHAPE of the
' content, not the column count — and vice versa.
'
' Every case prints the full rect and then its per-side outsets, derived from that case's own declared
' inputs. Nothing here is differenced: differencing is what hid these outsets in the first place.

sub init()
    m.measured = m.top.findNode("measured")
    m.results = []
end sub

function runProbe(unused as dynamic) as void
    res = m.top.currentDesignResolution
    print "=== PosterGrid Outset Axis Probe ==="
    print "resolution = "; res.resolution; " "; res.width; "x"; res.height
    print "itemSpacing = [0,0] and grid.translation = [0,0] throughout unless a case says otherwise"
    print "READ THE `bottom` COLUMN. Every case is a 1-row or 2-row grid whose content extent is known,"
    print "so `bottom` is the whole subject; `left`/`top`/`right` are along as controls."
    print ""

    ' --- Group A: column count, at a FIXED poster size. --------------------------------------------
    ' A1 reproduces the margins probe's M1 (the 50 case) and A2 reproduces its M4 (the 14 case), so this
    ' probe re-derives the divergence before trying to explain it. A3/A4 fill in the gap between them:
    ' if the outset switches off at some column count, this is where it shows.
    measure("A1. 1 col x 1 row, poster 100x100 (M1 repro: expect bottom 50)", 1, 1, 100, 100, {})
    measure("A2. 3 cols x 1 row, poster 100x100 (M4 repro: expect bottom 14)", 3, 1, 100, 100, {})
    measure("A3. 2 cols x 1 row, poster 100x100", 2, 1, 100, 100, {})
    measure("A4. 4 cols x 1 row, poster 100x100", 4, 1, 100, 100, {})

    ' --- Group B: the decisive cross. --------------------------------------------------------------
    ' Same column count as A2 (3), but the content extent is now TALLER than it is wide, achieved two
    ' different ways so neither mechanism is the explanation on its own:
    '   B1 keeps 3 columns and stacks 4 rows        -> 300 wide x 400 tall
    '   B2 keeps 3 columns and 1 row, tall posters  -> 300 wide x 400 tall, ONE row
    ' B1 vs B2 also separates "is it the row count?" from "is it the shape?", because they have the same
    ' extent and differ only in how many rows produce it.
    measure("B1. 3 cols x 4 rows, poster 100x100 (300w x 400h)", 3, 4, 100, 100, {})
    measure("B2. 3 cols x 1 row, poster 100x400 (300w x 400h, one row)", 3, 1, 100, 400, {})

    ' --- Group C: aspect at a FIXED column count of 1. ---------------------------------------------
    ' The mirror of group B. If shape is what governs, a SINGLE-column grid that is wider than it is tall
    ' must also lose the outset — C2/C3 are exactly that, and they cannot be explained by column count
    ' because there is only one column.
    measure("C1. 1 col x 1 row, poster 400x100 (400w x 100h, wide)", 1, 1, 400, 100, {})
    measure("C2. 1 col x 1 row, poster 100x400 (100w x 400h, tall)", 1, 1, 100, 400, {})
    measure("C3. 1 col x 1 row, poster 200x200 (square)", 1, 1, 200, 200, {})

    ' --- Group D: is it the SCREEN, not the content? -----------------------------------------------
    ' A 3x1 grid of 100px posters is 300 wide; a 1x1 is 100. Both are far narrower than the screen, so
    ' "wider than the screen" cannot be it — but "wider than some fraction of it" could, and so could a
    ' flat threshold in the 100..400 range. D1/D2 push a single-column grid past 3 columns' worth of
    ' width without adding a column, and D3 makes a 3-column grid narrow.
    measure("D1. 1 col x 1 row, poster 700x100 (very wide, one column)", 1, 1, 700, 100, {})
    measure("D2. 1 col x 1 row, poster 100x700 (very tall, one column)", 1, 1, 100, 700, {})
    measure("D3. 3 cols x 1 row, poster 30x100 (90w, narrow, 3 columns)", 3, 1, 30, 100, {})

    ' --- Group E: does a caption zone change the answer? ------------------------------------------
    ' The margins probe measured every bottom-50 case WITHOUT captions, and the caption zone is itself
    ' appended below the last row. If the extra 36 is really a mis-attributed caption allowance, a
    ' captioned 3-column grid would behave differently from an uncaptioned one. E1/E2 pair up with A2.
    measure("E1. 3 cols x 1 row, caption1NumLines=1", 3, 1, 100, 100, { caption1NumLines: 1 })
    measure("E2. 1 col x 1 row, caption1NumLines=1", 1, 1, 100, 100, { caption1NumLines: 1 })

    ' --- Group F: explicit sizing, and a partly-filled last row. ----------------------------------
    ' F1/F2 set itemSize/numRows explicitly rather than letting basePosterSize drive them, in case the
    ' outset tracks a DECLARED size rather than the measured content. F3 gives 3 columns only 2 items, so
    ' the last row is short — if the outset follows the drawn extent it stays, and if it follows the
    ' declared grid it goes.
    measure("F1. 3 cols x 1 row, itemSize=[100,100] explicit", 3, 1, 100, 100, { itemSize: [100, 100] })
    measure("F2. 1 col x 1 row, itemSize=[100,100] explicit", 1, 1, 100, 100, { itemSize: [100, 100] })
    measureItems("F3. 3 cols x 1 row, only 2 items (short last row)", 3, 1, 100, 100, {}, 2)

    printSummary()

    print ""
    print "=== Probe complete ==="
end function

sub measure(label as string, cols as integer, rows as integer, posterW as integer, posterH as integer, fields as object)
    measureItems(label, cols, rows, posterW, posterH, fields, cols * rows)
end sub

' Builds a PosterGrid, prints its full reported rect, then removes it. `items` is separate from
' cols*rows so a partly-filled last row can be tested (case F3).
sub measureItems(label as string, cols as integer, rows as integer, posterW as integer, posterH as integer, fields as object, items as integer)
    grid = CreateObject("roSGNode", "PosterGrid")
    grid.basePosterSize = [posterW, posterH]
    grid.itemSpacing = [0, 0]
    grid.numColumns = cols
    grid.numRows = rows
    grid.enableCaptionScrolling = false

    for each key in fields
        grid.setField(key, fields[key])
    end for

    content = CreateObject("roSGNode", "ContentNode")
    for i = 0 to items - 1
        item = content.createChild("ContentNode")
        ' Single short words: nothing can wrap, so a height change is reserved space and never a
        ' wrapped line. Only group E requests a caption zone at all.
        item.shortDescriptionLine1 = "One"
        item.shortDescriptionLine2 = "Two"
    end for
    grid.content = content

    m.measured.appendChild(grid)
    rect = grid.boundingRect()
    local = grid.localBoundingRect()
    print label
    print "    rect  x = "; rect.x; "  y = "; rect.y; "  w = "; rect.width; "  h = "; rect.height
    print "    local x = "; local.x; "  y = "; local.y; "  w = "; local.width; "  h = "; local.height
    m.measured.removeChild(grid)

    ' Rows actually drawn: a short last row still occupies a full row (F3), so round up. `/` is float
    ' division in BrightScript, so this must be an explicit integer ceiling — a fractional row count
    ' would print a fractional content extent and make `bottom` unreadable.
    drawnRows = rows
    if items < cols * rows
        drawnRows = items \ cols
        if items MOD cols > 0 then drawnRows = drawnRows + 1
        if drawnRows < 1 then drawnRows = 1
    end if
    m.results.push({
        label: label,
        rect: rect,
        contentW: cols * posterW,
        contentH: drawnRows * posterH,
        cols: cols
    })
end sub

' Re-lists every rect as per-side outsets, derived from each case's own declared inputs, plus the
' content extent and its aspect — the two candidate governing variables side by side.
sub printSummary()
    print ""
    print "--- per-side outsets (derived from each case's own declared inputs) ---"
    print "    left = -x    top = -y    right = w - contentW - left    bottom = h - contentH - top"
    print "    `shape` is the CONTENT extent, the thing groups B and C cross against column count."
    print ""
    for each r in m.results
        left = -r.rect.x
        top = -r.rect.y
        right = r.rect.width - r.contentW - left
        bottom = r.rect.height - r.contentH - top
        shape = "tall "
        if r.contentW > r.contentH
            shape = "wide "
        else if r.contentW = r.contentH
            shape = "square"
        end if
        print "    bottom = "; bottom; "   left = "; left; " top = "; top; " right = "; right; "   cols = "; r.cols; " content = "; r.contentW; "x"; r.contentH; " "; shape; "   "; r.label
    end for

    print ""
    print "--- how to read it ---"
    print "    A2 vs B1: same 3 columns, wide vs tall content. Differing bottoms => SHAPE governs."
    print "    A2 vs A3/A4: if the bottom switches at a column count, it is COLUMN COUNT."
    print "    C1 vs C2: one column throughout, wide vs tall. Differing bottoms => SHAPE, not columns."
    print "    B1 vs B2: same 300x400 extent, 4 rows vs 1. Differing bottoms => ROW COUNT matters too."
    print "    D3: 3 columns but only 90 wide. Follows A2 => columns; follows A1 => width/shape."
    print "    E1 vs E2: if a caption zone changes which rule applies, the 36 is caption-related."
    print "    If every case reports bottom = 50 except A2, re-run: A2 is then not reproducing."
end sub
