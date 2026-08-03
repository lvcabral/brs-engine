' PosterGrid margins / caption-placement probe.
'
' The captions probe (postergrid-captions-probe) decoded the grid's vertical extent from 88 readings,
' but it only ever printed `boundingRect().height`. Three values in PosterGrid therefore ride along on
' that run WITHOUT being measured by it, and are marked as inferences in the source:
'
'   1. the FHD split of the vertical outset (21 above / 75 below) — only the SUM, 96, is measured
'   2. the FHD horizontal outset (21) — never measured at all, on either side
'   3. CaptionTextOffset (12) — where caption text starts INSIDE the reserved zone
'   4. (also open) whether the device's DEFAULT caption2Font is the non-bold face
'
' Groups M and N settle 1, 2 and 4 numerically over telnet. Group P settles 3, and is the one case that
' CANNOT be numeric: on a device the caption Label lives inside an internal item component, so neither
' findNode nor localSubBoundingRect can reach it. P is therefore read from a screenshot — but by
' SUBTRACTING a real cell's ink position from that of a reconstruction placed at a known offset of zero
' in the same frame, so the glyph-box-vs-line-box term cancels instead of being guessed at.
'
' Every rect is printed in full (x, y, w, h). Do NOT difference row counts here the way the captions
' probe did — differencing is what cancelled the outsets, and the outsets are the subject this time.

' Uniform cap height, flat top and bottom, no ascenders or descenders to argue about when locating the
' first inked row — and short enough not to wrap inside a 100px poster at either resolution.
function captionWord() as string
    return "HHH"
end function

sub init()
    m.measured = m.top.findNode("measured")
    m.ladder = m.top.findNode("ladder")
    m.results = []
end sub

' Called from Main. Groups M and N print and tear down; group P is left on screen for the screenshot.
function runProbe(unused as dynamic) as void
    res = m.top.currentDesignResolution
    print "=== PosterGrid Margins / Caption Placement Probe ==="
    print "resolution = "; res.resolution; " "; res.width; "x"; res.height
    print "poster = 100x100 unless noted, itemSpacing = [0,0], grid.translation = [0,0] unless noted"
    print ""

    ' --- Group M: the grid's own outset, per side. ------------------------------------------------
    ' `boundingRect()` is in the PARENT's coordinate system and `measured` sits at [0,0], so for a grid
    ' at translation [0,0] the outsets read off directly:
    '
    '     left = -x        top = -y        right = width - contentWidth - left
    '     bottom = height - contentHeight - top
    '
    ' The captions probe never printed x, y or width, which is exactly why 2 and part of 1 are open.
    ' M1 alone answers both at FHD; M2-M5 are the controls that make M1 trustworthy.
    measureRect("M1. 1 col x 1 row, poster 100x100", 1, 1, {})
    measureRect("M2. same, grid.translation=[300,200]", 1, 1, { translation: [300, 200] })
    measureRect("M3. 1 col x 2 rows", 1, 2, {})
    measureRect("M4. 3 cols x 1 row", 3, 1, {})
    measureRect("M5. 1 col x 1 row, poster 200x200", 1, 1, { basePosterSize: [200, 200] })
    measureRect("M6. 1 col x 1 row, itemSpacing=[0,40]", 1, 1, { itemSpacing: [0, 40] })

    ' --- Group N: is the DEFAULT caption2Font the non-bold face? ----------------------------------
    ' The captions probe measured caption2's defaulted per-line cost at 20 HD / 29 FHD against
    ' caption1's 21 / 31, yet the two were EQUAL when both were set explicitly to the same font. That
    ' is an inference from two increments, not a font identity. Here it becomes a direct comparison:
    ' SmallerSystemFont and SmallerBoldSystemFont are the SAME point size (20 HD / 30 FHD) and differ
    ' only in weight, so if the defaulted caption2 matches the non-bold one and not the bold one, the
    ' default is the non-bold face and nothing else can explain it.
    '
    '     N1 == N2 and N1 <> N3  ->  default caption2Font is the NON-BOLD face
    '     N1 == N3               ->  default is bold, and the 20-vs-21 gap is something else entirely
    measureRect("N1. caption2NumLines=1, font defaulted", 1, 1, { caption2NumLines: 1 })
    measureRect("N2. caption2NumLines=1, caption2Font=Smaller (non-bold)", 1, 1, { caption2NumLines: 1, caption2Font: "font:SmallerSystemFont" })
    measureRect("N3. caption2NumLines=1, caption2Font=SmallerBold", 1, 1, { caption2NumLines: 1, caption2Font: "font:SmallerBoldSystemFont" })
    measureRect("N4. caption1NumLines=1, font defaulted (bold anchor)", 1, 1, { caption1NumLines: 1 })
    measureRect("N5. caption1NumLines=1, caption1Font=Smaller (non-bold)", 1, 1, { caption1NumLines: 1, caption1Font: "font:SmallerSystemFont" })

    printSummary()
    printFontHeights()
    buildCaptionLadder()

    print ""
    print "=== Probe printing complete — group P is on screen, take a screenshot now ==="
