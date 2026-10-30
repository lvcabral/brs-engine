' Font Invalid Probe: what a device does when a font field gets a value that is not a usable Font node
' (invalid, an unknown "font:" name, a plain string, another node, a number), what the field reads back
' afterwards, which font the node measures with, and whether rendering survives it. Written for #1253.
' Output: PROBE|<node>.<field>|<case>|value=<readback>|w=<width>|h=<height>
sub init()
    m.text = "Hello World Measure"
    m.stage = m.top.findNode("stage")
    m.startTimer = m.top.findNode("startTimer")
    m.renderTimer = m.top.findNode("renderTimer")
    m.layoutTimer = m.top.findNode("layoutTimer")
    m.startTimer.observeField("fire", "runProbe")
    ' Gives time to reconnect to the debug console, which drops its clients when an app launches.
    m.startTimer.control = "start"
end sub

sub runProbe()
    ' Launch parameter `run=<id>` tags this run, since the console replays older runs' lines.
    runId = m.global.probeRun
    if runId = invalid then runId = ""
    print "PROBE|start|" + runId
    if m.global.probeLayout <> invalid
        startLayout()
        return
    end if
    measured = ["Label", "ScrollingLabel", "MonospaceLabel", "Button"]
    for each subtype in measured
        probeField(subtype, fontFieldOf(subtype), true)
    end for
    probeField("Button", "focusedTextFont", false)
    probeField("ButtonGroup", "textFont", false)
    probeField("ButtonGroup", "focusedTextFont", false)
    probeField("LabelList", "font", false)
    probeField("LabelList", "focusedFont", false)
    probeField("LabelList", "sectionDividerFont", false)
    probeField("RowList", "rowLabelFont", false)
    probeField("PosterGrid", "caption1Font", false)
    probeField("PosterGrid", "caption2Font", false)
    probeField("ZoomRowList", "rowTitleFont", false)
    probeField("ZoomRowList", "rowCounterFont", false)
    probeField("TimeGrid", "channelInfoFont", false)
    probeField("TimeGrid", "programTitleFont", false)
    probeField("TimeGrid", "timeLabelFont", false)
    probeField("ScrollableText", "font", false)
    probeField("Video", "playbackActionButtonFocusedTextFont", false)
    probeAfterInvalid()
    probeSetField()
    probeWrap()
    probeXml()
    startRender()
end sub

function fontFieldOf(subtype as string) as string
    if subtype = "Button" then return "textFont"
    return "font"
end function

' Every case first writes a known-good font, so a write that is rejected shows up as that font.
sub probeField(subtype as string, field as string, measure as boolean)
    node = newNode(subtype)
    report(node, subtype, field, "default", measure)
    good = "font:LargeBoldSystemFont"
    setFont(node, field, good)
    report(node, subtype, field, good, measure)

    cases = [
        { name: "invalid", value: invalid },
        { name: "font:NoSuchFont", value: "font:NoSuchFont" },
        { name: "font:largeboldsystemfont", value: "font:largeboldsystemfont" },
        { name: "string-garbage", value: "garbage" },
        { name: "string-empty", value: "" },
        { name: "node-Rectangle", value: CreateObject("roSGNode", "Rectangle") },
        { name: "integer-5", value: 5 },
        { name: "font-bare", value: CreateObject("roSGNode", "Font") },
        { name: "font-missing-uri", value: makeFont("pkg:/fonts/missing.ttf", 40) },
    ]
    for each c in cases
        setFont(node, field, good)
        setFont(node, field, c.value)
        report(node, subtype, field, c.name, measure)
    end for
end sub

' After a field went invalid: can the app still write a size to the font it reads back, and does a
' later good font take effect?
sub probeAfterInvalid()
    lbl = newNode("Label")
    lbl.font = "font:LargeBoldSystemFont"
    lbl.font = invalid
    f = lbl.font
    print "PROBE|Label.font|readback-after-invalid|isInvalid=" + (f = invalid).toStr()
    lbl.font = "font:SmallSystemFont"
    report(lbl, "Label", "font", "good-after-invalid", true)
