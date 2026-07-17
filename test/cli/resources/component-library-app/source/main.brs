sub Main()
    print "=== Component Library Repro ==="

    ' A `Library` statement inside a component <script> must load the library's
    ' functions into that component's scope (matching Roku), gated by the same
    ' manifest entries as main-scope libraries. Before the fix the statement was
    ' parsed and discarded, so Roku_Ads() was undefined inside the component.
    node = CreateObject("roSGNode", "AdsComponent")
    print "rafType = "; node.rafType
    print "adUrl = "; node.adUrl
    print "podCount = "; node.podCount
    print "libVersion = "; node.libVersion
    print "imaLoaded = "; node.imaLoaded

    print "=== Component Library Repro Complete ==="
end sub
