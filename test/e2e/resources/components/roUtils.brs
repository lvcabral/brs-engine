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
end sub