end sub

sub startRender()
    print "PROBE|render|build"
    m.views = []
    y = 20
    for each subtype in ["Label", "ScrollingLabel", "MonospaceLabel"]
        n = m.stage.createChild(subtype)
        n.text = subtype + " " + m.text
        n.translation = [20, y]
        if subtype = "ScrollingLabel" then n.maxWidth = 300
        if subtype = "MonospaceLabel" then n.width = 400
        m.views.push({ node: n, fields: ["font"] })
        y += 45
    end for

    btn = m.stage.createChild("Button")
    btn.text = "Button " + m.text
    btn.translation = [20, y]
    m.views.push({ node: btn, fields: ["textFont", "focusedTextFont"] })
    y += 80

    bg = m.stage.createChild("ButtonGroup")
    bg.buttons = ["One", "Two"]
    bg.translation = [20, y]
    m.views.push({ node: bg, fields: ["textFont", "focusedTextFont"] })

    ll = m.stage.createChild("LabelList")
    ll.translation = [700, 20]
    ll.itemSize = [400, 40]
    ll.content = listContent(3)
    m.views.push({ node: ll, fields: ["font", "focusedFont"] })
    m.list = ll

    rl = m.stage.createChild("RowList")
    rl.translation = [700, 200]
    rl.itemSize = [500, 100]
    rl.rowItemSize = [[120, 60]]
    rl.numRows = 1
    rl.showRowLabel = [true]
    rl.content = rowContent()
    m.views.push({ node: rl, fields: ["rowLabelFont"] })

    pg = m.stage.createChild("PosterGrid")
    pg.translation = [700, 350]
    pg.basePosterSize = [100, 60]
    pg.numColumns = 3
    pg.numRows = 1
    pg.posterDisplayMode = "scaleToFit"
    pg.caption1NumLines = 1
    pg.caption2NumLines = 1
    pg.content = gridContent()
    m.views.push({ node: pg, fields: ["caption1Font", "caption2Font"] })

    st = m.stage.createChild("ScrollableText")
    st.translation = [20, 450]
    st.width = 500
    st.height = 100
    st.text = "ScrollableText " + m.text
    m.views.push({ node: st, fields: ["font"] })

    m.list.setFocus(true)
    ' A large starting font, so a node that keeps its previous font is told apart from one that
    ' falls back to its default.
    m.goodFont = "font:LargeBoldSystemFont"
    for each v in m.views
        for each field in v.fields
            setFont(v.node, field, m.goodFont)
        end for
    end for
    ' One view at a time: a device that crashes on a value kills the app, so the last "shown" line
    ' names the culprit. Each view gets its fonts back before the next one is tested.
    ' Cases that kill the app on a device (EXIT_SYSTEM_KILL), skipped so the rest can run.
    skip = { "LabelList.font": true, "LabelList.focusedFont": true }
    only = m.global.probeOnly
    m.steps = []
    for each v in m.views
        for each field in v.fields
            key = v.node.subtype() + "." + field
            if (only = invalid and skip[key] = invalid) or (only <> invalid and only = key)
                for each value in [invalid, "font:NoSuchFont"]
                    m.steps.push({ node: v.node, field: field, value: value })
                end for
            end if
        end for
    end for
    m.stepIndex = -1
    m.renderTimer.duration = 1.5
    m.renderTimer.observeField("fire", "renderStep")
    renderStep()
end sub

