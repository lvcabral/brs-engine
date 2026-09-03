' Confirms brs-engine's isSubtype()/parentSubtype() results for multi-level built-in SceneGraph
' class chains against a real Roku device, after fixing subtypeHierarchy's "first write wins" bug
' (see src/extensions/scenegraph/nodes/Node.ts's setExtendsType doc comment). Before the fix, every
' built-in node beyond a direct Group child collapsed straight to "Node": RowList.isSubtype("ArrayGrid"),
' Rectangle.isSubtype("Group"), CheckList.isSubtype("LabelList") all incorrectly returned false, and
' parentSubtype() skipped every intermediate ancestor.
'
' Also probes the separate "RenderableNode" alias-for-Group feature (both directly and as a custom
' component's `extends` target), since it shares the same isSubtypeCheck/subtypeHierarchy machinery.
sub Main()
    print "=== Group Subtype Hierarchy Probe ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    screen.CreateScene("MainScene")
    screen.show()

    di = CreateObject("roDeviceInfo")
    ver = di.GetOSVersion()
    print "PROBE|env|model=" + di.GetModel() + " os=" + ver.major + "." + ver.minor

    ' Direct Group children (single hop).
    probeChain("Rectangle", ["Group", "Node"])
    probeChain("Poster", ["Group", "Node"])
    probeChain("Label", ["Group", "Node"])

    ' ArrayGrid family (two/three hops).
    probeChain("ArrayGrid", ["Group", "Node"])
    probeChain("RowList", ["ArrayGrid", "Group", "Node"])
    probeChain("ZoomRowList", ["ArrayGrid", "Group", "Node"])
    probeChain("MarkupGrid", ["ArrayGrid", "Group", "Node"])
    probeChain("MarkupList", ["ArrayGrid", "Group", "Node"])
    probeChain("TimeGrid", ["ArrayGrid", "Group", "Node"])
    probeChain("PosterGrid", ["ArrayGrid", "Group", "Node"])
    probeChain("LabelList", ["ArrayGrid", "Group", "Node"])
    probeChain("CheckList", ["LabelList", "ArrayGrid", "Group", "Node"])
    probeChain("RadioButtonList", ["LabelList", "ArrayGrid", "Group", "Node"])

    ' LayoutGroup family.
    probeChain("LayoutGroup", ["Group", "Node"])
    probeChain("ButtonGroup", ["LayoutGroup", "Group", "Node"])
    probeChain("StdDlgButtonArea", ["ButtonGroup", "LayoutGroup", "Group", "Node"])

    ' Label family.
    probeChain("MonospaceLabel", ["Label", "Group", "Node"])
    probeChain("ScrollingLabel", ["Label", "Group", "Node"])

    ' TextEditBox / TargetGroup / Scene / PinPad / Panel / Button - each a hub with one child.
    probeChain("TextEditBox", ["Group", "Node"])
    probeChain("VoiceTextEditBox", ["TextEditBox", "Group", "Node"])
    probeChain("TargetGroup", ["Group", "Node"])
    probeChain("TargetList", ["TargetGroup", "Group", "Node"])
    probeChain("Scene", ["Group", "Node"])
    probeChain("OverhangPanelSetScene", ["Scene", "Group", "Node"])
    probeChain("PinPad", ["Group", "Node"])
    probeChain("ParentalControlPinPad", ["PinPad", "Group", "Node"])
    probeChain("Panel", ["Group", "Node"])
    probeChain("GridPanel", ["Panel", "Group", "Node"])
    probeChain("ListPanel", ["Panel", "Group", "Node"])
    probeChain("Button", ["Group", "Node"])
    probeChain("StdDlgButton", ["Button", "Group", "Node"])

    ' Dialog family.
    probeChain("Dialog", ["Group", "Node"])
    probeChain("KeyboardDialog", ["Dialog", "Group", "Node"])
    probeChain("PinDialog", ["Dialog", "Group", "Node"])
    probeChain("ProgressDialog", ["Dialog", "Group", "Node"])
    probeChain("StandardDialog", ["Group", "Node"])
    probeChain("StandardPinPadDialog", ["StandardDialog", "Group", "Node"])
    probeChain("StandardKeyboardDialog", ["StandardDialog", "Group", "Node"])
    probeChain("StandardMessageDialog", ["StandardDialog", "Group", "Node"])
    probeChain("StandardProgressDialog", ["StandardDialog", "Group", "Node"])

    ' Dynamic keyboard family.
    probeChain("DynamicKeyboardBase", ["Group", "Node"])
    probeChain("DynamicKeyboard", ["DynamicKeyboardBase", "Group", "Node"])
    probeChain("DynamicPinPad", ["DynamicKeyboardBase", "Group", "Node"])
    probeChain("DynamicMiniKeyboard", ["DynamicKeyboardBase", "Group", "Node"])
    probeChain("DynamicCustomKeyboard", ["DynamicKeyboardBase", "Group", "Node"])

    ' Animation family - NOT part of the Group tree (extends Node via AnimationBase), included as a
    ' control to see whether Roku itself skips the AnimationBase hop the same way brs-engine still does.
    probeChain("Animation", ["AnimationBase", "Node"])
    probeChain("ParallelAnimation", ["AnimationBase", "Node"])
    probeChain("SequentialAnimation", ["AnimationBase", "Node"])

    ' Negative controls: must NOT be recognized as subtypes of unrelated branches.
    probeNegative("Rectangle", "ArrayGrid")
    probeNegative("RowList", "Rectangle")
    probeNegative("RowList", "LabelList")
    probeNegative("CheckList", "MarkupGrid")
    probeNegative("ButtonGroup", "ArrayGrid")

    ' RenderableNode: real Roku's documented alias for Group (see external-control-api.md's node
    ' dump sample, which tags a plain Group as <RenderableNode ...>).
    probeRenderableNode()

    ' Custom XML components: one extending a deep built-in chain, one extending the RenderableNode alias.
    probeCustomExtends("MyRowList", ["RowList", "ArrayGrid", "Group", "Node"])
    probeCustomExtends("MyRenderable", ["RenderableNode", "Group", "Node"])

    print "=== Group Subtype Hierarchy Probe Complete ==="
end sub

sub probeChain(typeName as String, chain as Object)
    n = CreateObject("roSGNode", typeName)
    if n = invalid
        print "PROBE|" + typeName + "|create=FAILED"
        return
    end if
    line = "PROBE|" + typeName + "|subtype=" + n.subtype() + "|parentSubtype=" + n.parentSubtype(typeName)
    for each t in chain
        line = line + "|isSubtype(" + t + ")=" + n.isSubtype(t).toStr()
    end for
    print line
end sub

sub probeNegative(typeName as String, notAncestor as String)
    n = CreateObject("roSGNode", typeName)
    if n = invalid
        print "PROBE|" + typeName + "-not-" + notAncestor + "|create=FAILED"
        return
    end if
    print "PROBE|" + typeName + "-not-" + notAncestor + "|isSubtype(" + notAncestor + ")=" + n.isSubtype(notAncestor).toStr() + " (expect false)"
end sub

sub probeRenderableNode()
    n = CreateObject("roSGNode", "RenderableNode")
    if n = invalid
        print "PROBE|RenderableNode|create=FAILED (type may not be a valid CreateObject target on this device)"
        return
    end if
    print "PROBE|RenderableNode|subtype=" + n.subtype() + "|isSubtype(Group)=" + n.isSubtype("Group").toStr() + "|isSubtype(Node)=" + n.isSubtype("Node").toStr()

    g = CreateObject("roSGNode", "Group")
    print "PROBE|Group|isSubtype(RenderableNode)=" + g.isSubtype("RenderableNode").toStr()
end sub

sub probeCustomExtends(compName as String, chain as Object)
    n = CreateObject("roSGNode", compName)
    if n = invalid
        print "PROBE|" + compName + "|create=FAILED"
        return
    end if
    line = "PROBE|" + compName + "|subtype=" + n.subtype()
    for each t in chain
        line = line + "|isSubtype(" + t + ")=" + n.isSubtype(t).toStr()
    end for
    print line
end sub