end function

' Builds a PosterGrid, prints its full reported rect, then removes it.
sub measureRect(label as string, cols as integer, rows as integer, fields as object)
    grid = CreateObject("roSGNode", "PosterGrid")
    grid.basePosterSize = [100, 100]
    grid.itemSpacing = [0, 0]
    grid.numColumns = cols
    grid.numRows = rows
    ' A plain Label honors captionHorizAlignment and has no scroll animation, so the caption geometry
    ' is static. Group P reconstructs it with a plain Label, and N compares heights — both want this off.
    grid.enableCaptionScrolling = false

    for each key in fields
        if key = "caption1Font" or key = "caption2Font"
            ' Dot assignment, not setField: a font-typed field accepts a "font:<Name>" string only
            ' through the assignment path. setField type-checks first and rejects the string.
            if key = "caption1Font"
                grid.caption1Font = fields[key]
            else
                grid.caption2Font = fields[key]
            end if
        else
            grid.setField(key, fields[key])
        end if
    end for

    content = CreateObject("roSGNode", "ContentNode")
    for i = 0 to (cols * rows) - 1
        item = content.createChild("ContentNode")
        ' Single short words: nothing here can wrap, so any height change is reserved space and never
        ' an extra wrapped line.
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
    m.results.push({ label: label, rect: rect, cols: cols, rows: rows })
end sub

' Re-lists every rect as PER-SIDE outsets, so the four numbers this probe exists for read off directly
' instead of being solved by hand. The content extent is derived from the case's own declared inputs.
sub printSummary()
    print ""
    print "--- per-side outsets (derived from each case's own declared inputs) ---"
    print "    left = tx - x    top = ty - y    right = w - contentW - left    bottom = h - contentH - top"
    for each r in m.results
        contentW = r.cols * 100
        contentH = r.rows * 100
        tx = 0
        ty = 0
        if r.label.instr("translation=[300,200]") > 0
            tx = 300
            ty = 200
        end if
        if r.label.instr("poster 200x200") > 0
            contentW = r.cols * 200
            contentH = r.rows * 200
        end if
        if r.label.instr("itemSpacing=[0,40]") > 0
            ' The gap AFTER the last row counts toward the reported extent (device-measured), so a
            ' 1-row grid at itemSpacing.y=40 carries one trailing gap.
            contentH = contentH + 40 * r.rows
        end if
        left = tx - r.rect.x
        top = ty - r.rect.y
        print "    left = "; left; "  top = "; top; "  right = "; r.rect.width - contentW - left; "  bottom = "; r.rect.height - contentH - top; "   "; r.label
    end for
end sub

' The device's own Label line height per font. N's discriminator needs the non-bold/bold pair at the
' same point size, and group P needs the caption font's height to size its reconstruction identically.
sub printFontHeights()
    print ""
    print "--- Label line heights (device font metrics) ---"
    fonts = ["font:SmallerSystemFont", "font:SmallerBoldSystemFont", "font:MediumSystemFont", "font:MediumBoldSystemFont"]
    for each f in fonts
        print "    "; f; "  height = "; labelHeight(f)
    end for
end sub

function labelHeight(font as string) as float
    label = CreateObject("roSGNode", "Label")
    label.font = font
    label.text = "Hxg"
    m.measured.appendChild(label)
    h = label.boundingRect().height
    m.measured.removeChild(label)
    return h
end function

