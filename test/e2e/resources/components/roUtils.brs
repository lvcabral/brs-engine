sub main()
    ' DeepCopy tests
    utils = CreateObject("roUtils")
    di = CreateObject("roDeviceInfo")
    aa = {a: 1, b: {b1: 42}, c: di}
    new_aa = utils.DeepCopy(aa)
    ? "IsSameObject", utils.IsSameObject(aa, new_aa)
    ? "new_aa.a", new_aa.a
    ? "new_aa.b.b1", new_aa.b.b1
    ? "new_aa.c", new_aa.c ' invalid, roDeviceInfo is not copyable
    ' IsSameObject tests
    shared = {}
    aa = {"a": shared, "b": shared}
    ? utils.isSameObject(aa, aa) ' returns true
    ? utils.isSameObject(aa, {}) ' returns false
    ? utils.isSameObject(aa.a, aa.b) ' returns true
end sub