sub renderStep()
    if m.stepIndex >= 0
        s = m.steps[m.stepIndex]
        print "PROBE|render|" + s.label + "|survived"
        setFont(s.node, s.field, m.goodFont)
    end if
    m.stepIndex += 1
    if m.stepIndex < m.steps.count()
        s = m.steps[m.stepIndex]
        name = "invalid"
        if s.value <> invalid then name = s.value
        s.label = s.node.subtype() + "." + s.field + "|" + name
        print "PROBE|render|" + s.label + "|set"
        setFont(s.node, s.field, s.value)
        print "PROBE|render|" + s.label + "|shown"
        m.renderTimer.control = "start"
        return
    end if
    m.renderTimer.unobserveField("fire")
    for each s in m.steps
        if s.value = invalid then setFont(s.node, s.field, invalid)
    end for
    print "PROBE|render|all-invalid|shown"
    m.renderTimer.observeField("fire", "startTask")
    m.renderTimer.control = "start"
end sub

sub startTask()
    print "PROBE|render|all-invalid|survived"
    m.renderTimer.unobserveField("fire")
    task = CreateObject("roSGNode", "FontTask")
    m.taskLabel = m.stage.createChild("Label")
    m.taskLabel.text = "Task " + m.text
    m.taskLabel.translation = [20, 600]
    task.target = m.taskLabel
    task.observeField("done", "taskDone")
    m.task = task
    task.control = "run"
end sub

sub taskDone()
    print "PROBE|task|render|label-font-invalid=" + (m.taskLabel.font = invalid).toStr()
    m.renderTimer.observeField("fire", "finish")
    m.renderTimer.control = "start"
end sub

' The setField() method runs its own type check, separate from dot assignment and setFields().
sub probeSetField()
    cases = [
        { name: "invalid", value: invalid },
        { name: "font:NoSuchFont", value: "font:NoSuchFont" },
        { name: "string-garbage", value: "garbage" },
        { name: "string-uri", value: "pkg:/fonts/missing.ttf" },
        { name: "string-empty", value: "" },
        { name: "node-Rectangle", value: CreateObject("roSGNode", "Rectangle") },
        { name: "integer-5", value: 5 },
        { name: "font:largeboldsystemfont", value: "font:largeboldsystemfont" },
    ]
    lbl = newNode("Label")
    for each c in cases
        lbl.font = "font:SmallSystemFont"
        ok = lbl.setField("font", c.value)
        print "PROBE|Label.font|setField-" + c.name + "|ret=" + ok.toStr() + "|value=" + describeFont(lbl.font)
    end for
    lbl.font = "font:SmallSystemFont"
    lbl.font = "pkg:/fonts/missing.ttf"
    print "PROBE|Label.font|string-uri|value=" + describeFont(lbl.font)
end sub

' A wrapping Label, and a Label with a fixed width, measured with a good and an invalid font.
sub probeWrap()
    for each wrap in [true, false]
        lbl = CreateObject("roSGNode", "Label")
        lbl.text = "the quick brown fox jumps over the lazy dog"
        lbl.width = 120
        lbl.wrap = wrap
        for each f in ["font:LargeBoldSystemFont", invalid]
            lbl.font = f
            r = lbl.boundingRect()
            name = "invalid"
            if f <> invalid then name = f
            print "PROBE|Label.font|width120-wrap=" + wrap.toStr() + "-" + name + "|w=" + r.width.toStr() + "|h=" + r.height.toStr()
        end for
    end for
end sub

