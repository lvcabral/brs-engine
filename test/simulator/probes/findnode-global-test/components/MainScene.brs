sub init()
    m.top.id = "TheScene"
    m.initLines = []
    m.settledLines = []
    m.lines = m.initLines

    ' Run once during init() (before the screen is shown) and once after the tree has settled,
    ' so a timing-dependent answer is visible instead of being mistaken for a semantic one.
    runBattery("INIT")

    m.timer = CreateObject("roSGNode", "Timer")
    m.timer.duration = 1
    m.timer.observeField("fire", "onSettled")
    m.timer.control = "start"
end sub

sub onSettled()
    m.lines = m.settledLines
    runBattery("SETTLED")
    m.top.findNode("ResultsInit").text = joinLines(m.initLines)
    m.top.findNode("ResultsSettled").text = joinLines(m.settledLines)
end sub

sub runBattery(phase as String)
    add("========== " + phase + " ==========")

    ' Controls: the scene reaches its own descendants, including inside a custom component.
    add("A m.top.findNode(SceneChild)      = " + describeNode(m.top.findNode("SceneChild")))
    add("B m.top.findNode(InnerPanelLabel) = " + describeNode(m.top.findNode("InnerPanelLabel")))

    ' THE QUESTION: does the global node reach the scene tree?
    add("C m.global.findNode(SceneChild)   = " + describeNode(m.global.findNode("SceneChild")))
    add("D m.global.findNode(NestedLabel)  = " + describeNode(m.global.findNode("NestedLabel")))
    add("E m.global.findNode(InnerPanelLbl)= " + describeNode(m.global.findNode("InnerPanelLabel")))
    add("F m.global.findNode(TheScene)     = " + describeNode(m.global.findNode("TheScene")))
    add("G m.global.findNode(DoesNotExist) = " + describeNode(m.global.findNode("DoesNotExist")))

    ' Does the global node find its own descendants? (child appended once, during INIT)
    if phase = "INIT"
        ownChild = CreateObject("roSGNode", "Node")
        ownChild.id = "GlobalOwnChild"
        m.global.appendChild(ownChild)
    end if
    add("H m.global.findNode(GlobalOwnChld)= " + describeNode(m.global.findNode("GlobalOwnChild")))
    add("I m.top.findNode(GlobalOwnChild)  = " + describeNode(m.top.findNode("GlobalOwnChild")))

    ' Shape of the global node itself.
    add("J m.global.subtype()              = " + m.global.subtype())
    add("K m.global.getParent()            = " + describeNode(m.global.getParent()))
    add("L m.global.getChildCount()        = " + str(m.global.getChildCount()).Trim())

    ' Control: a detached plain node must NOT reach the scene.
    detached = CreateObject("roSGNode", "Group")
    detached.id = "DetachedGroup"
    add("M detachedGrp.findNode(SceneChild)= " + describeNode(detached.findNode("SceneChild")))

    ' The app pattern: a detached custom component calling m.global.findNode() from its init().
    helper = CreateObject("roSGNode", "DetachedHelper")
    add("N helper.init m.global.findNode   = " + helper.globalFind)
    add("O helper.init m.top.findNode      = " + helper.topFind)
    add("P helper.init m.global.getParent()= " + helper.globalParent)

    ' Unrelated probe, same run: is pkg:/source in the global scope for components?
    add("Q pkg:/source function in scope   = " + probeSourceScope())
    add("")
end sub

' Calls a function that lives only in pkg:/source and is not referenced by any <script> tag.
function probeSourceScope() as String
    result = ""
    try
        result = sourceScopeMarker()
    catch e
        result = "NOT-IN-SCOPE (" + e.message + ")"
    end try
    return result
end function

sub add(line as String)
    m.lines.push(line)
    ? "[FINDNODE] " + line
end sub

function joinLines(lines as Object) as String
    out = ""
    for each line in lines
        out = out + line + chr(10)
    end for
    return out
end function
