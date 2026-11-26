' Every callback stops re-registering after GUARD calls, so an engine that re-runs observers added
' during the dispatch prints calls=GUARD instead of hanging.
sub init()
    m.GUARD = 5
    m.n = {}
    m.timer = m.top.findNode("startTimer")
    m.timer.observeField("fire", "runCases")
    m.timer.control = "start"
end sub

sub bump(name as string)
    if m.n[name] = invalid then m.n[name] = 0
    m.n[name] = m.n[name] + 1
end sub

function count(name as string) as integer
    if m.n[name] = invalid then return 0
    return m.n[name]
end function

sub runCases()
    ' C1: a scoped observer unobserves and re-observes the field from its own callback.
    m.top.observeFieldScoped("f1", "c1Self")
    m.top.f1 = 1
    print "PROBE|c1-scoped-self-reobserve|first-set|calls=" + count("c1").toStr()
    m.top.f1 = 2
    print "PROBE|c1-scoped-self-reobserve|second-set|calls=" + count("c1").toStr()

    ' C2: the same with unscoped observeField/unobserveField.
    m.top.observeField("f2", "c2Self")
    m.top.f2 = 1
    print "PROBE|c2-unscoped-self-reobserve|first-set|calls=" + count("c2").toStr()
    m.top.f2 = 2
    print "PROBE|c2-unscoped-self-reobserve|second-set|calls=" + count("c2").toStr()

    ' C3: a scoped observer adds a second scoped observer (B) on its first call.
    m.top.observeFieldScoped("f3", "c3A")
    m.top.f3 = 1
    print "PROBE|c3-scoped-add|first-set|a=" + count("c3a").toStr() + " b=" + count("c3b").toStr()
    m.top.f3 = 2
    print "PROBE|c3-scoped-add|second-set|a=" + count("c3a").toStr() + " b=" + count("c3b").toStr()

    ' C4: the same with unscoped observers.
    m.top.observeField("f4", "c4A")
    m.top.f4 = 1
    print "PROBE|c4-unscoped-add|first-set|a=" + count("c4a").toStr() + " b=" + count("c4b").toStr()
    m.top.f4 = 2
    print "PROBE|c4-unscoped-add|second-set|a=" + count("c4a").toStr() + " b=" + count("c4b").toStr()

    ' C5: scoped A then B; A unobserves the field (scoped) on its first call. Does B still run?
    m.top.observeFieldScoped("f5", "c5A")
    m.top.observeFieldScoped("f5", "c5B")
    m.top.f5 = 1
    print "PROBE|c5-scoped-remove-sibling|first-set|a=" + count("c5a").toStr() + " b=" + count("c5b").toStr()
    m.top.f5 = 2
    print "PROBE|c5-scoped-remove-sibling|second-set|a=" + count("c5a").toStr() + " b=" + count("c5b").toStr()

    ' C6: the same with unscoped observers.
    m.top.observeField("f6", "c6A")
    m.top.observeField("f6", "c6B")
    m.top.f6 = 1
    print "PROBE|c6-unscoped-remove-sibling|first-set|a=" + count("c6a").toStr() + " b=" + count("c6b").toStr()
    m.top.f6 = 2
    print "PROBE|c6-unscoped-remove-sibling|second-set|a=" + count("c6a").toStr() + " b=" + count("c6b").toStr()

    ' C7: scoped A re-observes itself, then a write of the same field from inside the callback
    ' (the dispatch is still running). Order of the trace shows nesting.
    m.c7trace = ""
    m.top.observeFieldScoped("f7", "c7A")
    m.top.f7 = 1
    print "PROBE|c7-scoped-reobserve-then-write|first-set|calls=" + count("c7").toStr() + " trace=" + m.c7trace

    print "PROBE|done"
    m.top.probeExit = true
end sub

sub c1Self()
    bump("c1")
    if count("c1") >= m.GUARD then return
    m.top.unobserveFieldScoped("f1")
    m.top.observeFieldScoped("f1", "c1Self")
end sub

sub c2Self()
    bump("c2")
    if count("c2") >= m.GUARD then return
    m.top.unobserveField("f2")
    m.top.observeField("f2", "c2Self")
end sub

sub c3A()
    bump("c3a")
    if count("c3a") = 1 then m.top.observeFieldScoped("f3", "c3B")
end sub

sub c3B()
    bump("c3b")
end sub

sub c4A()
    bump("c4a")
    if count("c4a") = 1 then m.top.observeField("f4", "c4B")
end sub

sub c4B()
    bump("c4b")
end sub

sub c5A()
    bump("c5a")
    if count("c5a") = 1 then m.top.unobserveFieldScoped("f5")
end sub

sub c5B()
    bump("c5b")
end sub

sub c6A()
    bump("c6a")
    if count("c6a") = 1 then m.top.unobserveField("f6")
end sub

sub c6B()
    bump("c6b")
end sub

sub c7A()
    bump("c7")
    m.c7trace = m.c7trace + "[" + m.top.f7.toStr()
    if count("c7") < m.GUARD
        m.top.unobserveFieldScoped("f7")
        m.top.observeFieldScoped("f7", "c7A")
        if count("c7") = 1 then m.top.f7 = 99
    end if
    m.c7trace = m.c7trace + "]"
end sub
