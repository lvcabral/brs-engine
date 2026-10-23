' Numeric Args Probe: how built-in methods with numeric parameters treat Integer, Float, Double, LongInteger,
' boxed, out-of-range, negative and non-numeric arguments. Output: PROBE|<case>|<values...>
sub main()
    ' Gives time to reconnect to the debug console, which drops its clients when an app launches.
    sleep(5000)
    out("start", [])
    slices()
    signedBytes()
    signedLongs()
    crcs()
    resizes()
    deletes()
    exifTags()
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
    meta.SetUrl("pkg:/images/exif.jpg")
    make = meta.GetRawExif().image.Make
    out("exif|raw-make", ["tag=" + type(make.tag) + ":" + make.tag.ToStr(), "value=" + type(make.value) + ":" + make.value])
end sub

sub exifTag(name as string, ifd as dynamic, tag as dynamic)
    meta = CreateObject("roImageMetadata")
    meta.SetUrl("pkg:/images/exif.jpg")
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
