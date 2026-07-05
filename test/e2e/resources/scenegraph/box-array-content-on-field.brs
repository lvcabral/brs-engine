sub main()
    node = CreateObject("roSGNode", "Node")

    ' Literal Control
    printType("str (lit)", "text")
    printType("int (lit)", 42)
    printType("flt (lit)", 1.5)
    printType("dbl (lit)", 2.5#)
    printType("lng (lit)", 9000000000&)
    printType("bool (lit)", true)

    ' Boxed Control
    printType("str (box)", box("text"))
    printType("int (box)", box(42))
    printType("flt (box)", box(1.5))
    printType("dbl (box)", box(2.5#))
    printType("lng (box)", box(9000000000&))
    printType("bool (box)", box(true))

    ' Non-literal scalars (parsed from JSON) shows c-type returns.
    parsed = parseJson("{ ""str"": ""text"", ""int"": 42, ""flt"": 1.5, ""bool"": true }")
    parsed.int2 = 70 ' Literal integer to compare with parsed.int (parsed from JSON).
    printType("str (aa)", parsed.str)
    printType("int (aa)", parsed.int)
    printType("int2 (aa)", parsed.int2)
    printType("flt (aa)", parsed.flt)
    printType("bool (aa)", parsed.bool)
    ' Non-literal scalars (parsed from JSON) are boxed when read from a node field.
    node.addField("parsed", "assocarray", false)
    node.parsed = parsed
    printType("str (json.aa)", node.parsed.str)
    printType("int (json.aa)", node.parsed.int)
    printType("int2 (json.aa)", node.parsed.int2)
    printType("flt (json.aa)", node.parsed.flt)
    printType("bool (json.aa)", node.parsed.bool)

    ' Literal scalars (written directly in source).
    scalars = { str: "text", int: 42, flt: 3.5, dbl: 2.5#, lng: 9000000000& }
    printType("str (lit.aa)", scalars.str)
    printType("int (lit.aa)", scalars.int)
    printType("flt (lit.aa)", scalars.flt)
    printType("dbl (lit.aa)", scalars.dbl)
    printType("lng (lit.aa)", scalars.lng)

    ' Literal scalars (written directly in source) are NOT boxed, matching Roku.
    node.addField("scalars", "assocarray", false)
    node.scalars = scalars
    printType("str (lit.node)", node.scalars.str)
    printType("int (lit.node)", node.scalars.int)
    printType("flt (lit.node)", node.scalars.flt)
    printType("dbl (lit.node)", node.scalars.dbl)
    printType("lng (lit.node)", node.scalars.lng)

    ' Parsed arrays (from JSON) are boxed when read from a node field.
    parsedArray = parseJson("[ ""text"", 42, 3.5, false ]")
    node.addField("parsedArray", "array", false)
    node.parsedArray = parsedArray
    printType("str (json.arr)", node.parsedArray[0])
    printType("int (json.arr)", node.parsedArray[1])
    printType("flt (json.arr)", node.parsedArray[2])
    printType("bool (json.arr)", node.parsedArray[3])

    ' Same holds for a literal roArray field.
    list = ["text", 42, 3.5, 2.5#, 9000000000&, true]
    node.addField("list", "array", false)
    node.list = list
    printType("str (lit.arr)", node.list[0])
    printType("int (lit.arr)", node.list[1])
    printType("flt (lit.arr)", node.list[2])
    printType("dbl (lit.arr)", node.list[3])
    printType("lng (lit.arr)", node.list[4])
    printType("bool (lit.arr)", node.list[5])

    ' Literalness is preserved recursively through a mixed array/AssocArray hierarchy.
    tree = [{ items: [7] }]
    node.addField("tree", "array", false)
    node.tree = tree
    printType("nested (lit.arr)", node.tree[0].items[0])
end sub

sub printType(name as string, value as dynamic)
    print name; ": type: "; type(value); ", type3: "; type(value, 3)
end sub
