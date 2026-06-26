sub main()
    node = createObject("roSGNode", "Node")

    ' addField must accept all three spellings of the AssocArray field type.
    ' Before the fix only "assocarray" / "roassociativearray" worked, so the
    ' "associativeArray" field was silently never created.
    print node.addField("aaCamel", "associativeArray", true)
    print node.addField("aaShort", "assocarray", true)
    print node.addField("aaRo", "roAssociativeArray", true)

    ' Each field must now exist on the node
    print node.hasField("aaCamel")
    print node.hasField("aaShort")
    print node.hasField("aaRo")

    ' ...and behave as a writable AssocArray field
    node.aaCamel = { foo: "bar" }
    print type(node.aaCamel)
    print node.aaCamel.foo
end sub
