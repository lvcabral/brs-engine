' LayoutGroup horizAlignment / vertAlignment probe.
'
' Companion to the layoutgroup-probe channel, which established that layoutDirection is an ENUM
' whose REJECTED state (unrecognized value) reads back "" and lays out horizontally -- the opposite
' of the documented "vert" default. This channel asks the same two questions of the alignment
' fields, whose values are also documented as a closed set:
'
'   1. Storage  - is an unrecognized value stored verbatim, canonicalized, or rejected to ""?
'                 Is matching case-sensitive? Is a value from the SIBLING field accepted
'                 (horizAlignment="top")?
'   2. Geometry - what does the layout actually DO for each value, including rejected ones and
'                 "custom" on the axis where Roku documents it as invalid?
'
' Method. Each case is a LayoutGroup with two deliberately DIFFERENT children, plus a 2x2 marker
' rectangle placed at exactly the group's translation. Offsets are measured as
' child.sceneBoundingRect() - marker.sceneBoundingRect(), so nothing depends on how the device
' computes a LayoutGroup's own bounding rect. Both children also carry a non-zero translation of
' their own, so a "custom" (unmanaged) axis is distinguishable from an aligned one.
'
'   child 0: 30 x 8,  own translation [7, 13]
'   child 1: 50 x 16, own translation [11, 17]
'   itemSpacings: [4]
'
' Those offsets are then CLASSIFIED into the behavior the geometry shows -- start / center / end /
' custom -- computed from the child sizes rather than hard-coded, so a row reads as
' "centre -> stored "" -> behaves left" without anyone having to interpret raw coordinates.
'
' Four case groups, because each field's meaning depends on layoutDirection: the field controlling
' the layout axis aligns the RUN AS A WHOLE (primary), while the field controlling the other axis
' aligns EACH CHILD independently (cross).
'
'   A  layoutDirection=vert   horizAlignment  (cross)
'   B  layoutDirection=horiz  horizAlignment  (primary)
'   C  layoutDirection=vert   vertAlignment   (primary)
'   D  layoutDirection=horiz  vertAlignment   (cross)

sub init()
    m.top.backgroundURI = ""
    m.top.backgroundColor = "0x0E1015FF"

    m.rowPitch = 34
    m.markerX = 760
    m.probesRun = 0

    m.childA = { w: 30, h: 8, tx: 7, ty: 13, color: "0xE05555FF" }
    m.childB = { w: 50, h: 16, tx: 11, ty: 17, color: "0x5599E0FF" }
    m.spacing = 4

    di = CreateObject("roDeviceInfo")
    m.top.findNode("subtitle").text = di.GetModelDisplayName() + " (" + di.GetModel() + ")  Roku OS " + di.GetOSVersion().major + "." + di.GetOSVersion().minor

    buildAllGroups()

    m.timer = m.top.findNode("probeTimer")
    m.timer.observeField("fire", "onProbe")
    m.timer.control = "start"
end sub

' Spellings tried for horizAlignment. Beyond the documented set: case variants, a plausible
' misspelling, a plausible synonym, the empty string, junk, and a value that is valid for the
' SIBLING field ("top") -- which tells us whether the two fields share one value table.
function horizValues() as object
    return [
        { label: "left", assign: true, value: "left" },
        { label: "center", assign: true, value: "center" },
        { label: "right", assign: true, value: "right" },
        { label: "custom", assign: true, value: "custom" },
        { label: "LEFT", assign: true, value: "LEFT" },
        { label: "Center", assign: true, value: "Center" },
        { label: "centre", assign: true, value: "centre" },
        { label: "middle", assign: true, value: "middle" },
        { label: "(empty)", assign: true, value: "" },
        { label: "bogus", assign: true, value: "bogus" },
        { label: "top", assign: true, value: "top" },
        { label: "center then bogus", assign: true, value: "center", second: "bogus" }
    ]
end function

