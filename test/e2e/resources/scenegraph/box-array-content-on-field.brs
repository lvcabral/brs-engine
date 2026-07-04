sub main()
    theme = "{""colors"": {""button"": ""0xCDCDCDFF""}, ""other"": {""number"": 30}, ""ui"": {}}"
    aa = parseJson(theme)
    color = aa.colors.button
    print "button (aa): "; color; ", type: "; type(color); ", type3: "; type(color, 3)
    number = aa.other.number
    print "number (aa): "; number; ", type: "; type(number); ", type3: "; type(number, 3)
    node = CreateObject("roSGNode", "Node")
    node.addField("colors", "assocarray", false)
    node.addField("other", "assocarray", false)
    node.colors = aa.colors
    node.other = aa.other
    nodeColor = node.colors.button
    nodeNumber = node.other.number
    print "button (node.aa): "; nodeColor; ", type: "; type(nodeColor); ", type3: "; type(nodeColor, 3)
    print "number (node.aa): "; nodeNumber; ", type: "; type(nodeNumber); ", type3: "; type(nodeNumber, 3)

    ' Non-literal scalars (parsed from JSON) are boxed when read from a node field.
    parsed = parseJson("{ ""str"": ""text"", ""int"": 42, ""flt"": 1.5 }")
    node.addField("parsed", "assocarray", false)
    node.parsed = parsed
    printType("str (json.aa)", node.parsed.str)
    printType("int (json.aa)", node.parsed.int)
    printType("flt (json.aa)", node.parsed.flt)

    ' Literal scalars (written directly in source) are NOT boxed, matching Roku.
    scalars = { str: "text", int: 42, flt: 3.5, dbl: 2.5#, lng: 9000000000& }
    node.addField("scalars", "assocarray", false)
    node.scalars = scalars
    printType("str (lit.aa)", node.scalars.str)
    printType("int (lit.aa)", node.scalars.int)
    printType("flt (lit.aa)", node.scalars.flt)
    printType("dbl (lit.aa)", node.scalars.dbl)
    printType("lng (lit.aa)", node.scalars.lng)

    ' Same holds for a literal roArray field.
    list = ["text", 42, 3.5, 2.5#, 9000000000&]
    node.addField("list", "array", false)
    node.list = list
    printType("str (lit.arr)", node.list[0])
    printType("int (lit.arr)", node.list[1])
    printType("flt (lit.arr)", node.list[2])
    printType("dbl (lit.arr)", node.list[3])
    printType("lng (lit.arr)", node.list[4])

    ' Booleans are interned singletons and cannot carry a per-instance literal flag,
    ' so a literal boolean is still boxed (documented limitation).
    node.addField("flag", "array", false)
    node.flag = [true]
    printType("bool (lit.arr)", node.flag[0])

    ' Literalness is preserved recursively through a mixed array/AssocArray hierarchy.
    tree = [{ items: [7] }]
    node.addField("tree", "array", false)
    node.tree = tree
    printType("nested (lit.arr)", node.tree[0].items[0])
end sub

sub printType(name as string, value as dynamic)
    print name; ": type: "; type(value); ", type3: "; type(value, 3)
end sub
