' LayoutGroup.layoutDirection spelling probe.
'
' Purpose: determine empirically which layoutDirection spellings a real Roku device treats as
' horizontal, which it treats as vertical, and whether an invalid value is REJECTED (the field
' keeps its previous value) or ACCEPTED-AND-IGNORED (the field stores the junk string but the
' layout falls back to the default).
'
' Each case is a LayoutGroup holding three Rectangles. After the layout settles, the probe reads
' the first two children's sceneBoundingRect() and infers the direction from which axis advanced.
' The inference is what matters -- the drawn boxes are just a visual cross-check.
'
' Two columns, because the XML parser and a runtime field write may validate differently:
'   left  - layoutDirection hard-coded as an XML attribute
'   right - layoutDirection assigned from BrightScript after the node is created

sub init()
    m.top.backgroundURI = ""
    m.top.backgroundColor = "0x0E1015FF"

    m.rowPitch = 76
    m.probesRun = 0

    m.xmlCol = m.top.findNode("xmlCol")
    m.runtimeCol = m.top.findNode("runtimeCol")

    di = CreateObject("roDeviceInfo")
    m.top.findNode("subtitle").text = di.GetModelDisplayName() + " (" + di.GetModel() + ")  Roku OS " + di.GetOSVersion().major + "." + di.GetOSVersion().minor + "  |  results also printed to the console"

    buildXmlColumn()
    buildRuntimeColumn()

    m.timer = m.top.findNode("probeTimer")
    m.timer.observeField("fire", "onProbe")
    m.timer.control = "start"
end sub

' Case table. Indexes 0-9 mirror the x0..x9 LayoutGroups declared in MainScene.xml -- keep the two
' in sync. Indexes 10+ are runtime-only (they need two sequential writes, which XML cannot express).
function caseList() as object
    return [
        { label: "(attribute absent)", assign: false, value: "" },
        { label: "horiz", assign: true, value: "horiz" },
        { label: "vert", assign: true, value: "vert" },
        { label: "horz", assign: true, value: "horz" },
        { label: "horizontal", assign: true, value: "horizontal" },
        { label: "vertical", assign: true, value: "vertical" },
        { label: "HORIZ", assign: true, value: "HORIZ" },
        { label: "Horiz", assign: true, value: "Horiz" },
        { label: "(empty string)", assign: true, value: "" },
        { label: "bogus", assign: true, value: "bogus" },
        { label: "horiz then horz", assign: true, value: "horiz", second: "horz" },
        { label: "vert then horiz", assign: true, value: "vert", second: "horiz" }
    ]
end function

' Left column: the LayoutGroups already exist in XML with their literal attribute. Position each
' one, fill it with boxes, and add the result label that onProbe() will fill in.
sub buildXmlColumn()
    cases = caseList()
    m.xmlRows = []

    for i = 0 to 9
        group = m.top.findNode("x" + i.toStr())
        if group = invalid then
            print "PROBE: missing XML node x"; i
            continue for
        end if
        group.translation = [0, i * m.rowPitch + 30]
        addBoxes(group)
        m.xmlRows.push({ index: i, label: cases[i].label, group: group, text: addRowLabel(m.xmlCol, i) })
    end for
end sub

' Right column: create each LayoutGroup from code and write layoutDirection as a field assignment.
sub buildRuntimeColumn()
    cases = caseList()
    m.runtimeRows = []

    for i = 0 to cases.count() - 1
        c = cases[i]
        group = CreateObject("roSGNode", "LayoutGroup")
        group.itemSpacings = [5]
        group.translation = [0, i * m.rowPitch + 30]

        if c.assign then group.layoutDirection = c.value
        if c.second <> invalid then group.layoutDirection = c.second

        addBoxes(group)
        m.runtimeCol.appendChild(group)
        m.runtimeRows.push({ index: i, label: c.label, group: group, text: addRowLabel(m.runtimeCol, i) })
    end for
end sub

' Three differently-colored bars. If the group lays out horizontally they form a row; if it lays
' out vertically they form a stack -- the same failure shape as the JellyRock tab bar.
sub addBoxes(group as object)
    colors = ["0xE05555FF", "0x55D08AFF", "0x5599E0FF"]
    for i = 0 to 2
        bar = CreateObject("roSGNode", "Rectangle")
        bar.width = 44
        bar.height = 12
        bar.color = colors[i]
        group.appendChild(bar)
    end for
end sub

function addRowLabel(column as object, index as integer) as object
    label = CreateObject("roSGNode", "Label")
    label.translation = [0, index * m.rowPitch]
    label.width = 900
    label.color = "0xDDDDDDFF"
    column.appendChild(label)
    return label
end function

' Re-runs on every timer tick: the first pass can read rects captured before the layout settled.
' Three passes is plenty; the timer stops itself so the final state stays on screen.
sub onProbe()
    m.probesRun = m.probesRun + 1

    print ""
    print "===== LayoutGroup layoutDirection probe - pass "; m.probesRun; " ====="
    print "idx  source    spelling               stored value        laid out as"
    print "---  --------  ---------------------  ------------------  -----------"

    reportRows(m.xmlRows, "xml")
    reportRows(m.runtimeRows, "runtime")

    print ""
    print "HORIZ = children advanced along x   VERT = children advanced along y"
    print "'stored value' is what reading back the field returns -- if it differs from the"
    print "spelling that was written, the device REJECTED the value instead of ignoring it."

    if m.probesRun >= 3 then m.timer.control = "stop"
end sub

sub reportRows(rows as object, source as string)
    for each row in rows
        stored = row.group.layoutDirection
        verdict = detectDirection(row.group)

        row.text.text = padRight(source, 9) + padRight(row.label, 23) + padRight(quoted(stored), 20) + verdict.text
        row.text.color = verdict.color

        print padRight(row.index.toStr(), 5); padRight(source, 10); padRight(row.label, 23); padRight(quoted(stored), 20); verdict.text
    end for
end sub

' Infers the layout axis from the first two children's positions on screen. Reading the rendered
' rects rather than the children's translation fields keeps this honest: it reports where the
' device actually PUT the children, not what any field claims.
function detectDirection(group as object) as object
    if group.getChildCount() < 2 then return { text: "? (no children)", color: "0xFF6666FF" }

    a = group.getChild(0).sceneBoundingRect()
    b = group.getChild(1).sceneBoundingRect()
    dx = b.x - a.x
    dy = b.y - a.y

    if dx > 1 and dy <= 1 then return { text: "HORIZ", color: "0x66E08AFF" }
    if dy > 1 and dx <= 1 then return { text: "VERT", color: "0xE0A050FF" }
    if dx <= 1 and dy <= 1 then return { text: "STACKED (dx=" + dx.toStr() + " dy=" + dy.toStr() + ")", color: "0xFF6666FF" }
    return { text: "MIXED (dx=" + dx.toStr() + " dy=" + dy.toStr() + ")", color: "0xFF6666FF" }
end function

function quoted(value as dynamic) as string
    if value = invalid then return "<invalid>"
    return chr(34) + value.toStr() + chr(34)
end function

function padRight(text as string, width as integer) as string
    result = text
    while len(result) < width
        result = result + " "
    end while
    return result
end function
