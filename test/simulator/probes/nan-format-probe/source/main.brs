' NaN Format Probe: how NaN and infinite Float/Double values are formatted (ToStr, print, Str, format strings,
' boxed, inside a container, FormatJson) and what Val() returns for nan/inf strings. Output: PROBE|<case>|<values...>
sub main()
    ' Gives time to reconnect to the debug console, which drops its clients when an app launches.
    sleep(5000)
    print "PROBE|start"
    fnan = Sqr(-1!)
    finf = 1e38 * 1e38
    dnan = Sqr(-1#)
    dinf = 1e308# * 10#
    sprintfCases(dnan, dinf)
    formats("float-nan", fnan)
    formats("float-negnan", -fnan)
    formats("float-inf", finf)
    formats("float-neginf", -finf)
    formats("double-nan", dnan)
    formats("double-negnan", -dnan)
    formats("double-inf", dinf)
    formats("double-neginf", -dinf)
    formats("float-negzero", -0!)
    formats("double-negzero", -0#)
    print "PROBE|plain|print-begin"
    f = 5.5
    d = 2.25#
    i = 7
    print f
    print f; "|"; d; "|"; i; "|"; -f
    print [f, d, i]
    print "PROBE|plain|print-end"
    for each s in ["12abc", "  12", "1e3", "1e", "1e+", "0x1A", "&h1A", "&HFF", ".5", "-.5e-1x", "1_000", "", "abc", "12.5.6", "+5", "--5", "1 2", "3.", "1d2", "1E2", "-0", "2147483648", "99999999999", "1.5"]
        vals(s)
    end for
    for each s in ["nan", "NaN", "NAN", "-nan", "+nan", "inf", "Inf", "INF", "-inf", "+inf", "infinity", "-Infinity", "INFINITY", "1e999", "-1e999", " nan", "nanx", "infx", "in", "na", "1.5nan", "nan(1)"]
        vals(s)
    end for
    radixes = [["-5", 16], ["-99999999999", 10], ["ffffffff", 16], ["100000000", 16], ["-ffffffff", 16], ["7fffffff", 16], ["80000000", 16], ["777", 8], ["99999999999", 8], ["37777777777", 8], ["zz", 36], ["ZZ", 36], ["-1", 2], ["101", 2], ["0x10", 10], ["010", 0], ["0x1f", 0], ["19", 0], ["12", 1], ["12", 37], ["12", -1], ["-2147483648", 10], ["-2147483649", 10], ["4294967295", 10]]
    for each r in radixes
        try
            v = Val(r[0], r[1])
            res = type(v) + "|" + v.ToStr()
        catch e
            res = "ERR:" + e.number.ToStr()
        end try
        print "PROBE|radix|" + r[0] + "|" + r[1].ToStr() + "|" + res
    end for
    formatErrors()
    print "PROBE|format-errnum|"; m.formatErrorNumber
    print "PROBE|done"
end sub

sub formats(name as string, v as dynamic)
    print "PROBE|" + name + "|type=" + type(v) + "|tostr=" + v.ToStr() + "|str=" + Str(v) + "|boxed=" + Box(v).ToStr()
    try
        f = v.ToStr("%f") + "," + v.ToStr("%g") + "," + v.ToStr("%e") + "," + v.ToStr("%5.2f")
    catch e
        f = "ERR:" + e.number.ToStr()
    end try
    print "PROBE|" + name + "|fmt=" + f
    try
        j = FormatJson([v])
    catch e
        j = "ERR:" + e.number.ToStr()
    end try
    print "PROBE|" + name + "|json=" + j
    print "PROBE|" + name + "|print-begin"
    print v
    print v; "|"; v
    print [v]
    print "PROBE|" + name + "|print-end"
end sub

sub vals(s as string)
    v = Val(s)
    print "PROBE|val|" + s + "|" + type(v) + "|" + v.ToStr()
    try
        r = Val(s, 10)
        h = Val(s, 16)
        print "PROBE|val10|" + s + "|" + type(r) + "|" + r.ToStr() + "|hex=" + type(h) + "|" + h.ToStr()
    catch e
        print "PROBE|val10|" + s + "|ERR:" + e.number.ToStr()
    end try
end sub

' Format cases for @lvcabral/sprintf. Output: PROBE|sprintf|<format>|<type>|<result>
sub sprintfCases(dnan as double, dinf as double)
    dsub = 2# ^ -1074
    arr = [2.5#, dsub]
    print "PROBE|types|" + type(2.5#) + "|" + type(dsub) + "|" + type(Box(2.5#)) + "|" + type(arr[0]) + "|" + type(arr[1]) + "|" + dsub.ToStr("%g") + "|" + arr[1].ToStr("%g")
    cases = [
        ["%a", dsub], ["%.3a", dsub], ["%.0a", 1.5#], ["%.0a", 2.5#], ["%.1a", 1.99#],
        ["%a", 255.5#], ["%A", 255.5#], ["%09a", -1#], ["%a", -0#],
        ["%E", 2.5#], ["%F", -dinf], ["%G", dnan], ["%G", 0.00001#],
        ["% f", 2.5#], ["% d", 5], ["% 05d", 5], ["% u", 5], ["% x", 255],
        ["%+ d", 5], ["% +d", 5], ["%-+5d", 5], ["%0-5d", 5], ["%#x", 255], ["%#.0f", 2#], ["%i", 5], ["%o", 8], ["%X", 255], ["%c", 65],
        ["%.0f", 2.5#], ["%.0f", 0.5#], ["%.0e", 2.5#], ["%5.1f", 2.25#],
        ["%.3g", 123456.789#], ["%f", 1e300#]
    ]
    for each c in cases
        try
            res = c[1].ToStr(c[0])
        catch e
            res = "ERR:" + e.number.ToStr()
        end try
        print "PROBE|sprintf|" + c[0] + "|" + type(c[1]) + "|" + res
    end for
    ' roString.Format() goes through the same library.
    fmtCases = [["%f", dnan], ["%f", -dnan], ["%+e", dinf], ["%06.2f", -0#], ["%g|%d", 1.5#], ["%o", 8], ["%X", 255], ["%c", 65], ["%s", "ab"], ["%5s", "ab"], ["%.1s", "ab"]]
    for each c in fmtCases
        try
            if c[0] = "%g|%d"
                res = c[0].Format(c[1], 7)
            else
                res = c[0].Format(c[1])
            end if
        catch e
            res = "ERR:" + e.message
        end try
        print "PROBE|format|" + c[0] + "|" + type(c[1]) + "|" + res
    end for
end sub

' Invalid Format() specifiers. Runs last: after a failed Format() the device raises Invalid Format Specifier (&h24)
' again on the next ToStr() call, even inside the catch and even without a format.
sub formatErrors()
    for each c in [["%a", 1.5#], ["%A", 1.5#], ["%u", 5], ["%i", 5], ["%#x", 255], ["%#o", 8]]
        try
            res = c[0].Format(c[1])
        catch e
            res = "ERR:" + e.message
            m.formatErrorNumber = e.number
        end try
        print "PROBE|format|" + c[0] + "|" + type(c[1]) + "|" + res
    end for
end sub
