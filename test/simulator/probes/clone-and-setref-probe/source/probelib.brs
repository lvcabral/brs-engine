' GENERATED COPY of components/MainScene.brs (from `sub runCloneTests` onward) -- see README.md.
sub runGuarded(ctx as String)
    try
        runCloneTests(ctx)
    catch e
        print "  [" + ctx + "] runCloneTests ABORTED: " + e.message
    end try
    try
        runRefTests(ctx)
    catch e
        print "  [" + ctx + "] runRefTests ABORTED: " + e.message
    end try
end sub

sub runCloneTests(ctx as String)
    print "--- C1 [" + ctx + "]: clone() of a CUSTOM component ---"
    agent = CreateObject("roSGNode", "Agent")
    agent.id = "TheAgent"
    agent.callFunc("configure", "cfg-token")
    agent.addField("dyn", "string", false)
    agent.dyn = "dyn-value"
    agent.appendChild(CreateObject("roSGNode", "Rectangle"))

    cl = agent.clone(false)
    say("C1.1  orig subtype                ", agent.subtype())
    say("C1.2  clone subtype               ", subtypeOf(cl))
    say("C1.3  clone isSubtype('Agent')    ", isSubOf(cl, "Agent"))
    say("C1.4  orig hasField('marker') XML ", agent.hasField("marker"))
    say("C1.5  clone hasField('marker') XML", hasFieldOf(cl, "marker"))
    say("C1.6  clone marker value          ", fieldOf(cl, "marker"))
    say("C1.7  orig hasField('dyn') added  ", agent.hasField("dyn"))
    say("C1.8  clone hasField('dyn')       ", hasFieldOf(cl, "dyn"))
    say("C1.9  clone dyn value             ", fieldOf(cl, "dyn"))
    say("C1.10 clone id                    ", fieldOf(cl, "id"))
    say("C1.11 clone callFunc readToken    ", tokenOf(cl))
    say("C1.12 orig field count            ", agent.getFields().count())
    say("C1.13 clone field count           ", fieldCountOf(cl))
    print "        ^ if 1.5/1.11 differ between [main] and [render], clone is thread-sensitive"

    print "--- C2 [" + ctx + "]: clone() of a BUILT-IN node (control) ---"
    lbl = CreateObject("roSGNode", "Label")
    lbl.text = "hello"
    lbl.addField("dyn", "string", false)
    lbl.dyn = "lbl-dyn"
    lc = lbl.clone(false)
    say("C2.1  clone text (built-in field) ", fieldOf(lc, "text"))
    say("C2.2  clone hasField('text')      ", hasFieldOf(lc, "text"))
    say("C2.3  clone dyn (added field)     ", fieldOf(lc, "dyn"))
    print "        ^ 'hello'/'lbl-dyn' => clone keeps fields; only CUSTOM components lose them"

    print "--- C3 [" + ctx + "]: clone() of a ContentNode with addFields (control) ---"
    cn = CreateObject("roSGNode", "ContentNode")
    cn.addFields({ link: "http://example.com", aa: { name: "one" } })
    cc = cn.clone(true)
    say("C3.1  clone link                  ", fieldOf(cc, "link"))
    say("C3.2  clone aa.name               ", nestedNameOf(cc))
end sub

