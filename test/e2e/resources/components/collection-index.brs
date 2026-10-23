' Indexed reads/writes on roByteArray, roArray, roList and roXMLList for every numeric index type
' (intrinsic and boxed), negative and out-of-range indexes, through c[i] and GetEntry/SetEntry.
' Expected output is the device trace in test/simulator/probes/collection-index-probe/device-trace.txt.
sub main()
    out("start", [])
    for each kind in ["ba", "arr", "list", "xml"]
        reads(kind)
        writes(kind)
    end for
    entryType()
    for each kind in ["ba", "arr", "list", "xml"]
        out("read|" + kind + "|long-big", ["idx=" + desc(make(kind)[4294967297&])])
    end for
    out("done", [])
end sub

sub out(name as string, values as object)
    line = "PROBE|" + name
    for each v in values
        line = line + "|" + v
    end for
    print line
end sub

' Three elements at indexes 0..2 (10, 20, 30; XML elements named i0..i2).
function make(kind as string) as object
    if kind = "ba"
        c = CreateObject("roByteArray")
        c.FromHexString("0A141E")
    else if kind = "arr"
        c = CreateObject("roArray", 3, true)
        c.Push(10)
        c.Push(20)
        c.Push(30)
    else if kind = "list"
        c = CreateObject("roList")
        c.AddTail(10)
        c.AddTail(20)
        c.AddTail(30)
    else
        xml = CreateObject("roXMLElement")
        xml.Parse("<r><i0/><i1/><i2/></r>")
        c = xml.GetChildElements()
    end if
    return c
end function

function desc(v as dynamic) as string
    t = type(v)
    if t = "<uninitialized>" or t = "Invalid" or t = "roInvalid" or t = "Function" or t = "roFunction"
        return t
    else if t = "roXMLElement"
        return t + ":" + v.GetName()
    end if
    return t + ":" + v.ToStr()
end function

sub reads(kind as string)
    readCase(kind, "int-1", 1)
    readCase(kind, "float-1.9", 1.9!)
    readCase(kind, "double-1.9", 1.9#)
    readCase(kind, "long-1", 1&)
    readCase(kind, "boxInt-1", Box(1))
    readCase(kind, "boxFloat-1.9", Box(1.9!))
    readCase(kind, "boxDouble-1.9", Box(1.9#))
    readCase(kind, "boxLong-1", Box(1&))
    readCase(kind, "int-neg1", -1)
    readCase(kind, "float-neg0.5", -0.5!)
    readCase(kind, "float-neg1.5", -1.5!)
    readCase(kind, "int-3", 3)
    readCase(kind, "double-big", 4294967297#)
end sub

sub readCase(kind as string, name as string, i as dynamic)
    c = make(kind)
    try
        idx = desc(c[i])
    catch e
        idx = "ERR:" + e.number.ToStr()
    end try
    try
        entry = desc(c.GetEntry(i))
    catch e
        entry = "ERR:" + e.number.ToStr()
    end try
    out("read|" + kind + "|" + name, ["idx=" + idx, "entry=" + entry])
end sub

sub writes(kind as string)
    writeCase(kind, "int-1", 1)
    writeCase(kind, "float-1.9", 1.9!)
    writeCase(kind, "double-1.9", 1.9#)
    writeCase(kind, "long-1", 1&)
    writeCase(kind, "boxLong-1", Box(1&))
end sub

' Writes 99 at index i (by c[i] = and by SetEntry), then reads every slot back by integer index.
sub writeCase(kind as string, name as string, i as dynamic)
    if kind = "xml"
        value = make("xml")[0]
    else
        value = 99
    end if
    for each how in ["idx", "entry"]
        c = make(kind)
        try
            if how = "idx"
                c[i] = value
            else
                c.SetEntry(i, value)
            end if
            res = "count=" + c.Count().ToStr()
            for n = 0 to c.Count() - 1
                res = res + "," + desc(c[n])
            end for
        catch e
            res = "ERR:" + e.number.ToStr()
        end try
        out("write|" + kind + "|" + name + "|" + how, [res])
    end for
end sub

' What an element read from a roByteArray reports, and whether it is a copy.
sub entryType()
    ba = make("ba")
    v = ba[0]
    out("entryType", ["type=" + type(v), "type3=" + type(v, 3), "entry=" + type(ba.GetEntry(0))])
    v = v + 1
    out("entryCopy", ["v=" + v.ToStr(), "ba0=" + ba[0].ToStr()])
end sub
