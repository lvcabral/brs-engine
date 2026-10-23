' Built-in methods with Integer parameters (Slice, GetSignedByte, GetSignedLong, GetCRC32, SetResize, Delete,
' GetRawExifTag) and indexed writes, called with Integer, Float, Double, LongInteger, boxed, NaN, infinite,
' out-of-range, negative, non-numeric and uninitialized arguments. Expected output is the device trace in
' test/simulator/probes/numeric-args-probe/device-trace.txt, plus the engine-only largeWrites section.
sub main()
    out("start", [])
    slices()
    signedBytes()
    signedLongs()
    crcs()
    resizes()
    deletes()
    writeExifImage()
    exifTags()
    nanArgs()
    negativeWrites()
    fixedSizeWrites()
    uninitializedArgs()
    largeWrites()
    out("done", [])
end sub

sub out(name as string, values as object)
    line = "PROBE|" + name
    for each v in values
        line = line + "|" + v
    end for
    print line
end sub

function errText(e as object) as string
    return "ERR:" + e.number.ToStr()
end function

function arrText(a as object) as string
    if type(a) = "roByteArray"
        return "ba:" + a.ToHexString()
    end if
    res = "arr:"
    for each v in a
        res = res + v.ToStr() + ","
    end for
    return res
end function

function makeArr() as object
    return [10, 20, 30, 40]
end function

function makeBa() as object
    ba = CreateObject("roByteArray")
    ba.FromHexString("0A141E28")
    return ba
end function

