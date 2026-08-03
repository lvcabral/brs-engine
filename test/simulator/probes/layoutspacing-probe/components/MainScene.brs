' LayoutGroup itemSpacings / addItemSpacingAfterChild probe.
'
' Third in the series. layoutgroup-probe established that layoutDirection is a rejecting enum whose
' empty state lays out horizontally; layoutalign-probe established the same storage rule for the
' alignment fields and found that a rejected CROSS-axis alignment collapses every child onto the
' group origin. Both left questions open, and this channel closes them.
'
' SECTION S - itemSpacings and where the spacing is inserted
'
'   The engine repeats the LAST array entry for every gap past the end of the array, so
'   itemSpacings="[20]" spaces every child by 20. That is an assumption, never measured, and it is
'   load-bearing: apps routinely write a single-element array with many children. If the device
'   instead uses 0 once the array runs out, a great many layouts differ.
'
'   Also probed: an array LONGER than the number of gaps (is the extra entry appended as trailing
'   space, changing the group's own size?), negative and fractional spacings, the empty array, and
'   addItemSpacingAfterChild=false -- which in the engine inserts the space BEFORE each child,
'   including the first, shifting the whole run. Whether the device shifts the run is visible in the
'   first child's offset.
'
' SECTION R - rejected-value combinations the alignment probe did not cover
'
'   The engine extrapolates the cross-axis collapse to the case where BOTH alignment fields are
'   rejected, and to a rejected layoutDirection combined with a rejected alignment. Extrapolation is
'   exactly what this series keeps proving wrong, so measure it.
'
' SECTION F - does a device LayoutGroup even HAVE width/height?
'
'   Group does not declare width/height in Roku's reference, yet the engine writes both on every
'   layout so parents can measure the group. If the device has no such fields, an app reading
'   lg.width gets invalid on hardware and a number here -- a silent behavioral difference. Measured
'   with hasField(), alongside localBoundingRect() for the sizes that actually matter.
'
' Method matches the earlier probes: a 2x2 marker rectangle sits at each group's exact translation,
' and every offset is child.sceneBoundingRect() - marker.sceneBoundingRect().

sub init()
    m.top.backgroundURI = ""
    m.top.backgroundColor = "0x0E1015FF"

    m.rowPitch = 44
    m.markerX = 640
    m.probesRun = 0

    m.childSize = { w: 30, h: 10 }
    m.childColors = ["0xE05555FF", "0x55D08AFF", "0x5599E0FF"]

    di = CreateObject("roDeviceInfo")
    m.top.findNode("subtitle").text = di.GetModelDisplayName() + " (" + di.GetModel() + ")  Roku OS " + di.GetOSVersion().major + "." + di.GetOSVersion().minor

    buildSpacingSection()
    buildRejectedSection()

    m.timer = m.top.findNode("probeTimer")
    m.timer.observeField("fire", "onProbe")
    m.timer.control = "start"
end sub

' Each case: the itemSpacings array to set, whether addItemSpacingAfterChild is left at its default
' (true) or turned off, and the layout direction.
function spacingCases() as object
    return [
        { label: "[] (default)", spacings: [], addAfter: true, direction: "horiz" },
        { label: "[0]", spacings: [0], addAfter: true, direction: "horiz" },
        { label: "[4]  <- short", spacings: [4], addAfter: true, direction: "horiz" },
        { label: "[4,9]  <- exact", spacings: [4, 9], addAfter: true, direction: "horiz" },
        { label: "[4,9,15]  <- extra", spacings: [4, 9, 15], addAfter: true, direction: "horiz" },
        { label: "[4,9,15,20]", spacings: [4, 9, 15, 20], addAfter: true, direction: "horiz" },
        { label: "[-6]  <- negative", spacings: [-6], addAfter: true, direction: "horiz" },
        { label: "[2.5]  <- fraction", spacings: [2.5], addAfter: true, direction: "horiz" },
        { label: "[] addAfter=false", spacings: [], addAfter: false, direction: "horiz" },
        { label: "[4] addAfter=false", spacings: [4], addAfter: false, direction: "horiz" },
        { label: "[4,9] addAfter=false", spacings: [4, 9], addAfter: false, direction: "horiz" },
        { label: "[4,9,15] addAft=false", spacings: [4, 9, 15], addAfter: false, direction: "horiz" },
        { label: "[4] vert", spacings: [4], addAfter: true, direction: "vert" },
        { label: "[4,9] vert", spacings: [4, 9], addAfter: true, direction: "vert" }
    ]
