' roRegex with PCRE-only patterns that JavaScript rejects, and invalid patterns (CreateObject prints an
' error and returns invalid). Expected output is the device trace in
' test/simulator/probes/regex-pcre-probe/device-trace.txt, for the cases the engine supports.
sub main()
    out("start", [])
    ' [name, pattern, flags, subjects...]
    cases = [
        ["issue1255", "^(?:(?-))?(\d+)$", "", "123", "abc"]
        ["emptyMinus", "(?-)abc", "", "abc"]
        ["emptyGroup", "(?)abc", "", "abc"]
        ["namedK", "(?<n>a)\k<n>", "", "aa", "ab"]
        ["lookbehind", "(?<=a)b", "", "ab", "cb"]
        ["classLiteral", "[(?-]+", "", "(?-", "x"]
        ["escapedGroup", "\(?-\)", "", "(-)", "-)"]
        ["invalidOpen", "(", "", "("]
        ["invalidClass", "[", "", "["]
        ["invalidStar", "*a", "", "a"]
        ["invalidRange", "a{2,1}", "", "aa"]
        ["invalidInline", "(?i", "", "a"]
    ]
    for each c in cases
        runCase(c)
    end for
    ' Outside try: does an invalid pattern stop the app?
    r = CreateObject("roRegex", "(", "")
    out("untried", [type(r)])
    out("done", [])
end sub

sub runCase(c as object)
    try
        r = CreateObject("roRegex", c[1], c[2])
        values = [type(r)]
        if r <> invalid
            for i = 3 to c.Count() - 1
                values.Push(r.IsMatch(c[i]).toStr())
            end for
        end if
        out(c[0], values)
    catch e
        out(c[0], ["catch", e.number.toStr(), e.message])
    end try
end sub

sub out(name as string, values as object)
    line = "PROBE|" + name
    for each v in values
        line = line + "|" + v
    end for
    print line
end sub