function vertValues() as object
    return [
        { label: "top", assign: true, value: "top" },
        { label: "center", assign: true, value: "center" },
        { label: "bottom", assign: true, value: "bottom" },
        { label: "custom", assign: true, value: "custom" },
        { label: "TOP", assign: true, value: "TOP" },
        { label: "Center", assign: true, value: "Center" },
        { label: "centre", assign: true, value: "centre" },
        { label: "middle", assign: true, value: "middle" },
        { label: "(empty)", assign: true, value: "" },
        { label: "bogus", assign: true, value: "bogus" },
        { label: "left", assign: true, value: "left" },
        { label: "center then bogus", assign: true, value: "center", second: "bogus" }
    ]
end function

function groupDefs() as object
    return [
        { key: "A", direction: "vert", fieldName: "horizAlignment", axis: "cross", measure: "x", values: horizValues() },
        { key: "B", direction: "horiz", fieldName: "horizAlignment", axis: "primary", measure: "x", values: horizValues() },
        { key: "C", direction: "vert", fieldName: "vertAlignment", axis: "primary", measure: "y", values: vertValues() },
        { key: "D", direction: "horiz", fieldName: "vertAlignment", axis: "cross", measure: "y", values: vertValues() }
    ]
end function

sub buildAllGroups()
    m.groups = []
    colLeft = m.top.findNode("colLeft")
    colRight = m.top.findNode("colRight")

    defs = groupDefs()
    slotLeft = 0
    slotRight = 0

    for each groupDef in defs
        if groupDef.key = "A" or groupDef.key = "B"
            slotLeft = buildGroup(groupDef, colLeft, slotLeft)
        else
            slotRight = buildGroup(groupDef, colRight, slotRight)
        end if
        m.groups.push(groupDef)
    end for
end sub

' Lays one case group into a column starting at the given row slot; returns the next free slot.
function buildGroup(groupDef as object, column as object, startSlot as integer) as integer
    slot = startSlot

    header = createLabel(column, slot, "0x66E08AFF")
    header.text = groupDef.key + ")  layoutDirection=" + groupDef.direction + "   " + groupDef.fieldName + "   (" + groupDef.axis + " axis)"
    slot = slot + 1

    groupDef.rows = []
    for each spelling in groupDef.values
        layoutGroup = CreateObject("roSGNode", "LayoutGroup")
        layoutGroup.layoutDirection = groupDef.direction
        layoutGroup.itemSpacings = [m.spacing]
        if spelling.assign then layoutGroup.setField(groupDef.fieldName, spelling.value)
        ' A second write probes whether an invalid value clobbers an already-valid one.
        if spelling.second <> invalid then layoutGroup.setField(groupDef.fieldName, spelling.second)

        addChild(layoutGroup, m.childA)
        addChild(layoutGroup, m.childB)

        originY = slot * m.rowPitch + 14
        layoutGroup.translation = [m.markerX, originY]

        ' Reference point for every offset: a sibling at the group's exact translation.
        marker = CreateObject("roSGNode", "Rectangle")
        marker.width = 2
        marker.height = 2
        marker.color = "0xFFFFFFFF"
        marker.translation = [m.markerX, originY]

        column.appendChild(marker)
        column.appendChild(layoutGroup)

        groupDef.rows.push({
            spelling: spelling,
            layoutGroup: layoutGroup,
            marker: marker,
            text: createLabel(column, slot, "0xDDDDDDFF")
        })
        slot = slot + 1
    end for

    ' Blank slot between groups.
    return slot + 1
end function

sub addChild(layoutGroup as object, spec as object)
    bar = CreateObject("roSGNode", "Rectangle")
    bar.width = spec.w
    bar.height = spec.h
    bar.color = spec.color
    bar.translation = [spec.tx, spec.ty]
    layoutGroup.appendChild(bar)
end sub

function createLabel(column as object, slot as integer, color as string) as object
    label = CreateObject("roSGNode", "Label")
    label.translation = [0, slot * m.rowPitch]
    label.width = 740
    label.color = color
    column.appendChild(label)
    return label
end function