end function

' Rejected-value combinations. "bogus" is rejected by every one of the three enum fields.
function rejectedCases() as object
    return [
        { label: "vert  h=bogus", direction: "vert", horiz: "bogus", vert: invalid },
        { label: "vert  v=bogus", direction: "vert", horiz: invalid, vert: "bogus" },
        { label: "vert  both bogus", direction: "vert", horiz: "bogus", vert: "bogus" },
        { label: "horiz h=bogus", direction: "horiz", horiz: "bogus", vert: invalid },
        { label: "horiz v=bogus", direction: "horiz", horiz: invalid, vert: "bogus" },
        { label: "horiz both bogus", direction: "horiz", horiz: "bogus", vert: "bogus" },
        { label: "dir=bogus  v=bogus", direction: "bogus", horiz: invalid, vert: "bogus" },
        { label: "dir=bogus  h=bogus", direction: "bogus", horiz: "bogus", vert: invalid }
    ]
end function

sub buildSpacingSection()
    column = m.top.findNode("colLeft")
    m.spacingRows = []
    slot = 0

    header = createLabel(column, slot, "0x66E08AFF")
    header.text = "S)  itemSpacings   (3 children, each 30x10)"
    slot = slot + 1

    for each testCase in spacingCases()
        layoutGroup = CreateObject("roSGNode", "LayoutGroup")
        layoutGroup.layoutDirection = testCase.direction
        layoutGroup.itemSpacings = testCase.spacings
        layoutGroup.addItemSpacingAfterChild = testCase.addAfter
        addChildren(layoutGroup, 3)

        m.spacingRows.push(placeCase(column, slot, layoutGroup, testCase.label))
        slot = slot + 1
    end for
end sub

sub buildRejectedSection()
    column = m.top.findNode("colRight")
    m.rejectedRows = []
    slot = 0

    header = createLabel(column, slot, "0x66E08AFF")
    header.text = "R)  rejected-value combinations   (spacings [4])"
    slot = slot + 1

    for each testCase in rejectedCases()
        layoutGroup = CreateObject("roSGNode", "LayoutGroup")
        layoutGroup.layoutDirection = testCase.direction
        layoutGroup.itemSpacings = [4]
        if testCase.horiz <> invalid then layoutGroup.horizAlignment = testCase.horiz
        if testCase.vert <> invalid then layoutGroup.vertAlignment = testCase.vert
        addChildren(layoutGroup, 3)

        m.rejectedRows.push(placeCase(column, slot, layoutGroup, testCase.label))
        slot = slot + 1
    end for

    ' Section F shares the right column, below the rejected rows.
    slot = slot + 1
    m.fieldHeader = createLabel(column, slot, "0x66E08AFF")
    m.fieldHeader.text = "F)  does a LayoutGroup have width/height fields?"
    slot = slot + 1
    m.fieldRows = [createLabel(column, slot, "0xDDDDDDFF"), createLabel(column, slot + 1, "0xDDDDDDFF")]

    ' A plain laid-out group to interrogate for section F.
    m.fieldProbe = CreateObject("roSGNode", "LayoutGroup")
    m.fieldProbe.layoutDirection = "horiz"
    m.fieldProbe.itemSpacings = [4]
    addChildren(m.fieldProbe, 3)
    m.fieldProbe.translation = [m.markerX, (slot + 2) * m.rowPitch + 16]
    column.appendChild(m.fieldProbe)
end sub

' Positions one case group with its marker and result label; returns the row record.
function placeCase(column as object, slot as integer, layoutGroup as object, label as string) as object
    originY = slot * m.rowPitch + 16
    layoutGroup.translation = [m.markerX, originY]

    marker = CreateObject("roSGNode", "Rectangle")
    marker.width = 2
    marker.height = 2
    marker.color = "0xFFFFFFFF"
    marker.translation = [m.markerX, originY]

    column.appendChild(marker)
    column.appendChild(layoutGroup)

    return { label: label, layoutGroup: layoutGroup, marker: marker, text: createLabel(column, slot, "0xDDDDDDFF") }
end function

sub addChildren(layoutGroup as object, count as integer)
    for i = 0 to count - 1
        bar = CreateObject("roSGNode", "Rectangle")
        bar.width = m.childSize.w
        bar.height = m.childSize.h
        bar.color = m.childColors[i]
        layoutGroup.appendChild(bar)
    end for
