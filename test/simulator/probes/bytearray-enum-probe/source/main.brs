' ByteArray Enum Probe: what for each and ifEnum (IsNext/Next/Reset/IsEmpty) return on roByteArray,
' with roArray as a baseline. Output: PROBE|<case>|<values...>
sub main()
    ' Gives time to reconnect to the debug console, which drops its clients when an app launches.
    sleep(5000)
    out("start", [])
    for each kind in ["ba", "arr"]
        forEachCases(kind)
        enumCases(kind)
        mutationCases(kind)
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

function make(kind as string, hex as string) as object
    if kind = "ba"
        c = CreateObject("roByteArray")
        c.FromHexString(hex)
    else
        c = CreateObject("roArray", 4, true)
        for i = 0 to Len(hex) - 1 step 2
            c.Push(Val(Mid(hex, i + 1, 2), 16))
        end for
    end if
    return c
end function

function show(v as dynamic) as string
    if v = invalid then return "invalid:" + type(v)
    return type(v) + ":" + v.toStr()
end function

function walk(c as object) as string
    s = ""
    for each b in c
        s = s + show(b) + ","
    end for
    return s
end function

sub forEachCases(kind as string)
    out(kind + ".each4", [walk(make(kind, "01020304"))])
    out(kind + ".each1", [walk(make(kind, "FF"))])
    out(kind + ".each0", [walk(make(kind, ""))])
    out(kind + ".eachHigh", [walk(make(kind, "007F80FE"))])

    c = make(kind, "0A141E")
    out(kind + ".eachTwice", [walk(c), walk(c)])

    ' Nested loops over the same object share one enumeration position.
    s = ""
    for each a in c
        for each b in c
            s = s + a.toStr() + "/" + b.toStr() + ","
        end for
    end for
    out(kind + ".nested", [s])

    s = ""
    for each b in c
        s = s + b.toStr() + ","
        if b = 20 then exit for
    end for
    out(kind + ".exitFor", [s, walk(c)])

    ' Does for each restart after a manual Next()?
    c.Reset()
    c.Next()
    out(kind + ".eachAfterNext", [walk(c)])
end sub

sub enumCases(kind as string)
    c = make(kind, "0A14")
    out(kind + ".fresh", [c.IsEmpty().toStr(), c.IsNext().toStr()])
    out(kind + ".next1", [show(c.Next()), c.IsNext().toStr()])
    out(kind + ".next2", [show(c.Next()), c.IsNext().toStr()])
    out(kind + ".nextPastEnd", [show(c.Next()), c.IsNext().toStr()])
    out(kind + ".nextPastEnd2", [show(c.Next()), c.IsNext().toStr()])
    c.Reset()
    out(kind + ".afterReset", [c.IsNext().toStr(), show(c.Next())])

    e = make(kind, "")
    out(kind + ".empty", [e.IsEmpty().toStr(), e.IsNext().toStr(), show(e.Next()), e.IsNext().toStr()])
    e.Reset()
    out(kind + ".emptyReset", [e.IsNext().toStr(), show(e.Next())])

    ' Elements added after enumeration ended or before it started.
    e.Push(7)
    out(kind + ".pushAfterEmpty", [e.IsNext().toStr(), show(e.Next())])
    e.Reset()
    out(kind + ".pushThenReset", [e.IsNext().toStr(), show(e.Next()), e.IsNext().toStr()])
end sub

sub mutationCases(kind as string)
    c = make(kind, "0102")
    s = ""
    n = 0
    for each b in c
        s = s + b.toStr() + ","
        n = n + 1
        if n < 4 then c.Push(9)
    end for
    out(kind + ".pushDuring", [s, c.Count().toStr()])

    c = make(kind, "010203")
    s = ""
    for each b in c
        s = s + b.toStr() + ","
        if b = 1 then c.Pop()
    end for
    out(kind + ".popDuring", [s, c.Count().toStr()])

    c = make(kind, "010203")
    s = ""
    for each b in c
        s = s + b.toStr() + ","
        c[2] = 99
    end for
    out(kind + ".setDuring", [s])

    ' The loop variable is a copy; changing it does not change the array.
    c = make(kind, "0102")
    for each b in c
        b = b + 100
    end for
    out(kind + ".loopVarCopy", [walk(c)])
end sub
