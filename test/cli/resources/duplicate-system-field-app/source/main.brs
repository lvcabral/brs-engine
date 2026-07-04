sub Main()
    print "=== Duplicate System Field Repro ==="

    ' Redeclaring a field inherited from a built-in base type (a "system" field) is
    ' allowed on a real Roku: the XML declaration re-applies its default and any fields
    ' declared after it are still added. Before the fix, the duplicate-field guard fired
    ' for the inherited "opacity" field, aborting addFields early so both the new default
    ' and the trailing "customField" were lost.
    sysNode = CreateObject("roSGNode", "SystemFieldGroup")
    print "opacity = "; sysNode.opacity
    print "customField = "; sysNode.customField

    ' Redeclaring a field defined in an ANCESTOR XML component is still a duplicate error:
    ' the guard must remain for non-system fields, so "afterField" is never added.
    xmlNode = CreateObject("roSGNode", "XmlChildComp")
    print "sharedField = "; xmlNode.sharedField
    print "afterField type = "; type(xmlNode.afterField)

    print "=== Duplicate System Field Repro Complete ==="
end sub