' --- Group P: where does caption text start inside the reserved zone? ----------------------------
'
' Read from a SCREENSHOT, by SUBTRACTION — never by judging alignment. Each pair is a real PosterGrid
' cell next to a hand-built reconstruction of that same cell: identical poster bitmap, identical font,
' text, box width, box height, alignment and line spacing, differing ONLY in that the reconstruction's
' caption box is placed at a known offset of exactly 0 below the poster's bottom edge.
'
' The offset is then pure arithmetic:
'
'     CaptionTextOffset = firstInkedRow(real column) - firstInkedRow(offset-0 reconstruction)
'
' Both columns render the same glyphs, in the same font, in a box of the same height, with the same
' vertical alignment, over posters whose bottom edges share a scene y. So the unknown "where does ink
' sit inside its own box" term is IDENTICAL on both sides and cancels — and so does anti-aliasing. That
' term is the one thing a screenshot cannot otherwise reveal, and it is exactly what an eyeballed ladder
' of candidate offsets would be guessing at.
'
' Captions are drawn pure red on red-free posters, so locating ink is a channel test rather than a
' visual judgement. `decode-caption-offset.js` next to this file does the reading.
'
' TWO pairs, on purpose. P1/P2 use caption1 alone; P3/P4 stack caption1 + caption2. If the two pairs
' disagree, a single CaptionTextOffset constant cannot express the device's behavior — a finding, not a
' decode error. Stacking is used rather than caption1NumLines=2 deliberately: a wrapped 2-line caption
' needs text that is narrower than the poster at BOTH resolutions, and the first run of this probe found
' out the hard way that a 5-glyph word is not — it ellipsized at FHD, silently turning P4 into a
' 1-line column. Stacked single-line captions cannot wrap at all, so the fixture behaves identically at
' HD and FHD. The reconstruction still self-checks `isTextEllipsized` and shouts if that ever changes.
sub buildCaptionLadder()
    captionFont = "font:SmallerBoldSystemFont"
    lineH = labelHeight(captionFont)
    posterY = 260
    posterBottom = posterY + 100
    xReal1 = 60
    xRecon1 = 260
    xReal2 = 460
    xRecon2 = 660

    print ""
    print "--- group P: caption placement, read from a SCREENSHOT by subtraction ---"
    print "    caption font = "; captionFont; "  device line height = "; lineH
    print "    every poster is 100x100 with its BOTTOM EDGE at scene y = "; posterBottom
    print "    P1 real, caption1 only        x = "; xReal1; " .. "; xReal1 + 100
    print "    P2 reconstruction, offset 0   x = "; xRecon1; " .. "; xRecon1 + 100
    print "    P3 real, caption1 + caption2  x = "; xReal2; " .. "; xReal2 + 100
    print "    P4 reconstruction, offset 0   x = "; xRecon2; " .. "; xRecon2 + 100
    print "    CaptionTextOffset = firstInkedRow(P1) - firstInkedRow(P2), and likewise P3 - P4"
    print "    captions are pure red (0xFF0000FF); posters are red-free grey"

    addRealColumn(xReal1, posterY, false)
    addReconstruction(xRecon1, posterY, false, captionFont, lineH)
    addRealColumn(xReal2, posterY, true)
    addReconstruction(xRecon2, posterY, true, captionFont, lineH)

    ' A 1px green rule along every poster's bottom edge. NOT the measurement — it is a registration
    ' mark, so a reader can confirm from the screenshot alone that all four posters really are flush
    ' and that the two subtractions are comparing the same baseline.
    rule = CreateObject("roSGNode", "Rectangle")
    rule.color = "0x00FF00FF"
    rule.width = xRecon2 + 100
    rule.height = 1
    rule.translation = [0, posterBottom]
    m.ladder.appendChild(rule)

    addTag(xReal1, posterY - 30, "P1 real c1")
    addTag(xRecon1, posterY - 30, "P2 recon 0")
    addTag(xReal2, posterY - 30, "P3 real c1c2")
    addTag(xRecon2, posterY - 30, "P4 recon 0")
end sub

