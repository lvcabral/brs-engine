' type() of values stored in, read from and copied between containers, as reported by a Roku device
' (Streaming Stick, OS 15.3.4). Device trace: test/simulator/probes/type-legacy-probe/device-trace.txt
sub main()
    sharedSingletons()
    builtArrays()
    lists()
    xmlLists()
    storePaths()
end sub

sub out(name as string, values as object)
    line = name
    for each v in values
        line = line + "|" + v
    end for
    print line
end sub

function t2(v as dynamic) as object
    return [type(v), type(v, 3)]
end function

sub sharedSingletons()
    x = invalid
    out("inv-before", [type(invalid), type(x)])
    a = [invalid]
    out("inv-after-arr", [type(invalid), type(x), type(a[0])])
    b = { k: invalid }
    out("inv-after-aa", [type(invalid), type(x), type(b.k)])
    y = invalid
    out("inv-fresh-var", [type(y), type(y, 3)])

    c = (1 = 1)
    out("bool-expr-before", [type(c), type(1 = 1), type(true)])
    d = [c]
    e = { k: c }
    out("bool-expr-after", [type(c), type(1 = 1), type(true), type(d[0]), type(e.k)])
    f = true
    out("bool-lit-var", [type(f), type(f, 3)])
end sub

sub builtArrays()
    j = ParseJson("[5, 1.5, ""s""]")
    s = j.Slice()
    out("json-arr", [type(j[0]), type(j[1]), type(j[2])])
    out("json-slice", [type(s[0]), type(s[1]), type(s[2])])
    l = [5, 1.5, "s"]
    ls = l.Slice()
    out("lit-arr", [type(l[0]), type(l[1]), type(l[2])])
    out("lit-slice", [type(ls[0]), type(ls[1]), type(ls[2])])

    ja = ParseJson("{""a"":5}")
    items = ja.Items()
    out("json-aa", t2(ja.a))
    out("json-aa-items", t2(items[0].value))
    la = { a: 5 }
    litems = la.Items()
    out("lit-aa", t2(la.a))
    out("lit-aa-items", t2(litems[0].value))

    sp = "a,b".Split(",")
    out("split", t2(sp[0]))
    tk = "a b".Tokenize(" ")
    out("tokenize", t2(tk[0]))
    ks = la.Keys()
    out("aa-keys", t2(ks[0]))

    ap = []
    for i = 0 to 1
        ap.Push(i * 2)
    end for
    out("push-expr", t2(ap[1]))
    ac = [1, 2]
    ac.Append([3])
    out("append-lit", t2(ac[2]))
    ac.Append(ParseJson("[4]"))
    out("append-json", t2(ac[3]))
end sub

sub lists()
    l = CreateObject("roList")
    v = 5
    l.AddTail(v)
    l.AddHead("h")
    out("list-tail", [type(l[1]), type(l[1], 3), type(v)])
    out("list-head", [type(l[0]), type(l[0], 3), type(l.GetHead())])
    l[0] = 7
    out("list-set", t2(l[0]))
end sub

sub xmlLists()
    xml = CreateObject("roXMLElement")
    xml.Parse("<r><a/><b/></r>")
    lst = xml.GetChildElements()
    z = CreateObject("roXMLElement")
    z.SetName("z")
    lst.AddHead(z)
    out("xml-addhead", [lst.GetHead().GetName(), lst.GetTail().GetName(), lst.Count().ToStr()])
    y = CreateObject("roXMLElement")
    y.SetName("y")
    lst.AddTail(y)
    out("xml-addtail", [lst.GetHead().GetName(), lst.GetTail().GetName(), lst.Count().ToStr()])
    try
        lst[0] = 5
        out("xml-set", t2(lst[0]))
    catch e
        out("xml-set", ["error", e.message])
    end try
    try
        lst.Push(6)
        out("xml-push", t2(lst.GetTail()))
    catch e
        out("xml-push", ["error", e.message])
    end try
end sub

sub storePaths()
    i = 3
    j = ParseJson("{""n"":5,""b"":true,""z"":null}")
    aa = {}
    aa.n = i * 2
    aa["m"] = i * 2
    aa.AddReplace("k", i * 2)
    out("aa-set-expr", [type(aa.n), type(aa.m), type(aa.k), type(aa.n, 3)])
    aa.lit = 7
    out("aa-set-lit", t2(aa.lit))
    aa.jn = j.n
    out("aa-set-json", t2(aa.jn))
    arr = [0, 0, 0]
    arr[0] = i * 2
    arr[1] = 7
    arr[2] = j.n
    out("arr-set-num", [type(arr[0]), type(arr[1]), type(arr[2]), type(arr[0], 3)])
    arr.Push(j.n)
    arr.Unshift(i * 2)
    out("arr-push-json", t2(arr[4]))
    out("arr-unshift-expr", t2(arr[0]))
    l = CreateObject("roList")
    l.AddTail(i * 2)
    l.AddHead(7)
    out("list-add", [type(l[1]), type(l[0]), type(l[1], 3)])
    l[1] = i * 2
    out("list-set-expr", t2(l[1]))

    out("bool-lit-in", [type([true][0]), type({ b: true }.b), type([false][0])])
    bb = (i = 3)
    b1 = []
    b1.Push(bb)
    b2 = {}
    b2.b = bb
    b3 = [false]
    b3[0] = bb
    out("bool-store", [type(b1[0]), type(b2.b), type(b3[0]), type(b1[0], 3)])
    out("bool-json", [type(j.b), type(ParseJson("[true]")[0])])

    n1 = []
    n1.Push(invalid)
    n2 = {}
    n2.z = invalid
    n3 = [1]
    n3[0] = invalid
    n4 = CreateObject("roList")
    n4.AddTail(invalid)
    out("inv-store", [type(n1[0]), type(n2.z), type(n3[0]), type(n4[0]), type(n1[0], 3)])
    out("inv-json", [type(j.z), type(ParseJson("[null]")[0])])
    out("inv-after-all", [type(invalid), type(j.z)])

    rx = CreateObject("roRegex", ",", "")
    out("regex-split", t2(rx.Split("a,b")[0]))
    bs = box("a,b")
    out("box-split", t2(bs.Split(",")[0]))
    out("aa-keys-json", t2(j.Keys()[0]))
end sub
