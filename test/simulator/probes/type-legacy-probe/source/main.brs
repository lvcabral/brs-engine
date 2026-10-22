' Type Legacy Probe: what type() / type(x, 3) report for primitives stored in, read from, and copied
' between containers. Output: PROBE|<case>|<values...>
sub main()
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    screen.CreateScene("ProbeScene")
    screen.show()

    out("start", [])
    baseline()
    sharedSingletons()
    builtArrays()
    sharedAcrossContainers()
    lists()
    xmlLists()
    nodes()
    storePaths()
    out("done", [])
end sub

sub out(name as string, values as object)
    line = "PROBE|" + name
    for each v in values
        line = line + "|" + v
    end for
    print line
end sub

' Both type() forms of a value
function t2(v as dynamic) as object
    return [type(v), type(v, 3)]
end function

' --- The cases already pinned by test/e2e/resources/stdlib/type-legacy.brs -------------------------
sub baseline()
    varInt = 1
    out("int-var", t2(varInt))
    arrInt = [1][0]
    out("int-arr", t2(arrInt))
    out("float-arr", t2([.1][0]))
    out("double-arr", t2([1#][0]))
    out("long-arr", t2([1&][0]))
    out("string-arr", t2([""][0]))
    out("invalid-arr", t2([invalid][0]))
    out("bool-arr", t2([true][0]))

    rs = CreateObject("roRegistrySection", "Transient")
    rs.write("option1", "test")
    value1 = rs.read("option1")
    out("registry", t2(value1))
    aa = {}
    aa.option1 = value1
    out("aa-reg", t2(aa.option1))
    value2 = "test"
    out("value", t2(value2))
    aa.option2 = value2
    out("aa-val", t2(aa.option2))
    aa.option3 = box("test")
    out("aa-box", t2(aa.option3))
    arrPush = []
    arrPush.push(value1)
    out("arr-reg", t2(arrPush[0]))
    arrLit = [ucase(value2)]
    out("arr-upper", t2(arrLit[0]))
    arrSet = [""]
    arrSet[0] = value1.left(1)
    out("arr-set", t2(arrSet[0]))

    num = 5
    numAA = { pocket: num }
    numArr = [num]
    out("var-after", [type(num), type(numAA.pocket), type(numArr[0])])
    json = ParseJson("{""p"":5}")
    p = Int(json.p)
    pAA = { pocket: p }
    out("json-after", [type(json.p), type(p), type(pAA.pocket)])
    str = "x"
    strAA = { s: str }
    strArr = [str]
    out("str-after", [type(str), type(strAA.s), type(strArr[0])])

    ' a value read back out of a container into a variable, then copied to another variable
    v = [5][0]
    w = v
    out("int-readback", [type(v), type(w), type(v, 3)])
    for each e in [5]
        out("int-foreach", t2(e))
    end for
    out("int-nested", t2([[5]][0][0]))
end sub

' --- invalid / true / false are shared instances in the engine ---------------------------------------
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

' --- arrays built by the runtime (not [...] literals) -------------------------------------------------
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

' --- one value object held by several containers, then one container copied to a node field ---------
sub sharedAcrossContainers()
    aa = { x: 5, f: 1.5, s: "s" }
    a = aa.x
    fa = aa.f
    sa = aa.s
    b = { y: a, g: fa, t: sa }
    c = [a, fa, sa]
    out("shared-before", [type(a), type(b.y), type(c[0]), type(b.g), type(c[1]), type(b.t), type(c[2])])

    node = CreateObject("roSGNode", "ContentNode")
    node.addField("faa", "assocarray", false)
    node.addField("farr", "array", false)
    node.faa = b
    out("shared-after-aa", [type(a), type(b.y), type(c[0]), type(b.g), type(c[1]), type(b.t), type(c[2])])
    out("shared-field-aa", [type(node.faa.y), type(node.faa.g), type(node.faa.t)])
    node.farr = c
    out("shared-after-arr", [type(a), type(b.y), type(c[0]), type(b.g), type(c[1]), type(b.t), type(c[2])])
    out("shared-field-arr", [type(node.farr[0]), type(node.farr[1]), type(node.farr[2])])
end sub

' --- roList ---------------------------------------------------------------------------------------------
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

' --- roXMLList ------------------------------------------------------------------------------------------
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

' --- node fields that hold arrays of strings ------------------------------------------------------------
sub nodes()
    bg = CreateObject("roSGNode", "ButtonGroup")
    bg.buttons = ["x", ucase("y")]
    out("bg-buttons", [type(bg.buttons[0]), type(bg.buttons[0], 3), type(bg.buttons[1]), type(bg.buttons[1], 3)])
    btn = CreateObject("roSGNode", "Button")
    btn.text = "z"
    bg.appendChild(btn)
    n = bg.buttons.Count()
    out("bg-child", [n.ToStr(), type(bg.buttons[n - 1]), type(bg.buttons[n - 1], 3)])
end sub

' --- each way of storing a value, for computed numbers, booleans and invalid --------------------------
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