sub runRefTests(ctx as String)
    print "--- C4 [" + ctx + "]: setRef with NO external reference (inline literal) ---"
    print "        ^ spec: SetRef/GetRef/CanGetRef may ONLY be called on the render thread"
    n = CreateObject("roSGNode", "ContentNode")
    say("C4.1  addField assocarray         ", n.addField("f1", "assocarray", false))
    say("C4.2  setRef RETURN value         ", n.setRef("f1", { a: 1 }))
    print "        ^ false on [main] => the whole setRef family is render-thread only"
    say("C4.3  field type after setRef     ", typeOf(n.getField("f1")))
    say("C4.4  field value .a              ", memberOf(n.getField("f1"), "a"))
    say("C4.5  canGetRef immediately       ", n.canGetRef("f1"))
    say("C4.6  getRef type                 ", typeOf(n.getRef("f1")))
    say("C4.7  canGetRef after getRef      ", n.canGetRef("f1"))
    r = n.getRef("f1")
    if r <> invalid
        r.a = 99
        say("C4.8  mutate getRef -> field .a   ", memberOf(n.getField("f1"), "a"))
        print "        ^ 99 => getRef really is by reference"
    else
        say("C4.8  mutate getRef -> field .a   ", "n/a (getRef returned invalid)")
    end if

    print "--- C5 [" + ctx + "]: setRef WITH an external reference held ---"
    n2 = CreateObject("roSGNode", "ContentNode")
    n2.addField("f2", "assocarray", false)
    src = { a: 1 }
    say("C5.1  setRef RETURN, var alive    ", n2.setRef("f2", src))
    say("C5.2  canGetRef, source var alive ", n2.canGetRef("f2"))
    src = invalid
    say("C5.3  canGetRef, source dropped   ", n2.canGetRef("f2"))
    print "        ^ if 5.2 false and 5.3 true, canGetRef means 'no other reference exists'"

    print "--- C6 [" + ctx + "]: canGetRef in other states ---"
    n3 = CreateObject("roSGNode", "ContentNode")
    n3.addField("f3", "assocarray", false)
    say("C6.1  canGetRef before any set    ", n3.canGetRef("f3"))
    n3.f3 = { a: 1 }
    say("C6.2  canGetRef after NORMAL set  ", n3.canGetRef("f3"))
    say("C6.3  setRef RETURN over normal   ", n3.setRef("f3", { a: 2 }))
    say("C6.4  canGetRef after setRef      ", n3.canGetRef("f3"))
    n4 = CreateObject("roSGNode", "ContentNode")
    say("C6.5  setRef RETURN on non-AA fld ", n4.setRef("title", { a: 1 }))
    say("C6.6  canGetRef on non-AA field   ", n4.canGetRef("title"))

    print "--- C7 [" + ctx + "]: does clone() disturb canGetRef? (reproduces S10.6) ---"
    n5 = CreateObject("roSGNode", "ContentNode")
    n5.addField("f5", "assocarray", false)
    say("C7.1  setRef RETURN               ", n5.setRef("f5", { a: 1 }))
    say("C7.2  canGetRef before clone      ", n5.canGetRef("f5"))
    cl5 = n5.clone(true)
    say("C7.3  canGetRef after clone       ", n5.canGetRef("f5"))
    say("C7.4  clone canGetRef             ", canRefOf(cl5, "f5"))
end sub

' -------------------------------------- helpers ---------------------------------------------

sub say(label as String, value as Dynamic)
    print "  " + label + " = " + fmt(value)
end sub

function fmt(v as Dynamic) as String
    if v = invalid then return "invalid"
    t = type(v)
    if t = "Boolean" or t = "roBoolean"
        if v then return "true"
        return "false"
    end if
    if t = "String" or t = "roString" then return v
    if t = "Integer" or t = "roInt" or t = "roInteger" or t = "Float" or t = "roFloat" then return Str(v).Trim()
    return t
end function

function typeOf(v as Dynamic) as String
    if v = invalid then return "invalid"
    return type(v)
end function

function subtypeOf(n as Dynamic) as String
    if n = invalid then return "n/a"
    return n.subtype()
end function

function isSubOf(n as Dynamic, t as String) as String
    if n = invalid then return "n/a"
    return fmt(n.isSubtype(t))
end function

function hasFieldOf(n as Dynamic, f as String) as String
    if n = invalid then return "n/a"
    return fmt(n.hasField(f))
end function

function fieldOf(n as Dynamic, f as String) as String
    if n = invalid then return "n/a"
    return fmt(n.getField(f))
end function

function fieldCountOf(n as Dynamic) as String
    if n = invalid then return "n/a"
    return fmt(n.getFields().count())
end function

function tokenOf(n as Dynamic) as String
    if n = invalid then return "n/a"
    return fmt(n.callFunc("readToken"))
end function

function canRefOf(n as Dynamic, f as String) as String
    if n = invalid then return "n/a"
    return fmt(n.canGetRef(f))
end function

function memberOf(aa as Dynamic, key as String) as String
    if aa = invalid then return "invalid"
    if type(aa) <> "roAssociativeArray" then return type(aa)
    return fmt(aa[key])
end function

function nestedNameOf(n as Dynamic) as String
    if n = invalid then return "n/a"
    aa = n.getField("aa")
    if aa = invalid then return "invalid"
    return fmt(aa.name)
end function