' Slice(start) and Slice(start, end) on roArray and roByteArray.
sub slices()
    slice1("int-1", 1)
    slice1("float-1.9", 1.9!)
    slice1("double-1.9", 1.9#)
    slice1("long-1", 1&)
    slice1("boxLong-1", Box(1&))
    slice1("long-big", 4294967297&)
    slice1("double-big", 4294967297#)
    slice1("int-neg1", -1)
    slice1("float-neg0.5", -0.5!)
    slice1("int-9", 9)
    slice1("string-1", "1")
    slice1("invalid", invalid)
    slice1("bool", true)
    slice2("int-1-3", 1, 3)
    slice2("float-1.9-3.9", 1.9!, 3.9!)
    slice2("double-1.9-3.9", 1.9#, 3.9#)
    slice2("long-1-3", 1&, 3&)
    slice2("long-big", 4294967297&, 4294967299&)
    slice2("int-1-neg1", 1, -1)
    slice2("int-neg3-neg1", -3, -1)
    slice2("int-3-1", 3, 1)
    slice2("int-1-invalid", 1, invalid)
    slice2("int-1-string", 1, "3")
end sub

sub slice1(name as string, s as dynamic)
    for each kind in ["arr", "ba"]
        if kind = "arr" then c = makeArr() else c = makeBa()
        try
            res = arrText(c.Slice(s))
        catch e
            res = errText(e)
        end try
        out("slice1|" + kind + "|" + name, [res])
    end for
end sub

sub slice2(name as string, s as dynamic, e2 as dynamic)
    for each kind in ["arr", "ba"]
        if kind = "arr" then c = makeArr() else c = makeBa()
        try
            res = arrText(c.Slice(s, e2))
        catch e
            res = errText(e)
        end try
        out("slice2|" + kind + "|" + name, [res])
    end for
end sub

' GetSignedByte(index) on FF 7F 80 01.
sub signedBytes()
    signedByte("int-0", 0)
    signedByte("float-2.9", 2.9!)
    signedByte("double-2.9", 2.9#)
    signedByte("long-2", 2&)
    signedByte("boxLong-2", Box(2&))
    signedByte("long-big", 4294967298&)
    signedByte("int-neg1", -1)
    signedByte("float-neg0.5", -0.5!)
    signedByte("int-4", 4)
    signedByte("string-1", "1")
    signedByte("invalid", invalid)
end sub

sub signedByte(name as string, i as dynamic)
    ba = CreateObject("roByteArray")
    ba.FromHexString("FF7F8001")
    try
        res = ba.GetSignedByte(i).ToStr()
    catch e
        res = errText(e)
    end try
    out("signedByte|" + name, [res])
end sub

' GetSignedLong(index) on 8 bytes: FFFFFFFF 01000000.
sub signedLongs()
    signedLong("int-0", 0)
    signedLong("int-1", 1)
    signedLong("float-1.9", 1.9!)
    signedLong("double-1.9", 1.9#)
    signedLong("long-1", 1&)
    signedLong("long-big", 4294967297&)
    signedLong("int-neg1", -1)
    signedLong("float-neg0.5", -0.5!)
    signedLong("int-2", 2)
    signedLong("string-1", "1")
end sub

sub signedLong(name as string, i as dynamic)
    ba = CreateObject("roByteArray")
    ba.FromHexString("FFFFFFFF01000000")
    try
        res = ba.GetSignedLong(i).ToStr()
    catch e
        res = errText(e)
    end try
    out("signedLong|" + name, [res])
end sub

' GetCRC32([index[, length]]) on "0123456789".
sub crcs()
    ba = CreateObject("roByteArray")
    ba.FromAsciiString("0123456789")
    out("crc|none", [ba.GetCRC32().ToStr()])
    crc1("int-1", 1)
    crc1("float-1.9", 1.9!)
    crc1("long-1", 1&)
    crc1("long-big", 4294967297&)
    crc1("int-neg1", -1)
    crc1("string-1", "1")
    crc2("int-1-3", 1, 3)
    crc2("float-1.9-3.9", 1.9!, 3.9!)
    crc2("double-1.9-3.9", 1.9#, 3.9#)
    crc2("long-1-3", 1&, 3&)
    crc2("long-big", 4294967297&, 4294967299&)
    crc2("int-0-0", 0, 0)
    crc2("int-0-neg1", 0, -1)
    crc2("int-neg1-3", -1, 3)
    crc2("int-8-5", 8, 5)
    crc2("int-1-invalid", 1, invalid)
end sub

sub crc1(name as string, i as dynamic)
    ba = CreateObject("roByteArray")
    ba.FromAsciiString("0123456789")
    try
        res = ba.GetCRC32(i).ToStr()
    catch e
        res = errText(e)
    end try
    out("crc1|" + name, [res])
end sub

sub crc2(name as string, i as dynamic, n as dynamic)
    ba = CreateObject("roByteArray")
    ba.FromAsciiString("0123456789")
    try
        res = ba.GetCRC32(i, n).ToStr()
    catch e
        res = errText(e)
    end try
    out("crc2|" + name, [res])
end sub

' SetResize(minSize, autoResize), then Capacity() and IsResizable().
sub resizes()
    resize("int-10", 10)
    resize("float-10.9", 10.9!)
    resize("double-10.9", 10.9#)
    resize("long-10", 10&)
    resize("boxLong-10", Box(10&))
    resize("long-big", 4294967306&)
    resize("int-neg5", -5)
    resize("string-10", "10")
    resize("invalid", invalid)
end sub

sub resize(name as string, n as dynamic)
    ba = makeBa()
    try
        ba.SetResize(n, false)
        res = "cap=" + ba.Capacity().ToStr() + ",resizable=" + ba.IsResizable().ToStr()
    catch e
        res = errText(e)
    end try
    out("resize|" + name, [res])
end sub

' Delete(index) on roByteArray, with roArray alongside for comparison.
sub deletes()
    deleteCase("int-1", 1)
    deleteCase("float-1.9", 1.9!)
    deleteCase("double-1.9", 1.9#)
    deleteCase("long-1", 1&)
    deleteCase("boxLong-1", Box(1&))
    deleteCase("long-big", 4294967297&)
    deleteCase("int-neg1", -1)
    deleteCase("float-neg0.5", -0.5!)
    deleteCase("int-4", 4)
    deleteCase("string-1", "1")
    deleteCase("invalid", invalid)
end sub

sub deleteCase(name as string, i as dynamic)
    for each kind in ["arr", "ba"]
        if kind = "arr" then c = makeArr() else c = makeBa()
        try
            ok = c.Delete(i)
            res = "ret=" + ok.ToStr() + "," + arrText(c)
        catch e
            res = errText(e)
        end try
        out("delete|" + kind + "|" + name, [res])
    end for
end sub

' GetRawExifTag(ifd, tagnum) on a JPEG with Make (IFD 0, &h010F), DateTimeOriginal (EXIF, &h9003) and
' GPSLatitudeRef (GPS, 1).
sub exifTags()
    exifTag("int-0-make", 0, &h010F)
    exifTag("float-0.9-make", 0.9!, &h010F)
    exifTag("double-0-make", 0#, &h010F)
    exifTag("long-0-make", 0&, &h010F)
    exifTag("boxLong-0-make", Box(0&), Box(&h010F))
    exifTag("int-0-float-make", 0, 271.9!)
    exifTag("int-0-long-make", 0, 271&)
    exifTag("long-big-make", 4294967296&, 4294967567&)
    exifTag("int-2-date", 2, &h9003)
    exifTag("float-2.5-date", 2.5!, &h9003)
    exifTag("int-3-gps", 3, 1)
    exifTag("float-3.9-gps", 3.9!, 1.9!)
    exifTag("long-3-gps", 3&, 1&)
    exifTag("int-neg1-make", -1, &h010F)
    exifTag("int-5-make", 5, &h010F)
    exifTag("int-0-missing", 0, &h9999)
    exifTag("string-0-make", "0", &h010F)
    exifTag("int-0-string", 0, "271")
    exifTag("invalid-make", invalid, &h010F)
    meta = CreateObject("roImageMetadata")
    meta.SetUrl("tmp:/exif.jpg")
    make = meta.GetRawExif().image.Make
    out("exif|raw-make", ["tag=" + type(make.tag) + ":" + make.tag.ToStr(), "value=" + type(make.value) + ":" + make.value])
end sub

sub exifTag(name as string, ifd as dynamic, tag as dynamic)
    meta = CreateObject("roImageMetadata")
    meta.SetUrl("tmp:/exif.jpg")
    try
        r = meta.GetRawExifTag(ifd, tag)
        if r = invalid
            res = "invalid"
        else if type(r) = "roAssociativeArray"
            res = "aa:"
            for each k in r
                v = r[k]
                res = res + k + "=" + type(v)
                if GetInterface(v, "ifToStr") <> invalid then res = res + ":" + v.ToStr()
                res = res + ","
            end for
        else
            res = type(r)
        end if
    catch e
        res = errText(e)
    end try
    out("exif|" + name, [res])
end sub

function countText(c as object) as string
    return "count=" + c.Count().ToStr() + "," + arrText(c)
end function

' NaN and infinite arguments and indexes (0! / 0! is a divide-by-zero error on the device).
sub nanArgs()
    nan = Sqr(-1!)
    inf = 1e38 * 1e38
    for each name in ["ba-read", "arr-read", "ba-write", "arr-write", "ba-delete", "arr-delete", "ba-resize", "ba-slice", "arr-slice", "ba-slice-end", "ba-signedByte", "ba-crc", "arr-getEntry"]
        nanCase(name, "nan", nan)
    end for
    ' A write at an infinite index makes the device kill the app (out of memory), so only calls that do not write.
    for each name in ["ba-read", "arr-read", "ba-delete", "arr-delete", "ba-slice", "arr-slice", "ba-slice-end", "ba-signedByte", "ba-crc", "arr-getEntry"]
        nanCase(name, "inf", inf)
        nanCase(name, "-inf", -inf)
    end for
end sub

sub nanCase(name as string, label as string, v as dynamic)
    try
        if name = "ba-read"
            res = optText(makeBa()[v])
        else if name = "arr-read"
            res = optText(makeArr()[v])
        else if name = "ba-write"
            c = makeBa()
            c[v] = 99
            res = countText(c)
        else if name = "arr-write"
            c = makeArr()
            c[v] = 99
            res = countText(c)
        else if name = "ba-delete"
            c = makeBa()
            res = "ret=" + c.Delete(v).ToStr() + "," + countText(c)
        else if name = "arr-delete"
            c = makeArr()
            res = "ret=" + c.Delete(v).ToStr() + "," + countText(c)
        else if name = "ba-resize"
            c = makeBa()
            c.SetResize(v, false)
            c.Push(1)
            res = "cap=" + c.Capacity().ToStr() + "," + countText(c)
        else if name = "ba-slice"
            res = arrText(makeBa().Slice(v))
        else if name = "arr-slice"
            res = arrText(makeArr().Slice(v))
        else if name = "ba-slice-end"
            res = arrText(makeBa().Slice(1, v))
        else if name = "ba-signedByte"
            res = makeBa().GetSignedByte(v).ToStr()
        else if name = "ba-crc"
            res = makeBa().GetCRC32(v, 2).ToStr()
        else
            res = optText(makeArr().GetEntry(v))
        end if
    catch e
        res = errText(e)
    end try
    out("nan|" + name + "|" + label, [res])
end sub

function optText(r as dynamic) as string
    if r = invalid then return "invalid"
    return r.ToStr()
end function

' Writes at a negative index (and a LongInteger whose low 32 bits are -1), then reads back.
sub negativeWrites()
    for each kind in ["arr", "list", "ba"]
        for each how in ["idx", "entry", "long"]
            if kind = "arr"
                c = makeArr()
            else if kind = "ba"
                c = makeBa()
            else
                c = CreateObject("roList")
                c.AddTail(10)
                c.AddTail(20)
            end if
            try
                if how = "idx"
                    c[-1] = 5
                else if how = "entry"
                    c.SetEntry(-1, 5)
                else
                    c[&hFFFFFFFF&] = 5
                end if
                r = c[-1]
                if r = invalid then rt = "invalid" else rt = r.ToStr()
                res = "read=" + rt + "," + countText(c)
            catch e
                res = errText(e)
            end try
            out("negWrite|" + kind + "|" + how, [res])
        end for
    end for
end sub

' Writes past the end of a non-resizable roByteArray and roArray.
sub fixedSizeWrites()
    for each how in ["idx", "entry", "inBounds"]
        ba = makeBa()
        ba.SetResize(4, false)
        a = CreateObject("roArray", 4, false)
        for n = 1 to 4
            a.Push(n)
        end for
        try
            if how = "idx"
                ba[6] = 7
                a[6] = 7
            else if how = "entry"
                ba.SetEntry(6, 7)
                a.SetEntry(6, 7)
            else
                ba[1] = 7
                a[1] = 7
            end if
            res = countText(ba) + "|" + countText(a) + "|cap=" + ba.Capacity().ToStr() + "," + a.Capacity().ToStr()
        catch e
            res = errText(e)
        end try
        out("fixedWrite|" + how, [res])
    end for
end sub

' Passing a variable that was never assigned as an optional argument.
sub uninitializedArgs()
    try
        r = arrText(makeArr().Slice(1, notAssigned))
    catch e
        r = errText(e)
    end try
    out("uninit|arr-slice-end", [r])
    try
        r = arrText(makeBa().Slice(notAssigned2))
    catch e
        r = errText(e)
    end try
    out("uninit|ba-slice-start", [r])
    try
        r = makeBa().GetCRC32(notAssigned3).ToStr()
    catch e
        r = errText(e)
    end try
    out("uninit|ba-crc-one", [r])
    try
        r = makeBa().GetCRC32(0, notAssigned4).ToStr()
    catch e
        r = errText(e)
    end try
    out("uninit|ba-crc-length", [r])
    try
        r = makeBa().GetSignedByte(notAssigned5).ToStr()
    catch e
        r = errText(e)
    end try
    out("uninit|ba-signedByte", [r])
end sub

' Engine only: a write at an index past the 32-bit range (also an infinite one) makes a device kill the app for
' running out of memory; the engine raises Out Of Memory (12) instead.
sub largeWrites()
    largeWrite("arr-double-big", 4294967297#)
    largeWrite("ba-double-big", 4294967297#)
    largeWrite("ba-inf", 1e38 * 1e38)
    largeWrite("arr-entry-double-big", 4294967297#)
end sub

sub largeWrite(name as string, i as dynamic)
    if Left(name, 3) = "arr" then c = makeArr() else c = makeBa()
    try
        if name = "arr-entry-double-big" then c.SetEntry(i, 7) else c[i] = 7
        res = countText(c)
    catch e
        res = errText(e)
    end try
    out("large|" + name, [res])
end sub

' The probe's images/exif.jpg, written to tmp:/ so the fixture needs no pkg:/ files.
sub writeExifImage()
    hex = ""
    hex = hex + "FFD8FFE000104A46494600010100000100010000FFE101044578696600004D4D002A000000080006010F00020000000A"
    hex = hex + "00000056011000020000000B00000060011200030000000100010000013100020000000E0000006C8769000400000001"
    hex = hex + "0000007A8825000400000001000000BA0000000050726F62654D616B650050726F62654D6F64656C000050726F626553"
    hex = hex + "6F667477617265000002900300020000001400000098928600010000000D000000AC00000000323032363A31303A3232"
    hex = hex + "2031323A30303A303000415343494900000070726F626500000300000001000000040202000000010002000000024E00"
    hex = hex + "00000002000500000003000000E40000000000000025000000010000002E000000010000001E00000001FFDB00430008"
    hex = hex + "0606070605080707070909080A0C140D0C0B0B0C1912130F141D1A1F1E1D1A1C1C20242E2720222C231C1C2837292C30"
    hex = hex + "313434341F27393D38323C2E333432FFDB0043010909090C0B0C180D0D1832211C213232323232323232323232323232"
    hex = hex + "323232323232323232323232323232323232323232323232323232323232323232323232FFC000110800300040030122"
    hex = hex + "00021101031101FFC4001F0000010501010101010100000000000000000102030405060708090A0BFFC400B510000201"
    hex = hex + "0303020403050504040000017D01020300041105122131410613516107227114328191A1082342B1C11552D1F0243362"
    hex = hex + "7282090A161718191A25262728292A3435363738393A434445464748494A535455565758595A636465666768696A7374"
    hex = hex + "75767778797A838485868788898A92939495969798999AA2A3A4A5A6A7A8A9AAB2B3B4B5B6B7B8B9BAC2C3C4C5C6C7C8"
    hex = hex + "C9CAD2D3D4D5D6D7D8D9DAE1E2E3E4E5E6E7E8E9EAF1F2F3F4F5F6F7F8F9FAFFC4001F01000301010101010101010100"
    hex = hex + "00000000000102030405060708090A0BFFC400B511000201020404030407050404000102770001020311040521310612"
    hex = hex + "41510761711322328108144291A1B1C109233352F0156272D10A162434E125F11718191A262728292A35363738393A43"
    hex = hex + "4445464748494A535455565758595A636465666768696A737475767778797A82838485868788898A9293949596979899"
    hex = hex + "9AA2A3A4A5A6A7A8A9AAB2B3B4B5B6B7B8B9BAC2C3C4C5C6C7C8C9CAD2D3D4D5D6D7D8D9DAE2E3E4E5E6E7E8E9EAF2F3"
    hex = hex + "F4F5F6F7F8F9FAFFDA000C03010002110311003F00CEA28A2BE6CFB80A28A2800A28A2800A28A2800A28A2800A28A280"
    hex = hex + "0A28A2800A28A2800A28A2800A28A2800A28A2800A28A2803FFFD9"
    ba = CreateObject("roByteArray")
    ba.FromHexString(hex)
    ba.WriteFile("tmp:/exif.jpg")
end sub