sub probeXml()
    for each id in ["xmlGarbage", "xmlUnknown", "xmlEmpty", "xmlNamed"]
        lbl = m.top.findNode(id)
        r = lbl.boundingRect()
        print "PROBE|xml|Label.font|" + id + "|value=" + describeFont(lbl.font) + "|w=" + r.width.toStr() + "|h=" + r.height.toStr()
    end for
    holder = CreateObject("roSGNode", "FontHolder")
    for each field in ["plainFont", "namedFont", "garbageFont", "unknownFont"]
        print "PROBE|xml|FontHolder." + field + "|default|value=" + describeFont(holder.getField(field))
    end for
    holder.plainFont = "font:LargeBoldSystemFont"
    print "PROBE|xml|FontHolder.plainFont|font:LargeBoldSystemFont|value=" + describeFont(holder.plainFont)
    holder.plainFont = CreateObject("roSGNode", "Font")
    print "PROBE|xml|FontHolder.plainFont|font-bare|value=" + describeFont(holder.plainFont)
    cases = [
        { name: "invalid", value: invalid },
        { name: "font:NoSuchFont", value: "font:NoSuchFont" },
        { name: "string-garbage", value: "garbage" },
        { name: "string-empty", value: "" },
        { name: "node-Rectangle", value: CreateObject("roSGNode", "Rectangle") },
    ]
    for each c in cases
        holder.plainFont = "font:LargeBoldSystemFont"
        holder.plainFont = c.value
        print "PROBE|xml|FontHolder.plainFont|" + c.name + "|value=" + describeFont(holder.plainFont)
    end for
end sub

' RowList and PosterGrid with real items: what space the label and captions take when their font
' is invalid from the start, and when it goes invalid after rendering with a good font.
sub startLayout()
    m.stage.visible = false
    m.layout = m.top.findNode("layout")
    ' Launch parameter `layout=<names>` (e.g. `rlGood-pgBad`) builds only those nodes.
    wanted = m.global.probeLayout
    ' pgBad (caption1Font invalid from the start) kills the app on a device, so it only runs on request.
    if wanted = invalid then wanted = "rlGood-rlBad-rlLater-pgGood-pgLater"
    m.layoutItems = []
    specs = [
        ["rlGood", "RowList", [40, 20], "font:LargeBoldSystemFont"],
        ["rlBad", "RowList", [40, 200], invalid],
        ["rlLater", "RowList", [40, 380], "font:LargeBoldSystemFont"],
        ["pgGood", "PosterGrid", [700, 20], "font:LargeBoldSystemFont"],
        ["pgBad", "PosterGrid", [700, 250], invalid],
        ["pgLater", "PosterGrid", [700, 480], "font:LargeBoldSystemFont"],
    ]
    for each spec in specs
        if Instr(1, "-" + wanted + "-", "-" + spec[0] + "-") > 0
            if spec[1] = "RowList"
                node = makeRowList(spec[2], spec[3])
            else
                node = makePosterGrid(spec[2], spec[3])
            end if
            m.layoutItems.push([spec[0], node])
        end if
    end for
    m.layoutStep = 0
    m.layoutTimer.observeField("fire", "layoutStep")
    print "PROBE|layout|build"
    m.layoutTimer.control = "start"
end sub

sub layoutStep()
    m.layoutStep += 1
    reportLayout("step" + m.layoutStep.toStr())
    if m.layoutStep = 1
        setLater("invalid")
        print "PROBE|layout|later-invalid|shown"
        m.layoutTimer.control = "start"
    else if m.layoutStep = 2
        setLater("font:SmallestSystemFont")
        print "PROBE|layout|later-smallest|shown"
        m.layoutTimer.control = "start"
    else
        print "PROBE|done"
    end if
end sub

sub reportLayout(stepName as string)
    for each item in m.layoutItems
        r = item[1].boundingRect()
        line = "PROBE|layout|" + stepName + "|" + item[0] + "|w=" + r.width.toStr() + "|h=" + r.height.toStr()
        ' Where the first item sits tells whether the label or caption space is kept.
        cell = firstCell(item[1])
        if cell <> invalid
            cr = cell.sceneBoundingRect()
            line += "|cellY=" + cr.y.toStr() + "|cellH=" + cr.height.toStr()
        end if
        print line
    end for
end sub

sub setLater(value as string)
    font = invalid
    if value <> "invalid" then font = value
    for each item in m.layoutItems
        if item[0] = "rlLater" then item[1].rowLabelFont = font
        if item[0] = "pgLater" then item[1].caption1Font = font
    end for
