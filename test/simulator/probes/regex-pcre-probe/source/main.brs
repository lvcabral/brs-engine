' Regex PCRE Probe: which PCRE-only patterns roRegex accepts and how they match, and what
' CreateObject does with an invalid pattern. Output: PROBE|<case>|<values...>
sub main()
    ' Gives time to reconnect to the debug console, which drops its clients when an app launches.
    sleep(5000)
    out("start", [])
    ' [name, pattern, flags, subjects...]
    cases = [
        ["issue1255", "^(?:(?-))?(\d+)$", "", "123", "abc"]
        ["emptyMinus", "(?-)abc", "", "abc"]
        ["emptyGroup", "(?)abc", "", "abc"]
        ["inlineIStart", "(?i)abc", "", "ABC", "abd"]
        ["inlineIMid", "a(?i)bc", "", "aBC", "ABC"]
        ["inlineIScoped", "(?i:b)c", "", "Bc", "BC"]
        ["inlineMinusI", "(?-i)abc", "i", "ABC", "abc"]
        ["inlineS", "(?s)a.b", "", "a" + Chr(10) + "b"]
        ["inlineM", "(?m)^b", "", "a" + Chr(10) + "b"]
        ["inlineX", "(?x) a b ", "", "ab"]
        ["possessive", "a++b", "", "aab"]
        ["atomic", "(?>a+)b", "", "aab"]
        ["anchorsAz", "\Aabc\z", "", "abc", "xabc"]
        ["comment", "(?#note)abc", "", "abc"]
        ["namedP", "(?P<n>a)(?P=n)", "", "aa", "ab"]
        ["namedK", "(?<n>a)\k<n>", "", "aa", "ab"]
        ["posixClass", "^[[:digit:]]+$", "", "123", "12a"]
        ["unicodeProp", "^\p{Lu}$", "", "A", "a"]
        ["lookbehind", "(?<=a)b", "", "ab", "cb"]
        ["quoteQE", "a\Qx.y\E", "", "ax.y", "axzy"]
        ["hexBrace", "^\x{41}$", "", "A"]
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