sub onProbe()
    m.probesRun = m.probesRun + 1

    print ""
    print "===== LayoutGroup alignment probe - pass "; m.probesRun; " ====="
    print "children: c0 = 30x8 @ [7,13]   c1 = 50x16 @ [11,17]   itemSpacings [4]"
    print "offsets are relative to the LayoutGroup's own origin (marker rectangle)"

    for each groupDef in m.groups
        print ""
        print groupDef.key + ")  layoutDirection=" + groupDef.direction + "   " + groupDef.fieldName + "   (" + groupDef.axis + " axis, measured on " + groupDef.measure + ")"
        print "  spelling            stored        behavior    c0 offset      c1 offset"
        print "  ------------------  ------------  ----------  -------------  -------------"

        for each row in groupDef.rows
            stored = row.layoutGroup.getField(groupDef.fieldName)
            offsetA = offsetOf(row.layoutGroup.getChild(0), row.marker)
            offsetB = offsetOf(row.layoutGroup.getChild(1), row.marker)
            behavior = classify(groupDef, offsetA, offsetB)

            line = padRight(row.spelling.label, 20) + padRight(quoted(stored), 14) + padRight(behavior, 12)
            line = line + padRight(point(offsetA), 15) + point(offsetB)

            row.text.text = padRight(row.spelling.label, 19) + padRight(quoted(stored), 12) + padRight(behavior, 11) + point(offsetA) + " " + point(offsetB)
            row.text.color = behaviorColor(behavior)

            print "  "; line
        end for
    end for

    print ""
    print "behavior is derived from geometry, not from the stored string:"
    print "  start  = left/top edges at the origin        center = children centered on the origin"
    print "  end    = right/bottom edges at the origin    custom = child's own translation kept"

    if m.probesRun >= 3 then m.timer.control = "stop"
end sub

function offsetOf(child as object, marker as object) as object
    childRect = child.sceneBoundingRect()
    markerRect = marker.sceneBoundingRect()
    return { x: childRect.x - markerRect.x, y: childRect.y - markerRect.y }
end function

' Classifies the measured geometry into the alignment behavior it demonstrates. Expectations are
' computed from the child specs, so the classifier stays correct if the child sizes are changed.
function classify(groupDef as object, offsetA as object, offsetB as object) as string
    if groupDef.measure = "x"
        sizeA = m.childA.w
        sizeB = m.childB.w
        ownA = m.childA.tx
        ownB = m.childB.tx
        valueA = offsetA.x
        valueB = offsetB.x
        startName = "left"
        endName = "right"
    else
        sizeA = m.childA.h
        sizeB = m.childB.h
        ownA = m.childA.ty
        ownB = m.childB.ty
        valueA = offsetA.y
        valueB = offsetB.y
        startName = "top"
        endName = "bottom"
    end if

    if groupDef.axis = "cross"
        ' Each child is aligned independently against the origin.
        if near(valueA, 0) and near(valueB, 0) then return startName
        if near(valueA, -sizeA / 2) and near(valueB, -sizeB / 2) then return "center"
        if near(valueA, -sizeA) and near(valueB, -sizeB) then return endName
        if near(valueA, ownA) and near(valueB, ownB) then return "custom"
        return "other"
    end if

    ' Primary axis: the whole run is placed as a unit, children packed with itemSpacings.
    total = sizeA + m.spacing + sizeB
    if near(valueA, 0) and near(valueB, sizeA + m.spacing) then return startName
    if near(valueA, -total / 2) and near(valueB, -total / 2 + sizeA + m.spacing) then return "center"
    if near(valueA, -total) and near(valueB, -total + sizeA + m.spacing) then return endName
    if near(valueA, ownA) and near(valueB, ownB) then return "custom"
    return "other"
end function

function behaviorColor(behavior as string) as string
    if behavior = "other" then return "0xFF6666FF"
    if behavior = "custom" then return "0xE0A050FF"
    return "0xDDDDDDFF"
end function

function near(a as float, b as float) as boolean
    return abs(a - b) < 0.75
end function

function point(offset as object) as string
    return "(" + num(offset.x) + "," + num(offset.y) + ")"
end function

function num(value as float) as string
    rounded = cint(value)
    if abs(value - rounded) < 0.01 then return rounded.toStr()
    return str(value).trim()
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