end sub

function firstCell(node as object) as object
    if node.subtype() <> "RowList" then return invalid
    return findSubtype(node, "RowItem")
end function

function findSubtype(node as object, subtype as string) as object
    for i = 0 to node.getChildCount() - 1
        child = node.getChild(i)
        if child.subtype() = subtype then return child
        found = findSubtype(child, subtype)
        if found <> invalid then return found
    end for
    return invalid
end function

function makeRowList(translation as object, font as dynamic) as object
    rl = m.layout.createChild("RowList")
    rl.translation = translation
    rl.itemComponentName = "RowItem"
    rl.itemSize = [600, 120]
    rl.rowItemSize = [[120, 60]]
    rl.rowItemSpacing = [[10, 0]]
    rl.numRows = 1
    rl.showRowLabel = [true]
    rl.rowLabelFont = font
    rl.content = rowContent()
    return rl
end function

function makePosterGrid(translation as object, font as dynamic) as object
    pg = m.layout.createChild("PosterGrid")
    pg.translation = translation
    pg.basePosterSize = [100, 60]
    pg.numColumns = 3
    pg.numRows = 1
    pg.itemSpacing = [10, 10]
    pg.caption1NumLines = 1
    pg.caption2NumLines = 0
    pg.caption1Font = font
    root = CreateObject("roSGNode", "ContentNode")
    for i = 1 to 3
        item = root.createChild("ContentNode")
        item.HDGRIDPOSTERURL = "pkg:/images/poster.png"
        item.HDPOSTERURL = "pkg:/images/poster.png"
        item.shortDescriptionLine1 = "Caption " + i.toStr()
    end for
    pg.content = root
    return pg
end function

sub finish()
    print "PROBE|render|done"
    startLayout()
end sub

sub setFont(node as object, field as string, value as dynamic)
    aa = {}
    aa[field] = value
    node.setFields(aa)
end sub

sub report(node as object, subtype as string, field as string, caseName as string, measure as boolean)
    line = "PROBE|" + subtype + "." + field + "|" + caseName + "|value=" + describeFont(node.getField(field))
    if measure
        r = node.boundingRect()
        line += "|w=" + r.width.toStr() + "|h=" + r.height.toStr()
    end if
    print line
end sub

function describeFont(v as dynamic) as string
    if v = invalid then return "invalid"
    if type(v) <> "roSGNode" then return type(v)
    if v.subtype() <> "Font" then return v.subtype()
    return "Font(uri=" + v.uri + ",size=" + v.size.toStr() + ")"
end function

function newNode(subtype as string) as object
    node = CreateObject("roSGNode", subtype)
    if subtype = "Button" or subtype = "Label" or subtype = "ScrollingLabel" or subtype = "MonospaceLabel"
        node.text = m.text
    end if
    if subtype = "ScrollingLabel" then node.maxWidth = 1000
    return node
end function

function makeFont(uri as string, size as integer) as object
    f = CreateObject("roSGNode", "Font")
    f.uri = uri
    f.size = size
    return f
end function

function listContent(count as integer) as object
    root = CreateObject("roSGNode", "ContentNode")
    for i = 1 to count
        item = root.createChild("ContentNode")
        item.title = "Item " + i.toStr()
    end for
    return root
end function

function rowContent() as object
    root = CreateObject("roSGNode", "ContentNode")
    row = root.createChild("ContentNode")
    row.title = "Row Label"
    for i = 1 to 3
        item = row.createChild("ContentNode")
        item.title = "Cell " + i.toStr()
    end for
    return root
end function

function gridContent() as object
    root = CreateObject("roSGNode", "ContentNode")
    for i = 1 to 3
        item = root.createChild("ContentNode")
        item.shortDescriptionLine1 = "Caption " + i.toStr()
        item.shortDescriptionLine2 = "Second " + i.toStr()
    end for
    return root
end function
