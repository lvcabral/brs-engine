' Settles the one sub-question left open for "clone() of a custom component".
'
' clone-and-setref-probe established (device 3810X / OS 15.3, identical on the main and render threads)
' that cloning a custom component returns a plain node carrying only a base type's fields. For an
' `extends="Node"` component the clone reported subtype `Node` with 4 fields. What it could NOT tell
' apart is WHICH base:
'
'   (a) always the root `Node`, or
'   (b) the component's own built-in base -- `Group` for extends="Group", `Label` for extends="Label" ...
'
' D1..D3 answer that by cloning components over three different built-in bases and printing a FRESH
' instance of that base alongside, so the field counts can be compared directly. D4 asks what a custom
' component extending ANOTHER CUSTOM component collapses to (its built-in base `Group`, or the
' intermediate `GroupAgent`?). D5 checks whether base-field VALUES carry over (only `id` was known to),
' and D6 whether a clone gets the component's XML <children>.
sub Main()
    print "=== Clone Base Type Probe ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    screen.CreateScene("MainScene")
    screen.show()

    di = CreateObject("roDeviceInfo")
    print "[env] model=" + di.GetModel() + " os=" + di.GetOSVersion().major + "." + di.GetOSVersion().minor
    print "[note] clone of a custom component is thread-independent (proven in clone-and-setref-probe),"
    print "[note] so this runs on the main thread only."

    ' D0 reproduces clone-and-setref-probe C1 (extends="Node", clone had 4 fields) as a control.
    probeClone("D0", "NodeAgent", "Node", "marker")
    probeClone("D1", "GroupAgent", "Group", "marker")
    probeClone("D2", "LabelAgent", "Label", "marker")
    probeClone("D3", "DataAgent", "ContentNode", "marker")
    probeClone("D4", "DerivedAgent", "Group", "derivedMarker")
    print "        ^ D4: 'Group' => collapses to the BUILT-IN base; 'GroupAgent' => to the immediate parent"

    probeBaseFieldValues()
    probeXmlChildren()

    print "=== Clone Base Type Probe Complete ==="
end sub

sub probeClone(tag as String, compName as String, baseName as String, ifField as String)
    print "--- " + tag + ": clone(" + compName + " extends " + baseName + ") ---"
    n = CreateObject("roSGNode", compName)
    if n = invalid
        print "  " + tag + " FAILED to create " + compName
        return
    end if
    n.id = tag + "-id"
    n.callFunc("configure", tag + "-token")
    n.addField("dyn", "string", false)
    n.dyn = tag + "-dyn"

    fresh = CreateObject("roSGNode", baseName)
    say(tag + ".1  orig subtype               ", n.subtype())
    say(tag + ".2  orig field count           ", n.getFields().count())
    say(tag + ".3  FRESH " + baseName + " field count", fieldCountOf(fresh))
    print "        ^ compare .3 with .5: equal => the clone is exactly a fresh " + baseName

    c = n.clone(false)
    say(tag + ".4  clone subtype              ", subtypeOf(c))
    say(tag + ".5  clone field count          ", fieldCountOf(c))
    say(tag + ".6  clone isSubtype(" + baseName + ")   ", isSubOf(c, baseName))
    say(tag + ".7  clone isSubtype(" + compName + ")", isSubOf(c, compName))
    say(tag + ".8  clone hasField(" + ifField + ")  ", hasFieldOf(c, ifField))
    say(tag + ".9  clone hasField(dyn)        ", hasFieldOf(c, "dyn"))
    say(tag + ".10 clone id (a base field)    ", fieldOf(c, "id"))
    say(tag + ".11 clone callFunc readToken   ", tokenOf(c))
end sub

' Only `id` was known to survive. Does the clone carry the INSTANCE's base-field values, or the base
' type's defaults? Group defaults: translation [0,0], opacity 1, visible true.
sub probeBaseFieldValues()
    print "--- D5: do base-field VALUES carry, or reset to the base type's defaults? ---"
    g = CreateObject("roSGNode", "GroupAgent")
    g.id = "D5-id"
    g.translation = [11, 22]
    g.opacity = 0.5
    g.visible = false
    c = g.clone(false)
    say("D5.1  clone id                    ", fieldOf(c, "id"))
    say("D5.2  clone translation[0]        ", elemOf(c, "translation", 0))
    say("D5.3  clone translation[1]        ", elemOf(c, "translation", 1))
    say("D5.4  clone opacity               ", fieldOf(c, "opacity"))
    say("D5.5  clone visible               ", fieldOf(c, "visible"))
    print "        ^ 11/22/0.5/false => instance values carried; 0/0/1/true => reset to defaults"
end sub

' GroupAgent declares two Rectangles in XML <children>. A clone that drops the component layer may or
' may not still have them.
sub probeXmlChildren()
    print "--- D6: does a clone get the component's XML <children>? ---"
    g = CreateObject("roSGNode", "GroupAgent")
    say("D6.1  orig childCount             ", g.getChildCount())
    g.appendChild(CreateObject("roSGNode", "Rectangle"))
    say("D6.2  orig childCount after append", g.getChildCount())
    c0 = g.clone(false)
    say("D6.3  clone(false) childCount     ", childCountOf(c0))
    c1 = g.clone(true)
    say("D6.4  clone(true) childCount      ", childCountOf(c1))
    say("D6.5  clone(true) subtype         ", subtypeOf(c1))
    say("D6.6  clone(true) findNode xmlKid1", foundOf(c1, "xmlKid1"))
    print "        ^ D6.3/D6.4 vs D6.1/D6.2 shows whether XML children survive the collapse"
end sub

' -------------------------------------- helpers ---------------------------------------------

sub say(label as String, value as Dynamic)
    print "  " + label + " = " + fmt(value)
end sub

function fmt(v as Dynamic) as String
    if v = invalid then return "invalid"
    t = type(v)
    if t = "Boolean" or t = "roBoolean"
        if v then return "true"
        return "false"
    end if
    if t = "String" or t = "roString" then return v
    if t = "Integer" or t = "roInt" or t = "roInteger" then return Str(v).Trim()
    if t = "Float" or t = "roFloat" or t = "Double" or t = "roDouble" then return Str(v).Trim()
    return t
end function

function subtypeOf(n as Dynamic) as String
    if n = invalid then return "n/a"
    return n.subtype()
end function

function isSubOf(n as Dynamic, t as String) as String
    if n = invalid then return "n/a"
    return fmt(n.isSubtype(t))
end function

function hasFieldOf(n as Dynamic, f as String) as String
    if n = invalid then return "n/a"
    return fmt(n.hasField(f))
end function

function fieldOf(n as Dynamic, f as String) as String
    if n = invalid then return "n/a"
    return fmt(n.getField(f))
end function

function fieldCountOf(n as Dynamic) as String
    if n = invalid then return "n/a"
    return fmt(n.getFields().count())
end function

function childCountOf(n as Dynamic) as String
    if n = invalid then return "n/a"
    return fmt(n.getChildCount())
end function

function tokenOf(n as Dynamic) as String
    if n = invalid then return "n/a"
    return fmt(n.callFunc("readToken"))
end function

function elemOf(n as Dynamic, f as String, i as Integer) as String
    if n = invalid then return "n/a"
    v = n.getField(f)
    if v = invalid then return "invalid"
    if type(v) <> "roArray" then return type(v)
    return fmt(v[i])
end function

function foundOf(n as Dynamic, id as String) as String
    if n = invalid then return "n/a"
    f = n.findNode(id)
    if f = invalid then return "invalid"
    return f.subtype()
end function