end sub

function createLabel(column as object, slot as integer, color as string) as object
    label = CreateObject("roSGNode", "Label")
    label.translation = [0, slot * m.rowPitch]
    label.width = 620
    label.color = color
    column.appendChild(label)
    return label
end function

sub onProbe()
    m.probesRun = m.probesRun + 1

    print ""
    print "===== LayoutGroup spacing probe - pass "; m.probesRun; " ====="
    print "3 children, each 30x10, no translations of their own"
    print "c0/c1/c2 = offsets from the group origin;  g = measured gap between consecutive children"
    print "local = localBoundingRect() of the LayoutGroup itself"

    print ""
    print "S)  itemSpacings   (layoutDirection=horiz unless noted)"
    print "  case                    c0       gaps          local rect"
    print "  ----------------------  -------  ------------  ------------------------"
    for each row in m.spacingRows
        print "  "; padRight(row.label, 24); padRight(point(offsetOf(row, 0)), 9); padRight(gapsOf(row), 14); rectText(row.layoutGroup)
        row.text.text = padRight(row.label, 22) + padRight(point(offsetOf(row, 0)), 9) + padRight(gapsOf(row), 13) + rectText(row.layoutGroup)
    end for

    print ""
    print "R)  rejected-value combinations   (itemSpacings [4])"
    print "  case                    c0       c1       c2       local rect"
    print "  ----------------------  -------  -------  -------  ------------------------"
    for each row in m.rejectedRows
        offsets = padRight(point(offsetOf(row, 0)), 9) + padRight(point(offsetOf(row, 1)), 9) + padRight(point(offsetOf(row, 2)), 9)
        print "  "; padRight(row.label, 24); offsets; rectText(row.layoutGroup)
        row.text.text = padRight(row.label, 22) + offsets + rectText(row.layoutGroup)
    end for

    print ""
    print "F)  width/height fields on a LayoutGroup"
    fieldLine = "  hasField(width)=" + boolText(m.fieldProbe.hasField("width")) + "  hasField(height)=" + boolText(m.fieldProbe.hasField("height"))
    valueLine = "  width=" + describe(m.fieldProbe.width) + "  height=" + describe(m.fieldProbe.height) + "  local=" + rectText(m.fieldProbe)
    print fieldLine
    print valueLine
    m.fieldRows[0].text = fieldLine
    m.fieldRows[1].text = valueLine

    if m.probesRun >= 3 then m.timer.control = "stop"
end sub

function offsetOf(row as object, index as integer) as object
    child = row.layoutGroup.getChild(index)
    if child = invalid then return { x: 0, y: 0 }
    childRect = child.sceneBoundingRect()
    markerRect = row.marker.sceneBoundingRect()
    return { x: childRect.x - markerRect.x, y: childRect.y - markerRect.y }
end function

' Gap between consecutive children along the layout axis: the distance between them minus the child
' size, so a result of 0 means they are touching and a negative result means they overlap.
function gapsOf(row as object) as string
    onX = (row.layoutGroup.layoutDirection <> "vert")
    if onX
        size = m.childSize.w
    else
        size = m.childSize.h
    end if

    values = []
    for i = 0 to 1
        a = offsetOf(row, i)
        b = offsetOf(row, i + 1)
        if onX
            values.push(b.x - a.x - size)
        else
            values.push(b.y - a.y - size)
        end if
    end for
    return num(values[0]) + "," + num(values[1])
end function

function rectText(layoutGroup as object) as string
    r = layoutGroup.localBoundingRect()
    return "(" + num(r.x) + "," + num(r.y) + "," + num(r.width) + "," + num(r.height) + ")"
end function

function describe(value as dynamic) as string
    if value = invalid then return "invalid"
    return num(value)
end function

function boolText(value as dynamic) as string
    if value = true then return "true"
    if value = false then return "false"
    return "invalid"
end function

function point(offset as object) as string
    return "(" + num(offset.x) + "," + num(offset.y) + ")"
end function

function num(value as dynamic) as string
    if value = invalid then return "invalid"
    rounded = cint(value)
    if abs(value - rounded) < 0.01 then return rounded.toStr()
    return str(value).trim()
end function

function padRight(text as string, width as integer) as string
    result = text
    while len(result) < width
        result = result + " "
    end while
    return result
end function
