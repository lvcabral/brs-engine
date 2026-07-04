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

    ' Every boxable scalar type stored in an AssocArray field is boxed when read back.
    scalars = { str: "text", int: 42, flt: 3.5, dbl: 2.5#, lng: 9000000000&, bool: true }
    node.addField("scalars", "assocarray", false)
    node.scalars = scalars
    printType("str (node.aa)", node.scalars.str)
    printType("int (node.aa)", node.scalars.int)
    printType("flt (node.aa)", node.scalars.flt)
    printType("dbl (node.aa)", node.scalars.dbl)
    printType("lng (node.aa)", node.scalars.lng)
    printType("bool (node.aa)", node.scalars.bool)

    ' The same happens for an roArray field (each element is boxed).
    list = ["text", 42, 3.5, 2.5#, 9000000000&, true]
    node.addField("list", "array", false)
    node.list = list
    printType("str (node.arr)", node.list[0])
    printType("int (node.arr)", node.list[1])
    printType("flt (node.arr)", node.list[2])
    printType("dbl (node.arr)", node.list[3])
    printType("lng (node.arr)", node.list[4])
    printType("bool (node.arr)", node.list[5])

    ' Boxing is recursive through a mixed array/AssocArray hierarchy.
    tree = [{ items: [7] }]
    node.addField("tree", "array", false)
    node.tree = tree
    printType("nested (node.arr)", node.tree[0].items[0])
end sub

sub printType(name as string, value as dynamic)
    print name; ": type: "; type(value); ", type3: "; type(value, 3)
end sub
