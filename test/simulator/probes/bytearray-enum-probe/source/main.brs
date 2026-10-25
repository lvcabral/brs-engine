' ByteArray Enum Probe: what for each and ifEnum (IsNext/Next/Reset/IsEmpty) return on roByteArray,
' with roArray as a baseline. Output: PROBE|<case>|<values...>
sub main()
    ' Gives time to reconnect to the debug console, which drops its clients when an app launches.
    sleep(5000)
    out("start", [])
    for each kind in ["ba", "arr", "list"]
        forEachCases(kind)
        enumCases(kind)
        mutationCases(kind)
        restartCases(kind)
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
        if kind = "list" then c = CreateObject("roList") else c = CreateObject("roArray", 4, true)
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

' Applies one mutation the first time the loop reads `trigger`, to see whether the enumeration restarts at
' index 0 or continues. Capped at 12 reads in case a restart repeats forever.
function mutateDuring(kind as string, hex as string, trigger as integer, op as string) as string
    c = make(kind, hex)
    s = ""
    n = 0
    done = false
    for each b in c
        s = s + b.toStr() + ","
        n = n + 1
        if n >= 12 then exit for
        if b = trigger and not done
            done = true
            applyOp(kind, c, op)
        end if
    end for
    return s + "|" + c.Count().toStr()
end function

sub applyOp(kind as string, c as object, op as string)
    if op = "pop"
        c.Pop()
    else if op = "shift"
        c.Shift()
    else if op = "delete0"
        c.Delete(0)
    else if op = "deleteLast"
        c.Delete(c.Count() - 1)
    else if op = "delete1"
        c.Delete(1)
    else if op = "delete2"
        c.Delete(2)
    else if op = "clear"
        c.Clear()
    else if op = "append"
        c.Append(make(kind, "0506"))
    else if op = "unshift"
        c.Unshift(9)
    else if op = "push"
        c.Push(9)
    else if op = "setEntry0"
        c[0] = 99
    else if op = "setResize"
        c.SetResize(10, true)
    else if op = "fromHex"
        c.FromHexString("0A0B0C0D")
    else if op = "fromAscii"
        c.FromAsciiString("AB")
    else if op = "fromBase64"
        c.FromBase64String("CgsM")
    else if op = "readFile"
        c.ReadFile("tmp:/probe.bin")
    end if
end sub

sub restartCases(kind as string)
    if kind = "ba"
        f = CreateObject("roByteArray")
        f.FromHexString("1E1F")
        f.WriteFile("tmp:/probe.bin")
    end if
    ops = ["pop", "shift", "delete0", "deleteLast", "clear", "append", "unshift", "push", "setEntry0"]
    if kind = "ba" then ops.Append(["setResize", "fromHex", "fromAscii", "fromBase64", "readFile"])
    for each op in ops
        ' Mutate on the second element, then on the first.
        out(kind + ".r2." + op, [mutateDuring(kind, "01020304", 2, op)])
        out(kind + ".r1." + op, [mutateDuring(kind, "01020304", 1, op)])
    end for
    ' Delete before, at and after the current position, mutating on the third element.
    for each op in ["delete1", "delete2", "deleteLast"]
        out(kind + ".r3." + op, [mutateDuring(kind, "01020304", 3, op)])
    end for

    ' Unshift after the enumeration ended.
    c = make(kind, "0102")
    walk(c)
    c.Unshift(9)
    out(kind + ".unshiftAfterEnd", [c.IsNext().toStr(), show(c.Next())])

    ' Unshift onto a new empty and a cleared object.
    c = make(kind, "")
    c.Unshift(9)
    out(kind + ".unshiftEmpty", [c.IsNext().toStr(), show(c.Next())])
    c = make(kind, "0102")
    c.Clear()
    c.Unshift(9)
    out(kind + ".unshiftCleared", [c.IsNext().toStr(), show(c.Next())])

    ' Delete, Pop and Shift after the enumeration ended.
    for each op in ["delete0", "pop", "shift"]
        c = make(kind, "010203")
        walk(c)
        applyOp(kind, c, op)
        out(kind + ".afterEnd." + op, [c.IsNext().toStr(), show(c.Next())])
    end for

    ' A zero element returned by Pop and Shift.
    c = make(kind, "000100")
    out(kind + ".zeroPopShift", [show(c.Pop()), show(c.Shift()), c.Count().toStr()])

    ' Pop during a manual IsNext/Next loop: is it the enumerator or for each?
    c = make(kind, "01020304")
    c.Reset()
    s = ""
    n = 0
    done = false
    while c.IsNext() and n < 12
        v = c.Next()
        s = s + v.toStr() + ","
        n = n + 1
        if v = 2 and not done
            done = true
            c.Pop()
        end if
    end while
    out(kind + ".manualPop", [s, c.Count().toStr()])

    ' Pop outside any loop after a partial Next(): where does Next() continue?
    c = make(kind, "01020304")
    c.Reset()
    c.Next()
    c.Next()
    c.Pop()
    out(kind + ".nextThenPop", [c.IsNext().toStr(), show(c.Next())])
end sub
