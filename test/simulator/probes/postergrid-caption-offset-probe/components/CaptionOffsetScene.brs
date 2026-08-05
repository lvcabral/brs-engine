' PosterGrid caption-offset probe — re-measures CaptionTextOffset for two variables the original
' postergrid-margins-probe (group P) never covered.
'
' Group P (test/simulator/probes/postergrid-margins-probe) measured CaptionTextOffset = 0 by
' subtracting a real PosterGrid cell's first inked caption row from a hand-built reconstruction's,
' at both resolutions, for two caption-block counts. That settled the constant IN THE FIXTURE IT
' USED: `caption1Font = "font:SmallerBoldSystemFont"` and `captionBackgroundBitmapUri` overridden to
' a transparent bitmap (to keep ink detection clean).
'
' Neither of those matches PosterGridExample (github.com/rokudev/samples), which reported a visible
' top margin above the caption that the engine's CaptionTextOffset = 0 does not reproduce. That
' sample uses:
'   - caption1Font = "font:SmallerSystemFont"  (NON-BOLD — group P only ever tested bold)
'   - the DEFAULT captionBackgroundBitmapUri   (group P deliberately overrode this to transparent)
'
' This probe holds group P's method fixed (real cell vs. offset-0 reconstruction, read by red-ink
' row subtraction from a screenshot) and varies exactly those two things, so a device run tells us
' whether either explains the discrepancy — or whether CaptionTextOffset itself needs a new value.
'
' Every pair uses `captionVertAlignment = "below"` (the field default, and what the sample uses).

' Uniform cap height, flat top and bottom, no ascenders/descenders to argue about when locating the
' first inked row — and short enough not to wrap inside a 100px poster at either resolution.
function captionWord() as string
    return "HHH"
end function

sub init()
    m.ladder = m.top.findNode("ladder")
end sub

function runProbe(unused as dynamic) as void
    res = m.top.currentDesignResolution
    print "=== PosterGrid Caption Offset Probe ==="
    print "resolution = "; res.resolution; " "; res.width; "x"; res.height
    print "every poster is 100x100, captionVertAlignment = below (the field default)"
    print ""

    boldFont = "font:SmallerBoldSystemFont"
    plainFont = "font:SmallerSystemFont"
    boldLineH = labelHeight(boldFont)
    plainLineH = labelHeight(plainFont)
    print "bold line height  ("; boldFont; ") = "; boldLineH
    print "plain line height ("; plainFont; ") = "; plainLineH
    print ""

    posterY = 260
    posterBottom = posterY + 100
    ' 155px pitch, not 120: at FHD the tag Labels render 1.5x wider than at HD off the same design
    ' coordinates, and 120 let neighboring tags overlap into an unreadable smear on an FHD capture.
    xC1 = 60   ' real,  bold,  transparent bg, single   — CONTROL: reproduces group P's known 0
    xC2 = 215  ' recon, bold,  offset 0,       single   — pairs with C1 and C8
    xC3 = 370  ' real,  plain, transparent bg, single   — NEW: font weight
    xC4 = 525  ' recon, plain, offset 0,       single   — pairs with C3, C5, C6/C7 stacked pair below
    xC5 = 680  ' real,  plain, DEFAULT bg,     single   — NEW: default caption background
    xC6 = 835  ' real,  plain, transparent bg, stacked  — cross-check: does block count still agree?
    xC7 = 990  ' recon, plain, offset 0,       stacked  — pairs with C6
    xC8 = 1145 ' real,  bold,  DEFAULT bg,     single   — NEW: default caption background, bold

    print "    C1 real  bold  transparent single        x = "; xC1; " .. "; xC1 + 100
    print "    C2 recon bold  offset 0    single         x = "; xC2; " .. "; xC2 + 100
    print "    C3 real  plain transparent single        x = "; xC3; " .. "; xC3 + 100
    print "    C4 recon plain offset 0    single         x = "; xC4; " .. "; xC4 + 100
    print "    C5 real  plain DEFAULT-bg  single         x = "; xC5; " .. "; xC5 + 100
    print "    C6 real  plain transparent stacked        x = "; xC6; " .. "; xC6 + 100
    print "    C7 recon plain offset 0    stacked        x = "; xC7; " .. "; xC7 + 100
    print "    C8 real  bold  DEFAULT-bg  single         x = "; xC8; " .. "; xC8 + 100
    print ""
    print "pairs to decode (see decode-caption-offset.js):"
    print "    control        : C1 - C2   (expect 0, matches postergrid-margins-probe group P)"
    print "    font weight    : C3 - C4   (plain caption1Font, transparent bg)"
    print "    default bg     : C5 - C4   (plain caption1Font, DEFAULT bg)"
    print "    plain, stacked : C6 - C7   (plain caption1Font, transparent bg, 2 blocks)"
    print "    default bg bold: C8 - C2   (bold caption1Font, DEFAULT bg)"
    print ""

    addRealColumn(xC1, posterY, boldFont, false, false)
    addReconstruction(xC2, posterY, boldFont, boldLineH, false)
    addRealColumn(xC3, posterY, plainFont, false, false)
    addReconstruction(xC4, posterY, plainFont, plainLineH, false)
    addRealColumn(xC5, posterY, plainFont, false, true)
    addRealColumn(xC6, posterY, plainFont, true, false)
    addReconstruction(xC7, posterY, plainFont, plainLineH, true)
    addRealColumn(xC8, posterY, boldFont, false, true)

    ' A 1px green rule along every poster's bottom edge. NOT the measurement — it is a registration
    ' mark, so a reader can confirm from the screenshot alone that all eight posters really are flush
    ' and that every subtraction is comparing the same baseline.
    rule = CreateObject("roSGNode", "Rectangle")
    rule.color = "0x00FF00FF"
    rule.width = xC8 + 100
    rule.height = 1
    rule.translation = [0, posterBottom]
    m.ladder.appendChild(rule)

    addTag(xC1, posterY - 30, "C1 bold trans")
    addTag(xC2, posterY - 30, "C2 recon0")
    addTag(xC3, posterY - 30, "C3 plain trans")
    addTag(xC4, posterY - 30, "C4 recon0")
    addTag(xC5, posterY - 30, "C5 plain dflt")
    addTag(xC6, posterY - 30, "C6 c1c2 trans")
    addTag(xC7, posterY - 30, "C7 c1c2 recon0")
    addTag(xC8, posterY - 30, "C8 bold dflt")

    print "=== Probe printing complete — ladder is on screen, take a screenshot now ==="
end function

function labelHeight(font as string) as float
    label = CreateObject("roSGNode", "Label")
    label.font = font
    label.text = "Hxg"
    m.ladder.appendChild(label)
    h = label.boundingRect().height
    m.ladder.removeChild(label)
    return h
end function

' A real one-cell PosterGrid whose caption is drawn in pure red, below the poster (the field
' default). The outset this probe is NOT measuring applies to the REPORTED rect only, never to
' paint (device-confirmed by postergrid-margins-probe), so every column's poster lands exactly at
' the grid's translation and all eight line up from a plain translation.
sub addRealColumn(x as integer, y as integer, font as string, stacked as boolean, defaultBg as boolean)
    grid = CreateObject("roSGNode", "PosterGrid")
    grid.basePosterSize = [100, 100]
    grid.itemSpacing = [0, 0]
    grid.numColumns = 1
    grid.numRows = 1
    grid.caption1Font = font
    grid.caption1NumLines = 1
    grid.caption1Color = "0xFF0000FF"
    grid.captionHorizAlignment = "center"
    grid.enableCaptionScrolling = false
    if not defaultBg
        ' Override the caption background with a fully transparent bitmap — otherwise the default
        ' `common:/images/<res>/caption_background.9.png` draws a translucent black band behind the
        ' real column's glyphs that a reconstruction (drawn straight onto the scene) does not have,
        ' biasing anti-aliased red edges across the decoder's threshold at a different alpha on each
        ' side. See postergrid-margins-probe/README.md. The C5/C8 columns deliberately skip this
        ' override to test whether the default background itself changes the reading.
        grid.captionBackgroundBitmapUri = "pkg:/images/transparent.png"
        grid.showBackgroundForEmptyCaptions = false
    end if
    if stacked
        grid.caption2Font = font
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
sub addReconstruction(x as integer, y as integer, font as string, lineH as float, stacked as boolean)
    poster = CreateObject("roSGNode", "Poster")
    poster.uri = "pkg:/images/poster_grey.png"
    poster.width = 100
    poster.height = 100
    poster.translation = [x, y]
    m.ladder.appendChild(poster)

    addCaptionCopy(x, y + 100, font, lineH)
    if stacked
        ' captionLineSpacing defaults to 0, so the second block starts immediately after the first.
        ' Only the FIRST block's top row is read, but the second has to be present or the two
        ' columns would not be rendering the same thing.
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
    ' captionLineSpacing, which defaults to 0. Copy that explicitly — the default would change the
    ' box's usable height and, with it, where a centered line lands.
    label.lineSpacing = 0
    ' PosterGridItem's own choice for a single-line block: centered in a box one line tall, not
    ' wrapped. Get this wrong and the subtraction measures an alignment difference instead.
    label.vertAlign = "center"
    label.translation = [x, y]
    m.ladder.appendChild(label)

    ' Self-check, printed to the log. An ellipsized reconstruction is not rendering what the real
    ' column renders, and the subtraction would still print a plausible-looking number. Fail loudly.
    if label.isTextEllipsized
        print "    !! WARNING: reconstruction caption at ("; x; ","; y; ") ELLIPSIZED — probe INVALID"
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
