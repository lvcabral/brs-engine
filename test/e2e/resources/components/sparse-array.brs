' roArray holes (entries never set) through for each, ifEnum, ifArrayGet, indexing and the array methods.
' Expected output is the device trace in test/simulator/probes/sparse-array-probe/device-trace.txt,
' except deleteHoleDuring (the enumeration cursor on Delete is fixed separately in #1288).
sub main()
    out("start", [])

    a = sparse()
    out("count", [a.Count().toStr()])
    s = ""
    for each b in a
        s = s + show(b) + ","
    end for
    out("forEach", [s])

    a = sparse()
    a.Reset()
    s = ""
    n = 0
    while a.IsNext() and n < 8
        s = s + show(a.Next()) + ","
        n = n + 1
    end while
    out("manualNext", [s])

    a = sparse()
    out("index", [show(a[0]), show(a[2]), show(a[9])])
    out("getEntry", [show(a.GetEntry(0)), show(a.GetEntry(2))])
    out("peekShift", [show(sparseHead().Peek()), show(sparseHead().Shift())])
    a = sparseTail()
    out("popTail", [show(a.Pop()), a.Count().toStr()])

    ' Delete on a hole.
    a = sparse()
    out("deleteHole", [a.Delete(0).toStr(), a.Count().toStr(), show(a[0])])

    a = sparse()
    out("join", [Type(a.Join(","))])
    out("isInvalid", [(sparse()[0] = invalid).toStr(), Type(sparse()[0])])

    ' Holes copied by Append, Slice-like copies and FormatJson.
    b = [9]
    b.Append(sparse())
    out("append", [b.Count().toStr()])
    out("json", [FormatJson(sparse())])
    out("done", [])
end sub

' Entries 0 and 2 never set: [<hole>, 1, <hole>, 3]
function sparse() as object
    a = []
    a[1] = 1
    a[3] = 3
    return a
end function

function sparseHead() as object
    a = []
    a[1] = 1
    return a
end function

function sparseTail() as object
    a = CreateObject("roArray", 4, true)
    a[0] = 0
    a[5] = 5
    a.Delete(5)
    return a
end function

sub out(name as string, values as object)
    line = "PROBE|" + name
    for each v in values
        line = line + "|" + v
    end for
    print line
end sub

function show(v as dynamic) as string
    if v = invalid then return "invalid:" + Type(v)
    return Type(v) + ":" + v.toStr()
end function
