sub main()
    ' DeepCopy tests
    utils = CreateObject("roUtils")
    di = CreateObject("roDeviceInfo")
    ' IsSameObject tests
    shared = {}
    aa = {"a": shared, "b": shared}
    ? utils.isSameObject(aa, aa) ' returns true
    ? utils.isSameObject(aa, {}) ' returns false
    ? utils.isSameObject(aa.a, aa.b) ' returns true
    ' Complex Object test
    aa = {a: 1, b: {b1: 42}, c: di, d: [1, 2, {x: "y"}]}
    aa.list = CreateObject("roList")
    aa.list.AddTail("a")
    aa.list.AddTail("b")
    aa.list.AddTail("c")
    aa.list.AddTail("d")
    aa.byteArray = CreateObject("roByteArray")
    aa.byteArray.FromAsciiString("coração❤")
    new_aa = utils.DeepCopy(aa)
    ? "IsSameObject", utils.IsSameObject(aa, new_aa)
    ? "new_aa.a", new_aa.a
    ? "new_aa.b.b1", new_aa.b.b1
    ? "new_aa.c", new_aa.c ' invalid, roDeviceInfo is not copyable
    ? "new_aa.d[0]", new_aa.d[0]
    ? "new_aa.d[1]", new_aa.d[1]
    ? "new_aa.d[2].x", new_aa.d[2].x
    ? "new_aa.list.count", new_aa.list?.count?()
    ? "new_aa.byteArray.toAsciiString", new_aa.byteArray?.toAsciiString?()
    ' Array of boxed objects test
    arr = [box(1), box(2), box(3)]
    arrCopy = utils.deepCopy(arr)
    arrCopy[0].setInt(10)
    arr[2].setInt(30)
    print "arr[0]: "; arr[0], type(arr[0], 3)
    print "arrCopy[0]: "; arrCopy[0], type(arrCopy[0], 3)
    print "arr[2]: "; arr[2], type(arr[2], 3)
    print "arrCopy[2]: "; arrCopy[2], type(arrCopy[2], 3)
    ' Test deepCopy and clone
    node = createObject("roSGNode", "ContentNode")
    node.addFields({
        link: "http://www.example.com/image.jpg",
        aa: {id: 1, name: "one"},
        boxedInt: box(5),
        nodeField: createObject("roSGNode", "ContentNode")
    })

    utils = CreateObject("roUtils")
    copy = utils.deepCopy(node)
    clone = node.clone(true)
    print "node.link: "; node.link
    print "copy.link: "; copy.link
    print "clone.link: "; clone.link
    aa = node.aa
    aa.name = "changed"
    node.setField("aa", aa)
    bi = copy.boxedInt
    bi.setInt(10)
    copy.setField("boxedInt", bi)
    print "node.aa.name: "; node.aa.name
    print "copy.aa.name: "; copy.aa.name
    print "clone.aa.name: "; clone.aa.name
    print "node.boxedInt: "; node.boxedInt.getInt()
    print "copy.boxedInt: "; copy.boxedInt.getInt()
    print "clone.boxedInt: "; clone.boxedInt.getInt()
    print "isSameObject(node.aa, copy.aa): "; utils.isSameObject(node.aa, copy.aa)
    print "isSameObject(node.aa, clone.aa): "; utils.isSameObject(node.aa, clone.aa)
    print "isSameObject(node.nodeField, copy.nodeField): "; utils.isSameObject(node.nodeField, copy.nodeField)
    print "isSameObject(node.nodeField, clone.nodeField): "; utils.isSameObject(node.nodeField, clone.nodeField)
    print "isSameNode(node.nodeField, copy.nodeField): "; node.nodeField.isSameNode(copy.nodeField)
    print "isSameNode(node.nodeField, clone.nodeField): "; node.nodeField.isSameNode(clone.nodeField)
    print "isSameNode(node, copy): "; node.isSameNode(copy)
    print "isSameNode(node, clone): "; node.isSameNode(clone)

    ' Test moveIntoField and moveFromField
    sub_array = [1, 2, 3]
    aa = {foo: "hello", bar: sub_array, arr: [4, 5, 6]}
    ' At this point, there is an external reference into aa
    print node.moveIntoField("aa", aa)
    sub_array[0] = 10
    print aa ' Prints an empty AA
    print sub_array ' Prints [1,2,3] - this was preserved
    print node.aa
    print node.aa.bar
    print node.aa.arr

    n = CreateObject("roSGNode", "ContentNode")
    n.AddField("aa_field", "assocarray", true)
    n.AddField("array_field", "array", true)
    n.aa_field = {key: "value"}' or use moveIntoField()
    my_aa = n.MoveFromField("aa_field")
    print my_aa ' prints {key: "value"}
    print n.aa_field ' invalid
end sub