' A real one-cell PosterGrid whose caption is drawn in pure red. Its poster's top-left lands exactly at
' the grid's translation: the outset this probe is measuring applies to the REPORTED rect only, never to
' paint (that separation is itself device-confirmed — see the grid-sub-rect invariant), so all four
' columns' posters line up from a plain translation. That is what makes the row subtraction valid.
sub addRealColumn(x as integer, y as integer, stacked as boolean)
    grid = CreateObject("roSGNode", "PosterGrid")
    grid.basePosterSize = [100, 100]
    grid.itemSpacing = [0, 0]
    grid.numColumns = 1
    grid.numRows = 1
    grid.caption1NumLines = 1
    grid.caption1Color = "0xFF0000FF"
    grid.captionHorizAlignment = "center"
    grid.enableCaptionScrolling = false
    ' Override the caption background with a fully transparent bitmap. `showBackgroundForEmptyCaptions`
    ' is NOT enough: these cells DO have caption text, so the default 9-patch still draws — a black band
    ' behind the real column's glyphs that the reconstruction (drawn straight onto the scene) does not
    ' have. Anti-aliased red edges then cross the decoder's threshold at a different alpha on each side,
    ' biasing the first inked row by up to a pixel. This subtraction has to separate 12 from 11, so both
    ' sides must render over the same backdrop.
    grid.captionBackgroundBitmapUri = "pkg:/images/transparent.png"
    grid.showBackgroundForEmptyCaptions = false
    if stacked
        grid.caption2NumLines = 1
        grid.caption2Color = "0xFF0000FF"
    end if

    grid.translation = [x, y]
    content = CreateObject("roSGNode", "ContentNode")
    item = content.createChild("ContentNode")
    item.shortDescriptionLine1 = captionWord()
    if stacked
        item.shortDescriptionLine2 = captionWord()
    end if
    item.hdGridPosterUrl = "pkg:/images/poster_grey.png"
    grid.content = content
    m.ladder.appendChild(grid)
end sub

' A hand-built copy of that cell with its FIRST caption box at offset EXACTLY 0 below the poster.
sub addReconstruction(x as integer, y as integer, stacked as boolean, font as string, lineH as float)
    poster = CreateObject("roSGNode", "Poster")
    poster.uri = "pkg:/images/poster_grey.png"
    poster.width = 100
    poster.height = 100
    poster.translation = [x, y]
    m.ladder.appendChild(poster)

    addCaptionCopy(x, y + 100, font, lineH)
    if stacked
        ' captionLineSpacing defaults to 0, so the second block starts immediately after the first.
        ' Only the FIRST block's top row is read, but the second has to be present or the two columns
        ' would not be rendering the same thing.
        addCaptionCopy(x, y + 100 + lineH, font, lineH)
    end if
end sub

' One caption Label, matching what PosterGridItem builds for a single-line block.
sub addCaptionCopy(x as integer, y as float, font as string, lineH as float)
    label = CreateObject("roSGNode", "Label")
    label.font = font
    label.text = captionWord()
    label.color = "0xFF0000FF"
    label.width = 100
    label.height = lineH
    label.horizAlign = "center"
    ' A Label defaults lineSpacing to 8 (HD) / 12 (FHD), but a PosterGrid caption is given
    ' captionLineSpacing, which defaults to 0. Copy that explicitly — the default would change the box's
    ' usable height and, with it, where a centered line lands.
    label.lineSpacing = 0
    ' PosterGridItem's own choice for a single-line block (see updateCaptionNode): centered in a box one
    ' line tall, not wrapped. Get this wrong and the subtraction measures an alignment difference.
    label.vertAlign = "center"
    label.translation = [x, y]
    m.ladder.appendChild(label)

    ' Self-check, printed to the log. An ellipsized reconstruction is not rendering what the real column
    ' renders, and the subtraction would still print a plausible-looking number. Fail loudly instead.
    if label.isTextEllipsized
        print "    !! WARNING: reconstruction caption at ("; x; ","; y; ") ELLIPSIZED — group P INVALID"
    end if
end sub

' Small caption above a ladder column, so the screenshot is self-describing without the telnet log.
sub addTag(x as integer, y as integer, text as string)
    tag = CreateObject("roSGNode", "Label")
    tag.font = "font:SmallestSystemFont"
    tag.text = text
    tag.color = "0xFFFF00FF"
    tag.translation = [x, y]
    m.ladder.appendChild(tag)
end sub
